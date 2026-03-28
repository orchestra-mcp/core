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

var gateCreateSchema = json.RawMessage(`{
	"type": "object",
	"properties": {
		"workflow_id": {"type": "string", "format": "uuid", "description": "Workflow this gate belongs to"},
		"from_state":  {"type": "string", "description": "Source state of the transition"},
		"to_state":    {"type": "string", "description": "Target state of the transition"},
		"name":        {"type": "string", "description": "Human-readable gate name"},
		"gate_type":   {"type": "string", "enum": ["required_fields", "evidence_upload", "approval", "automated", "manual"], "description": "Type of gate check"},
		"config":      {"type": "object", "description": "Gate-type-specific configuration (JSON)"},
		"is_required": {"type": "boolean", "default": true, "description": "Whether this gate blocks the transition (false = advisory only)"},
		"order":       {"type": "integer", "default": 0, "description": "Evaluation order within the transition (ascending)"}
	},
	"required": ["workflow_id", "from_state", "to_state", "name", "gate_type"]
}`)

var gateListSchema = json.RawMessage(`{
	"type": "object",
	"properties": {
		"workflow_id": {"type": "string", "format": "uuid", "description": "Workflow to list gates for"},
		"from_state":  {"type": "string", "description": "Filter by source state"},
		"to_state":    {"type": "string", "description": "Filter by target state"}
	},
	"required": ["workflow_id"]
}`)

var gateUpdateSchema = json.RawMessage(`{
	"type": "object",
	"properties": {
		"id":          {"type": "string", "format": "uuid", "description": "Gate UUID"},
		"name":        {"type": "string", "description": "Updated gate name"},
		"gate_type":   {"type": "string", "enum": ["required_fields", "evidence_upload", "approval", "automated", "manual"], "description": "Updated gate type"},
		"config":      {"type": "object", "description": "Updated gate configuration (JSON)"},
		"is_required": {"type": "boolean", "description": "Updated required flag"},
		"order":       {"type": "integer", "description": "Updated evaluation order"}
	},
	"required": ["id"]
}`)

var gateDeleteSchema = json.RawMessage(`{
	"type": "object",
	"properties": {
		"id": {"type": "string", "format": "uuid", "description": "Gate UUID to delete"}
	},
	"required": ["id"]
}`)

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

// RegisterGateTools registers all workflow-gate CRUD MCP tools.
func RegisterGateTools(registry *mcp.ToolRegistry, dbClient *db.Client) {
	registry.Register("gate_create", "Create a workflow gate on a state transition", gateCreateSchema, makeGateCreate(dbClient))
	registry.Register("gate_list", "List workflow gates (optionally filtered by transition)", gateListSchema, makeGateList(dbClient))
	registry.Register("gate_update", "Update a workflow gate", gateUpdateSchema, makeGateUpdate(dbClient))
	registry.Register("gate_delete", "Delete a workflow gate", gateDeleteSchema, makeGateDelete(dbClient))
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

func makeGateCreate(dbClient *db.Client) mcp.ToolHandler {
	return func(ctx context.Context, params json.RawMessage) (*mcp.ToolResult, error) {
		var input struct {
			WorkflowID string          `json:"workflow_id"`
			FromState  string          `json:"from_state"`
			ToState    string          `json:"to_state"`
			Name       string          `json:"name"`
			GateType   string          `json:"gate_type"`
			Config     json.RawMessage `json:"config"`
			IsRequired *bool           `json:"is_required"`
			Order      *int            `json:"order"`
		}
		if err := json.Unmarshal(params, &input); err != nil {
			return mcp.ErrorResult("invalid params: " + err.Error()), nil
		}
		if input.WorkflowID == "" {
			return mcp.ErrorResult("workflow_id is required"), nil
		}
		if input.FromState == "" {
			return mcp.ErrorResult("from_state is required"), nil
		}
		if input.ToState == "" {
			return mcp.ErrorResult("to_state is required"), nil
		}
		if input.Name == "" {
			return mcp.ErrorResult("name is required"), nil
		}
		if input.GateType == "" {
			return mcp.ErrorResult("gate_type is required"), nil
		}

		// Validate gate_type enum.
		validTypes := map[string]bool{
			"required_fields": true,
			"evidence_upload": true,
			"approval":        true,
			"automated":       true,
			"manual":          true,
		}
		if !validTypes[input.GateType] {
			return mcp.ErrorResult("gate_type must be one of: required_fields, evidence_upload, approval, automated, manual"), nil
		}

		userCtx := auth.UserContextFromContext(ctx)
		if userCtx == nil {
			return mcp.ErrorResult("authentication required"), nil
		}

		row := map[string]interface{}{
			"organization_id": userCtx.OrgID,
			"workflow_id":     input.WorkflowID,
			"from_state":      input.FromState,
			"to_state":        input.ToState,
			"name":            input.Name,
			"gate_type":       input.GateType,
			"created_at":      time.Now().UTC().Format(time.RFC3339),
		}
		if input.Config != nil {
			row["config"] = input.Config
		}
		if input.IsRequired != nil {
			row["is_required"] = *input.IsRequired
		}
		if input.Order != nil {
			row["order"] = *input.Order
		}

		result, err := dbClient.Post(ctx, "workflow_gates", row)
		if err != nil {
			return mcp.ErrorResult("failed to create gate: " + err.Error()), nil
		}
		return mcp.TextResult(string(result)), nil
	}
}

func makeGateList(dbClient *db.Client) mcp.ToolHandler {
	return func(ctx context.Context, params json.RawMessage) (*mcp.ToolResult, error) {
		var input struct {
			WorkflowID string `json:"workflow_id"`
			FromState  string `json:"from_state"`
			ToState    string `json:"to_state"`
		}
		if err := json.Unmarshal(params, &input); err != nil {
			return mcp.ErrorResult("invalid params: " + err.Error()), nil
		}
		if input.WorkflowID == "" {
			return mcp.ErrorResult("workflow_id is required"), nil
		}

		userCtx := auth.UserContextFromContext(ctx)
		if userCtx == nil {
			return mcp.ErrorResult("authentication required"), nil
		}

		q := url.Values{}
		q.Set("organization_id", "eq."+userCtx.OrgID)
		q.Set("workflow_id", "eq."+input.WorkflowID)
		// "order" is a reserved word in PostgREST column names, but the
		// PostgREST order parameter uses the syntax: order=<column>.<direction>.
		// To sort by the "order" column we just reference it directly —
		// PostgREST handles the quoting automatically for column names in
		// the order parameter.
		q.Set("order", "order.asc,created_at.asc")

		if input.FromState != "" {
			q.Set("from_state", "eq."+input.FromState)
		}
		if input.ToState != "" {
			q.Set("to_state", "eq."+input.ToState)
		}

		result, err := dbClient.Get(ctx, "workflow_gates", q.Encode())
		if err != nil {
			return mcp.ErrorResult("failed to list gates: " + err.Error()), nil
		}
		return mcp.TextResult(string(result)), nil
	}
}

func makeGateUpdate(dbClient *db.Client) mcp.ToolHandler {
	return func(ctx context.Context, params json.RawMessage) (*mcp.ToolResult, error) {
		var input struct {
			ID         string          `json:"id"`
			Name       *string         `json:"name"`
			GateType   *string         `json:"gate_type"`
			Config     json.RawMessage `json:"config"`
			IsRequired *bool           `json:"is_required"`
			Order      *int            `json:"order"`
		}
		if err := json.Unmarshal(params, &input); err != nil {
			return mcp.ErrorResult("invalid params: " + err.Error()), nil
		}
		if input.ID == "" {
			return mcp.ErrorResult("id is required"), nil
		}

		// Validate gate_type enum if provided.
		if input.GateType != nil {
			validTypes := map[string]bool{
				"required_fields": true,
				"evidence_upload": true,
				"approval":        true,
				"automated":       true,
				"manual":          true,
			}
			if !validTypes[*input.GateType] {
				return mcp.ErrorResult("gate_type must be one of: required_fields, evidence_upload, approval, automated, manual"), nil
			}
		}

		userCtx := auth.UserContextFromContext(ctx)
		if userCtx == nil {
			return mcp.ErrorResult("authentication required"), nil
		}

		patch := map[string]interface{}{
			"updated_at": time.Now().UTC().Format(time.RFC3339),
		}
		setIfPtr(patch, "name", input.Name)
		setIfPtr(patch, "gate_type", input.GateType)
		if input.Config != nil {
			patch["config"] = input.Config
		}
		if input.IsRequired != nil {
			patch["is_required"] = *input.IsRequired
		}
		if input.Order != nil {
			patch["order"] = *input.Order
		}

		q := fmt.Sprintf("id=eq.%s&organization_id=eq.%s", url.QueryEscape(input.ID), url.QueryEscape(userCtx.OrgID))
		result, err := dbClient.Patch(ctx, "workflow_gates", q, patch)
		if err != nil {
			return mcp.ErrorResult("failed to update gate: " + err.Error()), nil
		}
		return mcp.TextResult(string(result)), nil
	}
}

func makeGateDelete(dbClient *db.Client) mcp.ToolHandler {
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

		q := fmt.Sprintf("id=eq.%s&organization_id=eq.%s", url.QueryEscape(input.ID), url.QueryEscape(userCtx.OrgID))
		_, err := dbClient.Delete(ctx, "workflow_gates", q)
		if err != nil {
			return mcp.ErrorResult("failed to delete gate: " + err.Error()), nil
		}
		return mcp.TextResult("Gate deleted successfully."), nil
	}
}
