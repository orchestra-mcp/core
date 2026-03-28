# Plan 01: Infrastructure Setup (Phase 1)

**Duration:** Days 1-3
**Goal:** All services running behind single domain with Caddy routing

---

## Tasks

### 1.1 Supabase Docker Setup
- [ ] Copy `docker/.env.example` to `docker/.env` (done)
- [ ] Configure critical env vars: `POSTGRES_PASSWORD`, `JWT_SECRET`, `ANON_KEY`, `SERVICE_ROLE_KEY`
- [ ] Set `SITE_URL`, `API_EXTERNAL_URL`, `SUPABASE_PUBLIC_URL` to `https://orchestra-mcp.dev`
- [ ] Set Studio port to 54323
- [ ] Ensure pgvector 0.8.2 extension available in Supabase Postgres image
- [ ] Set `shm_size: '2gb'` for PostgreSQL container
- [ ] Start Docker: `docker compose up -d`
- [ ] Verify Supabase API at `localhost:54321`
- [ ] Verify Studio at `localhost:54323`

### 1.2 Database Migrations
- [ ] Create `supabase/migrations/` directory structure
- [ ] Write migration 001: Extensions & Types (uuid-ossp, vector, pg_trgm, pgcrypto, enums)
- [ ] Write migration 002: Profiles & Organizations (profiles, organizations, teams, team_members)
- [ ] Write migration 003: MCP Tokens (mcp_tokens, validate_mcp_token function)
- [ ] Write migration 004: Projects, Agents, Skills (projects, skills, agents, agent_skills)
- [ ] Write migration 005: Workflows & Tasks (workflows, tasks, task_dependencies)
- [ ] Write migration 006: Memory, Activity, Decisions, Sessions
- [ ] Write migration 007: Notes, Specs, GitHub connections
- [ ] Write migration 008: RLS Policies (all tables)
- [ ] Write migration 009: Database Functions (search_memory, search_decisions, get_team_activity, etc.)
- [ ] Write migration 010: Realtime publications & seed data
- [ ] Apply all migrations via `psql`
- [ ] Verify tables exist in Supabase Studio table editor

### 1.3 Caddy Configuration
- [ ] Create Caddyfile with path-based routing per PRD Section 4
- [ ] Routes: `/mcp*` -> Go:3001, `/rest/v1/*` -> Kong:54321, `/studio/*` -> Studio:54323, `/*` -> Laravel
- [ ] WebSocket upgrade headers for Realtime and MCP
- [ ] Security headers (nosniff, SAMEORIGIN, HSTS)
- [ ] Compression (gzip + zstd)
- [ ] Static asset immutable cache headers

### 1.4 Go MCP Server Scaffold
- [ ] Initialize Go 1.26 module: `orchestra-mcp-server`
- [ ] Create `cmd/server/main.go` with HTTP server on :3001
- [ ] Implement `/mcp/health` endpoint
- [ ] Create project structure: `internal/{auth,mcp,tools,db,embedding,github,realtime}`
- [ ] Dockerfile for production build
- [ ] Verify health endpoint responds

### 1.5 Laravel Project Scaffold
- [ ] Create Laravel 13 project: `composer create-project laravel/laravel web`
- [ ] Configure `.env` with Supabase Postgres connection (DB_HOST=127.0.0.1, DB_PORT=5432)
- [ ] Install Livewire 4: `composer require livewire/livewire:^4.0`
- [ ] Install Tailwind CSS 4.2 + Vite 8
- [ ] Set up brand assets from `arts/` folder
- [ ] Verify Laravel serves at `localhost:8000`
- [ ] Test DB connection to Supabase Postgres

### 1.6 Directory Structure
Server layout:
```
/opt/orchestra/           (production — for reference)
spec/                     (this repo — for local dev)
├── supabase/
│   ├── docker/           (Supabase Docker setup)
│   ├── migrations/       (SQL migration files)
│   ├── functions/        (Edge Functions)
│   └── studio/           (Deep-forked Studio = this repo)
├── mcp-server/           (Go MCP server)
├── web/                  (Laravel application)
└── deploy/               (setup.sh, deploy.sh, configs)
```

---

## Acceptance Criteria
- `docker compose up -d` starts all Supabase services
- All 10 migrations applied, tables visible in Studio
- Go server responds at `/mcp/health`
- Laravel serves at `/` with DB connection to Supabase Postgres
- Caddy routes correctly to all services
