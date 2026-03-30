---
description: 'All MCP tool responses must return YAML frontmatter + Markdown body + Next Steps. JSON only when structurally required.'
globs: '*'
alwaysApply: true
---

# Rule 12: Markdown-First MCP Responses

ALL MCP tool responses use this format — both Cloud MCP and Desktop MCP.

## Response Format

Every tool returns YAML frontmatter + Markdown body + Next Steps:

```markdown
---
id: {uuid}
type: {entity_type}
status: {value}
export: {suggested/filepath.md}
related_rules: [R01, R06]
---

# {Title}

{Markdown body — tables, lists, descriptions}

---

## Next Steps
- **{action}:** `tool_name(param: "value")`
```

## Rules

1. **YAML frontmatter** — IDs, type, status, export path, and related rules. Only structured data that tools need for linking/updates.
2. **Markdown body** — Human-readable content. Use tables for lists, headings for sections, code blocks for examples.
3. **Next Steps** — Every response that has follow-up actions MUST include a Next Steps section with the exact tool calls the AI should use next. This teaches the AI the workflow.
4. **Related Rules** — When a response relates to project rules (planning, DOD, testing), include the rule numbers in frontmatter so the AI enforces them.
5. **Export path** — Every response suggests where to save it as a markdown file.
6. **JSON only when required** — Return raw JSON only when the consumer needs structured data (arrays for iteration, IDs for assignment). Default is always markdown.

## Examples

### task_list returns a table:
| # | Title | Status | Priority | Agent |
|---|-------|--------|----------|-------|
| 1 | Build auth | done | critical | Omar |

### meeting_create returns a roster + next steps:
Participant table + `meeting_message(meeting_id: "xxx", content: "...")` + `meeting_end(id: "xxx")`

### screen_scan returns layout + next steps:
Display/window tables + `screen_action(actions: [...])` with coordinates from scan
