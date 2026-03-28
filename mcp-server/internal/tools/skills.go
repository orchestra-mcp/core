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

var skillCreateSchema = json.RawMessage(`{
	"type": "object",
	"properties": {
		"name":        {"type": "string", "description": "Skill display name"},
		"slug":        {"type": "string", "description": "URL-safe identifier (auto-generated from name if omitted)"},
		"description": {"type": "string", "description": "Short description of the skill"},
		"content":     {"type": "string", "description": "Prompt text / skill content"},
		"category":    {"type": "string", "description": "Skill category for grouping"},
		"is_public":   {"type": "boolean", "description": "Whether the skill is publicly visible"}
	},
	"required": ["name"]
}`)

var skillGetSchema = json.RawMessage(`{
	"type": "object",
	"properties": {
		"id":   {"type": "string", "format": "uuid", "description": "Skill UUID"},
		"slug": {"type": "string", "description": "Skill slug"}
	},
	"oneOf": [
		{"required": ["id"]},
		{"required": ["slug"]}
	]
}`)

var skillListSchema = json.RawMessage(`{
	"type": "object",
	"properties": {
		"category":  {"type": "string", "description": "Filter by category"},
		"is_public": {"type": "boolean", "description": "Filter by visibility"},
		"limit":     {"type": "integer", "description": "Max results (default 50)"}
	}
}`)

var skillAssignSchema = json.RawMessage(`{
	"type": "object",
	"properties": {
		"agent_id":    {"type": "string", "format": "uuid", "description": "Agent to assign the skill to"},
		"skill_id":    {"type": "string", "format": "uuid", "description": "Skill to assign"},
		"proficiency": {"type": "string", "enum": ["basic", "standard", "expert"], "default": "standard", "description": "Agent proficiency level with this skill"}
	},
	"required": ["agent_id", "skill_id"]
}`)

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

// RegisterSkillTools registers all skill-related MCP tools.
func RegisterSkillTools(registry *mcp.ToolRegistry, dbClient *db.Client) {
	registry.Register("skill_create", "Create a skill", skillCreateSchema, makeSkillCreate(dbClient))
	registry.Register("skill_get", "Get a skill", skillGetSchema, makeSkillGet(dbClient))
	registry.Register("skill_list", "List skills", skillListSchema, makeSkillList(dbClient))
	registry.Register("skill_assign", "Assign skill to agent", skillAssignSchema, makeSkillAssign(dbClient))
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

func makeSkillCreate(dbClient *db.Client) mcp.ToolHandler {
	return func(ctx context.Context, params json.RawMessage) (*mcp.ToolResult, error) {
		var input struct {
			Name        string `json:"name"`
			Slug        string `json:"slug"`
			Description string `json:"description"`
			Content     string `json:"content"`
			Category    string `json:"category"`
			IsPublic    *bool  `json:"is_public"`
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
		setIfNotEmpty(row, "content", input.Content)
		setIfNotEmpty(row, "category", input.Category)
		if input.IsPublic != nil {
			row["is_public"] = *input.IsPublic
		}

		result, err := dbClient.Post(ctx, "skills", row)
		if err != nil {
			return mcp.ErrorResult("failed to create skill: " + err.Error()), nil
		}
		return mcp.TextResult(string(result)), nil
	}
}

func makeSkillGet(dbClient *db.Client) mcp.ToolHandler {
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

		result, err := dbClient.GetSingle(ctx, "skills", q.Encode())
		if err != nil {
			return mcp.ErrorResult("failed to get skill: " + err.Error()), nil
		}
		return mcp.TextResult(string(result)), nil
	}
}

func makeSkillList(dbClient *db.Client) mcp.ToolHandler {
	return func(ctx context.Context, params json.RawMessage) (*mcp.ToolResult, error) {
		var input struct {
			Category string `json:"category"`
			IsPublic *bool  `json:"is_public"`
			Limit    int    `json:"limit"`
		}
		if err := json.Unmarshal(params, &input); err != nil {
			return mcp.ErrorResult("invalid params: " + err.Error()), nil
		}

		userCtx := auth.UserContextFromContext(ctx)
		if userCtx == nil {
			return mcp.ErrorResult("authentication required"), nil
		}

		limit := 50
		if input.Limit > 0 {
			limit = input.Limit
		}

		q := url.Values{}
		q.Set("organization_id", "eq."+userCtx.OrgID)
		q.Set("order", "name.asc")
		q.Set("limit", fmt.Sprintf("%d", limit))
		if input.Category != "" {
			q.Set("category", "eq."+input.Category)
		}
		if input.IsPublic != nil {
			q.Set("is_public", fmt.Sprintf("eq.%t", *input.IsPublic))
		}

		result, err := dbClient.Get(ctx, "skills", q.Encode())
		if err != nil {
			return mcp.ErrorResult("failed to list skills: " + err.Error()), nil
		}
		return mcp.TextResult(string(result)), nil
	}
}

func makeSkillAssign(dbClient *db.Client) mcp.ToolHandler {
	return func(ctx context.Context, params json.RawMessage) (*mcp.ToolResult, error) {
		var input struct {
			AgentID     string `json:"agent_id"`
			SkillID     string `json:"skill_id"`
			Proficiency string `json:"proficiency"`
		}
		if err := json.Unmarshal(params, &input); err != nil {
			return mcp.ErrorResult("invalid params: " + err.Error()), nil
		}
		if input.AgentID == "" {
			return mcp.ErrorResult("agent_id is required"), nil
		}
		if input.SkillID == "" {
			return mcp.ErrorResult("skill_id is required"), nil
		}

		userCtx := auth.UserContextFromContext(ctx)
		if userCtx == nil {
			return mcp.ErrorResult("authentication required"), nil
		}

		proficiency := input.Proficiency
		if proficiency == "" {
			proficiency = "standard"
		}

		row := map[string]interface{}{
			"organization_id": userCtx.OrgID,
			"agent_id":        input.AgentID,
			"skill_id":        input.SkillID,
			"proficiency":     proficiency,
			"assigned_by":     userCtx.UserID,
			"assigned_at":     time.Now().UTC().Format(time.RFC3339),
		}

		result, err := dbClient.Post(ctx, "agent_skills", row)
		if err != nil {
			return mcp.ErrorResult("failed to assign skill: " + err.Error()), nil
		}
		return mcp.TextResult(string(result)), nil
	}
}
