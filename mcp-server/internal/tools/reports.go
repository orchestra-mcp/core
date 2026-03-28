package tools

import (
	"bytes"
	"context"
	"encoding/csv"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"github.com/orchestra-mcp/server/internal/auth"
	"github.com/orchestra-mcp/server/internal/db"
	"github.com/orchestra-mcp/server/internal/mcp"
	"github.com/xuri/excelize/v2"
	"github.com/yuin/goldmark"
)

// ---------------------------------------------------------------------------
// JSON Schema
// ---------------------------------------------------------------------------

var reportGenerateSchema = json.RawMessage(`{
	"type": "object",
	"properties": {
		"project_id": {
			"type": "string",
			"format": "uuid",
			"description": "Project UUID to generate report for"
		},
		"report_type": {
			"type": "string",
			"enum": ["architecture", "sprint", "cost", "status"],
			"description": "Type of report to generate"
		},
		"formats": {
			"type": "array",
			"items": {
				"type": "string",
				"enum": ["md", "pdf", "docx", "pptx", "xlsx", "csv"]
			},
			"description": "Output formats to generate"
		},
		"title": {
			"type": "string",
			"description": "Custom report title (auto-generated if omitted)"
		},
		"date_range": {
			"type": "object",
			"properties": {
				"from": {"type": "string", "description": "Start date (YYYY-MM-DD)"},
				"to":   {"type": "string", "description": "End date (YYYY-MM-DD)"}
			},
			"description": "Optional date range filter"
		}
	},
	"required": ["project_id", "report_type", "formats"]
}`)

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

// RegisterReportTools registers the report_generate MCP tool.
func RegisterReportTools(registry *mcp.ToolRegistry, dbClient *db.Client) {
	registry.Register(
		"report_generate",
		"Generate a multi-format report for a project by querying tasks, decisions, activity, and specs. Supports architecture, sprint, cost, and status reports in md/pdf/docx/pptx/xlsx/csv formats.",
		reportGenerateSchema,
		makeReportGenerate(dbClient),
	)
}

// ---------------------------------------------------------------------------
// Internal data structures
// ---------------------------------------------------------------------------

type reportProject struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
	Status      string `json:"status"`
}

type reportTask struct {
	ID             string   `json:"id"`
	Title          string   `json:"title"`
	Type           string   `json:"type"`
	Priority       string   `json:"priority"`
	Status         string   `json:"status"`
	AssignedAgent  string   `json:"assigned_agent_id"`
	Estimate       string   `json:"estimate"`
	Labels         []string `json:"labels"`
	CreatedAt      string   `json:"created_at"`
	CompletedAt    string   `json:"completed_at"`
	BlockedReason  string   `json:"blocked_reason"`
	Description    string   `json:"description"`
	Metadata       json.RawMessage `json:"metadata"`
}

type reportDecision struct {
	ID           string `json:"id"`
	Title        string `json:"title"`
	Decision     string `json:"decision"`
	Context      string `json:"context"`
	Alternatives string `json:"alternatives"`
	CreatedAt    string `json:"created_at"`
}

type reportActivity struct {
	ID        string `json:"id"`
	Action    string `json:"action"`
	Summary   string `json:"summary"`
	AgentID   string `json:"agent_id"`
	CreatedAt string `json:"created_at"`
}

type reportSpec struct {
	ID      string `json:"id"`
	Title   string `json:"title"`
	Status  string `json:"status"`
	Content string `json:"content"`
}

type reportData struct {
	Project    reportProject
	Tasks      []reportTask
	Decisions  []reportDecision
	Activities []reportActivity
	Specs      []reportSpec
}

type reportStats struct {
	TotalTasks      int
	Completed       int
	InProgress      int
	Blocked         int
	Todo            int
	CompletionPct   float64
	DecisionCount   int
	ActiveAgents    int
	ActiveAgentList []string
}

type reportFileResult struct {
	Format   string `json:"format"`
	FilePath string `json:"file_path"`
	SizeBytes int64 `json:"size_bytes"`
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

func makeReportGenerate(dbClient *db.Client) mcp.ToolHandler {
	return func(ctx context.Context, params json.RawMessage) (*mcp.ToolResult, error) {
		var input struct {
			ProjectID  string   `json:"project_id"`
			ReportType string   `json:"report_type"`
			Formats    []string `json:"formats"`
			Title      string   `json:"title"`
			DateRange  *struct {
				From string `json:"from"`
				To   string `json:"to"`
			} `json:"date_range"`
		}
		if err := json.Unmarshal(params, &input); err != nil {
			return mcp.ErrorResult("invalid params: " + err.Error()), nil
		}
		if input.ProjectID == "" {
			return mcp.ErrorResult("project_id is required"), nil
		}
		if input.ReportType == "" {
			return mcp.ErrorResult("report_type is required"), nil
		}
		if len(input.Formats) == 0 {
			return mcp.ErrorResult("formats is required and must not be empty"), nil
		}

		// Validate report_type.
		validTypes := map[string]bool{"architecture": true, "sprint": true, "cost": true, "status": true}
		if !validTypes[input.ReportType] {
			return mcp.ErrorResult("report_type must be one of: architecture, sprint, cost, status"), nil
		}

		// Validate formats.
		validFormats := map[string]bool{"md": true, "pdf": true, "docx": true, "pptx": true, "xlsx": true, "csv": true}
		for _, f := range input.Formats {
			if !validFormats[f] {
				return mcp.ErrorResult(fmt.Sprintf("invalid format %q; must be one of: md, pdf, docx, pptx, xlsx, csv", f)), nil
			}
		}

		userCtx := auth.UserContextFromContext(ctx)
		if userCtx == nil {
			return mcp.ErrorResult("authentication required"), nil
		}

		// 1. Fetch project data from PostgREST.
		data, err := fetchReportData(ctx, dbClient, input.ProjectID, userCtx.OrgID)
		if err != nil {
			return mcp.ErrorResult("failed to fetch project data: " + err.Error()), nil
		}

		// 2. Compute stats.
		stats := computeReportStats(data)

		// 3. Generate report title.
		reportTitle := input.Title
		if reportTitle == "" {
			reportTitle = fmt.Sprintf("%s Report: %s", capitalize(input.ReportType), data.Project.Name)
		}

		// 4. Generate markdown content based on report type.
		dateRangeStr := ""
		if input.DateRange != nil {
			dateRangeStr = fmt.Sprintf("%s to %s", input.DateRange.From, input.DateRange.To)
		}

		markdown := generateReportMarkdown(input.ReportType, reportTitle, data, stats, dateRangeStr)

		// 5. Create export directory.
		dir, err := ensureExportDir(userCtx.OrgID)
		if err != nil {
			return mcp.ErrorResult("failed to create export directory: " + err.Error()), nil
		}

		// Build a safe filename base.
		safeProject := sanitizeFilename(data.Project.Name)
		filenameBase := fmt.Sprintf("%s-%s-report", safeProject, input.ReportType)

		// 6. Generate each requested format.
		var files []reportFileResult
		for _, format := range input.Formats {
			var result *reportFileResult
			var genErr error

			switch format {
			case "md":
				result, genErr = generateReportMD(markdown, filenameBase, dir)
			case "pdf":
				result, genErr = generateReportPDF(ctx, markdown, filenameBase, dir)
			case "docx":
				result, genErr = generateReportDOCX(markdown, reportTitle, filenameBase, dir)
			case "pptx":
				result, genErr = generateReportPPTX(reportTitle, markdown, filenameBase, dir)
			case "xlsx":
				result, genErr = generateReportXLSX(reportTitle, data, stats, filenameBase, dir)
			case "csv":
				result, genErr = generateReportCSV(data, filenameBase, dir)
			}

			if genErr != nil {
				return mcp.ErrorResult(fmt.Sprintf("failed to generate %s: %s", format, genErr.Error())), nil
			}
			if result != nil {
				files = append(files, *result)
			}
		}

		// 7. Return result.
		output := map[string]interface{}{
			"project":     data.Project.Name,
			"report_type": input.ReportType,
			"files":       files,
		}
		return jsonResult(output)
	}
}

// ---------------------------------------------------------------------------
// Data fetching
// ---------------------------------------------------------------------------

func fetchReportData(ctx context.Context, dbClient *db.Client, projectID, orgID string) (*reportData, error) {
	data := &reportData{}

	// Fetch project.
	projQuery := fmt.Sprintf("id=eq.%s&organization_id=eq.%s&select=id,name,description,status", projectID, orgID)
	projRaw, err := dbClient.GetSingle(ctx, "projects", projQuery)
	if err != nil {
		return nil, fmt.Errorf("fetch project: %w", err)
	}
	if err := json.Unmarshal(projRaw, &data.Project); err != nil {
		return nil, fmt.Errorf("parse project: %w", err)
	}

	// Fetch tasks.
	taskQuery := fmt.Sprintf("project_id=eq.%s&organization_id=eq.%s&order=created_at.desc&limit=100&select=id,title,type,priority,status,assigned_agent_id,estimate,labels,created_at,completed_at,description,metadata", projectID, orgID)
	taskRaw, err := dbClient.Get(ctx, "tasks", taskQuery)
	if err != nil {
		return nil, fmt.Errorf("fetch tasks: %w", err)
	}
	if err := json.Unmarshal(taskRaw, &data.Tasks); err != nil {
		return nil, fmt.Errorf("parse tasks: %w", err)
	}

	// Fetch decisions.
	decQuery := fmt.Sprintf("project_id=eq.%s&organization_id=eq.%s&order=created_at.desc&limit=50&select=id,title,decision,context,alternatives,created_at", projectID, orgID)
	decRaw, err := dbClient.Get(ctx, "decisions", decQuery)
	if err != nil {
		return nil, fmt.Errorf("fetch decisions: %w", err)
	}
	if err := json.Unmarshal(decRaw, &data.Decisions); err != nil {
		return nil, fmt.Errorf("parse decisions: %w", err)
	}

	// Fetch activity log.
	actQuery := fmt.Sprintf("project_id=eq.%s&organization_id=eq.%s&order=created_at.desc&limit=50&select=id,action,summary,agent_id,created_at", projectID, orgID)
	actRaw, err := dbClient.Get(ctx, "activity_log", actQuery)
	if err != nil {
		return nil, fmt.Errorf("fetch activity: %w", err)
	}
	if err := json.Unmarshal(actRaw, &data.Activities); err != nil {
		return nil, fmt.Errorf("parse activity: %w", err)
	}

	// Fetch specs.
	specQuery := fmt.Sprintf("project_id=eq.%s&organization_id=eq.%s&order=created_at.desc&limit=20&select=id,title,status,content", projectID, orgID)
	specRaw, err := dbClient.Get(ctx, "specs", specQuery)
	if err != nil {
		return nil, fmt.Errorf("fetch specs: %w", err)
	}
	if err := json.Unmarshal(specRaw, &data.Specs); err != nil {
		return nil, fmt.Errorf("parse specs: %w", err)
	}

	return data, nil
}

// ---------------------------------------------------------------------------
// Stats computation
// ---------------------------------------------------------------------------

func computeReportStats(data *reportData) reportStats {
	stats := reportStats{
		TotalTasks:    len(data.Tasks),
		DecisionCount: len(data.Decisions),
	}

	agentSet := make(map[string]bool)
	for _, t := range data.Tasks {
		switch t.Status {
		case "done", "completed":
			stats.Completed++
		case "in_progress":
			stats.InProgress++
		case "blocked":
			stats.Blocked++
		default:
			stats.Todo++
		}
		if t.AssignedAgent != "" {
			agentSet[t.AssignedAgent] = true
		}
	}

	if stats.TotalTasks > 0 {
		stats.CompletionPct = float64(stats.Completed) / float64(stats.TotalTasks) * 100
	}

	for agent := range agentSet {
		stats.ActiveAgentList = append(stats.ActiveAgentList, agent)
	}
	stats.ActiveAgents = len(agentSet)

	return stats
}

// ---------------------------------------------------------------------------
// Markdown generation per report type
// ---------------------------------------------------------------------------

func generateReportMarkdown(reportType, title string, data *reportData, stats reportStats, dateRange string) string {
	switch reportType {
	case "architecture":
		return generateArchitectureReport(title, data, stats)
	case "sprint":
		return generateSprintReport(title, data, stats, dateRange)
	case "cost":
		return generateCostReport(title, data, stats, dateRange)
	case "status":
		return generateStatusReport(title, data, stats)
	default:
		return generateStatusReport(title, data, stats)
	}
}

func generateArchitectureReport(title string, data *reportData, stats reportStats) string {
	var sb strings.Builder
	now := time.Now().UTC().Format("January 2, 2006")

	sb.WriteString(fmt.Sprintf("# %s\n\nGenerated: %s\n\n", title, now))

	// Executive Summary.
	sb.WriteString("## Executive Summary\n\n")
	desc := data.Project.Description
	if desc == "" {
		desc = "No project description available"
	}
	sb.WriteString(fmt.Sprintf("%s. %d tasks tracked, %.0f%% complete.\n\n", desc, stats.TotalTasks, stats.CompletionPct))
	sb.WriteString(fmt.Sprintf("- **Total Tasks**: %d\n", stats.TotalTasks))
	sb.WriteString(fmt.Sprintf("- **Completed**: %d\n", stats.Completed))
	sb.WriteString(fmt.Sprintf("- **In Progress**: %d\n", stats.InProgress))
	sb.WriteString(fmt.Sprintf("- **Blocked**: %d\n", stats.Blocked))
	sb.WriteString(fmt.Sprintf("- **Active Agents**: %d\n\n", stats.ActiveAgents))

	// Specifications.
	if len(data.Specs) > 0 {
		sb.WriteString("## Specifications\n\n")
		for _, spec := range data.Specs {
			sb.WriteString(fmt.Sprintf("### %s\n\n", spec.Title))
			sb.WriteString(fmt.Sprintf("**Status**: %s\n\n", spec.Status))
			// Include a summary (first 200 chars of content).
			summary := spec.Content
			if len(summary) > 200 {
				summary = summary[:200] + "..."
			}
			sb.WriteString(fmt.Sprintf("%s\n\n", summary))
		}
	}

	// Key Decisions.
	if len(data.Decisions) > 0 {
		sb.WriteString("## Key Decisions\n\n")
		for _, d := range data.Decisions {
			sb.WriteString(fmt.Sprintf("### %s\n\n", d.Title))
			sb.WriteString(fmt.Sprintf("**Decision**: %s\n\n", d.Decision))
			if d.Context != "" {
				sb.WriteString(fmt.Sprintf("**Context**: %s\n\n", d.Context))
			}
			if d.Alternatives != "" {
				sb.WriteString(fmt.Sprintf("**Alternatives**: %s\n\n", d.Alternatives))
			}
		}
	}

	// Task Inventory.
	sb.WriteString("## Task Inventory\n\n")
	sb.WriteString("| Task | Type | Priority | Status | Assigned |\n")
	sb.WriteString("|------|------|----------|--------|----------|\n")
	for _, t := range data.Tasks {
		agent := t.AssignedAgent
		if agent == "" {
			agent = "-"
		} else if len(agent) > 8 {
			agent = agent[:8] + "..."
		}
		sb.WriteString(fmt.Sprintf("| %s | %s | %s | %s | %s |\n",
			t.Title, t.Type, t.Priority, t.Status, agent))
	}
	sb.WriteString("\n")

	// Architecture Diagram (Mermaid).
	sb.WriteString("## Architecture Diagram\n\n")
	sb.WriteString("```mermaid\n")
	sb.WriteString(generateArchitectureMermaid(data))
	sb.WriteString("```\n\n")

	// Recent Activity.
	if len(data.Activities) > 0 {
		sb.WriteString("## Recent Activity\n\n")
		limit := 10
		if len(data.Activities) < limit {
			limit = len(data.Activities)
		}
		for _, a := range data.Activities[:limit] {
			ts := formatTimestamp(a.CreatedAt)
			sb.WriteString(fmt.Sprintf("- **%s** %s (%s)\n", a.Action, a.Summary, ts))
		}
		sb.WriteString("\n")
	}

	return sb.String()
}

func generateSprintReport(title string, data *reportData, stats reportStats, dateRange string) string {
	var sb strings.Builder
	now := time.Now().UTC().Format("January 2, 2006")

	sb.WriteString(fmt.Sprintf("# %s\n\n", title))
	if dateRange != "" {
		sb.WriteString(fmt.Sprintf("Period: %s\n\n", dateRange))
	} else {
		weekAgo := time.Now().AddDate(0, 0, -7).Format("2006-01-02")
		today := time.Now().Format("2006-01-02")
		sb.WriteString(fmt.Sprintf("Period: %s to %s\n\n", weekAgo, today))
	}
	sb.WriteString(fmt.Sprintf("Generated: %s\n\n", now))

	// Completed.
	completed := filterTasksByStatus(data.Tasks, "done", "completed")
	sb.WriteString(fmt.Sprintf("## Completed (%d)\n\n", len(completed)))
	if len(completed) == 0 {
		sb.WriteString("No tasks completed in this period.\n\n")
	} else {
		for _, t := range completed {
			sb.WriteString(fmt.Sprintf("- **%s** [%s] %s\n", t.Title, t.Priority, t.Type))
		}
		sb.WriteString("\n")
	}

	// In Progress.
	inProgress := filterTasksByStatus(data.Tasks, "in_progress")
	sb.WriteString(fmt.Sprintf("## In Progress (%d)\n\n", len(inProgress)))
	if len(inProgress) == 0 {
		sb.WriteString("No tasks currently in progress.\n\n")
	} else {
		for _, t := range inProgress {
			sb.WriteString(fmt.Sprintf("- **%s** [%s] %s\n", t.Title, t.Priority, t.Type))
		}
		sb.WriteString("\n")
	}

	// Blocked.
	blocked := filterTasksByStatus(data.Tasks, "blocked")
	sb.WriteString(fmt.Sprintf("## Blocked (%d)\n\n", len(blocked)))
	if len(blocked) == 0 {
		sb.WriteString("No blocked tasks.\n\n")
	} else {
		for _, t := range blocked {
			reason := extractBlockedReason(t)
			if reason != "" {
				sb.WriteString(fmt.Sprintf("- **%s** — %s\n", t.Title, reason))
			} else {
				sb.WriteString(fmt.Sprintf("- **%s**\n", t.Title))
			}
		}
		sb.WriteString("\n")
	}

	// Key Decisions.
	if len(data.Decisions) > 0 {
		sb.WriteString("## Key Decisions\n\n")
		for _, d := range data.Decisions {
			sb.WriteString(fmt.Sprintf("- **%s**: %s\n", d.Title, d.Decision))
		}
		sb.WriteString("\n")
	}

	// KPIs.
	sb.WriteString("## KPIs\n\n")
	sb.WriteString(fmt.Sprintf("- Tasks completed: %d\n", stats.Completed))
	sb.WriteString(fmt.Sprintf("- Completion rate: %.0f%%\n", stats.CompletionPct))
	sb.WriteString(fmt.Sprintf("- Blocked items: %d\n", stats.Blocked))
	sb.WriteString(fmt.Sprintf("- Active agents: %d\n", stats.ActiveAgents))
	sb.WriteString(fmt.Sprintf("- Total tasks: %d\n\n", stats.TotalTasks))

	return sb.String()
}

func generateCostReport(title string, data *reportData, stats reportStats, dateRange string) string {
	var sb strings.Builder
	now := time.Now().UTC().Format("January 2, 2006")

	sb.WriteString(fmt.Sprintf("# %s\n\n", title))
	if dateRange != "" {
		sb.WriteString(fmt.Sprintf("Period: %s\n\n", dateRange))
	}
	sb.WriteString(fmt.Sprintf("Generated: %s\n\n", now))

	// Summary.
	sb.WriteString("## Summary\n\n")
	sb.WriteString(fmt.Sprintf("- **Total Tasks**: %d\n", stats.TotalTasks))
	sb.WriteString(fmt.Sprintf("- **Completed**: %d\n", stats.Completed))
	sb.WriteString(fmt.Sprintf("- **In Progress**: %d\n", stats.InProgress))
	sb.WriteString(fmt.Sprintf("- **Active Agents**: %d\n\n", stats.ActiveAgents))

	// Task Breakdown.
	sb.WriteString("## Task Breakdown\n\n")
	sb.WriteString("| Task | Estimate | Status | Agent |\n")
	sb.WriteString("|------|----------|--------|-------|\n")
	for _, t := range data.Tasks {
		estimate := t.Estimate
		if estimate == "" {
			estimate = "-"
		}
		agent := t.AssignedAgent
		if agent == "" {
			agent = "-"
		} else if len(agent) > 8 {
			agent = agent[:8] + "..."
		}
		sb.WriteString(fmt.Sprintf("| %s | %s | %s | %s |\n",
			t.Title, estimate, t.Status, agent))
	}
	sb.WriteString("\n")

	// Estimate Distribution.
	sb.WriteString("## Estimate Distribution\n\n")
	estimateCounts := make(map[string]int)
	for _, t := range data.Tasks {
		est := t.Estimate
		if est == "" {
			est = "Unestimated"
		}
		estimateCounts[est]++
	}
	for est, count := range estimateCounts {
		sb.WriteString(fmt.Sprintf("- **%s**: %d tasks\n", est, count))
	}
	sb.WriteString("\n")

	return sb.String()
}

func generateStatusReport(title string, data *reportData, stats reportStats) string {
	var sb strings.Builder
	now := time.Now().UTC().Format("January 2, 2006")

	sb.WriteString(fmt.Sprintf("# %s\n\n", title))
	sb.WriteString(fmt.Sprintf("Generated: %s\n\n", now))

	// Progress.
	sb.WriteString(fmt.Sprintf("## Progress: %.0f%%\n\n", stats.CompletionPct))
	sb.WriteString(fmt.Sprintf("- **Total**: %d tasks\n", stats.TotalTasks))
	sb.WriteString(fmt.Sprintf("- **Done**: %d\n", stats.Completed))
	sb.WriteString(fmt.Sprintf("- **In Progress**: %d\n", stats.InProgress))
	sb.WriteString(fmt.Sprintf("- **Blocked**: %d\n", stats.Blocked))
	sb.WriteString(fmt.Sprintf("- **Todo**: %d\n\n", stats.Todo))

	// Active Work.
	inProgress := filterTasksByStatus(data.Tasks, "in_progress")
	sb.WriteString(fmt.Sprintf("## Active Work (%d)\n\n", len(inProgress)))
	if len(inProgress) == 0 {
		sb.WriteString("No tasks currently in progress.\n\n")
	} else {
		for _, t := range inProgress {
			sb.WriteString(fmt.Sprintf("- **%s** [%s] %s\n", t.Title, t.Priority, t.Type))
		}
		sb.WriteString("\n")
	}

	// Blocked.
	blocked := filterTasksByStatus(data.Tasks, "blocked")
	sb.WriteString(fmt.Sprintf("## Blocked (%d)\n\n", len(blocked)))
	if len(blocked) == 0 {
		sb.WriteString("No blocked tasks.\n\n")
	} else {
		for _, t := range blocked {
			reason := extractBlockedReason(t)
			if reason != "" {
				sb.WriteString(fmt.Sprintf("- **%s** — %s\n", t.Title, reason))
			} else {
				sb.WriteString(fmt.Sprintf("- **%s**\n", t.Title))
			}
		}
		sb.WriteString("\n")
	}

	// Recent Activity.
	if len(data.Activities) > 0 {
		sb.WriteString("## Recent Activity\n\n")
		limit := 10
		if len(data.Activities) < limit {
			limit = len(data.Activities)
		}
		for _, a := range data.Activities[:limit] {
			ts := formatTimestamp(a.CreatedAt)
			sb.WriteString(fmt.Sprintf("- **%s** %s (%s)\n", a.Action, a.Summary, ts))
		}
		sb.WriteString("\n")
	}

	return sb.String()
}

// ---------------------------------------------------------------------------
// Mermaid diagram generation
// ---------------------------------------------------------------------------

func generateArchitectureMermaid(data *reportData) string {
	var sb strings.Builder
	sb.WriteString("graph TD\n")

	// Try to infer structure from specs and tasks.
	// If specs mention specific components, use them; otherwise generate a
	// generic project structure diagram.
	hasSpecContent := false
	for _, spec := range data.Specs {
		if strings.Contains(strings.ToLower(spec.Content), "api") ||
			strings.Contains(strings.ToLower(spec.Content), "database") ||
			strings.Contains(strings.ToLower(spec.Content), "server") {
			hasSpecContent = true
			break
		}
	}

	if hasSpecContent {
		// Build a diagram based on discovered components.
		sb.WriteString("  Client[Client/UI] --> API[API Server]\n")
		for _, spec := range data.Specs {
			lower := strings.ToLower(spec.Content)
			safeID := sanitizeMermaidID(spec.Title)
			if strings.Contains(lower, "database") || strings.Contains(lower, "postgres") {
				sb.WriteString(fmt.Sprintf("  API --> %s[%s]\n", safeID, spec.Title))
			} else if strings.Contains(lower, "auth") {
				sb.WriteString(fmt.Sprintf("  Client --> %s[%s]\n", safeID, spec.Title))
			} else {
				sb.WriteString(fmt.Sprintf("  API --> %s[%s]\n", safeID, spec.Title))
			}
		}
	} else {
		// Generic project structure.
		sb.WriteString("  Client[Client] --> MCP[MCP Server]\n")
		sb.WriteString("  MCP --> DB[(Database)]\n")
		sb.WriteString("  MCP --> Auth[Auth Service]\n")
		if len(data.Tasks) > 0 {
			sb.WriteString("  MCP --> Tasks[Task Engine]\n")
		}
		if len(data.Specs) > 0 {
			sb.WriteString("  MCP --> Specs[Spec Store]\n")
		}
	}

	return sb.String()
}

// ---------------------------------------------------------------------------
// File generation per format
// ---------------------------------------------------------------------------

func generateReportMD(markdown, filenameBase, dir string) (*reportFileResult, error) {
	filePath := filepath.Join(dir, filenameBase+".md")
	data := []byte(markdown)
	if err := os.WriteFile(filePath, data, 0644); err != nil {
		return nil, fmt.Errorf("write md: %w", err)
	}
	return &reportFileResult{
		Format:    "md",
		FilePath:  filePath,
		SizeBytes: int64(len(data)),
	}, nil
}

func generateReportPDF(ctx context.Context, markdown, filenameBase, dir string) (*reportFileResult, error) {
	// Convert Markdown to HTML using goldmark.
	var htmlBuf bytes.Buffer
	md := goldmark.New()
	if err := md.Convert([]byte(markdown), &htmlBuf); err != nil {
		return nil, fmt.Errorf("convert markdown: %w", err)
	}

	fullHTML := fmt.Sprintf(pdfHTMLTemplate, htmlBuf.String())

	htmlPath := filepath.Join(dir, filenameBase+".html")
	if err := os.WriteFile(htmlPath, []byte(fullHTML), 0644); err != nil {
		return nil, fmt.Errorf("write html: %w", err)
	}

	// Try wkhtmltopdf if available.
	if wkhtmltopdf, lookErr := exec.LookPath("wkhtmltopdf"); lookErr == nil {
		pdfPath := filepath.Join(dir, filenameBase+".pdf")
		args := []string{
			"--page-size", "A4",
			"--orientation", "Portrait",
			"--encoding", "UTF-8",
			"--margin-top", "20mm",
			"--margin-bottom", "20mm",
			"--margin-left", "15mm",
			"--margin-right", "15mm",
			htmlPath, pdfPath,
		}
		cmd := exec.CommandContext(ctx, wkhtmltopdf, args...)
		if _, err := cmd.CombinedOutput(); err == nil {
			os.Remove(htmlPath)
			info, err := os.Stat(pdfPath)
			if err != nil {
				return nil, fmt.Errorf("stat pdf: %w", err)
			}
			return &reportFileResult{
				Format:    "pdf",
				FilePath:  pdfPath,
				SizeBytes: info.Size(),
			}, nil
		}
	}

	// Fallback: return styled HTML.
	info, err := os.Stat(htmlPath)
	if err != nil {
		return nil, fmt.Errorf("stat html: %w", err)
	}
	return &reportFileResult{
		Format:    "html",
		FilePath:  htmlPath,
		SizeBytes: info.Size(),
	}, nil
}

func generateReportDOCX(markdown, title, filenameBase, dir string) (*reportFileResult, error) {
	docxBytes, err := buildDocx(markdown, title, "Orchestra MCP")
	if err != nil {
		return nil, fmt.Errorf("build docx: %w", err)
	}

	filePath := filepath.Join(dir, filenameBase+".docx")
	if err := os.WriteFile(filePath, docxBytes, 0644); err != nil {
		return nil, fmt.Errorf("write docx: %w", err)
	}

	return &reportFileResult{
		Format:    "docx",
		FilePath:  filePath,
		SizeBytes: int64(len(docxBytes)),
	}, nil
}

func generateReportPPTX(title, markdown, filenameBase, dir string) (*reportFileResult, error) {
	// Split markdown on ## headings to create slides.
	slides := markdownToSlides(title, markdown)

	pptxBytes, err := buildPptx(title, slides)
	if err != nil {
		return nil, fmt.Errorf("build pptx: %w", err)
	}

	filePath := filepath.Join(dir, filenameBase+".pptx")
	if err := os.WriteFile(filePath, pptxBytes, 0644); err != nil {
		return nil, fmt.Errorf("write pptx: %w", err)
	}

	return &reportFileResult{
		Format:    "pptx",
		FilePath:  filePath,
		SizeBytes: int64(len(pptxBytes)),
	}, nil
}

func generateReportXLSX(title string, data *reportData, stats reportStats, filenameBase, dir string) (*reportFileResult, error) {
	f := excelize.NewFile()
	defer f.Close()

	boldStyle, _ := f.NewStyle(&excelize.Style{
		Font: &excelize.Font{Bold: true},
	})

	// Sheet 1: Summary.
	f.SetSheetName("Sheet1", "Summary")
	summaryData := [][]string{
		{"Metric", "Value"},
		{"Total Tasks", fmt.Sprintf("%d", stats.TotalTasks)},
		{"Completed", fmt.Sprintf("%d", stats.Completed)},
		{"In Progress", fmt.Sprintf("%d", stats.InProgress)},
		{"Blocked", fmt.Sprintf("%d", stats.Blocked)},
		{"Todo", fmt.Sprintf("%d", stats.Todo)},
		{"Completion %", fmt.Sprintf("%.1f%%", stats.CompletionPct)},
		{"Active Agents", fmt.Sprintf("%d", stats.ActiveAgents)},
		{"Decisions", fmt.Sprintf("%d", stats.DecisionCount)},
	}

	// Write title.
	if title != "" {
		titleStyle, _ := f.NewStyle(&excelize.Style{
			Font: &excelize.Font{Bold: true, Size: 14},
		})
		f.SetCellValue("Summary", "A1", title)
		f.MergeCell("Summary", "A1", "B1")
		f.SetCellStyle("Summary", "A1", "B1", titleStyle)
	}

	startRow := 3
	for i, row := range summaryData {
		for j, val := range row {
			cell, _ := excelize.CoordinatesToCellName(j+1, startRow+i)
			f.SetCellValue("Summary", cell, val)
			if i == 0 {
				f.SetCellStyle("Summary", cell, cell, boldStyle)
			}
		}
	}
	f.SetColWidth("Summary", "A", "A", 20)
	f.SetColWidth("Summary", "B", "B", 15)

	// Sheet 2: Tasks.
	if _, err := f.NewSheet("Tasks"); err != nil {
		return nil, fmt.Errorf("create Tasks sheet: %w", err)
	}
	taskHeaders := []string{"Title", "Type", "Priority", "Status", "Estimate", "Assigned Agent"}
	for j, h := range taskHeaders {
		cell, _ := excelize.CoordinatesToCellName(j+1, 1)
		f.SetCellValue("Tasks", cell, h)
		f.SetCellStyle("Tasks", cell, cell, boldStyle)
	}
	for i, t := range data.Tasks {
		rowNum := i + 2
		values := []string{t.Title, t.Type, t.Priority, t.Status, t.Estimate, t.AssignedAgent}
		for j, val := range values {
			cell, _ := excelize.CoordinatesToCellName(j+1, rowNum)
			f.SetCellValue("Tasks", cell, val)
		}
	}
	// Auto-width for Tasks sheet.
	taskWidths := []float64{40, 12, 12, 14, 10, 20}
	for j, w := range taskWidths {
		colName, _ := excelize.ColumnNumberToName(j + 1)
		f.SetColWidth("Tasks", colName, colName, w)
	}

	// Sheet 3: Decisions (if any).
	if len(data.Decisions) > 0 {
		if _, err := f.NewSheet("Decisions"); err != nil {
			return nil, fmt.Errorf("create Decisions sheet: %w", err)
		}
		decHeaders := []string{"Title", "Decision", "Context", "Date"}
		for j, h := range decHeaders {
			cell, _ := excelize.CoordinatesToCellName(j+1, 1)
			f.SetCellValue("Decisions", cell, h)
			f.SetCellStyle("Decisions", cell, cell, boldStyle)
		}
		for i, d := range data.Decisions {
			rowNum := i + 2
			values := []string{d.Title, d.Decision, d.Context, formatTimestamp(d.CreatedAt)}
			for j, val := range values {
				cell, _ := excelize.CoordinatesToCellName(j+1, rowNum)
				f.SetCellValue("Decisions", cell, val)
			}
		}
		f.SetColWidth("Decisions", "A", "A", 30)
		f.SetColWidth("Decisions", "B", "B", 50)
		f.SetColWidth("Decisions", "C", "C", 40)
		f.SetColWidth("Decisions", "D", "D", 20)
	}

	filePath := filepath.Join(dir, filenameBase+".xlsx")
	if err := f.SaveAs(filePath); err != nil {
		return nil, fmt.Errorf("save xlsx: %w", err)
	}

	info, err := os.Stat(filePath)
	if err != nil {
		return nil, fmt.Errorf("stat xlsx: %w", err)
	}

	return &reportFileResult{
		Format:    "xlsx",
		FilePath:  filePath,
		SizeBytes: info.Size(),
	}, nil
}

func generateReportCSV(data *reportData, filenameBase, dir string) (*reportFileResult, error) {
	var buf bytes.Buffer

	// UTF-8 BOM for Excel compatibility.
	buf.Write([]byte{0xEF, 0xBB, 0xBF})

	writer := csv.NewWriter(&buf)

	headers := []string{"Title", "Type", "Priority", "Status", "Estimate", "Assigned Agent", "Created At"}
	if err := writer.Write(headers); err != nil {
		return nil, fmt.Errorf("write csv headers: %w", err)
	}

	for _, t := range data.Tasks {
		row := []string{t.Title, t.Type, t.Priority, t.Status, t.Estimate, t.AssignedAgent, t.CreatedAt}
		if err := writer.Write(row); err != nil {
			return nil, fmt.Errorf("write csv row: %w", err)
		}
	}

	writer.Flush()
	if err := writer.Error(); err != nil {
		return nil, fmt.Errorf("csv encoding: %w", err)
	}

	filePath := filepath.Join(dir, filenameBase+".csv")
	csvData := buf.Bytes()
	if err := os.WriteFile(filePath, csvData, 0644); err != nil {
		return nil, fmt.Errorf("write csv: %w", err)
	}

	return &reportFileResult{
		Format:    "csv",
		FilePath:  filePath,
		SizeBytes: int64(len(csvData)),
	}, nil
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// filterTasksByStatus returns tasks matching any of the given statuses.
func filterTasksByStatus(tasks []reportTask, statuses ...string) []reportTask {
	statusSet := make(map[string]bool, len(statuses))
	for _, s := range statuses {
		statusSet[s] = true
	}
	var result []reportTask
	for _, t := range tasks {
		if statusSet[t.Status] {
			result = append(result, t)
		}
	}
	return result
}

// extractBlockedReason pulls the blocked_reason from task metadata.
func extractBlockedReason(t reportTask) string {
	if t.Metadata == nil {
		return ""
	}
	var meta map[string]interface{}
	if err := json.Unmarshal(t.Metadata, &meta); err != nil {
		return ""
	}
	if reason, ok := meta["blocked_reason"].(string); ok {
		return reason
	}
	return ""
}

// formatTimestamp formats an RFC3339 timestamp to a shorter readable form.
func formatTimestamp(ts string) string {
	t, err := time.Parse(time.RFC3339, ts)
	if err != nil {
		// Try other common formats.
		t, err = time.Parse("2006-01-02T15:04:05", ts)
		if err != nil {
			return ts
		}
	}
	return t.Format("Jan 2, 2006 15:04")
}

// sanitizeFilename makes a string safe for use in file names.
func sanitizeFilename(name string) string {
	name = strings.ToLower(name)
	name = strings.Map(func(r rune) rune {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') || r == '-' || r == '_' {
			return r
		}
		if r == ' ' {
			return '-'
		}
		return -1
	}, name)
	if len(name) > 50 {
		name = name[:50]
	}
	if name == "" {
		name = "project"
	}
	return name
}

// sanitizeMermaidID makes a string safe for use as a Mermaid node ID.
func sanitizeMermaidID(s string) string {
	s = strings.Map(func(r rune) rune {
		if (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9') {
			return r
		}
		return -1
	}, s)
	if s == "" {
		s = "Node"
	}
	return s
}

// markdownToSlides splits markdown content on ## headings to create
// PPTX slide data. The first slide is a title slide.
func markdownToSlides(title, markdown string) []slideInput {
	var slides []slideInput

	// Title slide.
	slides = append(slides, slideInput{
		Title:   title,
		Bullets: []string{time.Now().UTC().Format("January 2, 2006"), "Generated by Orchestra MCP"},
	})

	lines := strings.Split(markdown, "\n")
	var currentTitle string
	var currentBullets []string

	flushSlide := func() {
		if currentTitle != "" {
			slides = append(slides, slideInput{
				Title:   currentTitle,
				Bullets: currentBullets,
			})
		}
		currentTitle = ""
		currentBullets = nil
	}

	for _, line := range lines {
		trimmed := strings.TrimSpace(line)

		// Detect ## heading (section-level).
		if strings.HasPrefix(trimmed, "## ") {
			flushSlide()
			currentTitle = strings.TrimPrefix(trimmed, "## ")
			continue
		}

		// Skip the H1 title (already on title slide) and empty lines.
		if strings.HasPrefix(trimmed, "# ") || trimmed == "" {
			continue
		}

		// Skip Mermaid code blocks for slides.
		if trimmed == "```mermaid" || trimmed == "```" {
			continue
		}

		// Skip table separators.
		if strings.HasPrefix(trimmed, "|--") || strings.HasPrefix(trimmed, "| --") {
			continue
		}

		// Convert markdown list items and table rows to bullets.
		if currentTitle != "" {
			bullet := trimmed
			// Strip leading markdown list markers.
			if strings.HasPrefix(bullet, "- ") {
				bullet = bullet[2:]
			} else if strings.HasPrefix(bullet, "* ") {
				bullet = bullet[2:]
			}
			// Strip bold markdown.
			bullet = strings.ReplaceAll(bullet, "**", "")

			// Limit bullet length for slides.
			if len(bullet) > 120 {
				bullet = bullet[:117] + "..."
			}

			if bullet != "" {
				currentBullets = append(currentBullets, bullet)
			}
		}
	}

	// Flush last slide.
	flushSlide()

	// Limit bullets per slide for readability.
	var trimmed []slideInput
	for _, s := range slides {
		if len(s.Bullets) > 8 {
			s.Bullets = s.Bullets[:8]
		}
		trimmed = append(trimmed, s)
	}

	return trimmed
}
