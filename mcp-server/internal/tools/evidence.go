package tools

import (
	"context"
	"encoding/json"
	"net/url"

	"github.com/orchestra-mcp/server/internal/auth"
	"github.com/orchestra-mcp/server/internal/db"
	"github.com/orchestra-mcp/server/internal/mcp"
)

// ---------------------------------------------------------------------------
// JSON Schemas
// ---------------------------------------------------------------------------

var evidenceSubmitSchema = json.RawMessage(`{
	"type": "object",
	"properties": {
		"task_id":       {"type": "string", "format": "uuid", "description": "Task this evidence is for"},
		"gate_id":       {"type": "string", "format": "uuid", "description": "Gate this evidence satisfies"},
		"evidence_type": {"type": "string", "description": "Type of evidence (e.g. upload, approval, manual_confirmation, automated_check)"},
		"content":       {"type": "object", "description": "Evidence payload (JSON)", "default": {}}
	},
	"required": ["task_id", "gate_id", "evidence_type"]
}`)

var evidenceListSchema = json.RawMessage(`{
	"type": "object",
	"properties": {
		"task_id": {"type": "string", "format": "uuid", "description": "Task to list evidence for"},
		"gate_id": {"type": "string", "format": "uuid", "description": "Optional gate filter"}
	},
	"required": ["task_id"]
}`)

var gateCheckSchema = json.RawMessage(`{
	"type": "object",
	"properties": {
		"task_id":    {"type": "string", "format": "uuid", "description": "Task to check gates for"},
		"from_state": {"type": "string", "description": "Current state of the task"},
		"to_state":   {"type": "string", "description": "Desired target state"}
	},
	"required": ["task_id", "from_state", "to_state"]
}`)

var gateOverrideSchema = json.RawMessage(`{
	"type": "object",
	"properties": {
		"task_id":         {"type": "string", "format": "uuid", "description": "Task to override gate for"},
		"gate_id":         {"type": "string", "format": "uuid", "description": "Gate to override"},
		"override_reason": {"type": "string", "description": "Reason for overriding this gate"}
	},
	"required": ["task_id", "gate_id", "override_reason"]
}`)

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

// RegisterEvidenceTools registers evidence submission, listing, gate checking,
// and gate override MCP tools.
func RegisterEvidenceTools(registry *mcp.ToolRegistry, dbClient *db.Client) {
	registry.Register("evidence_submit", "Submit evidence for a workflow gate", evidenceSubmitSchema, makeEvidenceSubmit(dbClient))
	registry.Register("evidence_list", "List evidence for a task (optionally filtered by gate)", evidenceListSchema, makeEvidenceList(dbClient))
	registry.Register("gate_check", "Check if a task can transition between states (evaluates all gates)", gateCheckSchema, makeGateCheck(dbClient))
	registry.Register("gate_override", "Override a workflow gate with a documented reason", gateOverrideSchema, makeGateOverride(dbClient))
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

// makeEvidenceSubmit creates an evidence record in gate_evidence.
// gate_evidence is immutable — INSERT only, no UPDATE/DELETE.
func makeEvidenceSubmit(dbClient *db.Client) mcp.ToolHandler {
	return func(ctx context.Context, params json.RawMessage) (*mcp.ToolResult, error) {
		var input struct {
			TaskID       string          `json:"task_id"`
			GateID       string          `json:"gate_id"`
			EvidenceType string          `json:"evidence_type"`
			Content      json.RawMessage `json:"content"`
		}
		if err := json.Unmarshal(params, &input); err != nil {
			return mcp.ErrorResult("invalid params: " + err.Error()), nil
		}
		if input.TaskID == "" {
			return mcp.ErrorResult("task_id is required"), nil
		}
		if input.GateID == "" {
			return mcp.ErrorResult("gate_id is required"), nil
		}
		if input.EvidenceType == "" {
			return mcp.ErrorResult("evidence_type is required"), nil
		}

		userCtx := auth.UserContextFromContext(ctx)
		if userCtx == nil {
			return mcp.ErrorResult("authentication required"), nil
		}

		row := map[string]interface{}{
			"organization_id":  userCtx.OrgID,
			"task_id":          input.TaskID,
			"gate_id":          input.GateID,
			"evidence_type":    input.EvidenceType,
			"submitted_by_user": userCtx.UserID,
		}
		if input.Content != nil && string(input.Content) != "null" {
			row["content"] = input.Content
		} else {
			row["content"] = json.RawMessage(`{}`)
		}

		result, err := dbClient.Post(ctx, "gate_evidence", row)
		if err != nil {
			return mcp.ErrorResult("failed to submit evidence: " + err.Error()), nil
		}
		return mcp.TextResult(string(result)), nil
	}
}

// makeEvidenceList lists evidence records for a task, optionally filtered by gate.
func makeEvidenceList(dbClient *db.Client) mcp.ToolHandler {
	return func(ctx context.Context, params json.RawMessage) (*mcp.ToolResult, error) {
		var input struct {
			TaskID string `json:"task_id"`
			GateID string `json:"gate_id"`
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

		q := url.Values{}
		q.Set("organization_id", "eq."+userCtx.OrgID)
		q.Set("task_id", "eq."+input.TaskID)
		q.Set("order", "submitted_at.desc")

		if input.GateID != "" {
			q.Set("gate_id", "eq."+input.GateID)
		}

		result, err := dbClient.Get(ctx, "gate_evidence", q.Encode())
		if err != nil {
			return mcp.ErrorResult("failed to list evidence: " + err.Error()), nil
		}
		return mcp.TextResult(string(result)), nil
	}
}

// ---------------------------------------------------------------------------
// gate_check — core enforcement logic
// ---------------------------------------------------------------------------

// gateInfo holds a gate record from workflow_gates.
type gateInfo struct {
	ID         string          `json:"id"`
	Name       string          `json:"name"`
	GateType   string          `json:"gate_type"`
	IsRequired bool            `json:"is_required"`
	Config     json.RawMessage `json:"config"`
	Order      int             `json:"order"`
}

// gateCheckResult is the per-gate evaluation returned by gate_check.
type gateCheckResult struct {
	GateID     string          `json:"gate_id"`
	Name       string          `json:"name"`
	GateType   string          `json:"gate_type"`
	IsRequired bool            `json:"is_required"`
	Satisfied  bool            `json:"satisfied"`
	Evidence   json.RawMessage `json:"evidence"`
}

// gateCheckResponse is the top-level response from gate_check.
type gateCheckResponse struct {
	CanTransition bool              `json:"can_transition"`
	Gates         []gateCheckResult `json:"gates"`
}

func makeGateCheck(dbClient *db.Client) mcp.ToolHandler {
	return func(ctx context.Context, params json.RawMessage) (*mcp.ToolResult, error) {
		var input struct {
			TaskID    string `json:"task_id"`
			FromState string `json:"from_state"`
			ToState   string `json:"to_state"`
		}
		if err := json.Unmarshal(params, &input); err != nil {
			return mcp.ErrorResult("invalid params: " + err.Error()), nil
		}
		if input.TaskID == "" {
			return mcp.ErrorResult("task_id is required"), nil
		}
		if input.FromState == "" {
			return mcp.ErrorResult("from_state is required"), nil
		}
		if input.ToState == "" {
			return mcp.ErrorResult("to_state is required"), nil
		}

		userCtx := auth.UserContextFromContext(ctx)
		if userCtx == nil {
			return mcp.ErrorResult("authentication required"), nil
		}

		// Step 1: Get the task to find its project_id.
		taskQ := url.Values{}
		taskQ.Set("id", "eq."+input.TaskID)
		taskQ.Set("organization_id", "eq."+userCtx.OrgID)
		taskQ.Set("select", "id,project_id")

		taskRaw, err := dbClient.GetSingle(ctx, "tasks", taskQ.Encode())
		if err != nil {
			return mcp.ErrorResult("failed to get task: " + err.Error()), nil
		}

		var task struct {
			ID        string `json:"id"`
			ProjectID string `json:"project_id"`
		}
		if err := json.Unmarshal(taskRaw, &task); err != nil {
			return mcp.ErrorResult("failed to parse task: " + err.Error()), nil
		}
		if task.ProjectID == "" {
			// Task has no project — no workflow can be active.
			resp := gateCheckResponse{CanTransition: true, Gates: []gateCheckResult{}}
			return marshalGateCheckResponse(resp)
		}

		// Step 2: Check if project has an active workflow_instance.
		hasWorkflow, workflowID, err := projectHasActiveWorkflow(ctx, dbClient, task.ProjectID, userCtx.OrgID)
		if err != nil {
			return mcp.ErrorResult("failed to check workflow: " + err.Error()), nil
		}

		// If no active workflow, transition is allowed freely.
		if !hasWorkflow {
			resp := gateCheckResponse{CanTransition: true, Gates: []gateCheckResult{}}
			return marshalGateCheckResponse(resp)
		}

		// Step 3: Delegate to the shared gate evaluation logic.
		resp, err := checkGatesForTransition(ctx, dbClient, input.TaskID, workflowID, input.FromState, input.ToState, userCtx.OrgID)
		if err != nil {
			return mcp.ErrorResult("failed to evaluate gates: " + err.Error()), nil
		}
		return marshalGateCheckResponse(*resp)
	}
}

// ---------------------------------------------------------------------------
// Gate type evaluators
// ---------------------------------------------------------------------------

// evaluateRequiredFields checks that all fields listed in config.fields
// are non-null (and non-empty for text fields) on the task record.
func evaluateRequiredFields(config json.RawMessage, loadTask func() error, taskMap map[string]interface{}) bool {
	var cfg struct {
		Fields []string `json:"fields"`
	}
	if err := json.Unmarshal(config, &cfg); err != nil || len(cfg.Fields) == 0 {
		return false
	}
	if err := loadTask(); err != nil {
		return false
	}

	textFields := map[string]bool{
		"title": true, "description": true, "body": true,
	}

	for _, field := range cfg.Fields {
		val, exists := taskMap[field]
		if !exists || val == nil {
			return false
		}
		// For text fields, additionally check that the trimmed value is non-empty.
		if textFields[field] {
			str, ok := val.(string)
			if !ok || len(str) == 0 {
				return false
			}
		}
	}
	return true
}

// evaluateEvidenceUpload checks that at least one evidence record with
// evidence_type="upload" exists for this gate+task.
func evaluateEvidenceUpload(records []evidenceRecord) bool {
	for _, rec := range records {
		if rec.EvidenceType == "upload" {
			return true
		}
	}
	return false
}

// evaluateApproval checks that at least one evidence record with
// evidence_type="approval" exists for this gate+task.
func evaluateApproval(records []evidenceRecord) bool {
	for _, rec := range records {
		if rec.EvidenceType == "approval" {
			return true
		}
	}
	return false
}

// evaluateAutomated checks that at least one evidence record with
// evidence_type="automated_check" exists for this gate+task.
func evaluateAutomated(records []evidenceRecord) bool {
	for _, rec := range records {
		if rec.EvidenceType == "automated_check" {
			return true
		}
	}
	return false
}

// evaluateManual checks that at least one evidence record with
// evidence_type="manual_confirmation" exists for this gate+task.
func evaluateManual(records []evidenceRecord) bool {
	for _, rec := range records {
		if rec.EvidenceType == "manual_confirmation" {
			return true
		}
	}
	return false
}

// ---------------------------------------------------------------------------
// gate_override
// ---------------------------------------------------------------------------

// makeGateOverride creates an override evidence record for a gate.
func makeGateOverride(dbClient *db.Client) mcp.ToolHandler {
	return func(ctx context.Context, params json.RawMessage) (*mcp.ToolResult, error) {
		var input struct {
			TaskID         string `json:"task_id"`
			GateID         string `json:"gate_id"`
			OverrideReason string `json:"override_reason"`
		}
		if err := json.Unmarshal(params, &input); err != nil {
			return mcp.ErrorResult("invalid params: " + err.Error()), nil
		}
		if input.TaskID == "" {
			return mcp.ErrorResult("task_id is required"), nil
		}
		if input.GateID == "" {
			return mcp.ErrorResult("gate_id is required"), nil
		}
		if input.OverrideReason == "" {
			return mcp.ErrorResult("override_reason is required"), nil
		}

		userCtx := auth.UserContextFromContext(ctx)
		if userCtx == nil {
			return mcp.ErrorResult("authentication required"), nil
		}

		row := map[string]interface{}{
			"organization_id":  userCtx.OrgID,
			"task_id":          input.TaskID,
			"gate_id":          input.GateID,
			"evidence_type":    "override",
			"content":          json.RawMessage(`{}`),
			"submitted_by_user": userCtx.UserID,
			"is_override":      true,
			"override_reason":  input.OverrideReason,
		}

		result, err := dbClient.Post(ctx, "gate_evidence", row)
		if err != nil {
			return mcp.ErrorResult("failed to create override: " + err.Error()), nil
		}
		return mcp.TextResult(string(result)), nil
	}
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// marshalGateCheckResponse marshals the gate check response to a ToolResult.
func marshalGateCheckResponse(resp gateCheckResponse) (*mcp.ToolResult, error) {
	data, err := json.MarshalIndent(resp, "", "  ")
	if err != nil {
		return mcp.ErrorResult("failed to marshal response: " + err.Error()), nil
	}
	return mcp.TextResult(string(data)), nil
}

// joinStrings joins a string slice with a separator.
func joinStrings(strs []string, sep string) string {
	result := ""
	for i, s := range strs {
		if i > 0 {
			result += sep
		}
		result += s
	}
	return result
}

// evidenceRecord is a minimal struct for parsed evidence used by gate evaluators.
// Defined at package level so the evaluate* functions can reference it.
type evidenceRecord struct {
	GateID       string `json:"gate_id"`
	EvidenceType string `json:"evidence_type"`
	IsOverride   bool   `json:"is_override"`
}
