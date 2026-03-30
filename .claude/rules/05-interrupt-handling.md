---
description: 'Never stop mid-flow. Save unrelated user requests to .requests/ and continue current work.'
globs: '*'
alwaysApply: true
---

# Rule 5: Interrupt Handling — Never Stop Mid-Flow

If the user asks about something unrelated while you are working on a plan or task:

1. **Save the request via MCP** using `request_create(title, description, context, priority)` — this stores it on the cloud server for tracking.
2. If MCP is unavailable, fallback to saving in `.requests/` as a markdown file.
3. Acknowledge the request: "I've saved this request and will review it after the current task."
4. **Continue the current flow** without stopping.
5. After completing the current task, review pending requests via `request_list(status: "pending")` and address them.

## MCP Request Command

```
request_create(
  title: "Summary of the request",
  description: "Full details of what was asked",
  context: "What we were doing when this came in",
  priority: "high"
)
```

## Tracking Requests

- **List pending:** `request_list(status: "pending")`
- **Review:** `request_update(id: "xxx", status: "reviewed")`
- **Link to task:** `request_update(id: "xxx", linked_task_id: "task-uuid")`
- **Mark done:** `request_update(id: "xxx", status: "done")`

## Fallback Template (if MCP unavailable)

```markdown
# Request: {Summary}

**Date**: {YYYY-MM-DD HH:MM}
**Status**: Pending
**Context**: {What were we doing when this came in?}

## User Request

{Exact user request}
```
