package mcp

// TextResult creates a successful ToolResult with a single text content block.
func TextResult(text string) *ToolResult {
	return &ToolResult{
		Content: []ContentBlock{
			{Type: "text", Text: text},
		},
	}
}

// ErrorResult creates a ToolResult that signals an error with a text message.
func ErrorResult(msg string) *ToolResult {
	return &ToolResult{
		Content: []ContentBlock{
			{Type: "text", Text: msg},
		},
		IsError: true,
	}
}
