package twin

import (
	"encoding/json"
	"fmt"
	"sync"
	"testing"
	"time"
)

// makeAlert is a test helper that builds a minimal Alert.
func makeAlert(id, source, alertType string) Alert {
	return Alert{
		ID:        id,
		Source:    source,
		Type:      alertType,
		Data:      json.RawMessage(`{}`),
		CreatedAt: time.Now().UTC(),
		Read:      false,
	}
}

func TestAlertStore_AddAndGet(t *testing.T) {
	s := NewAlertStore(10)

	s.Add(makeAlert("1", "github", "mention"))
	s.Add(makeAlert("2", "gmail", "dm"))
	s.Add(makeAlert("3", "github", "pr_review"))

	all := s.GetAlerts(0, "")
	if len(all) != 3 {
		t.Fatalf("expected 3 alerts, got %d", len(all))
	}

	// Newest first — last added should be index 0.
	if all[0].ID != "3" {
		t.Errorf("expected newest alert first, got ID %q", all[0].ID)
	}
}

func TestAlertStore_Limit(t *testing.T) {
	s := NewAlertStore(10)
	for i := 0; i < 8; i++ {
		s.Add(makeAlert(fmt.Sprintf("%d", i), "src", "type"))
	}

	got := s.GetAlerts(3, "")
	if len(got) != 3 {
		t.Fatalf("expected 3 alerts with limit=3, got %d", len(got))
	}
}

func TestAlertStore_SourceFilter(t *testing.T) {
	s := NewAlertStore(10)
	s.Add(makeAlert("1", "github", "mention"))
	s.Add(makeAlert("2", "gmail", "dm"))
	s.Add(makeAlert("3", "github", "pr_review"))
	s.Add(makeAlert("4", "slack", "mention"))

	github := s.GetAlerts(0, "github")
	if len(github) != 2 {
		t.Fatalf("expected 2 github alerts, got %d", len(github))
	}
	for _, a := range github {
		if a.Source != "github" {
			t.Errorf("unexpected source %q in github filter results", a.Source)
		}
	}
}

func TestAlertStore_RingBufferEviction(t *testing.T) {
	const cap = 5
	s := NewAlertStore(cap)

	// Fill past capacity.
	for i := 0; i < 8; i++ {
		s.Add(makeAlert(fmt.Sprintf("%d", i), "src", "type"))
	}

	got := s.GetAlerts(0, "")
	if len(got) != cap {
		t.Fatalf("expected %d alerts after eviction, got %d", cap, len(got))
	}

	// Newest first: IDs should be 7, 6, 5, 4, 3.
	expected := []string{"7", "6", "5", "4", "3"}
	for i, a := range got {
		if a.ID != expected[i] {
			t.Errorf("pos %d: expected ID %q, got %q", i, expected[i], a.ID)
		}
	}
}

func TestAlertStore_MarkRead(t *testing.T) {
	s := NewAlertStore(10)
	s.Add(makeAlert("abc", "github", "mention"))

	if !s.MarkRead("abc") {
		t.Fatal("MarkRead returned false for existing alert")
	}
	if s.MarkRead("nonexistent") {
		t.Error("MarkRead returned true for nonexistent ID")
	}

	all := s.GetAlerts(0, "")
	if !all[0].Read {
		t.Error("alert should be marked as read")
	}
}

func TestAlertStore_UnreadCount(t *testing.T) {
	s := NewAlertStore(10)
	s.Add(makeAlert("1", "github", "mention"))
	s.Add(makeAlert("2", "gmail", "dm"))
	s.Add(makeAlert("3", "github", "pr_review"))

	if s.UnreadCount() != 3 {
		t.Fatalf("expected 3 unread, got %d", s.UnreadCount())
	}

	s.MarkRead("1")
	if s.UnreadCount() != 2 {
		t.Fatalf("expected 2 unread after marking one read, got %d", s.UnreadCount())
	}
}

func TestAlertStore_UnreadCountBySource(t *testing.T) {
	s := NewAlertStore(10)
	s.Add(makeAlert("1", "github", "mention"))
	s.Add(makeAlert("2", "gmail", "dm"))
	s.Add(makeAlert("3", "github", "pr_review"))
	s.Add(makeAlert("4", "slack", "mention"))

	s.MarkRead("1") // mark one github read

	bySource := s.UnreadCountBySource()
	if bySource["github"] != 1 {
		t.Errorf("expected 1 unread github, got %d", bySource["github"])
	}
	if bySource["gmail"] != 1 {
		t.Errorf("expected 1 unread gmail, got %d", bySource["gmail"])
	}
	if bySource["slack"] != 1 {
		t.Errorf("expected 1 unread slack, got %d", bySource["slack"])
	}
}

func TestAlertStore_ConcurrentAccess(t *testing.T) {
	const workers = 20
	const perWorker = 50
	s := NewAlertStore(defaultMaxAlerts)

	var wg sync.WaitGroup
	for w := 0; w < workers; w++ {
		wg.Add(1)
		go func(w int) {
			defer wg.Done()
			for i := 0; i < perWorker; i++ {
				id := fmt.Sprintf("w%d-i%d", w, i)
				s.Add(makeAlert(id, "src", "type"))
				s.GetAlerts(10, "")
				s.UnreadCount()
				s.UnreadCountBySource()
			}
		}(w)
	}
	wg.Wait()

	total := s.Len()
	if total == 0 {
		t.Error("expected some alerts after concurrent writes")
	}
}

func TestAlertStore_EmptyStore(t *testing.T) {
	s := NewAlertStore(10)
	if s.Len() != 0 {
		t.Error("new store should be empty")
	}
	if s.UnreadCount() != 0 {
		t.Error("new store unread count should be 0")
	}
	if got := s.GetAlerts(0, ""); len(got) != 0 {
		t.Errorf("expected empty slice, got %d", len(got))
	}
}
