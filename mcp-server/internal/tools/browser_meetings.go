package tools

// browser_meetings.go — MCP tools for browser meeting sessions captured via
// the Chrome extension Twin Bridge. All caption data stays local (in the
// TwinBridge MeetingStore). Nothing in this file reads from or writes to the
// cloud database.

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/orchestra-mcp/server/internal/mcp"
	"github.com/orchestra-mcp/server/internal/twin"
)

// ---------------------------------------------------------------------------
// JSON Schemas
// ---------------------------------------------------------------------------

var browserMeetingListSchema = json.RawMessage(`{
	"type": "object",
	"properties": {
		"limit": {
			"type": "integer",
			"description": "Maximum number of meetings to return (default: 10)",
			"minimum": 1,
			"maximum": 50
		},
		"platform": {
			"type": "string",
			"enum": ["google_meet", "zoom"],
			"description": "Filter by platform. Leave empty for all platforms."
		}
	}
}`)

var browserMeetingSummarySchema = json.RawMessage(`{
	"type": "object",
	"properties": {
		"id": {
			"type": "string",
			"description": "Meeting session ID returned by meeting_list_browser"
		}
	},
	"required": ["id"]
}`)

var browserMeetingCaptionsSchema = json.RawMessage(`{
	"type": "object",
	"properties": {
		"id": {
			"type": "string",
			"description": "Meeting session ID"
		},
		"limit": {
			"type": "integer",
			"description": "Maximum number of caption lines to return (default: 100). Captions are local-only.",
			"minimum": 1,
			"maximum": 5000
		},
		"speaker": {
			"type": "string",
			"description": "Filter captions by speaker name (case-insensitive partial match)."
		},
		"lang": {
			"type": "string",
			"enum": ["ar", "en", "mixed", "unknown"],
			"description": "Filter captions by detected language."
		}
	},
	"required": ["id"]
}`)

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

// RegisterBrowserMeetingTools registers MCP tools for browser meeting sessions.
// These tools are backed by the TwinBridge MeetingStore — no DB required.
func RegisterBrowserMeetingTools(registry *mcp.ToolRegistry, meetings *twin.MeetingStore) {
	registry.Register(
		"meeting_list_browser",
		"List recent browser meeting sessions captured via the Chrome extension "+
			"(Google Meet and Zoom). Returns session IDs, titles, platforms, "+
			"and duration. Caption data is local-only and can be retrieved with "+
			"meeting_captions.",
		browserMeetingListSchema,
		makeBrowserMeetingList(meetings),
	)

	registry.Register(
		"meeting_summary",
		"Get the auto-generated summary for a specific browser meeting session. "+
			"Includes duration, dominant language (AR/EN/mixed), top topics extracted "+
			"from captions, and per-speaker participation breakdown. "+
			"Data is local — no cloud sync.",
		browserMeetingSummarySchema,
		makeBrowserMeetingSummary(meetings),
	)

	registry.Register(
		"meeting_captions",
		"Get the raw caption transcript for a browser meeting session. "+
			"PRIVACY: captions never leave this device. Supports filtering by "+
			"speaker name and/or language (ar/en/mixed). "+
			"Use this for full transcript access or manual review.",
		browserMeetingCaptionsSchema,
		makeBrowserMeetingCaptions(meetings),
	)
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

func makeBrowserMeetingList(meetings *twin.MeetingStore) mcp.ToolHandler {
	return func(_ context.Context, params json.RawMessage) (*mcp.ToolResult, error) {
		var input struct {
			Limit    int    `json:"limit"`
			Platform string `json:"platform"`
		}
		if len(params) > 0 && string(params) != "null" {
			if err := json.Unmarshal(params, &input); err != nil {
				return mcp.ErrorResult("invalid params: " + err.Error()), nil
			}
		}
		if input.Limit <= 0 {
			input.Limit = 10
		}

		sessions := meetings.List(input.Limit)

		type sessionOut struct {
			ID               string  `json:"id"`
			Platform         string  `json:"platform"`
			Title            string  `json:"title"`
			Participants     []string `json:"participants"`
			StartedAt        string  `json:"started_at"`
			EndedAt          *string `json:"ended_at,omitempty"`
			DurationSeconds  *int64  `json:"duration_seconds,omitempty"`
			CaptionCount     int     `json:"caption_count"`
			DominantLanguage string  `json:"dominant_language,omitempty"`
			Status           string  `json:"status"`
		}

		out := make([]sessionOut, 0, len(sessions))
		for _, s := range sessions {
			if input.Platform != "" && s.Platform != input.Platform {
				continue
			}

			item := sessionOut{
				ID:           s.ID,
				Platform:     s.Platform,
				Title:        s.Title,
				Participants: s.Participants,
				StartedAt:    s.StartedAt.Format("2006-01-02T15:04:05Z"),
				CaptionCount: len(s.Captions),
				Status:       "active",
			}
			if len(item.Participants) == 0 {
				item.Participants = []string{}
			}
			if s.EndedAt != nil {
				t := s.EndedAt.Format("2006-01-02T15:04:05Z")
				item.EndedAt = &t
				item.Status = "ended"
			}
			if s.Summary != nil {
				item.DurationSeconds = &s.Summary.DurationSeconds
				item.DominantLanguage = s.Summary.DominantLanguage
			}
			out = append(out, item)
		}

		result := map[string]interface{}{
			"meetings": out,
			"total":    len(out),
		}
		data, err := json.MarshalIndent(result, "", "  ")
		if err != nil {
			return mcp.ErrorResult(fmt.Sprintf("marshal: %v", err)), nil
		}
		return mcp.TextResult(string(data)), nil
	}
}

func makeBrowserMeetingSummary(meetings *twin.MeetingStore) mcp.ToolHandler {
	return func(_ context.Context, params json.RawMessage) (*mcp.ToolResult, error) {
		var input struct {
			ID string `json:"id"`
		}
		if err := json.Unmarshal(params, &input); err != nil {
			return mcp.ErrorResult("invalid params: " + err.Error()), nil
		}
		if input.ID == "" {
			return mcp.ErrorResult("id is required"), nil
		}

		session := meetings.GetByID(input.ID)
		if session == nil {
			return mcp.ErrorResult(fmt.Sprintf("meeting session not found: %s", input.ID)), nil
		}

		if session.Summary == nil {
			// Meeting is still active or ended without summary — generate on demand
			if session.EndedAt != nil {
				now := *session.EndedAt
				_ = now
				session.Summary = twin.GenerateMeetingSummary(session)
			} else {
				return mcp.ErrorResult("meeting is still in progress — summary not yet available"), nil
			}
		}

		s := session.Summary

		var md strings.Builder
		md.WriteString(fmt.Sprintf("# Meeting Summary: %s\n\n", orUnknown(session.Title, "Untitled Meeting")))
		md.WriteString(fmt.Sprintf("**Platform:** %s\n", session.Platform))
		md.WriteString(fmt.Sprintf("**Started:** %s\n", session.StartedAt.Format("2006-01-02 15:04 UTC")))
		if session.EndedAt != nil {
			md.WriteString(fmt.Sprintf("**Ended:** %s\n", session.EndedAt.Format("2006-01-02 15:04 UTC")))
		}
		md.WriteString(fmt.Sprintf("**Duration:** %s\n", formatDuration(s.DurationSeconds)))
		md.WriteString(fmt.Sprintf("**Language:** %s\n", s.DominantLanguage))
		md.WriteString(fmt.Sprintf("**Captions:** %d lines\n\n", s.CaptionCount))

		if len(session.Participants) > 0 {
			md.WriteString("## Participants\n\n")
			for _, p := range session.Participants {
				md.WriteString(fmt.Sprintf("- %s\n", p))
			}
			md.WriteString("\n")
		}

		if len(s.SpeakingTime) > 0 {
			md.WriteString("## Speaking Participation\n\n")
			md.WriteString("| Speaker | Captions |\n|---------|----------|\n")
			for speaker, count := range s.SpeakingTime {
				md.WriteString(fmt.Sprintf("| %s | %d |\n", speaker, count))
			}
			md.WriteString("\n")
		}

		if len(s.TopTopics) > 0 {
			md.WriteString("## Key Topics\n\n")
			for _, t := range s.TopTopics {
				md.WriteString(fmt.Sprintf("- %s\n", t))
			}
			md.WriteString("\n")
		}

		result := map[string]interface{}{
			"id":                session.ID,
			"summary_markdown":  md.String(),
			"duration_seconds":  s.DurationSeconds,
			"dominant_language": s.DominantLanguage,
			"caption_count":     s.CaptionCount,
			"top_topics":        s.TopTopics,
			"speaking_time":     s.SpeakingTime,
		}

		data, err := json.MarshalIndent(result, "", "  ")
		if err != nil {
			return mcp.ErrorResult(fmt.Sprintf("marshal: %v", err)), nil
		}
		return mcp.TextResult(string(data)), nil
	}
}

func makeBrowserMeetingCaptions(meetings *twin.MeetingStore) mcp.ToolHandler {
	return func(_ context.Context, params json.RawMessage) (*mcp.ToolResult, error) {
		var input struct {
			ID      string `json:"id"`
			Limit   int    `json:"limit"`
			Speaker string `json:"speaker"`
			Lang    string `json:"lang"`
		}
		if err := json.Unmarshal(params, &input); err != nil {
			return mcp.ErrorResult("invalid params: " + err.Error()), nil
		}
		if input.ID == "" {
			return mcp.ErrorResult("id is required"), nil
		}
		if input.Limit <= 0 {
			input.Limit = 100
		}

		session := meetings.GetByID(input.ID)
		if session == nil {
			return mcp.ErrorResult(fmt.Sprintf("meeting session not found: %s", input.ID)), nil
		}

		type captionOut struct {
			Speaker   string `json:"speaker"`
			Text      string `json:"text"`
			Lang      string `json:"lang"`
			Timestamp string `json:"timestamp"`
		}

		speakerFilter := strings.ToLower(input.Speaker)

		var filtered []captionOut
		for _, c := range session.Captions {
			if speakerFilter != "" && !strings.Contains(strings.ToLower(c.Speaker), speakerFilter) {
				continue
			}
			if input.Lang != "" && c.Lang != input.Lang {
				continue
			}
			filtered = append(filtered, captionOut{
				Speaker:   c.Speaker,
				Text:      c.Text,
				Lang:      c.Lang,
				Timestamp: c.Timestamp.Format("15:04:05"),
			})
			if len(filtered) >= input.Limit {
				break
			}
		}

		result := map[string]interface{}{
			"id":         session.ID,
			"title":      session.Title,
			"platform":   session.Platform,
			"captions":   filtered,
			"total":      len(filtered),
			"privacy":    "local-only — captions never leave this device",
		}
		data, err := json.MarshalIndent(result, "", "  ")
		if err != nil {
			return mcp.ErrorResult(fmt.Sprintf("marshal: %v", err)), nil
		}
		return mcp.TextResult(string(data)), nil
	}
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

func orUnknown(s, fallback string) string {
	if s != "" {
		return s
	}
	return fallback
}

func formatDuration(secs int64) string {
	if secs <= 0 {
		return "unknown"
	}
	h := secs / 3600
	m := (secs % 3600) / 60
	s := secs % 60
	if h > 0 {
		return fmt.Sprintf("%dh %dm %ds", h, m, s)
	}
	if m > 0 {
		return fmt.Sprintf("%dm %ds", m, s)
	}
	return fmt.Sprintf("%ds", s)
}
