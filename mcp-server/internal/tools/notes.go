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

var noteCreateSchema = json.RawMessage(`{
	"type": "object",
	"properties": {
		"title":      {"type": "string", "description": "Note title"},
		"body":       {"type": "string", "description": "Note body content"},
		"project_id": {"type": "string", "format": "uuid", "description": "Associated project ID"},
		"tags":       {"type": "array", "items": {"type": "string"}, "description": "Tags for categorization"},
		"icon":       {"type": "string", "description": "Icon identifier"},
		"color":      {"type": "string", "description": "Color hex or name"},
		"is_public":  {"type": "boolean", "description": "Whether the note is publicly visible"}
	},
	"required": ["title"]
}`)

var noteGetSchema = json.RawMessage(`{
	"type": "object",
	"properties": {
		"id": {"type": "string", "format": "uuid", "description": "Note ID"}
	},
	"required": ["id"]
}`)

var noteListSchema = json.RawMessage(`{
	"type": "object",
	"properties": {
		"project_id": {"type": "string", "format": "uuid", "description": "Filter by project"},
		"tags":       {"type": "string", "description": "Comma-separated tags to filter by"},
		"is_pinned":  {"type": "boolean", "description": "Filter pinned notes only"},
		"limit":      {"type": "integer", "description": "Max results (default 20)"}
	}
}`)

var noteUpdateSchema = json.RawMessage(`{
	"type": "object",
	"properties": {
		"id":        {"type": "string", "format": "uuid", "description": "Note ID"},
		"title":     {"type": "string", "description": "Updated title"},
		"body":      {"type": "string", "description": "Updated body"},
		"tags":      {"type": "array", "items": {"type": "string"}, "description": "Updated tags"},
		"is_pinned": {"type": "boolean", "description": "Pin or unpin the note"},
		"icon":      {"type": "string", "description": "Updated icon"},
		"color":     {"type": "string", "description": "Updated color"}
	},
	"required": ["id"]
}`)

var noteDeleteSchema = json.RawMessage(`{
	"type": "object",
	"properties": {
		"id": {"type": "string", "format": "uuid", "description": "Note ID to soft-delete"}
	},
	"required": ["id"]
}`)

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

// RegisterNoteTools registers all note-related MCP tools.
func RegisterNoteTools(registry *mcp.ToolRegistry, dbClient *db.Client) {
	registry.Register("note_create", "Create a note", noteCreateSchema, makeNoteCreate(dbClient))
	registry.Register("note_get", "Get a note by ID", noteGetSchema, makeNoteGet(dbClient))
	registry.Register("note_list", "List notes", noteListSchema, makeNoteList(dbClient))
	registry.Register("note_update", "Update a note", noteUpdateSchema, makeNoteUpdate(dbClient))
	registry.Register("note_delete", "Soft-delete a note", noteDeleteSchema, makeNoteDelete(dbClient))
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

func makeNoteCreate(dbClient *db.Client) mcp.ToolHandler {
	return func(ctx context.Context, params json.RawMessage) (*mcp.ToolResult, error) {
		var input struct {
			Title     string   `json:"title"`
			Body      string   `json:"body"`
			ProjectID string   `json:"project_id"`
			Tags      []string `json:"tags"`
			Icon      string   `json:"icon"`
			Color     string   `json:"color"`
			IsPublic  *bool    `json:"is_public"`
		}
		if err := json.Unmarshal(params, &input); err != nil {
			return mcp.ErrorResult("invalid params: " + err.Error()), nil
		}
		if input.Title == "" {
			return mcp.ErrorResult("title is required"), nil
		}

		userCtx := auth.UserContextFromContext(ctx)
		if userCtx == nil {
			return mcp.ErrorResult("authentication required"), nil
		}

		row := map[string]interface{}{
			"title":           input.Title,
			"organization_id": userCtx.OrgID,
			"user_id":         userCtx.UserID,
			"created_at":      time.Now().UTC().Format(time.RFC3339),
		}
		setIfNotEmpty(row, "body", input.Body)
		setIfNotEmpty(row, "project_id", input.ProjectID)
		setIfNotEmpty(row, "icon", input.Icon)
		setIfNotEmpty(row, "color", input.Color)
		if len(input.Tags) > 0 {
			row["tags"] = input.Tags
		}
		if input.IsPublic != nil {
			row["is_public"] = *input.IsPublic
		}

		result, err := dbClient.Post(ctx, "notes", row)
		if err != nil {
			return mcp.ErrorResult("failed to create note: " + err.Error()), nil
		}
		return mcp.TextResult(string(result)), nil
	}
}

func makeNoteGet(dbClient *db.Client) mcp.ToolHandler {
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

		q := url.Values{}
		q.Set("id", "eq."+input.ID)
		q.Set("organization_id", "eq."+userCtx.OrgID)
		q.Set("deleted_at", "is.null")

		result, err := dbClient.GetSingle(ctx, "notes", q.Encode())
		if err != nil {
			return mcp.ErrorResult("note not found: " + err.Error()), nil
		}
		return mcp.TextResult(string(result)), nil
	}
}

func makeNoteList(dbClient *db.Client) mcp.ToolHandler {
	return func(ctx context.Context, params json.RawMessage) (*mcp.ToolResult, error) {
		var input struct {
			ProjectID string `json:"project_id"`
			Tags      string `json:"tags"`
			IsPinned  *bool  `json:"is_pinned"`
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
		q.Set("deleted_at", "is.null")
		q.Set("order", "created_at.desc")
		q.Set("limit", fmt.Sprintf("%d", limit))
		if input.ProjectID != "" {
			q.Set("project_id", "eq."+input.ProjectID)
		}
		if input.Tags != "" {
			q.Set("tags", "ov.{"+input.Tags+"}")
		}
		if input.IsPinned != nil && *input.IsPinned {
			q.Set("is_pinned", "eq.true")
		}

		result, err := dbClient.Get(ctx, "notes", q.Encode())
		if err != nil {
			return mcp.ErrorResult("failed to list notes: " + err.Error()), nil
		}
		return mcp.TextResult(string(result)), nil
	}
}

func makeNoteUpdate(dbClient *db.Client) mcp.ToolHandler {
	return func(ctx context.Context, params json.RawMessage) (*mcp.ToolResult, error) {
		var input struct {
			ID       string   `json:"id"`
			Title    *string  `json:"title"`
			Body     *string  `json:"body"`
			Tags     []string `json:"tags"`
			IsPinned *bool    `json:"is_pinned"`
			Icon     *string  `json:"icon"`
			Color    *string  `json:"color"`
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
		setIfPtr(patch, "title", input.Title)
		setIfPtr(patch, "body", input.Body)
		setIfPtr(patch, "icon", input.Icon)
		setIfPtr(patch, "color", input.Color)
		if input.Tags != nil {
			patch["tags"] = input.Tags
		}
		if input.IsPinned != nil {
			patch["is_pinned"] = *input.IsPinned
		}

		q := fmt.Sprintf("id=eq.%s&organization_id=eq.%s", url.QueryEscape(input.ID), url.QueryEscape(userCtx.OrgID))
		result, err := dbClient.Patch(ctx, "notes", q, patch)
		if err != nil {
			return mcp.ErrorResult("failed to update note: " + err.Error()), nil
		}
		return mcp.TextResult(string(result)), nil
	}
}

func makeNoteDelete(dbClient *db.Client) mcp.ToolHandler {
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

		// Soft-delete: set deleted_at to now.
		patch := map[string]interface{}{
			"deleted_at": time.Now().UTC().Format(time.RFC3339),
		}

		q := fmt.Sprintf("id=eq.%s&organization_id=eq.%s", url.QueryEscape(input.ID), url.QueryEscape(userCtx.OrgID))
		_, err := dbClient.Patch(ctx, "notes", q, patch)
		if err != nil {
			return mcp.ErrorResult("failed to delete note: " + err.Error()), nil
		}
		return mcp.TextResult("Note deleted successfully."), nil
	}
}
