package tools

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/orchestra-mcp/server/internal/mcp"
	"github.com/orchestra-mcp/server/internal/twin"
)

// ---------------------------------------------------------------------------
// JSON Schemas
// ---------------------------------------------------------------------------

var twinAlertsSchema = json.RawMessage(`{
	"type": "object",
	"properties": {
		"limit": {
			"type": "integer",
			"description": "Maximum number of alerts to return (0 = all, default 50)",
			"minimum": 0
		},
		"source": {
			"type": "string",
			"description": "Filter alerts by source (e.g. 'gmail', 'github', 'slack'). Leave empty for all sources."
		}
	}
}`)

var twinStatusSchema = json.RawMessage(`{
	"type": "object",
	"properties": {}
}`)

var twinMarkReadSchema = json.RawMessage(`{
	"type": "object",
	"properties": {
		"id": {
			"type": "string",
			"description": "Alert ID to mark as read"
		}
	},
	"required": ["id"]
}`)

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

// RegisterTwinTools registers the twin_alerts, twin_status, and twin_mark_read
// MCP tools using the provided AlertStore.
func RegisterTwinTools(registry *mcp.ToolRegistry, store *twin.AlertStore) {
	registry.Register(
		"twin_alerts",
		"Retrieve alerts collected from the Chrome extension via the Twin Bridge. "+
			"Returns events like DMs, mentions, PR reviews, and calendar alerts.",
		twinAlertsSchema,
		makeTwinAlertsHandler(store),
	)

	registry.Register(
		"twin_status",
		"Return the current status of the Twin Bridge: connection state, unread alert "+
			"count broken down by source, and the total number of stored alerts.",
		twinStatusSchema,
		makeTwinStatusHandler(store),
	)

	registry.Register(
		"twin_mark_read",
		"Mark a specific alert as read by its ID.",
		twinMarkReadSchema,
		makeTwinMarkReadHandler(store),
	)
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

func makeTwinAlertsHandler(store *twin.AlertStore) mcp.ToolHandler {
	return func(_ context.Context, params json.RawMessage) (*mcp.ToolResult, error) {
		var input struct {
			Limit  int    `json:"limit"`
			Source string `json:"source"`
		}
		// Params may be null/empty for tools that accept no required params.
		if len(params) > 0 && string(params) != "null" {
			if err := json.Unmarshal(params, &input); err != nil {
				return mcp.ErrorResult("invalid params: " + err.Error()), nil
			}
		}

		limit := input.Limit
		if limit == 0 {
			limit = 50
		}

		// ── Browser alerts (from Chrome extension via WebSocket) ──────────────
		browserAlerts := store.GetAlerts(limit, input.Source)

		type alertOut struct {
			ID        string          `json:"id"`
			Source    string          `json:"source"`
			Type      string          `json:"type"`
			Data      json.RawMessage `json:"data"`
			CreatedAt string          `json:"created_at"`
			Read      bool            `json:"read"`
			Origin    string          `json:"origin"` // "browser" | "desktop"
		}
		out := make([]alertOut, 0, len(browserAlerts))
		for _, a := range browserAlerts {
			out = append(out, alertOut{
				ID:        a.ID,
				Source:    a.Source,
				Type:      a.Type,
				Data:      a.Data,
				CreatedAt: a.CreatedAt.Format("2006-01-02T15:04:05Z"),
				Read:      a.Read,
				Origin:    "browser",
			})
		}

		// ── Desktop alerts (Apple Mail, Calendar, Notifications via Rust app) ─
		desktopAlerts, _ := twin.FetchDesktopAlerts(limit)
		desktopOnline := desktopAlerts != nil
		for _, da := range desktopAlerts {
			// Only include if source filter matches or no filter set
			if input.Source != "" && da.Source != input.Source {
				continue
			}
			raw, _ := json.Marshal(map[string]string{
				"title":  da.Title,
				"body":   da.Body,
				"sender": da.Sender,
			})
			out = append(out, alertOut{
				ID:        da.ID,
				Source:    da.Source,
				Type:      "native_alert",
				Data:      raw,
				CreatedAt: da.Timestamp,
				Read:      da.IsRead,
				Origin:    "desktop",
			})
		}

		result := map[string]interface{}{
			"alerts":         out,
			"total":          len(out),
			"source":         input.Source,
			"desktop_online": desktopOnline,
		}
		if input.Source == "" {
			result["source"] = "all"
		}

		data, err := json.MarshalIndent(result, "", "  ")
		if err != nil {
			return mcp.ErrorResult(fmt.Sprintf("marshal alerts: %v", err)), nil
		}
		return mcp.TextResult(string(data)), nil
	}
}

func makeTwinStatusHandler(store *twin.AlertStore) mcp.ToolHandler {
	return func(_ context.Context, _ json.RawMessage) (*mcp.ToolResult, error) {
		unread := store.UnreadCount()
		bySource := store.UnreadCountBySource()
		total := store.Len()

		result := map[string]interface{}{
			"total_alerts":       total,
			"unread_alerts":      unread,
			"unread_by_source":   bySource,
		}

		data, err := json.MarshalIndent(result, "", "  ")
		if err != nil {
			return mcp.ErrorResult(fmt.Sprintf("marshal status: %v", err)), nil
		}
		return mcp.TextResult(string(data)), nil
	}
}

func makeTwinMarkReadHandler(store *twin.AlertStore) mcp.ToolHandler {
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

		found := store.MarkRead(input.ID)
		if !found {
			return mcp.ErrorResult(fmt.Sprintf("alert not found: %s", input.ID)), nil
		}

		data, _ := json.Marshal(map[string]interface{}{
			"ok":      true,
			"id":      input.ID,
			"message": "alert marked as read",
		})
		return mcp.TextResult(string(data)), nil
	}
}
