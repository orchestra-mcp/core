package realtime

import (
	"sync"
)

// Message represents a change event broadcast through the hub.
type Message struct {
	Table  string      `json:"table"`
	Event  string      `json:"event"` // INSERT, UPDATE, DELETE
	Record interface{} `json:"record"`
	OrgID  string      `json:"org_id"`
}

// Subscriber represents a connected client receiving real-time messages.
type Subscriber struct {
	OrgID    string
	Messages chan Message
	Done     chan struct{}
}

// Hub manages real-time connections and message broadcasting per organization.
type Hub struct {
	mu          sync.RWMutex
	subscribers map[string][]*Subscriber // key: org_id
}

// NewHub creates a new realtime hub.
func NewHub() *Hub {
	return &Hub{
		subscribers: make(map[string][]*Subscriber),
	}
}

// Subscribe registers a subscriber for the given organization and returns it.
// The caller should read from sub.Messages and select on sub.Done for cleanup.
func (h *Hub) Subscribe(orgID string) *Subscriber {
	h.mu.Lock()
	defer h.mu.Unlock()

	sub := &Subscriber{
		OrgID:    orgID,
		Messages: make(chan Message, 64),
		Done:     make(chan struct{}),
	}

	h.subscribers[orgID] = append(h.subscribers[orgID], sub)
	return sub
}

// Unsubscribe removes a subscriber from the hub and closes its channels.
func (h *Hub) Unsubscribe(sub *Subscriber) {
	h.mu.Lock()
	defer h.mu.Unlock()

	subs := h.subscribers[sub.OrgID]
	for i, s := range subs {
		if s == sub {
			// Remove from slice without preserving order.
			subs[i] = subs[len(subs)-1]
			subs[len(subs)-1] = nil
			h.subscribers[sub.OrgID] = subs[:len(subs)-1]
			break
		}
	}

	// Signal the subscriber that it has been removed.
	select {
	case <-sub.Done:
		// Already closed.
	default:
		close(sub.Done)
	}
}

// Broadcast sends a message to all subscribers in the message's organization.
func (h *Hub) Broadcast(msg Message) {
	h.mu.RLock()
	defer h.mu.RUnlock()

	subs := h.subscribers[msg.OrgID]
	for _, sub := range subs {
		select {
		case sub.Messages <- msg:
		default:
			// Drop message if subscriber buffer is full.
		}
	}
}

// SubscriberCount returns the number of active subscribers for an organization.
func (h *Hub) SubscriberCount(orgID string) int {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return len(h.subscribers[orgID])
}
