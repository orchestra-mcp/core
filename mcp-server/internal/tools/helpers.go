package tools

import (
	"encoding/json"
	"fmt"

	"github.com/orchestra-mcp/server/internal/mcp"
)

// textResult creates a successful ToolResult containing a single text content block.
func textResult(text string) *mcp.ToolResult {
	return &mcp.ToolResult{
		Content: []mcp.ContentBlock{{Type: "text", Text: text}},
	}
}

// jsonResult marshals v to JSON and returns it as a text ToolResult.
func jsonResult(v interface{}) (*mcp.ToolResult, error) {
	data, err := json.MarshalIndent(v, "", "  ")
	if err != nil {
		return nil, fmt.Errorf("marshal result: %w", err)
	}
	return textResult(string(data)), nil
}

// errorResult creates an error ToolResult with the given message.
func errorResult(msg string) *mcp.ToolResult {
	return &mcp.ToolResult{
		Content: []mcp.ContentBlock{{Type: "text", Text: msg}},
		IsError: true,
	}
}

// mustSchema marshals a map to json.RawMessage, panicking on failure.
// Used at init time for tool input schemas.
func mustSchema(v interface{}) json.RawMessage {
	data, err := json.Marshal(v)
	if err != nil {
		panic(fmt.Sprintf("marshal schema: %v", err))
	}
	return data
}

// toolError is an alias for errorResult used by note handlers.
func toolError(msg string) *mcp.ToolResult {
	return errorResult(msg)
}

// toolSuccess creates a successful ToolResult from raw JSON bytes.
func toolSuccess(data json.RawMessage) *mcp.ToolResult {
	return textResult(string(data))
}

// floats32ToAny converts a []float32 to []interface{} for JSON embedding in Supabase payloads.
func floats32ToAny(fs []float32) []interface{} {
	out := make([]interface{}, len(fs))
	for i, f := range fs {
		out[i] = f
	}
	return out
}
