package tools

import (
	"context"
	"encoding/json"
	"fmt"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/orchestra-mcp/server/internal/auth"
	"github.com/orchestra-mcp/server/internal/db"
	"github.com/orchestra-mcp/server/internal/mcp"
)

// ---------------------------------------------------------------------------
// JSON Schemas
// ---------------------------------------------------------------------------

var requestCreateSchema = json.RawMessage(`{
	"type": "object",
	"properties": {
		"title":       {"type": "string", "description": "Request title"},
		"description": {"type": "string", "description": "Detailed description of the request (markdown)"},
		"priority":    {"type": "string", "enum": ["critical", "high", "medium", "low"], "default": "medium", "description": "Priority level"},
		"context":     {"type": "string", "description": "What we were doing when this request came up"},
		"tags":        {"type": "array", "items": {"type": "string"}, "description": "Tag labels for the request"}
	},
	"required": ["title"]
}`)

var requestListSchema = json.RawMessage(`{
	"type": "object",
	"properties": {
		"status":   {"type": "string", "enum": ["pending", "reviewed", "approved", "in_progress", "done", "rejected"], "description": "Filter by status"},
		"priority": {"type": "string", "enum": ["critical", "high", "medium", "low"], "description": "Filter by priority"},
		"limit":    {"type": "integer", "default": 20, "minimum": 1, "maximum": 100, "description": "Max rows to return"}
	}
}`)

var requestGetSchema = json.RawMessage(`{
	"type": "object",
	"properties": {
		"id": {"type": "string", "format": "uuid", "description": "Request UUID"}
	},
	"required": ["id"]
}`)

var requestUpdateSchema = json.RawMessage(`{
	"type": "object",
	"properties": {
		"id":                {"type": "string", "format": "uuid", "description": "Request UUID"},
		"status":            {"type": "string", "enum": ["pending", "reviewed", "approved", "in_progress", "done", "rejected"], "description": "New status"},
		"priority":          {"type": "string", "enum": ["critical", "high", "medium", "low"], "description": "New priority"},
		"description":       {"type": "string", "description": "Updated description"},
		"linked_task_id":    {"type": "string", "format": "uuid", "description": "Link to an existing task"},
		"linked_meeting_id": {"type": "string", "format": "uuid", "description": "Link to an existing meeting"}
	},
	"required": ["id"]
}`)

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

// RegisterRequestTools registers all request-related MCP tools.
func RegisterRequestTools(registry *mcp.ToolRegistry, dbClient *db.Client) {
	registry.Register("request_create", "Capture a new request (interrupt, idea, or deferred item)", requestCreateSchema, makeRequestCreate(dbClient))
	registry.Register("request_list", "List requests with optional filters", requestListSchema, makeRequestList(dbClient))
	registry.Register("request_get", "Get full details of a request by ID", requestGetSchema, makeRequestGet(dbClient))
	registry.Register("request_update", "Update a request — change status, priority, description, or link to a task/meeting", requestUpdateSchema, makeRequestUpdate(dbClient))
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

func makeRequestCreate(dbClient *db.Client) mcp.ToolHandler {
	return func(ctx context.Context, params json.RawMessage) (*mcp.ToolResult, error) {
		var input struct {
			Title       string   `json:"title"`
			Description string   `json:"description"`
			Priority    string   `json:"priority"`
			Context     string   `json:"context"`
			Tags        []string `json:"tags"`
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

		priority := input.Priority
		if priority == "" {
			priority = "medium"
		}

		now := time.Now().UTC()

		row := map[string]interface{}{
			"organization_id": userCtx.OrgID,
			"title":           input.Title,
			"status":          "pending",
			"priority":        priority,
			"created_by":      userCtx.UserID,
			"created_at":      now.Format(time.RFC3339),
		}
		setIfNotEmpty(row, "description", input.Description)
		setIfNotEmpty(row, "context", input.Context)
		if len(input.Tags) > 0 {
			row["tags"] = input.Tags
		}

		result, err := dbClient.Post(ctx, "requests", row)
		if err != nil {
			return mcp.ErrorResult("failed to create request: " + err.Error()), nil
		}

		items, parseErr := parseJSONArray(result)
		if parseErr != nil || len(items) == 0 {
			return mcp.TextResult(string(result)), nil
		}
		r := items[0]
		id := jsonStr(r, "id")
		dateStr := now.Format("2006-01-02")

		// Build slug from title for the export path.
		slug := titleToSlug(jsonStrOr(r, "title", input.Title))
		exportPath := fmt.Sprintf("requests/%s-%s.md", dateStr, slug)

		// Build body sections.
		body := fmt.Sprintf("# Request: %s\n\n", jsonStrOr(r, "title", input.Title))
		body += fmt.Sprintf("**Priority:** %s | **Status:** %s | **Created:** %s\n\n",
			capitalize(jsonStrOr(r, "priority", priority)),
			capitalize(jsonStrOr(r, "status", "pending")),
			dateStr,
		)

		if input.Description != "" {
			body += "## Description\n\n" + input.Description + "\n\n"
		}

		if input.Context != "" {
			body += "## Context\n\n" + input.Context + "\n\n"
		}

		tags := jsonArr(r, "tags")
		if tags != "" {
			body += fmt.Sprintf("**Tags:** %s\n", tags)
		}

		return mdResult(MarkdownResponse{
			Frontmatter: map[string]interface{}{
				"id":     id,
				"type":   "request",
				"status": jsonStrOr(r, "status", "pending"),
				"export": exportPath,
			},
			Body: body,
			NextSteps: []NextStep{
				{Label: "Review", Command: fmt.Sprintf(`request_update(id: "%s", status: "reviewed")`, id)},
				{Label: "Approve", Command: fmt.Sprintf(`request_update(id: "%s", status: "approved")`, id)},
				{Label: "Create task", Command: `task_create(title: "...", description: "...")`},
				{Label: "Link to task", Command: fmt.Sprintf(`request_update(id: "%s", linked_task_id: "TASK_UUID")`, id)},
			},
		}), nil
	}
}

func makeRequestList(dbClient *db.Client) mcp.ToolHandler {
	return func(ctx context.Context, params json.RawMessage) (*mcp.ToolResult, error) {
		var input struct {
			Status   string `json:"status"`
			Priority string `json:"priority"`
			Limit    int    `json:"limit"`
		}
		if err := json.Unmarshal(params, &input); err != nil {
			return mcp.ErrorResult("invalid params: " + err.Error()), nil
		}

		userCtx := auth.UserContextFromContext(ctx)
		if userCtx == nil {
			return mcp.ErrorResult("authentication required"), nil
		}

		limit := input.Limit
		if limit <= 0 {
			limit = 20
		}
		if limit > 100 {
			limit = 100
		}

		q := url.Values{}
		q.Set("organization_id", "eq."+userCtx.OrgID)
		q.Set("order", "created_at.desc")
		q.Set("limit", strconv.Itoa(limit))

		if input.Status != "" {
			q.Set("status", "eq."+input.Status)
		}
		if input.Priority != "" {
			q.Set("priority", "eq."+input.Priority)
		}

		result, err := dbClient.Get(ctx, "requests", q.Encode())
		if err != nil {
			return mcp.ErrorResult("failed to list requests: " + err.Error()), nil
		}

		items, parseErr := parseJSONArray(result)
		if parseErr != nil {
			return mcp.TextResult(string(result)), nil
		}

		rows := make([][]string, 0, len(items))
		for _, r := range items {
			tags := jsonArr(r, "tags")
			if tags == "" {
				tags = "-"
			}
			createdAt := jsonStr(r, "created_at")
			if len(createdAt) >= 10 {
				createdAt = createdAt[:10]
			}
			rows = append(rows, []string{
				truncate(jsonStr(r, "title"), 48),
				jsonStrOr(r, "status", "-"),
				jsonStrOr(r, "priority", "-"),
				tags,
				createdAt,
				jsonStrOr(r, "id", "-"),
			})
		}

		table := mdTable(
			[]string{"Title", "Status", "Priority", "Tags", "Created", "ID"},
			rows,
		)

		return mdResult(MarkdownResponse{
			Frontmatter: map[string]interface{}{
				"type":  "request_list",
				"count": len(items),
			},
			Body: fmt.Sprintf("# Requests (%d)\n\n%s", len(items), table),
			NextSteps: []NextStep{
				{Label: "Create a request", Command: `request_create(title: "...", priority: "medium")`},
				{Label: "View request details", Command: `request_get(id: "REQUEST_UUID")`},
				{Label: "Review a request", Command: `request_update(id: "REQUEST_UUID", status: "reviewed")`},
			},
		}), nil
	}
}

func makeRequestGet(dbClient *db.Client) mcp.ToolHandler {
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

		result, err := dbClient.GetSingle(ctx, "requests", q.Encode())
		if err != nil {
			return mcp.ErrorResult("failed to get request: " + err.Error()), nil
		}

		r, parseErr := parseJSONObject(result)
		if parseErr != nil {
			return mcp.TextResult(string(result)), nil
		}
		id := jsonStr(r, "id")

		createdAt := jsonStr(r, "created_at")
		dateStr := createdAt
		if len(createdAt) >= 10 {
			dateStr = createdAt[:10]
		}

		slug := titleToSlug(jsonStrOr(r, "title", id))
		exportPath := fmt.Sprintf("requests/%s-%s.md", dateStr, slug)

		body := fmt.Sprintf("# Request: %s\n\n", jsonStrOr(r, "title", "Untitled"))
		body += fmt.Sprintf("**Priority:** %s | **Status:** %s | **Created:** %s\n\n",
			capitalize(jsonStrOr(r, "priority", "medium")),
			capitalize(jsonStrOr(r, "status", "pending")),
			dateStr,
		)

		desc := jsonStr(r, "description")
		if desc != "" {
			body += "## Description\n\n" + desc + "\n\n"
		}

		ctxText := jsonStr(r, "context")
		if ctxText != "" {
			body += "## Context\n\n" + ctxText + "\n\n"
		}

		tags := jsonArr(r, "tags")
		if tags != "" {
			body += fmt.Sprintf("**Tags:** %s\n\n", tags)
		}

		linkedTask := jsonStr(r, "linked_task_id")
		linkedMeeting := jsonStr(r, "linked_meeting_id")
		if linkedTask != "" || linkedMeeting != "" {
			body += "## Links\n\n"
			if linkedTask != "" {
				body += fmt.Sprintf("- **Task:** `%s`\n", linkedTask)
			}
			if linkedMeeting != "" {
				body += fmt.Sprintf("- **Meeting:** `%s`\n", linkedMeeting)
			}
			body += "\n"
		}

		return mdResult(MarkdownResponse{
			Frontmatter: map[string]interface{}{
				"id":     id,
				"type":   "request",
				"status": jsonStrOr(r, "status", "pending"),
				"export": exportPath,
			},
			Body: body,
			NextSteps: []NextStep{
				{Label: "Update status", Command: fmt.Sprintf(`request_update(id: "%s", status: "reviewed")`, id)},
				{Label: "Create task", Command: `task_create(title: "...", description: "...")`},
				{Label: "Link to task", Command: fmt.Sprintf(`request_update(id: "%s", linked_task_id: "TASK_UUID")`, id)},
				{Label: "Link to meeting", Command: fmt.Sprintf(`request_update(id: "%s", linked_meeting_id: "MEETING_UUID")`, id)},
			},
		}), nil
	}
}

func makeRequestUpdate(dbClient *db.Client) mcp.ToolHandler {
	return func(ctx context.Context, params json.RawMessage) (*mcp.ToolResult, error) {
		var input struct {
			ID              string  `json:"id"`
			Status          *string `json:"status"`
			Priority        *string `json:"priority"`
			Description     *string `json:"description"`
			LinkedTaskID    *string `json:"linked_task_id"`
			LinkedMeetingID *string `json:"linked_meeting_id"`
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
		setIfPtr(patch, "status", input.Status)
		setIfPtr(patch, "priority", input.Priority)
		setIfPtr(patch, "description", input.Description)
		setIfPtr(patch, "linked_task_id", input.LinkedTaskID)
		setIfPtr(patch, "linked_meeting_id", input.LinkedMeetingID)

		q := fmt.Sprintf("id=eq.%s&organization_id=eq.%s",
			url.QueryEscape(input.ID),
			url.QueryEscape(userCtx.OrgID),
		)
		result, err := dbClient.Patch(ctx, "requests", q, patch)
		if err != nil {
			return mcp.ErrorResult("failed to update request: " + err.Error()), nil
		}

		// Parse updated record for a rich markdown confirmation.
		items, parseErr := parseJSONArray(result)
		if parseErr != nil || len(items) == 0 {
			return mcp.TextResult(string(result)), nil
		}
		r := items[0]
		id := jsonStr(r, "id")

		updatedFields := []string{}
		if input.Status != nil {
			updatedFields = append(updatedFields, fmt.Sprintf("status → **%s**", *input.Status))
		}
		if input.Priority != nil {
			updatedFields = append(updatedFields, fmt.Sprintf("priority → **%s**", *input.Priority))
		}
		if input.Description != nil {
			updatedFields = append(updatedFields, "description updated")
		}
		if input.LinkedTaskID != nil {
			updatedFields = append(updatedFields, fmt.Sprintf("linked task → `%s`", *input.LinkedTaskID))
		}
		if input.LinkedMeetingID != nil {
			updatedFields = append(updatedFields, fmt.Sprintf("linked meeting → `%s`", *input.LinkedMeetingID))
		}

		changeList := "_No changes specified._"
		if len(updatedFields) > 0 {
			lines := make([]string, len(updatedFields))
			for i, f := range updatedFields {
				lines[i] = "- " + f
			}
			changeList = strings.Join(lines, "\n")
		}

		body := fmt.Sprintf("# Request Updated\n\n"+
			"**ID:** `%s`\n\n"+
			"## Changes Applied\n\n%s\n\n"+
			"**Current Status:** %s | **Priority:** %s\n",
			id,
			changeList,
			capitalize(jsonStrOr(r, "status", "pending")),
			capitalize(jsonStrOr(r, "priority", "medium")),
		)

		return mdResult(MarkdownResponse{
			Frontmatter: map[string]interface{}{
				"id":     id,
				"type":   "request",
				"status": jsonStrOr(r, "status", "pending"),
			},
			Body: body,
			NextSteps: []NextStep{
				{Label: "View full details", Command: fmt.Sprintf(`request_get(id: "%s")`, id)},
				{Label: "Create task from request", Command: `task_create(title: "...", description: "...")`},
				{Label: "List all requests", Command: `request_list()`},
			},
		}), nil
	}
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

// titleToSlug converts a title to a URL/filename-safe kebab-case slug,
// truncated to 40 characters.
func titleToSlug(title string) string {
	title = strings.ToLower(title)
	// Replace non-alphanumeric runs with a hyphen.
	var sb strings.Builder
	prevHyphen := true // avoid leading hyphen
	for _, r := range title {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') {
			sb.WriteRune(r)
			prevHyphen = false
		} else if !prevHyphen {
			sb.WriteRune('-')
			prevHyphen = true
		}
	}
	slug := strings.TrimRight(sb.String(), "-")
	if len(slug) > 40 {
		slug = slug[:40]
		slug = strings.TrimRight(slug, "-")
	}
	return slug
}

