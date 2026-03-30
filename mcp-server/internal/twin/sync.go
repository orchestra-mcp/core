package twin

import (
	"time"
)

// ActivityDigest is a daily summary of activity compiled from the AlertStore.
type ActivityDigest struct {
	Date            string       `json:"date"`
	ChannelsActive  []string     `json:"channels_active"`
	AlertsTotal     int          `json:"alerts_total"`
	AlertsActioned  int          `json:"alerts_actioned"`
	ResponseTimeAvg string       `json:"response_time_avg"`
	FocusBlocks     []FocusBlock `json:"focus_blocks"`
	MeetingsCount   int          `json:"meetings"`
	TasksCompleted  int          `json:"tasks_completed"`
	TasksCreated    int          `json:"tasks_created"`
}

// FocusBlock represents a period of uninterrupted work time.
type FocusBlock struct {
	Start    string `json:"start"`
	End      string `json:"end"`
	Duration string `json:"duration"`
}

// PriorityPatterns captures learned prioritization signals from alert history.
type PriorityPatterns struct {
	HighPriorityContacts  []string          `json:"high_priority_contacts"`
	HighPriorityChannels  []string          `json:"high_priority_channels"`
	LowPriorityChannels   []string          `json:"low_priority_channels"`
	ResponsePatterns      map[string]string `json:"response_patterns"`
}

// CrossSessionContext holds context that should persist across Claude sessions.
type CrossSessionContext struct {
	OpenThreads []OpenThread `json:"open_threads"`
}

// OpenThread is an in-flight conversation or task spanning multiple platforms.
type OpenThread struct {
	Topic        string   `json:"topic"`
	Platforms    []string `json:"platforms"`
	Status       string   `json:"status"`
	LastActivity string   `json:"last_activity"`
}

// RoutineTemplate captures learned daily routine preferences.
type RoutineTemplate struct {
	MorningOrder []string `json:"morning_order"`
	AvgDuration  string   `json:"avg_duration"`
	AutoTriage   bool     `json:"auto_triage"`
	EndOfDay     struct {
		Summary      bool `json:"summary"`
		TomorrowPrep bool `json:"tomorrow_prep"`
	} `json:"end_of_day"`
}

// SyncPayload is the full encrypted package sent to the cloud MCP server.
// Raw message content is never included — only aggregate stats and patterns.
type SyncPayload struct {
	Digest   ActivityDigest      `json:"digest"`
	Patterns PriorityPatterns    `json:"patterns"`
	Context  CrossSessionContext `json:"context"`
	Routine  RoutineTemplate     `json:"routine"`
}

// BuildDailyDigest compiles today's activity from the AlertStore.
// It counts alerts, identifies active channels, and counts meetings/tasks
// by type — never exposing raw message content.
func BuildDailyDigest(store *AlertStore) ActivityDigest {
	today := time.Now().Format("2006-01-02")
	alerts := store.GetAlerts(0, "") // all alerts

	// Count sources and typed events seen today.
	channelSet := make(map[string]struct{})
	totalToday := 0
	actionedToday := 0
	meetingsCount := 0
	tasksCompleted := 0
	tasksCreated := 0

	for _, a := range alerts {
		// Only count alerts from today.
		if a.CreatedAt.Format("2006-01-02") != today {
			continue
		}
		totalToday++
		channelSet[a.Source] = struct{}{}
		if a.Read {
			actionedToday++
		}
		switch a.Type {
		case "meeting", "calendar":
			meetingsCount++
		case "task_completed":
			tasksCompleted++
		case "task_created":
			tasksCreated++
		}
	}

	// Collect unique channels seen today.
	channels := make([]string, 0, len(channelSet))
	for ch := range channelSet {
		channels = append(channels, ch)
	}

	// Derive a rough response time label from actioned ratio.
	responseTimeAvg := "unknown"
	if totalToday > 0 {
		ratio := float64(actionedToday) / float64(totalToday)
		switch {
		case ratio >= 0.8:
			responseTimeAvg = "fast (<15m)"
		case ratio >= 0.5:
			responseTimeAvg = "moderate (<1h)"
		default:
			responseTimeAvg = "slow (>1h)"
		}
	}

	return ActivityDigest{
		Date:            today,
		ChannelsActive:  channels,
		AlertsTotal:     totalToday,
		AlertsActioned:  actionedToday,
		ResponseTimeAvg: responseTimeAvg,
		FocusBlocks:     []FocusBlock{}, // populated by future focus-tracking logic
		MeetingsCount:   meetingsCount,
		TasksCompleted:  tasksCompleted,
		TasksCreated:    tasksCreated,
	}
}

// BuildPriorityPatterns analyzes the AlertStore to infer which sources and
// contacts receive the fastest responses (high priority) versus are routinely
// left unread (low priority). No message content is examined.
func BuildPriorityPatterns(store *AlertStore) PriorityPatterns {
	alerts := store.GetAlerts(0, "") // all alerts

	type sourceStat struct {
		total    int
		actioned int
	}
	stats := make(map[string]*sourceStat)

	for _, a := range alerts {
		if _, ok := stats[a.Source]; !ok {
			stats[a.Source] = &sourceStat{}
		}
		stats[a.Source].total++
		if a.Read {
			stats[a.Source].actioned++
		}
	}

	high := make([]string, 0)
	low := make([]string, 0)
	patterns := make(map[string]string)

	for src, s := range stats {
		if s.total == 0 {
			continue
		}
		ratio := float64(s.actioned) / float64(s.total)
		switch {
		case ratio >= 0.7:
			high = append(high, src)
			patterns[src] = "fast-response"
		case ratio <= 0.3:
			low = append(low, src)
			patterns[src] = "low-engagement"
		default:
			patterns[src] = "normal"
		}
	}

	return PriorityPatterns{
		HighPriorityContacts:  []string{}, // contact-level analysis requires future identity extraction
		HighPriorityChannels:  high,
		LowPriorityChannels:   low,
		ResponsePatterns:      patterns,
	}
}
