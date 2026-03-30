---
name: Orchestra Agent
description: Direct a specific agent to do work. Usage: /orch-agent {slug} {instruction}
user_invocable: true
---

# /orch-agent — Direct an Agent

When invoked with an agent slug and instruction:
1. Look up the agent from the MCP board via `agent_get(slug: "{slug}")`
2. Get their model assignment (opus/sonnet/haiku)
3. Spawn a sub-agent using `Agent(model: "{agent.model}", prompt: "{agent.system_prompt}\n\nTask: {instruction}")`
4. The spawned agent works on the task and reports back
5. If the task requires code, create a task via `task_create` and assign it

## Available Agents
Call `agent_list` to see all 38 agents with their roles and models.

## Common Agent Slugs

| Slug                    | Role                               |
| ----------------------- | ---------------------------------- |
| go-developer            | Go MCP server, protocol, tools     |
| laravel-developer       | Laravel web app, Blade, Livewire   |
| supabase-developer      | Supabase, migrations, RLS          |
| studio-developer        | Studio fork, branding, custom pages|
| nextjs-developer        | Next.js, React, SSR/SSG            |
| flutter-developer       | Flutter cross-platform apps        |
| flutter-ui-developer    | Flutter UI, widgets, theme         |
| devops-engineer         | Docker, Caddy, deployment, CI/CD   |
| qa-engineer             | Cross-stack testing                |
| security-engineer       | Security reviews, audits           |
| technical-writer        | Docs, README, API reference        |
| ui-designer             | UI design, components, HIG         |
| software-architect      | Architecture decisions, ADRs       |
