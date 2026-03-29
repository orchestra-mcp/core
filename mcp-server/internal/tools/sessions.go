package tools

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/orchestra-mcp/server/internal/auth"
	"github.com/orchestra-mcp/server/internal/db"
	"github.com/orchestra-mcp/server/internal/mcp"
)

// RegisterSessionTools registers all session-related tools on the given registry.
func RegisterSessionTools(registry *mcp.ToolRegistry, dbClient *db.Client) {
	registry.Register(
		"session_start",
		"Start a new agent session to track activity across a machine",
		mustSchema(map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"machine_id":         map[string]string{"type": "string", "description": "Machine identifier where the session is running"},
				"agent_id":           map[string]string{"type": "string", "description": "Agent ID starting this session"},
				"current_project_id": map[string]string{"type": "string", "description": "Project the agent is currently working on"},
				"current_task_id":    map[string]string{"type": "string", "description": "Task the agent is currently working on"},
			},
			"required": []string{"machine_id"},
		}),
		makeSessionStart(dbClient),
	)

	registry.Register(
		"session_heartbeat",
		"Update a session heartbeat to indicate the agent is still active",
		mustSchema(map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"session_id":      map[string]string{"type": "string", "description": "The session ID to heartbeat"},
				"current_task_id": map[string]string{"type": "string", "description": "Optionally update the current task"},
			},
			"required": []string{"session_id"},
		}),
		makeSessionHeartbeat(dbClient),
	)

	registry.Register(
		"session_end",
		"End an agent session",
		mustSchema(map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"session_id": map[string]string{"type": "string", "description": "The session ID to end"},
			},
			"required": []string{"session_id"},
		}),
		makeSessionEnd(dbClient),
	)

	registry.Register(
		"session_list",
		"List all active sessions for the organization",
		mustSchema(map[string]interface{}{
			"type":       "object",
			"properties": map[string]interface{}{},
		}),
		makeSessionList(dbClient),
	)
}

func makeSessionStart(dbClient *db.Client) mcp.ToolHandler {
	return func(ctx context.Context, params json.RawMessage) (*mcp.ToolResult, error) {
		userCtx, ok := auth.FromContext(ctx)
		if !ok {
			return errorResult("authentication required"), nil
		}

		var p struct {
			MachineID        string `json:"machine_id"`
			AgentID          string `json:"agent_id,omitempty"`
			CurrentProjectID string `json:"current_project_id,omitempty"`
			CurrentTaskID    string `json:"current_task_id,omitempty"`
		}
		if err := json.Unmarshal(params, &p); err != nil {
			return errorResult("invalid parameters: " + err.Error()), nil
		}
		if p.MachineID == "" {
			return errorResult("machine_id is required"), nil
		}

		now := time.Now().UTC().Format(time.RFC3339)
		payload := map[string]interface{}{
			"machine_id":      p.MachineID,
			"organization_id": userCtx.OrgID,
			"user_id":         userCtx.UserID,
			"status":          "active",
			"started_at":      now,
			"last_heartbeat":  now,
		}
		if p.AgentID != "" {
			payload["agent_id"] = p.AgentID
		}
		if p.CurrentProjectID != "" {
			payload["current_project_id"] = p.CurrentProjectID
		}
		if p.CurrentTaskID != "" {
			payload["current_task_id"] = p.CurrentTaskID
		}

		raw, err := dbClient.Post(ctx, "agent_sessions", payload)
		if err != nil {
			return errorResult("failed to start session: " + err.Error()), nil
		}
		return jsonResult(map[string]json.RawMessage{"session": raw})
	}
}

func makeSessionHeartbeat(dbClient *db.Client) mcp.ToolHandler {
	return func(ctx context.Context, params json.RawMessage) (*mcp.ToolResult, error) {
		userCtx, ok := auth.FromContext(ctx)
		if !ok {
			return errorResult("authentication required"), nil
		}

		var p struct {
			SessionID     string `json:"session_id"`
			CurrentTaskID string `json:"current_task_id,omitempty"`
		}
		if err := json.Unmarshal(params, &p); err != nil {
			return errorResult("invalid parameters: " + err.Error()), nil
		}
		if p.SessionID == "" {
			return errorResult("session_id is required"), nil
		}

		payload := map[string]interface{}{
			"last_heartbeat": time.Now().UTC().Format(time.RFC3339),
		}
		if p.CurrentTaskID != "" {
			payload["current_task_id"] = p.CurrentTaskID
		}

		query := fmt.Sprintf("id=eq.%s&organization_id=eq.%s", p.SessionID, userCtx.OrgID)
		raw, err := dbClient.Patch(ctx, "agent_sessions", query, payload)
		if err != nil {
			return errorResult("failed to update heartbeat: " + err.Error()), nil
		}
		return jsonResult(map[string]json.RawMessage{"session": raw})
	}
}

func makeSessionEnd(dbClient *db.Client) mcp.ToolHandler {
	return func(ctx context.Context, params json.RawMessage) (*mcp.ToolResult, error) {
		userCtx, ok := auth.FromContext(ctx)
		if !ok {
			return errorResult("authentication required"), nil
		}

		var p struct {
			SessionID string `json:"session_id"`
		}
		if err := json.Unmarshal(params, &p); err != nil {
			return errorResult("invalid parameters: " + err.Error()), nil
		}
		if p.SessionID == "" {
			return errorResult("session_id is required"), nil
		}

		now := time.Now().UTC().Format(time.RFC3339)
		payload := map[string]interface{}{
			"status":         "offline",
			"ended_at":       now,
			"last_heartbeat": now,
		}

		query := fmt.Sprintf("id=eq.%s&organization_id=eq.%s", p.SessionID, userCtx.OrgID)
		raw, err := dbClient.Patch(ctx, "agent_sessions", query, payload)
		if err != nil {
			return errorResult("failed to end session: " + err.Error()), nil
		}
		return jsonResult(map[string]json.RawMessage{"session": raw})
	}
}

func makeSessionList(dbClient *db.Client) mcp.ToolHandler {
	return func(ctx context.Context, params json.RawMessage) (*mcp.ToolResult, error) {
		userCtx, ok := auth.FromContext(ctx)
		if !ok {
			return errorResult("authentication required"), nil
		}

		query := fmt.Sprintf("organization_id=eq.%s&status=eq.active&order=last_heartbeat.desc", userCtx.OrgID)

		raw, err := dbClient.Get(ctx, "agent_sessions", query)
		if err != nil {
			return errorResult("failed to list sessions: " + err.Error()), nil
		}
		return jsonResult(map[string]json.RawMessage{"sessions": raw})
	}
}
