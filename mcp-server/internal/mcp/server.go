package mcp

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/orchestra-mcp/server/internal/auth"
	"github.com/orchestra-mcp/server/internal/db"
	"github.com/orchestra-mcp/server/internal/logging"
)

const (
	// MCP protocol version supported by this server.
	protocolVersion = "2024-11-05"
	serverName      = "orchestra-mcp"
	serverVersion   = "0.1.0"

	// SSE keepalive interval.
	keepaliveInterval = 30 * time.Second
)

// session tracks a single SSE client connection and its message channel.
type session struct {
	id       string
	messages chan []byte
}

// Server handles MCP protocol communication over SSE transport.
type Server struct {
	Registry *ToolRegistry
	Logger   *logging.DBLogger
	DBClient *db.Client

	mu       sync.RWMutex
	sessions map[string]*session
}

// NewServer creates a new MCP server with the given tool registry.
// The logger and dbClient parameters are optional — pass nil to disable
// DB logging or audit trail recording respectively.
func NewServer(registry *ToolRegistry, logger *logging.DBLogger, dbClient *db.Client) *Server {
	return &Server{
		Registry: registry,
		Logger:   logger,
		DBClient: dbClient,
		sessions: make(map[string]*session),
	}
}

// dbLog safely writes a log entry if the DB logger is configured.
func (s *Server) dbLog(level, message string, ctx map[string]interface{}, requestID, userID string) {
	if s.Logger != nil {
		s.Logger.Log(level, message, ctx, requestID, userID)
	}
}

// userIDFromRequest extracts the authenticated user ID from the request context, if present.
func userIDFromRequest(r *http.Request) string {
	if uc := auth.UserContextFromContext(r.Context()); uc != nil {
		return uc.UserID
	}
	return ""
}

// HandleSSE handles Server-Sent Events connections for the MCP protocol.
// GET /mcp — establishes an SSE stream and sends the endpoint URI.
func (s *Server) HandleSSE(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodPost {
		s.HandleMessage(w, r)
		return
	}

	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "streaming not supported", http.StatusInternalServerError)
		return
	}

	// Create a new session.
	sess := &session{
		id:       uuid.New().String(),
		messages: make(chan []byte, 64),
	}

	s.mu.Lock()
	s.sessions[sess.id] = sess
	s.mu.Unlock()

	defer func() {
		s.mu.Lock()
		delete(s.sessions, sess.id)
		s.mu.Unlock()
		close(sess.messages)
	}()

	slog.Info("MCP SSE client connected", "session", sess.id, "remote", r.RemoteAddr)
	s.dbLog(logging.LevelInfo, "MCP client connected", map[string]interface{}{
		"session": sess.id,
		"remote":  r.RemoteAddr,
	}, sess.id, userIDFromRequest(r))

	// Set SSE headers.
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no")

	// Send the endpoint event so the client knows where to POST messages.
	endpointURL := fmt.Sprintf("/mcp?sessionId=%s", sess.id)
	fmt.Fprintf(w, "event: endpoint\ndata: %s\n\n", endpointURL)
	flusher.Flush()

	// Start keepalive ticker.
	ticker := time.NewTicker(keepaliveInterval)
	defer ticker.Stop()

	ctx := r.Context()
	for {
		select {
		case <-ctx.Done():
			slog.Info("MCP SSE client disconnected", "session", sess.id, "remote", r.RemoteAddr)
			s.dbLog(logging.LevelInfo, "MCP client disconnected", map[string]interface{}{
				"session": sess.id,
				"remote":  r.RemoteAddr,
			}, sess.id, userIDFromRequest(r))
			return

		case msg, ok := <-sess.messages:
			if !ok {
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

// HandleMessage handles POST requests containing JSON-RPC messages from the client.
// POST /mcp?sessionId=<id>
func (s *Server) HandleMessage(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	sessionID := r.URL.Query().Get("sessionId")
	if sessionID == "" {
		writeJSONError(w, nil, -32600, "missing sessionId query parameter")
		return
	}

	s.mu.RLock()
	sess, ok := s.sessions[sessionID]
	s.mu.RUnlock()

	if !ok {
		writeJSONError(w, nil, -32600, "unknown session")
		return
	}

	var req JSONRPCRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSONError(w, nil, -32700, "parse error: "+err.Error())
		return
	}

	if req.JSONRPC != "2.0" {
		writeJSONError(w, req.ID, -32600, "invalid JSON-RPC version")
		return
	}

	slog.Info("MCP message received", "session", sessionID, "method", req.Method)

	// Route the request to the appropriate handler.
	resp := s.routeRequest(r, &req)

	// If the request has an ID, it expects a response. Send it through the SSE channel.
	if req.ID != nil {
		data, err := json.Marshal(resp)
		if err != nil {
			slog.Error("failed to marshal response", "error", err)
			w.WriteHeader(http.StatusInternalServerError)
			return
		}
		sess.messages <- data
	}

	// Acknowledge receipt of the POST.
	w.WriteHeader(http.StatusAccepted)
}

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
	default:
		return makeErrorResponse(req.ID, -32601, fmt.Sprintf("method not found: %s", req.Method))
	}
}

// handleInitialize responds to the initialize request with server info and capabilities.
func (s *Server) handleInitialize(req *JSONRPCRequest) *JSONRPCResponse {
	result := InitializeResult{
		ProtocolVersion: protocolVersion,
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

	sessionID := r.URL.Query().Get("sessionId")
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

		// Log failed tool call to the activity_log audit table.
		s.logToolAudit(r.Context(), orgID, uid, params.Name, duration, true)

		// Tool not found or execution error — return as tool error, not JSON-RPC error.
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

	// Log successful tool call to the activity_log audit table.
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
// It uses context.Background() because the goroutine outlives the request context.
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
