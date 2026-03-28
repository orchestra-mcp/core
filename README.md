# Orchestra MCP

**Turn Claude AI into your 24/7 autonomous company operating system.**

---

## What is Orchestra MCP?

Orchestra MCP is an MCP token platform that gives Claude persistent memory, team synchronization, task management, and autonomous workflows. Users register, receive an MCP token during onboarding, and connect it to Claude Code or Claude.ai to unlock a full suite of agent capabilities.

The platform is built on four pillars:

- **Self-hosted Supabase** -- PostgreSQL database, authentication, realtime subscriptions, and file storage
- **Forked Supabase Studio** -- Admin panel for managing the platform (this repository)
- **Go MCP server** -- Implements the MCP protocol, exposes agent tools, handles token auth
- **Laravel web app** -- User registration, dashboard, billing, and onboarding

## Architecture

```
                          +---------------------------+
                          |       Caddy (2.11)        |
                          |     Reverse Proxy         |
                          |   Single Domain Routing   |
                          +--+------+------+------+---+
                             |      |      |      |
              /--------------+      |      |      +--------------\
              |                     |      |                     |
    +---------v--------+  +--------v------v--------+  +---------v--------+
    |   Laravel Web    |  |    Supabase Services   |  |   Go MCP Server  |
    |                  |  |                        |  |                  |
    |  Registration    |  |  Kong (API Gateway)    |  |  MCP Protocol    |
    |  Dashboard       |  |  GoTrue (Auth)         |  |  Agent Tools     |
    |  Billing         |  |  PostgREST (REST API)  |  |  Token Auth      |
    |  Onboarding      |  |  Realtime (WebSocket)  |  |  Workflows       |
    |                  |  |  Storage (S3)          |  |                  |
    +------------------+  |  Studio (Admin Panel)  |  +------------------+
                          +------------------------+
                                     |
                          +----------v-----------+
                          |   PostgreSQL 18      |
                          |   + pgvector 0.8.2   |
                          +----------------------+
```

All services sit behind a single domain with path-based routing managed by Caddy.

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Web App | Laravel + Livewire + Blade | 13 / 4 / PHP 8.5 |
| MCP Server | Go | 1.26 |
| Database | PostgreSQL + pgvector | 18 / 0.8.2 |
| Auth | Supabase GoTrue | via Docker |
| API | Supabase PostgREST | via Docker |
| Realtime | Supabase Realtime | via Docker |
| Storage | Supabase Storage | via Docker |
| Admin Panel | Supabase Studio (this fork) | Next.js |
| Reverse Proxy | Caddy | 2.11 |
| Frontend | Tailwind CSS + Vite | 4.2 / 8 |
| Cache / Queues | Redis | 8.6 |

## Quick Start (Local Development)

```bash
pnpm install
cd docker && cp .env.example .env && docker compose up -d
cd .. && pnpm setup:cli
pnpm dev:studio
# Studio at http://localhost:8082
```

## Project Structure

```
/
├── apps/studio/           Next.js Studio app (Orchestra Studio)
├── packages/              Shared monorepo packages (ui, common, icons)
├── docker/                Supabase Docker Compose (all services)
├── spec/                  Orchestra specifications and source code
│   ├── mcp-server/        Go MCP server
│   ├── web/               Laravel web application
│   ├── supabase/          Migrations and Edge Functions
│   ├── plans/             Implementation plans (6 phases)
│   └── deploy/            Server setup and deployment scripts
├── arts/                  Brand assets (logo, colors, fonts)
└── e2e/                   End-to-end tests
```

## Implementation Phases

| Phase | Focus | Days | Plan |
|-------|-------|------|------|
| 1 | Infrastructure | 1--3 | `spec/plans/01-infrastructure.md` |
| 2 | Auth and Onboarding | 4--7 | `spec/plans/02-auth-onboarding.md` |
| 3 | Go MCP Server | 8--14 | `spec/plans/03-go-mcp-server.md` |
| 4 | GitHub and Specs | 15--18 | `spec/plans/04-github-specs.md` |
| 5 | Dashboard and Polish | 19--24 | `spec/plans/05-dashboard-polish.md` |
| 6 | Team Sync | 25--30 | `spec/plans/06-team-sync-notifications.md` |

## Contributing

1. Create a feature branch from `master`.
2. Make your changes, ensuring tests pass and code follows project conventions.
3. Open a pull request against `master` at `github.com/orchestra-mcp/core`.
4. Update any relevant plan files (check off completed tasks) as part of the PR.

See [DEVELOPERS.md](./DEVELOPERS.md) for detailed setup and contribution guidelines.

## License

This project is a derivative work of [Supabase](https://github.com/supabase/supabase), licensed under the [Apache License 2.0](./LICENSE).
