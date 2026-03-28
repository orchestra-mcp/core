package mcp

import (
	"log/slog"
	"net/http"
)

// Server handles MCP protocol communication over SSE and WebSocket transports.
type Server struct {
	Registry *ToolRegistry
}

// NewServer creates a new MCP server with the given tool registry.
func NewServer(registry *ToolRegistry) *Server {
	return &Server{Registry: registry}
}

// HandleSSE handles Server-Sent Events connections for the MCP protocol.
func (s *Server) HandleSSE(w http.ResponseWriter, r *http.Request) {
	slog.Info("MCP SSE endpoint", "remote", r.RemoteAddr)

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")

	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "streaming not supported", http.StatusInternalServerError)
		return
	}

	_, _ = w.Write([]byte("data: {\"status\":\"connected\"}\n\n"))
	flusher.Flush()

	// Placeholder: hold connection open until client disconnects
	<-r.Context().Done()
	slog.Info("MCP SSE client disconnected", "remote", r.RemoteAddr)
}

// HandleWebSocket handles WebSocket connections for the MCP protocol.
func (s *Server) HandleWebSocket(w http.ResponseWriter, r *http.Request) {
	slog.Info("MCP WebSocket endpoint", "remote", r.RemoteAddr)
	// Placeholder: WebSocket upgrade will be implemented with gorilla/websocket or nhooyr.io/websocket
	http.Error(w, "websocket not yet implemented", http.StatusNotImplemented)
}
