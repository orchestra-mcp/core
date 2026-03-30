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

var commentAddSchema = json.RawMessage(`{
	"type": "object",
	"properties": {
		"task_id":         {"type": "string", "format": "uuid", "description": "Task ID to comment on"},
		"message":         {"type": "string", "description": "Comment message text"},
		"author_agent_id": {"type": "string", "format": "uuid", "description": "Agent ID if posted by an agent (optional)"},
		"result":          {"type": "string", "description": "Result or outcome text (optional)"},
		"metadata":        {"type": "object", "description": "Arbitrary metadata JSON (optional)"}
	},
	"required": ["task_id", "message"]
}`)

var commentListSchema = json.RawMessage(`{
	"type": "object",
	"properties": {
		"task_id": {"type": "string", "format": "uuid", "description": "Task ID to list comments for"},
		"limit":   {"type": "integer", "description": "Max results (default 20)"}
	},
	"required": ["task_id"]
}`)

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

// RegisterCommentTools registers task comment MCP tools.
func RegisterCommentTools(registry *mcp.ToolRegistry, dbClient *db.Client) {
	registry.Register("task_comment_add", "Add a comment to a task", commentAddSchema, makeCommentAdd(dbClient))
	registry.Register("task_comment_list", "List comments for a task", commentListSchema, makeCommentList(dbClient))
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

func makeCommentAdd(dbClient *db.Client) mcp.ToolHandler {
	return func(ctx context.Context, params json.RawMessage) (*mcp.ToolResult, error) {
		var input struct {
			TaskID       string                 `json:"task_id"`
			Message      string                 `json:"message"`
			AuthorAgent  string                 `json:"author_agent_id"`
			Result       string                 `json:"result"`
			Metadata     map[string]interface{} `json:"metadata"`
		}
		if err := json.Unmarshal(params, &input); err != nil {
			return mcp.ErrorResult("invalid params: " + err.Error()), nil
		}
		if input.TaskID == "" {
			return mcp.ErrorResult("task_id is required"), nil
		}
		if input.Message == "" {
			return mcp.ErrorResult("message is required"), nil
		}

		userCtx := auth.UserContextFromContext(ctx)
		if userCtx == nil {
			return mcp.ErrorResult("authentication required"), nil
		}

		row := map[string]interface{}{
			"task_id":         input.TaskID,
			"message":         input.Message,
			"organization_id": userCtx.OrgID,
			"author_id":       userCtx.UserID,
			"created_at":      time.Now().UTC().Format(time.RFC3339),
		}
		setIfNotEmpty(row, "author_agent_id", input.AuthorAgent)
		setIfNotEmpty(row, "result", input.Result)
		if len(input.Metadata) > 0 {
			row["metadata"] = input.Metadata
		}

		result, err := dbClient.Post(ctx, "task_comments", row)
		if err != nil {
			return mcp.ErrorResult("failed to add comment: " + err.Error()), nil
		}

		md := string(result)

		// Detect @mentions and append routing instructions
		mentioned := DetectMentions(ctx, dbClient, userCtx.OrgID, input.Message)
		if len(mentioned) > 0 {
			md += FormatMentionsMarkdown(mentioned)
		}

		return mcp.TextResult(md), nil
	}
}

func makeCommentList(dbClient *db.Client) mcp.ToolHandler {
	return func(ctx context.Context, params json.RawMessage) (*mcp.ToolResult, error) {
		var input struct {
			TaskID string `json:"task_id"`
			Limit  int    `json:"limit"`
		}
		if err := json.Unmarshal(params, &input); err != nil {
			return mcp.ErrorResult("invalid params: " + err.Error()), nil
		}
		if input.TaskID == "" {
			return mcp.ErrorResult("task_id is required"), nil
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
		q.Set("task_id", "eq."+input.TaskID)
		q.Set("organization_id", "eq."+userCtx.OrgID)
		q.Set("order", "created_at.desc")
		q.Set("limit", fmt.Sprintf("%d", limit))

		result, err := dbClient.Get(ctx, "task_comments", q.Encode())
		if err != nil {
			return mcp.ErrorResult("failed to list comments: " + err.Error()), nil
		}
		return mcp.TextResult(string(result)), nil
	}
}
