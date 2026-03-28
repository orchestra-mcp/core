package tools

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"

	"github.com/orchestra-mcp/server/internal/auth"
	"github.com/orchestra-mcp/server/internal/db"
	"github.com/orchestra-mcp/server/internal/embedding"
	"github.com/orchestra-mcp/server/internal/mcp"
)

// RegisterDecisionTools registers all decision-related tools on the given registry.
func RegisterDecisionTools(registry *mcp.ToolRegistry, dbClient *db.Client, embedder *embedding.Client) {
	registry.Register(
		"decision_log",
		"Log a decision with context, alternatives, and optional embedding for semantic search",
		mustSchema(map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"title":        map[string]string{"type": "string", "description": "Short title for the decision"},
				"decision":     map[string]string{"type": "string", "description": "The decision that was made"},
				"context":      map[string]string{"type": "string", "description": "Context and reasoning behind the decision"},
				"alternatives": map[string]string{"type": "string", "description": "Alternatives that were considered"},
				"outcome":      map[string]string{"type": "string", "description": "Expected or actual outcome"},
				"project_id":   map[string]string{"type": "string", "description": "Project ID this decision relates to"},
				"task_id":      map[string]string{"type": "string", "description": "Task ID this decision relates to"},
				"tags":         map[string]interface{}{"type": "array", "items": map[string]string{"type": "string"}, "description": "Tags for categorization"},
			},
			"required": []string{"title", "decision"},
		}),
		makeDecisionLog(dbClient, embedder),
	)

	registry.Register(
		"decision_search",
		"Semantic search across past decisions using vector similarity",
		mustSchema(map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"query":       map[string]string{"type": "string", "description": "The search query text"},
				"project_id":  map[string]string{"type": "string", "description": "Filter by project ID"},
				"match_count": map[string]interface{}{"type": "integer", "description": "Max results to return", "default": 5},
			},
			"required": []string{"query"},
		}),
		makeDecisionSearch(dbClient, embedder),
	)

	registry.Register(
		"decision_list",
		"List recent decisions with optional filters",
		mustSchema(map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"project_id": map[string]string{"type": "string", "description": "Filter by project ID"},
				"limit":      map[string]interface{}{"type": "integer", "description": "Max results to return", "default": 10},
			},
		}),
		makeDecisionList(dbClient),
	)
}

func makeDecisionLog(dbClient *db.Client, embedder *embedding.Client) mcp.ToolHandler {
	return func(ctx context.Context, params json.RawMessage) (*mcp.ToolResult, error) {
		userCtx, ok := auth.FromContext(ctx)
		if !ok {
			return errorResult("authentication required"), nil
		}

		var p struct {
			Title        string   `json:"title"`
			Decision     string   `json:"decision"`
			Context      string   `json:"context,omitempty"`
			Alternatives string   `json:"alternatives,omitempty"`
			Outcome      string   `json:"outcome,omitempty"`
			ProjectID    string   `json:"project_id,omitempty"`
			TaskID       string   `json:"task_id,omitempty"`
			Tags         []string `json:"tags,omitempty"`
		}
		if err := json.Unmarshal(params, &p); err != nil {
			return errorResult("invalid parameters: " + err.Error()), nil
		}
		if p.Title == "" {
			return errorResult("title is required"), nil
		}
		if p.Decision == "" {
			return errorResult("decision is required"), nil
		}

		payload := map[string]interface{}{
			"title":           p.Title,
			"decision":        p.Decision,
			"organization_id": userCtx.OrgID,
			"made_by":         userCtx.UserID,
		}
		if p.Context != "" {
			payload["context"] = p.Context
		}
		if p.Alternatives != "" {
			payload["alternatives"] = p.Alternatives
		}
		if p.Outcome != "" {
			payload["outcome"] = p.Outcome
		}
		if p.ProjectID != "" {
			payload["project_id"] = p.ProjectID
		}
		if p.TaskID != "" {
			payload["task_id"] = p.TaskID
		}
		if len(p.Tags) > 0 {
			payload["tags"] = p.Tags
		}

		// Generate embedding for the decision text.
		var warning string
		vec, err := embedder.Embed(ctx, p.Decision)
		if err != nil {
			slog.Warn("embedding unavailable, storing decision without vector", "error", err)
			warning = "Warning: embedding service unavailable — decision stored without vector (semantic search will not find it)."
		} else {
			payload["embedding"] = floats32ToAny(vec)
		}

		raw, err := dbClient.Post(ctx, "decisions", payload)
		if err != nil {
			return errorResult("failed to log decision: " + err.Error()), nil
		}

		result := map[string]interface{}{
			"decision": json.RawMessage(raw),
		}
		if warning != "" {
			result["warning"] = warning
		}
		return jsonResult(result)
	}
}

func makeDecisionSearch(dbClient *db.Client, embedder *embedding.Client) mcp.ToolHandler {
	return func(ctx context.Context, params json.RawMessage) (*mcp.ToolResult, error) {
		userCtx, ok := auth.FromContext(ctx)
		if !ok {
			return errorResult("authentication required"), nil
		}

		var p struct {
			Query      string `json:"query"`
			ProjectID  string `json:"project_id,omitempty"`
			MatchCount int    `json:"match_count,omitempty"`
		}
		if err := json.Unmarshal(params, &p); err != nil {
			return errorResult("invalid parameters: " + err.Error()), nil
		}
		if p.Query == "" {
			return errorResult("query is required"), nil
		}
		if p.MatchCount <= 0 {
			p.MatchCount = 5
		}

		// Use PostgreSQL text search instead of vector embeddings
		qstr := fmt.Sprintf("organization_id=eq.%s&order=created_at.desc&limit=%d&select=id,title,decision,context,alternatives,outcome,tags,created_at&or=(title.ilike.*%s*,decision.ilike.*%s*)", userCtx.OrgID, p.MatchCount, p.Query, p.Query)
		if p.ProjectID != "" {
			qstr += "&project_id=eq." + p.ProjectID
		}

		raw, err := dbClient.Get(ctx, "decisions", qstr)
		if err != nil {
			return errorResult("search failed: " + err.Error()), nil
		}
		return jsonResult(map[string]json.RawMessage{"decisions": raw})
	}
}

func makeDecisionList(dbClient *db.Client) mcp.ToolHandler {
	return func(ctx context.Context, params json.RawMessage) (*mcp.ToolResult, error) {
		userCtx, ok := auth.FromContext(ctx)
		if !ok {
			return errorResult("authentication required"), nil
		}

		var p struct {
			ProjectID string `json:"project_id,omitempty"`
			Limit     int    `json:"limit,omitempty"`
		}
		if err := json.Unmarshal(params, &p); err != nil {
			return errorResult("invalid parameters: " + err.Error()), nil
		}
		if p.Limit <= 0 {
			p.Limit = 10
		}

		query := fmt.Sprintf("organization_id=eq.%s&order=created_at.desc&limit=%d", userCtx.OrgID, p.Limit)
		if p.ProjectID != "" {
			query += "&project_id=eq." + p.ProjectID
		}
		// Exclude embedding from response.
		query += "&select=id,title,decision,context,alternatives,outcome,project_id,task_id,tags,made_by,created_at,updated_at"

		raw, err := dbClient.Get(ctx, "decisions", query)
		if err != nil {
			return errorResult("failed to list decisions: " + err.Error()), nil
		}
		return jsonResult(map[string]json.RawMessage{"decisions": raw})
	}
}
