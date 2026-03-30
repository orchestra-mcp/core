package tools

import (
	"context"
	"encoding/json"
	"fmt"
	"net/url"
	"os"
	"runtime"
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
		"component":    {"type": "string", "enum": ["all", "rules", "agents", "skills", "hooks"], "default": "all", "description": "Which component to generate (default all)"},
		"server_url":   {"type": "string", "description": "Orchestra MCP server URL (default: ORCHESTRA_BASE_URL env or http://localhost:9999)"},
		"token":        {"type": "string", "description": "MCP authentication token to embed in .mcp.json (default: placeholder)"}
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
	ID             string `json:"id"`
	Name           string `json:"name"`
	Slug           string `json:"slug"`
	Role           string `json:"role"`
	Persona        string `json:"persona"`
	SystemPrompt   string `json:"system_prompt"`
	Type           string `json:"type"`
	Model          string `json:"model"`
	Provider       string `json:"provider"`
	Status         string `json:"status"`
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
			ServerURL   string `json:"server_url"`
			Token       string `json:"token"`
		}
		if err := json.Unmarshal(params, &input); err != nil {
			return mcp.ErrorResult("invalid params: " + err.Error()), nil
		}

		component := input.Component
		if component == "" {
			component = "all"
		}

		// Resolve server URL: param > env > default.
		serverURL := input.ServerURL
		if serverURL == "" {
			serverURL = os.Getenv("ORCHESTRA_BASE_URL")
		}
		if serverURL == "" {
			serverURL = "http://localhost:9999"
		}
		// Strip trailing slash for consistent URL construction.
		serverURL = strings.TrimRight(serverURL, "/")

		// Validate component enum.
		validComponents := map[string]bool{
			"all": true, "rules": true, "agents": true,
			"skills": true, "hooks": true,
		}
		if !validComponents[component] {
			return mcp.ErrorResult("component must be one of: all, rules, agents, skills, hooks"), nil
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
			files = append(files, generateDBSkillFiles(skills, input.Force)...)
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

			// Generate .mcp.json for IDE integration.
			mcpJSON := generateMCPJSON(serverURL, input.Token)
			files = append(files, initFile{
				Path:      ".mcp.json",
				Content:   mcpJSON,
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

		// Build desktop installation info.
		baseURL := os.Getenv("ORCHESTRA_BASE_URL")
		if baseURL == "" {
			baseURL = "https://orchestra-mcp.com"
		}

		platform := runtime.GOOS + "-" + runtime.GOARCH
		desktopInfo := map[string]interface{}{
			"available":    true,
			"download_url": fmt.Sprintf("%s/api/bin/orchestra-desktop", baseURL),
			"platforms":    []string{"darwin-arm64", "darwin-amd64", "linux-amd64"},
			"install_path": "~/.orchestra/bin/orchestra-desktop",
			"version":      "0.2.0",
			"current_platform": platform,
			"instructions": "Download the desktop app for enhanced features: vision control, markdown editor, smart actions, and system tray integration.",
		}

		result := map[string]interface{}{
			"status":          "success",
			"files":           files,
			"claude_md":       claudeMD,
			"agents_md":       agentsMD,
			"summary":         summary,
			"desktop_install": desktopInfo,
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

1. **Save the request via MCP** using request_create(title, description, context, priority) — stored on cloud server.
2. If MCP unavailable, fallback to .requests/ markdown file.
3. Acknowledge: "I've saved this request and will review it after the current task."
4. **Continue the current flow** without stopping.
5. After completing, review pending requests via request_list(status: "pending").

## Tracking
- **List pending:** request_list(status: "pending")
- **Review:** request_update(id: "xxx", status: "reviewed")
- **Link to task:** request_update(id: "xxx", linked_task_id: "task-uuid")
- **Mark done:** request_update(id: "xxx", status: "done")`,
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

After breaking a plan into features, run sub-agents in parallel for implementation. Match each feature to the right agent.

### 3. Main Agent = Conductor, Sub-Agents = Workers

| Main Agent (You) | Sub-Agents (via Task tool) |
|-------------------|------------|
| Talk to the user | Write source code |
| Manage MCP lifecycle | Write tests |
| Launch and coordinate sub-agents | Read and explore files |
| Track progress | Research codebase |
| Present results for review | Run commands |

## Rate Limit Protection

API rate limits are **per account**, not per session. All sub-agents share the same token pool.

### Batch Size Rules
- **Max 2 implementation agents at a time** — never fire more than 2 code-writing agents simultaneously
- **Use sonnet model for implementation** — reserve Opus for planning/architecture
- **Research/Explore agents don't count** — they use fewer tokens, can run alongside

### Stagger Pattern
- Fire Batch 1 (2 agents) → wait for at least 1 to complete → Fire Batch 2 → repeat
- If rate limited: wait 60s, check what was written, re-fire only incomplete work
- **Never fire 4+ implementation agents at once**`,
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
	{
		Filename: "12-markdown-first-responses.md",
		Content: `# Rule 12: Markdown-First MCP Responses

ALL MCP tool responses use YAML frontmatter + Markdown body + Next Steps.

## Response Format

` + "```" + `
---
id: {uuid}
type: {entity_type}
status: {value}
export: {suggested/filepath.md}
related_rules: [R01, R06]
---

# {Title}

{Markdown body}

---

## Next Steps
- **{action}:** tool_name(param: "value")
` + "```" + `

## Rules

1. **YAML frontmatter** — IDs, type, status, export path, related rules. Structured data for tools.
2. **Markdown body** — Human-readable. Tables for lists, headings for sections, code blocks for examples.
3. **Next Steps** — Every response with follow-up actions MUST include exact tool calls the AI should use next.
4. **Related Rules** — When a response relates to project rules (planning, DOD, testing), include rule numbers in frontmatter.
5. **Export path** — Every response suggests where to save as markdown file.
6. **JSON only when required** — Raw JSON only when consumer needs structured data. Default is always markdown.`,
	},
	{
		Filename: "13-model-selection.md",
		Content: `---
description: 'Use the correct AI model per agent role to save tokens and avoid rate limits. Opus for planning, Sonnet for code, Haiku for lookups.'
globs: '*'
alwaysApply: true
---

# Rule 13: Model Selection — Right Model for Right Job

## Model Assignments

| Model | Cost | Use For | Agent Roles |
|-------|------|---------|-------------|
| **Opus** | $$$ | Planning, architecture, meetings, complex decisions, code review | CTO, CEO, COO, CAO, Tech Leader, Product Owner, Software Architect |
| **Sonnet** | $$ | Code writing, refactoring, tests, implementation, design specs | All developers, QA, Security, AI, AgentOps, Design, Project Manager |
| **Haiku** | $ | Status checks, lookups, formatting, documentation, simple queries | Technical Writer, Brand, Marketing, Sales, Community, status tools |

## Rules

1. **Never use Opus for implementation** — code writing, file modifications, test writing all use Sonnet
2. **Never use Opus for data retrieval** — status checks, list queries, context loading use Haiku
3. **Opus is reserved for** — architecture decisions, plan review, meeting facilitation, complex reasoning
4. **Agent model is stored in DB** — each agent has a ` + "`model`" + ` field (opus/sonnet/haiku)
5. **Orchestrator respects model** — when spawning an agent, use the model from their DB record
6. **Max 2 Sonnet agents simultaneously** — prevents rate limit (see Rule 10)
7. **Haiku agents don't count toward limit** — they're lightweight, run freely`,
	},
	{
		Filename: "14-a2ui-visualization.md",
		Content: `---
description: 'Agents can attach A2UI visualization components to responses for rendering in Claude Desktop artifact panel.'
globs: '*'
alwaysApply: true
---

# Rule 14: A2UI Visualization Suggestions

When an agent response would benefit from visual presentation, attach an A2UI component suggestion.

## When to Attach

- **Status reports** → Dashboard with stat cards and charts
- **Task lists** → Kanban board or sortable table
- **Agent roster** → Card grid with avatars and roles
- **Meeting transcript** → Chat-style conversation view
- **Code changes** → Diff viewer with syntax highlighting
- **Architecture** → Mermaid diagram rendered as SVG
- **Data** → Charts (bar, pie, line) for metrics

## Format

Add a ` + "`visualization`" + ` field to the YAML frontmatter:
` + "```" + `yaml
---
id: xxx
type: task_list
visualization:
  component: TaskBoard
  props:
    columns: [todo, in_progress, done]
    data: tasks
---
` + "```" + `

## Rules

1. **Visualization is optional** — only attach when it adds value
2. **Always include markdown fallback** — the markdown body IS the content, visualization is enhancement
3. **Keep props minimal** — reference data from the markdown body, don't duplicate
4. **Standard components** — use the component library (StatusDashboard, TaskBoard, AgentRoster, MeetingTranscript, CodeDiff, DiagramView)`,
	},
	{
		Filename: "15-multi-provider-agents.md",
		Content: `---
description: 'Agents can run on any supported AI provider. Provider is stored in DB and respected at spawn time.'
globs: '*'
alwaysApply: true
---

# Rule 15: Multi-Provider Agents

Agents can run on any supported AI provider. The provider is stored in the agent's DB record and respected at spawn time.

## Supported Providers

| Provider | Models | Notes |
|----------|--------|-------|
| ` + "`claude`" + ` | opus, sonnet, haiku | Default — Claude Code Bridge |
| ` + "`gemini`" + ` | gemini-2.0-flash, gemini-2.5-pro | Google Gemini via API |
| ` + "`openai`" + ` | gpt-4o, gpt-4.1, o3 | OpenAI via API |
| ` + "`deepseek`" + ` | deepseek-r2, deepseek-v3 | DeepSeek via API |
| ` + "`qwen`" + ` | qwen3-235b, qwen3-72b | Alibaba Qwen via API |
| ` + "`ollama`" + ` | llama3.3, mistral, etc. | Self-hosted via Ollama |

## Rules

1. **Default is Claude Code Bridge** — all agents default to ` + "`provider: \"claude\"`" + ` unless overridden
2. **MCP tools are universal interface** — every provider updates status via MCP tools regardless of which AI is running
3. **Provider stored in DB** — ` + "`agents.provider`" + ` and ` + "`agents.provider_config`" + ` hold provider and provider-specific config
4. **Model tier maps per provider** — ` + "`opus`" + ` → high-capability, ` + "`sonnet`" + ` → standard, ` + "`haiku`" + ` → fast/cheap
5. **Account pool auto-rotates on rate limit** — pulls next account from ` + "`user_configs.account_pool`" + ` and retries
6. **Never hard-code provider in tasks** — use agent slug; orchestrator resolves provider from DB record
7. **Ollama requires ` + "`base_url`" + `** — set ` + "`provider_config: {\"base_url\": \"http://localhost:11434\"}`" + ` for Ollama`,
	},
	{
		Filename: "16-config-persistence.md",
		Content: `---
description: 'User config is saved on the cloud MCP server and auto-loaded at session start for persistent preferences.'
globs: '*'
alwaysApply: true
---

# Rule 16: Config Persistence

User configuration is saved on the cloud MCP server and auto-loaded at session start. AI agents know user preferences without repeating setup every session.

## Config Keys

| Key | Type | Description |
|-----|------|-------------|
| ` + "`preferences`" + ` | object | Theme, language, notification settings |
| ` + "`active_project`" + ` | string | Current project ID |
| ` + "`work_patterns`" + ` | object | How user prefers to work (plan-first, async, etc.) |
| ` + "`account_pool`" + ` | array | API accounts with labels and tiers for provider rotation |
| ` + "`default_provider`" + ` | string | Preferred AI provider (claude, gemini, openai, deepseek, qwen, ollama) |
| ` + "`default_model`" + ` | string | Preferred model tier (opus, sonnet, haiku) |

## Rules

1. **Save preferences immediately** — when user states a preference, call ` + "`config_save`" + ` right away
2. **Load at session start** — always call ` + "`config_get()`" + ` at the beginning of a session
3. **Config is per-user per-org** — scoped to ` + "`(user_id, organization_id)`" + `, isolated per org
4. **Never ask twice** — if a preference is already saved, never ask about it again
5. **Work patterns guide delegation** — ` + "`work_patterns.style`" + ` influences how agents plan and delegate
6. **Account pool rotation** — rotate when rate-limited (see Rule 15)
7. **Default provider for new agents** — when ` + "`default_provider`" + ` is set, use it for new agents`,
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

		model := a.Model
		if model == "" {
			model = "sonnet"
		}
		agentType := a.Type
		if agentType == "" {
			agentType = "ai"
		}
		provider := a.Provider
		if provider == "" {
			provider = "claude"
		}

		var sb strings.Builder

		// YAML frontmatter
		sb.WriteString("---\n")
		sb.WriteString(fmt.Sprintf("name: %s\n", a.Name))
		sb.WriteString(fmt.Sprintf("slug: %s\n", slug))
		sb.WriteString(fmt.Sprintf("model: %s\n", model))
		sb.WriteString(fmt.Sprintf("provider: %s\n", provider))
		if a.Role != "" {
			sb.WriteString(fmt.Sprintf("role: %s\n", a.Role))
		}
		sb.WriteString(fmt.Sprintf("type: %s\n", agentType))
		sb.WriteString("---\n\n")

		// Heading
		sb.WriteString(fmt.Sprintf("# %s\n\n", a.Name))

		// Key fields
		if a.Role != "" {
			sb.WriteString(fmt.Sprintf("**Role:** %s\n", a.Role))
		}
		sb.WriteString(fmt.Sprintf("**Model:** %s\n", model))
		sb.WriteString(fmt.Sprintf("**Provider:** %s\n", provider))

		// Persona section
		if a.Persona != "" {
			sb.WriteString("\n## Persona\n")
			sb.WriteString(a.Persona)
			sb.WriteString("\n")
		}

		// System Prompt section
		if a.SystemPrompt != "" {
			sb.WriteString("\n## System Prompt\n")
			sb.WriteString(a.SystemPrompt)
			sb.WriteString("\n")
		}

		// Delegation section
		sb.WriteString("\n## Delegation\n")
		sb.WriteString("To assign work to this agent:\n")
		sb.WriteString(fmt.Sprintf("- `task_create(title: \"...\", assigned_agent_id: \"%s\")`\n", a.ID))
		sb.WriteString(fmt.Sprintf("- Or via orchestrator: `/orch agent %s \"do X\"`\n", slug))

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
			Path: ".claude/skills/orch/SKILL.md",
			Content: `---
name: Orchestra Orchestrator
description: Master orchestrator for Orchestra MCP. Identifies user, loads project context, drives the full team of agents and tools.
user_invocable: true
---

# /orch — Orchestra Orchestrator

You are the Orchestra Orchestrator — the master conductor of an AI company. When invoked, follow this flow exactly:

## Step 1: Identify User

Call ` + "`" + `context_get` + "`" + ` to load the full project context (user identity, agent roster, active tasks, pending requests).

Present a personalized welcome:
` + "```" + `
Welcome back, {user}! Organization: {org}
Team: {agent_count} agents | Tools: 93+ | Projects: {count}
` + "```" + `

## Step 2: Project Selection

List the user's projects. Ask them to select one, multiple (comma-separated), or "new" to create one. Auto-select if only one project exists.

## Step 3: Present Options

- **Think** — Brainstorm. Human talks, AI listens and asks clarifying questions.
- **Plan** — Create specs, break into features, save to .plans/. Follow R01 (Plan-First) and R02 (Multi-Feature).
- **Meet** — ` + "`" + `meeting_create` + "`" + ` with full agent team. Use correct model per agent (R13).
- **Status** — ` + "`" + `context_get` + "`" + ` with A2UI StatusDashboard (R14).
- **Task** — ` + "`" + `task_create` + "`" + ` → ` + "`" + `task_assign` + "`" + ` to the right agent.
- **Request** — ` + "`" + `request_create` + "`" + ` for later review.
- **Agent** — Direct a specific agent: ` + "`" + `/orch agent {slug} "instruction"` + "`" + `.

## Step 4: Human-in-the-Loop

The human decides WHAT to build; agents decide HOW. Never start coding without a plan (R01). Never skip plan review (R03).

| Human | Agents |
|-------|--------|
| Vision, requirements, priorities | Code (Sonnet) |
| Approve/reject plans | Tests (Sonnet) |
| Decisions during meetings | Architecture review (Opus) |
| Clarify unknowns | Documentation (Haiku) |

## Step 5: Delegation

| Action | Tool | Model |
|--------|------|-------|
| Think | Conversation | Opus |
| Plan | ` + "`" + `spec_create` + "`" + ` + save to .plans/ | Opus |
| Meet | ` + "`" + `meeting_create` + "`" + ` → ` + "`" + `meeting_message` + "`" + ` → ` + "`" + `meeting_end` + "`" + ` | Opus |
| Status | ` + "`" + `context_get` + "`" + ` | Haiku |
| Task | ` + "`" + `task_create` + "`" + ` → ` + "`" + `task_assign` + "`" + ` | Sonnet |
| Request | ` + "`" + `request_create` + "`" + ` | Haiku |
| Agent | ` + "`" + `Agent(model: "{from_db}", prompt: "...")` + "`" + ` | From DB |

## Rules Applied
R01 Plan-First · R03 Plan Review · R04 Clarify Unknowns · R10 Parallel Execution · R11 Client-First · R12 Markdown-First · R13 Model Selection · R14 A2UI
`,
			Overwrite: force,
		},
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
- ` + "`" + `component` + "`" + `: Generate only a specific component (rules, agents, skills, hooks)
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
		{
			Path: ".claude/skills/orch-meeting/SKILL.md",
			Content: `---
name: Orchestra Meeting
description: Start a team meeting with all agents. Shortcut for meeting_create.
user_invocable: true
---

# /orch-meeting — Start Team Meeting

When invoked, immediately:
1. Call ` + "`" + `meeting_create(title: "{user's topic or 'Team Meeting'}")` + "`" + ` — this auto-loads all 38 agents
2. Present the participant roster
3. Enter meeting mode — agents respond in character
4. Store every message via ` + "`" + `meeting_message` + "`" + `
5. Log decisions via ` + "`" + `decision_log(meeting_id: "...")` + "`" + `
6. When user says "end meeting" or "close" → call ` + "`" + `meeting_end` + "`" + ` with auto-summary

## A2UI Visualization
Suggest MeetingTranscript component for Claude Desktop:
` + "```" + `yaml
visualization:
  component: MeetingTranscript
  props:
    meeting_id: "{id}"
    live: true
` + "```",
			Overwrite: force,
		},
		{
			Path: ".claude/skills/orch-status/SKILL.md",
			Content: `---
name: Orchestra Status
description: Full project status dashboard. Shortcut for context_get.
user_invocable: true
---

# /orch-status — Project Status

When invoked:
1. Call ` + "`" + `context_get(project_id: "{current project or ask}")` + "`" + `
2. Present the full context as markdown
3. Highlight: blocked tasks, pending requests, recent decisions

## A2UI Visualization
Suggest StatusDashboard component:
` + "```" + `yaml
visualization:
  component: StatusDashboard
  props:
    agents: {count}
    tasks: {active_count}
    decisions: {recent_count}
` + "```",
			Overwrite: force,
		},
		{
			Path: ".claude/skills/orch-task/SKILL.md",
			Content: `---
name: Orchestra Task
description: Create and assign tasks. Shortcut for task_create.
user_invocable: true
---

# /orch-task — Create Task

When invoked with a description:
1. Parse the task description from the user's input
2. Determine the right agent based on the task type (Go work → go-developer, Frontend → frontend-developer, etc.)
3. Call ` + "`" + `task_create(title: "...", description: "...", assigned_agent_id: "{best agent}", priority: "...")` + "`" + `
4. Call ` + "`" + `task_comment_add(task_id: "...", message: "Initial requirements: ...")` + "`" + ` to add context
5. Present the created task with next steps

## A2UI Visualization
Suggest TaskBoard:
` + "```" + `yaml
visualization:
  component: TaskBoard
  props:
    project_id: "{id}"
` + "```",
			Overwrite: force,
		},
		{
			Path: ".claude/skills/orch-request/SKILL.md",
			Content: `---
name: Orchestra Request
description: Log a request for later review. Shortcut for request_create.
user_invocable: true
---

# /orch-request — Log Request

When invoked:
1. Parse the request from the user's input
2. Determine priority (critical/high/medium/low) from context
3. Call ` + "`" + `request_create(title: "...", description: "...", priority: "...", context: "{what we were doing}")` + "`" + `
4. Present the saved request with tracking next steps`,
			Overwrite: force,
		},
		{
			Path: ".claude/skills/orch-agent/SKILL.md",
			Content: `---
name: Orchestra Agent
description: Direct a specific agent to do work. Usage: /orch-agent {slug} {instruction}
user_invocable: true
---

# /orch-agent — Direct an Agent

When invoked with an agent slug and instruction:
1. Look up the agent from the MCP board via ` + "`" + `agent_get(slug: "{slug}")` + "`" + `
2. Get their model assignment (opus/sonnet/haiku)
3. Spawn a sub-agent using ` + "`" + `Agent(model: "{agent.model}", prompt: "{agent.system_prompt}\n\nTask: {instruction}")` + "`" + `
4. The spawned agent works on the task and reports back
5. If the task requires code, create a task via ` + "`" + `task_create` + "`" + ` and assign it

## Available Agents
Call ` + "`" + `agent_list` + "`" + ` to see all 38 agents with their roles and models.`,
			Overwrite: force,
		},
	}
}

// generateDBSkillFiles generates .claude/skills/{slug}/SKILL.md for each skill
// fetched from the database.
func generateDBSkillFiles(skills []dbSkill, force bool) []initFile {
	files := make([]initFile, 0, len(skills))
	for _, s := range skills {
		slug := s.Slug
		if slug == "" {
			slug = strings.ReplaceAll(strings.ToLower(s.Name), " ", "-")
		}

		var sb strings.Builder
		sb.WriteString(fmt.Sprintf("# Skill: %s\n\n", s.Name))

		if s.Description != "" {
			sb.WriteString(s.Description)
			sb.WriteString("\n\n")
		}
		if s.Category != "" {
			sb.WriteString(fmt.Sprintf("**Category:** %s\n\n", s.Category))
		}
		if s.Content != "" {
			sb.WriteString("## Content\n\n")
			sb.WriteString(s.Content)
			sb.WriteString("\n")
		}

		files = append(files, initFile{
			Path:      ".claude/skills/" + slug + "/SKILL.md",
			Content:   sb.String(),
			Overwrite: force,
		})
	}
	return files
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
			Overwrite:  true,
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
			Overwrite:  true,
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
		sb.WriteString("| Agent | Role | Type | Provider | Model |\n")
		sb.WriteString("|-------|------|------|----------|-------|\n")
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
			provider := a.Provider
			if provider == "" {
				provider = "claude"
			}
			model := a.Model
			if model == "" {
				model = "sonnet"
			}
			sb.WriteString(fmt.Sprintf("| `%s` | %s | %s | %s | %s |\n", slug, role, agentType, provider, model))
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

	sb.WriteString("| # | Name | Slug | Role | Type | Provider | Model |\n")
	sb.WriteString("|---|------|------|------|------|----------|-------|\n")

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
		provider := a.Provider
		if provider == "" {
			provider = "claude"
		}
		model := a.Model
		if model == "" {
			model = "sonnet"
		}
		sb.WriteString(fmt.Sprintf("| %d | %s | `%s` | %s | %s | %s | %s |\n", i+1, a.Name, slug, role, agentType, provider, model))
	}

	sb.WriteString(fmt.Sprintf("\n**Total:** %d agents\n", len(agents)))

	return sb.String()
}

// ---------------------------------------------------------------------------
// .mcp.json generation
// ---------------------------------------------------------------------------

// generateMCPJSON builds the .mcp.json configuration file that connects
// Claude Code, Claude Desktop, and Claude.ai to the Orchestra MCP server.
func generateMCPJSON(serverURL, token string) string {
	tok := token
	if tok == "" {
		tok = "YOUR_MCP_TOKEN"
	}
	mcpURL := fmt.Sprintf("%s/mcp?token=%s", serverURL, tok)

	cfg := map[string]interface{}{
		"mcpServers": map[string]interface{}{
			"orchestra-mcp": map[string]interface{}{
				"type": "http",
				"url":  mcpURL,
			},
		},
	}

	data, err := json.MarshalIndent(cfg, "", "  ")
	if err != nil {
		// Should never happen with static structure.
		return `{"mcpServers":{"orchestra-mcp":{"type":"http","url":"` + mcpURL + `"}}}`
	}
	return string(data) + "\n"
}
