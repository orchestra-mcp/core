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

var taskTransitionSchema = json.RawMessage(`{
	"type": "object",
	"properties": {
		"task_id":  {"type": "string", "format": "uuid", "description": "Task to transition"},
		"to_state": {"type": "string", "description": "Target state to move the task to"},
		"comment":  {"type": "string", "description": "Optional comment for the transition"},
		"override": {
			"type": "object",
			"description": "Override failed gates (requires sufficient authority)",
			"properties": {
				"gate_ids": {"type": "array", "items": {"type": "string", "format": "uuid"}, "description": "Gate IDs to override"},
				"reason":   {"type": "string", "description": "Reason for the override"}
			},
			"required": ["gate_ids", "reason"]
		}
	},
	"required": ["task_id", "to_state"]
}`)

var workflowApplySchema = json.RawMessage(`{
	"type": "object",
	"properties": {
		"workflow_id": {"type": "string", "format": "uuid", "description": "Workflow to apply"},
		"project_id":  {"type": "string", "format": "uuid", "description": "Project to apply the workflow to"}
	},
	"required": ["workflow_id", "project_id"]
}`)

var workflowUnapplySchema = json.RawMessage(`{
	"type": "object",
	"properties": {
		"project_id":  {"type": "string", "format": "uuid", "description": "Project to remove workflow from"},
		"workflow_id": {"type": "string", "format": "uuid", "description": "Specific workflow to deactivate (omit to deactivate all)"}
	},
	"required": ["project_id"]
}`)

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

// RegisterTransitionTools registers task_transition, workflow_apply, and
// workflow_unapply MCP tools.
func RegisterTransitionTools(registry *mcp.ToolRegistry, dbClient *db.Client) {
	registry.Register("task_transition", "Move a task between workflow states (enforces gates)", taskTransitionSchema, makeTaskTransition(dbClient))
	registry.Register("workflow_apply", "Apply a workflow to a project (activates gate enforcement)", workflowApplySchema, makeWorkflowApply(dbClient))
	registry.Register("workflow_unapply", "Deactivate a workflow on a project", workflowUnapplySchema, makeWorkflowUnapply(dbClient))
}

// ---------------------------------------------------------------------------
// task_transition handler
// ---------------------------------------------------------------------------

func makeTaskTransition(dbClient *db.Client) mcp.ToolHandler {
	return func(ctx context.Context, params json.RawMessage) (*mcp.ToolResult, error) {
		var input struct {
			TaskID  string `json:"task_id"`
			ToState string `json:"to_state"`
			Comment string `json:"comment"`
			Override *struct {
				GateIDs []string `json:"gate_ids"`
				Reason  string   `json:"reason"`
			} `json:"override"`
		}
		if err := json.Unmarshal(params, &input); err != nil {
			return mcp.ErrorResult("invalid params: " + err.Error()), nil
		}
		if input.TaskID == "" {
			return mcp.ErrorResult("task_id is required"), nil
		}
		if input.ToState == "" {
			return mcp.ErrorResult("to_state is required"), nil
		}

		userCtx := auth.UserContextFromContext(ctx)
		if userCtx == nil {
			return mcp.ErrorResult("authentication required"), nil
		}

		// Step 1: Fetch the task to get current status and project_id.
		taskQ := url.Values{}
		taskQ.Set("id", "eq."+input.TaskID)
		taskQ.Set("organization_id", "eq."+userCtx.OrgID)

		taskRaw, err := dbClient.GetSingle(ctx, "tasks", taskQ.Encode())
		if err != nil {
			return mcp.ErrorResult("failed to get task: " + err.Error()), nil
		}

		var task struct {
			ID            string `json:"id"`
			Status        string `json:"status"`
			ProjectID     string `json:"project_id"`
			WorkflowState string `json:"workflow_state"`
		}
		if err := json.Unmarshal(taskRaw, &task); err != nil {
			return mcp.ErrorResult("failed to parse task: " + err.Error()), nil
		}

		// Determine the from_state: prefer workflow_state, fall back to status.
		fromState := task.WorkflowState
		if fromState == "" {
			fromState = task.Status
		}

		// Same-state transition is a no-op.
		if fromState == input.ToState {
			return mcp.ErrorResult(fmt.Sprintf("task is already in state '%s'", fromState)), nil
		}

		// Step 2: Check if project has an active workflow_instance.
		hasWorkflow, workflowID, err := projectHasActiveWorkflow(ctx, dbClient, task.ProjectID, userCtx.OrgID)
		if err != nil {
			return mcp.ErrorResult("failed to check workflow: " + err.Error()), nil
		}

		// Step 3: If no active workflow, just update the task status directly.
		if !hasWorkflow {
			patch := map[string]interface{}{
				"status":     input.ToState,
				"updated_at": time.Now().UTC().Format(time.RFC3339),
			}
			patchQ := fmt.Sprintf("id=eq.%s&organization_id=eq.%s",
				url.QueryEscape(input.TaskID), url.QueryEscape(userCtx.OrgID))

			result, err := dbClient.Patch(ctx, "tasks", patchQ, patch)
			if err != nil {
				return mcp.ErrorResult("failed to update task status: " + err.Error()), nil
			}

			resp := map[string]interface{}{
				"task_id":        input.TaskID,
				"from_state":     fromState,
				"to_state":       input.ToState,
				"gates_evaluated": []interface{}{},
				"transitioned_at": time.Now().UTC().Format(time.RFC3339),
				"task":           json.RawMessage(result),
			}
			return marshalJSONResult(resp)
		}

		// Step 4: Active workflow — run gate check logic.
		gateResult, err := checkGatesForTransition(ctx, dbClient, input.TaskID, workflowID, fromState, input.ToState, userCtx.OrgID)
		if err != nil {
			return mcp.ErrorResult("failed to evaluate gates: " + err.Error()), nil
		}

		// Step 5: Handle overrides for failed gates.
		if !gateResult.CanTransition && input.Override != nil {
			overrideSet := make(map[string]bool)
			for _, gid := range input.Override.GateIDs {
				overrideSet[gid] = true
			}

			// Submit override evidence for each specified gate.
			for i, gr := range gateResult.Gates {
				if !gr.Satisfied && gr.IsRequired && overrideSet[gr.GateID] {
					overrideRow := map[string]interface{}{
						"organization_id":  userCtx.OrgID,
						"task_id":          input.TaskID,
						"gate_id":          gr.GateID,
						"evidence_type":    "override",
						"content":          json.RawMessage(fmt.Sprintf(`{"reason":%q}`, input.Override.Reason)),
						"submitted_by_user": userCtx.UserID,
						"is_override":      true,
						"override_reason":  input.Override.Reason,
					}
					_, err := dbClient.Post(ctx, "gate_evidence", overrideRow)
					if err != nil {
						return mcp.ErrorResult(fmt.Sprintf("failed to submit override for gate %s: %s", gr.GateID, err.Error())), nil
					}
					// Mark as satisfied after override.
					gateResult.Gates[i].Satisfied = true
				}
			}

			// Re-evaluate can_transition after overrides.
			gateResult.CanTransition = true
			for _, gr := range gateResult.Gates {
				if gr.IsRequired && !gr.Satisfied {
					gateResult.CanTransition = false
					break
				}
			}
		}

		// Step 6: If gates still not satisfied, return error with details.
		if !gateResult.CanTransition {
			failedGates := make([]gateCheckResult, 0)
			passedGates := make([]gateCheckResult, 0)
			for _, gr := range gateResult.Gates {
				if gr.IsRequired && !gr.Satisfied {
					failedGates = append(failedGates, gr)
				} else {
					passedGates = append(passedGates, gr)
				}
			}

			resp := map[string]interface{}{
				"error":        "gates_not_satisfied",
				"task_id":      input.TaskID,
				"from_state":   fromState,
				"to_state":     input.ToState,
				"failed_gates": failedGates,
				"passed_gates": passedGates,
			}
			data, _ := json.MarshalIndent(resp, "", "  ")
			return mcp.ErrorResult(string(data)), nil
		}

		// Step 7: All gates passed — update task state.
		patch := map[string]interface{}{
			"updated_at": time.Now().UTC().Format(time.RFC3339),
		}
		// When a workflow is active, update workflow_state (the DB trigger syncs status).
		patch["workflow_state"] = input.ToState
		// Also set status directly as a fallback in case the trigger is absent.
		patch["status"] = input.ToState

		patchQ := fmt.Sprintf("id=eq.%s&organization_id=eq.%s",
			url.QueryEscape(input.TaskID), url.QueryEscape(userCtx.OrgID))

		updatedTask, err := dbClient.Patch(ctx, "tasks", patchQ, patch)
		if err != nil {
			return mcp.ErrorResult("failed to update task state: " + err.Error()), nil
		}

		resp := map[string]interface{}{
			"task_id":         input.TaskID,
			"from_state":      fromState,
			"to_state":        input.ToState,
			"gates_evaluated": gateResult.Gates,
			"transitioned_at": time.Now().UTC().Format(time.RFC3339),
			"task":            json.RawMessage(updatedTask),
		}
		return marshalJSONResult(resp)
	}
}

// ---------------------------------------------------------------------------
// workflow_apply handler
// ---------------------------------------------------------------------------

func makeWorkflowApply(dbClient *db.Client) mcp.ToolHandler {
	return func(ctx context.Context, params json.RawMessage) (*mcp.ToolResult, error) {
		var input struct {
			WorkflowID string `json:"workflow_id"`
			ProjectID  string `json:"project_id"`
		}
		if err := json.Unmarshal(params, &input); err != nil {
			return mcp.ErrorResult("invalid params: " + err.Error()), nil
		}
		if input.WorkflowID == "" {
			return mcp.ErrorResult("workflow_id is required"), nil
		}
		if input.ProjectID == "" {
			return mcp.ErrorResult("project_id is required"), nil
		}

		userCtx := auth.UserContextFromContext(ctx)
		if userCtx == nil {
			return mcp.ErrorResult("authentication required"), nil
		}

		row := map[string]interface{}{
			"organization_id": userCtx.OrgID,
			"workflow_id":     input.WorkflowID,
			"project_id":     input.ProjectID,
			"is_active":      true,
			"applied_by":     userCtx.UserID,
			"applied_at":     time.Now().UTC().Format(time.RFC3339),
		}

		result, err := dbClient.Post(ctx, "workflow_instances", row)
		if err != nil {
			return mcp.ErrorResult("failed to apply workflow: " + err.Error()), nil
		}
		return mcp.TextResult(string(result)), nil
	}
}

// ---------------------------------------------------------------------------
// workflow_unapply handler
// ---------------------------------------------------------------------------

func makeWorkflowUnapply(dbClient *db.Client) mcp.ToolHandler {
	return func(ctx context.Context, params json.RawMessage) (*mcp.ToolResult, error) {
		var input struct {
			ProjectID  string `json:"project_id"`
			WorkflowID string `json:"workflow_id"`
		}
		if err := json.Unmarshal(params, &input); err != nil {
			return mcp.ErrorResult("invalid params: " + err.Error()), nil
		}
		if input.ProjectID == "" {
			return mcp.ErrorResult("project_id is required"), nil
		}

		userCtx := auth.UserContextFromContext(ctx)
		if userCtx == nil {
			return mcp.ErrorResult("authentication required"), nil
		}

		now := time.Now().UTC().Format(time.RFC3339)
		patch := map[string]interface{}{
			"is_active":      false,
			"deactivated_at": now,
		}

		// Build query: always scoped by project_id + organization_id.
		q := fmt.Sprintf("project_id=eq.%s&organization_id=eq.%s&is_active=eq.true",
			url.QueryEscape(input.ProjectID), url.QueryEscape(userCtx.OrgID))

		// If workflow_id is specified, scope to that specific workflow.
		if input.WorkflowID != "" {
			q += fmt.Sprintf("&workflow_id=eq.%s", url.QueryEscape(input.WorkflowID))
		}

		result, err := dbClient.Patch(ctx, "workflow_instances", q, patch)
		if err != nil {
			return mcp.ErrorResult("failed to deactivate workflow: " + err.Error()), nil
		}
		return mcp.TextResult(string(result)), nil
	}
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

// projectHasActiveWorkflow checks whether a project has an active workflow
// instance and returns the workflow_id if so. This is used by both
// task_transition and task_update (to block status changes on gated projects).
func projectHasActiveWorkflow(ctx context.Context, dbClient *db.Client, projectID, orgID string) (bool, string, error) {
	if projectID == "" {
		return false, "", nil
	}

	q := url.Values{}
	q.Set("project_id", "eq."+projectID)
	q.Set("is_active", "eq.true")
	q.Set("organization_id", "eq."+orgID)
	q.Set("select", "id,workflow_id")
	q.Set("limit", "1")

	raw, err := dbClient.Get(ctx, "workflow_instances", q.Encode())
	if err != nil {
		return false, "", err
	}

	var instances []struct {
		ID         string `json:"id"`
		WorkflowID string `json:"workflow_id"`
	}
	if err := json.Unmarshal(raw, &instances); err != nil {
		return false, "", err
	}

	if len(instances) == 0 {
		return false, "", nil
	}
	return true, instances[0].WorkflowID, nil
}

// checkGatesForTransition evaluates all gates for a given transition.
// This is the shared gate-check logic extracted from evidence.go's gate_check
// handler so that both gate_check (dry-run) and task_transition (enforcement)
// can use the same evaluation code.
func checkGatesForTransition(ctx context.Context, dbClient *db.Client, taskID, workflowID, fromState, toState, orgID string) (*gateCheckResponse, error) {
	// Load gates for this transition.
	gatesQ := url.Values{}
	gatesQ.Set("workflow_id", "eq."+workflowID)
	gatesQ.Set("from_state", "eq."+fromState)
	gatesQ.Set("to_state", "eq."+toState)
	gatesQ.Set("organization_id", "eq."+orgID)
	gatesQ.Set("order", "order.asc,created_at.asc")

	gatesRaw, err := dbClient.Get(ctx, "workflow_gates", gatesQ.Encode())
	if err != nil {
		return nil, fmt.Errorf("query workflow gates: %w", err)
	}

	var gates []gateInfo
	if err := json.Unmarshal(gatesRaw, &gates); err != nil {
		return nil, fmt.Errorf("parse workflow gates: %w", err)
	}

	// No gates for this transition — allow freely.
	if len(gates) == 0 {
		return &gateCheckResponse{CanTransition: true, Gates: []gateCheckResult{}}, nil
	}

	// Bulk-fetch evidence for this task scoped to these gates.
	gateIDs := make([]string, len(gates))
	for i, g := range gates {
		gateIDs[i] = g.ID
	}

	evidenceQ := url.Values{}
	evidenceQ.Set("task_id", "eq."+taskID)
	evidenceQ.Set("organization_id", "eq."+orgID)
	evidenceQ.Set("gate_id", "in.("+joinStrings(gateIDs, ",")+")")
	evidenceQ.Set("order", "submitted_at.desc")

	evidenceRaw, err := dbClient.Get(ctx, "gate_evidence", evidenceQ.Encode())
	if err != nil {
		return nil, fmt.Errorf("query gate evidence: %w", err)
	}

	var evidenceRecords []json.RawMessage
	if err := json.Unmarshal(evidenceRaw, &evidenceRecords); err != nil {
		return nil, fmt.Errorf("parse evidence: %w", err)
	}

	// Build maps for quick lookup.
	evidenceByGate := make(map[string][]json.RawMessage)
	evidenceParsed := make(map[string][]evidenceRecord)
	for _, raw := range evidenceRecords {
		var rec evidenceRecord
		if err := json.Unmarshal(raw, &rec); err != nil {
			continue
		}
		evidenceByGate[rec.GateID] = append(evidenceByGate[rec.GateID], raw)
		evidenceParsed[rec.GateID] = append(evidenceParsed[rec.GateID], rec)
	}

	// Lazy-load full task record for required_fields checks.
	var fullTask json.RawMessage
	var fullTaskMap map[string]interface{}
	loadFullTask := func() error {
		if fullTask != nil {
			return nil
		}
		ftQ := url.Values{}
		ftQ.Set("id", "eq."+taskID)
		ftQ.Set("organization_id", "eq."+orgID)
		var fetchErr error
		fullTask, fetchErr = dbClient.GetSingle(ctx, "tasks", ftQ.Encode())
		if fetchErr != nil {
			return fetchErr
		}
		fullTaskMap = make(map[string]interface{})
		return json.Unmarshal(fullTask, &fullTaskMap)
	}

	// Evaluate each gate.
	canTransition := true
	results := make([]gateCheckResult, 0, len(gates))

	for _, gate := range gates {
		satisfied := false
		gateEvidence := evidenceByGate[gate.ID]
		gateEvidenceJSON, _ := json.Marshal(gateEvidence)
		if gateEvidenceJSON == nil {
			gateEvidenceJSON = []byte("[]")
		}

		switch gate.GateType {
		case "required_fields":
			satisfied = evaluateRequiredFields(gate.Config, loadFullTask, fullTaskMap)
		case "evidence_upload":
			satisfied = evaluateEvidenceUpload(evidenceParsed[gate.ID])
		case "approval":
			satisfied = evaluateApproval(evidenceParsed[gate.ID])
		case "automated":
			satisfied = evaluateAutomated(evidenceParsed[gate.ID])
		case "manual":
			satisfied = evaluateManual(evidenceParsed[gate.ID])
		}

		// An override evidence also satisfies the gate.
		if !satisfied {
			for _, rec := range evidenceParsed[gate.ID] {
				if rec.IsOverride {
					satisfied = true
					break
				}
			}
		}

		if gate.IsRequired && !satisfied {
			canTransition = false
		}

		results = append(results, gateCheckResult{
			GateID:     gate.ID,
			Name:       gate.Name,
			GateType:   gate.GateType,
			IsRequired: gate.IsRequired,
			Satisfied:  satisfied,
			Evidence:   gateEvidenceJSON,
		})
	}

	return &gateCheckResponse{CanTransition: canTransition, Gates: results}, nil
}

// marshalJSONResult marshals an arbitrary value to indented JSON and returns
// it as a successful ToolResult.
func marshalJSONResult(v interface{}) (*mcp.ToolResult, error) {
	data, err := json.MarshalIndent(v, "", "  ")
	if err != nil {
		return mcp.ErrorResult("failed to marshal response: " + err.Error()), nil
	}
	return mcp.TextResult(string(data)), nil
}
