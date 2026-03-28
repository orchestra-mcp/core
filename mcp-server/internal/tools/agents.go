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

var agentCreateSchema = json.RawMessage(`{
	"type": "object",
	"properties": {
		"name":          {"type": "string", "description": "Agent display name"},
		"slug":          {"type": "string", "description": "URL-safe identifier (auto-generated from name if omitted)"},
		"role":          {"type": "string", "description": "Agent role description"},
		"persona":       {"type": "string", "description": "Agent persona / personality"},
		"system_prompt": {"type": "string", "description": "System prompt for the agent"},
		"type":          {"type": "string", "enum": ["ai", "human", "hybrid"], "default": "ai", "description": "Agent type"},
		"team_id":       {"type": "string", "format": "uuid", "description": "Team the agent belongs to"}
	},
	"required": ["name"]
}`)

var agentGetSchema = json.RawMessage(`{
	"type": "object",
	"properties": {
		"id":   {"type": "string", "format": "uuid", "description": "Agent UUID"},
		"slug": {"type": "string", "description": "Agent slug"}
	},
	"oneOf": [
		{"required": ["id"]},
		{"required": ["slug"]}
	]
}`)

var agentListSchema = json.RawMessage(`{
	"type": "object",
	"properties": {
		"team_id": {"type": "string", "format": "uuid", "description": "Filter by team"},
		"status":  {"type": "string", "enum": ["active", "archived"], "default": "active", "description": "Filter by status"}
	}
}`)

var agentUpdateSchema = json.RawMessage(`{
	"type": "object",
	"properties": {
		"id":            {"type": "string", "format": "uuid", "description": "Agent UUID"},
		"name":          {"type": "string", "description": "Agent display name"},
		"slug":          {"type": "string", "description": "URL-safe identifier"},
		"role":          {"type": "string", "description": "Agent role description"},
		"persona":       {"type": "string", "description": "Agent persona / personality"},
		"system_prompt": {"type": "string", "description": "System prompt for the agent"},
		"type":          {"type": "string", "enum": ["ai", "human", "hybrid"], "description": "Agent type"},
		"team_id":       {"type": "string", "format": "uuid", "description": "Team the agent belongs to"},
		"status":        {"type": "string", "enum": ["active", "archived"], "description": "Agent status"}
	},
	"required": ["id"]
}`)

var agentDeleteSchema = json.RawMessage(`{
	"type": "object",
	"properties": {
		"id": {"type": "string", "format": "uuid", "description": "Agent UUID to archive"}
	},
	"required": ["id"]
}`)

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

// RegisterAgentTools registers all agent-related MCP tools.
func RegisterAgentTools(registry *mcp.ToolRegistry, dbClient *db.Client) {
	registry.Register("agent_create", "Create a new AI agent", agentCreateSchema, makeAgentCreate(dbClient))
	registry.Register("agent_get", "Get agent by ID or slug", agentGetSchema, makeAgentGet(dbClient))
	registry.Register("agent_list", "List agents", agentListSchema, makeAgentList(dbClient))
	registry.Register("agent_update", "Update an agent", agentUpdateSchema, makeAgentUpdate(dbClient))
	registry.Register("agent_delete", "Archive (soft-delete) an agent", agentDeleteSchema, makeAgentDelete(dbClient))
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

func makeAgentCreate(dbClient *db.Client) mcp.ToolHandler {
	return func(ctx context.Context, params json.RawMessage) (*mcp.ToolResult, error) {
		var input struct {
			Name         string `json:"name"`
			Slug         string `json:"slug"`
			Role         string `json:"role"`
			Persona      string `json:"persona"`
			SystemPrompt string `json:"system_prompt"`
			Type         string `json:"type"`
			TeamID       string `json:"team_id"`
		}
		if err := json.Unmarshal(params, &input); err != nil {
			return mcp.ErrorResult("invalid params: " + err.Error()), nil
		}
		if input.Name == "" {
			return mcp.ErrorResult("name is required"), nil
		}

		userCtx := auth.UserContextFromContext(ctx)
		if userCtx == nil {
			return mcp.ErrorResult("authentication required"), nil
		}

		agentType := input.Type
		if agentType == "" {
			agentType = "ai"
		}

		row := map[string]interface{}{
			"organization_id": userCtx.OrgID,
			"name":            input.Name,
			"type":            agentType,
			"status":          "active",
			"created_at":      time.Now().UTC().Format(time.RFC3339),
		}
		setIfNotEmpty(row, "slug", input.Slug)
		setIfNotEmpty(row, "role", input.Role)
		setIfNotEmpty(row, "persona", input.Persona)
		setIfNotEmpty(row, "system_prompt", input.SystemPrompt)
		setIfNotEmpty(row, "team_id", input.TeamID)

		result, err := dbClient.Post(ctx, "agents", row)
		if err != nil {
			return mcp.ErrorResult("failed to create agent: " + err.Error()), nil
		}
		return mcp.TextResult(string(result)), nil
	}
}

func makeAgentGet(dbClient *db.Client) mcp.ToolHandler {
	return func(ctx context.Context, params json.RawMessage) (*mcp.ToolResult, error) {
		var input struct {
			ID   string `json:"id"`
			Slug string `json:"slug"`
		}
		if err := json.Unmarshal(params, &input); err != nil {
			return mcp.ErrorResult("invalid params: " + err.Error()), nil
		}
		if input.ID == "" && input.Slug == "" {
			return mcp.ErrorResult("id or slug is required"), nil
		}

		userCtx := auth.UserContextFromContext(ctx)
		if userCtx == nil {
			return mcp.ErrorResult("authentication required"), nil
		}

		q := url.Values{}
		q.Set("organization_id", "eq."+userCtx.OrgID)
		if input.ID != "" {
			q.Set("id", "eq."+input.ID)
		} else {
			q.Set("slug", "eq."+input.Slug)
		}

		result, err := dbClient.GetSingle(ctx, "agents", q.Encode())
		if err != nil {
			return mcp.ErrorResult("failed to get agent: " + err.Error()), nil
		}
		return mcp.TextResult(string(result)), nil
	}
}

func makeAgentList(dbClient *db.Client) mcp.ToolHandler {
	return func(ctx context.Context, params json.RawMessage) (*mcp.ToolResult, error) {
		var input struct {
			TeamID string `json:"team_id"`
			Status string `json:"status"`
		}
		if err := json.Unmarshal(params, &input); err != nil {
			return mcp.ErrorResult("invalid params: " + err.Error()), nil
		}

		userCtx := auth.UserContextFromContext(ctx)
		if userCtx == nil {
			return mcp.ErrorResult("authentication required"), nil
		}

		status := input.Status
		if status == "" {
			status = "active"
		}

		q := url.Values{}
		q.Set("organization_id", "eq."+userCtx.OrgID)
		q.Set("status", "eq."+status)
		q.Set("order", "created_at.desc")
		if input.TeamID != "" {
			q.Set("team_id", "eq."+input.TeamID)
		}

		result, err := dbClient.Get(ctx, "agents", q.Encode())
		if err != nil {
			return mcp.ErrorResult("failed to list agents: " + err.Error()), nil
		}
		return mcp.TextResult(string(result)), nil
	}
}

func makeAgentUpdate(dbClient *db.Client) mcp.ToolHandler {
	return func(ctx context.Context, params json.RawMessage) (*mcp.ToolResult, error) {
		var input struct {
			ID           string  `json:"id"`
			Name         *string `json:"name"`
			Slug         *string `json:"slug"`
			Role         *string `json:"role"`
			Persona      *string `json:"persona"`
			SystemPrompt *string `json:"system_prompt"`
			Type         *string `json:"type"`
			TeamID       *string `json:"team_id"`
			Status       *string `json:"status"`
		}
		if err := json.Unmarshal(params, &input); err != nil {
			return mcp.ErrorResult("invalid params: " + err.Error()), nil
		}
		if input.ID == "" {
			return mcp.ErrorResult("id is required"), nil
		}

		userCtx := auth.UserContextFromContext(ctx)
		if userCtx == nil {
			return mcp.ErrorResult("authentication required"), nil
		}

		patch := map[string]interface{}{
			"updated_at": time.Now().UTC().Format(time.RFC3339),
		}
		setIfPtr(patch, "name", input.Name)
		setIfPtr(patch, "slug", input.Slug)
		setIfPtr(patch, "role", input.Role)
		setIfPtr(patch, "persona", input.Persona)
		setIfPtr(patch, "system_prompt", input.SystemPrompt)
		setIfPtr(patch, "type", input.Type)
		setIfPtr(patch, "team_id", input.TeamID)
		setIfPtr(patch, "status", input.Status)

		q := fmt.Sprintf("id=eq.%s&organization_id=eq.%s", url.QueryEscape(input.ID), url.QueryEscape(userCtx.OrgID))
		result, err := dbClient.Patch(ctx, "agents", q, patch)
		if err != nil {
			return mcp.ErrorResult("failed to update agent: " + err.Error()), nil
		}
		return mcp.TextResult(string(result)), nil
	}
}

func makeAgentDelete(dbClient *db.Client) mcp.ToolHandler {
	return func(ctx context.Context, params json.RawMessage) (*mcp.ToolResult, error) {
		var input struct {
			ID string `json:"id"`
		}
		if err := json.Unmarshal(params, &input); err != nil {
			return mcp.ErrorResult("invalid params: " + err.Error()), nil
		}
		if input.ID == "" {
			return mcp.ErrorResult("id is required"), nil
		}

		userCtx := auth.UserContextFromContext(ctx)
		if userCtx == nil {
			return mcp.ErrorResult("authentication required"), nil
		}

		patch := map[string]interface{}{
			"status":     "archived",
			"updated_at": time.Now().UTC().Format(time.RFC3339),
		}

		q := fmt.Sprintf("id=eq.%s&organization_id=eq.%s", url.QueryEscape(input.ID), url.QueryEscape(userCtx.OrgID))
		result, err := dbClient.Patch(ctx, "agents", q, patch)
		if err != nil {
			return mcp.ErrorResult("failed to archive agent: " + err.Error()), nil
		}
		return mcp.TextResult(string(result)), nil
	}
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

func setIfNotEmpty(m map[string]interface{}, key, value string) {
	if value != "" {
		m[key] = value
	}
}

func setIfPtr(m map[string]interface{}, key string, ptr *string) {
	if ptr != nil {
		m[key] = *ptr
	}
}
