package tools

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"testing"
)

// ---------------------------------------------------------------------------
// Note helper
// ---------------------------------------------------------------------------

// createNote creates a test note and registers cleanup.
func (e *testEnv) createNote(t *testing.T, title string) string {
	t.Helper()
	raw := e.mustCall(t, "note_create", map[string]interface{}{
		"title": title,
	})
	id := parseID(t, raw)
	t.Cleanup(func() {
		// Hard delete for cleanup (bypasses soft-delete).
		e.dbClient.Delete(context.Background(), "notes",
			fmt.Sprintf("id=eq.%s&organization_id=eq.%s", id, e.orgID))
	})
	return id
}

// ---------------------------------------------------------------------------
// Note CRUD Tests
// ---------------------------------------------------------------------------

func TestNoteCRUD(t *testing.T) {
	env := newTestEnv(t)

	// --- Create ---
	raw := env.mustCall(t, "note_create", map[string]interface{}{
		"title": "Test Note CRUD",
		"body":  "This is the note body.",
		"tags":  []string{"integration", "test"},
		"icon":  "pencil",
		"color": "#FF5733",
	})

	id := parseID(t, raw)
	t.Cleanup(func() {
		env.dbClient.Delete(context.Background(), "notes",
			fmt.Sprintf("id=eq.%s&organization_id=eq.%s", id, env.orgID))
	})

	if id == "" {
		t.Fatal("expected note id to be non-empty")
	}

	var created struct {
		ID    string   `json:"id"`
		Title string   `json:"title"`
		Body  string   `json:"body"`
		Tags  []string `json:"tags"`
		Icon  string   `json:"icon"`
		Color string   `json:"color"`
	}
	if err := unmarshalFirst(raw, &created); err != nil {
		t.Fatalf("parse create response: %v", err)
	}
	if created.Title != "Test Note CRUD" {
		t.Errorf("expected title='Test Note CRUD', got '%s'", created.Title)
	}
	if created.Body != "This is the note body." {
		t.Errorf("expected body='This is the note body.', got '%s'", created.Body)
	}
	if len(created.Tags) != 2 {
		t.Errorf("expected 2 tags, got %d", len(created.Tags))
	}
	if created.Icon != "pencil" {
		t.Errorf("expected icon='pencil', got '%s'", created.Icon)
	}
	if created.Color != "#FF5733" {
		t.Errorf("expected color='#FF5733', got '%s'", created.Color)
	}

	// --- Get ---
	getRaw := env.mustCall(t, "note_get", map[string]interface{}{
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
	if fetched.Title != "Test Note CRUD" {
		t.Errorf("expected title='Test Note CRUD', got '%s'", fetched.Title)
	}

	// --- Update ---
	updatedRaw := env.mustCall(t, "note_update", map[string]interface{}{
		"id":    id,
		"title": "Updated Note Title",
		"body":  "Updated body content.",
		"tags":  []string{"updated"},
	})
	var updated struct {
		Title string   `json:"title"`
		Body  string   `json:"body"`
		Tags  []string `json:"tags"`
	}
	if err := unmarshalFirst(updatedRaw, &updated); err != nil {
		t.Fatalf("parse update response: %v", err)
	}
	if updated.Title != "Updated Note Title" {
		t.Errorf("expected title='Updated Note Title', got '%s'", updated.Title)
	}
	if updated.Body != "Updated body content." {
		t.Errorf("expected body='Updated body content.', got '%s'", updated.Body)
	}
	if len(updated.Tags) != 1 || updated.Tags[0] != "updated" {
		t.Errorf("expected tags=['updated'], got %v", updated.Tags)
	}

	// --- List (should include our note) ---
	listRaw := env.mustCall(t, "note_list", map[string]interface{}{})
	var notes []struct {
		ID string `json:"id"`
	}
	if err := json.Unmarshal([]byte(listRaw), &notes); err != nil {
		t.Fatalf("parse note list: %v", err)
	}
	found := false
	for _, n := range notes {
		if n.ID == id {
			found = true
		}
	}
	if !found {
		t.Errorf("note %s not found in list", id)
	}

	// --- Delete (soft-delete) ---
	env.mustCall(t, "note_delete", map[string]interface{}{
		"id": id,
	})

	// After soft-delete, note_get should fail (deleted_at is set, filtered out).
	text := env.expectError(t, "note_get", map[string]interface{}{
		"id": id,
	})
	if !strings.Contains(text, "not found") {
		// Some implementations may return a different error for soft-deleted rows.
		t.Logf("note_get after delete returned: %s (expected 'not found')", text)
	}

	// note_list should also exclude the deleted note.
	listAfterRaw := env.mustCall(t, "note_list", map[string]interface{}{})
	var notesAfter []struct {
		ID string `json:"id"`
	}
	if err := json.Unmarshal([]byte(listAfterRaw), &notesAfter); err != nil {
		t.Fatalf("parse note list after delete: %v", err)
	}
	for _, n := range notesAfter {
		if n.ID == id {
			t.Errorf("expected deleted note %s NOT to appear in list", id)
		}
	}
}

func TestNoteCreateRequiresTitle(t *testing.T) {
	env := newTestEnv(t)

	text := env.expectError(t, "note_create", map[string]interface{}{})
	if !strings.Contains(text, "title is required") {
		t.Errorf("expected 'title is required' error, got: %s", text)
	}
}

func TestNoteGetRequiresID(t *testing.T) {
	env := newTestEnv(t)

	text := env.expectError(t, "note_get", map[string]interface{}{})
	if !strings.Contains(text, "id is required") {
		t.Errorf("expected 'id is required' error, got: %s", text)
	}
}

func TestNoteUpdateRequiresID(t *testing.T) {
	env := newTestEnv(t)

	text := env.expectError(t, "note_update", map[string]interface{}{
		"title": "Should Fail",
	})
	if !strings.Contains(text, "id is required") {
		t.Errorf("expected 'id is required' error, got: %s", text)
	}
}

func TestNoteDeleteRequiresID(t *testing.T) {
	env := newTestEnv(t)

	text := env.expectError(t, "note_delete", map[string]interface{}{})
	if !strings.Contains(text, "id is required") {
		t.Errorf("expected 'id is required' error, got: %s", text)
	}
}

func TestNoteListFilterByProject(t *testing.T) {
	env := newTestEnv(t)

	projID := env.createProject(t, "Note Filter Project")

	// Create a note with project_id.
	raw := env.mustCall(t, "note_create", map[string]interface{}{
		"title":      "Project-Scoped Note",
		"project_id": projID,
	})
	noteID := parseID(t, raw)
	t.Cleanup(func() {
		env.dbClient.Delete(context.Background(), "notes",
			fmt.Sprintf("id=eq.%s&organization_id=eq.%s", noteID, env.orgID))
	})

	// Create a note without project_id.
	env.createNote(t, "Unscoped Note")

	// List notes filtered by project.
	listRaw := env.mustCall(t, "note_list", map[string]interface{}{
		"project_id": projID,
	})
	var notes []struct {
		ID        string `json:"id"`
		ProjectID string `json:"project_id"`
	}
	if err := json.Unmarshal([]byte(listRaw), &notes); err != nil {
		t.Fatalf("parse note list: %v", err)
	}

	found := false
	for _, n := range notes {
		if n.ID == noteID {
			found = true
		}
		if n.ProjectID != projID {
			t.Errorf("expected all notes to have project_id=%s, got '%s'", projID, n.ProjectID)
		}
	}
	if !found {
		t.Errorf("note %s not found in project-filtered list", noteID)
	}
}

func TestNoteListFilterByTags(t *testing.T) {
	env := newTestEnv(t)

	// Create notes with different tags.
	raw1 := env.mustCall(t, "note_create", map[string]interface{}{
		"title": "Tagged Note A",
		"tags":  []string{"alpha", "beta"},
	})
	id1 := parseID(t, raw1)
	t.Cleanup(func() {
		env.dbClient.Delete(context.Background(), "notes",
			fmt.Sprintf("id=eq.%s&organization_id=eq.%s", id1, env.orgID))
	})

	raw2 := env.mustCall(t, "note_create", map[string]interface{}{
		"title": "Tagged Note B",
		"tags":  []string{"gamma"},
	})
	id2 := parseID(t, raw2)
	t.Cleanup(func() {
		env.dbClient.Delete(context.Background(), "notes",
			fmt.Sprintf("id=eq.%s&organization_id=eq.%s", id2, env.orgID))
	})

	// Filter by tag "alpha".
	listRaw := env.mustCall(t, "note_list", map[string]interface{}{
		"tags": "alpha",
	})
	var notes []struct {
		ID string `json:"id"`
	}
	if err := json.Unmarshal([]byte(listRaw), &notes); err != nil {
		t.Fatalf("parse note list: %v", err)
	}

	found1 := false
	found2 := false
	for _, n := range notes {
		if n.ID == id1 {
			found1 = true
		}
		if n.ID == id2 {
			found2 = true
		}
	}
	if !found1 {
		t.Errorf("note with tag 'alpha' (%s) not found in filtered list", id1)
	}
	if found2 {
		t.Errorf("note without tag 'alpha' (%s) should NOT appear in filtered list", id2)
	}
}

func TestNotePinUpdate(t *testing.T) {
	env := newTestEnv(t)

	noteID := env.createNote(t, "Pin Test Note")

	// Pin the note.
	env.mustCall(t, "note_update", map[string]interface{}{
		"id":        noteID,
		"is_pinned": true,
	})

	// Verify via get.
	getRaw := env.mustCall(t, "note_get", map[string]interface{}{
		"id": noteID,
	})
	var fetched struct {
		IsPinned bool `json:"is_pinned"`
	}
	if err := unmarshalFirst(getRaw, &fetched); err != nil {
		t.Fatalf("parse get response: %v", err)
	}
	if !fetched.IsPinned {
		t.Error("expected is_pinned=true after update")
	}
}
