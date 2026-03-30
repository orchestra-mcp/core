package tools

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"testing"
)

// ---------------------------------------------------------------------------
// Session helper
// ---------------------------------------------------------------------------

// parseSessionID extracts the session ID from the jsonResult wrapper format
// used by session tools: {"session": {...}} or {"session": [{...}]}.
func parseSessionID(t *testing.T, raw string) string {
	t.Helper()

	var wrapper struct {
		Session json.RawMessage `json:"session"`
	}
	if err := json.Unmarshal([]byte(raw), &wrapper); err != nil {
		t.Fatalf("parse session wrapper: %v", err)
	}

	// Try single object.
	var single struct {
		ID string `json:"id"`
	}
	if err := json.Unmarshal(wrapper.Session, &single); err == nil && single.ID != "" {
		return single.ID
	}

	// Try array.
	var arr []struct {
		ID string `json:"id"`
	}
	if err := json.Unmarshal(wrapper.Session, &arr); err == nil && len(arr) > 0 {
		return arr[0].ID
	}

	t.Fatalf("could not parse session id from response: %.300s", raw)
	return ""
}

// startSession starts a test session and registers cleanup.
func (e *testEnv) startSession(t *testing.T, machineID string) string {
	t.Helper()
	raw := e.mustCall(t, "session_start", map[string]interface{}{
		"machine_id": machineID,
	})
	id := parseSessionID(t, raw)
	t.Cleanup(func() {
		e.dbClient.Delete(context.Background(), "agent_sessions",
			fmt.Sprintf("id=eq.%s&organization_id=eq.%s", id, e.orgID))
	})
	return id
}

// ---------------------------------------------------------------------------
// Session Lifecycle Tests
// ---------------------------------------------------------------------------

func TestSessionLifecycle(t *testing.T) {
	env := newTestEnv(t)

	// --- Start ---
	raw := env.mustCall(t, "session_start", map[string]interface{}{
		"machine_id": "test-machine-001",
	})

	sessionID := parseSessionID(t, raw)
	t.Cleanup(func() {
		env.dbClient.Delete(context.Background(), "agent_sessions",
			fmt.Sprintf("id=eq.%s&organization_id=eq.%s", sessionID, env.orgID))
	})

	if sessionID == "" {
		t.Fatal("expected session id to be non-empty")
	}

	// Verify start response fields.
	var startWrapper struct {
		Session json.RawMessage `json:"session"`
	}
	if err := json.Unmarshal([]byte(raw), &startWrapper); err != nil {
		t.Fatalf("parse start wrapper: %v", err)
	}
	var session struct {
		ID        string `json:"id"`
		MachineID string `json:"machine_id"`
		Status    string `json:"status"`
		StartedAt string `json:"started_at"`
	}
	if err := unmarshalFirst(string(startWrapper.Session), &session); err != nil {
		t.Fatalf("parse session: %v", err)
	}
	if session.MachineID != "test-machine-001" {
		t.Errorf("expected machine_id='test-machine-001', got '%s'", session.MachineID)
	}
	if session.Status != "active" {
		t.Errorf("expected status='active', got '%s'", session.Status)
	}
	if session.StartedAt == "" {
		t.Error("expected started_at to be set")
	}

	// --- Heartbeat ---
	hbRaw := env.mustCall(t, "session_heartbeat", map[string]interface{}{
		"session_id": sessionID,
	})
	// Verify heartbeat returns a session.
	var hbWrapper struct {
		Session json.RawMessage `json:"session"`
	}
	if err := json.Unmarshal([]byte(hbRaw), &hbWrapper); err != nil {
		t.Fatalf("parse heartbeat wrapper: %v", err)
	}
	if len(hbWrapper.Session) == 0 {
		t.Fatal("expected non-empty session in heartbeat response")
	}

	// --- List (should include our active session) ---
	listRaw := env.mustCall(t, "session_list", map[string]interface{}{})
	var listWrapper struct {
		Sessions json.RawMessage `json:"sessions"`
	}
	if err := json.Unmarshal([]byte(listRaw), &listWrapper); err != nil {
		t.Fatalf("parse list wrapper: %v", err)
	}
	var sessions []struct {
		ID     string `json:"id"`
		Status string `json:"status"`
	}
	if err := json.Unmarshal(listWrapper.Sessions, &sessions); err != nil {
		t.Fatalf("parse sessions list: %v", err)
	}
	found := false
	for _, s := range sessions {
		if s.ID == sessionID {
			found = true
			if s.Status != "active" {
				t.Errorf("expected status='active', got '%s'", s.Status)
			}
		}
	}
	if !found {
		t.Errorf("session %s not found in active sessions list", sessionID)
	}

	// --- End ---
	endRaw := env.mustCall(t, "session_end", map[string]interface{}{
		"session_id": sessionID,
	})
	var endWrapper struct {
		Session json.RawMessage `json:"session"`
	}
	if err := json.Unmarshal([]byte(endRaw), &endWrapper); err != nil {
		t.Fatalf("parse end wrapper: %v", err)
	}
	var ended struct {
		Status  string `json:"status"`
		EndedAt string `json:"ended_at"`
	}
	if err := unmarshalFirst(string(endWrapper.Session), &ended); err != nil {
		t.Fatalf("parse ended session: %v", err)
	}
	if ended.Status != "offline" {
		t.Errorf("expected status='offline' after end, got '%s'", ended.Status)
	}
	if ended.EndedAt == "" {
		t.Error("expected ended_at to be set after session_end")
	}

	// --- List again (ended session should NOT appear in active list) ---
	listAfterRaw := env.mustCall(t, "session_list", map[string]interface{}{})
	var listAfterWrapper struct {
		Sessions json.RawMessage `json:"sessions"`
	}
	if err := json.Unmarshal([]byte(listAfterRaw), &listAfterWrapper); err != nil {
		t.Fatalf("parse list-after wrapper: %v", err)
	}
	var sessionsAfter []struct {
		ID string `json:"id"`
	}
	if err := json.Unmarshal(listAfterWrapper.Sessions, &sessionsAfter); err != nil {
		t.Fatalf("parse sessions-after list: %v", err)
	}
	for _, s := range sessionsAfter {
		if s.ID == sessionID {
			t.Errorf("expected ended session %s NOT to appear in active list", sessionID)
		}
	}
}

func TestSessionStartRequiresMachineID(t *testing.T) {
	env := newTestEnv(t)

	text := env.expectError(t, "session_start", map[string]interface{}{})
	if !strings.Contains(text, "machine_id is required") {
		t.Errorf("expected 'machine_id is required' error, got: %s", text)
	}
}

func TestSessionHeartbeatRequiresSessionID(t *testing.T) {
	env := newTestEnv(t)

	text := env.expectError(t, "session_heartbeat", map[string]interface{}{})
	if !strings.Contains(text, "session_id is required") {
		t.Errorf("expected 'session_id is required' error, got: %s", text)
	}
}

func TestSessionEndRequiresSessionID(t *testing.T) {
	env := newTestEnv(t)

	text := env.expectError(t, "session_end", map[string]interface{}{})
	if !strings.Contains(text, "session_id is required") {
		t.Errorf("expected 'session_id is required' error, got: %s", text)
	}
}

func TestSessionHeartbeatUpdatesTask(t *testing.T) {
	env := newTestEnv(t)

	sessionID := env.startSession(t, "heartbeat-task-machine")
	taskID := env.createTask(t, "Heartbeat Task", "")

	// Send heartbeat with current_task_id.
	hbRaw := env.mustCall(t, "session_heartbeat", map[string]interface{}{
		"session_id":      sessionID,
		"current_task_id": taskID,
	})

	var hbWrapper struct {
		Session json.RawMessage `json:"session"`
	}
	if err := json.Unmarshal([]byte(hbRaw), &hbWrapper); err != nil {
		t.Fatalf("parse heartbeat wrapper: %v", err)
	}
	var hbSession struct {
		CurrentTaskID string `json:"current_task_id"`
	}
	if err := unmarshalFirst(string(hbWrapper.Session), &hbSession); err != nil {
		t.Fatalf("parse heartbeat session: %v", err)
	}
	if hbSession.CurrentTaskID != taskID {
		t.Errorf("expected current_task_id=%s, got '%s'", taskID, hbSession.CurrentTaskID)
	}
}

func TestSessionStartWithProjectAndTask(t *testing.T) {
	env := newTestEnv(t)

	projID := env.createProject(t, "Session Context Project")
	taskID := env.createTask(t, "Session Context Task", projID)

	raw := env.mustCall(t, "session_start", map[string]interface{}{
		"machine_id":         "context-machine",
		"current_project_id": projID,
		"current_task_id":    taskID,
	})

	sessionID := parseSessionID(t, raw)
	t.Cleanup(func() {
		env.dbClient.Delete(context.Background(), "agent_sessions",
			fmt.Sprintf("id=eq.%s&organization_id=eq.%s", sessionID, env.orgID))
	})

	var wrapper struct {
		Session json.RawMessage `json:"session"`
	}
	if err := json.Unmarshal([]byte(raw), &wrapper); err != nil {
		t.Fatalf("parse wrapper: %v", err)
	}
	var session struct {
		CurrentProjectID string `json:"current_project_id"`
		CurrentTaskID    string `json:"current_task_id"`
	}
	if err := unmarshalFirst(string(wrapper.Session), &session); err != nil {
		t.Fatalf("parse session: %v", err)
	}
	if session.CurrentProjectID != projID {
		t.Errorf("expected current_project_id=%s, got '%s'", projID, session.CurrentProjectID)
	}
	if session.CurrentTaskID != taskID {
		t.Errorf("expected current_task_id=%s, got '%s'", taskID, session.CurrentTaskID)
	}
}
