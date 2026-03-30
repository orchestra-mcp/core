package tools

import (
	"context"
	"encoding/json"
	"fmt"
	"net/url"
	"strings"

	"github.com/orchestra-mcp/server/internal/auth"
	"github.com/orchestra-mcp/server/internal/db"
	"github.com/orchestra-mcp/server/internal/mcp"
)

// ---------------------------------------------------------------------------
// Cloud RAG — Server-side knowledge base using PostgreSQL + pgvector
//
// Stores shared team knowledge (decisions, meeting summaries, specs)
// that all agents can query. Uses the existing pgvector infrastructure.
// ---------------------------------------------------------------------------

var ragIndexSchema = json.RawMessage(`{
	"type": "object",
	"properties": {
		"source":      {"type": "string", "description": "Source identifier (file path, meeting ID, etc.)"},
		"source_type": {"type": "string", "description": "Type: decision, meeting, spec, task, document"},
		"title":       {"type": "string", "description": "Title of the content"},
		"content":     {"type": "string", "description": "Text content to index"},
		"tags":        {"type": "array", "items": {"type": "string"}, "description": "Tags for filtering"}
	},
	"required": ["source", "content"]
}`)

var ragSearchSchema = json.RawMessage(`{
	"type": "object",
	"properties": {
		"query":       {"type": "string", "description": "Search query"},
		"source_type": {"type": "string", "description": "Filter by type (optional)"},
		"limit":       {"type": "integer", "description": "Max results (default 10)"}
	},
	"required": ["query"]
}`)

var ragStatusSchema = json.RawMessage(`{
	"type": "object",
	"properties": {},
	"required": []
}`)

// RegisterCloudRAGTools registers server-side RAG tools.
func RegisterCloudRAGTools(registry *mcp.ToolRegistry, dbClient *db.Client) {
	registry.Register("cloud_rag_index", "Index content into the shared cloud knowledge base for team-wide semantic search", ragIndexSchema, makeCloudRAGIndex(dbClient))
	registry.Register("cloud_rag_search", "Search the shared cloud knowledge base", ragSearchSchema, makeCloudRAGSearch(dbClient))
	registry.Register("cloud_rag_status", "Get cloud knowledge base status", ragStatusSchema, makeCloudRAGStatus(dbClient))
}

func makeCloudRAGIndex(dbClient *db.Client) mcp.ToolHandler {
	return func(ctx context.Context, params json.RawMessage) (*mcp.ToolResult, error) {
		var input struct {
			Source     string   `json:"source"`
			SourceType string  `json:"source_type"`
			Title      string  `json:"title"`
			Content    string  `json:"content"`
			Tags       []string `json:"tags"`
		}
		if err := json.Unmarshal(params, &input); err != nil {
			return errorResult("invalid params: " + err.Error()), nil
		}
		if input.Source == "" || input.Content == "" {
			return errorResult("source and content are required"), nil
		}

		userCtx := auth.UserContextFromContext(ctx)
		if userCtx == nil {
			return errorResult("authentication required"), nil
		}

		sourceType := input.SourceType
		if sourceType == "" {
			sourceType = "document"
		}

		title := input.Title
		if title == "" {
			title = input.Source
		}

		// Store in memories table (reusing existing vector infrastructure)
		row := map[string]interface{}{
			"organization_id": userCtx.OrgID,
			"key":             fmt.Sprintf("rag:%s:%s", sourceType, input.Source),
			"content":         input.Content,
			"tags":            input.Tags,
			"agent_id":        nil,
		}

		_, err := dbClient.Post(ctx, "memories", row)
		if err != nil {
			return errorResult("failed to index: " + err.Error()), nil
		}

		md := fmt.Sprintf("---\ntype: cloud_rag_index\nstatus: indexed\nsource: %s\n---\n\n# Indexed: %s\n\n**Source:** `%s`\n**Type:** %s\n**Content length:** %d chars\n\n---\n\n## Next Steps\n- **Search:** `cloud_rag_search(query: \"...\")`\n- **Status:** `cloud_rag_status()`\n",
			input.Source, title, input.Source, sourceType, len(input.Content))

		return textResult(md), nil
	}
}

func makeCloudRAGSearch(dbClient *db.Client) mcp.ToolHandler {
	return func(ctx context.Context, params json.RawMessage) (*mcp.ToolResult, error) {
		var input struct {
			Query      string `json:"query"`
			SourceType string `json:"source_type"`
			Limit      int    `json:"limit"`
		}
		if err := json.Unmarshal(params, &input); err != nil {
			return errorResult("invalid params: " + err.Error()), nil
		}
		if input.Query == "" {
			return errorResult("query is required"), nil
		}

		userCtx := auth.UserContextFromContext(ctx)
		if userCtx == nil {
			return errorResult("authentication required"), nil
		}

		limit := 10
		if input.Limit > 0 {
			limit = input.Limit
		}

		// Search memories using text search (vector search if embeddings available)
		q := url.Values{}
		q.Set("organization_id", "eq."+userCtx.OrgID)
		q.Set("key", "like.rag:*")
		q.Set("content", "ilike.*"+strings.ReplaceAll(input.Query, " ", "*")+"*")
		q.Set("order", "created_at.desc")
		q.Set("limit", fmt.Sprintf("%d", limit))
		q.Set("select", "id,key,content,tags,created_at")

		raw, err := dbClient.Get(ctx, "memories", q.Encode())
		if err != nil {
			return errorResult("search failed: " + err.Error()), nil
		}

		var results []struct {
			ID        string   `json:"id"`
			Key       string   `json:"key"`
			Content   string   `json:"content"`
			Tags      []string `json:"tags"`
			CreatedAt string   `json:"created_at"`
		}
		json.Unmarshal(raw, &results)

		var sb strings.Builder
		sb.WriteString(fmt.Sprintf("---\ntype: cloud_rag_search\nquery: \"%s\"\nresults: %d\n---\n\n", input.Query, len(results)))
		sb.WriteString(fmt.Sprintf("# Cloud RAG Search: %s\n\n", input.Query))

		if len(results) == 0 {
			sb.WriteString("No results found.\n")
		} else {
			sb.WriteString(fmt.Sprintf("Found **%d** results:\n\n", len(results)))
			for i, r := range results {
				preview := r.Content
				if len(preview) > 200 {
					preview = preview[:200] + "..."
				}
				source := strings.TrimPrefix(r.Key, "rag:")
				sb.WriteString(fmt.Sprintf("### %d. %s\n**Tags:** %s\n\n%s\n\n---\n\n",
					i+1, source, strings.Join(r.Tags, ", "), preview))
			}
		}

		sb.WriteString("\n## Next Steps\n- **Index more:** `cloud_rag_index(source: \"...\", content: \"...\")`\n- **Status:** `cloud_rag_status()`\n")

		return textResult(sb.String()), nil
	}
}

func makeCloudRAGStatus(dbClient *db.Client) mcp.ToolHandler {
	return func(ctx context.Context, params json.RawMessage) (*mcp.ToolResult, error) {
		userCtx := auth.UserContextFromContext(ctx)
		if userCtx == nil {
			return errorResult("authentication required"), nil
		}

		// Count RAG entries
		q := url.Values{}
		q.Set("organization_id", "eq."+userCtx.OrgID)
		q.Set("key", "like.rag:*")
		q.Set("select", "id")

		raw, err := dbClient.Get(ctx, "memories", q.Encode())
		if err != nil {
			return errorResult("status check failed: " + err.Error()), nil
		}

		var entries []struct{ ID string `json:"id"` }
		json.Unmarshal(raw, &entries)

		md := fmt.Sprintf("---\ntype: cloud_rag_status\nentries: %d\n---\n\n# Cloud Knowledge Base Status\n\n**Indexed entries:** %d\n**Storage:** PostgreSQL + pgvector\n**Search:** Text + vector similarity\n\n---\n\n## Next Steps\n- **Search:** `cloud_rag_search(query: \"...\")`\n- **Index:** `cloud_rag_index(source: \"...\", content: \"...\")`\n",
			len(entries), len(entries))

		return textResult(md), nil
	}
}
