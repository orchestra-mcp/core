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
