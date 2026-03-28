package tools

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/orchestra-mcp/server/internal/auth"
	"github.com/orchestra-mcp/server/internal/db"
	"github.com/orchestra-mcp/server/internal/mcp"
)

// RegisterActivityTools registers all activity-related tools on the given registry.
func RegisterActivityTools(registry *mcp.ToolRegistry, dbClient *db.Client) {
	registry.Register(
		"activity_log",
		"Log an activity event for tracking agent and user actions",
		mustSchema(map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"action":     map[string]string{"type": "string", "description": "The action performed (e.g. file_created, test_run, deploy)"},
				"summary":    map[string]string{"type": "string", "description": "Brief human-readable summary of the activity"},
				"details":    map[string]interface{}{"type": "object", "description": "Arbitrary structured details about the activity"},
				"project_id": map[string]string{"type": "string", "description": "Project ID this activity relates to"},
				"task_id":    map[string]string{"type": "string", "description": "Task ID this activity relates to"},
				"agent_id":   map[string]string{"type": "string", "description": "Agent ID that performed the activity"},
				"session_id": map[string]string{"type": "string", "description": "Session ID for grouping activities"},
				"machine_id": map[string]string{"type": "string", "description": "Machine ID where the activity occurred"},
			},
			"required": []string{"action", "summary"},
		}),
		makeActivityLog(dbClient),
	)

	registry.Register(
		"activity_list",
		"List recent activity with optional filters",
		mustSchema(map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"project_id": map[string]string{"type": "string", "description": "Filter by project ID"},
				"user_id":    map[string]string{"type": "string", "description": "Filter by user ID"},
				"agent_id":   map[string]string{"type": "string", "description": "Filter by agent ID"},
				"action":     map[string]string{"type": "string", "description": "Filter by action type"},
				"limit":      map[string]interface{}{"type": "integer", "description": "Max results to return", "default": 20},
			},
		}),
		makeActivityList(dbClient),
	)

	registry.Register(
		"team_status",
		"Get a summary of team activity over the last N hours",
		mustSchema(map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"hours": map[string]interface{}{"type": "integer", "description": "Number of hours to look back", "default": 24},
			},
		}),
		makeTeamStatus(dbClient),
	)
}

func makeActivityLog(dbClient *db.Client) mcp.ToolHandler {
	return func(ctx context.Context, params json.RawMessage) (*mcp.ToolResult, error) {
		userCtx, ok := auth.FromContext(ctx)
		if !ok {
			return errorResult("authentication required"), nil
		}

		var p struct {
			Action    string          `json:"action"`
			Summary   string          `json:"summary"`
			Details   json.RawMessage `json:"details,omitempty"`
			ProjectID string          `json:"project_id,omitempty"`
			TaskID    string          `json:"task_id,omitempty"`
			AgentID   string          `json:"agent_id,omitempty"`
			SessionID string          `json:"session_id,omitempty"`
			MachineID string          `json:"machine_id,omitempty"`
		}
		if err := json.Unmarshal(params, &p); err != nil {
			return errorResult("invalid parameters: " + err.Error()), nil
		}
		if p.Action == "" {
			return errorResult("action is required"), nil
		}
		if p.Summary == "" {
			return errorResult("summary is required"), nil
		}

		payload := map[string]interface{}{
			"action":          p.Action,
			"summary":         p.Summary,
			"organization_id": userCtx.OrgID,
			"user_id":         userCtx.UserID,
		}
		if p.Details != nil {
			payload["details"] = json.RawMessage(p.Details)
		}
		if p.ProjectID != "" {
			payload["project_id"] = p.ProjectID
		}
		if p.TaskID != "" {
			payload["task_id"] = p.TaskID
		}
		if p.AgentID != "" {
			payload["agent_id"] = p.AgentID
		}
		if p.SessionID != "" {
			payload["session_id"] = p.SessionID
		}
		if p.MachineID != "" {
			payload["machine_id"] = p.MachineID
		}

		raw, err := dbClient.Post(ctx, "activity_log", payload)
		if err != nil {
			return errorResult("failed to log activity: " + err.Error()), nil
		}
		return jsonResult(map[string]json.RawMessage{"activity": raw})
	}
}

func makeActivityList(dbClient *db.Client) mcp.ToolHandler {
	return func(ctx context.Context, params json.RawMessage) (*mcp.ToolResult, error) {
		userCtx, ok := auth.FromContext(ctx)
		if !ok {
			return errorResult("authentication required"), nil
		}

		var p struct {
			ProjectID string `json:"project_id,omitempty"`
			UserID    string `json:"user_id,omitempty"`
			AgentID   string `json:"agent_id,omitempty"`
			Action    string `json:"action,omitempty"`
			Limit     int    `json:"limit,omitempty"`
		}
		if err := json.Unmarshal(params, &p); err != nil {
			return errorResult("invalid parameters: " + err.Error()), nil
		}
		if p.Limit <= 0 {
			p.Limit = 20
		}

		query := fmt.Sprintf("organization_id=eq.%s&order=created_at.desc&limit=%d", userCtx.OrgID, p.Limit)
		if p.ProjectID != "" {
			query += "&project_id=eq." + p.ProjectID
		}
		if p.UserID != "" {
			query += "&user_id=eq." + p.UserID
		}
		if p.AgentID != "" {
			query += "&agent_id=eq." + p.AgentID
		}
		if p.Action != "" {
			query += "&action=eq." + p.Action
		}

		raw, err := dbClient.Get(ctx, "activity_log", query)
		if err != nil {
			return errorResult("failed to list activities: " + err.Error()), nil
		}
		return jsonResult(map[string]json.RawMessage{"activities": raw})
	}
}

func makeTeamStatus(dbClient *db.Client) mcp.ToolHandler {
	return func(ctx context.Context, params json.RawMessage) (*mcp.ToolResult, error) {
		userCtx, ok := auth.FromContext(ctx)
		if !ok {
			return errorResult("authentication required"), nil
		}

		var p struct {
			Hours int `json:"hours,omitempty"`
		}
		if err := json.Unmarshal(params, &p); err != nil {
			return errorResult("invalid parameters: " + err.Error()), nil
		}
		if p.Hours <= 0 {
			p.Hours = 24
		}

		rpcParams := map[string]interface{}{
			"p_org_id": userCtx.OrgID,
			"p_hours":  p.Hours,
		}

		raw, err := dbClient.RPC(ctx, "get_team_activity", rpcParams)
		if err != nil {
			return errorResult("failed to get team status: " + err.Error()), nil
		}
		return jsonResult(map[string]json.RawMessage{"team_status": raw})
	}
}
