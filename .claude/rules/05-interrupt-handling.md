---
description: "Never stop mid-flow. Save unrelated user requests to .requests/ and continue current work."
globs: "*"
alwaysApply: true
---

# Rule 5: Interrupt Handling — Never Stop Mid-Flow

If the user asks about something unrelated while you are working on a plan or task:

1. **Save the request** to `.requests/` as a markdown file.
2. Filename format: `YYYY-MM-DD-{kebab-case-summary}.md`
3. Include the user's exact request and any context.
4. Acknowledge the request: "I've saved this to `.requests/` and will review it after the current task."
5. **Continue the current flow** without stopping.
6. After completing the current task, review `.requests/` and address pending items.

## Request Template

```markdown
# Request: {Summary}

**Date**: {YYYY-MM-DD HH:MM}
**Status**: Pending | Reviewed | Done
**Context**: {What were we doing when this came in?}

## User Request
{Exact user request}

## Notes
{Any relevant context or initial thoughts}
```
