package tools

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"github.com/orchestra-mcp/server/internal/mcp"
)

// ---------------------------------------------------------------------------
// Markdown Response Types
// ---------------------------------------------------------------------------

// MarkdownResponse is the structured representation of a markdown tool response
// with YAML frontmatter, a body, and actionable next steps.
type MarkdownResponse struct {
	// Frontmatter is rendered as YAML between --- delimiters at the top.
	Frontmatter map[string]interface{}
	// Body is the main markdown content (headings, tables, lists, etc.).
	Body string
	// NextSteps are rendered as a bulleted list at the bottom.
	NextSteps []NextStep
}

// NextStep represents a suggested follow-up action with a tool command.
type NextStep struct {
	Label   string // Human-readable label, e.g. "Assign agent"
	Command string // Tool invocation hint, e.g. `task_assign(id: "...")`
}

// ---------------------------------------------------------------------------
// FormatMarkdown — builds the complete response string
// ---------------------------------------------------------------------------

// FormatMarkdown renders a MarkdownResponse into the standard markdown + YAML
// frontmatter format used across all Orchestra MCP tool responses.
//
//	---
//	id: {uuid}
//	type: {entity_type}
//	status: {value}
//	export: {suggested/filepath.md}
//	---
//
//	# {Title}
//
//	{Body}
//
//	---
//
//	## Next Steps
//	- **{action}:** `tool_name(param: "value")`
func FormatMarkdown(resp MarkdownResponse) string {
	var sb strings.Builder

	// --- YAML frontmatter ---
	if len(resp.Frontmatter) > 0 {
		sb.WriteString("---\n")
		// Sort keys for deterministic output.
		keys := make([]string, 0, len(resp.Frontmatter))
		for k := range resp.Frontmatter {
			keys = append(keys, k)
		}
		sort.Strings(keys)
		for _, k := range keys {
			v := resp.Frontmatter[k]
			sb.WriteString(fmt.Sprintf("%s: %s\n", k, yamlValue(v)))
		}
		sb.WriteString("---\n\n")
	}

	// --- Body ---
	if resp.Body != "" {
		sb.WriteString(resp.Body)
		// Ensure body ends with a newline.
		if !strings.HasSuffix(resp.Body, "\n") {
			sb.WriteString("\n")
		}
	}

	// --- Next Steps ---
	if len(resp.NextSteps) > 0 {
		sb.WriteString("\n---\n\n")
		sb.WriteString("## Next Steps\n")
		for _, ns := range resp.NextSteps {
			sb.WriteString(fmt.Sprintf("- **%s:** `%s`\n", ns.Label, ns.Command))
		}
	}

	return sb.String()
}

// yamlValue formats a Go value as a simple YAML scalar. Arrays and nested
// objects are rendered inline. This is intentionally simple — we only need
// scalar keys in frontmatter.
func yamlValue(v interface{}) string {
	switch val := v.(type) {
	case string:
		// Quote strings that contain special YAML chars.
		if strings.ContainsAny(val, ":#{}[]|>&*!%@`,\n") {
			return fmt.Sprintf("%q", val)
		}
		return val
	case json.RawMessage:
		return string(val)
	case []string:
		return "[" + strings.Join(val, ", ") + "]"
	case nil:
		return "~"
	default:
		return fmt.Sprintf("%v", val)
	}
}

// ---------------------------------------------------------------------------
// mdResult — helper to create a ToolResult from a MarkdownResponse
// ---------------------------------------------------------------------------

// mdResult creates a successful ToolResult whose text content is a formatted
// markdown response with YAML frontmatter.
func mdResult(resp MarkdownResponse) *mcp.ToolResult {
	return textResult(FormatMarkdown(resp))
}

// ---------------------------------------------------------------------------
// SaveResponse — write markdown content to a file
// ---------------------------------------------------------------------------

// SaveResponse writes the given markdown content to the specified path,
// creating parent directories as needed.
func SaveResponse(path string, content string) error {
	dir := filepath.Dir(path)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return fmt.Errorf("create directory %s: %w", dir, err)
	}
	return os.WriteFile(path, []byte(content), 0o644)
}

// ---------------------------------------------------------------------------
// save_response tool
// ---------------------------------------------------------------------------

var saveResponseSchema = json.RawMessage(`{
	"type": "object",
	"properties": {
		"path":    {"type": "string", "description": "File path to save the markdown content to"},
		"content": {"type": "string", "description": "Markdown content to write to the file"}
	},
	"required": ["path", "content"]
}`)

// RegisterSaveResponseTool registers the save_response tool on the given registry.
func RegisterSaveResponseTool(registry *mcp.ToolRegistry) {
	registry.Register("save_response", "Save markdown content to a file", saveResponseSchema, handleSaveResponse)
}

func handleSaveResponse(_ context.Context, params json.RawMessage) (*mcp.ToolResult, error) {
	var input struct {
		Path    string `json:"path"`
		Content string `json:"content"`
	}
	if err := json.Unmarshal(params, &input); err != nil {
		return mcp.ErrorResult("invalid params: " + err.Error()), nil
	}
	if input.Path == "" {
		return mcp.ErrorResult("path is required"), nil
	}
	if input.Content == "" {
		return mcp.ErrorResult("content is required"), nil
	}

	if err := SaveResponse(input.Path, input.Content); err != nil {
		return mcp.ErrorResult("failed to save: " + err.Error()), nil
	}

	return mdResult(MarkdownResponse{
		Frontmatter: map[string]interface{}{
			"type":   "file",
			"status": "saved",
			"export": input.Path,
		},
		Body: fmt.Sprintf("# File Saved\n\nSuccessfully wrote %d bytes to `%s`.", len(input.Content), input.Path),
	}), nil
}

// ---------------------------------------------------------------------------
// Markdown table builder helpers
// ---------------------------------------------------------------------------

// mdTable builds a markdown table from column headers and rows.
// Each row is a slice of cell values (strings).
func mdTable(headers []string, rows [][]string) string {
	if len(headers) == 0 {
		return ""
	}

	var sb strings.Builder

	// Header row.
	sb.WriteString("| " + strings.Join(headers, " | ") + " |\n")

	// Separator row.
	seps := make([]string, len(headers))
	for i := range seps {
		seps[i] = "---"
	}
	sb.WriteString("| " + strings.Join(seps, " | ") + " |\n")

	// Data rows.
	for _, row := range rows {
		// Pad row to match header length.
		cells := make([]string, len(headers))
		for i := range cells {
			if i < len(row) {
				cells[i] = row[i]
			} else {
				cells[i] = ""
			}
		}
		sb.WriteString("| " + strings.Join(cells, " | ") + " |\n")
	}

	return sb.String()
}

// jsonStr safely extracts a string from a map parsed from JSON.
func jsonStr(m map[string]interface{}, key string) string {
	v, ok := m[key]
	if !ok || v == nil {
		return ""
	}
	s, ok := v.(string)
	if !ok {
		return fmt.Sprintf("%v", v)
	}
	return s
}

// jsonStrOr extracts a string from a map or returns the fallback.
func jsonStrOr(m map[string]interface{}, key, fallback string) string {
	s := jsonStr(m, key)
	if s == "" {
		return fallback
	}
	return s
}

// jsonArr extracts a []interface{} from a map and joins as comma-separated strings.
func jsonArr(m map[string]interface{}, key string) string {
	v, ok := m[key]
	if !ok || v == nil {
		return ""
	}
	arr, ok := v.([]interface{})
	if !ok {
		return ""
	}
	strs := make([]string, 0, len(arr))
	for _, item := range arr {
		strs = append(strs, fmt.Sprintf("%v", item))
	}
	return strings.Join(strs, ", ")
}

// parseJSONArray unmarshals a JSON array from raw bytes into a slice of maps.
func parseJSONArray(raw json.RawMessage) ([]map[string]interface{}, error) {
	var items []map[string]interface{}
	if err := json.Unmarshal(raw, &items); err != nil {
		return nil, err
	}
	return items, nil
}

// parseJSONObject unmarshals a JSON object from raw bytes into a map.
func parseJSONObject(raw json.RawMessage) (map[string]interface{}, error) {
	var obj map[string]interface{}
	if err := json.Unmarshal(raw, &obj); err != nil {
		return nil, err
	}
	return obj, nil
}

// truncate shortens a string to maxLen, appending "..." if truncated.
func truncate(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	if maxLen <= 3 {
		return s[:maxLen]
	}
	return s[:maxLen-3] + "..."
}
