package twin

import (
	"encoding/json"
	"testing"
	"time"
)

func makeTestStore(t *testing.T) *AlertStore {
	t.Helper()
	store := NewAlertStore(100)

	today := time.Now()
	yesterday := today.AddDate(0, 0, -1)

	alerts := []Alert{
		// Today — gmail, actioned (read)
		{ID: "1", Source: "gmail", Type: "dm", CreatedAt: today, Read: true, Data: json.RawMessage(`{}`)},
		// Today — gmail, not actioned
		{ID: "2", Source: "gmail", Type: "dm", CreatedAt: today, Read: false, Data: json.RawMessage(`{}`)},
		// Today — slack, actioned
		{ID: "3", Source: "slack", Type: "mention", CreatedAt: today, Read: true, Data: json.RawMessage(`{}`)},
		// Today — slack, actioned
		{ID: "4", Source: "slack", Type: "mention", CreatedAt: today, Read: true, Data: json.RawMessage(`{}`)},
		// Today — github, not actioned
		{ID: "5", Source: "github", Type: "pr_review", CreatedAt: today, Read: false, Data: json.RawMessage(`{}`)},
		// Today — meeting event
		{ID: "6", Source: "calendar", Type: "meeting", CreatedAt: today, Read: true, Data: json.RawMessage(`{}`)},
		// Today — task events
		{ID: "7", Source: "tasks", Type: "task_completed", CreatedAt: today, Read: true, Data: json.RawMessage(`{}`)},
		{ID: "8", Source: "tasks", Type: "task_created", CreatedAt: today, Read: true, Data: json.RawMessage(`{}`)},
		// Yesterday — should be excluded from today's digest
		{ID: "9", Source: "gmail", Type: "dm", CreatedAt: yesterday, Read: false, Data: json.RawMessage(`{}`)},
	}

	for _, a := range alerts {
		store.Add(a)
	}
	return store
}

func TestBuildDailyDigest_Counts(t *testing.T) {
	store := makeTestStore(t)
	digest := BuildDailyDigest(store)

	today := time.Now().Format("2006-01-02")
	if digest.Date != today {
		t.Errorf("date: got %q, want %q", digest.Date, today)
	}

	// 8 alerts today (not yesterday's)
	if digest.AlertsTotal != 8 {
		t.Errorf("alerts_total: got %d, want 8", digest.AlertsTotal)
	}

	// 6 actioned (Read=true) today
	if digest.AlertsActioned != 6 {
		t.Errorf("alerts_actioned: got %d, want 6", digest.AlertsActioned)
	}

	if digest.MeetingsCount != 1 {
		t.Errorf("meetings: got %d, want 1", digest.MeetingsCount)
	}

	if digest.TasksCompleted != 1 {
		t.Errorf("tasks_completed: got %d, want 1", digest.TasksCompleted)
	}

	if digest.TasksCreated != 1 {
		t.Errorf("tasks_created: got %d, want 1", digest.TasksCreated)
	}
}

func TestBuildDailyDigest_Channels(t *testing.T) {
	store := makeTestStore(t)
	digest := BuildDailyDigest(store)

	chanSet := make(map[string]struct{})
	for _, ch := range digest.ChannelsActive {
		chanSet[ch] = struct{}{}
	}

	expected := []string{"gmail", "slack", "github", "calendar", "tasks"}
	for _, ch := range expected {
		if _, ok := chanSet[ch]; !ok {
			t.Errorf("expected channel %q in active channels", ch)
		}
	}
}

func TestBuildDailyDigest_EmptyStore(t *testing.T) {
	store := NewAlertStore(100)
	digest := BuildDailyDigest(store)

	if digest.AlertsTotal != 0 {
		t.Errorf("empty store: expected 0 alerts, got %d", digest.AlertsTotal)
	}
	if len(digest.ChannelsActive) != 0 {
		t.Errorf("empty store: expected no channels, got %v", digest.ChannelsActive)
	}
}

func TestBuildPriorityPatterns_HighAndLow(t *testing.T) {
	store := makeTestStore(t)
	patterns := BuildPriorityPatterns(store)

	// slack: 2/2 read = 100% → high
	foundSlackHigh := false
	for _, ch := range patterns.HighPriorityChannels {
		if ch == "slack" {
			foundSlackHigh = true
		}
	}
	if !foundSlackHigh {
		t.Error("slack should be high priority (100% actioned)")
	}

	// github: 0/1 read = 0% → low
	foundGithubLow := false
	for _, ch := range patterns.LowPriorityChannels {
		if ch == "github" {
			foundGithubLow = true
		}
	}
	if !foundGithubLow {
		t.Error("github should be low engagement (0% actioned)")
	}
}

func TestBuildPriorityPatterns_ResponsePatterns(t *testing.T) {
	store := makeTestStore(t)
	patterns := BuildPriorityPatterns(store)

	if patterns.ResponsePatterns == nil {
		t.Fatal("response patterns should not be nil")
	}

	slackPattern, ok := patterns.ResponsePatterns["slack"]
	if !ok {
		t.Error("slack should have a response pattern")
	}
	if slackPattern != "fast-response" {
		t.Errorf("slack pattern: got %q, want %q", slackPattern, "fast-response")
	}

	githubPattern, ok := patterns.ResponsePatterns["github"]
	if !ok {
		t.Error("github should have a response pattern")
	}
	if githubPattern != "low-engagement" {
		t.Errorf("github pattern: got %q, want %q", githubPattern, "low-engagement")
	}
}
