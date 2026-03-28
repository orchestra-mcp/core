package realtime

import "sync"

// Hub manages real-time connections and message broadcasting.
type Hub struct {
	mu      sync.RWMutex
	clients map[string]chan []byte
}

// NewHub creates a new realtime hub.
func NewHub() *Hub {
	return &Hub{
		clients: make(map[string]chan []byte),
	}
}

// Subscribe registers a client and returns a channel for receiving messages.
func (h *Hub) Subscribe(clientID string) <-chan []byte {
	h.mu.Lock()
	defer h.mu.Unlock()

	ch := make(chan []byte, 64)
	h.clients[clientID] = ch
	return ch
}

// Unsubscribe removes a client from the hub.
func (h *Hub) Unsubscribe(clientID string) {
	h.mu.Lock()
	defer h.mu.Unlock()

	if ch, ok := h.clients[clientID]; ok {
		close(ch)
		delete(h.clients, clientID)
	}
}

// Broadcast sends a message to all connected clients.
func (h *Hub) Broadcast(msg []byte) {
	h.mu.RLock()
	defer h.mu.RUnlock()

	for _, ch := range h.clients {
		select {
		case ch <- msg:
		default:
			// Drop message if client buffer is full
		}
	}
}
