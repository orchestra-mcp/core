package mcp

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"sync"
	"time"

	"github.com/google/uuid"
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

	mu       sync.RWMutex
	sessions map[string]*session
}

// NewServer creates a new MCP server with the given tool registry.
func NewServer(registry *ToolRegistry) *Server {
	return &Server{
		Registry: registry,
		sessions: make(map[string]*session),
	}
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

	result, err := s.Registry.Call(r.Context(), params.Name, params.Arguments)
	if err != nil {
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
