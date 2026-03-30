package tools

import (
	"encoding/json"
	"fmt"
	"strings"
	"testing"
)

// ---------------------------------------------------------------------------
// Project CRUD Tests
// ---------------------------------------------------------------------------

func TestProjectCreateAndGet(t *testing.T) {
	env := newTestEnv(t)

	// --- Create ---
	raw := env.mustCall(t, "project_create", map[string]interface{}{
		"name":        "Test Project Alpha",
		"slug":        "test-project-alpha",
		"description": "Integration test project",
	})

	id := parseID(t, raw)
	t.Cleanup(func() {
		env.dbClient.Delete(env.ctx, "projects",
			fmt.Sprintf("id=eq.%s&organization_id=eq.%s", id, env.orgID))
	})

	if id == "" {
		t.Fatal("expected project id to be non-empty")
	}

	// Verify fields in create response.
	var created struct {
		ID          string `json:"id"`
		Name        string `json:"name"`
		Slug        string `json:"slug"`
		Description string `json:"description"`
		Status      string `json:"status"`
	}
	if err := unmarshalFirst(raw, &created); err != nil {
		t.Fatalf("parse create response: %v", err)
	}
	if created.Name != "Test Project Alpha" {
		t.Errorf("expected name='Test Project Alpha', got '%s'", created.Name)
	}
	if created.Slug != "test-project-alpha" {
		t.Errorf("expected slug='test-project-alpha', got '%s'", created.Slug)
	}
	if created.Status != "active" {
		t.Errorf("expected status='active', got '%s'", created.Status)
	}

	// --- Get by ID ---
	getRaw := env.mustCall(t, "project_get", map[string]interface{}{
		"id": id,
	})

	var fetched struct {
		ID          string `json:"id"`
		Name        string `json:"name"`
		Slug        string `json:"slug"`
		Description string `json:"description"`
	}
	if err := unmarshalFirst(getRaw, &fetched); err != nil {
		t.Fatalf("parse get response: %v", err)
	}
	if fetched.ID != id {
		t.Errorf("expected id=%s, got %s", id, fetched.ID)
	}
	if fetched.Name != "Test Project Alpha" {
		t.Errorf("expected name='Test Project Alpha', got '%s'", fetched.Name)
	}

	// --- Get by slug ---
	slugRaw := env.mustCall(t, "project_get", map[string]interface{}{
		"slug": "test-project-alpha",
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
}

func TestProjectCreateRequiresName(t *testing.T) {
	env := newTestEnv(t)

	text := env.expectError(t, "project_create", map[string]interface{}{})
	if !strings.Contains(text, "name is required") {
		t.Errorf("expected 'name is required' error, got: %s", text)
	}
}

func TestProjectGetRequiresIDOrSlug(t *testing.T) {
	env := newTestEnv(t)

	text := env.expectError(t, "project_get", map[string]interface{}{})
	if !strings.Contains(text, "id or slug is required") {
		t.Errorf("expected 'id or slug is required' error, got: %s", text)
	}
}

func TestProjectList(t *testing.T) {
	env := newTestEnv(t)

	// Create 2 projects.
	id1 := env.createProject(t, "List Test Project 1")
	id2 := env.createProject(t, "List Test Project 2")

	raw := env.mustCall(t, "project_list", map[string]interface{}{})

	var projects []struct {
		ID     string `json:"id"`
		Name   string `json:"name"`
		Status string `json:"status"`
	}
	if err := json.Unmarshal([]byte(raw), &projects); err != nil {
		t.Fatalf("parse project list: %v", err)
	}

	// Verify both projects appear.
	found := map[string]bool{}
	for _, p := range projects {
		found[p.ID] = true
		if p.Status != "active" {
			t.Errorf("expected all listed projects to be active, got status=%s for %s", p.Status, p.ID)
		}
	}
	if !found[id1] {
		t.Errorf("project %s not found in list", id1)
	}
	if !found[id2] {
		t.Errorf("project %s not found in list", id2)
	}
}

func TestProjectListFilterByStatus(t *testing.T) {
	env := newTestEnv(t)

	// Create a project then archive it.
	id := env.createProject(t, "Archive Test Project")

	// Archive via direct DB patch (not exposed as a tool).
	env.dbClient.Patch(env.ctx, "projects",
		fmt.Sprintf("id=eq.%s&organization_id=eq.%s", id, env.orgID),
		map[string]interface{}{"status": "archived"})

	// List archived projects.
	raw := env.mustCall(t, "project_list", map[string]interface{}{
		"status": "archived",
	})

	var projects []struct {
		ID     string `json:"id"`
		Status string `json:"status"`
	}
	if err := json.Unmarshal([]byte(raw), &projects); err != nil {
		t.Fatalf("parse project list: %v", err)
	}

	found := false
	for _, p := range projects {
		if p.ID == id {
			found = true
			if p.Status != "archived" {
				t.Errorf("expected status=archived, got %s", p.Status)
			}
		}
	}
	if !found {
		t.Errorf("archived project %s not found in archived list", id)
	}
}

func TestProjectProgress(t *testing.T) {
	env := newTestEnv(t)

	projID := env.createProject(t, "Progress Test Project")

	// Create tasks in the project (creates them with status=todo).
	env.createTask(t, "Progress Task 1", projID)
	env.createTask(t, "Progress Task 2", projID)

	// project_progress calls an RPC function; just verify it does not error.
	raw := env.mustCall(t, "project_progress", map[string]interface{}{
		"id": projID,
	})

	// The response should be valid JSON.
	if !json.Valid([]byte(raw)) {
		t.Fatalf("expected valid JSON from project_progress, got: %.300s", raw)
	}
}

func TestProjectProgressRequiresID(t *testing.T) {
	env := newTestEnv(t)

	text := env.expectError(t, "project_progress", map[string]interface{}{})
	if !strings.Contains(text, "id is required") {
		t.Errorf("expected 'id is required' error, got: %s", text)
	}
}
