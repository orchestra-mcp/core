package twin

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

// DesktopClient calls the Rust Desktop MCP server (localhost:9998) to fetch
// Apple-native twin alerts (Mail, Calendar, Notifications).
//
// All calls have a short timeout so a missing Desktop never blocks Claude.

const desktopMCPURL = "http://localhost:9998/mcp"
const desktopTimeout = 500 * time.Millisecond

// DesktopAlert is a simplified alert returned by the Desktop's twin_alerts tool.
type DesktopAlert struct {
	ID        string `json:"id"`
	Source    string `json:"source"`
	Title     string `json:"title"`
	Body      string `json:"body"`
	Sender    string `json:"sender"`
	Timestamp string `json:"timestamp"`
	IsRead    bool   `json:"is_read"`
	Priority  string `json:"priority"`
}

var desktopHTTPClient = &http.Client{Timeout: desktopTimeout}

// FetchDesktopAlerts calls the Desktop's twin_alerts tool and returns the
// raw alerts. Returns nil (not an error) if the Desktop is unreachable.
func FetchDesktopAlerts(limit int) ([]DesktopAlert, error) {
	if limit <= 0 {
		limit = 20
	}

	body, err := json.Marshal(map[string]interface{}{
		"jsonrpc": "2.0",
		"method":  "tools/call",
		"id":      1,
		"params": map[string]interface{}{
			"name":      "twin_alerts",
			"arguments": map[string]interface{}{"limit": limit},
		},
	})
	if err != nil {
		return nil, err
	}

	resp, err := desktopHTTPClient.Post(desktopMCPURL, "application/json", bytes.NewReader(body))
	if err != nil {
		// Desktop not running — not an error, return empty
		return nil, nil //nolint:nilerr
	}
	defer resp.Body.Close()

	var rpc struct {
		Result *struct {
			Content []struct {
				Type string `json:"type"`
				Text string `json:"text"`
			} `json:"content"`
		} `json:"result"`
		Error *struct {
			Message string `json:"message"`
		} `json:"error"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&rpc); err != nil {
		return nil, fmt.Errorf("desktop decode: %w", err)
	}
	if rpc.Error != nil {
		return nil, fmt.Errorf("desktop tool error: %s", rpc.Error.Message)
	}
	if rpc.Result == nil || len(rpc.Result.Content) == 0 {
		return nil, nil
	}

	// The Desktop returns a markdown payload; look for the JSON alerts array
	// embedded in it, or fall back to parsing the raw text as JSON.
	text := rpc.Result.Content[0].Text
	var payload struct {
		Alerts []DesktopAlert `json:"alerts"`
	}
	if err := json.Unmarshal([]byte(text), &payload); err != nil {
		// Not JSON — Desktop may have returned markdown. Return empty gracefully.
		return nil, nil //nolint:nilerr
	}
	return payload.Alerts, nil
}

// DesktopStatus holds a summary of the Desktop twin.
type DesktopStatus struct {
	Running bool `json:"running"`
	Alerts  int  `json:"alerts"`
}

// FetchDesktopStatus returns the Desktop twin status, or nil if unreachable.
func FetchDesktopStatus() (*DesktopStatus, error) {
	body, _ := json.Marshal(map[string]interface{}{
		"jsonrpc": "2.0",
		"method":  "tools/call",
		"id":      2,
		"params": map[string]interface{}{
			"name":      "twin_status",
			"arguments": map[string]interface{}{},
		},
	})

	resp, err := desktopHTTPClient.Post(desktopMCPURL, "application/json", bytes.NewReader(body))
	if err != nil {
		return nil, nil //nolint:nilerr
	}
	defer resp.Body.Close()

	var rpc struct {
		Result *struct {
			Content []struct {
				Text string `json:"text"`
			} `json:"content"`
		} `json:"result"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&rpc); err != nil || rpc.Result == nil || len(rpc.Result.Content) == 0 {
		return nil, nil
	}

	var st DesktopStatus
	if err := json.Unmarshal([]byte(rpc.Result.Content[0].Text), &st); err != nil {
		return nil, nil
	}
	return &st, nil
}
