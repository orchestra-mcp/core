package twin

import (
	"encoding/json"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
)

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

// Caption represents a single caption line received during a meeting.
// Caption data is local-only and never sent to the cloud.
type Caption struct {
	Speaker   string    `json:"speaker"`
	Text      string    `json:"text"`
	Lang      string    `json:"lang"` // "ar", "en", "mixed", "unknown"
	Timestamp time.Time `json:"timestamp"`
}

// MeetingSession holds all data collected during a single meeting.
// Sessions are kept in memory for the duration of the meeting and a short
// retention window afterwards (up to maxMeetingSessions).
type MeetingSession struct {
	ID           string    `json:"id"`
	Platform     string    `json:"platform"`     // "google_meet" | "zoom"
	Title        string    `json:"title"`
	Participants []string  `json:"participants"`
	Captions     []Caption `json:"captions"`
	StartedAt    time.Time `json:"started_at"`
	EndedAt      *time.Time `json:"ended_at,omitempty"`
	Summary      *MeetingSummary `json:"summary,omitempty"`
}

// MeetingSummary is a structured analysis generated at meeting end.
type MeetingSummary struct {
	DurationSeconds  int64             `json:"duration_seconds"`
	DominantLanguage string            `json:"dominant_language"` // "ar", "en", "mixed"
	CaptionCount     int               `json:"caption_count"`
	SpeakingTime     map[string]int    `json:"speaking_time"` // speaker → caption count
	TopTopics        []string          `json:"top_topics"`
}

// ---------------------------------------------------------------------------
// MeetingStore
// ---------------------------------------------------------------------------

const maxMeetingSessions = 50

// MeetingStore holds recent meeting sessions in a thread-safe ring buffer.
// All data stays in process memory — no SQLite, no cloud.
type MeetingStore struct {
	mu       sync.RWMutex
	sessions []*MeetingSession
	head     int
	count    int
}

// NewMeetingStore creates a store for up to maxMeetingSessions sessions.
func NewMeetingStore() *MeetingStore {
	return &MeetingStore{
		sessions: make([]*MeetingSession, maxMeetingSessions),
	}
}

// Add stores a new meeting session. Overwrites the oldest entry when full.
func (s *MeetingStore) Add(session *MeetingSession) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.sessions[s.head] = session
	s.head = (s.head + 1) % maxMeetingSessions
	if s.count < maxMeetingSessions {
		s.count++
	}
}

// GetByID returns the session with the given ID, or nil if not found.
func (s *MeetingStore) GetByID(id string) *MeetingSession {
	s.mu.RLock()
	defer s.mu.RUnlock()
	for i := 1; i <= s.count; i++ {
		idx := (s.head - i + maxMeetingSessions) % maxMeetingSessions
		if s.sessions[idx] != nil && s.sessions[idx].ID == id {
			return s.sessions[idx]
		}
	}
	return nil
}

// List returns up to limit sessions (newest first).
func (s *MeetingStore) List(limit int) []*MeetingSession {
	s.mu.RLock()
	defer s.mu.RUnlock()
	if limit <= 0 || limit > s.count {
		limit = s.count
	}
	result := make([]*MeetingSession, 0, limit)
	for i := 1; i <= s.count && len(result) < limit; i++ {
		idx := (s.head - i + maxMeetingSessions) % maxMeetingSessions
		if s.sessions[idx] != nil {
			result = append(result, s.sessions[idx])
		}
	}
	return result
}

// ---------------------------------------------------------------------------
// Event handlers — called from TwinBridge.handleConnection
// ---------------------------------------------------------------------------

// meetingStartedPayload is the JSON shape sent by content scripts on meeting_started.
type meetingStartedPayload struct {
	Platform     string   `json:"platform"`
	Title        string   `json:"title"`
	Participants []string `json:"participants"`
	MeetingID    string   `json:"meetingId"`
	URL          string   `json:"url"`
	Ts           int64    `json:"ts"`
}

// captionPayload is the JSON shape sent by content scripts for each caption.
type captionPayload struct {
	MeetingID string `json:"meetingId"`
	Speaker   string `json:"speaker"`
	Text      string `json:"text"`
	Lang      string `json:"lang"`
	Ts        int64  `json:"ts"`
}

// meetingEndedPayload is the JSON shape sent by content scripts on meeting_ended.
// The service worker enriches this with accumulated captions before forwarding.
type meetingEndedPayload struct {
	Platform     string            `json:"platform"`
	MeetingID    string            `json:"meetingId"`
	URL          string            `json:"url"`
	Ts           int64             `json:"ts"`
	Title        string            `json:"title"`
	Participants []string          `json:"participants"`
	Captions     []captionPayload  `json:"captions"`
	StartedAt    int64             `json:"startedAt"`
}

// HandleMeetingStarted processes a meeting_started BridgeEvent and creates
// a new MeetingSession in the store.
func (tb *TwinBridge) HandleMeetingStarted(event BridgeEvent) {
	var payload meetingStartedPayload
	if err := json.Unmarshal(event.Data, &payload); err != nil {
		return
	}

	id := payload.MeetingID
	if id == "" {
		id = uuid.New().String()
	}

	ts := time.Unix(payload.Ts/1000, (payload.Ts%1000)*int64(time.Millisecond))
	if payload.Ts == 0 {
		ts = time.Now().UTC()
	}

	session := &MeetingSession{
		ID:           id,
		Platform:     payload.Platform,
		Title:        payload.Title,
		Participants: payload.Participants,
		Captions:     []Caption{},
		StartedAt:    ts,
	}

	tb.meetings.Add(session)
}

// HandleCaption appends a live caption to the relevant active session.
func (tb *TwinBridge) HandleCaption(event BridgeEvent) {
	var payload captionPayload
	if err := json.Unmarshal(event.Data, &payload); err != nil {
		return
	}
	if payload.MeetingID == "" || payload.Text == "" {
		return
	}

	session := tb.meetings.GetByID(payload.MeetingID)
	if session == nil || session.EndedAt != nil {
		return
	}

	ts := time.Unix(payload.Ts/1000, (payload.Ts%1000)*int64(time.Millisecond))
	if payload.Ts == 0 {
		ts = time.Now().UTC()
	}

	tb.meetings.mu.Lock()
	session.Captions = append(session.Captions, Caption{
		Speaker:   payload.Speaker,
		Text:      payload.Text,
		Lang:      payload.Lang,
		Timestamp: ts,
	})
	tb.meetings.mu.Unlock()
}

// HandleMeetingEnded finalises a session, generates a summary, and creates
// a meeting_summary alert in the AlertStore.
func (tb *TwinBridge) HandleMeetingEnded(event BridgeEvent) {
	var payload meetingEndedPayload
	if err := json.Unmarshal(event.Data, &payload); err != nil {
		return
	}

	session := tb.meetings.GetByID(payload.MeetingID)
	if session == nil {
		// Session may not exist if server restarted mid-meeting — reconstruct it.
		session = &MeetingSession{
			ID:           payload.MeetingID,
			Platform:     payload.Platform,
			Title:        payload.Title,
			Participants: payload.Participants,
			Captions:     make([]Caption, 0, len(payload.Captions)),
		}
		if payload.StartedAt > 0 {
			session.StartedAt = time.Unix(payload.StartedAt/1000, 0)
		} else {
			session.StartedAt = time.Now().UTC()
		}
		// Restore captions from payload
		for _, c := range payload.Captions {
			ts := time.Unix(c.Ts/1000, 0)
			session.Captions = append(session.Captions, Caption{
				Speaker:   c.Speaker,
				Text:      c.Text,
				Lang:      c.Lang,
				Timestamp: ts,
			})
		}
		tb.meetings.Add(session)
	} else {
		// Merge any captions the SW accumulated that we didn't receive individually
		tb.meetings.mu.Lock()
		existing := make(map[string]bool)
		for _, c := range session.Captions {
			existing[c.Speaker+":"+c.Text] = true
		}
		for _, c := range payload.Captions {
			key := c.Speaker + ":" + c.Text
			if !existing[key] {
				ts := time.Unix(c.Ts/1000, 0)
				session.Captions = append(session.Captions, Caption{
					Speaker:   c.Speaker,
					Text:      c.Text,
					Lang:      c.Lang,
					Timestamp: ts,
				})
			}
		}
		tb.meetings.mu.Unlock()
	}

	now := time.Now().UTC()
	summary := GenerateMeetingSummary(session)

	tb.meetings.mu.Lock()
	session.EndedAt = &now
	session.Summary = summary
	tb.meetings.mu.Unlock()

	// Create an alert so the user is notified
	summaryData, _ := json.Marshal(map[string]interface{}{
		"meeting_id":        session.ID,
		"platform":          session.Platform,
		"title":             session.Title,
		"duration_seconds":  summary.DurationSeconds,
		"dominant_language": summary.DominantLanguage,
		"caption_count":     summary.CaptionCount,
		"participants":      session.Participants,
		"top_topics":        summary.TopTopics,
	})

	tb.store.Add(Alert{
		ID:        uuid.New().String(),
		Source:    event.Source,
		Type:      "meeting_summary",
		Data:      summaryData,
		CreatedAt: now,
		Read:      false,
	})
}

// ---------------------------------------------------------------------------
// GenerateMeetingSummary
// ---------------------------------------------------------------------------

// GenerateMeetingSummary analyses a finished MeetingSession and produces a
// structured summary. It does not call any external service — all analysis is
// done locally on the caption text.
func GenerateMeetingSummary(session *MeetingSession) *MeetingSummary {
	summary := &MeetingSummary{
		SpeakingTime: make(map[string]int),
		TopTopics:    []string{},
	}

	if !session.StartedAt.IsZero() && session.EndedAt != nil {
		summary.DurationSeconds = int64(session.EndedAt.Sub(session.StartedAt).Seconds())
	}

	summary.CaptionCount = len(session.Captions)

	// Language distribution
	arCount := 0
	enCount := 0
	for _, c := range session.Captions {
		switch c.Lang {
		case "ar":
			arCount++
		case "en":
			enCount++
		case "mixed":
			arCount++
			enCount++
		}
		// Speaking time (caption count per speaker)
		if c.Speaker != "" {
			summary.SpeakingTime[c.Speaker]++
		}
	}

	total := arCount + enCount
	if total == 0 {
		summary.DominantLanguage = "unknown"
	} else {
		arRatio := float64(arCount) / float64(total)
		if arRatio >= 0.7 {
			summary.DominantLanguage = "ar"
		} else if arRatio <= 0.3 {
			summary.DominantLanguage = "en"
		} else {
			summary.DominantLanguage = "mixed"
		}
	}

	// Extract rough key topics via simple word frequency on English captions
	// This is intentionally lightweight — no NLP library dependency.
	summary.TopTopics = extractTopics(session.Captions)

	return summary
}

// extractTopics returns up to 5 candidate topic phrases by counting frequent
// meaningful words across all caption text. Intentionally simple: no stemming,
// no stop-word list beyond the most common English words.
func extractTopics(captions []Caption) []string {
	stopWords := map[string]bool{
		"the": true, "a": true, "an": true, "and": true, "or": true,
		"but": true, "is": true, "are": true, "was": true, "were": true,
		"i": true, "we": true, "you": true, "he": true, "she": true,
		"it": true, "to": true, "of": true, "in": true, "on": true,
		"at": true, "for": true, "with": true, "this": true, "that": true,
		"so": true, "just": true, "like": true, "okay": true, "ok": true,
		"um": true, "uh": true, "yeah": true, "yes": true, "no": true,
	}

	freq := make(map[string]int)
	for _, c := range captions {
		if c.Lang == "ar" {
			continue // Skip Arabic — word frequency without NLP is not useful
		}
		words := strings.Fields(strings.ToLower(c.Text))
		for _, w := range words {
			// Strip punctuation
			w = strings.Trim(w, ".,!?;:\"'()")
			if len(w) < 4 {
				continue
			}
			if stopWords[w] {
				continue
			}
			freq[w]++
		}
	}

	// Pick top 5 by frequency
	type wordFreq struct {
		word  string
		count int
	}
	var ranked []wordFreq
	for w, c := range freq {
		if c >= 3 { // Appear at least 3 times to be a "topic"
			ranked = append(ranked, wordFreq{w, c})
		}
	}

	// Simple insertion sort for small slices
	for i := 1; i < len(ranked); i++ {
		for j := i; j > 0 && ranked[j].count > ranked[j-1].count; j-- {
			ranked[j], ranked[j-1] = ranked[j-1], ranked[j]
		}
	}

	topics := make([]string, 0, 5)
	for _, wf := range ranked {
		if len(topics) >= 5 {
			break
		}
		topics = append(topics, wf.word)
	}
	return topics
}
