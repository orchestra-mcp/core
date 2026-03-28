package tools

import (
	"context"
	"encoding/json"
	"fmt"
	"net/url"
	"time"

	"github.com/orchestra-mcp/server/internal/auth"
	"github.com/orchestra-mcp/server/internal/db"
	"github.com/orchestra-mcp/server/internal/mcp"
)

// ---------------------------------------------------------------------------
// JSON Schemas
// ---------------------------------------------------------------------------

var usageGetSchema = json.RawMessage(`{
	"type": "object",
	"properties": {},
	"additionalProperties": false
}`)

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

// RegisterUsageTools registers the usage tracking MCP tools.
func RegisterUsageTools(registry *mcp.ToolRegistry, dbClient *db.Client) {
	registry.Register(
		"usage_get",
		"Get current usage statistics for the authenticated organization",
		usageGetSchema,
		makeUsageGet(dbClient),
	)
}

// ---------------------------------------------------------------------------
// Response type
// ---------------------------------------------------------------------------

type usageResponse struct {
	OrgID          string `json:"org_id"`
	Plan           string `json:"plan"`
	TasksThisMonth int    `json:"tasks_this_month"`
	ActiveAgents   int    `json:"active_agents"`
	ActiveTokens   int    `json:"active_tokens"`
	MemoryUsedMB   int    `json:"memory_used_mb"`
	APICallsToday  int    `json:"api_calls_today"`
	Period         string `json:"period"`
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

func makeUsageGet(dbClient *db.Client) mcp.ToolHandler {
	return func(ctx context.Context, params json.RawMessage) (*mcp.ToolResult, error) {
		uc := auth.UserContextFromContext(ctx)
		if uc == nil {
			return errorResult("authentication required"), nil
		}

		orgID := uc.OrgID
		now := time.Now().UTC()
		startOfMonth := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.UTC)
		startOfDay := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC)

		resp := usageResponse{
			OrgID:  orgID,
			Plan:   uc.Plan,
			Period: startOfMonth.Format("2006-01"),
		}

		// Count tasks created this month from activity_log.
		resp.TasksThisMonth = countRows(ctx, dbClient, "activity_log",
			fmt.Sprintf("organization_id=eq.%s&created_at=gte.%s&select=id",
				orgID, startOfMonth.Format(time.RFC3339)))

		// Count active agents.
		resp.ActiveAgents = countRows(ctx, dbClient, "agents",
			fmt.Sprintf("organization_id=eq.%s&status=eq.active&select=id", orgID))

		// Count active MCP tokens.
		resp.ActiveTokens = countRows(ctx, dbClient, "mcp_tokens",
			fmt.Sprintf("organization_id=eq.%s&revoked_at=is.null&select=id", orgID))

		// Estimate memory used (count memories and estimate size).
		memCount := countRows(ctx, dbClient, "memories",
			fmt.Sprintf("organization_id=eq.%s&select=id", orgID))
		// Rough estimate: ~4KB per memory entry (content + embedding).
		resp.MemoryUsedMB = (memCount * 4) / 1024
		if memCount > 0 && resp.MemoryUsedMB == 0 {
			resp.MemoryUsedMB = 1 // At least 1 MB if there are any memories.
		}

		// Count API calls today from activity_log.
		resp.APICallsToday = countRows(ctx, dbClient, "activity_log",
			fmt.Sprintf("organization_id=eq.%s&created_at=gte.%s&select=id",
				orgID, startOfDay.Format(time.RFC3339)))

		data, err := json.MarshalIndent(resp, "", "  ")
		if err != nil {
			return errorResult("failed to marshal usage data: " + err.Error()), nil
		}
		return textResult(string(data)), nil
	}
}

// countRows issues a HEAD-style query to count rows matching a filter.
// It returns 0 on any error (non-fatal for usage reporting).
func countRows(ctx context.Context, dbClient *db.Client, table, query string) int {
	q, _ := url.ParseQuery(query)
	q.Set("select", "id")
	raw, err := dbClient.Get(ctx, table, q.Encode())
	if err != nil {
		return 0
	}

	var rows []json.RawMessage
	if err := json.Unmarshal(raw, &rows); err != nil {
		return 0
	}
	return len(rows)
}
