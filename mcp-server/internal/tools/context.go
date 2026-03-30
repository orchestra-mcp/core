package tools

import (
	"context"
	"encoding/json"
	"fmt"
	"net/url"
	"strings"
	"time"

	"github.com/orchestra-mcp/server/internal/auth"
	"github.com/orchestra-mcp/server/internal/db"
	"github.com/orchestra-mcp/server/internal/mcp"
)

// ---------------------------------------------------------------------------
// JSON Schema
// ---------------------------------------------------------------------------

var contextGetSchema = json.RawMessage(`{
	"type": "object",
	"properties": {
		"project_id": {"type": "string", "format": "uuid", "description": "Filter context to a specific project (optional — omit for org-level context)"}
	}
}`)

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

// RegisterContextTools registers the context_get MCP tool.
func RegisterContextTools(registry *mcp.ToolRegistry, dbClient *db.Client) {
	registry.Register(
		"context_get",
		"Get a rich snapshot of the current project or org context: agents, decisions, meetings, tasks, and requests",
		contextGetSchema,
		makeContextGet(dbClient),
	)
}

// ---------------------------------------------------------------------------
// DB row types used only in this file
// ---------------------------------------------------------------------------

type ctxDecision struct {
	ID        string `json:"id"`
	Title     string `json:"title"`
	CreatedAt string `json:"created_at"`
}

type ctxMeeting struct {
	ID        string `json:"id"`
	Title     string `json:"title"`
	Status    string `json:"status"`
	Summary   string `json:"summary"`
	CreatedAt string `json:"created_at"`
}

type ctxTask struct {
	ID            string `json:"id"`
	Title         string `json:"title"`
	Status        string `json:"status"`
	AssignedAgent string `json:"assigned_agent_id"`
}

type ctxRequest struct {
	ID       string `json:"id"`
	Title    string `json:"title"`
	Priority string `json:"priority"`
	Status   string `json:"status"`
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

func makeContextGet(dbClient *db.Client) mcp.ToolHandler {
	return func(ctx context.Context, params json.RawMessage) (*mcp.ToolResult, error) {
		var input struct {
			ProjectID string `json:"project_id"`
		}
		if err := json.Unmarshal(params, &input); err != nil {
			return mcp.ErrorResult("invalid params: " + err.Error()), nil
		}

		userCtx := auth.UserContextFromContext(ctx)
		if userCtx == nil {
			return mcp.ErrorResult("authentication required"), nil
		}

		orgID := userCtx.OrgID
		projectID := input.ProjectID

		// --- 1. Agents: count + top 5 by name ---
		agents, err := fetchOrgAgents(ctx, dbClient, orgID)
		if err != nil {
			return mcp.ErrorResult("failed to fetch agents: " + err.Error()), nil
		}
		top5Agents := agents
		if len(top5Agents) > 5 {
			top5Agents = top5Agents[:5]
		}

		// --- 2. Recent decisions (last 10) ---
		decisions, err := fetchRecentDecisions(ctx, dbClient, orgID, projectID, 10)
		if err != nil {
			return mcp.ErrorResult("failed to fetch decisions: " + err.Error()), nil
		}

		// --- 3. Recent meetings (last 5) ---
		meetings, err := fetchRecentMeetings(ctx, dbClient, orgID, projectID, 5)
		if err != nil {
			return mcp.ErrorResult("failed to fetch meetings: " + err.Error()), nil
		}

		// --- 4. Active tasks (in_progress + blocked, top 5) ---
		activeTasks, err := fetchActiveTasks(ctx, dbClient, orgID, projectID)
		if err != nil {
			return mcp.ErrorResult("failed to fetch tasks: " + err.Error()), nil
		}
		inProgressCount := 0
		blockedCount := 0
		for _, t := range activeTasks {
			switch t.Status {
			case "in_progress":
				inProgressCount++
			case "blocked":
				blockedCount++
			}
		}
		top5Tasks := activeTasks
		if len(top5Tasks) > 5 {
			top5Tasks = top5Tasks[:5]
		}

		// --- 5. Pending requests (count + top 5) ---
		requests, err := fetchPendingRequests(ctx, dbClient, orgID, 5)
		if err != nil {
			return mcp.ErrorResult("failed to fetch requests: " + err.Error()), nil
		}

		// --- 6. Project progress (optional) ---
		projectProgress := ""
		if projectID != "" {
			projectProgress = fetchProjectProgress(ctx, dbClient, orgID, projectID)
		}

		// --- Build markdown response ---
		projectLabel := "all"
		if projectID != "" {
			projectLabel = projectID
		}

		today := time.Now().UTC().Format("2006-01-02")
		exportPath := fmt.Sprintf("context/%s-project-context.md", today)

		body := buildContextBody(userCtx, projectLabel, agents, top5Agents, decisions, meetings, activeTasks, top5Tasks, inProgressCount, blockedCount, requests, projectProgress)

		return mdResult(MarkdownResponse{
			Frontmatter: map[string]interface{}{
				"type":         "context",
				"user":         userCtx.UserID,
				"organization": orgID,
				"project":      projectLabel,
				"agents":       fmt.Sprintf("%d", len(agents)),
				"export":       exportPath,
			},
			Body: body,
			NextSteps: []NextStep{
				{Label: "Start meeting", Command: `meeting_create(title: "...")`},
				{Label: "Create task", Command: `task_create(title: "...")`},
				{Label: "Log request", Command: `request_create(title: "...")`},
				{Label: "Check status", Command: fmt.Sprintf(`context_get(project_id: "%s")`, projectLabel)},
			},
		}), nil
	}
}

// ---------------------------------------------------------------------------
// DB fetch helpers (context-specific)
// ---------------------------------------------------------------------------

func fetchRecentDecisions(ctx context.Context, dbClient *db.Client, orgID, projectID string, limit int) ([]ctxDecision, error) {
	q := url.Values{}
	q.Set("organization_id", "eq."+orgID)
	q.Set("order", "created_at.desc")
	q.Set("limit", fmt.Sprintf("%d", limit))
	q.Set("select", "id,title,created_at")
	if projectID != "" {
		q.Set("project_id", "eq."+projectID)
	}

	data, err := dbClient.Get(ctx, "decisions", q.Encode())
	if err != nil {
		return nil, err
	}

	var decisions []ctxDecision
	if err := json.Unmarshal(data, &decisions); err != nil {
		return nil, fmt.Errorf("unmarshal decisions: %w", err)
	}
	return decisions, nil
}

func fetchRecentMeetings(ctx context.Context, dbClient *db.Client, orgID, projectID string, limit int) ([]ctxMeeting, error) {
	q := url.Values{}
	q.Set("organization_id", "eq."+orgID)
	q.Set("order", "created_at.desc")
	q.Set("limit", fmt.Sprintf("%d", limit))
	q.Set("select", "id,title,status,summary,created_at")
	if projectID != "" {
		q.Set("project_id", "eq."+projectID)
	}

	data, err := dbClient.Get(ctx, "meetings", q.Encode())
	if err != nil {
		return nil, err
	}

	var meetings []ctxMeeting
	if err := json.Unmarshal(data, &meetings); err != nil {
		return nil, fmt.Errorf("unmarshal meetings: %w", err)
	}
	return meetings, nil
}

func fetchActiveTasks(ctx context.Context, dbClient *db.Client, orgID, projectID string) ([]ctxTask, error) {
	q := url.Values{}
	q.Set("organization_id", "eq."+orgID)
	q.Set("status", "in.(in_progress,blocked)")
	q.Set("order", "created_at.desc")
	q.Set("select", "id,title,status,assigned_agent_id")
	if projectID != "" {
		q.Set("project_id", "eq."+projectID)
	}

	data, err := dbClient.Get(ctx, "tasks", q.Encode())
	if err != nil {
		return nil, err
	}

	var tasks []ctxTask
	if err := json.Unmarshal(data, &tasks); err != nil {
		return nil, fmt.Errorf("unmarshal tasks: %w", err)
	}
	return tasks, nil
}

func fetchPendingRequests(ctx context.Context, dbClient *db.Client, orgID string, limit int) ([]ctxRequest, error) {
	q := url.Values{}
	q.Set("organization_id", "eq."+orgID)
	q.Set("status", "eq.pending")
	q.Set("order", "created_at.desc")
	q.Set("limit", fmt.Sprintf("%d", limit))
	q.Set("select", "id,title,priority,status")

	data, err := dbClient.Get(ctx, "requests", q.Encode())
	if err != nil {
		return nil, err
	}

	var requests []ctxRequest
	if err := json.Unmarshal(data, &requests); err != nil {
		return nil, fmt.Errorf("unmarshal requests: %w", err)
	}
	return requests, nil
}

// fetchProjectProgress returns a summary line for a project's task completion.
// Returns empty string on any error (non-fatal).
func fetchProjectProgress(_ context.Context, _ *db.Client, _, _ string) string {
	// Placeholder: full task-count-by-status query would require a RPC or
	// aggregation endpoint. Return a hint to use task_list for now.
	return "_Use `task_list(project_id: \"...\")` for full task breakdown._"
}

// ---------------------------------------------------------------------------
// Markdown body builder
// ---------------------------------------------------------------------------

func buildContextBody(
	userCtx *auth.UserContext,
	projectLabel string,
	agents []dbAgent,
	top5Agents []dbAgent,
	decisions []ctxDecision,
	meetings []ctxMeeting,
	activeTasks []ctxTask,
	top5Tasks []ctxTask,
	inProgressCount, blockedCount int,
	requests []ctxRequest,
	projectProgress string,
) string {
	var sb strings.Builder

	sb.WriteString("# Project Context\n\n")

	// --- Team section ---
	sb.WriteString(fmt.Sprintf("## Team\n%d agents available.", len(agents)))
	if len(top5Agents) > 0 {
		sb.WriteString(" Key members:\n\n")
		sb.WriteString("| Agent | Role | Model |\n")
		sb.WriteString("|-------|------|-------|\n")
		for _, a := range top5Agents {
			slug := a.Slug
			if slug == "" {
				slug = strings.ReplaceAll(strings.ToLower(a.Name), " ", "-")
			}
			role := a.Role
			if role == "" {
				role = "-"
			}
			model := a.Model
			if model == "" {
				model = "sonnet"
			}
			sb.WriteString(fmt.Sprintf("| %s | %s | %s |\n", slug, role, model))
		}
		sb.WriteString("\n")
	} else {
		sb.WriteString("\n\n")
	}

	// --- Recent decisions ---
	sb.WriteString(fmt.Sprintf("## Recent Decisions (%d)\n", len(decisions)))
	if len(decisions) > 0 {
		for i, d := range decisions {
			date := formatContextDate(d.CreatedAt)
			sb.WriteString(fmt.Sprintf("%d. %s — %s\n", i+1, d.Title, date))
		}
	} else {
		sb.WriteString("_No decisions logged yet._\n")
	}
	sb.WriteString("\n")

	// --- Recent meetings ---
	sb.WriteString(fmt.Sprintf("## Recent Meetings (%d)\n", len(meetings)))
	if len(meetings) > 0 {
		for i, m := range meetings {
			date := formatContextDate(m.CreatedAt)
			status := m.Status
			if status == "" {
				status = "unknown"
			}
			sb.WriteString(fmt.Sprintf("%d. %s — %s — %s\n", i+1, m.Title, status, date))
		}
	} else {
		sb.WriteString("_No meetings yet._\n")
	}
	sb.WriteString("\n")

	// --- Active tasks ---
	sb.WriteString("## Active Tasks\n")
	sb.WriteString(fmt.Sprintf("%d in progress, %d blocked\n", inProgressCount, blockedCount))
	if len(top5Tasks) > 0 {
		sb.WriteString("\n| Task | Status | Agent |\n")
		sb.WriteString("|------|--------|-------|\n")
		for _, t := range top5Tasks {
			agent := t.AssignedAgent
			if agent == "" {
				agent = "-"
			} else {
				// Truncate UUID to keep table readable
				if len(agent) > 8 {
					agent = agent[:8] + "..."
				}
			}
			sb.WriteString(fmt.Sprintf("| %s | %s | %s |\n", truncate(t.Title, 40), t.Status, agent))
		}
	} else {
		sb.WriteString("\n_No active tasks._\n")
	}
	sb.WriteString("\n")

	// --- Pending requests ---
	sb.WriteString(fmt.Sprintf("## Pending Requests (%d)\n", len(requests)))
	if len(requests) > 0 {
		sb.WriteString("\n| Request | Priority | Status |\n")
		sb.WriteString("|---------|----------|--------|\n")
		for _, r := range requests {
			priority := r.Priority
			if priority == "" {
				priority = "medium"
			}
			status := r.Status
			if status == "" {
				status = "pending"
			}
			sb.WriteString(fmt.Sprintf("| %s | %s | %s |\n", truncate(r.Title, 40), priority, status))
		}
	} else {
		sb.WriteString("_No pending requests._\n")
	}
	sb.WriteString("\n")

	// --- Project progress (only when project_id provided) ---
	if projectLabel != "all" && projectProgress != "" {
		sb.WriteString("## Project Progress\n")
		sb.WriteString(projectProgress)
		sb.WriteString("\n\n")
	}

	sb.WriteString("---\n")

	return sb.String()
}

// formatContextDate parses an RFC3339 timestamp and returns YYYY-MM-DD.
// Returns the raw string if parsing fails.
func formatContextDate(raw string) string {
	if raw == "" {
		return "-"
	}
	t, err := time.Parse(time.RFC3339, raw)
	if err != nil {
		// Try without nanoseconds
		t, err = time.Parse("2006-01-02T15:04:05", raw)
		if err != nil {
			if len(raw) >= 10 {
				return raw[:10]
			}
			return raw
		}
	}
	return t.Format("2006-01-02")
}
