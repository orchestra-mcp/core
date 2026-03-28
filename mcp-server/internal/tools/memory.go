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

// RegisterMemoryTools registers all memory-related tools on the given registry.
func RegisterMemoryTools(registry *mcp.ToolRegistry, dbClient *db.Client, embedder *embedding.Client) {
	registry.Register(
		"memory_store",
		"Store a memory with embedding for later semantic search",
		mustSchema(map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"content":    map[string]string{"type": "string", "description": "The content of the memory to store"},
				"title":      map[string]string{"type": "string", "description": "Optional title for the memory"},
				"source":     map[string]interface{}{"type": "string", "description": "Source type", "enum": []string{"conversation", "task", "decision", "document", "code_review", "meeting", "learning", "spec"}},
				"agent_id":   map[string]string{"type": "string", "description": "ID of the agent storing this memory"},
				"project_id": map[string]string{"type": "string", "description": "Project ID to scope this memory to"},
				"tags":       map[string]interface{}{"type": "array", "items": map[string]string{"type": "string"}, "description": "Tags for categorization"},
				"importance": map[string]interface{}{"type": "number", "description": "Importance score from 0 to 1", "minimum": 0, "maximum": 1},
			},
			"required": []string{"content"},
		}),
		makeMemoryStore(dbClient, embedder),
	)

	registry.Register(
		"memory_search",
		"Semantic search across stored memories using vector similarity",
		mustSchema(map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"query":           map[string]string{"type": "string", "description": "The search query text"},
				"agent_id":        map[string]string{"type": "string", "description": "Filter by agent ID"},
				"project_id":      map[string]string{"type": "string", "description": "Filter by project ID"},
				"match_count":     map[string]interface{}{"type": "integer", "description": "Max results to return", "default": 10},
				"match_threshold": map[string]interface{}{"type": "number", "description": "Minimum similarity threshold (0-1)", "default": 0.7},
			},
			"required": []string{"query"},
		}),
		makeMemorySearch(dbClient, embedder),
	)

	registry.Register(
		"memory_list",
		"List recent memories with optional filters",
		mustSchema(map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"agent_id":   map[string]string{"type": "string", "description": "Filter by agent ID"},
				"project_id": map[string]string{"type": "string", "description": "Filter by project ID"},
				"source":     map[string]interface{}{"type": "string", "description": "Filter by source type", "enum": []string{"conversation", "task", "decision", "document", "code_review", "meeting", "learning", "spec"}},
				"limit":      map[string]interface{}{"type": "integer", "description": "Max results to return", "default": 20},
			},
		}),
		makeMemoryList(dbClient),
	)

	registry.Register(
		"memory_delete",
		"Delete a memory by ID",
		mustSchema(map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"id": map[string]string{"type": "string", "description": "The memory ID to delete"},
			},
			"required": []string{"id"},
		}),
		makeMemoryDelete(dbClient),
	)
}

func makeMemoryStore(dbClient *db.Client, embedder *embedding.Client) mcp.ToolHandler {
	return func(ctx context.Context, params json.RawMessage) (*mcp.ToolResult, error) {
		userCtx, ok := auth.FromContext(ctx)
		if !ok {
			return errorResult("authentication required"), nil
		}

		var p struct {
			Content    string   `json:"content"`
			Title      string   `json:"title,omitempty"`
			Source     string   `json:"source,omitempty"`
			AgentID    string   `json:"agent_id,omitempty"`
			ProjectID  string   `json:"project_id,omitempty"`
			Tags       []string `json:"tags,omitempty"`
			Importance float64  `json:"importance,omitempty"`
		}
		if err := json.Unmarshal(params, &p); err != nil {
			return errorResult("invalid parameters: " + err.Error()), nil
		}
		if p.Content == "" {
			return errorResult("content is required"), nil
		}

		payload := map[string]interface{}{
			"content":         p.Content,
			"organization_id": userCtx.OrgID,
			"user_id":         userCtx.UserID,
		}
		if p.Title != "" {
			payload["title"] = p.Title
		}
		if p.Source != "" {
			payload["source"] = p.Source
		}
		if p.AgentID != "" {
			payload["agent_id"] = p.AgentID
		}
		if p.ProjectID != "" {
			payload["project_id"] = p.ProjectID
		}
		if len(p.Tags) > 0 {
			payload["tags"] = p.Tags
		}
		if p.Importance > 0 {
			payload["importance"] = p.Importance
		}

		// Generate embedding — store without it if the service is unavailable.
		var warning string
		vec, err := embedder.Embed(ctx, p.Content)
		if err != nil {
			slog.Warn("embedding unavailable, storing memory without vector", "error", err)
			warning = "Warning: embedding service unavailable — memory stored without vector (semantic search will not find it)."
		} else {
			payload["embedding"] = floats32ToAny(vec)
		}

		raw, err := dbClient.Post(ctx, "memories", payload)
		if err != nil {
			return errorResult("failed to store memory: " + err.Error()), nil
		}

		result := map[string]interface{}{
			"memory": json.RawMessage(raw),
		}
		if warning != "" {
			result["warning"] = warning
		}
		return jsonResult(result)
	}
}

func makeMemorySearch(dbClient *db.Client, embedder *embedding.Client) mcp.ToolHandler {
	return func(ctx context.Context, params json.RawMessage) (*mcp.ToolResult, error) {
		userCtx, ok := auth.FromContext(ctx)
		if !ok {
			return errorResult("authentication required"), nil
		}

		var p struct {
			Query          string  `json:"query"`
			AgentID        string  `json:"agent_id,omitempty"`
			ProjectID      string  `json:"project_id,omitempty"`
			MatchCount     int     `json:"match_count,omitempty"`
			MatchThreshold float64 `json:"match_threshold,omitempty"`
		}
		if err := json.Unmarshal(params, &p); err != nil {
			return errorResult("invalid parameters: " + err.Error()), nil
		}
		if p.Query == "" {
			return errorResult("query is required"), nil
		}
		if p.MatchCount <= 0 {
			p.MatchCount = 10
		}
		if p.MatchThreshold <= 0 {
			p.MatchThreshold = 0.7
		}

		// Use PostgreSQL text search instead of vector embeddings
		qstr := fmt.Sprintf("organization_id=eq.%s&order=created_at.desc&limit=%d&select=id,title,content,summary,source,tags,created_at&or=(title.ilike.*%s*,content.ilike.*%s*)", userCtx.OrgID, p.MatchCount, p.Query, p.Query)
		if p.AgentID != "" {
			qstr += "&agent_id=eq." + p.AgentID
		}
		if p.ProjectID != "" {
			qstr += "&project_id=eq." + p.ProjectID
		}

		raw, err := dbClient.Get(ctx, "memories", qstr)
		if err != nil {
			return errorResult("search failed: " + err.Error()), nil
		}
		return jsonResult(map[string]json.RawMessage{"memories": raw})
	}
}

func makeMemoryList(dbClient *db.Client) mcp.ToolHandler {
	return func(ctx context.Context, params json.RawMessage) (*mcp.ToolResult, error) {
		userCtx, ok := auth.FromContext(ctx)
		if !ok {
			return errorResult("authentication required"), nil
		}

		var p struct {
			AgentID   string `json:"agent_id,omitempty"`
			ProjectID string `json:"project_id,omitempty"`
			Source    string `json:"source,omitempty"`
			Limit     int    `json:"limit,omitempty"`
		}
		if err := json.Unmarshal(params, &p); err != nil {
			return errorResult("invalid parameters: " + err.Error()), nil
		}
		if p.Limit <= 0 {
			p.Limit = 20
		}

		query := fmt.Sprintf("organization_id=eq.%s&order=created_at.desc&limit=%d", userCtx.OrgID, p.Limit)
		if p.AgentID != "" {
			query += "&agent_id=eq." + p.AgentID
		}
		if p.ProjectID != "" {
			query += "&project_id=eq." + p.ProjectID
		}
		if p.Source != "" {
			query += "&source=eq." + p.Source
		}
		// Exclude the embedding column from the response to reduce payload size.
		query += "&select=id,title,content,source,agent_id,project_id,tags,importance,created_at,updated_at"

		raw, err := dbClient.Get(ctx, "memories", query)
		if err != nil {
			return errorResult("failed to list memories: " + err.Error()), nil
		}
		return jsonResult(map[string]json.RawMessage{"memories": raw})
	}
}

func makeMemoryDelete(dbClient *db.Client) mcp.ToolHandler {
	return func(ctx context.Context, params json.RawMessage) (*mcp.ToolResult, error) {
		userCtx, ok := auth.FromContext(ctx)
		if !ok {
			return errorResult("authentication required"), nil
		}

		var p struct {
			ID string `json:"id"`
		}
		if err := json.Unmarshal(params, &p); err != nil {
			return errorResult("invalid parameters: " + err.Error()), nil
		}
		if p.ID == "" {
			return errorResult("id is required"), nil
		}

		query := fmt.Sprintf("id=eq.%s&organization_id=eq.%s", p.ID, userCtx.OrgID)
		_, err := dbClient.Delete(ctx, "memories", query)
		if err != nil {
			return errorResult("failed to delete memory: " + err.Error()), nil
		}
		return textResult("Memory deleted successfully."), nil
	}
}
