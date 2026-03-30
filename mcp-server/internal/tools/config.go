package tools

import (
	"context"
	"encoding/json"
	"fmt"
	"net/url"
	"strings"
	"time"

	"github.com/orchestra-mcp/server/internal/auth"
	"github.com/orchestra-mcp/server/internal/db"
	"github.com/orchestra-mcp/server/internal/mcp"
)

// ---------------------------------------------------------------------------
// JSON Schemas
// ---------------------------------------------------------------------------

var configSaveSchema = json.RawMessage(`{
	"type": "object",
	"properties": {
		"key":   {
			"type": "string",
			"description": "Config key to save. Supported keys: preferences, active_project, work_patterns, account_pool, default_provider, default_model"
		},
		"value": {
			"description": "Config value — any valid JSON (object, string, number, array, boolean)",
			"anyOf": [
				{"type": "object"},
				{"type": "string"},
				{"type": "number"},
				{"type": "boolean"},
				{"type": "array"}
			]
		}
	},
	"required": ["key", "value"]
}`)

var configGetSchema = json.RawMessage(`{
	"type": "object",
	"properties": {
		"key": {
			"type": "string",
			"description": "Config key to retrieve. Omit to return ALL user configs."
		}
	}
}`)

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

// RegisterConfigTools registers config_save and config_get MCP tools.
func RegisterConfigTools(registry *mcp.ToolRegistry, dbClient *db.Client) {
	registry.Register("config_save", "Save a user config value (persistent preferences, active project, work patterns, account pool, provider settings)", configSaveSchema, makeConfigSave(dbClient))
	registry.Register("config_get", "Get user config values — provide a key for a specific value, or omit key to return all configs", configGetSchema, makeConfigGet(dbClient))
}

// ---------------------------------------------------------------------------
// Supported config keys
// ---------------------------------------------------------------------------

var supportedConfigKeys = map[string]string{
	"preferences":      "Theme, language, notification settings",
	"active_project":   "Current project ID the user is working on",
	"work_patterns":    "How user prefers to work (plan-first, meeting-heavy, etc.)",
	"account_pool":     "List of API accounts with labels and tiers",
	"default_provider": "Preferred AI provider for agents (claude, gemini, openai, deepseek, qwen, ollama)",
	"default_model":    "Preferred model tier (opus, sonnet, haiku)",
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

func makeConfigSave(dbClient *db.Client) mcp.ToolHandler {
	return func(ctx context.Context, params json.RawMessage) (*mcp.ToolResult, error) {
		var input struct {
			Key   string          `json:"key"`
			Value json.RawMessage `json:"value"`
		}
		if err := json.Unmarshal(params, &input); err != nil {
			return mcp.ErrorResult("invalid params: " + err.Error()), nil
		}
		if input.Key == "" {
			return mcp.ErrorResult("key is required"), nil
		}
		if len(input.Value) == 0 {
			return mcp.ErrorResult("value is required"), nil
		}

		userCtx := auth.UserContextFromContext(ctx)
		if userCtx == nil {
			return mcp.ErrorResult("authentication required"), nil
		}

		now := time.Now().UTC().Format(time.RFC3339)

		// Upsert into user_configs using PostgREST's on-conflict resolution.
		// The UNIQUE constraint is (user_id, organization_id, key).
		row := map[string]interface{}{
			"user_id":         userCtx.UserID,
			"organization_id": userCtx.OrgID,
			"key":             input.Key,
			"value":           input.Value,
			"updated_at":      now,
		}

		result, err := dbClient.Upsert(ctx, "user_configs", row, "user_id,organization_id,key")
		if err != nil {
			return mcp.ErrorResult("failed to save config: " + err.Error()), nil
		}

		// Parse saved value for display.
		var displayVal interface{}
		_ = json.Unmarshal(input.Value, &displayVal)
		displayJSON, _ := json.MarshalIndent(displayVal, "", "  ")

		description := supportedConfigKeys[input.Key]
		if description == "" {
			description = "Custom config key"
		}

		_ = result // upsert response not needed for display

		return mdResult(MarkdownResponse{
			Frontmatter: map[string]interface{}{
				"type": "config_save",
				"key":  input.Key,
			},
			Body: fmt.Sprintf("# Config Saved\n\n**Key:** `%s`\n**Description:** %s\n\n```json\n%s\n```\n\nConfig persisted to cloud. It will auto-load on your next session.",
				input.Key, description, string(displayJSON)),
			NextSteps: []NextStep{
				{Label: "Retrieve this config", Command: fmt.Sprintf(`config_get(key: "%s")`, input.Key)},
				{Label: "View all configs", Command: `config_get()`},
			},
		}), nil
	}
}

func makeConfigGet(dbClient *db.Client) mcp.ToolHandler {
	return func(ctx context.Context, params json.RawMessage) (*mcp.ToolResult, error) {
		var input struct {
			Key string `json:"key"`
		}
		if err := json.Unmarshal(params, &input); err != nil {
			return mcp.ErrorResult("invalid params: " + err.Error()), nil
		}

		userCtx := auth.UserContextFromContext(ctx)
		if userCtx == nil {
			return mcp.ErrorResult("authentication required"), nil
		}

		q := url.Values{}
		q.Set("user_id", "eq."+userCtx.UserID)
		q.Set("organization_id", "eq."+userCtx.OrgID)
		q.Set("order", "key.asc")

		if input.Key != "" {
			// Fetch single key.
			q.Set("key", "eq."+input.Key)
			result, err := dbClient.Get(ctx, "user_configs", q.Encode())
			if err != nil {
				return mcp.ErrorResult("failed to get config: " + err.Error()), nil
			}

			items, parseErr := parseJSONArray(result)
			if parseErr != nil || len(items) == 0 {
				description := supportedConfigKeys[input.Key]
				if description == "" {
					description = "Custom config key"
				}
				return mdResult(MarkdownResponse{
					Frontmatter: map[string]interface{}{
						"type": "config_get",
						"key":  input.Key,
					},
					Body: fmt.Sprintf("# Config: `%s`\n\n*Not set yet.*\n\n**Description:** %s", input.Key, description),
					NextSteps: []NextStep{
						{Label: "Set this config", Command: fmt.Sprintf(`config_save(key: "%s", value: {...})`, input.Key)},
					},
				}), nil
			}

			item := items[0]
			rawValue := jsonRaw(item, "value")
			var displayVal interface{}
			_ = json.Unmarshal([]byte(rawValue), &displayVal)
			displayJSON, _ := json.MarshalIndent(displayVal, "", "  ")

			description := supportedConfigKeys[input.Key]
			if description == "" {
				description = "Custom config key"
			}

			return mdResult(MarkdownResponse{
				Frontmatter: map[string]interface{}{
					"type":       "config_get",
					"key":        input.Key,
					"updated_at": jsonStr(item, "updated_at"),
				},
				Body: fmt.Sprintf("# Config: `%s`\n\n**Description:** %s\n**Last Updated:** %s\n\n```json\n%s\n```",
					input.Key, description, jsonStr(item, "updated_at"), string(displayJSON)),
				NextSteps: []NextStep{
					{Label: "Update this config", Command: fmt.Sprintf(`config_save(key: "%s", value: {...})`, input.Key)},
					{Label: "View all configs", Command: `config_get()`},
				},
			}), nil
		}

		// Fetch all keys.
		result, err := dbClient.Get(ctx, "user_configs", q.Encode())
		if err != nil {
			return mcp.ErrorResult("failed to get configs: " + err.Error()), nil
		}

		items, parseErr := parseJSONArray(result)
		if parseErr != nil || len(items) == 0 {
			// Show available keys even if nothing is configured.
			var sb strings.Builder
			sb.WriteString("# User Config\n\n*No configs set yet.*\n\n## Available Config Keys\n\n")
			sb.WriteString("| Key | Description |\n|-----|-------------|\n")
			for _, k := range []string{"preferences", "active_project", "work_patterns", "account_pool", "default_provider", "default_model"} {
				sb.WriteString(fmt.Sprintf("| `%s` | %s |\n", k, supportedConfigKeys[k]))
			}
			return mdResult(MarkdownResponse{
				Frontmatter: map[string]interface{}{
					"type":  "config_get",
					"count": 0,
				},
				Body: sb.String(),
				NextSteps: []NextStep{
					{Label: "Set default provider", Command: `config_save(key: "default_provider", value: "claude")`},
					{Label: "Set preferences", Command: `config_save(key: "preferences", value: {"theme": "dark", "language": "en"})`},
				},
			}), nil
		}

		// Render all configs as a table + details.
		var sb strings.Builder
		sb.WriteString(fmt.Sprintf("# User Config (%d entries)\n\n", len(items)))

		rows := make([][]string, 0, len(items))
		for _, item := range items {
			key := jsonStr(item, "key")
			description := supportedConfigKeys[key]
			if description == "" {
				description = "Custom"
			}
			updatedAt := jsonStr(item, "updated_at")
			rows = append(rows, []string{"`" + key + "`", description, updatedAt})
		}

		sb.WriteString(mdTable(
			[]string{"Key", "Description", "Updated At"},
			rows,
		))

		sb.WriteString("\n## Values\n\n")
		for _, item := range items {
			key := jsonStr(item, "key")
			rawValue := jsonRaw(item, "value")
			var displayVal interface{}
			_ = json.Unmarshal([]byte(rawValue), &displayVal)
			displayJSON, _ := json.MarshalIndent(displayVal, "", "  ")
			sb.WriteString(fmt.Sprintf("### `%s`\n\n```json\n%s\n```\n\n", key, string(displayJSON)))
		}

		return mdResult(MarkdownResponse{
			Frontmatter: map[string]interface{}{
				"type":  "config_get",
				"count": len(items),
			},
			Body: sb.String(),
			NextSteps: []NextStep{
				{Label: "Update a config", Command: `config_save(key: "...", value: ...)`},
			},
		}), nil
	}
}

// ---------------------------------------------------------------------------
// Helper: extract raw JSON field value from parsed map
// ---------------------------------------------------------------------------

func jsonRaw(m map[string]interface{}, key string) string {
	v, ok := m[key]
	if !ok {
		return "null"
	}
	b, err := json.Marshal(v)
	if err != nil {
		return "null"
	}
	return string(b)
}
