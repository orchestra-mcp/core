# CLAUDE.md — Orchestra MCP Platform

This is a **deep fork of Supabase Studio** that serves as the admin panel for Orchestra MCP — a platform that turns Claude AI into a 24/7 autonomous company operating system.

## Project Structure

```
/                           # Supabase Studio monorepo (deep fork)
├── apps/studio/            # Next.js Studio app (Orchestra Studio)
├── packages/               # Shared monorepo packages (ui, common, icons)
├── docker/                 # Supabase Docker Compose (15 services)
├── arts/                   # Brand assets (logo, colors, fonts)
├── spec/                   # Orchestra MCP specifications
│   ├── PRD.md              # Full product requirements document
│   ├── plans/              # Implementation plans (6 phases)
│   ├── supabase/           # Migrations, Edge Functions
│   ├── mcp-server/         # Go MCP server source
│   ├── web/                # Laravel web application source
│   └── deploy/             # Server setup & deployment scripts
├── .claude/
│   ├── agents/             # Specialized sub-agents
│   ├── rules/              # Project rules (11 rules)
│   └── skills/             # Slash command skills
└── e2e/                    # End-to-end tests
```

## The Product

Orchestra MCP is an MCP token platform:

1. Users register at the Laravel web app
2. Get an MCP token during onboarding
3. Connect token to Claude Code / Claude.ai
4. Gain access to: persistent agent memory, team sync, task management, autonomous workflows

## Tech Stack (Latest Versions — March 2026)

| Layer         | Technology                  | Version              |
| ------------- | --------------------------- | -------------------- |
| Web App       | Laravel + Livewire + Blade  | 13.2 / 4.2 / PHP 8.5 |
| MCP Server    | Go                          | 1.26                 |
| Database      | PostgreSQL + pgvector       | 18.3 / 0.8.2         |
| Auth          | Supabase GoTrue             | (Docker image)       |
| Realtime      | Supabase Realtime           | (Docker image)       |
| Storage       | Supabase Storage            | (Docker image)       |
| Admin Panel   | Supabase Studio (this fork) | Next.js 16           |
| Reverse Proxy | Caddy                       | 2.11                 |
| Frontend      | Tailwind CSS / Vite         | 4.2 / 8.0            |
| Cache/Queue   | Redis                       | 8.6                  |

## Agents

Specialized sub-agents in `.claude/agents/`:

| Agent                | File                                 | Role                                               |
| -------------------- | ------------------------------------ | -------------------------------------------------- |
| `go-mcp-developer`   | .claude/agents/go-mcp-developer.md   | Go MCP server — protocol, tools, auth              |
| `laravel-developer`  | .claude/agents/laravel-developer.md  | Laravel web app — Blade, Livewire, auth, billing   |
| `supabase-developer` | .claude/agents/supabase-developer.md | Supabase — migrations, RLS, Edge Functions, Docker |
| `studio-developer`   | .claude/agents/studio-developer.md   | Studio fork — branding, custom pages, auth         |
| `devops-engineer`    | .claude/agents/devops-engineer.md    | Docker, Caddy, deployment, CI/CD                   |
| `qa-engineer`        | .claude/agents/qa-engineer.md        | Cross-stack testing (Go, PHP, TS, E2E)             |

## Skills

| Command             | Description                                      |
| ------------------- | ------------------------------------------------ |
| `/orch-setup`       | Bootstrap local dev environment                  |
| `/orch-migrate`     | Create and apply database migrations             |
| `/orch-status`      | Check service health and implementation progress |
| `/e2e-studio-tests` | Run Studio Playwright E2E tests                  |

## Rules (`.claude/rules/`)

| #   | Rule                | Summary                                                                   |
| --- | ------------------- | ------------------------------------------------------------------------- |
| 01  | Plan-First          | Save plan to `spec/plans/` before any code                                |
| 02  | Multi-Feature TODOs | Plans have multiple features, tracked via TodoWrite                       |
| 03  | Plan Review         | Ask user to approve plan before implementing                              |
| 04  | Clarify Unknowns    | Ask early, don't guess                                                    |
| 05  | Interrupt Handling  | Save unrelated requests to `.requests/`, continue current work            |
| 06  | Definition of Done  | Tests pass + docs written + code quality                                  |
| 07  | Component UI        | Reusable components, no inline duplication                                |
| 08  | Package Scaffolding | Standard package structure (README, CI, tests, templates)                 |
| 09  | Small Wins          | Each feature must have a minimum demonstrable deliverable                 |
| 10  | Parallel Execution  | Main agent = conductor, all work delegated to sub-agents                  |
| 11  | Client-First        | User is the client. Data-first, no sugar-coating, verify before reporting |

## Implementation Phases

| Phase                 | Plan                                       | Days  | Status      |
| --------------------- | ------------------------------------------ | ----- | ----------- |
| 1. Infrastructure     | `spec/plans/01-infrastructure.md`          | 1-3   | Not Started |
| 2. Auth & Onboarding  | `spec/plans/02-auth-onboarding.md`         | 4-7   | Not Started |
| 3. Go MCP Server      | `spec/plans/03-go-mcp-server.md`           | 8-14  | Not Started |
| 4. GitHub & Specs     | `spec/plans/04-github-specs.md`            | 15-18 | Not Started |
| 5. Dashboard & Polish | `spec/plans/05-dashboard-polish.md`        | 19-24 | Not Started |
| 6. Team Sync          | `spec/plans/06-team-sync-notifications.md` | 25-30 | Not Started |

## Quick Start (Local Dev)

```bash
pnpm install
cd docker && cp .env.example .env && docker compose up -d
cd .. && pnpm setup:cli
pnpm dev:studio
# Studio at http://localhost:8082
```

## PR Workflow

After each implementation bulk, create a PR to `github.com/orchestra-mcp/core` on the `master` branch. Update plan files (check off completed tasks) as part of the PR.

## Git Config

- Author: `Fady Mondy <info@3x1.io>`
- Remote: `git@github.com:orchestra-mcp/core.git`
