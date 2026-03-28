package mcp

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/orchestra-mcp/server/internal/auth"
	"github.com/orchestra-mcp/server/internal/db"
	"github.com/orchestra-mcp/server/internal/logging"
)

const (
	// MCP protocol version — Streamable HTTP (2025-11-25).
	protocolVersion = "2025-11-25"
	// Legacy protocol version for backwards-compatible SSE clients.
	legacyProtocolVersion = "2024-11-05"

	serverName    = "orchestra-mcp"
	serverVersion = "0.1.0"

	// SSE keepalive interval for legacy SSE streams and GET streams.
	keepaliveInterval = 30 * time.Second

	// Session expiry — sessions not seen for this duration are cleaned up.
	sessionMaxIdle = 30 * time.Minute
)

// mcpSession tracks a single MCP session with its auth context and optional
// SSE stream channel for server-initiated messages.
type mcpSession struct {
	ID              string
	ProtocolVersion string
	UserCtx         *auth.UserContext
	CreatedAt       time.Time
	LastSeen        time.Time

	mu     sync.Mutex
	sseOut chan []byte // buffered channel for server-initiated SSE messages (GET stream)
}

// legacySession tracks a legacy SSE client connection (old 2024-11-05 protocol).
type legacySession struct {
	id       string
	messages chan []byte
	userCtx  *auth.UserContext
}

// Server handles MCP protocol communication over both the new Streamable HTTP
// transport (2025-11-25) and the legacy SSE transport (2024-11-05).
type Server struct {
	Registry *ToolRegistry
	Logger   *logging.DBLogger
	DBClient *db.Client

	mu       sync.RWMutex
	sessions map[string]*mcpSession

	legacyMu       sync.RWMutex
	legacySessions  map[string]*legacySession
}

// NewServer creates a new MCP server with the given tool registry.
func NewServer(registry *ToolRegistry, logger *logging.DBLogger, dbClient *db.Client) *Server {
	s := &Server{
		Registry:       registry,
		Logger:         logger,
		DBClient:       dbClient,
		sessions:       make(map[string]*mcpSession),
		legacySessions: make(map[string]*legacySession),
	}
	// Start background session cleanup.
	go s.cleanupLoop()
	return s
}

// cleanupLoop periodically removes expired sessions.
func (s *Server) cleanupLoop() {
	ticker := time.NewTicker(5 * time.Minute)
	defer ticker.Stop()
	for range ticker.C {
		s.mu.Lock()
		now := time.Now()
		for id, sess := range s.sessions {
			sess.mu.Lock()
			idle := now.Sub(sess.LastSeen)
			sess.mu.Unlock()
			if idle > sessionMaxIdle {
				if sess.sseOut != nil {
					close(sess.sseOut)
				}
				delete(s.sessions, id)
				slog.Info("session expired", "session", id, "idle", idle)
			}
		}
		s.mu.Unlock()
	}
}

// dbLog safely writes a log entry if the DB logger is configured.
func (s *Server) dbLog(level, message string, ctx map[string]interface{}, requestID, userID string) {
	if s.Logger != nil {
		s.Logger.Log(level, message, ctx, requestID, userID)
	}
}

// userIDFromRequest extracts the authenticated user ID from the request context.
func userIDFromRequest(r *http.Request) string {
	if uc := auth.UserContextFromContext(r.Context()); uc != nil {
		return uc.UserID
	}
	return ""
}

// ---------------------------------------------------------------------------
// Streamable HTTP Transport (MCP 2025-11-25)
// ---------------------------------------------------------------------------

// HandleMCP is the single /mcp endpoint that handles GET, POST, and DELETE for
// the MCP 2025-11-25 Streamable HTTP transport, with backwards compatibility
// for the legacy SSE transport (2024-11-05).
func (s *Server) HandleMCP(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		s.handleGet(w, r)
	case http.MethodPost:
		s.handlePost(w, r)
	case http.MethodDelete:
		s.handleDelete(w, r)
	default:
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}

// handleGet serves either:
//   - Legacy SSE transport: returns endpoint event + SSE stream (old protocol)
//   - Streamable HTTP: returns SSE stream for server-initiated messages
func (s *Server) handleGet(w http.ResponseWriter, r *http.Request) {
	sessionID := r.Header.Get("Mcp-Session-Id")
	lastEventID := r.Header.Get("Last-Event-ID")

	// Detect legacy SSE client: no MCP-Session-Id header and no Last-Event-ID.
	if sessionID == "" && lastEventID == "" {
		s.handleLegacySSE(w, r)
		return
	}

	// Streamable HTTP GET — open SSE stream for server-initiated messages.
	if sessionID == "" {
		http.Error(w, `{"jsonrpc":"2.0","error":{"code":-32600,"message":"missing Mcp-Session-Id header"}}`, http.StatusBadRequest)
		return
	}

	s.mu.RLock()
	sess, ok := s.sessions[sessionID]
	s.mu.RUnlock()
	if !ok {
		http.Error(w, `{"jsonrpc":"2.0","error":{"code":-32600,"message":"invalid session"}}`, http.StatusNotFound)
		return
	}

	sess.mu.Lock()
	sess.LastSeen = time.Now()
	// Initialize SSE output channel if not yet created.
	if sess.sseOut == nil {
		sess.sseOut = make(chan []byte, 64)
	}
	sseOut := sess.sseOut
	sess.mu.Unlock()

	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "streaming not supported", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no")
	w.Header().Set("Mcp-Session-Id", sessionID)
	w.WriteHeader(http.StatusOK)
	flusher.Flush()

	ticker := time.NewTicker(keepaliveInterval)
	defer ticker.Stop()

	ctx := r.Context()
	for {
		select {
		case <-ctx.Done():
			return
		case msg, open := <-sseOut:
			if !open {
				return
			}
			fmt.Fprintf(w, "event: message\ndata: %s\n\n", msg)
			flusher.Flush()
		case <-ticker.C:
			fmt.Fprintf(w, ": ping\n\n")
			flusher.Flush()
		}
	}
}

// handlePost processes a JSON-RPC request, notification, or response over POST.
func (s *Server) handlePost(w http.ResponseWriter, r *http.Request) {
	// Read and parse the body.
	var raw json.RawMessage
	if err := json.NewDecoder(r.Body).Decode(&raw); err != nil {
		writeJSONError(w, nil, -32700, "parse error: "+err.Error())
		return
	}

	// Peek at the message to determine its type.
	var peek struct {
		JSONRPC string          `json:"jsonrpc"`
		ID      json.RawMessage `json:"id"`
		Method  string          `json:"method"`
	}
	if err := json.Unmarshal(raw, &peek); err != nil {
		writeJSONError(w, nil, -32700, "parse error: "+err.Error())
		return
	}

	if peek.JSONRPC != "2.0" {
		writeJSONError(w, peek.ID, -32600, "invalid JSON-RPC version")
		return
	}

	// --- Handle initialize (creates a new session) ---
	if peek.Method == "initialize" {
		s.handleInitializePost(w, r, raw)
		return
	}

	// --- For all other messages, resolve the session ---
	sessionID := r.Header.Get("Mcp-Session-Id")
	if sessionID == "" {
		// Backwards compat: try query param from legacy SSE transport.
		sessionID = r.URL.Query().Get("sessionId")
	}

	// Check if this is a legacy SSE session.
	if sessionID != "" {
		s.legacyMu.RLock()
		legSess, isLegacy := s.legacySessions[sessionID]
		s.legacyMu.RUnlock()
		if isLegacy {
			// Inject the stored auth context from the SSE connection
			if legSess.userCtx != nil {
				r = r.WithContext(auth.WithUserContext(r.Context(), legSess.userCtx))
			}
			s.handleLegacyMessage(w, r, legSess, raw)
			return
		}
	}

	// Streamable HTTP session.
	if sessionID == "" {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusNotFound)
		json.NewEncoder(w).Encode(makeErrorResponse(peek.ID, -32600, "missing session — send initialize first"))
		return
	}

	s.mu.RLock()
	sess, ok := s.sessions[sessionID]
	s.mu.RUnlock()
	if !ok {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusNotFound)
		json.NewEncoder(w).Encode(makeErrorResponse(peek.ID, -32600, "invalid session"))
		return
	}

	sess.mu.Lock()
	sess.LastSeen = time.Now()
	sess.mu.Unlock()

	// Inject the session's auth context into the request context.
	if sess.UserCtx != nil {
		ctx := auth.WithUserContext(r.Context(), sess.UserCtx)
		r = r.WithContext(ctx)
	}

	// Notification or response (no ID or no method with an ID that is a response).
	isNotification := peek.Method != "" && (peek.ID == nil || string(peek.ID) == "null")
	isResponse := peek.Method == "" && peek.ID != nil && string(peek.ID) != "null"

	if isNotification || isResponse {
		w.WriteHeader(http.StatusAccepted)
		return
	}

	// It is a JSON-RPC request — parse fully and route.
	var req JSONRPCRequest
	if err := json.Unmarshal(raw, &req); err != nil {
		writeJSONError(w, peek.ID, -32700, "parse error: "+err.Error())
		return
	}

	slog.Info("MCP request", "session", sessionID, "method", req.Method)

	resp := s.routeRequest(r, &req)
	if resp == nil {
		// Handler returned nil (e.g., notification handler called for a request).
		w.WriteHeader(http.StatusAccepted)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Mcp-Session-Id", sessionID)
	json.NewEncoder(w).Encode(resp)
}

// handleInitializePost creates a new session and returns the InitializeResult.
func (s *Server) handleInitializePost(w http.ResponseWriter, r *http.Request, raw json.RawMessage) {
	var req JSONRPCRequest
	if err := json.Unmarshal(raw, &req); err != nil {
		writeJSONError(w, nil, -32700, "parse error: "+err.Error())
		return
	}

	// Determine the protocol version the client requested.
	var params struct {
		ProtocolVersion string `json:"protocolVersion"`
	}
	if req.Params != nil {
		json.Unmarshal(req.Params, &params)
	}

	// Negotiate protocol version: prefer 2025-11-25, fall back to 2024-11-05.
	negotiatedVersion := protocolVersion
	if params.ProtocolVersion != "" && params.ProtocolVersion != protocolVersion {
		// Accept the legacy version too.
		if params.ProtocolVersion == legacyProtocolVersion {
			negotiatedVersion = legacyProtocolVersion
		}
		// For any other version, we still respond with our preferred version.
		// The client will decide whether to continue.
	}

	// Create a new session.
	sessionID := uuid.New().String()
	sess := &mcpSession{
		ID:              sessionID,
		ProtocolVersion: negotiatedVersion,
		CreatedAt:       time.Now(),
		LastSeen:        time.Now(),
	}

	// Attach auth context from the request (set by auth middleware).
	if uc := auth.UserContextFromContext(r.Context()); uc != nil {
		sess.UserCtx = uc
	}

	s.mu.Lock()
	s.sessions[sessionID] = sess
	s.mu.Unlock()

	slog.Info("MCP session created", "session", sessionID, "protocol", negotiatedVersion, "remote", r.RemoteAddr)
	s.dbLog(logging.LevelInfo, "MCP session created", map[string]interface{}{
		"session":  sessionID,
		"protocol": negotiatedVersion,
		"remote":   r.RemoteAddr,
	}, sessionID, userIDFromRequest(r))

	// Build the initialize result.
	result := InitializeResult{
		ProtocolVersion: negotiatedVersion,
		Capabilities: ServerCapabilities{
			Tools: &ToolsCapability{
				ListChanged: false,
			},
		},
		ServerInfo: ServerInfo{
			Name:    serverName,
			Version: serverVersion,
		},
	}

	data, err := json.Marshal(result)
	if err != nil {
		writeJSONError(w, req.ID, -32603, "internal error: "+err.Error())
		return
	}

	resp := &JSONRPCResponse{
		JSONRPC: "2.0",
		ID:      req.ID,
		Result:  data,
	}

	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Mcp-Session-Id", sessionID)
	json.NewEncoder(w).Encode(resp)
}

// handleDelete terminates a session.
func (s *Server) handleDelete(w http.ResponseWriter, r *http.Request) {
	sessionID := r.Header.Get("Mcp-Session-Id")
	if sessionID == "" {
		http.Error(w, `{"error":"missing Mcp-Session-Id header"}`, http.StatusBadRequest)
		return
	}

	s.mu.Lock()
	sess, ok := s.sessions[sessionID]
	if ok {
		if sess.sseOut != nil {
			close(sess.sseOut)
			sess.sseOut = nil
		}
		delete(s.sessions, sessionID)
	}
	s.mu.Unlock()

	if !ok {
		http.Error(w, `{"error":"session not found"}`, http.StatusNotFound)
		return
	}

	slog.Info("MCP session terminated", "session", sessionID)
	s.dbLog(logging.LevelInfo, "MCP session terminated", map[string]interface{}{
		"session": sessionID,
	}, sessionID, "")

	w.WriteHeader(http.StatusOK)
}

// ---------------------------------------------------------------------------
// Legacy SSE Transport (2024-11-05) — backwards compatibility
// ---------------------------------------------------------------------------

// handleLegacySSE handles the old SSE transport: GET /mcp returns an endpoint
// event pointing the client to POST /mcp?sessionId=xxx.
func (s *Server) handleLegacySSE(w http.ResponseWriter, r *http.Request) {
	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "streaming not supported", http.StatusInternalServerError)
		return
	}

	sess := &legacySession{
		id:       uuid.New().String(),
		messages: make(chan []byte, 64),
		userCtx:  auth.UserContextFromContext(r.Context()),
	}

	s.legacyMu.Lock()
	s.legacySessions[sess.id] = sess
	s.legacyMu.Unlock()

	defer func() {
		s.legacyMu.Lock()
		delete(s.legacySessions, sess.id)
		s.legacyMu.Unlock()
		close(sess.messages)
	}()

	slog.Info("MCP legacy SSE client connected", "session", sess.id, "remote", r.RemoteAddr)
	s.dbLog(logging.LevelInfo, "MCP legacy client connected", map[string]interface{}{
		"session": sess.id,
		"remote":  r.RemoteAddr,
	}, sess.id, userIDFromRequest(r))

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no")

	// Send the endpoint event so the client knows where to POST messages.
	endpointURL := fmt.Sprintf("/mcp?sessionId=%s", sess.id)
	fmt.Fprintf(w, "event: endpoint\ndata: %s\n\n", endpointURL)
	flusher.Flush()

	ticker := time.NewTicker(keepaliveInterval)
	defer ticker.Stop()

	ctx := r.Context()
	for {
		select {
		case <-ctx.Done():
			slog.Info("MCP legacy SSE client disconnected", "session", sess.id, "remote", r.RemoteAddr)
			s.dbLog(logging.LevelInfo, "MCP legacy client disconnected", map[string]interface{}{
				"session": sess.id,
				"remote":  r.RemoteAddr,
			}, sess.id, userIDFromRequest(r))
			return

		case msg, open := <-sess.messages:
			if !open {
				return
			}
			fmt.Fprintf(w, "event: message\ndata: %s\n\n", msg)
			flusher.Flush()

		case <-ticker.C:
			fmt.Fprintf(w, ": ping\n\n")
			flusher.Flush()
		}
	}
}

// handleLegacyMessage handles POST requests from legacy SSE clients.
func (s *Server) handleLegacyMessage(w http.ResponseWriter, r *http.Request, sess *legacySession, raw json.RawMessage) {
	var req JSONRPCRequest
	if err := json.Unmarshal(raw, &req); err != nil {
		writeJSONError(w, nil, -32700, "parse error: "+err.Error())
		return
	}

	if req.JSONRPC != "2.0" {
		writeJSONError(w, req.ID, -32600, "invalid JSON-RPC version")
		return
	}

	slog.Info("MCP legacy message received", "session", sess.id, "method", req.Method)

	resp := s.routeRequest(r, &req)

	// If the request has an ID, send the response through the SSE channel.
	if req.ID != nil && resp != nil {
		data, err := json.Marshal(resp)
		if err != nil {
			slog.Error("failed to marshal response", "error", err)
			w.WriteHeader(http.StatusInternalServerError)
			return
		}
		sess.messages <- data
	}

	w.WriteHeader(http.StatusAccepted)
}

// ---------------------------------------------------------------------------
// JSON-RPC Request Routing
// ---------------------------------------------------------------------------

// routeRequest dispatches a JSON-RPC request to the correct handler method.
func (s *Server) routeRequest(r *http.Request, req *JSONRPCRequest) *JSONRPCResponse {
	switch req.Method {
	case "initialize":
		return s.handleInitialize(req)
	case "ping":
		return s.handlePing(req)
	case "tools/list":
		return s.handleToolsList(req)
	case "tools/call":
		return s.handleToolsCall(r, req)
	case "notifications/initialized":
		// Client notification — no response needed.
		return nil
	case "notifications/cancelled":
		// Client cancelled a request — acknowledge.
		return nil
	default:
		return makeErrorResponse(req.ID, -32601, fmt.Sprintf("method not found: %s", req.Method))
	}
}

// handleInitialize responds to the initialize request with server info and capabilities.
// This is used by the legacy SSE transport; the Streamable HTTP path uses handleInitializePost.
func (s *Server) handleInitialize(req *JSONRPCRequest) *JSONRPCResponse {
	result := InitializeResult{
		ProtocolVersion: legacyProtocolVersion,
		Capabilities: ServerCapabilities{
			Tools: &ToolsCapability{
				ListChanged: true,
			},
		},
		ServerInfo: ServerInfo{
			Name:    serverName,
			Version: serverVersion,
		},
	}

	data, err := json.Marshal(result)
	if err != nil {
		return makeErrorResponse(req.ID, -32603, "internal error: "+err.Error())
	}

	return &JSONRPCResponse{
		JSONRPC: "2.0",
		ID:      req.ID,
		Result:  data,
	}
}

// handlePing responds with an empty result (pong).
func (s *Server) handlePing(req *JSONRPCRequest) *JSONRPCResponse {
	return &JSONRPCResponse{
		JSONRPC: "2.0",
		ID:      req.ID,
		Result:  json.RawMessage(`{}`),
	}
}

// handleToolsList returns all registered tools.
func (s *Server) handleToolsList(req *JSONRPCRequest) *JSONRPCResponse {
	result := ToolsListResult{
		Tools: s.Registry.List(),
	}

	data, err := json.Marshal(result)
	if err != nil {
		return makeErrorResponse(req.ID, -32603, "internal error: "+err.Error())
	}

	return &JSONRPCResponse{
		JSONRPC: "2.0",
		ID:      req.ID,
		Result:  data,
	}
}

// handleToolsCall invokes a tool and returns the result.
func (s *Server) handleToolsCall(r *http.Request, req *JSONRPCRequest) *JSONRPCResponse {
	var params ToolsCallParams
	if err := json.Unmarshal(req.Params, &params); err != nil {
		return makeErrorResponse(req.ID, -32602, "invalid params: "+err.Error())
	}

	// Resolve session ID for logging — try header first, then query param.
	sessionID := r.Header.Get("Mcp-Session-Id")
	if sessionID == "" {
		sessionID = r.URL.Query().Get("sessionId")
	}
	uid := userIDFromRequest(r)

	// Extract org ID from auth context for audit logging.
	var orgID string
	if userCtx, ok := auth.FromContext(r.Context()); ok {
		orgID = userCtx.OrgID
	}

	start := time.Now()
	result, err := s.Registry.Call(r.Context(), params.Name, params.Arguments)
	duration := time.Since(start)

	if err != nil {
		slog.Error("tool call failed", "tool", params.Name, "error", err, "duration", duration)
		s.dbLog(logging.LevelError, fmt.Sprintf("Tool error: %s", params.Name), map[string]interface{}{
			"tool":     params.Name,
			"error":    err.Error(),
			"duration": duration.String(),
		}, sessionID, uid)

		s.logToolAudit(r.Context(), orgID, uid, params.Name, duration, true)

		errResult := &ToolResult{
			Content: []ContentBlock{{Type: "text", Text: err.Error()}},
			IsError: true,
		}
		data, _ := json.Marshal(errResult)
		return &JSONRPCResponse{
			JSONRPC: "2.0",
			ID:      req.ID,
			Result:  data,
		}
	}

	slog.Info("tool call completed", "tool", params.Name, "duration", duration)
	s.dbLog(logging.LevelInfo, fmt.Sprintf("Tool called: %s", params.Name), map[string]interface{}{
		"tool":     params.Name,
		"duration": duration.String(),
	}, sessionID, uid)

	s.logToolAudit(r.Context(), orgID, uid, params.Name, duration, false)

	data, err := json.Marshal(result)
	if err != nil {
		return makeErrorResponse(req.ID, -32603, "internal error: "+err.Error())
	}

	return &JSONRPCResponse{
		JSONRPC: "2.0",
		ID:      req.ID,
		Result:  data,
	}
}

// logToolAudit writes an audit entry to the activity_log table via the Supabase
// REST client. This runs in a goroutine to avoid blocking the tool response.
func (s *Server) logToolAudit(_ context.Context, orgID, userID, toolName string, duration time.Duration, isError bool) {
	if s.DBClient == nil {
		return
	}

	go func() {
		details := map[string]interface{}{
			"tool":        toolName,
			"duration_ms": duration.Milliseconds(),
		}
		if isError {
			details["status"] = "error"
		} else {
			details["status"] = "success"
		}

		detailsJSON, err := json.Marshal(details)
		if err != nil {
			slog.Error("failed to marshal audit details", "error", err)
			return
		}

		payload := map[string]interface{}{
			"action":  "tool_call",
			"summary": fmt.Sprintf("Called tool: %s", toolName),
			"details": json.RawMessage(detailsJSON),
		}
		if orgID != "" {
			payload["org_id"] = orgID
		}
		if userID != "" {
			payload["user_id"] = userID
		}

		_, postErr := s.DBClient.Post(context.Background(), "activity_log", payload)
		if postErr != nil {
			slog.Warn("failed to write audit log", "error", postErr, "tool", toolName)
		}
	}()
}

// HandleWebSocket handles WebSocket connections for the MCP protocol.
func (s *Server) HandleWebSocket(w http.ResponseWriter, r *http.Request) {
	slog.Info("MCP WebSocket endpoint", "remote", r.RemoteAddr)
	http.Error(w, "websocket not yet implemented", http.StatusNotImplemented)
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// makeErrorResponse builds a JSON-RPC error response.
func makeErrorResponse(id json.RawMessage, code int, message string) *JSONRPCResponse {
	return &JSONRPCResponse{
		JSONRPC: "2.0",
		ID:      id,
		Error: &JSONRPCError{
			Code:    code,
			Message: message,
		},
	}
}

// writeJSONError writes a JSON-RPC error response directly to the HTTP response writer.
func writeJSONError(w http.ResponseWriter, id json.RawMessage, code int, message string) {
	resp := makeErrorResponse(id, code, message)
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusBadRequest)
	json.NewEncoder(w).Encode(resp)
}

// acceptsSSE checks whether the request's Accept header includes text/event-stream.
func acceptsSSE(r *http.Request) bool {
	return strings.Contains(r.Header.Get("Accept"), "text/event-stream")
}
