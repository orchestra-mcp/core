---
name: Orchestra Task
description: Create and assign tasks. Shortcut for task_create.
user_invocable: true
---

# /orch-task — Create Task

When invoked with a description:
1. Parse the task description from the user's input
2. Determine the right agent based on the task type (Go work → go-developer, Frontend → frontend-developer, etc.)
3. Call `task_create(title: "...", description: "...", assigned_agent_id: "{best agent}", priority: "...")`
4. Call `task_comment_add(task_id: "...", message: "Initial requirements: ...")` to add context
5. Present the created task with next steps

## Agent Routing Guide

| Task Type              | Agent Slug          |
| ---------------------- | ------------------- |
| Go / MCP server        | go-developer        |
| Laravel / PHP          | laravel-developer   |
| Next.js / React        | nextjs-developer    |
| Flutter mobile         | flutter-developer   |
| Flutter UI             | flutter-ui-developer |
| Database / migrations  | supabase-developer  |
| DevOps / Docker / CI   | devops-engineer     |
| Tests / QA             | qa-engineer         |
| Design / UI            | ui-designer         |
| Documentation          | technical-writer    |

## A2UI Visualization
Suggest TaskBoard:
```yaml
visualization:
  component: TaskBoard
  props:
    project_id: "{id}"
```
