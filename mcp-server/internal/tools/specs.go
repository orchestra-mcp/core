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

var specCreateSchema = json.RawMessage(`{
	"type": "object",
	"properties": {
		"title":       {"type": "string", "description": "Spec title"},
		"slug":        {"type": "string", "description": "URL-safe identifier (auto-generated from title if omitted)"},
		"content":     {"type": "string", "description": "Spec content (Markdown)"},
		"project_id":  {"type": "string", "format": "uuid", "description": "Project the spec belongs to"},
		"status":      {"type": "string", "enum": ["draft", "review", "approved", "archived"], "default": "draft", "description": "Spec lifecycle status"},
		"github_path": {"type": "string", "description": "Path to the spec file in the GitHub repo"},
		"parent_id":   {"type": "string", "format": "uuid", "description": "Parent spec ID for hierarchical specs"}
	},
	"required": ["title", "content", "project_id"]
}`)

var specGetSchema = json.RawMessage(`{
	"type": "object",
	"properties": {
		"id":         {"type": "string", "format": "uuid", "description": "Spec UUID"},
		"slug":       {"type": "string", "description": "Spec slug"},
		"project_id": {"type": "string", "format": "uuid", "description": "Project ID (required when using slug)"}
	},
	"oneOf": [
		{"required": ["id"]},
		{"required": ["slug", "project_id"]}
	]
}`)

var specListSchema = json.RawMessage(`{
	"type": "object",
	"properties": {
		"project_id": {"type": "string", "format": "uuid", "description": "Filter by project"},
		"status":     {"type": "string", "enum": ["draft", "review", "approved", "archived"], "description": "Filter by status"},
		"limit":      {"type": "integer", "description": "Max results (default 20)"}
	}
}`)

var specUpdateSchema = json.RawMessage(`{
	"type": "object",
	"properties": {
		"id":      {"type": "string", "format": "uuid", "description": "Spec UUID"},
		"content": {"type": "string", "description": "Updated content"},
		"status":  {"type": "string", "enum": ["draft", "review", "approved", "archived"], "description": "Updated status"},
		"version": {"type": "integer", "description": "Version number (auto-incremented if omitted)"}
	},
	"required": ["id"]
}`)

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

// RegisterSpecTools registers all spec-related MCP tools.
func RegisterSpecTools(registry *mcp.ToolRegistry, dbClient *db.Client) {
	registry.Register("spec_create", "Create a spec/document", specCreateSchema, makeSpecCreate(dbClient))
	registry.Register("spec_get", "Get spec by ID or slug", specGetSchema, makeSpecGet(dbClient))
	registry.Register("spec_list", "List specs", specListSchema, makeSpecList(dbClient))
	registry.Register("spec_update", "Update a spec", specUpdateSchema, makeSpecUpdate(dbClient))
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

func makeSpecCreate(dbClient *db.Client) mcp.ToolHandler {
	return func(ctx context.Context, params json.RawMessage) (*mcp.ToolResult, error) {
		var input struct {
			Title      string `json:"title"`
			Slug       string `json:"slug"`
			Content    string `json:"content"`
			ProjectID  string `json:"project_id"`
			Status     string `json:"status"`
			GithubPath string `json:"github_path"`
			ParentID   string `json:"parent_id"`
		}
		if err := json.Unmarshal(params, &input); err != nil {
			return mcp.ErrorResult("invalid params: " + err.Error()), nil
		}
		if input.Title == "" {
			return mcp.ErrorResult("title is required"), nil
		}
		if input.Content == "" {
			return mcp.ErrorResult("content is required"), nil
		}
		if input.ProjectID == "" {
			return mcp.ErrorResult("project_id is required"), nil
		}

		userCtx := auth.UserContextFromContext(ctx)
		if userCtx == nil {
			return mcp.ErrorResult("authentication required"), nil
		}

		status := input.Status
		if status == "" {
			status = "draft"
		}

		row := map[string]interface{}{
			"organization_id": userCtx.OrgID,
			"project_id":      input.ProjectID,
			"title":           input.Title,
			"content":         input.Content,
			"status":          status,
			"version":         1,
			"created_by":      userCtx.UserID,
			"created_at":      time.Now().UTC().Format(time.RFC3339),
		}
		setIfNotEmpty(row, "slug", input.Slug)
		setIfNotEmpty(row, "github_path", input.GithubPath)
		setIfNotEmpty(row, "parent_id", input.ParentID)

		result, err := dbClient.Post(ctx, "specs", row)
		if err != nil {
			return mcp.ErrorResult("failed to create spec: " + err.Error()), nil
		}
		return mcp.TextResult(string(result)), nil
	}
}

func makeSpecGet(dbClient *db.Client) mcp.ToolHandler {
	return func(ctx context.Context, params json.RawMessage) (*mcp.ToolResult, error) {
		var input struct {
			ID        string `json:"id"`
			Slug      string `json:"slug"`
			ProjectID string `json:"project_id"`
		}
		if err := json.Unmarshal(params, &input); err != nil {
			return mcp.ErrorResult("invalid params: " + err.Error()), nil
		}
		if input.ID == "" && input.Slug == "" {
			return mcp.ErrorResult("id or slug is required"), nil
		}
		if input.ID == "" && input.ProjectID == "" {
			return mcp.ErrorResult("project_id is required when using slug"), nil
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
			q.Set("project_id", "eq."+input.ProjectID)
		}

		result, err := dbClient.GetSingle(ctx, "specs", q.Encode())
		if err != nil {
			return mcp.ErrorResult("failed to get spec: " + err.Error()), nil
		}
		return mcp.TextResult(string(result)), nil
	}
}

func makeSpecList(dbClient *db.Client) mcp.ToolHandler {
	return func(ctx context.Context, params json.RawMessage) (*mcp.ToolResult, error) {
		var input struct {
			ProjectID string `json:"project_id"`
			Status    string `json:"status"`
			Limit     int    `json:"limit"`
		}
		if err := json.Unmarshal(params, &input); err != nil {
			return mcp.ErrorResult("invalid params: " + err.Error()), nil
		}

		userCtx := auth.UserContextFromContext(ctx)
		if userCtx == nil {
			return mcp.ErrorResult("authentication required"), nil
		}

		limit := 20
		if input.Limit > 0 {
			limit = input.Limit
		}

		q := url.Values{}
		q.Set("organization_id", "eq."+userCtx.OrgID)
		q.Set("order", "created_at.desc")
		q.Set("limit", fmt.Sprintf("%d", limit))
		if input.ProjectID != "" {
			q.Set("project_id", "eq."+input.ProjectID)
		}
		if input.Status != "" {
			q.Set("status", "eq."+input.Status)
		}

		result, err := dbClient.Get(ctx, "specs", q.Encode())
		if err != nil {
			return mcp.ErrorResult("failed to list specs: " + err.Error()), nil
		}
		return mcp.TextResult(string(result)), nil
	}
}

func makeSpecUpdate(dbClient *db.Client) mcp.ToolHandler {
	return func(ctx context.Context, params json.RawMessage) (*mcp.ToolResult, error) {
		var input struct {
			ID      string  `json:"id"`
			Content *string `json:"content"`
			Status  *string `json:"status"`
			Version *int    `json:"version"`
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
		setIfPtr(patch, "content", input.Content)
		setIfPtr(patch, "status", input.Status)

		// Auto-increment version: if the caller provided a version, use it;
		// otherwise fetch the current version and bump it by one.
		if input.Version != nil {
			patch["version"] = *input.Version
		} else if input.Content != nil {
			// Content changed — auto-increment the version.
			fetchQ := url.Values{}
			fetchQ.Set("id", "eq."+input.ID)
			fetchQ.Set("organization_id", "eq."+userCtx.OrgID)
			fetchQ.Set("select", "version")

			raw, err := dbClient.GetSingle(ctx, "specs", fetchQ.Encode())
			if err != nil {
				return mcp.ErrorResult("failed to fetch current spec version: " + err.Error()), nil
			}

			var current struct {
				Version int `json:"version"`
			}
			if err := json.Unmarshal(raw, &current); err != nil {
				return mcp.ErrorResult("failed to parse spec version: " + err.Error()), nil
			}
			patch["version"] = current.Version + 1
		}

		q := fmt.Sprintf("id=eq.%s&organization_id=eq.%s", url.QueryEscape(input.ID), url.QueryEscape(userCtx.OrgID))
		result, err := dbClient.Patch(ctx, "specs", q, patch)
		if err != nil {
			return mcp.ErrorResult("failed to update spec: " + err.Error()), nil
		}
		return mcp.TextResult(string(result)), nil
	}
}
