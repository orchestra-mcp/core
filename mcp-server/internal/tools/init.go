package tools

import (
	"context"
	"encoding/json"
	"fmt"
	"net/url"
	"strings"

	"github.com/orchestra-mcp/server/internal/auth"
	"github.com/orchestra-mcp/server/internal/db"
	"github.com/orchestra-mcp/server/internal/mcp"
)

// ---------------------------------------------------------------------------
// JSON Schemas
// ---------------------------------------------------------------------------

var initSchema = json.RawMessage(`{
	"type": "object",
	"properties": {
		"project_name": {"type": "string", "description": "Name of the project being initialized (optional)"},
		"force":        {"type": "boolean", "default": false, "description": "Overwrite existing files (default false)"},
		"component":    {"type": "string", "enum": ["all", "rules", "agents", "skills", "hooks", "browser"], "default": "all", "description": "Which component to generate (default all)"}
	}
}`)

var initStatusSchema = json.RawMessage(`{
	"type": "object",
	"properties": {}
}`)

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

// RegisterInitTools registers the init and init_status MCP tools.
func RegisterInitTools(registry *mcp.ToolRegistry, dbClient *db.Client) {
	registry.Register("init", "Generate a complete init bundle for the user's project (rules, agents, skills, hooks, CLAUDE.md)", initSchema, makeInit(dbClient))
	registry.Register("init_status", "Check init readiness — returns org data and component counts", initStatusSchema, makeInitStatus(dbClient))
}

// ---------------------------------------------------------------------------
// DB row types (for JSON unmarshalling)
// ---------------------------------------------------------------------------

type dbAgent struct {
	ID           string `json:"id"`
	Name         string `json:"name"`
	Slug         string `json:"slug"`
	Role         string `json:"role"`
	Persona      string `json:"persona"`
	SystemPrompt string `json:"system_prompt"`
	Type         string `json:"type"`
	Status       string `json:"status"`
}

type dbSkill struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Slug        string `json:"slug"`
	Description string `json:"description"`
	Content     string `json:"content"`
	Category    string `json:"category"`
}

type dbProject struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Slug        string `json:"slug"`
	Description string `json:"description"`
	Status      string `json:"status"`
}

// ---------------------------------------------------------------------------
// Init bundle file
// ---------------------------------------------------------------------------

type initFile struct {
	Path       string `json:"path"`
	Content    string `json:"content"`
	Overwrite  bool   `json:"overwrite"`
	Executable bool   `json:"executable"`
}

// ---------------------------------------------------------------------------
// Handler: init
// ---------------------------------------------------------------------------

func makeInit(dbClient *db.Client) mcp.ToolHandler {
	return func(ctx context.Context, params json.RawMessage) (*mcp.ToolResult, error) {
		var input struct {
			ProjectName string `json:"project_name"`
			Force       bool   `json:"force"`
			Component   string `json:"component"`
		}
		if err := json.Unmarshal(params, &input); err != nil {
			return mcp.ErrorResult("invalid params: " + err.Error()), nil
		}

		component := input.Component
		if component == "" {
			component = "all"
		}

		// Validate component enum.
		validComponents := map[string]bool{
			"all": true, "rules": true, "agents": true,
			"skills": true, "hooks": true, "browser": true,
		}
		if !validComponents[component] {
			return mcp.ErrorResult("component must be one of: all, rules, agents, skills, hooks, browser"), nil
		}

		userCtx := auth.UserContextFromContext(ctx)
		if userCtx == nil {
			return mcp.ErrorResult("authentication required"), nil
		}

		// Query org data from DB.
		agents, err := fetchOrgAgents(ctx, dbClient, userCtx.OrgID)
		if err != nil {
			return mcp.ErrorResult("failed to fetch agents: " + err.Error()), nil
		}

		skills, err := fetchOrgSkills(ctx, dbClient, userCtx.OrgID)
		if err != nil {
			return mcp.ErrorResult("failed to fetch skills: " + err.Error()), nil
		}

		projects, err := fetchOrgProjects(ctx, dbClient, userCtx.OrgID)
		if err != nil {
			return mcp.ErrorResult("failed to fetch projects: " + err.Error()), nil
		}

		// Build the init bundle.
		var files []initFile

		if component == "all" || component == "rules" {
			files = append(files, generateRuleFiles(input.Force)...)
		}

		if component == "all" || component == "agents" {
			files = append(files, generateAgentFiles(agents, input.Force)...)
		}

		if component == "all" || component == "skills" {
			files = append(files, generateSkillFiles(input.Force)...)
		}

		if component == "all" || component == "hooks" {
			files = append(files, generateHookFiles(input.Force)...)
		}

		// Generate CLAUDE.md and AGENTS.md for "all" component.
		claudeMD := ""
		agentsMD := ""
		if component == "all" {
			claudeMD = generateClaudeMD(input.ProjectName, agents, skills, projects)
			agentsMD = generateAgentsMD(agents)

			files = append(files, initFile{
				Path:      "CLAUDE.md",
				Content:   claudeMD,
				Overwrite: input.Force,
			})
			files = append(files, initFile{
				Path:      "AGENTS.md",
				Content:   agentsMD,
				Overwrite: input.Force,
			})
		}

		// Build summary counts.
		ruleCount := 0
		agentCount := 0
		skillCount := 0
		hookCount := 0
		for _, f := range files {
			switch {
			case strings.HasPrefix(f.Path, ".claude/rules/"):
				ruleCount++
			case strings.HasPrefix(f.Path, ".claude/agents/"):
				agentCount++
			case strings.HasPrefix(f.Path, ".claude/skills/"):
				skillCount++
			case strings.HasPrefix(f.Path, ".claude/hooks/"):
				hookCount++
			}
		}

		summary := fmt.Sprintf("Init bundle generated: %d rules, %d agents, %d skills, %d hooks",
			ruleCount, agentCount, skillCount, hookCount)

		result := map[string]interface{}{
			"status":    "success",
			"files":     files,
			"claude_md": claudeMD,
			"agents_md": agentsMD,
			"summary":   summary,
		}

		return jsonResult(result)
	}
}

// ---------------------------------------------------------------------------
// Handler: init_status
// ---------------------------------------------------------------------------

func makeInitStatus(dbClient *db.Client) mcp.ToolHandler {
	return func(ctx context.Context, params json.RawMessage) (*mcp.ToolResult, error) {
		userCtx := auth.UserContextFromContext(ctx)
		if userCtx == nil {
			return mcp.ErrorResult("authentication required"), nil
		}

		agents, err := fetchOrgAgents(ctx, dbClient, userCtx.OrgID)
		if err != nil {
			return mcp.ErrorResult("failed to fetch agents: " + err.Error()), nil
		}

		skills, err := fetchOrgSkills(ctx, dbClient, userCtx.OrgID)
		if err != nil {
			return mcp.ErrorResult("failed to fetch skills: " + err.Error()), nil
		}

		projects, err := fetchOrgProjects(ctx, dbClient, userCtx.OrgID)
		if err != nil {
			return mcp.ErrorResult("failed to fetch projects: " + err.Error()), nil
		}

		// The "count" fields represent what is on the server side.
		// We always have 11 rules (hardcoded templates).
		// Agents come from DB. Skills and hooks are a mix of DB + templates.
		result := map[string]interface{}{
			"initialized": len(agents) > 0,
			"components": map[string]interface{}{
				"rules":  map[string]int{"count": len(rulesTemplates), "expected": len(rulesTemplates)},
				"agents": map[string]int{"count": len(agents), "expected": len(agents)},
				"skills": map[string]int{"count": len(skills), "expected": max(len(skills), 3)},
				"hooks":  map[string]int{"count": 2, "expected": 2},
			},
			"org": map[string]interface{}{
				"name":     "", // org name not directly available via agents table
				"agents":   len(agents),
				"projects": len(projects),
				"skills":   len(skills),
			},
		}

		return jsonResult(result)
	}
}

// ---------------------------------------------------------------------------
// DB fetch helpers
// ---------------------------------------------------------------------------

func fetchOrgAgents(ctx context.Context, dbClient *db.Client, orgID string) ([]dbAgent, error) {
	q := url.Values{}
	q.Set("organization_id", "eq."+orgID)
	q.Set("status", "eq.active")
	q.Set("order", "name.asc")

	data, err := dbClient.Get(ctx, "agents", q.Encode())
	if err != nil {
		return nil, err
	}

	var agents []dbAgent
	if err := json.Unmarshal(data, &agents); err != nil {
		return nil, fmt.Errorf("unmarshal agents: %w", err)
	}
	return agents, nil
}

func fetchOrgSkills(ctx context.Context, dbClient *db.Client, orgID string) ([]dbSkill, error) {
	q := url.Values{}
	q.Set("organization_id", "eq."+orgID)
	q.Set("order", "name.asc")

	data, err := dbClient.Get(ctx, "skills", q.Encode())
	if err != nil {
		return nil, err
	}

	var skills []dbSkill
	if err := json.Unmarshal(data, &skills); err != nil {
		return nil, fmt.Errorf("unmarshal skills: %w", err)
	}
	return skills, nil
}

func fetchOrgProjects(ctx context.Context, dbClient *db.Client, orgID string) ([]dbProject, error) {
	q := url.Values{}
	q.Set("organization_id", "eq."+orgID)
	q.Set("status", "eq.active")
	q.Set("order", "created_at.desc")

	data, err := dbClient.Get(ctx, "projects", q.Encode())
	if err != nil {
		return nil, err
	}

	var projects []dbProject
	if err := json.Unmarshal(data, &projects); err != nil {
		return nil, fmt.Errorf("unmarshal projects: %w", err)
	}
	return projects, nil
}

// ---------------------------------------------------------------------------
// Rule file generation (hardcoded templates)
// ---------------------------------------------------------------------------

// ruleTemplate holds the filename and content for a rule file.
type ruleTemplate struct {
	Filename string
	Content  string
}

// rulesTemplates contains the 11 Orchestra rules as hardcoded content.
var rulesTemplates = []ruleTemplate{
	{
		Filename: "01-plan-first.md",
		Content: `---
description: "Enforces plan-first development. Never start implementation before saving a plan to .plans/ directory."
globs: "*"
alwaysApply: true
---

# Rule 1: Plan-First Development

**Never start implementation before saving a plan.**

- Before writing any code, create a plan file in ` + "`" + `.plans/` + "`" + ` at the project root.
- Plan filename format: ` + "`" + `YYYY-MM-DD-{kebab-case-title}.md` + "`" + `
- The plan file must include:
  - **Title** and **Date**
  - **Objective** — what we are building and why
  - **Features** — broken down into discrete, deliverable features (see Rule 2)
  - **Small Wins** — each feature must identify its small win milestone (see Rule 9)
  - **DOD (Definition of Done)** — per-feature and overall (see Rule 6)
  - **Technical Notes** — architecture, dependencies, risks

## Plan Template

` + "```" + `markdown
# Plan: {Title}

**Date**: {YYYY-MM-DD}
**Status**: Draft | In Review | Approved | In Progress | Done

## Objective
{What are we building and why?}

## Features

### Feature 1: {Name}
**Small Win**: {What is the minimum deliverable that proves value?}
**DOD**:
- [ ] Tests pass
- [ ] Documentation written
- [ ] Code reviewed

#### Tasks
- [ ] Task 1
- [ ] Task 2

### Feature 2: {Name}
...

## Technical Notes
{Architecture decisions, dependencies, risks}
` + "```",
	},
	{
		Filename: "02-multi-feature-todos.md",
		Content: `---
description: "Plans must contain multiple features tracked via TODO list."
globs: "*"
alwaysApply: true
---

# Rule 2: Plans Must Be Multi-Feature with TODO Tracking

- Every plan must contain **multiple features** — even a single request should be broken into at least 2 logical features (e.g., core logic + tests, or backend + frontend).
- After the plan is approved, each feature's tasks become TODO items tracked via ` + "`" + `TodoWrite` + "`" + `.
- Work through TODOs sequentially — mark each as ` + "`" + `in_progress` + "`" + ` before starting and ` + "`" + `completed` + "`" + ` immediately after finishing.
- Only ONE todo should be ` + "`" + `in_progress` + "`" + ` at a time.`,
	},
	{
		Filename: "03-plan-review.md",
		Content: `---
description: "Always ask the user to review the plan before starting implementation using AskUserQuestion."
globs: "*"
alwaysApply: true
---

# Rule 3: Plan Review Before Execution

- After writing the plan to ` + "`" + `.plans/` + "`" + `, **always ask the user for review** using ` + "`" + `AskUserQuestion` + "`" + `.
- Present the plan summary and ask: "Does this plan look good to proceed?"
- Options: "Approve", "Needs Changes", "Let's Discuss"
- Do NOT start implementation until the user approves.
- If the user requests changes, update the plan file and ask again.`,
	},
	{
		Filename: "04-clarify-unknowns.md",
		Content: `---
description: "During planning, ask the user immediately about anything unclear using AskUserQuestion."
globs: "*"
alwaysApply: true
---

# Rule 4: Clarify Unknowns Early

- During planning, if anything is unclear — requirements, scope, priorities, technical approach — **ask the user immediately** using ` + "`" + `AskUserQuestion` + "`" + `.
- Do not guess or assume. Ask specific questions with clear options.
- It is better to ask 3 focused questions upfront than to redo work later.`,
	},
	{
		Filename: "05-interrupt-handling.md",
		Content: `---
description: "Never stop mid-flow. Save unrelated user requests to .requests/ and continue current work."
globs: "*"
alwaysApply: true
---

# Rule 5: Interrupt Handling — Never Stop Mid-Flow

If the user asks about something unrelated while you are working on a plan or task:

1. **Save the request** to ` + "`" + `.requests/` + "`" + ` as a markdown file.
2. Filename format: ` + "`" + `YYYY-MM-DD-{kebab-case-summary}.md` + "`" + `
3. Include the user's exact request and any context.
4. Acknowledge the request: "I've saved this to ` + "`" + `.requests/` + "`" + ` and will review it after the current task."
5. **Continue the current flow** without stopping.
6. After completing the current task, review ` + "`" + `.requests/` + "`" + ` and address pending items.

## Request Template

` + "```" + `markdown
# Request: {Summary}

**Date**: {YYYY-MM-DD HH:MM}
**Status**: Pending | Reviewed | Done
**Context**: {What were we doing when this came in?}

## User Request
{Exact user request}

## Notes
{Any relevant context or initial thoughts}
` + "```",
	},
	{
		Filename: "06-definition-of-done.md",
		Content: `---
description: "DOD: task is not done until tests pass, documentation is written in /docs/, and code quality checks pass."
globs: "*"
alwaysApply: true
---

# Rule 6: Definition of Done (DOD)

A task is NOT done until ALL of the following are met:

## 1. Tests Pass

Write tests appropriate to the language and framework:

- **PHP/Laravel**: Pest tests (` + "`" + `php artisan test --compact` + "`" + `)
- **Go**: ` + "`" + `go test ./... -v -race` + "`" + `
- **Rust**: ` + "`" + `cargo test` + "`" + `
- **JavaScript/Node**: ` + "`" + `npm test` + "`" + ` or ` + "`" + `npx vitest` + "`" + `
- **Flutter**: ` + "`" + `flutter test` + "`" + `

Tests must be written BEFORE marking the task as complete. Run the tests and confirm they pass.

## 2. Documentation Created

After every plan completion, create documentation in ` + "`" + `/docs/` + "`" + `:

` + "```" + `
/docs/
  {plan-name}/              # Subfolder matching the plan
    {feature-name}.md       # One file per feature
` + "```" + `

Each feature doc must include:

- **Overview** — what the feature does
- **How to Use** — usage examples, API endpoints, commands
- **How to Develop** — where the code lives, how to extend it
- **How It Works** — internal architecture, data flow

Write for a technical audience — clear, scannable, no fluff.

## 3. Code Quality

- Code formatted per project standards.
- No security vulnerabilities introduced.
- Follows existing project conventions.`,
	},
	{
		Filename: "07-component-ui-design.md",
		Content: `---
description: "All UI must use a component system design so changes reflect everywhere the component is used."
globs: "*.blade.php,*.vue,*.tsx,*.jsx,*.dart"
alwaysApply: true
---

# Rule 7: Component-Based UI Design

When designing any UI:

- **Use a component system** — every UI element must be a reusable component.
- Changes to a component must be reflected everywhere it is used.
- Before creating a new component, check if an existing one can be reused or extended.
- Component naming must be consistent with existing conventions (check sibling components).`,
	},
	{
		Filename: "08-package-scaffolding.md",
		Content: `---
description: "New packages must include README, .github workflows, issue templates, and proper directory structure."
globs: "packages/**"
alwaysApply: true
---

# Rule 8: Package Scaffolding Standards

When building a new package, it **must** include:

- README.md — Package overview, install, usage
- .github/workflows/tests.yml — CI pipeline
- .github/ISSUE_TEMPLATE/ — Bug report and feature request templates
- src/ — Core logic
- config/ — Configuration files
- tests/ — Tests

The README must include: description, installation, configuration, usage examples, and testing instructions.`,
	},
	{
		Filename: "09-small-wins.md",
		Content: `---
description: "Every feature must have a small win — the minimum deliverable that proves value. Never deliver without a real win."
globs: "*"
alwaysApply: true
---

# Rule 9: Small Wins — Deliver Incrementally

- **Never plan or deliver a large chunk without a real, demonstrable win.**
- When breaking a plan into features, each feature must have a **small win** — the minimum deliverable that proves the feature works and provides value.
- If a feature cannot be delivered as a small win, break it down further.

## Small Win Examples

| Bad (too big) | Good (small win) |
|---------------|------------------|
| "Build the entire auth system" | "User can register and see dashboard" |
| "Implement all CRUD operations" | "User can create and list items" |
| "Full API integration" | "One endpoint works end-to-end with test" |`,
	},
	{
		Filename: "10-parallel-execution.md",
		Content: `# Rule 10: Parallel Execution — Never Block the User

The main agent is a **conductor**, not a worker. Your job is to talk to the user, manage MCP lifecycle, and delegate.

## Core Principles

### 1. Never Make the User Wait

When the user asks for something, **immediately** launch sub-agents to start the work, then come back to the user to discuss what's next.

### 2. Parallel Multi-Agent Execution

After breaking a plan into features, **always run multiple sub-agents in parallel** for implementation.

### 3. Main Agent = Conductor, Sub-Agents = Workers

| Main Agent (You) | Sub-Agents (via Task tool) |
|-------------------|------------|
| Talk to the user | Write source code |
| Manage MCP lifecycle | Write tests |
| Launch and coordinate sub-agents | Read and explore files |
| Track progress | Research codebase |
| Present results for review | Run commands |`,
	},
	{
		Filename: "11-client-first.md",
		Content: `# Rule 11: Client-First Communication

The user is **the client** — the person who pays for the entire team's work. Every agent on the board works for the client.

## How to Treat the Client

1. **Respect** — Always address the client professionally.
2. **No assumptions** — Never say "You're right" without verifying data first.
3. **Data-first** — Before confirming ANY claim, status, or progress, check the codebase, check the board, cross-reference all sources, and report the REAL status with evidence.
4. **No sugar-coating** — If something is broken, behind, or wrong, say it directly.
5. **Proactive reporting** — Report blockers, risks, and real progress without being asked.
6. **Never blame the client** — If the client gives wrong information, verify and correct politely.
7. **Speak as service providers** — Use language like "We'll handle this", "Our team will deliver", "Here's what we found".`,
	},
}

func generateRuleFiles(force bool) []initFile {
	files := make([]initFile, 0, len(rulesTemplates))
	for _, r := range rulesTemplates {
		files = append(files, initFile{
			Path:      ".claude/rules/" + r.Filename,
			Content:   r.Content,
			Overwrite: force,
		})
	}
	return files
}

// ---------------------------------------------------------------------------
// Agent file generation (dynamic from DB)
// ---------------------------------------------------------------------------

func generateAgentFiles(agents []dbAgent, force bool) []initFile {
	files := make([]initFile, 0, len(agents))
	for _, a := range agents {
		slug := a.Slug
		if slug == "" {
			slug = strings.ReplaceAll(strings.ToLower(a.Name), " ", "-")
		}

		var sb strings.Builder
		sb.WriteString(fmt.Sprintf("# Agent: %s\n\n", a.Name))

		if a.Role != "" {
			sb.WriteString(fmt.Sprintf("**Role:** %s\n", a.Role))
		}
		if a.Type != "" {
			sb.WriteString(fmt.Sprintf("**Type:** %s\n", a.Type))
		}
		if a.Persona != "" {
			sb.WriteString(fmt.Sprintf("**Persona:** %s\n", a.Persona))
		}

		if a.SystemPrompt != "" {
			sb.WriteString("\n## System Prompt\n\n")
			sb.WriteString(a.SystemPrompt)
			sb.WriteString("\n")
		}

		files = append(files, initFile{
			Path:      ".claude/agents/" + slug + ".md",
			Content:   sb.String(),
			Overwrite: force,
		})
	}
	return files
}

// ---------------------------------------------------------------------------
// Skill file generation (basic Orchestra skills)
// ---------------------------------------------------------------------------

func generateSkillFiles(force bool) []initFile {
	return []initFile{
		{
			Path: ".claude/skills/orch:init/SKILL.md",
			Content: `# Skill: orch:init

Initialize or re-initialize the Orchestra MCP project configuration.

## Usage

Run ` + "`" + `/orch:init` + "`" + ` to generate:
- .claude/rules/ — 11 Orchestra development rules
- .claude/agents/ — Agent definitions from your org
- .claude/skills/ — Skill definitions
- .claude/hooks/ — Hook scripts
- CLAUDE.md — Project context for Claude Code
- AGENTS.md — Full agent roster

## Options
- ` + "`" + `component` + "`" + `: Generate only a specific component (rules, agents, skills, hooks, browser)
- ` + "`" + `force` + "`" + `: Overwrite existing files
- ` + "`" + `project_name` + "`" + `: Set the project name in generated files`,
			Overwrite: force,
		},
		{
			Path: ".claude/skills/orch:status/SKILL.md",
			Content: `# Skill: orch:status

Check the status of all Orchestra MCP services and implementation progress.

## Usage

Run ` + "`" + `/orch:status` + "`" + ` to see:
- Service health (MCP server, database, auth)
- Implementation progress (plan completion)
- Active sessions and recent activity`,
			Overwrite: force,
		},
		{
			Path: ".claude/skills/orch:pm/SKILL.md",
			Content: `# Skill: orch:pm

Project management and sprint planning.

## Usage

Run ` + "`" + `/orch:pm` + "`" + ` to:
- Plan and manage sprints
- Break down features into tasks
- Track progress and blockers
- Create architecture decision records (ADRs)`,
			Overwrite: force,
		},
	}
}

// ---------------------------------------------------------------------------
// Hook file generation
// ---------------------------------------------------------------------------

func generateHookFiles(force bool) []initFile {
	return []initFile{
		{
			Path: ".claude/hooks/notify.sh",
			Content: `#!/usr/bin/env bash
# Orchestra MCP — Notification Hook
# Called when important events occur (task complete, build fail, etc.)

set -euo pipefail

EVENT_TYPE="${1:-unknown}"
EVENT_DATA="${2:-}"

case "$EVENT_TYPE" in
  task_complete)
    echo "[Orchestra] Task completed: $EVENT_DATA"
    ;;
  build_fail)
    echo "[Orchestra] Build failed: $EVENT_DATA"
    ;;
  review_needed)
    echo "[Orchestra] Review needed: $EVENT_DATA"
    ;;
  *)
    echo "[Orchestra] Event: $EVENT_TYPE — $EVENT_DATA"
    ;;
esac
`,
			Overwrite: true,
			Executable: true,
		},
		{
			Path: ".claude/hooks/orchestra-mcp-hook.sh",
			Content: `#!/usr/bin/env bash
# Orchestra MCP — Master Hook Router
# Routes hook events to the appropriate handler scripts.

set -euo pipefail

HOOK_DIR="$(cd "$(dirname "$0")" && pwd)"
HOOK_NAME="${1:-}"
shift || true

case "$HOOK_NAME" in
  notify)
    exec "$HOOK_DIR/notify.sh" "$@"
    ;;
  *)
    echo "[Orchestra Hook] Unknown hook: $HOOK_NAME" >&2
    exit 1
    ;;
esac
`,
			Overwrite: true,
			Executable: true,
		},
	}
}

// ---------------------------------------------------------------------------
// CLAUDE.md generation
// ---------------------------------------------------------------------------

func generateClaudeMD(projectName string, agents []dbAgent, skills []dbSkill, projects []dbProject) string {
	var sb strings.Builder

	title := "Orchestra MCP Project"
	if projectName != "" {
		title = projectName
	}

	sb.WriteString(fmt.Sprintf("# %s\n\n", title))
	sb.WriteString("This project is powered by [Orchestra MCP](https://orchestra-mcp.com) — an AI-powered project management platform.\n\n")

	// Agents section.
	if len(agents) > 0 {
		sb.WriteString("## Agents\n\n")
		sb.WriteString("| Agent | Role | Type |\n")
		sb.WriteString("|-------|------|------|\n")
		for _, a := range agents {
			slug := a.Slug
			if slug == "" {
				slug = strings.ReplaceAll(strings.ToLower(a.Name), " ", "-")
			}
			role := a.Role
			if role == "" {
				role = "-"
			}
			agentType := a.Type
			if agentType == "" {
				agentType = "ai"
			}
			sb.WriteString(fmt.Sprintf("| `%s` | %s | %s |\n", slug, role, agentType))
		}
		sb.WriteString("\n")
	}

	// Skills section.
	if len(skills) > 0 {
		sb.WriteString("## Skills\n\n")
		sb.WriteString("| Skill | Description |\n")
		sb.WriteString("|-------|-------------|\n")
		for _, s := range skills {
			desc := s.Description
			if desc == "" {
				desc = "-"
			}
			sb.WriteString(fmt.Sprintf("| `%s` | %s |\n", s.Name, desc))
		}
		sb.WriteString("\n")
	}

	// Projects section.
	if len(projects) > 0 {
		sb.WriteString("## Projects\n\n")
		sb.WriteString("| Project | Description | Status |\n")
		sb.WriteString("|---------|-------------|--------|\n")
		for _, p := range projects {
			desc := p.Description
			if desc == "" {
				desc = "-"
			}
			sb.WriteString(fmt.Sprintf("| %s | %s | %s |\n", p.Name, desc, p.Status))
		}
		sb.WriteString("\n")
	}

	// Available tools section.
	sb.WriteString("## Available MCP Tools\n\n")
	sb.WriteString("Connect your MCP token to access Orchestra tools for:\n")
	sb.WriteString("- Project management (tasks, sprints, workflows)\n")
	sb.WriteString("- Agent coordination and memory\n")
	sb.WriteString("- Skill management\n")
	sb.WriteString("- Activity logging and decisions\n")
	sb.WriteString("- GitHub integration\n")
	sb.WriteString("- Notifications (Slack, Discord, Telegram)\n")

	return sb.String()
}

// ---------------------------------------------------------------------------
// AGENTS.md generation
// ---------------------------------------------------------------------------

func generateAgentsMD(agents []dbAgent) string {
	var sb strings.Builder

	sb.WriteString("# Orchestra Agents\n\n")
	sb.WriteString("Full roster of agents available in this organization.\n\n")

	if len(agents) == 0 {
		sb.WriteString("No agents configured yet. Use `agent_create` to add agents.\n")
		return sb.String()
	}

	sb.WriteString("| # | Name | Slug | Role | Type |\n")
	sb.WriteString("|---|------|------|------|------|\n")

	for i, a := range agents {
		slug := a.Slug
		if slug == "" {
			slug = strings.ReplaceAll(strings.ToLower(a.Name), " ", "-")
		}
		role := a.Role
		if role == "" {
			role = "-"
		}
		agentType := a.Type
		if agentType == "" {
			agentType = "ai"
		}
		sb.WriteString(fmt.Sprintf("| %d | %s | `%s` | %s | %s |\n", i+1, a.Name, slug, role, agentType))
	}

	sb.WriteString(fmt.Sprintf("\n**Total:** %d agents\n", len(agents)))

	return sb.String()
}
