package tools

import (
	"context"
	"encoding/json"
	"net/url"
	"time"

	"github.com/orchestra-mcp/server/internal/auth"
	"github.com/orchestra-mcp/server/internal/db"
	"github.com/orchestra-mcp/server/internal/mcp"
)

// ---------------------------------------------------------------------------
// JSON Schemas
// ---------------------------------------------------------------------------

var workflowCreateSchema = json.RawMessage(`{
	"type": "object",
	"properties": {
		"name":        {"type": "string", "description": "Workflow display name"},
		"slug":        {"type": "string", "description": "URL-safe identifier (auto-generated from name if omitted)"},
		"description": {"type": "string", "description": "Description of the workflow"},
		"states":      {"type": "array", "items": {"type": "object"}, "description": "JSON array of workflow states"},
		"transitions": {"type": "array", "items": {"type": "object"}, "description": "JSON array of allowed state transitions"},
		"is_default":  {"type": "boolean", "description": "Whether this is the default workflow for new projects"}
	},
	"required": ["name"]
}`)

var workflowGetSchema = json.RawMessage(`{
	"type": "object",
	"properties": {
		"id":   {"type": "string", "format": "uuid", "description": "Workflow UUID"},
		"slug": {"type": "string", "description": "Workflow slug"}
	},
	"oneOf": [
		{"required": ["id"]},
		{"required": ["slug"]}
	]
}`)

var workflowListSchema = json.RawMessage(`{
	"type": "object",
	"properties": {}
}`)

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

// RegisterWorkflowTools registers all workflow-related MCP tools.
func RegisterWorkflowTools(registry *mcp.ToolRegistry, dbClient *db.Client) {
	registry.Register("workflow_create", "Create a custom workflow", workflowCreateSchema, makeWorkflowCreate(dbClient))
	registry.Register("workflow_get", "Get workflow details", workflowGetSchema, makeWorkflowGet(dbClient))
	registry.Register("workflow_list", "List workflows", workflowListSchema, makeWorkflowList(dbClient))
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

func makeWorkflowCreate(dbClient *db.Client) mcp.ToolHandler {
	return func(ctx context.Context, params json.RawMessage) (*mcp.ToolResult, error) {
		var input struct {
			Name        string          `json:"name"`
			Slug        string          `json:"slug"`
			Description string          `json:"description"`
			States      json.RawMessage `json:"states"`
			Transitions json.RawMessage `json:"transitions"`
			IsDefault   *bool           `json:"is_default"`
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

		row := map[string]interface{}{
			"organization_id": userCtx.OrgID,
			"name":            input.Name,
			"created_by":      userCtx.UserID,
			"created_at":      time.Now().UTC().Format(time.RFC3339),
		}
		setIfNotEmpty(row, "slug", input.Slug)
		setIfNotEmpty(row, "description", input.Description)
		if input.States != nil {
			row["states"] = input.States
		}
		if input.Transitions != nil {
			row["transitions"] = input.Transitions
		}
		if input.IsDefault != nil {
			row["is_default"] = *input.IsDefault
		}

		result, err := dbClient.Post(ctx, "workflows", row)
		if err != nil {
			return mcp.ErrorResult("failed to create workflow: " + err.Error()), nil
		}
		return mcp.TextResult(string(result)), nil
	}
}

func makeWorkflowGet(dbClient *db.Client) mcp.ToolHandler {
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

		result, err := dbClient.GetSingle(ctx, "workflows", q.Encode())
		if err != nil {
			return mcp.ErrorResult("failed to get workflow: " + err.Error()), nil
		}
		return mcp.TextResult(string(result)), nil
	}
}

func makeWorkflowList(dbClient *db.Client) mcp.ToolHandler {
	return func(ctx context.Context, params json.RawMessage) (*mcp.ToolResult, error) {
		userCtx := auth.UserContextFromContext(ctx)
		if userCtx == nil {
			return mcp.ErrorResult("authentication required"), nil
		}

		q := url.Values{}
		q.Set("organization_id", "eq."+userCtx.OrgID)
		q.Set("order", "name.asc")

		result, err := dbClient.Get(ctx, "workflows", q.Encode())
		if err != nil {
			return mcp.ErrorResult("failed to list workflows: " + err.Error()), nil
		}
		return mcp.TextResult(string(result)), nil
	}
}
