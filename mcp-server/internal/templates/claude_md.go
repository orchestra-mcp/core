package templates

import (
	"bytes"
	"text/template"
)

// ---------------------------------------------------------------------------
// Data types for CLAUDE.md generation
// ---------------------------------------------------------------------------

// CLAUDEMDData holds all data needed to generate a customized CLAUDE.md.
type CLAUDEMDData struct {
	OrgName      string
	ProjectName  string
	Agents       []AgentInfo
	Skills       []SkillInfo
	Projects     []ProjectInfo
	MCPToolCount int
	MCPURL       string
}

// AgentInfo represents a single agent entry for the CLAUDE.md roster.
type AgentInfo struct {
	Name string
	Slug string
	Role string
	Type string // "ai", "human", "hybrid"
}

// SkillInfo represents a single skill entry for the CLAUDE.md skills table.
type SkillInfo struct {
	Name     string
	Slug     string
	Category string
}

// ProjectInfo represents a project listed in CLAUDE.md.
type ProjectInfo struct {
	Name string
	Slug string
}

// ---------------------------------------------------------------------------
// Template
// ---------------------------------------------------------------------------

const claudeMDTemplate = `# CLAUDE.md — {{ .OrgName }}{{ if .ProjectName }}: {{ .ProjectName }}{{ end }}

This project uses [Orchestra MCP](https://orchestra-mcp.com) for AI-powered project management and autonomous workflows.

## Orchestra MCP Connection

| Setting | Value |
|---------|-------|
| MCP URL | {{ if .MCPURL }}` + "`{{ .MCPURL }}`" + `{{ else }}*(not configured)*{{ end }} |
| Available Tools | **{{ .MCPToolCount }}** MCP tools |
| Organization | {{ .OrgName }} |

Connect your MCP token to Claude Code, Claude Desktop, or Claude.ai to access all tools.

## Agents
{{ if .Agents }}
| Name | Slug | Role | Type |
|------|------|------|------|
{{ range .Agents -}}
| {{ .Name }} | ` + "`{{ .Slug }}`" + ` | {{ .Role }} | {{ .Type }} |
{{ end -}}
{{ else }}
*No agents configured yet. Create agents with the ` + "`agent_create`" + ` tool.*
{{ end }}
## Skills
{{ if .Skills }}
| Name | Slug | Category |
|------|------|----------|
{{ range .Skills -}}
| {{ .Name }} | ` + "`{{ .Slug }}`" + ` | {{ .Category }} |
{{ end -}}
{{ else }}
*No skills configured yet. Create skills with the ` + "`skill_create`" + ` tool.*
{{ end }}
## Projects
{{ if .Projects }}
{{ range .Projects -}}
- **{{ .Name }}** (` + "`{{ .Slug }}`" + `)
{{ end -}}
{{ else }}
*No projects yet. Create one with the ` + "`project_create`" + ` tool.*
{{ end }}
## Orchestra Rules

The following rules govern how agents operate:

| # | Rule | Summary |
|---|------|---------|
| 01 | Plan-First | Save plan before any code |
| 02 | Multi-Feature TODOs | Plans have multiple features, tracked via TODO |
| 03 | Plan Review | Ask user to approve plan before implementing |
| 04 | Clarify Unknowns | Ask early, don't guess |
| 05 | Interrupt Handling | Save unrelated requests, continue current work |
| 06 | Definition of Done | Tests pass + docs written + code quality |
| 07 | Component UI | Reusable components, no inline duplication |
| 08 | Package Scaffolding | Standard package structure |
| 09 | Small Wins | Each feature must have a minimum deliverable |
| 10 | Parallel Execution | Main agent = conductor, delegate all work |
| 11 | Client-First | Data-first, no sugar-coating, verify before reporting |
| 15 | Multi-Provider Agents | Agents run on Claude, Gemini, OpenAI, DeepSeek, Qwen, or Ollama |
| 16 | Config Persistence | User config saved to cloud, auto-loaded each session |

## Multi-Provider Agents

Agents can run on any supported AI provider. Each agent has a ` + "`provider`" + ` and optional ` + "`provider_config`" + ` stored in the DB.

| Provider | Notes |
|----------|-------|
| ` + "`claude`" + ` | Default — Claude Code Bridge |
| ` + "`gemini`" + ` | Google Gemini via API |
| ` + "`openai`" + ` | OpenAI (GPT-4o, o3) via API |
| ` + "`deepseek`" + ` | DeepSeek via API |
| ` + "`qwen`" + ` | Alibaba Qwen via API |
| ` + "`ollama`" + ` | Self-hosted via Ollama |

Use ` + "`agent_spawn`" + ` with any agent slug — the orchestrator resolves the provider from the agent's DB record automatically. MCP tools are the universal interface regardless of provider.

## User Config

Preferences and settings are persisted to the cloud and restored each session:

` + "```" + `
# Save a config
config_save(key: "default_provider", value: "claude")
config_save(key: "preferences", value: {"theme": "dark", "language": "en"})
config_save(key: "work_patterns", value: {"style": "plan-first"})

# Load all configs (run at session start)
config_get()
` + "```" + `

**Supported keys:** ` + "`preferences`" + `, ` + "`active_project`" + `, ` + "`work_patterns`" + `, ` + "`account_pool`" + `, ` + "`default_provider`" + `, ` + "`default_model`" + `

## Quick Start

### Working with Agents

Agents are specialized team members that handle different types of work. Delegate tasks based on the agent's role:

` + "```" + `
# List all agents
Use the agent_list tool

# Get agent details
Use the agent_get tool with the agent slug

# Create a new agent
Use the agent_create tool with name, role, and system prompt
` + "```" + `

### Managing Tasks

` + "```" + `
# Create a task
Use the task_create tool with title, description, and optional assignee

# List tasks
Use the task_list tool to see all tasks and their status

# Assign a task
Use the task_assign tool to delegate work to an agent

# Complete a task
Use the task_complete tool when work is done
` + "```" + `

### Memory & Decisions

` + "```" + `
# Store a memory
Use the memory_store tool to persist knowledge across sessions

# Search memories
Use the memory_search tool to recall stored context

# Log a decision
Use the decision_log tool to record architectural decisions with rationale

# Search decisions
Use the decision_search tool to find past decisions
` + "```" + `

### Project Workflows

` + "```" + `
# Create a project
Use the project_create tool

# Track progress
Use the project_progress tool for status reports

# Create specs
Use the spec_create tool for technical specifications

# Start a session
Use the session_start tool to begin a tracked work session
` + "```" + `

## Complete Tool Reference

### Project Management
| Tool | Description |
|------|-------------|
| ` + "`project_create`" + ` | Create a new project |
| ` + "`project_get`" + ` | Get project details by ID or slug |
| ` + "`project_list`" + ` | List all projects in the organization |
| ` + "`project_progress`" + ` | Get project progress summary and stats |

### Task Management
| Tool | Description |
|------|-------------|
| ` + "`task_create`" + ` | Create a new task in a project |
| ` + "`task_get`" + ` | Get task details by ID |
| ` + "`task_list`" + ` | List tasks with optional filters |
| ` + "`task_update`" + ` | Update task fields (title, description, priority, etc.) |
| ` + "`task_assign`" + ` | Assign a task to an agent |
| ` + "`task_complete`" + ` | Mark a task as completed |
| ` + "`task_block`" + ` | Mark a task as blocked with a reason |
| ` + "`task_get_next`" + ` | Get the next unassigned task by priority |
| ` + "`task_transition`" + ` | Transition a task to a new status |
| ` + "`task_comment_add`" + ` | Add a comment to a task |
| ` + "`task_comment_list`" + ` | List comments on a task |

### Agent Management
| Tool | Description |
|------|-------------|
| ` + "`agent_create`" + ` | Create a new agent with role and system prompt |
| ` + "`agent_get`" + ` | Get agent details by ID or slug |
| ` + "`agent_list`" + ` | List all agents in the organization |
| ` + "`agent_update`" + ` | Update agent configuration |
| ` + "`agent_delete`" + ` | Delete an agent |

### Meetings
| Tool | Description |
|------|-------------|
| ` + "`meeting_create`" + ` | Create a new meeting record |
| ` + "`meeting_get`" + ` | Get meeting details |
| ` + "`meeting_list`" + ` | List meetings |
| ` + "`meeting_update`" + ` | Update meeting details |
| ` + "`meeting_end`" + ` | End an active meeting |

### Workflows & Gates
| Tool | Description |
|------|-------------|
| ` + "`workflow_create`" + ` | Create a workflow definition with stages |
| ` + "`workflow_get`" + ` | Get workflow details |
| ` + "`workflow_list`" + ` | List workflows |
| ` + "`gate_create`" + ` | Create a quality gate on a workflow stage |
| ` + "`gate_list`" + ` | List gates for a workflow |
| ` + "`gate_check`" + ` | Check if a gate's conditions are met |
| ` + "`evidence_submit`" + ` | Submit evidence for a gate check |

### Memory & Decisions
| Tool | Description |
|------|-------------|
| ` + "`memory_store`" + ` | Store a memory for cross-session persistence |
| ` + "`memory_search`" + ` | Search stored memories by keyword or semantic match |
| ` + "`memory_list`" + ` | List all memories |
| ` + "`decision_log`" + ` | Log an architectural or design decision with rationale |
| ` + "`decision_search`" + ` | Search past decisions |
| ` + "`decision_list`" + ` | List all logged decisions |

### Notes & Specs
| Tool | Description |
|------|-------------|
| ` + "`note_create`" + ` | Create a note |
| ` + "`note_list`" + ` | List notes |
| ` + "`spec_create`" + ` | Create a technical specification |
| ` + "`spec_list`" + ` | List specifications |

### Sessions
| Tool | Description |
|------|-------------|
| ` + "`session_start`" + ` | Start a tracked work session |
| ` + "`session_heartbeat`" + ` | Send a heartbeat to keep a session alive |
| ` + "`session_end`" + ` | End a work session |
| ` + "`session_list`" + ` | List active and past sessions |

### GitHub Integration
| Tool | Description |
|------|-------------|
| ` + "`repo_list`" + ` | List connected GitHub repositories |
| ` + "`repo_read_file`" + ` | Read a file from a GitHub repo |
| ` + "`repo_write_file`" + ` | Write/update a file in a GitHub repo |
| ` + "`repo_create_branch`" + ` | Create a new branch |
| ` + "`repo_create_pr`" + ` | Create a pull request |

### Notifications
| Tool | Description |
|------|-------------|
| ` + "`notify`" + ` | Send a notification via the configured default channel |
| ` + "`slack_notify`" + ` | Send a Slack notification |
| ` + "`discord_notify`" + ` | Send a Discord notification |
| ` + "`telegram_notify`" + ` | Send a Telegram notification |

### Exports & Reports
| Tool | Description |
|------|-------------|
| ` + "`export_markdown`" + ` | Export data as Markdown |
| ` + "`export_csv`" + ` | Export data as CSV |
| ` + "`export_xlsx`" + ` | Export data as Excel spreadsheet |
| ` + "`export_pdf`" + ` | Export data as PDF |
| ` + "`export_docx`" + ` | Export data as Word document |
| ` + "`export_pptx`" + ` | Export data as PowerPoint presentation |
| ` + "`export_diagram`" + ` | Export a Mermaid diagram as SVG/PNG |
| ` + "`report_generate`" + ` | Generate a comprehensive project report |

### Init & Setup
| Tool | Description |
|------|-------------|
| ` + "`init`" + ` | Generate a complete init bundle (rules, agents, skills, hooks, CLAUDE.md) |
| ` + "`init_status`" + ` | Check init readiness and component counts |
| ` + "`desktop_install`" + ` | Install the Orchestra Desktop app |

### User Config
| Tool | Description |
|------|-------------|
| ` + "`config_save`" + ` | Save a user config value (preferences, active project, work patterns, account pool, provider settings) |
| ` + "`config_get`" + ` | Get user config values — provide key for a specific value, or omit to return all configs |

### Activity & Usage
| Tool | Description |
|------|-------------|
| ` + "`activity_log`" + ` | Log an activity event |
| ` + "`activity_list`" + ` | List activity events |
| ` + "`team_status`" + ` | Get team-wide status overview |
| ` + "`usage_get`" + ` | Get usage statistics for the organization |
`

// GenerateCLAUDEMD generates a CLAUDE.md file customized for the given org data.
func GenerateCLAUDEMD(data CLAUDEMDData) (string, error) {
	tmpl, err := template.New("claude_md").Parse(claudeMDTemplate)
	if err != nil {
		return "", err
	}

	var buf bytes.Buffer
	if err := tmpl.Execute(&buf, data); err != nil {
		return "", err
	}

	return buf.String(), nil
}
