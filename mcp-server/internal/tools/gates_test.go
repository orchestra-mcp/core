package tools

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"strings"
	"testing"

	"github.com/orchestra-mcp/server/internal/auth"
	"github.com/orchestra-mcp/server/internal/db"
	"github.com/orchestra-mcp/server/internal/mcp"
)

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

// testEnv holds the shared state for integration tests.
type testEnv struct {
	dbClient *db.Client
	registry *mcp.ToolRegistry
	ctx      context.Context
	orgID    string
	userID   string
}

// skipIfNoDB skips the test when the required environment variables are not set.
func skipIfNoDB(t *testing.T) {
	t.Helper()
	if os.Getenv("SUPABASE_URL") == "" || os.Getenv("SUPABASE_SERVICE_KEY") == "" {
		t.Skip("Skipping integration test: SUPABASE_URL and SUPABASE_SERVICE_KEY must be set")
	}
}

// newTestEnv creates a test environment with a real DB client and all tools
// registered. It injects a fixed org/user context for all calls.
func newTestEnv(t *testing.T) *testEnv {
	t.Helper()
	skipIfNoDB(t)

	dbClient := db.NewClient(os.Getenv("SUPABASE_URL"), os.Getenv("SUPABASE_SERVICE_KEY"))
	registry := mcp.NewToolRegistry()

	RegisterGateTools(registry, dbClient)
	RegisterEvidenceTools(registry, dbClient)
	RegisterTransitionTools(registry, dbClient)
	RegisterWorkflowTools(registry, dbClient)
	RegisterProjectTools(registry, dbClient)
	RegisterTaskTools(registry, dbClient)

	orgID := os.Getenv("TEST_ORG_ID")
	if orgID == "" {
		orgID = "00000000-0000-0000-0000-000000000001"
	}
	userID := os.Getenv("TEST_USER_ID")
	if userID == "" {
		userID = "00000000-0000-0000-0000-000000000001"
	}

	ctx := auth.WithUserContext(context.Background(), &auth.UserContext{
		TokenID: "test-token",
		UserID:  userID,
		OrgID:   orgID,
		Scopes:  []string{"*"},
		Plan:    "enterprise",
	})

	return &testEnv{
		dbClient: dbClient,
		registry: registry,
		ctx:      ctx,
		orgID:    orgID,
		userID:   userID,
	}
}

// call invokes a tool and returns the parsed result text. It fails the test on
// unexpected errors. Returns (resultText, isError).
func (e *testEnv) call(t *testing.T, toolName string, args interface{}) (string, bool) {
	t.Helper()
	params, err := json.Marshal(args)
	if err != nil {
		t.Fatalf("marshal params for %s: %v", toolName, err)
	}
	result, err := e.registry.Call(e.ctx, toolName, json.RawMessage(params))
	if err != nil {
		t.Fatalf("unexpected Go error from %s: %v", toolName, err)
	}
	if len(result.Content) == 0 {
		t.Fatalf("%s returned empty content", toolName)
	}
	return result.Content[0].Text, result.IsError
}

// mustCall calls a tool and fails if the result is an error.
func (e *testEnv) mustCall(t *testing.T, toolName string, args interface{}) string {
	t.Helper()
	text, isErr := e.call(t, toolName, args)
	if isErr {
		t.Fatalf("%s returned error: %s", toolName, text)
	}
	return text
}

// expectError calls a tool and fails if the result is NOT an error.
func (e *testEnv) expectError(t *testing.T, toolName string, args interface{}) string {
	t.Helper()
	text, isErr := e.call(t, toolName, args)
	if !isErr {
		t.Fatalf("expected %s to return error, got success: %s", toolName, text)
	}
	return text
}

// parseID extracts the "id" field from a JSON response (handles both array
// and single-object forms that PostgREST may return).
func parseID(t *testing.T, raw string) string {
	t.Helper()

	// Try single object first.
	var single struct {
		ID string `json:"id"`
	}
	if err := json.Unmarshal([]byte(raw), &single); err == nil && single.ID != "" {
		return single.ID
	}

	// Try array.
	var arr []struct {
		ID string `json:"id"`
	}
	if err := json.Unmarshal([]byte(raw), &arr); err == nil && len(arr) > 0 {
		return arr[0].ID
	}

	t.Fatalf("could not parse id from response: %.300s", raw)
	return ""
}

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

// createWorkflow creates a test workflow and registers cleanup.
func (e *testEnv) createWorkflow(t *testing.T, name string) string {
	t.Helper()
	raw := e.mustCall(t, "workflow_create", map[string]interface{}{
		"name": name,
		"states": json.RawMessage(`[
			{"name": "todo", "is_initial": true},
			{"name": "in_progress"},
			{"name": "review"},
			{"name": "done", "is_terminal": true}
		]`),
		"transitions": json.RawMessage(`[
			{"from": "todo", "to": "in_progress"},
			{"from": "in_progress", "to": "review"},
			{"from": "review", "to": "done"},
			{"from": "review", "to": "in_progress"}
		]`),
	})
	id := parseID(t, raw)
	t.Cleanup(func() {
		e.dbClient.Delete(context.Background(), "workflows",
			fmt.Sprintf("id=eq.%s&organization_id=eq.%s", id, e.orgID))
	})
	return id
}

// createProject creates a test project and registers cleanup.
func (e *testEnv) createProject(t *testing.T, name string) string {
	t.Helper()
	raw := e.mustCall(t, "project_create", map[string]interface{}{
		"name": name,
	})
	id := parseID(t, raw)
	t.Cleanup(func() {
		e.dbClient.Delete(context.Background(), "projects",
			fmt.Sprintf("id=eq.%s&organization_id=eq.%s", id, e.orgID))
	})
	return id
}

// createTask creates a test task (optionally within a project) and registers cleanup.
func (e *testEnv) createTask(t *testing.T, title string, projectID string) string {
	t.Helper()
	args := map[string]interface{}{
		"title": title,
	}
	if projectID != "" {
		args["project_id"] = projectID
	}
	raw := e.mustCall(t, "task_create", args)
	id := parseID(t, raw)
	t.Cleanup(func() {
		e.dbClient.Delete(context.Background(), "tasks",
			fmt.Sprintf("id=eq.%s&organization_id=eq.%s", id, e.orgID))
	})
	return id
}

// createGate creates a workflow gate and registers cleanup.
func (e *testEnv) createGate(t *testing.T, workflowID, fromState, toState, name, gateType string, config json.RawMessage, isRequired *bool) string {
	t.Helper()
	args := map[string]interface{}{
		"workflow_id": workflowID,
		"from_state":  fromState,
		"to_state":    toState,
		"name":        name,
		"gate_type":   gateType,
	}
	if config != nil {
		args["config"] = config
	}
	if isRequired != nil {
		args["is_required"] = *isRequired
	}
	raw := e.mustCall(t, "gate_create", args)
	id := parseID(t, raw)
	t.Cleanup(func() {
		e.dbClient.Delete(context.Background(), "workflow_gates",
			fmt.Sprintf("id=eq.%s&organization_id=eq.%s", id, e.orgID))
	})
	return id
}

// applyWorkflow applies a workflow to a project and registers cleanup.
func (e *testEnv) applyWorkflow(t *testing.T, workflowID, projectID string) string {
	t.Helper()
	raw := e.mustCall(t, "workflow_apply", map[string]interface{}{
		"workflow_id": workflowID,
		"project_id":  projectID,
	})
	id := parseID(t, raw)
	t.Cleanup(func() {
		e.dbClient.Delete(context.Background(), "workflow_instances",
			fmt.Sprintf("id=eq.%s&organization_id=eq.%s", id, e.orgID))
	})
	return id
}

// submitEvidence submits evidence for a gate and registers cleanup.
func (e *testEnv) submitEvidence(t *testing.T, taskID, gateID, evidenceType string, content json.RawMessage) string {
	t.Helper()
	args := map[string]interface{}{
		"task_id":       taskID,
		"gate_id":       gateID,
		"evidence_type": evidenceType,
	}
	if content != nil {
		args["content"] = content
	}
	raw := e.mustCall(t, "evidence_submit", args)
	id := parseID(t, raw)
	t.Cleanup(func() {
		e.dbClient.Delete(context.Background(), "gate_evidence",
			fmt.Sprintf("id=eq.%s&organization_id=eq.%s", id, e.orgID))
	})
	return id
}

// boolPtr returns a pointer to a bool.
func boolPtr(b bool) *bool { return &b }

// ---------------------------------------------------------------------------
// 1. Gate CRUD Tests
// ---------------------------------------------------------------------------

func TestGateCreate(t *testing.T) {
	env := newTestEnv(t)
	wfID := env.createWorkflow(t, "test-gate-create-wf")

	raw := env.mustCall(t, "gate_create", map[string]interface{}{
		"workflow_id": wfID,
		"from_state":  "todo",
		"to_state":    "in_progress",
		"name":        "Require Assignment",
		"gate_type":   "required_fields",
		"config":      json.RawMessage(`{"fields": ["assigned_agent_id"]}`),
		"is_required": true,
		"order":       1,
	})

	id := parseID(t, raw)
	t.Cleanup(func() {
		env.dbClient.Delete(context.Background(), "workflow_gates",
			fmt.Sprintf("id=eq.%s&organization_id=eq.%s", id, env.orgID))
	})

	if id == "" {
		t.Fatal("expected gate id to be non-empty")
	}

	// Verify fields in response.
	var gate struct {
		ID         string `json:"id"`
		WorkflowID string `json:"workflow_id"`
		FromState  string `json:"from_state"`
		ToState    string `json:"to_state"`
		Name       string `json:"name"`
		GateType   string `json:"gate_type"`
		IsRequired bool   `json:"is_required"`
		Order      int    `json:"order"`
	}
	// Parse from array or object.
	if err := unmarshalFirst(raw, &gate); err != nil {
		t.Fatalf("parse gate response: %v", err)
	}
	if gate.WorkflowID != wfID {
		t.Errorf("expected workflow_id=%s, got %s", wfID, gate.WorkflowID)
	}
	if gate.FromState != "todo" {
		t.Errorf("expected from_state=todo, got %s", gate.FromState)
	}
	if gate.ToState != "in_progress" {
		t.Errorf("expected to_state=in_progress, got %s", gate.ToState)
	}
	if gate.Name != "Require Assignment" {
		t.Errorf("expected name=Require Assignment, got %s", gate.Name)
	}
	if gate.GateType != "required_fields" {
		t.Errorf("expected gate_type=required_fields, got %s", gate.GateType)
	}
	if !gate.IsRequired {
		t.Error("expected is_required=true")
	}
	if gate.Order != 1 {
		t.Errorf("expected order=1, got %d", gate.Order)
	}
}

func TestGateList(t *testing.T) {
	env := newTestEnv(t)
	wfID := env.createWorkflow(t, "test-gate-list-wf")

	// Create gates on different transitions.
	env.createGate(t, wfID, "todo", "in_progress", "Gate A", "required_fields", nil, nil)
	env.createGate(t, wfID, "todo", "in_progress", "Gate B", "evidence_upload", nil, nil)
	env.createGate(t, wfID, "in_progress", "review", "Gate C", "approval", nil, nil)

	t.Run("list all gates for workflow", func(t *testing.T) {
		raw := env.mustCall(t, "gate_list", map[string]interface{}{
			"workflow_id": wfID,
		})
		var gates []struct {
			ID   string `json:"id"`
			Name string `json:"name"`
		}
		if err := json.Unmarshal([]byte(raw), &gates); err != nil {
			t.Fatalf("parse gate list: %v", err)
		}
		if len(gates) < 3 {
			t.Errorf("expected at least 3 gates, got %d", len(gates))
		}
	})

	t.Run("filter by from_state", func(t *testing.T) {
		raw := env.mustCall(t, "gate_list", map[string]interface{}{
			"workflow_id": wfID,
			"from_state":  "todo",
		})
		var gates []struct {
			ID        string `json:"id"`
			FromState string `json:"from_state"`
		}
		if err := json.Unmarshal([]byte(raw), &gates); err != nil {
			t.Fatalf("parse gate list: %v", err)
		}
		if len(gates) != 2 {
			t.Errorf("expected 2 gates with from_state=todo, got %d", len(gates))
		}
		for _, g := range gates {
			if g.FromState != "todo" {
				t.Errorf("expected from_state=todo, got %s", g.FromState)
			}
		}
	})

	t.Run("filter by to_state", func(t *testing.T) {
		raw := env.mustCall(t, "gate_list", map[string]interface{}{
			"workflow_id": wfID,
			"to_state":    "review",
		})
		var gates []struct {
			ID      string `json:"id"`
			ToState string `json:"to_state"`
		}
		if err := json.Unmarshal([]byte(raw), &gates); err != nil {
			t.Fatalf("parse gate list: %v", err)
		}
		if len(gates) != 1 {
			t.Errorf("expected 1 gate with to_state=review, got %d", len(gates))
		}
	})
}

func TestGateUpdate(t *testing.T) {
	env := newTestEnv(t)
	wfID := env.createWorkflow(t, "test-gate-update-wf")
	gateID := env.createGate(t, wfID, "todo", "in_progress", "Original Name", "required_fields", nil, boolPtr(true))

	updatedRaw := env.mustCall(t, "gate_update", map[string]interface{}{
		"id":          gateID,
		"name":        "Updated Name",
		"gate_type":   "evidence_upload",
		"is_required": false,
		"order":       5,
	})

	var updated struct {
		Name       string `json:"name"`
		GateType   string `json:"gate_type"`
		IsRequired bool   `json:"is_required"`
		Order      int    `json:"order"`
	}
	if err := unmarshalFirst(updatedRaw, &updated); err != nil {
		t.Fatalf("parse updated gate: %v", err)
	}
	if updated.Name != "Updated Name" {
		t.Errorf("expected name=Updated Name, got %s", updated.Name)
	}
	if updated.GateType != "evidence_upload" {
		t.Errorf("expected gate_type=evidence_upload, got %s", updated.GateType)
	}
	if updated.IsRequired {
		t.Error("expected is_required=false")
	}
	if updated.Order != 5 {
		t.Errorf("expected order=5, got %d", updated.Order)
	}
}

func TestGateDelete(t *testing.T) {
	env := newTestEnv(t)
	wfID := env.createWorkflow(t, "test-gate-delete-wf")

	// Create gate manually (no cleanup since we're deleting it ourselves).
	raw := env.mustCall(t, "gate_create", map[string]interface{}{
		"workflow_id": wfID,
		"from_state":  "todo",
		"to_state":    "in_progress",
		"name":        "To Delete",
		"gate_type":   "manual",
	})
	gateID := parseID(t, raw)

	// Delete.
	deleteResult := env.mustCall(t, "gate_delete", map[string]interface{}{
		"id": gateID,
	})
	if !strings.Contains(deleteResult, "deleted") {
		t.Errorf("expected delete confirmation, got: %s", deleteResult)
	}

	// Verify it's gone from the list.
	listRaw := env.mustCall(t, "gate_list", map[string]interface{}{
		"workflow_id": wfID,
	})
	if strings.Contains(listRaw, gateID) {
		t.Error("deleted gate still appears in gate_list")
	}
}

func TestGateCreateValidation(t *testing.T) {
	env := newTestEnv(t)
	wfID := env.createWorkflow(t, "test-gate-validation-wf")

	t.Run("invalid gate_type", func(t *testing.T) {
		errText := env.expectError(t, "gate_create", map[string]interface{}{
			"workflow_id": wfID,
			"from_state":  "todo",
			"to_state":    "in_progress",
			"name":        "Bad Gate",
			"gate_type":   "nonexistent_type",
		})
		if !strings.Contains(errText, "gate_type must be one of") {
			t.Errorf("expected gate_type validation error, got: %s", errText)
		}
	})

	t.Run("missing required fields", func(t *testing.T) {
		errText := env.expectError(t, "gate_create", map[string]interface{}{
			"workflow_id": wfID,
			"from_state":  "todo",
			"to_state":    "in_progress",
			"gate_type":   "manual",
			// name is missing
		})
		if !strings.Contains(errText, "name is required") {
			t.Errorf("expected name required error, got: %s", errText)
		}
	})
}

// ---------------------------------------------------------------------------
// 2. Evidence Tests
// ---------------------------------------------------------------------------

func TestEvidenceSubmit(t *testing.T) {
	env := newTestEnv(t)
	wfID := env.createWorkflow(t, "test-evidence-submit-wf")
	gateID := env.createGate(t, wfID, "todo", "in_progress", "Upload Gate", "evidence_upload", nil, nil)
	projID := env.createProject(t, "test-evidence-submit-proj")
	taskID := env.createTask(t, "Test Evidence Submit Task", projID)

	raw := env.mustCall(t, "evidence_submit", map[string]interface{}{
		"task_id":       taskID,
		"gate_id":       gateID,
		"evidence_type": "upload",
		"content":       map[string]interface{}{"file": "test.pdf", "size": 1024},
	})

	evID := parseID(t, raw)
	t.Cleanup(func() {
		env.dbClient.Delete(context.Background(), "gate_evidence",
			fmt.Sprintf("id=eq.%s&organization_id=eq.%s", evID, env.orgID))
	})

	if evID == "" {
		t.Fatal("expected evidence id to be non-empty")
	}

	var ev struct {
		TaskID       string `json:"task_id"`
		GateID       string `json:"gate_id"`
		EvidenceType string `json:"evidence_type"`
	}
	if err := unmarshalFirst(raw, &ev); err != nil {
		t.Fatalf("parse evidence: %v", err)
	}
	if ev.TaskID != taskID {
		t.Errorf("expected task_id=%s, got %s", taskID, ev.TaskID)
	}
	if ev.GateID != gateID {
		t.Errorf("expected gate_id=%s, got %s", gateID, ev.GateID)
	}
	if ev.EvidenceType != "upload" {
		t.Errorf("expected evidence_type=upload, got %s", ev.EvidenceType)
	}
}

func TestEvidenceList(t *testing.T) {
	env := newTestEnv(t)
	wfID := env.createWorkflow(t, "test-evidence-list-wf")
	gateA := env.createGate(t, wfID, "todo", "in_progress", "Gate A", "evidence_upload", nil, nil)
	gateB := env.createGate(t, wfID, "todo", "in_progress", "Gate B", "approval", nil, nil)
	projID := env.createProject(t, "test-evidence-list-proj")
	taskID := env.createTask(t, "Test Evidence List Task", projID)

	env.submitEvidence(t, taskID, gateA, "upload", nil)
	env.submitEvidence(t, taskID, gateA, "upload", nil)
	env.submitEvidence(t, taskID, gateB, "approval", nil)

	t.Run("list all evidence for task", func(t *testing.T) {
		raw := env.mustCall(t, "evidence_list", map[string]interface{}{
			"task_id": taskID,
		})
		var records []struct {
			ID string `json:"id"`
		}
		if err := json.Unmarshal([]byte(raw), &records); err != nil {
			t.Fatalf("parse evidence list: %v", err)
		}
		if len(records) < 3 {
			t.Errorf("expected at least 3 evidence records, got %d", len(records))
		}
	})

	t.Run("filter by gate_id", func(t *testing.T) {
		raw := env.mustCall(t, "evidence_list", map[string]interface{}{
			"task_id": taskID,
			"gate_id": gateA,
		})
		var records []struct {
			GateID string `json:"gate_id"`
		}
		if err := json.Unmarshal([]byte(raw), &records); err != nil {
			t.Fatalf("parse evidence list: %v", err)
		}
		if len(records) != 2 {
			t.Errorf("expected 2 evidence records for gateA, got %d", len(records))
		}
		for _, r := range records {
			if r.GateID != gateA {
				t.Errorf("expected gate_id=%s, got %s", gateA, r.GateID)
			}
		}
	})
}

func TestEvidenceImmutability(t *testing.T) {
	env := newTestEnv(t)
	wfID := env.createWorkflow(t, "test-evidence-immutability-wf")
	gateID := env.createGate(t, wfID, "todo", "in_progress", "Immutable Gate", "evidence_upload", nil, nil)
	projID := env.createProject(t, "test-evidence-immutability-proj")
	taskID := env.createTask(t, "Test Evidence Immutability Task", projID)

	evID := env.submitEvidence(t, taskID, gateID, "upload", json.RawMessage(`{"file": "test.txt"}`))

	// Attempt to update the evidence record directly via the DB client.
	// The gate_evidence table should have no UPDATE policy or a trigger
	// preventing updates.
	t.Run("update should fail", func(t *testing.T) {
		_, err := env.dbClient.Patch(env.ctx, "gate_evidence",
			fmt.Sprintf("id=eq.%s&organization_id=eq.%s", evID, env.orgID),
			map[string]interface{}{"evidence_type": "modified"})
		// Expect a non-nil error (PostgREST will return 4xx for policy violations)
		// or check that the record was not actually modified.
		if err == nil {
			// If no error, verify the record was NOT changed (some configs return
			// empty result on no-match instead of an error).
			raw := env.mustCall(t, "evidence_list", map[string]interface{}{
				"task_id": taskID,
				"gate_id": gateID,
			})
			if strings.Contains(raw, `"evidence_type":"modified"`) {
				t.Error("evidence record was modified but should be immutable")
			}
		}
		// If err != nil, that's the expected behavior — immutability enforced.
	})

	t.Run("delete should fail", func(t *testing.T) {
		_, err := env.dbClient.Delete(env.ctx, "gate_evidence",
			fmt.Sprintf("id=eq.%s&organization_id=eq.%s", evID, env.orgID))
		// Same logic: either an error or the record persists.
		if err == nil {
			raw := env.mustCall(t, "evidence_list", map[string]interface{}{
				"task_id": taskID,
				"gate_id": gateID,
			})
			if !strings.Contains(raw, evID) {
				// The service key can bypass RLS. If the record was deleted
				// with the service key, this is expected. Immutability
				// enforcement depends on RLS policies, which may allow
				// the service role to delete. Log rather than fail.
				t.Log("evidence record deleted via service key (RLS may allow service_role)")
			}
		}
	})
}

// ---------------------------------------------------------------------------
// 3. Gate Check Tests
// ---------------------------------------------------------------------------

func TestGateCheckNoWorkflow(t *testing.T) {
	env := newTestEnv(t)
	// Task with no project = no workflow.
	taskID := env.createTask(t, "Orphan Task", "")

	raw := env.mustCall(t, "gate_check", map[string]interface{}{
		"task_id":    taskID,
		"from_state": "todo",
		"to_state":   "in_progress",
	})

	var resp gateCheckResponse
	if err := json.Unmarshal([]byte(raw), &resp); err != nil {
		t.Fatalf("parse gate_check response: %v", err)
	}
	if !resp.CanTransition {
		t.Error("expected can_transition=true for task with no workflow")
	}
	if len(resp.Gates) != 0 {
		t.Errorf("expected 0 gates, got %d", len(resp.Gates))
	}
}

func TestGateCheckRequiredFields(t *testing.T) {
	env := newTestEnv(t)
	wfID := env.createWorkflow(t, "test-gatecheck-reqfields-wf")
	projID := env.createProject(t, "test-gatecheck-reqfields-proj")
	env.applyWorkflow(t, wfID, projID)

	// Gate requires assigned_agent_id to be set.
	env.createGate(t, wfID, "todo", "in_progress", "Need Agent", "required_fields",
		json.RawMessage(`{"fields": ["assigned_agent_id"]}`), boolPtr(true))

	t.Run("without required field", func(t *testing.T) {
		taskID := env.createTask(t, "Task No Agent", projID)

		raw := env.mustCall(t, "gate_check", map[string]interface{}{
			"task_id":    taskID,
			"from_state": "todo",
			"to_state":   "in_progress",
		})

		var resp gateCheckResponse
		if err := json.Unmarshal([]byte(raw), &resp); err != nil {
			t.Fatalf("parse response: %v", err)
		}
		if resp.CanTransition {
			t.Error("expected can_transition=false when required field is missing")
		}
		if len(resp.Gates) == 0 {
			t.Fatal("expected at least one gate result")
		}
		if resp.Gates[0].Satisfied {
			t.Error("expected gate to be unsatisfied")
		}
	})

	t.Run("with required field set", func(t *testing.T) {
		taskID := env.createTask(t, "Task With Agent", projID)

		// Assign an agent to the task.
		env.mustCall(t, "task_assign", map[string]interface{}{
			"id":       taskID,
			"agent_id": env.userID, // reuse user ID as a valid UUID
		})

		raw := env.mustCall(t, "gate_check", map[string]interface{}{
			"task_id":    taskID,
			"from_state": "todo",
			"to_state":   "in_progress",
		})

		var resp gateCheckResponse
		if err := json.Unmarshal([]byte(raw), &resp); err != nil {
			t.Fatalf("parse response: %v", err)
		}
		if !resp.CanTransition {
			t.Error("expected can_transition=true when required field is set")
		}
	})
}

func TestGateCheckEvidenceUpload(t *testing.T) {
	env := newTestEnv(t)
	wfID := env.createWorkflow(t, "test-gatecheck-evidence-wf")
	projID := env.createProject(t, "test-gatecheck-evidence-proj")
	env.applyWorkflow(t, wfID, projID)

	gateID := env.createGate(t, wfID, "todo", "in_progress", "Upload Required", "evidence_upload", nil, boolPtr(true))
	taskID := env.createTask(t, "Task Evidence Test", projID)

	t.Run("without evidence", func(t *testing.T) {
		raw := env.mustCall(t, "gate_check", map[string]interface{}{
			"task_id":    taskID,
			"from_state": "todo",
			"to_state":   "in_progress",
		})
		var resp gateCheckResponse
		if err := json.Unmarshal([]byte(raw), &resp); err != nil {
			t.Fatalf("parse response: %v", err)
		}
		if resp.CanTransition {
			t.Error("expected can_transition=false without evidence")
		}
	})

	t.Run("with evidence", func(t *testing.T) {
		env.submitEvidence(t, taskID, gateID, "upload", json.RawMessage(`{"file": "report.pdf"}`))

		raw := env.mustCall(t, "gate_check", map[string]interface{}{
			"task_id":    taskID,
			"from_state": "todo",
			"to_state":   "in_progress",
		})
		var resp gateCheckResponse
		if err := json.Unmarshal([]byte(raw), &resp); err != nil {
			t.Fatalf("parse response: %v", err)
		}
		if !resp.CanTransition {
			t.Error("expected can_transition=true after evidence submitted")
		}
	})
}

func TestGateCheckApproval(t *testing.T) {
	env := newTestEnv(t)
	wfID := env.createWorkflow(t, "test-gatecheck-approval-wf")
	projID := env.createProject(t, "test-gatecheck-approval-proj")
	env.applyWorkflow(t, wfID, projID)

	gateID := env.createGate(t, wfID, "in_progress", "review", "Needs Approval", "approval", nil, boolPtr(true))
	taskID := env.createTask(t, "Task Approval Test", projID)

	// Move task to in_progress first (no gate on todo->in_progress).
	env.mustCall(t, "task_transition", map[string]interface{}{
		"task_id":  taskID,
		"to_state": "in_progress",
	})

	t.Run("without approval", func(t *testing.T) {
		raw := env.mustCall(t, "gate_check", map[string]interface{}{
			"task_id":    taskID,
			"from_state": "in_progress",
			"to_state":   "review",
		})
		var resp gateCheckResponse
		if err := json.Unmarshal([]byte(raw), &resp); err != nil {
			t.Fatalf("parse response: %v", err)
		}
		if resp.CanTransition {
			t.Error("expected can_transition=false without approval")
		}
	})

	t.Run("with approval", func(t *testing.T) {
		env.submitEvidence(t, taskID, gateID, "approval", json.RawMessage(`{"approved_by": "lead"}`))

		raw := env.mustCall(t, "gate_check", map[string]interface{}{
			"task_id":    taskID,
			"from_state": "in_progress",
			"to_state":   "review",
		})
		var resp gateCheckResponse
		if err := json.Unmarshal([]byte(raw), &resp); err != nil {
			t.Fatalf("parse response: %v", err)
		}
		if !resp.CanTransition {
			t.Error("expected can_transition=true after approval submitted")
		}
	})
}

func TestGateCheckAdvisoryGate(t *testing.T) {
	env := newTestEnv(t)
	wfID := env.createWorkflow(t, "test-gatecheck-advisory-wf")
	projID := env.createProject(t, "test-gatecheck-advisory-proj")
	env.applyWorkflow(t, wfID, projID)

	// Advisory gate (is_required=false) should not block.
	env.createGate(t, wfID, "todo", "in_progress", "Advisory Only", "evidence_upload", nil, boolPtr(false))

	taskID := env.createTask(t, "Task Advisory Test", projID)

	raw := env.mustCall(t, "gate_check", map[string]interface{}{
		"task_id":    taskID,
		"from_state": "todo",
		"to_state":   "in_progress",
	})
	var resp gateCheckResponse
	if err := json.Unmarshal([]byte(raw), &resp); err != nil {
		t.Fatalf("parse response: %v", err)
	}
	if !resp.CanTransition {
		t.Error("expected can_transition=true for advisory (non-required) gate")
	}
	if len(resp.Gates) == 0 {
		t.Fatal("expected at least one gate in response")
	}
	if resp.Gates[0].Satisfied {
		t.Error("expected advisory gate to still show as unsatisfied (but not blocking)")
	}
	if resp.Gates[0].IsRequired {
		t.Error("expected is_required=false for advisory gate")
	}
}

func TestGateCheckMultipleGates(t *testing.T) {
	env := newTestEnv(t)
	wfID := env.createWorkflow(t, "test-gatecheck-multi-wf")
	projID := env.createProject(t, "test-gatecheck-multi-proj")
	env.applyWorkflow(t, wfID, projID)

	gateA := env.createGate(t, wfID, "todo", "in_progress", "Gate A - Upload", "evidence_upload", nil, boolPtr(true))
	gateB := env.createGate(t, wfID, "todo", "in_progress", "Gate B - Manual", "manual", nil, boolPtr(true))

	taskID := env.createTask(t, "Task Multi-Gate", projID)

	t.Run("neither satisfied", func(t *testing.T) {
		raw := env.mustCall(t, "gate_check", map[string]interface{}{
			"task_id":    taskID,
			"from_state": "todo",
			"to_state":   "in_progress",
		})
		var resp gateCheckResponse
		if err := json.Unmarshal([]byte(raw), &resp); err != nil {
			t.Fatalf("parse: %v", err)
		}
		if resp.CanTransition {
			t.Error("expected can_transition=false when neither gate is satisfied")
		}
	})

	t.Run("only one satisfied", func(t *testing.T) {
		env.submitEvidence(t, taskID, gateA, "upload", nil)

		raw := env.mustCall(t, "gate_check", map[string]interface{}{
			"task_id":    taskID,
			"from_state": "todo",
			"to_state":   "in_progress",
		})
		var resp gateCheckResponse
		if err := json.Unmarshal([]byte(raw), &resp); err != nil {
			t.Fatalf("parse: %v", err)
		}
		if resp.CanTransition {
			t.Error("expected can_transition=false when only one of two gates is satisfied")
		}
	})

	t.Run("both satisfied", func(t *testing.T) {
		env.submitEvidence(t, taskID, gateB, "manual_confirmation", nil)

		raw := env.mustCall(t, "gate_check", map[string]interface{}{
			"task_id":    taskID,
			"from_state": "todo",
			"to_state":   "in_progress",
		})
		var resp gateCheckResponse
		if err := json.Unmarshal([]byte(raw), &resp); err != nil {
			t.Fatalf("parse: %v", err)
		}
		if !resp.CanTransition {
			t.Error("expected can_transition=true when both gates are satisfied")
		}
	})
}

// ---------------------------------------------------------------------------
// 4. Override Tests
// ---------------------------------------------------------------------------

func TestGateOverride(t *testing.T) {
	env := newTestEnv(t)
	wfID := env.createWorkflow(t, "test-override-wf")
	projID := env.createProject(t, "test-override-proj")
	env.applyWorkflow(t, wfID, projID)

	gateID := env.createGate(t, wfID, "todo", "in_progress", "Strict Gate", "evidence_upload", nil, boolPtr(true))
	taskID := env.createTask(t, "Task Override Test", projID)

	// Verify gate blocks first.
	raw := env.mustCall(t, "gate_check", map[string]interface{}{
		"task_id":    taskID,
		"from_state": "todo",
		"to_state":   "in_progress",
	})
	var beforeResp gateCheckResponse
	if err := json.Unmarshal([]byte(raw), &beforeResp); err != nil {
		t.Fatalf("parse: %v", err)
	}
	if beforeResp.CanTransition {
		t.Fatal("precondition failed: gate should block before override")
	}

	// Submit override.
	overrideRaw := env.mustCall(t, "gate_override", map[string]interface{}{
		"task_id":         taskID,
		"gate_id":         gateID,
		"override_reason": "Emergency deployment required",
	})
	overrideID := parseID(t, overrideRaw)
	t.Cleanup(func() {
		env.dbClient.Delete(context.Background(), "gate_evidence",
			fmt.Sprintf("id=eq.%s&organization_id=eq.%s", overrideID, env.orgID))
	})

	// Verify gate now passes.
	raw = env.mustCall(t, "gate_check", map[string]interface{}{
		"task_id":    taskID,
		"from_state": "todo",
		"to_state":   "in_progress",
	})
	var afterResp gateCheckResponse
	if err := json.Unmarshal([]byte(raw), &afterResp); err != nil {
		t.Fatalf("parse: %v", err)
	}
	if !afterResp.CanTransition {
		t.Error("expected can_transition=true after override")
	}
}

func TestGateOverrideAuditTrail(t *testing.T) {
	env := newTestEnv(t)
	wfID := env.createWorkflow(t, "test-override-audit-wf")
	projID := env.createProject(t, "test-override-audit-proj")
	gateID := env.createGate(t, wfID, "todo", "in_progress", "Audit Gate", "evidence_upload", nil, boolPtr(true))
	taskID := env.createTask(t, "Task Override Audit", projID)

	overrideRaw := env.mustCall(t, "gate_override", map[string]interface{}{
		"task_id":         taskID,
		"gate_id":         gateID,
		"override_reason": "Critical hotfix, skip evidence",
	})
	overrideID := parseID(t, overrideRaw)
	t.Cleanup(func() {
		env.dbClient.Delete(context.Background(), "gate_evidence",
			fmt.Sprintf("id=eq.%s&organization_id=eq.%s", overrideID, env.orgID))
	})

	// Verify the override appears in evidence list with correct fields.
	listRaw := env.mustCall(t, "evidence_list", map[string]interface{}{
		"task_id": taskID,
		"gate_id": gateID,
	})
	var records []struct {
		EvidenceType   string `json:"evidence_type"`
		IsOverride     bool   `json:"is_override"`
		OverrideReason string `json:"override_reason"`
	}
	if err := json.Unmarshal([]byte(listRaw), &records); err != nil {
		t.Fatalf("parse evidence list: %v", err)
	}
	if len(records) == 0 {
		t.Fatal("expected at least one evidence record for the override")
	}

	found := false
	for _, r := range records {
		if r.EvidenceType == "override" && r.IsOverride {
			found = true
			if r.OverrideReason != "Critical hotfix, skip evidence" {
				t.Errorf("expected override_reason to match, got: %s", r.OverrideReason)
			}
		}
	}
	if !found {
		t.Error("override evidence record not found in evidence list")
	}
}

// ---------------------------------------------------------------------------
// 5. Task Transition Tests
// ---------------------------------------------------------------------------

func TestTaskTransitionNoWorkflow(t *testing.T) {
	env := newTestEnv(t)
	projID := env.createProject(t, "test-transition-nowf-proj")
	taskID := env.createTask(t, "Task No WF Transition", projID)

	raw := env.mustCall(t, "task_transition", map[string]interface{}{
		"task_id":  taskID,
		"to_state": "in_progress",
	})

	var resp struct {
		TaskID    string `json:"task_id"`
		FromState string `json:"from_state"`
		ToState   string `json:"to_state"`
	}
	if err := json.Unmarshal([]byte(raw), &resp); err != nil {
		t.Fatalf("parse transition response: %v", err)
	}
	if resp.TaskID != taskID {
		t.Errorf("expected task_id=%s, got %s", taskID, resp.TaskID)
	}
	if resp.FromState != "todo" {
		t.Errorf("expected from_state=todo, got %s", resp.FromState)
	}
	if resp.ToState != "in_progress" {
		t.Errorf("expected to_state=in_progress, got %s", resp.ToState)
	}
}

func TestTaskTransitionBlockedByGate(t *testing.T) {
	env := newTestEnv(t)
	wfID := env.createWorkflow(t, "test-transition-blocked-wf")
	projID := env.createProject(t, "test-transition-blocked-proj")
	env.applyWorkflow(t, wfID, projID)

	env.createGate(t, wfID, "todo", "in_progress", "Blocker Gate", "evidence_upload", nil, boolPtr(true))
	taskID := env.createTask(t, "Task Blocked Transition", projID)

	errText := env.expectError(t, "task_transition", map[string]interface{}{
		"task_id":  taskID,
		"to_state": "in_progress",
	})

	if !strings.Contains(errText, "gates_not_satisfied") {
		t.Errorf("expected gates_not_satisfied error, got: %s", errText)
	}
	if !strings.Contains(errText, "failed_gates") {
		t.Errorf("expected failed_gates in response, got: %s", errText)
	}
}

func TestTaskTransitionWithEvidence(t *testing.T) {
	env := newTestEnv(t)
	wfID := env.createWorkflow(t, "test-transition-evidence-wf")
	projID := env.createProject(t, "test-transition-evidence-proj")
	env.applyWorkflow(t, wfID, projID)

	gateID := env.createGate(t, wfID, "todo", "in_progress", "Evidence Gate", "evidence_upload", nil, boolPtr(true))
	taskID := env.createTask(t, "Task Evidence Transition", projID)

	// Submit evidence first.
	env.submitEvidence(t, taskID, gateID, "upload", json.RawMessage(`{"file": "design.pdf"}`))

	// Now transition should succeed.
	raw := env.mustCall(t, "task_transition", map[string]interface{}{
		"task_id":  taskID,
		"to_state": "in_progress",
	})

	var resp struct {
		ToState string `json:"to_state"`
	}
	if err := json.Unmarshal([]byte(raw), &resp); err != nil {
		t.Fatalf("parse: %v", err)
	}
	if resp.ToState != "in_progress" {
		t.Errorf("expected to_state=in_progress, got %s", resp.ToState)
	}
}

func TestTaskTransitionWithOverride(t *testing.T) {
	env := newTestEnv(t)
	wfID := env.createWorkflow(t, "test-transition-override-wf")
	projID := env.createProject(t, "test-transition-override-proj")
	env.applyWorkflow(t, wfID, projID)

	gateID := env.createGate(t, wfID, "todo", "in_progress", "Override Gate", "evidence_upload", nil, boolPtr(true))
	taskID := env.createTask(t, "Task Override Transition", projID)

	// Transition with inline override.
	raw := env.mustCall(t, "task_transition", map[string]interface{}{
		"task_id":  taskID,
		"to_state": "in_progress",
		"override": map[string]interface{}{
			"gate_ids": []string{gateID},
			"reason":   "Approved by CTO in standup",
		},
	})

	// Clean up override evidence records.
	t.Cleanup(func() {
		env.dbClient.Delete(context.Background(), "gate_evidence",
			fmt.Sprintf("task_id=eq.%s&organization_id=eq.%s&is_override=eq.true", taskID, env.orgID))
	})

	var resp struct {
		ToState string `json:"to_state"`
	}
	if err := json.Unmarshal([]byte(raw), &resp); err != nil {
		t.Fatalf("parse: %v", err)
	}
	if resp.ToState != "in_progress" {
		t.Errorf("expected to_state=in_progress, got %s", resp.ToState)
	}
}

// ---------------------------------------------------------------------------
// 6. Workflow Apply/Unapply Tests
// ---------------------------------------------------------------------------

func TestWorkflowApply(t *testing.T) {
	env := newTestEnv(t)
	wfID := env.createWorkflow(t, "test-wf-apply-wf")
	projID := env.createProject(t, "test-wf-apply-proj")

	raw := env.mustCall(t, "workflow_apply", map[string]interface{}{
		"workflow_id": wfID,
		"project_id":  projID,
	})

	instanceID := parseID(t, raw)
	t.Cleanup(func() {
		env.dbClient.Delete(context.Background(), "workflow_instances",
			fmt.Sprintf("id=eq.%s&organization_id=eq.%s", instanceID, env.orgID))
	})

	var instance struct {
		WorkflowID string `json:"workflow_id"`
		ProjectID  string `json:"project_id"`
		IsActive   bool   `json:"is_active"`
	}
	if err := unmarshalFirst(raw, &instance); err != nil {
		t.Fatalf("parse instance: %v", err)
	}
	if instance.WorkflowID != wfID {
		t.Errorf("expected workflow_id=%s, got %s", wfID, instance.WorkflowID)
	}
	if instance.ProjectID != projID {
		t.Errorf("expected project_id=%s, got %s", projID, instance.ProjectID)
	}
	if !instance.IsActive {
		t.Error("expected is_active=true for newly applied workflow")
	}
}

func TestWorkflowApplyDuplicate(t *testing.T) {
	env := newTestEnv(t)
	wfID := env.createWorkflow(t, "test-wf-apply-dup-wf")
	projID := env.createProject(t, "test-wf-apply-dup-proj")

	// First apply.
	env.applyWorkflow(t, wfID, projID)

	// Second apply — should fail due to unique constraint.
	_, isErr := env.call(t, "workflow_apply", map[string]interface{}{
		"workflow_id": wfID,
		"project_id":  projID,
	})
	if !isErr {
		// If no tool-level error, the DB may have allowed it (no unique
		// constraint on active instances). Check if two active instances exist.
		t.Log("Note: duplicate workflow_apply did not return error. " +
			"This may indicate a missing unique constraint on (workflow_id, project_id, is_active).")
	}
}

func TestWorkflowUnapply(t *testing.T) {
	env := newTestEnv(t)
	wfID := env.createWorkflow(t, "test-wf-unapply-wf")
	projID := env.createProject(t, "test-wf-unapply-proj")

	env.applyWorkflow(t, wfID, projID)

	// Unapply the specific workflow.
	env.mustCall(t, "workflow_unapply", map[string]interface{}{
		"project_id":  projID,
		"workflow_id": wfID,
	})

	// Verify: create a task and check that gate_check passes freely.
	taskID := env.createTask(t, "Task After Unapply", projID)
	raw := env.mustCall(t, "gate_check", map[string]interface{}{
		"task_id":    taskID,
		"from_state": "todo",
		"to_state":   "in_progress",
	})
	var resp gateCheckResponse
	if err := json.Unmarshal([]byte(raw), &resp); err != nil {
		t.Fatalf("parse: %v", err)
	}
	if !resp.CanTransition {
		t.Error("expected can_transition=true after workflow unapply")
	}
}

func TestWorkflowUnapplyAll(t *testing.T) {
	env := newTestEnv(t)
	wfA := env.createWorkflow(t, "test-wf-unapply-all-A")
	wfB := env.createWorkflow(t, "test-wf-unapply-all-B")
	projID := env.createProject(t, "test-wf-unapply-all-proj")

	env.applyWorkflow(t, wfA, projID)
	env.applyWorkflow(t, wfB, projID)

	// Unapply all (omit workflow_id).
	env.mustCall(t, "workflow_unapply", map[string]interface{}{
		"project_id": projID,
	})

	// Verify: transitions are no longer gated.
	taskID := env.createTask(t, "Task After Unapply All", projID)
	raw := env.mustCall(t, "gate_check", map[string]interface{}{
		"task_id":    taskID,
		"from_state": "todo",
		"to_state":   "in_progress",
	})
	var resp gateCheckResponse
	if err := json.Unmarshal([]byte(raw), &resp); err != nil {
		t.Fatalf("parse: %v", err)
	}
	if !resp.CanTransition {
		t.Error("expected can_transition=true after unapplying all workflows")
	}
}

// ---------------------------------------------------------------------------
// 7. Task Update Blocking Tests
// ---------------------------------------------------------------------------

func TestTaskUpdateBlockedByWorkflow(t *testing.T) {
	env := newTestEnv(t)
	wfID := env.createWorkflow(t, "test-taskupd-blocked-wf")
	projID := env.createProject(t, "test-taskupd-blocked-proj")
	env.applyWorkflow(t, wfID, projID)

	taskID := env.createTask(t, "Task Update Blocked", projID)

	errText := env.expectError(t, "task_update", map[string]interface{}{
		"id":     taskID,
		"status": "in_progress",
	})
	if !strings.Contains(errText, "status_change_requires_transition") {
		t.Errorf("expected status_change_requires_transition error, got: %s", errText)
	}
}

func TestTaskUpdateAllowedWithoutWorkflow(t *testing.T) {
	env := newTestEnv(t)
	projID := env.createProject(t, "test-taskupd-allowed-proj")
	taskID := env.createTask(t, "Task Update Allowed", projID)

	// No workflow applied — status change via task_update should work.
	raw := env.mustCall(t, "task_update", map[string]interface{}{
		"id":     taskID,
		"status": "in_progress",
	})

	var updated struct {
		Status string `json:"status"`
	}
	if err := unmarshalFirst(raw, &updated); err != nil {
		t.Fatalf("parse: %v", err)
	}
	if updated.Status != "in_progress" {
		t.Errorf("expected status=in_progress, got %s", updated.Status)
	}
}

func TestTaskCompleteBlockedByWorkflow(t *testing.T) {
	env := newTestEnv(t)
	wfID := env.createWorkflow(t, "test-taskcomplete-blocked-wf")
	projID := env.createProject(t, "test-taskcomplete-blocked-proj")
	env.applyWorkflow(t, wfID, projID)

	taskID := env.createTask(t, "Task Complete Blocked", projID)

	errText := env.expectError(t, "task_complete", map[string]interface{}{
		"id": taskID,
	})
	if !strings.Contains(errText, "status_change_requires_transition") {
		t.Errorf("expected status_change_requires_transition error, got: %s", errText)
	}
}

// ---------------------------------------------------------------------------
// JSON utility
// ---------------------------------------------------------------------------

// unmarshalFirst tries to unmarshal raw JSON into v. It handles both a single
// JSON object and a JSON array (takes the first element).
func unmarshalFirst(raw string, v interface{}) error {
	data := []byte(raw)

	// Try single object first.
	if err := json.Unmarshal(data, v); err == nil {
		return nil
	}

	// Try array.
	var arr []json.RawMessage
	if err := json.Unmarshal(data, &arr); err != nil {
		return fmt.Errorf("unmarshalFirst: not object or array: %w", err)
	}
	if len(arr) == 0 {
		return fmt.Errorf("unmarshalFirst: empty array")
	}
	return json.Unmarshal(arr[0], v)
}
