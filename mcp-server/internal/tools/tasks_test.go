package tools

import (
	"encoding/json"
	"strings"
	"testing"
)

// ---------------------------------------------------------------------------
// Task Lifecycle Tests
// ---------------------------------------------------------------------------

func TestTaskLifecycle(t *testing.T) {
	env := newTestEnv(t)

	projID := env.createProject(t, "Task Lifecycle Project")

	// --- Create ---
	raw := env.mustCall(t, "task_create", map[string]interface{}{
		"title":       "Lifecycle Task",
		"description": "A test task for lifecycle verification",
		"type":        "feature",
		"priority":    "high",
		"project_id":  projID,
		"labels":      []string{"test", "lifecycle"},
		"estimate":    "M",
	})

	id := parseID(t, raw)
	// Cleanup handled by createTask-style cleanup below.
	t.Cleanup(func() {
		env.dbClient.Delete(env.ctx, "tasks",
			"id=eq."+id+"&organization_id=eq."+env.orgID)
	})

	var created struct {
		ID       string   `json:"id"`
		Title    string   `json:"title"`
		Type     string   `json:"type"`
		Priority string   `json:"priority"`
		Status   string   `json:"status"`
		Labels   []string `json:"labels"`
		Estimate string   `json:"estimate"`
	}
	if err := unmarshalFirst(raw, &created); err != nil {
		t.Fatalf("parse create response: %v", err)
	}
	if created.Title != "Lifecycle Task" {
		t.Errorf("expected title='Lifecycle Task', got '%s'", created.Title)
	}
	if created.Type != "feature" {
		t.Errorf("expected type='feature', got '%s'", created.Type)
	}
	if created.Priority != "high" {
		t.Errorf("expected priority='high', got '%s'", created.Priority)
	}
	if created.Status != "todo" {
		t.Errorf("expected status='todo', got '%s'", created.Status)
	}
	if created.Estimate != "M" {
		t.Errorf("expected estimate='M', got '%s'", created.Estimate)
	}

	// --- Get ---
	getRaw := env.mustCall(t, "task_get", map[string]interface{}{
		"id": id,
	})
	var fetched struct {
		ID    string `json:"id"`
		Title string `json:"title"`
	}
	if err := unmarshalFirst(getRaw, &fetched); err != nil {
		t.Fatalf("parse get response: %v", err)
	}
	if fetched.ID != id {
		t.Errorf("expected id=%s, got %s", id, fetched.ID)
	}

	// --- Assign ---
	env.mustCall(t, "task_assign", map[string]interface{}{
		"id":      id,
		"user_id": env.userID,
	})

	// Verify assignment via get.
	assignedRaw := env.mustCall(t, "task_get", map[string]interface{}{
		"id": id,
	})
	var assigned struct {
		AssignedUserID string `json:"assigned_user_id"`
	}
	if err := unmarshalFirst(assignedRaw, &assigned); err != nil {
		t.Fatalf("parse assigned response: %v", err)
	}
	if assigned.AssignedUserID != env.userID {
		t.Errorf("expected assigned_user_id=%s, got '%s'", env.userID, assigned.AssignedUserID)
	}

	// --- Update (title and priority) ---
	updatedRaw := env.mustCall(t, "task_update", map[string]interface{}{
		"id":       id,
		"title":    "Updated Lifecycle Task",
		"priority": "critical",
	})
	var updated struct {
		Title    string `json:"title"`
		Priority string `json:"priority"`
	}
	if err := unmarshalFirst(updatedRaw, &updated); err != nil {
		t.Fatalf("parse update response: %v", err)
	}
	if updated.Title != "Updated Lifecycle Task" {
		t.Errorf("expected title='Updated Lifecycle Task', got '%s'", updated.Title)
	}
	if updated.Priority != "critical" {
		t.Errorf("expected priority='critical', got '%s'", updated.Priority)
	}

	// --- Complete ---
	// Note: task_complete checks for active workflows. Since we did NOT
	// apply a workflow, the call should succeed.
	completeRaw := env.mustCall(t, "task_complete", map[string]interface{}{
		"id": id,
	})
	var completed struct {
		Status      string `json:"status"`
		CompletedAt string `json:"completed_at"`
	}
	if err := unmarshalFirst(completeRaw, &completed); err != nil {
		t.Fatalf("parse complete response: %v", err)
	}
	if completed.Status != "done" {
		t.Errorf("expected status='done', got '%s'", completed.Status)
	}
	if completed.CompletedAt == "" {
		t.Error("expected completed_at to be set")
	}
}

func TestTaskCreateRequiresTitle(t *testing.T) {
	env := newTestEnv(t)

	text := env.expectError(t, "task_create", map[string]interface{}{})
	if !strings.Contains(text, "title is required") {
		t.Errorf("expected 'title is required' error, got: %s", text)
	}
}

func TestTaskGetRequiresID(t *testing.T) {
	env := newTestEnv(t)

	text := env.expectError(t, "task_get", map[string]interface{}{})
	if !strings.Contains(text, "id is required") {
		t.Errorf("expected 'id is required' error, got: %s", text)
	}
}

func TestTaskAssignRequiresAgentOrUser(t *testing.T) {
	env := newTestEnv(t)

	projID := env.createProject(t, "Assign Validation Project")
	taskID := env.createTask(t, "Assign Validation Task", projID)

	text := env.expectError(t, "task_assign", map[string]interface{}{
		"id": taskID,
	})
	if !strings.Contains(text, "agent_id or user_id is required") {
		t.Errorf("expected 'agent_id or user_id is required' error, got: %s", text)
	}
}

func TestTaskBlock(t *testing.T) {
	env := newTestEnv(t)

	taskID := env.createTask(t, "Block Test Task", "")

	blockRaw := env.mustCall(t, "task_block", map[string]interface{}{
		"id":     taskID,
		"reason": "Waiting on external dependency",
	})

	var blocked struct {
		Status   string                 `json:"status"`
		Metadata map[string]interface{} `json:"metadata"`
	}
	if err := unmarshalFirst(blockRaw, &blocked); err != nil {
		t.Fatalf("parse block response: %v", err)
	}
	if blocked.Status != "blocked" {
		t.Errorf("expected status='blocked', got '%s'", blocked.Status)
	}

	// Verify via get that block persisted.
	getRaw := env.mustCall(t, "task_get", map[string]interface{}{
		"id": taskID,
	})
	var fetched struct {
		Status string `json:"status"`
	}
	if err := unmarshalFirst(getRaw, &fetched); err != nil {
		t.Fatalf("parse get response: %v", err)
	}
	if fetched.Status != "blocked" {
		t.Errorf("expected persisted status='blocked', got '%s'", fetched.Status)
	}
}

func TestTaskBlockRequiresID(t *testing.T) {
	env := newTestEnv(t)

	text := env.expectError(t, "task_block", map[string]interface{}{})
	if !strings.Contains(text, "id is required") {
		t.Errorf("expected 'id is required' error, got: %s", text)
	}
}

func TestTaskDefaults(t *testing.T) {
	env := newTestEnv(t)

	raw := env.mustCall(t, "task_create", map[string]interface{}{
		"title": "Defaults Test Task",
	})
	id := parseID(t, raw)
	t.Cleanup(func() {
		env.dbClient.Delete(env.ctx, "tasks",
			"id=eq."+id+"&organization_id=eq."+env.orgID)
	})

	var task struct {
		Type     string `json:"type"`
		Priority string `json:"priority"`
		Status   string `json:"status"`
	}
	if err := unmarshalFirst(raw, &task); err != nil {
		t.Fatalf("parse response: %v", err)
	}
	if task.Type != "task" {
		t.Errorf("expected default type='task', got '%s'", task.Type)
	}
	if task.Priority != "medium" {
		t.Errorf("expected default priority='medium', got '%s'", task.Priority)
	}
	if task.Status != "todo" {
		t.Errorf("expected default status='todo', got '%s'", task.Status)
	}
}

func TestTaskListFilters(t *testing.T) {
	env := newTestEnv(t)

	projID := env.createProject(t, "Task Filter Project")

	// Create tasks with different priorities and statuses.
	t1 := env.createTask(t, "Critical Task", projID)
	env.mustCall(t, "task_update", map[string]interface{}{
		"id":       t1,
		"priority": "critical",
	})

	t2 := env.createTask(t, "Low Task", projID)
	env.mustCall(t, "task_update", map[string]interface{}{
		"id":       t2,
		"priority": "low",
	})

	t3 := env.createTask(t, "Blocked Task", projID)
	env.mustCall(t, "task_block", map[string]interface{}{
		"id": t3,
	})

	t.Run("filter by project", func(t *testing.T) {
		raw := env.mustCall(t, "task_list", map[string]interface{}{
			"project_id": projID,
		})
		var tasks []struct {
			ID string `json:"id"`
		}
		if err := json.Unmarshal([]byte(raw), &tasks); err != nil {
			t.Fatalf("parse task list: %v", err)
		}
		ids := map[string]bool{}
		for _, tk := range tasks {
			ids[tk.ID] = true
		}
		if !ids[t1] || !ids[t2] || !ids[t3] {
			t.Errorf("expected all 3 tasks in project list, found %v", ids)
		}
	})

	t.Run("filter by status", func(t *testing.T) {
		raw := env.mustCall(t, "task_list", map[string]interface{}{
			"project_id": projID,
			"status":     "blocked",
		})
		var tasks []struct {
			ID     string `json:"id"`
			Status string `json:"status"`
		}
		if err := json.Unmarshal([]byte(raw), &tasks); err != nil {
			t.Fatalf("parse task list: %v", err)
		}
		if len(tasks) < 1 {
			t.Fatal("expected at least 1 blocked task")
		}
		found := false
		for _, tk := range tasks {
			if tk.ID == t3 {
				found = true
				if tk.Status != "blocked" {
					t.Errorf("expected status='blocked', got '%s'", tk.Status)
				}
			}
		}
		if !found {
			t.Errorf("blocked task %s not found in filtered list", t3)
		}
	})

	t.Run("filter by priority", func(t *testing.T) {
		raw := env.mustCall(t, "task_list", map[string]interface{}{
			"project_id": projID,
			"priority":   "critical",
		})
		var tasks []struct {
			ID       string `json:"id"`
			Priority string `json:"priority"`
		}
		if err := json.Unmarshal([]byte(raw), &tasks); err != nil {
			t.Fatalf("parse task list: %v", err)
		}
		found := false
		for _, tk := range tasks {
			if tk.ID == t1 {
				found = true
			}
			if tk.Priority != "critical" {
				t.Errorf("expected priority='critical', got '%s'", tk.Priority)
			}
		}
		if !found {
			t.Errorf("critical task %s not found in filtered list", t1)
		}
	})
}

func TestTaskGetNext(t *testing.T) {
	env := newTestEnv(t)

	projID := env.createProject(t, "GetNext Project")

	// Create tasks — get_next calls an RPC function. We just verify it
	// does not error and returns valid JSON.
	env.createTask(t, "GetNext Task 1", projID)
	env.createTask(t, "GetNext Task 2", projID)

	raw := env.mustCall(t, "task_get_next", map[string]interface{}{
		"project_id": projID,
	})

	if !json.Valid([]byte(raw)) {
		t.Fatalf("expected valid JSON from task_get_next, got: %.300s", raw)
	}
}

func TestTaskCompleteRequiresID(t *testing.T) {
	env := newTestEnv(t)

	text := env.expectError(t, "task_complete", map[string]interface{}{})
	if !strings.Contains(text, "id is required") {
		t.Errorf("expected 'id is required' error, got: %s", text)
	}
}

func TestTaskUpdateRequiresID(t *testing.T) {
	env := newTestEnv(t)

	text := env.expectError(t, "task_update", map[string]interface{}{
		"title": "Should Fail",
	})
	if !strings.Contains(text, "id is required") {
		t.Errorf("expected 'id is required' error, got: %s", text)
	}
}
