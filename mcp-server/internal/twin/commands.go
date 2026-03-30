package twin

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/websocket"
)

const commandTimeout = 30 * time.Second

// PendingCommand represents an in-flight command waiting for a response from
// the Chrome extension.
type PendingCommand struct {
	ID         string
	Action     string
	ResponseCh chan json.RawMessage
	CreatedAt  time.Time
}

// commandState holds the per-connection mutable state for pending commands
// and the write-serialising mutex required by gorilla/websocket.
type commandState struct {
	pendingMu sync.Mutex
	pending   map[string]*PendingCommand

	writeMu sync.Mutex
	conn    *websocket.Conn
}

func newCommandState(conn *websocket.Conn) *commandState {
	return &commandState{
		pending: make(map[string]*PendingCommand),
		conn:    conn,
	}
}

// writeJSON serialises v and sends it over the WebSocket connection.
// gorilla/websocket is not goroutine-safe for writes — this method
// serialises all writers with writeMu.
func (cs *commandState) writeJSON(v any) error {
	data, err := json.Marshal(v)
	if err != nil {
		return fmt.Errorf("marshal: %w", err)
	}
	cs.writeMu.Lock()
	defer cs.writeMu.Unlock()
	return cs.conn.WriteMessage(websocket.TextMessage, data)
}

// ExecuteCommand sends a command to the Chrome extension and blocks until it
// receives a response (or the timeout fires).
//
// action should be one of the browser_* command names, e.g. "browser_search".
// params is serialised as the "params" field of the command message.
func (cs *commandState) ExecuteCommand(action string, params map[string]any) (json.RawMessage, error) {
	id := uuid.New().String()

	ch := make(chan json.RawMessage, 1)
	cmd := &PendingCommand{
		ID:         id,
		Action:     action,
		ResponseCh: ch,
		CreatedAt:  time.Now(),
	}

	cs.pendingMu.Lock()
	cs.pending[id] = cmd
	cs.pendingMu.Unlock()

	defer func() {
		cs.pendingMu.Lock()
		delete(cs.pending, id)
		cs.pendingMu.Unlock()
	}()

	// Send the command message to the extension.
	msg := map[string]any{
		"type":   "command",
		"id":     id,
		"action": action,
		"params": params,
	}
	if err := cs.writeJSON(msg); err != nil {
		return nil, fmt.Errorf("send command %s: %w", action, err)
	}

	slog.Debug("twin: command sent", "id", id, "action", action)

	// Wait for the response or timeout.
	select {
	case result := <-ch:
		slog.Debug("twin: command response received", "id", id, "action", action)
		return result, nil
	case <-time.After(commandTimeout):
		return nil, fmt.Errorf("command %s (id=%s) timed out after %s", action, id, commandTimeout)
	}
}

// handleCommandResponse is called from the WebSocket read loop when the
// extension sends back a { type: 'response', id, result } message. It locates
// the matching PendingCommand and delivers the result.
func (cs *commandState) handleCommandResponse(id string, result json.RawMessage) {
	cs.pendingMu.Lock()
	cmd, ok := cs.pending[id]
	cs.pendingMu.Unlock()

	if !ok {
		slog.Warn("twin: response for unknown command id", "id", id)
		return
	}

	select {
	case cmd.ResponseCh <- result:
	default:
		slog.Warn("twin: response channel full or already delivered", "id", id)
	}
}

// activeState holds the currently connected extension's command state.
// nil when no extension is connected.
var (
	activeMu    sync.RWMutex
	activeState *commandState
)

// setActiveState stores the command state for the current WS connection.
func setActiveState(cs *commandState) {
	activeMu.Lock()
	defer activeMu.Unlock()
	activeState = cs
}

// clearActiveState removes the command state when a connection closes.
func clearActiveState() {
	activeMu.Lock()
	defer activeMu.Unlock()
	activeState = nil
}

// ExecuteCommand is a package-level function that proxies to the active
// connection's command state. Returns an error if no extension is connected.
func ExecuteCommand(action string, params map[string]any) (json.RawMessage, error) {
	activeMu.RLock()
	cs := activeState
	activeMu.RUnlock()

	if cs == nil {
		return nil, fmt.Errorf("no Chrome extension connected to Twin Bridge")
	}

	return cs.ExecuteCommand(action, params)
}
