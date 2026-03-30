---
name: Orchestra Request
description: Log a request for later review. Shortcut for request_create.
user_invocable: true
---

# /orch-request — Log Request

When invoked:
1. Parse the request from the user's input
2. Determine priority (critical/high/medium/low) from context
3. Call `request_create(title: "...", description: "...", priority: "...", context: "{what we were doing}")`
4. Present the saved request with tracking next steps

## Priority Guide

| Priority | When to use                                              |
| -------- | -------------------------------------------------------- |
| critical | Blocks current work, production issue, security concern  |
| high     | Important feature, blocking another team member          |
| medium   | Nice to have, non-blocking improvement                   |
| low      | Future idea, cosmetic, or low-impact change              |

## Interrupt Handling (Rule 5)

If the user raises this request mid-task:
- Save it via `request_create` immediately
- Acknowledge: "Logged to request board, continuing current work"
- Do NOT stop the current flow
- After current task completes, call `request_list` and address pending items
