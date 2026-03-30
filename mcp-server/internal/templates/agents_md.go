package templates

import (
	"bytes"
	"text/template"
)

// ---------------------------------------------------------------------------
// Data types for AGENTS.md generation
// ---------------------------------------------------------------------------

// AgentDetailInfo holds full agent data for the detailed AGENTS.md roster.
type AgentDetailInfo struct {
	Name           string
	Slug           string
	Role           string
	Type           string // "ai", "human", "hybrid"
	Model          string // "opus", "sonnet", "haiku"
	Provider       string // "claude", "gemini", "openai", "deepseek", "qwen", "ollama"
	Persona        string
	SystemPrompt   string
}

// ---------------------------------------------------------------------------
// Template
// ---------------------------------------------------------------------------

const agentsMDTemplate = `# Orchestra Team — Agent Roster

This document contains the full agent roster for your Orchestra MCP organization.
Each agent is a specialized team member with a defined role, persona, and system prompt.

## Summary

| # | Name | Slug | Role | Type | Provider | Model |
|---|------|------|------|------|----------|-------|
{{ range $i, $a := . -}}
| {{ inc $i }} | {{ $a.Name }} | ` + "`{{ $a.Slug }}`" + ` | {{ $a.Role }} | {{ $a.Type }} | {{ if $a.Provider }}{{ $a.Provider }}{{ else }}claude{{ end }} | {{ if $a.Model }}{{ $a.Model }}{{ else }}sonnet{{ end }} |
{{ end }}
---
{{ range . }}
## {{ .Name }} (` + "`{{ .Slug }}`" + `)

**Role:** {{ .Role }}
**Type:** {{ .Type }}
**Provider:** {{ if .Provider }}{{ .Provider }}{{ else }}claude{{ end }}
**Model:** {{ if .Model }}{{ .Model }}{{ else }}sonnet{{ end }}
{{ if .Persona }}
### Persona

{{ .Persona }}
{{ end }}{{ if .SystemPrompt }}
### System Prompt

{{ .SystemPrompt }}
{{ end }}
### How to Use

Delegate tasks to this agent for: {{ .Role }}.
Use the ` + "`task_assign`" + ` tool with agent slug ` + "`{{ .Slug }}`" + ` to assign work, or reference this agent
when creating tasks that match their specialty.

---
{{ end }}
## How to Delegate

Use the ` + "`task_assign`" + ` tool to delegate work to any agent by their slug. The general workflow is:

1. **Create a task** with ` + "`task_create`" + ` — provide a title, description, and project ID.
2. **Assign it** with ` + "`task_assign`" + ` — pass the task ID and the agent slug.
3. **Track progress** with ` + "`task_list`" + ` or ` + "`task_get`" + ` — check status and comments.
4. **Complete it** with ` + "`task_complete`" + ` — mark the task as done when the agent finishes.

### Example: Assign a Backend Task

` + "```" + `
# Step 1: Create the task
Use task_create with:
  - title: "Build user registration endpoint"
  - project_id: "<project-id>"
  - priority: "high"

# Step 2: Assign to the right agent
Use task_assign with:
  - task_id: "<task-id from step 1>"
  - agent_slug: "omar-magdy"   ← use the agent's slug from the table above

# Step 3: Check on progress
Use task_get with:
  - task_id: "<task-id>"

# Step 4: Mark complete
Use task_complete with:
  - task_id: "<task-id>"
  - summary: "Endpoint implemented with tests"
` + "```" + `

### Tips

- Match the task to the agent whose **Role** best fits the work.
- Use ` + "`task_get_next`" + ` to automatically pick up the highest-priority unassigned task.
- Add comments with ` + "`task_comment_add`" + ` to communicate context or feedback.
- If a task is blocked, use ` + "`task_block`" + ` with a reason so the team can unblock it.
`

// ---------------------------------------------------------------------------
// Template functions
// ---------------------------------------------------------------------------

var agentsMDFuncMap = template.FuncMap{
	"inc": func(i int) int { return i + 1 },
}

// GenerateAGENTSMD generates a detailed AGENTS.md roster from a slice of agent data.
func GenerateAGENTSMD(agents []AgentDetailInfo) (string, error) {
	tmpl, err := template.New("agents_md").Funcs(agentsMDFuncMap).Parse(agentsMDTemplate)
	if err != nil {
		return "", err
	}

	var buf bytes.Buffer
	if err := tmpl.Execute(&buf, agents); err != nil {
		return "", err
	}

	return buf.String(), nil
}
