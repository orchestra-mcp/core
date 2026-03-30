package twin

import (
	"sync"
)

const defaultMaxAlerts = 500

// AlertStore is a thread-safe ring buffer for Alert records.
// When the store reaches its capacity, the oldest alert is evicted to make
// room for the new one.
type AlertStore struct {
	mu       sync.RWMutex
	alerts   []Alert
	maxSize  int
	head     int // index of the oldest entry (ring buffer write position)
	count    int // number of entries currently stored
}

// NewAlertStore creates an AlertStore with capacity maxSize. If maxSize <= 0
// the default (500) is used.
func NewAlertStore(maxSize int) *AlertStore {
	if maxSize <= 0 {
		maxSize = defaultMaxAlerts
	}
	return &AlertStore{
		alerts:  make([]Alert, maxSize),
		maxSize: maxSize,
	}
}

// Add appends a new alert to the store. If the store is full the oldest entry
// is silently evicted.
func (s *AlertStore) Add(alert Alert) {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.alerts[s.head] = alert
	s.head = (s.head + 1) % s.maxSize
	if s.count < s.maxSize {
		s.count++
	}
}

// GetAlerts returns up to limit alerts (newest first). If source is non-empty
// only alerts with a matching Source field are returned. A limit of 0 means
// return all stored alerts.
func (s *AlertStore) GetAlerts(limit int, source string) []Alert {
	s.mu.RLock()
	defer s.mu.RUnlock()

	// Build a snapshot ordered newest-first.
	result := make([]Alert, 0, s.count)
	for i := 1; i <= s.count; i++ {
		// Walk backwards from the last-written slot.
		idx := (s.head - i + s.maxSize) % s.maxSize
		a := s.alerts[idx]
		if source != "" && a.Source != source {
			continue
		}
		result = append(result, a)
		if limit > 0 && len(result) >= limit {
			break
		}
	}
	return result
}

// MarkRead marks the alert with the given ID as read. Returns true if the
// alert was found and updated.
func (s *AlertStore) MarkRead(id string) bool {
	s.mu.Lock()
	defer s.mu.Unlock()

	for i := range s.alerts {
		if s.alerts[i].ID == id {
			s.alerts[i].Read = true
			return true
		}
	}
	return false
}

// UnreadCount returns the total number of unread alerts currently in the
// store.
func (s *AlertStore) UnreadCount() int {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var n int
	for i := 1; i <= s.count; i++ {
		idx := (s.head - i + s.maxSize) % s.maxSize
		if !s.alerts[idx].Read {
			n++
		}
	}
	return n
}

// UnreadCountBySource returns a map of source → unread alert count.
func (s *AlertStore) UnreadCountBySource() map[string]int {
	s.mu.RLock()
	defer s.mu.RUnlock()

	counts := make(map[string]int)
	for i := 1; i <= s.count; i++ {
		idx := (s.head - i + s.maxSize) % s.maxSize
		a := s.alerts[idx]
		if !a.Read {
			counts[a.Source]++
		}
	}
	return counts
}

// Len returns the number of alerts currently in the store.
func (s *AlertStore) Len() int {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.count
}
