package mcp

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
)

// ToolHandler is the function signature for tool implementations.
type ToolHandler func(ctx context.Context, params json.RawMessage) (*ToolResult, error)

type registeredTool struct {
	Tool    Tool
	Handler ToolHandler
}

// ToolRegistry manages the set of available MCP tools.
type ToolRegistry struct {
	mu    sync.RWMutex
	tools map[string]registeredTool
}

// NewToolRegistry creates a new empty tool registry.
func NewToolRegistry() *ToolRegistry {
	return &ToolRegistry{
		tools: make(map[string]registeredTool),
	}
}

// Register adds a new tool to the registry.
func (r *ToolRegistry) Register(name string, description string, schema json.RawMessage, handler ToolHandler) {
	r.mu.Lock()
	defer r.mu.Unlock()

	r.tools[name] = registeredTool{
		Tool: Tool{
			Name:        name,
			Description: description,
			InputSchema: schema,
		},
		Handler: handler,
	}
}

// List returns all registered tools.
func (r *ToolRegistry) List() []Tool {
	r.mu.RLock()
	defer r.mu.RUnlock()

	tools := make([]Tool, 0, len(r.tools))
	for _, rt := range r.tools {
		tools = append(tools, rt.Tool)
	}
	return tools
}

// Call invokes a registered tool by name with the given parameters.
func (r *ToolRegistry) Call(ctx context.Context, name string, params json.RawMessage) (*ToolResult, error) {
	r.mu.RLock()
	rt, ok := r.tools[name]
	r.mu.RUnlock()

	if !ok {
		return nil, fmt.Errorf("tool not found: %s", name)
	}

	return rt.Handler(ctx, params)
}
