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

var projectCreateSchema = json.RawMessage(`{
	"type": "object",
	"properties": {
		"name":               {"type": "string", "description": "Project name"},
		"slug":               {"type": "string", "description": "URL-safe identifier (auto-generated from name if omitted)"},
		"description":        {"type": "string", "description": "Project description"},
		"repo_url":           {"type": "string", "format": "uri", "description": "Git repository URL"},
		"repo_default_branch":{"type": "string", "description": "Default branch name (e.g. main)"},
		"team_id":            {"type": "string", "format": "uuid", "description": "Owning team"}
	},
	"required": ["name"]
}`)

var projectGetSchema = json.RawMessage(`{
	"type": "object",
	"properties": {
		"id":   {"type": "string", "format": "uuid", "description": "Project UUID"},
		"slug": {"type": "string", "description": "Project slug"}
	}
}`)

var projectListSchema = json.RawMessage(`{
	"type": "object",
	"properties": {
		"status": {"type": "string", "enum": ["active", "archived"], "default": "active", "description": "Filter by status"}
	}
}`)

var projectProgressSchema = json.RawMessage(`{
	"type": "object",
	"properties": {
		"id": {"type": "string", "format": "uuid", "description": "Project UUID"}
	},
	"required": ["id"]
}`)

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

// RegisterProjectTools registers all project-related MCP tools.
func RegisterProjectTools(registry *mcp.ToolRegistry, dbClient *db.Client) {
	registry.Register("project_create", "Create a new project", projectCreateSchema, makeProjectCreate(dbClient))
	registry.Register("project_get", "Get project by ID or slug", projectGetSchema, makeProjectGet(dbClient))
	registry.Register("project_list", "List projects", projectListSchema, makeProjectList(dbClient))
	registry.Register("project_progress", "Get project progress stats", projectProgressSchema, makeProjectProgress(dbClient))
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

func makeProjectCreate(dbClient *db.Client) mcp.ToolHandler {
	return func(ctx context.Context, params json.RawMessage) (*mcp.ToolResult, error) {
		var input struct {
			Name              string `json:"name"`
			Slug              string `json:"slug"`
			Description       string `json:"description"`
			RepoURL           string `json:"repo_url"`
			RepoDefaultBranch string `json:"repo_default_branch"`
			TeamID            string `json:"team_id"`
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
			"status":          "active",
			"created_by":      userCtx.UserID,
			"created_at":      time.Now().UTC().Format(time.RFC3339),
		}
		setIfNotEmpty(row, "slug", input.Slug)
		setIfNotEmpty(row, "description", input.Description)
		setIfNotEmpty(row, "repo_url", input.RepoURL)
		setIfNotEmpty(row, "repo_default_branch", input.RepoDefaultBranch)
		setIfNotEmpty(row, "team_id", input.TeamID)

		result, err := dbClient.Post(ctx, "projects", row)
		if err != nil {
			return mcp.ErrorResult("failed to create project: " + err.Error()), nil
		}
		return mcp.TextResult(string(result)), nil
	}
}

func makeProjectGet(dbClient *db.Client) mcp.ToolHandler {
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

		result, err := dbClient.GetSingle(ctx, "projects", q.Encode())
		if err != nil {
			return mcp.ErrorResult("failed to get project: " + err.Error()), nil
		}
		return mcp.TextResult(string(result)), nil
	}
}

func makeProjectList(dbClient *db.Client) mcp.ToolHandler {
	return func(ctx context.Context, params json.RawMessage) (*mcp.ToolResult, error) {
		var input struct {
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

		result, err := dbClient.Get(ctx, "projects", q.Encode())
		if err != nil {
			return mcp.ErrorResult("failed to list projects: " + err.Error()), nil
		}

		items, parseErr := parseJSONArray(result)
		if parseErr != nil {
			return mcp.TextResult(string(result)), nil
		}

		rows := make([][]string, 0, len(items))
		for _, p := range items {
			rows = append(rows, []string{
				jsonStr(p, "name"),
				jsonStrOr(p, "slug", "-"),
				truncate(jsonStrOr(p, "description", "-"), 40),
				jsonStrOr(p, "status", "-"),
				jsonStrOr(p, "id", "-"),
			})
		}

		table := mdTable(
			[]string{"Name", "Slug", "Description", "Status", "ID"},
			rows,
		)

		return mdResult(MarkdownResponse{
			Frontmatter: map[string]interface{}{
				"type":  "project_list",
				"count": len(items),
			},
			Body: fmt.Sprintf("# Projects (%d)\n\n%s", len(items), table),
			NextSteps: []NextStep{
				{Label: "Create a project", Command: `project_create(name: "...")`},
				{Label: "View project details", Command: `project_get(id: "PROJECT_UUID")`},
				{Label: "Check progress", Command: `project_progress(id: "PROJECT_UUID")`},
			},
		}), nil
	}
}

func makeProjectProgress(dbClient *db.Client) mcp.ToolHandler {
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

		rpcParams := map[string]interface{}{
			"p_project_id": input.ID,
		}

		result, err := dbClient.RPC(ctx, "get_project_progress", rpcParams)
		if err != nil {
			return mcp.ErrorResult(fmt.Sprintf("failed to get project progress: %s", err.Error())), nil
		}
		return mcp.TextResult(string(result)), nil
	}
}
