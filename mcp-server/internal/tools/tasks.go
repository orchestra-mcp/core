package tools

import (
	"context"
	"encoding/json"
	"fmt"
	"net/url"
	"strconv"
	"time"

	"github.com/orchestra-mcp/server/internal/auth"
	"github.com/orchestra-mcp/server/internal/db"
	"github.com/orchestra-mcp/server/internal/mcp"
)

// ---------------------------------------------------------------------------
// JSON Schemas
// ---------------------------------------------------------------------------

var taskCreateSchema = json.RawMessage(`{
	"type": "object",
	"properties": {
		"title":             {"type": "string", "description": "Task title"},
		"description":       {"type": "string", "description": "Detailed description (markdown)"},
		"type":              {"type": "string", "enum": ["epic", "feature", "task", "bug", "subtask"], "default": "task", "description": "Task type"},
		"priority":          {"type": "string", "enum": ["critical", "high", "medium", "low"], "default": "medium", "description": "Priority level"},
		"project_id":        {"type": "string", "format": "uuid", "description": "Parent project"},
		"assigned_agent_id": {"type": "string", "format": "uuid", "description": "Agent assignment"},
		"assigned_user_id":  {"type": "string", "format": "uuid", "description": "User assignment"},
		"labels":            {"type": "array", "items": {"type": "string"}, "description": "Label tags"},
		"due_date":          {"type": "string", "format": "date", "description": "Due date (YYYY-MM-DD)"},
		"estimate":          {"type": "string", "enum": ["XS", "S", "M", "L", "XL"], "description": "Size estimate"}
	},
	"required": ["title"]
}`)

var taskGetSchema = json.RawMessage(`{
	"type": "object",
	"properties": {
		"id": {"type": "string", "format": "uuid", "description": "Task UUID"}
	},
	"required": ["id"]
}`)

var taskListSchema = json.RawMessage(`{
	"type": "object",
	"properties": {
		"project_id":        {"type": "string", "format": "uuid", "description": "Filter by project"},
		"status":            {"type": "string", "description": "Filter by status (e.g. todo, in_progress, done, blocked)"},
		"assigned_agent_id": {"type": "string", "format": "uuid", "description": "Filter by assigned agent"},
		"assigned_user_id":  {"type": "string", "format": "uuid", "description": "Filter by assigned user"},
		"priority":          {"type": "string", "enum": ["critical", "high", "medium", "low"], "description": "Filter by priority"},
		"labels":            {"type": "array", "items": {"type": "string"}, "description": "Filter by labels (overlap)"},
		"limit":             {"type": "integer", "default": 20, "minimum": 1, "maximum": 100, "description": "Max rows to return"}
	}
}`)

var taskUpdateSchema = json.RawMessage(`{
	"type": "object",
	"properties": {
		"id":                {"type": "string", "format": "uuid", "description": "Task UUID"},
		"title":             {"type": "string", "description": "Task title"},
		"description":       {"type": "string", "description": "Detailed description"},
		"type":              {"type": "string", "enum": ["epic", "feature", "task", "bug", "subtask"], "description": "Task type"},
		"priority":          {"type": "string", "enum": ["critical", "high", "medium", "low"], "description": "Priority level"},
		"status":            {"type": "string", "description": "Task status"},
		"assigned_agent_id": {"type": "string", "format": "uuid", "description": "Agent assignment"},
		"assigned_user_id":  {"type": "string", "format": "uuid", "description": "User assignment"},
		"labels":            {"type": "array", "items": {"type": "string"}, "description": "Label tags"},
		"due_date":          {"type": "string", "format": "date", "description": "Due date (YYYY-MM-DD)"},
		"estimate":          {"type": "string", "enum": ["XS", "S", "M", "L", "XL"], "description": "Size estimate"}
	},
	"required": ["id"]
}`)

var taskAssignSchema = json.RawMessage(`{
	"type": "object",
	"properties": {
		"id":       {"type": "string", "format": "uuid", "description": "Task UUID"},
		"agent_id": {"type": "string", "format": "uuid", "description": "Agent to assign"},
		"user_id":  {"type": "string", "format": "uuid", "description": "User to assign"}
	},
	"required": ["id"]
}`)

var taskCompleteSchema = json.RawMessage(`{
	"type": "object",
	"properties": {
		"id": {"type": "string", "format": "uuid", "description": "Task UUID to mark as done"}
	},
	"required": ["id"]
}`)

var taskBlockSchema = json.RawMessage(`{
	"type": "object",
	"properties": {
		"id":     {"type": "string", "format": "uuid", "description": "Task UUID to block"},
		"reason": {"type": "string", "description": "Why this task is blocked"}
	},
	"required": ["id"]
}`)

var taskGetNextSchema = json.RawMessage(`{
	"type": "object",
	"properties": {
		"project_id": {"type": "string", "format": "uuid", "description": "Project to pick from"},
		"agent_id":   {"type": "string", "format": "uuid", "description": "Agent requesting next task"},
		"user_id":    {"type": "string", "format": "uuid", "description": "User requesting next task"}
	}
}`)

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

// RegisterTaskTools registers all task-related MCP tools.
func RegisterTaskTools(registry *mcp.ToolRegistry, dbClient *db.Client) {
	registry.Register("task_create", "Create a new task", taskCreateSchema, makeTaskCreate(dbClient))
	registry.Register("task_get", "Get task by ID", taskGetSchema, makeTaskGet(dbClient))
	registry.Register("task_list", "List tasks with filters", taskListSchema, makeTaskList(dbClient))
	registry.Register("task_update", "Update a task", taskUpdateSchema, makeTaskUpdate(dbClient))
	registry.Register("task_assign", "Assign task to agent or user", taskAssignSchema, makeTaskAssign(dbClient))
	registry.Register("task_complete", "Mark task as done", taskCompleteSchema, makeTaskComplete(dbClient))
	registry.Register("task_block", "Mark task as blocked", taskBlockSchema, makeTaskBlock(dbClient))
	registry.Register("task_get_next", "Get next unblocked task by priority", taskGetNextSchema, makeTaskGetNext(dbClient))
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

func makeTaskCreate(dbClient *db.Client) mcp.ToolHandler {
	return func(ctx context.Context, params json.RawMessage) (*mcp.ToolResult, error) {
		var input struct {
			Title          string   `json:"title"`
			Description    string   `json:"description"`
			Type           string   `json:"type"`
			Priority       string   `json:"priority"`
			ProjectID      string   `json:"project_id"`
			AssignedAgent  string   `json:"assigned_agent_id"`
			AssignedUser   string   `json:"assigned_user_id"`
			Labels         []string `json:"labels"`
			DueDate        string   `json:"due_date"`
			Estimate       string   `json:"estimate"`
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

		taskType := input.Type
		if taskType == "" {
			taskType = "task"
		}
		priority := input.Priority
		if priority == "" {
			priority = "medium"
		}

		row := map[string]interface{}{
			"organization_id": userCtx.OrgID,
			"title":           input.Title,
			"type":            taskType,
			"priority":        priority,
			"status":          "todo",
			"created_by":      userCtx.UserID,
			"created_at":      time.Now().UTC().Format(time.RFC3339),
		}
		setIfNotEmpty(row, "description", input.Description)
		setIfNotEmpty(row, "project_id", input.ProjectID)
		setIfNotEmpty(row, "assigned_agent_id", input.AssignedAgent)
		setIfNotEmpty(row, "assigned_user_id", input.AssignedUser)
		setIfNotEmpty(row, "due_date", input.DueDate)
		setIfNotEmpty(row, "estimate", input.Estimate)
		if len(input.Labels) > 0 {
			row["labels"] = input.Labels
		}

		result, err := dbClient.Post(ctx, "tasks", row)
		if err != nil {
			return mcp.ErrorResult("failed to create task: " + err.Error()), nil
		}
		return mcp.TextResult(string(result)), nil
	}
}

func makeTaskGet(dbClient *db.Client) mcp.ToolHandler {
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

		result, err := dbClient.GetSingle(ctx, "tasks", q.Encode())
		if err != nil {
			return mcp.ErrorResult("failed to get task: " + err.Error()), nil
		}
		return mcp.TextResult(string(result)), nil
	}
}

func makeTaskList(dbClient *db.Client) mcp.ToolHandler {
	return func(ctx context.Context, params json.RawMessage) (*mcp.ToolResult, error) {
		var input struct {
			ProjectID     string   `json:"project_id"`
			Status        string   `json:"status"`
			AssignedAgent string   `json:"assigned_agent_id"`
			AssignedUser  string   `json:"assigned_user_id"`
			Priority      string   `json:"priority"`
			Labels        []string `json:"labels"`
			Limit         int      `json:"limit"`
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
		q.Set("order", "priority_order.asc,created_at.desc")
		q.Set("limit", strconv.Itoa(limit))

		if input.ProjectID != "" {
			q.Set("project_id", "eq."+input.ProjectID)
		}
		if input.Status != "" {
			q.Set("status", "eq."+input.Status)
		}
		if input.AssignedAgent != "" {
			q.Set("assigned_agent_id", "eq."+input.AssignedAgent)
		}
		if input.AssignedUser != "" {
			q.Set("assigned_user_id", "eq."+input.AssignedUser)
		}
		if input.Priority != "" {
			q.Set("priority", "eq."+input.Priority)
		}
		if len(input.Labels) > 0 {
			// PostgREST array overlap: labels=ov.{val1,val2}
			labelsStr := "{"
			for i, l := range input.Labels {
				if i > 0 {
					labelsStr += ","
				}
				labelsStr += l
			}
			labelsStr += "}"
			q.Set("labels", "ov."+labelsStr)
		}

		result, err := dbClient.Get(ctx, "tasks", q.Encode())
		if err != nil {
			return mcp.ErrorResult("failed to list tasks: " + err.Error()), nil
		}
		return mcp.TextResult(string(result)), nil
	}
}

func makeTaskUpdate(dbClient *db.Client) mcp.ToolHandler {
	return func(ctx context.Context, params json.RawMessage) (*mcp.ToolResult, error) {
		var input struct {
			ID            string   `json:"id"`
			Title         *string  `json:"title"`
			Description   *string  `json:"description"`
			Type          *string  `json:"type"`
			Priority      *string  `json:"priority"`
			Status        *string  `json:"status"`
			AssignedAgent *string  `json:"assigned_agent_id"`
			AssignedUser  *string  `json:"assigned_user_id"`
			Labels        []string `json:"labels"`
			DueDate       *string  `json:"due_date"`
			Estimate      *string  `json:"estimate"`
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
		setIfPtr(patch, "description", input.Description)
		setIfPtr(patch, "type", input.Type)
		setIfPtr(patch, "priority", input.Priority)
		setIfPtr(patch, "status", input.Status)
		setIfPtr(patch, "assigned_agent_id", input.AssignedAgent)
		setIfPtr(patch, "assigned_user_id", input.AssignedUser)
		setIfPtr(patch, "due_date", input.DueDate)
		setIfPtr(patch, "estimate", input.Estimate)
		if input.Labels != nil {
			patch["labels"] = input.Labels
		}

		q := fmt.Sprintf("id=eq.%s&organization_id=eq.%s", url.QueryEscape(input.ID), url.QueryEscape(userCtx.OrgID))
		result, err := dbClient.Patch(ctx, "tasks", q, patch)
		if err != nil {
			return mcp.ErrorResult("failed to update task: " + err.Error()), nil
		}
		return mcp.TextResult(string(result)), nil
	}
}

func makeTaskAssign(dbClient *db.Client) mcp.ToolHandler {
	return func(ctx context.Context, params json.RawMessage) (*mcp.ToolResult, error) {
		var input struct {
			ID      string `json:"id"`
			AgentID string `json:"agent_id"`
			UserID  string `json:"user_id"`
		}
		if err := json.Unmarshal(params, &input); err != nil {
			return mcp.ErrorResult("invalid params: " + err.Error()), nil
		}
		if input.ID == "" {
			return mcp.ErrorResult("id is required"), nil
		}
		if input.AgentID == "" && input.UserID == "" {
			return mcp.ErrorResult("agent_id or user_id is required"), nil
		}

		userCtx := auth.UserContextFromContext(ctx)
		if userCtx == nil {
			return mcp.ErrorResult("authentication required"), nil
		}

		patch := map[string]interface{}{
			"updated_at": time.Now().UTC().Format(time.RFC3339),
		}
		if input.AgentID != "" {
			patch["assigned_agent_id"] = input.AgentID
		}
		if input.UserID != "" {
			patch["assigned_user_id"] = input.UserID
		}

		q := fmt.Sprintf("id=eq.%s&organization_id=eq.%s", url.QueryEscape(input.ID), url.QueryEscape(userCtx.OrgID))
		result, err := dbClient.Patch(ctx, "tasks", q, patch)
		if err != nil {
			return mcp.ErrorResult("failed to assign task: " + err.Error()), nil
		}
		return mcp.TextResult(string(result)), nil
	}
}

func makeTaskComplete(dbClient *db.Client) mcp.ToolHandler {
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

		now := time.Now().UTC().Format(time.RFC3339)
		patch := map[string]interface{}{
			"status":       "done",
			"completed_at": now,
			"updated_at":   now,
		}

		q := fmt.Sprintf("id=eq.%s&organization_id=eq.%s", url.QueryEscape(input.ID), url.QueryEscape(userCtx.OrgID))
		result, err := dbClient.Patch(ctx, "tasks", q, patch)
		if err != nil {
			return mcp.ErrorResult("failed to complete task: " + err.Error()), nil
		}
		return mcp.TextResult(string(result)), nil
	}
}

func makeTaskBlock(dbClient *db.Client) mcp.ToolHandler {
	return func(ctx context.Context, params json.RawMessage) (*mcp.ToolResult, error) {
		var input struct {
			ID     string `json:"id"`
			Reason string `json:"reason"`
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
			"status":     "blocked",
			"updated_at": time.Now().UTC().Format(time.RFC3339),
		}
		if input.Reason != "" {
			patch["blocked_reason"] = input.Reason
		}

		q := fmt.Sprintf("id=eq.%s&organization_id=eq.%s", url.QueryEscape(input.ID), url.QueryEscape(userCtx.OrgID))
		result, err := dbClient.Patch(ctx, "tasks", q, patch)
		if err != nil {
			return mcp.ErrorResult("failed to block task: " + err.Error()), nil
		}
		return mcp.TextResult(string(result)), nil
	}
}

func makeTaskGetNext(dbClient *db.Client) mcp.ToolHandler {
	return func(ctx context.Context, params json.RawMessage) (*mcp.ToolResult, error) {
		var input struct {
			ProjectID string `json:"project_id"`
			AgentID   string `json:"agent_id"`
			UserID    string `json:"user_id"`
		}
		if err := json.Unmarshal(params, &input); err != nil {
			return mcp.ErrorResult("invalid params: " + err.Error()), nil
		}

		userCtx := auth.UserContextFromContext(ctx)
		if userCtx == nil {
			return mcp.ErrorResult("authentication required"), nil
		}

		rpcParams := map[string]interface{}{
			"p_organization_id": userCtx.OrgID,
		}
		if input.ProjectID != "" {
			rpcParams["p_project_id"] = input.ProjectID
		}
		if input.AgentID != "" {
			rpcParams["p_agent_id"] = input.AgentID
		}
		if input.UserID != "" {
			rpcParams["p_user_id"] = input.UserID
		}

		result, err := dbClient.RPC(ctx, "get_next_task", rpcParams)
		if err != nil {
			return mcp.ErrorResult("failed to get next task: " + err.Error()), nil
		}
		return mcp.TextResult(string(result)), nil
	}
}
