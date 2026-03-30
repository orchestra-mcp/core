package tools

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/orchestra-mcp/server/internal/mcp"
	"github.com/orchestra-mcp/server/internal/twin"
)

// ---------------------------------------------------------------------------
// JSON Schemas
// ---------------------------------------------------------------------------

var twinSyncSchema = json.RawMessage(`{
	"type": "object",
	"properties": {}
}`)

var twinRestoreSchema = json.RawMessage(`{
	"type": "object",
	"properties": {
		"date": {
			"type": "string",
			"description": "Date to restore in YYYY-MM-DD format (default: today)"
		}
	}
}`)

var twinDigestSchema = json.RawMessage(`{
	"type": "object",
	"properties": {}
}`)

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

// RegisterSyncTools registers twin_sync, twin_restore, and twin_digest MCP tools.
func RegisterSyncTools(registry *mcp.ToolRegistry, store *twin.AlertStore) {
	registry.Register(
		"twin_sync",
		"Build today's activity digest from the Twin Bridge, encrypt it with your "+
			"local key, and push it to the Orchestra Cloud. Raw message content is "+
			"never included — only aggregate counts and patterns. Your key never leaves "+
			"this machine; the cloud only stores an encrypted blob it cannot read.",
		twinSyncSchema,
		makeTwinSyncHandler(store),
	)

	registry.Register(
		"twin_restore",
		"Fetch an encrypted sync blob from the Orchestra Cloud and decrypt it locally. "+
			"Returns the full SyncPayload (digest, patterns, context, routine) for the "+
			"requested date. Requires the same local key used during twin_sync.",
		twinRestoreSchema,
		makeTwinRestoreHandler(store),
	)

	registry.Register(
		"twin_digest",
		"Build and return today's activity digest from the local Twin Bridge without "+
			"syncing to the cloud. Useful for a quick overview of the day's alerts, "+
			"active channels, and response patterns.",
		twinDigestSchema,
		makeTwinDigestHandler(store),
	)
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// cloudURL returns the base URL for the Orchestra Cloud sync endpoint.
func cloudURL() string {
	if u := os.Getenv("ORCHESTRA_CLOUD_URL"); u != "" {
		return strings.TrimRight(u, "/")
	}
	return "https://api.orchestra-mcp.com"
}

// httpClient is a shared client with a reasonable timeout.
var httpClient = &http.Client{Timeout: 15 * time.Second}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

func makeTwinSyncHandler(store *twin.AlertStore) mcp.ToolHandler {
	return func(_ context.Context, _ json.RawMessage) (*mcp.ToolResult, error) {
		// 1. Build the full sync payload from local data.
		digest := twin.BuildDailyDigest(store)
		patterns := twin.BuildPriorityPatterns(store)

		payload := twin.SyncPayload{
			Digest:   digest,
			Patterns: patterns,
			Context:  twin.CrossSessionContext{OpenThreads: []twin.OpenThread{}},
			Routine:  twin.RoutineTemplate{MorningOrder: []string{}, AutoTriage: false},
		}

		// 2. Marshal to JSON.
		plaintext, err := json.Marshal(payload)
		if err != nil {
			return mcp.ErrorResult(fmt.Sprintf("marshal payload: %v", err)), nil
		}

		// 3. Encrypt with the user's local key (generated on first use).
		key, err := twin.EnsureKey()
		if err != nil {
			return mcp.ErrorResult(fmt.Sprintf("ensure encryption key: %v", err)), nil
		}
		ciphertext, err := twin.Encrypt(plaintext, key)
		if err != nil {
			return mcp.ErrorResult(fmt.Sprintf("encrypt payload: %v", err)), nil
		}

		// 4. Base64-encode for HTTP transport.
		encoded := base64.StdEncoding.EncodeToString(ciphertext)

		// 5. POST to cloud — the server stores only the opaque blob.
		url := fmt.Sprintf("%s/twin/sync/%s", cloudURL(), digest.Date)
		reqBody, _ := json.Marshal(map[string]string{"data": encoded})

		resp, err := httpClient.Post(url, "application/json", bytes.NewReader(reqBody))
		if err != nil {
			return mcp.ErrorResult(fmt.Sprintf("cloud sync request failed: %v", err)), nil
		}
		defer resp.Body.Close()

		if resp.StatusCode >= 400 {
			body, _ := io.ReadAll(resp.Body)
			return mcp.ErrorResult(fmt.Sprintf("cloud sync error %d: %s", resp.StatusCode, string(body))), nil
		}

		result := map[string]interface{}{
			"ok":              true,
			"date":            digest.Date,
			"alerts_synced":   digest.AlertsTotal,
			"channels_active": digest.ChannelsActive,
			"encrypted":       true,
			"cloud_url":       url,
		}
		data, _ := json.MarshalIndent(result, "", "  ")
		return mcp.TextResult(string(data)), nil
	}
}

func makeTwinRestoreHandler(_ *twin.AlertStore) mcp.ToolHandler {
	return func(_ context.Context, params json.RawMessage) (*mcp.ToolResult, error) {
		var input struct {
			Date string `json:"date"`
		}
		if len(params) > 0 && string(params) != "null" {
			if err := json.Unmarshal(params, &input); err != nil {
				return mcp.ErrorResult("invalid params: " + err.Error()), nil
			}
		}
		if input.Date == "" {
			input.Date = time.Now().Format("2006-01-02")
		}

		// 1. Fetch encrypted blob from cloud.
		url := fmt.Sprintf("%s/twin/sync/%s", cloudURL(), input.Date)
		resp, err := httpClient.Get(url)
		if err != nil {
			return mcp.ErrorResult(fmt.Sprintf("cloud fetch request failed: %v", err)), nil
		}
		defer resp.Body.Close()

		if resp.StatusCode == http.StatusNotFound {
			return mcp.ErrorResult(fmt.Sprintf("no sync data found for %s", input.Date)), nil
		}
		if resp.StatusCode >= 400 {
			body, _ := io.ReadAll(resp.Body)
			return mcp.ErrorResult(fmt.Sprintf("cloud fetch error %d: %s", resp.StatusCode, string(body))), nil
		}

		body, err := io.ReadAll(resp.Body)
		if err != nil {
			return mcp.ErrorResult(fmt.Sprintf("read response: %v", err)), nil
		}

		var cloudResp struct {
			Data string `json:"data"`
		}
		if err := json.Unmarshal(body, &cloudResp); err != nil {
			return mcp.ErrorResult(fmt.Sprintf("parse cloud response: %v", err)), nil
		}

		// 2. Base64-decode the blob.
		ciphertext, err := base64.StdEncoding.DecodeString(cloudResp.Data)
		if err != nil {
			return mcp.ErrorResult(fmt.Sprintf("decode ciphertext: %v", err)), nil
		}

		// 3. Decrypt with the user's local key.
		key, err := twin.EnsureKey()
		if err != nil {
			return mcp.ErrorResult(fmt.Sprintf("ensure encryption key: %v", err)), nil
		}
		plaintext, err := twin.Decrypt(ciphertext, key)
		if err != nil {
			return mcp.ErrorResult(fmt.Sprintf("decrypt payload: %v", err)), nil
		}

		// 4. Unmarshal the payload and render as markdown.
		var payload twin.SyncPayload
		if err := json.Unmarshal(plaintext, &payload); err != nil {
			return mcp.ErrorResult(fmt.Sprintf("parse payload: %v", err)), nil
		}

		md := renderSyncPayload(payload)
		return mcp.TextResult(md), nil
	}
}

func makeTwinDigestHandler(store *twin.AlertStore) mcp.ToolHandler {
	return func(_ context.Context, _ json.RawMessage) (*mcp.ToolResult, error) {
		digest := twin.BuildDailyDigest(store)
		patterns := twin.BuildPriorityPatterns(store)

		var sb strings.Builder
		sb.WriteString(fmt.Sprintf("# Activity Digest — %s\n\n", digest.Date))

		sb.WriteString("## Summary\n\n")
		sb.WriteString(fmt.Sprintf("| Metric | Value |\n|--------|-------|\n"))
		sb.WriteString(fmt.Sprintf("| Alerts today | %d |\n", digest.AlertsTotal))
		sb.WriteString(fmt.Sprintf("| Actioned | %d |\n", digest.AlertsActioned))
		sb.WriteString(fmt.Sprintf("| Avg response time | %s |\n", digest.ResponseTimeAvg))
		sb.WriteString(fmt.Sprintf("| Meetings | %d |\n", digest.MeetingsCount))
		sb.WriteString(fmt.Sprintf("| Tasks completed | %d |\n", digest.TasksCompleted))
		sb.WriteString(fmt.Sprintf("| Tasks created | %d |\n", digest.TasksCreated))

		sb.WriteString("\n## Active Channels\n\n")
		if len(digest.ChannelsActive) == 0 {
			sb.WriteString("_No activity today._\n")
		} else {
			for _, ch := range digest.ChannelsActive {
				sb.WriteString(fmt.Sprintf("- %s\n", ch))
			}
		}

		sb.WriteString("\n## Priority Patterns\n\n")
		if len(patterns.HighPriorityChannels) > 0 {
			sb.WriteString(fmt.Sprintf("**High priority:** %s\n\n", strings.Join(patterns.HighPriorityChannels, ", ")))
		}
		if len(patterns.LowPriorityChannels) > 0 {
			sb.WriteString(fmt.Sprintf("**Low engagement:** %s\n\n", strings.Join(patterns.LowPriorityChannels, ", ")))
		}
		if len(patterns.ResponsePatterns) > 0 {
			sb.WriteString("| Channel | Pattern |\n|---------|---------|\n")
			for ch, pattern := range patterns.ResponsePatterns {
				sb.WriteString(fmt.Sprintf("| %s | %s |\n", ch, pattern))
			}
		}

		return mcp.TextResult(sb.String()), nil
	}
}

// renderSyncPayload formats a SyncPayload as readable markdown.
func renderSyncPayload(p twin.SyncPayload) string {
	var sb strings.Builder

	sb.WriteString(fmt.Sprintf("# Restored Sync — %s\n\n", p.Digest.Date))

	sb.WriteString("## Activity Digest\n\n")
	sb.WriteString(fmt.Sprintf("| Metric | Value |\n|--------|-------|\n"))
	sb.WriteString(fmt.Sprintf("| Alerts | %d |\n", p.Digest.AlertsTotal))
	sb.WriteString(fmt.Sprintf("| Actioned | %d |\n", p.Digest.AlertsActioned))
	sb.WriteString(fmt.Sprintf("| Response time avg | %s |\n", p.Digest.ResponseTimeAvg))
	sb.WriteString(fmt.Sprintf("| Meetings | %d |\n", p.Digest.MeetingsCount))
	sb.WriteString(fmt.Sprintf("| Tasks completed | %d |\n", p.Digest.TasksCompleted))
	sb.WriteString(fmt.Sprintf("| Tasks created | %d |\n", p.Digest.TasksCreated))

	if len(p.Digest.ChannelsActive) > 0 {
		sb.WriteString(fmt.Sprintf("\n**Active channels:** %s\n", strings.Join(p.Digest.ChannelsActive, ", ")))
	}

	sb.WriteString("\n## Priority Patterns\n\n")
	if len(p.Patterns.HighPriorityChannels) > 0 {
		sb.WriteString(fmt.Sprintf("**High priority channels:** %s\n\n", strings.Join(p.Patterns.HighPriorityChannels, ", ")))
	}
	if len(p.Patterns.LowPriorityChannels) > 0 {
		sb.WriteString(fmt.Sprintf("**Low engagement channels:** %s\n\n", strings.Join(p.Patterns.LowPriorityChannels, ", ")))
	}

	if len(p.Context.OpenThreads) > 0 {
		sb.WriteString("\n## Open Threads\n\n")
		sb.WriteString("| Topic | Platforms | Status | Last Activity |\n|-------|-----------|--------|---------------|\n")
		for _, t := range p.Context.OpenThreads {
			sb.WriteString(fmt.Sprintf("| %s | %s | %s | %s |\n",
				t.Topic, strings.Join(t.Platforms, ", "), t.Status, t.LastActivity))
		}
	}

	if len(p.Routine.MorningOrder) > 0 {
		sb.WriteString("\n## Routine\n\n")
		sb.WriteString(fmt.Sprintf("**Morning order:** %s\n", strings.Join(p.Routine.MorningOrder, " → ")))
		sb.WriteString(fmt.Sprintf("**Avg duration:** %s\n", p.Routine.AvgDuration))
		sb.WriteString(fmt.Sprintf("**Auto-triage:** %v\n", p.Routine.AutoTriage))
	}

	return sb.String()
}
