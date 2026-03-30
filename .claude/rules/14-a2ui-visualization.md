---
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

Add a `visualization` field to the YAML frontmatter:
```yaml
---
id: xxx
type: task_list
visualization:
  component: TaskBoard
  props:
    columns: [todo, in_progress, done]
    data: tasks
---
```

## Rules

1. **Visualization is optional** — only attach when it adds value
2. **Always include markdown fallback** — the markdown body IS the content, visualization is enhancement
3. **Keep props minimal** — reference data from the markdown body, don't duplicate
4. **Standard components** — use the component library (StatusDashboard, TaskBoard, AgentRoster, MeetingTranscript, CodeDiff, DiagramView)
