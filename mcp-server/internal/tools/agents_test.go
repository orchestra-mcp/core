package tools

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"testing"
)

// ---------------------------------------------------------------------------
// Agent helper
// ---------------------------------------------------------------------------

// createAgent creates a test agent and registers cleanup.
func (e *testEnv) createAgent(t *testing.T, name string) string {
	t.Helper()
	raw := e.mustCall(t, "agent_create", map[string]interface{}{
		"name": name,
		"role": "test-agent-role",
	})
	id := parseID(t, raw)
	t.Cleanup(func() {
		e.dbClient.Delete(context.Background(), "agents",
			fmt.Sprintf("id=eq.%s&organization_id=eq.%s", id, e.orgID))
	})
	return id
}

// ---------------------------------------------------------------------------
// Agent CRUD Tests
// ---------------------------------------------------------------------------

func TestAgentCRUD(t *testing.T) {
	env := newTestEnv(t)

	// --- Create ---
	raw := env.mustCall(t, "agent_create", map[string]interface{}{
		"name":    "Test Agent CRUD",
		"slug":    "test-agent-crud",
		"role":    "Senior Developer",
		"persona": "Friendly and efficient",
		"type":    "ai",
	})

	id := parseID(t, raw)
	t.Cleanup(func() {
		env.dbClient.Delete(context.Background(), "agents",
			fmt.Sprintf("id=eq.%s&organization_id=eq.%s", id, env.orgID))
	})

	if id == "" {
		t.Fatal("expected agent id to be non-empty")
	}

	var created struct {
		ID      string `json:"id"`
		Name    string `json:"name"`
		Slug    string `json:"slug"`
		Role    string `json:"role"`
		Persona string `json:"persona"`
		Type    string `json:"type"`
		Status  string `json:"status"`
	}
	if err := unmarshalFirst(raw, &created); err != nil {
		t.Fatalf("parse create response: %v", err)
	}
	if created.Name != "Test Agent CRUD" {
		t.Errorf("expected name='Test Agent CRUD', got '%s'", created.Name)
	}
	if created.Slug != "test-agent-crud" {
		t.Errorf("expected slug='test-agent-crud', got '%s'", created.Slug)
	}
	if created.Role != "Senior Developer" {
		t.Errorf("expected role='Senior Developer', got '%s'", created.Role)
	}
	if created.Type != "ai" {
		t.Errorf("expected type='ai', got '%s'", created.Type)
	}
	if created.Status != "active" {
		t.Errorf("expected status='active', got '%s'", created.Status)
	}

	// --- Get by ID ---
	getRaw := env.mustCall(t, "agent_get", map[string]interface{}{
		"id": id,
	})
	var fetched struct {
		ID   string `json:"id"`
		Name string `json:"name"`
	}
	if err := unmarshalFirst(getRaw, &fetched); err != nil {
		t.Fatalf("parse get response: %v", err)
	}
	if fetched.ID != id {
		t.Errorf("expected id=%s, got %s", id, fetched.ID)
	}
	if fetched.Name != "Test Agent CRUD" {
		t.Errorf("expected name='Test Agent CRUD', got '%s'", fetched.Name)
	}

	// --- Get by slug ---
	slugRaw := env.mustCall(t, "agent_get", map[string]interface{}{
		"slug": "test-agent-crud",
	})
	var fetchedBySlug struct {
		ID string `json:"id"`
	}
	if err := unmarshalFirst(slugRaw, &fetchedBySlug); err != nil {
		t.Fatalf("parse get-by-slug response: %v", err)
	}
	if fetchedBySlug.ID != id {
		t.Errorf("expected id=%s from slug lookup, got %s", id, fetchedBySlug.ID)
	}

	// --- Update ---
	updatedRaw := env.mustCall(t, "agent_update", map[string]interface{}{
		"id":   id,
		"name": "Updated Agent Name",
		"role": "Lead Developer",
	})
	var updated struct {
		Name string `json:"name"`
		Role string `json:"role"`
	}
	if err := unmarshalFirst(updatedRaw, &updated); err != nil {
		t.Fatalf("parse update response: %v", err)
	}
	if updated.Name != "Updated Agent Name" {
		t.Errorf("expected name='Updated Agent Name', got '%s'", updated.Name)
	}
	if updated.Role != "Lead Developer" {
		t.Errorf("expected role='Lead Developer', got '%s'", updated.Role)
	}

	// --- List (should include our agent) ---
	listRaw := env.mustCall(t, "agent_list", map[string]interface{}{})
	var agents []struct {
		ID     string `json:"id"`
		Status string `json:"status"`
	}
	if err := json.Unmarshal([]byte(listRaw), &agents); err != nil {
		t.Fatalf("parse agent list: %v", err)
	}
	found := false
	for _, a := range agents {
		if a.ID == id {
			found = true
			if a.Status != "active" {
				t.Errorf("expected status='active', got '%s'", a.Status)
			}
		}
	}
	if !found {
		t.Errorf("agent %s not found in list", id)
	}

	// --- Delete (archive) ---
	env.mustCall(t, "agent_delete", map[string]interface{}{
		"id": id,
	})

	// Verify agent is archived — list active should not include it.
	listAfterRaw := env.mustCall(t, "agent_list", map[string]interface{}{})
	var agentsAfter []struct {
		ID string `json:"id"`
	}
	if err := json.Unmarshal([]byte(listAfterRaw), &agentsAfter); err != nil {
		t.Fatalf("parse agent list after delete: %v", err)
	}
	for _, a := range agentsAfter {
		if a.ID == id {
			t.Errorf("expected agent %s to be archived and not in active list", id)
		}
	}
}

func TestAgentCreateRequiresName(t *testing.T) {
	env := newTestEnv(t)

	text := env.expectError(t, "agent_create", map[string]interface{}{})
	if !strings.Contains(text, "name is required") {
		t.Errorf("expected 'name is required' error, got: %s", text)
	}
}

func TestAgentGetRequiresIDOrSlug(t *testing.T) {
	env := newTestEnv(t)

	text := env.expectError(t, "agent_get", map[string]interface{}{})
	if !strings.Contains(text, "id or slug is required") {
		t.Errorf("expected 'id or slug is required' error, got: %s", text)
	}
}

func TestAgentUpdateRequiresID(t *testing.T) {
	env := newTestEnv(t)

	text := env.expectError(t, "agent_update", map[string]interface{}{
		"name": "Should Fail",
	})
	if !strings.Contains(text, "id is required") {
		t.Errorf("expected 'id is required' error, got: %s", text)
	}
}

func TestAgentDeleteRequiresID(t *testing.T) {
	env := newTestEnv(t)

	text := env.expectError(t, "agent_delete", map[string]interface{}{})
	if !strings.Contains(text, "id is required") {
		t.Errorf("expected 'id is required' error, got: %s", text)
	}
}

func TestAgentDefaultTypeIsAI(t *testing.T) {
	env := newTestEnv(t)

	raw := env.mustCall(t, "agent_create", map[string]interface{}{
		"name": "Default Type Agent",
	})

	id := parseID(t, raw)
	t.Cleanup(func() {
		env.dbClient.Delete(context.Background(), "agents",
			fmt.Sprintf("id=eq.%s&organization_id=eq.%s", id, env.orgID))
	})

	var agent struct {
		Type string `json:"type"`
	}
	if err := unmarshalFirst(raw, &agent); err != nil {
		t.Fatalf("parse response: %v", err)
	}
	if agent.Type != "ai" {
		t.Errorf("expected default type='ai', got '%s'", agent.Type)
	}
}

func TestAgentListFilterByStatus(t *testing.T) {
	env := newTestEnv(t)

	// Create an agent and then archive it.
	agentID := env.createAgent(t, "Filter Status Agent")
	env.mustCall(t, "agent_delete", map[string]interface{}{
		"id": agentID,
	})

	// List archived agents — our agent should appear.
	archivedRaw := env.mustCall(t, "agent_list", map[string]interface{}{
		"status": "archived",
	})
	var archived []struct {
		ID     string `json:"id"`
		Status string `json:"status"`
	}
	if err := json.Unmarshal([]byte(archivedRaw), &archived); err != nil {
		t.Fatalf("parse archived list: %v", err)
	}
	found := false
	for _, a := range archived {
		if a.ID == agentID {
			found = true
			if a.Status != "archived" {
				t.Errorf("expected status='archived', got '%s'", a.Status)
			}
		}
	}
	if !found {
		t.Errorf("archived agent %s not found in archived list", agentID)
	}

	// List active agents — our agent should NOT appear.
	activeRaw := env.mustCall(t, "agent_list", map[string]interface{}{
		"status": "active",
	})
	var active []struct {
		ID string `json:"id"`
	}
	if err := json.Unmarshal([]byte(activeRaw), &active); err != nil {
		t.Fatalf("parse active list: %v", err)
	}
	for _, a := range active {
		if a.ID == agentID {
			t.Errorf("expected archived agent %s NOT to appear in active list", agentID)
		}
	}
}
