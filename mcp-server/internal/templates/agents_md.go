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
	Name         string
	Slug         string
	Role         string
	Type         string // "ai", "human", "hybrid"
	Persona      string
	SystemPrompt string
}

// ---------------------------------------------------------------------------
// Template
// ---------------------------------------------------------------------------

const agentsMDTemplate = `# Orchestra Team — Agent Roster

This document contains the full agent roster for your Orchestra MCP organization.
Each agent is a specialized team member with a defined role, persona, and system prompt.

## Summary

| # | Name | Slug | Role | Type |
|---|------|------|------|------|
{{ range $i, $a := . -}}
| {{ inc $i }} | {{ $a.Name }} | ` + "`{{ $a.Slug }}`" + ` | {{ $a.Role }} | {{ $a.Type }} |
{{ end }}
---
{{ range . }}
## {{ .Name }} (` + "`{{ .Slug }}`" + `)

**Role:** {{ .Role }}
**Type:** {{ .Type }}
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
{{ end }}`

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
