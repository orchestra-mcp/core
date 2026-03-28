# Orchestra MCP Platform — Product Requirements Document v2

**Version:** 2.0  
**Date:** March 28, 2026  
**Author:** Fady Mondy / TomatoPHP  
**Status:** Ready for Implementation

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Architecture Overview](#2-architecture-overview)
3. [Infrastructure & Server Setup](#3-infrastructure--server-setup)
4. [Caddy Server Configuration](#4-caddy-server-configuration)
5. [Supabase Self-Hosted Setup](#5-supabase-self-hosted-setup)
6. [Database Schema (Native Migrations)](#6-database-schema-native-migrations)
7. [Database Functions & Triggers](#7-database-functions--triggers)
8. [Row Level Security](#8-row-level-security)
9. [Supabase Edge Functions](#9-supabase-edge-functions)
10. [Supabase Studio Deep Fork](#10-supabase-studio-deep-fork)
11. [Go MCP Server](#11-go-mcp-server)
12. [Laravel Web Application](#12-laravel-web-application)
13. [GitHub Integration](#13-github-integration)
14. [User Flows](#14-user-flows)
15. [Design System & Brand](#15-design-system--brand)
16. [Deployment Scripts](#16-deployment-scripts)
17. [Implementation Phases](#17-implementation-phases)
18. [Monitoring & Operations](#18-monitoring--operations)
19. [Security](#19-security)
20. [Revenue Model](#20-revenue-model)
21. [Success Metrics](#21-success-metrics)
22. [Future Roadmap](#22-future-roadmap)

---

## 1. Executive Summary

Orchestra MCP is a platform that turns Claude AI into a 24/7 autonomous company operating system. The product is an MCP token — users register, get a token, connect it to Claude Code or Claude.ai, and gain access to persistent agent memory, team sync, task management, and autonomous agent workflows.

### The Product Is

- A Go-based MCP server connected to Supabase (agent memory, tasks, team sync)
- A self-hosted Supabase instance (database, auth, realtime, vector search, storage)
- A deep-forked Supabase Studio (admin panel with Orchestra branding and custom pages)
- A Laravel web app with Blade + Livewire (registration, SEO, onboarding, billing, docs)

### The Product Is NOT

- A desktop application, mobile app, Chrome extension, or custom IDE
- Users interact via Claude Code (terminal), Claude.ai (browser), and Slack (notifications)

### The Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| Web App | Laravel 11 + Blade + Livewire 3 | SEO, auth, onboarding, billing, docs, user dashboard |
| MCP Server | Go | MCP protocol, agent tools, GitHub integration, WebSocket |
| Database | PostgreSQL + pgvector (via Supabase) | All structured data + vector embeddings |
| Auth | Supabase GoTrue (synced with Laravel) | JWT, OAuth, user management |
| Realtime | Supabase Realtime | Team sync via WebSocket subscriptions |
| Storage | Supabase Storage | Files, avatars, artifacts |
| Admin | Supabase Studio (deep fork) | Full admin panel with Orchestra branding |
| Reverse Proxy | Caddy | Single-domain routing, auto-SSL, compression |
| CDN/DNS | Cloudflare | DNS, DDoS protection, caching |

---

## 2. Architecture Overview

```
                        orchestra-mcp.dev
                              │
                           Cloudflare
                              │
                           ┌──┴──┐
                           │Caddy│  (reverse proxy, auto-SSL)
                           └──┬──┘
                              │
            ┌─────────────────┼──────────────────┐
            │                 │                  │
     /*, /login,         /rest/v1/*          /mcp
     /register,          /auth/v1/*            │
     /dashboard/*,       /realtime/v1/*    ┌───┴───┐
     /docs/*             /storage/v1/*     │Go MCP │
            │            /functions/v1/*   │Server │
     ┌──────┴──────┐     /studio/*         │:3001  │
     │   Laravel   │          │            └───┬───┘
     │ Blade+Wire  │   ┌─────┴──────┐         │
     │   :8000     │   │  Supabase  │         │
     └─────────────┘   │  (Docker)  │         │
                       │            │         │
                       │ Kong  :54321│◄────────┘
                       │ GoTrue     │
                       │ Realtime   │
                       │ Storage    │
                       │ PostgREST  │
                       │ Studio*    │
                       │ PostgreSQL │
                       │   :5432    │
                       └────────────┘
                       
     * Studio is the deep-forked version with Orchestra branding
```

### Single Domain Path Routing

All services live behind `orchestra-mcp.dev` with path-based routing. No subdomains, no CORS, one SSL certificate via Caddy auto-HTTPS.

```
orchestra-mcp.dev/                    → Laravel (landing, public pages)
orchestra-mcp.dev/login               → Laravel (auth)
orchestra-mcp.dev/register            → Laravel (auth)
orchestra-mcp.dev/dashboard/*         → Laravel (user area)
orchestra-mcp.dev/onboarding/*        → Laravel (company setup)
orchestra-mcp.dev/docs/*              → Laravel (documentation)
orchestra-mcp.dev/pricing             → Laravel
orchestra-mcp.dev/blog/*              → Laravel
orchestra-mcp.dev/admin/*             → Laravel (lightweight admin routes)

orchestra-mcp.dev/studio/*            → Supabase Studio fork (admin panel)

orchestra-mcp.dev/rest/v1/*           → Supabase PostgREST API
orchestra-mcp.dev/auth/v1/*           → Supabase GoTrue (auth API)
orchestra-mcp.dev/realtime/v1/*       → Supabase Realtime (WebSocket)
orchestra-mcp.dev/storage/v1/*        → Supabase Storage API
orchestra-mcp.dev/functions/v1/*      → Supabase Edge Functions
orchestra-mcp.dev/ingest/*            → Supabase Analytics (optional)

orchestra-mcp.dev/mcp                 → Go MCP Server (SSE endpoint)
orchestra-mcp.dev/mcp/ws              → Go MCP Server (WebSocket)
orchestra-mcp.dev/mcp/health          → Go MCP Server (health check)
```

---

## 3. Infrastructure & Server Setup

### 3.1 Server Requirements

**Single Ubuntu 24.04 LTS Server:**

| Spec | Minimum | Recommended |
|------|---------|-------------|
| CPU | 4 vCPU | 8 vCPU |
| RAM | 8 GB | 16 GB |
| Storage | 100 GB SSD | 200 GB NVMe |
| Network | Public IPv4 | Public IPv4 + IPv6 |
| OS | Ubuntu 24.04 LTS | Ubuntu 24.04 LTS |

### 3.2 Software Stack

```
System Level:
├── Docker + Docker Compose (Supabase services)
├── Caddy (reverse proxy)
├── Go 1.22+ (MCP server binary)
├── PHP 8.3 + FPM (Laravel)
├── Composer (PHP dependency manager)
├── Node.js 20+ (Studio build, asset compilation)
├── Redis 7 (Laravel cache, queues, sessions)
├── Git
└── Supervisor (process management)
```

### 3.3 Directory Structure on Server

```
/opt/orchestra/
├── caddy/
│   └── Caddyfile
├── supabase/
│   ├── docker/                     # Supabase Docker setup (your cloned fork)
│   │   ├── docker-compose.yml
│   │   ├── .env
│   │   └── volumes/
│   │       └── db/
│   │           └── init/           # Initial SQL scripts
│   ├── migrations/                 # Native Supabase migrations
│   │   ├── 20260328000001_extensions.sql
│   │   ├── 20260328000002_organizations_teams.sql
│   │   ├── 20260328000003_mcp_tokens.sql
│   │   ├── 20260328000004_projects_agents_skills.sql
│   │   ├── 20260328000005_workflows_tasks.sql
│   │   ├── 20260328000006_memory_activity_decisions.sql
│   │   ├── 20260328000007_notes_specs_github.sql
│   │   ├── 20260328000008_rls_policies.sql
│   │   ├── 20260328000009_functions.sql
│   │   └── 20260328000010_realtime.sql
│   ├── functions/                  # Supabase Edge Functions
│   │   ├── webhook-handler/
│   │   ├── cron-agent-trigger/
│   │   └── stripe-webhook/
│   └── studio/                     # Deep-forked Studio (separate repo)
│       ├── apps/studio/            # Next.js Studio app
│       └── ...
├── mcp-server/                     # Go MCP server
│   ├── cmd/server/main.go
│   ├── internal/
│   └── go.mod
├── web/                            # Laravel application
│   ├── app/
│   ├── resources/
│   ├── routes/
│   ├── public/
│   └── arts/                       # Brand assets (logo, colors, fonts)
│       ├── logo.svg
│       ├── logo-dark.svg
│       ├── icon.svg
│       ├── colors.css
│       └── fonts/
├── deploy/
│   ├── setup.sh                    # Fresh server setup script
│   ├── deploy.sh                   # Deployment script
│   ├── .env.example                # Environment template
│   └── supervisor/
│       ├── laravel-worker.conf
│       ├── mcp-server.conf
│       └── caddy.conf
└── shared/
    ├── .env                        # Shared secrets (generated by setup.sh)
    └── ssl/                        # Cloudflare origin certs (if needed)
```

---

## 4. Caddy Server Configuration

Caddy handles all routing on a single domain with automatic HTTPS.

```caddyfile
# /opt/orchestra/caddy/Caddyfile

orchestra-mcp.dev {
    # ─── Logging ───
    log {
        output file /var/log/caddy/access.log
        format json
    }

    # ─── Compression ───
    encode gzip zstd

    # ─── Security Headers ───
    header {
        X-Content-Type-Options "nosniff"
        X-Frame-Options "SAMEORIGIN"
        Referrer-Policy "strict-origin-when-cross-origin"
        X-XSS-Protection "1; mode=block"
        -Server
    }

    # ─── Go MCP Server ───
    handle /mcp* {
        reverse_proxy localhost:3001
    }

    # ─── Supabase PostgREST API ───
    handle /rest/v1/* {
        reverse_proxy localhost:54321 {
            header_up Host {http.request.host}
            header_up X-Real-IP {http.request.remote.host}
        }
    }

    # ─── Supabase GoTrue Auth ───
    handle /auth/v1/* {
        reverse_proxy localhost:54321 {
            header_up Host {http.request.host}
        }
    }

    # ─── Supabase Realtime ───
    handle /realtime/v1/* {
        reverse_proxy localhost:54321 {
            header_up Host {http.request.host}
            header_up Upgrade {http.request.header.Upgrade}
            header_up Connection {http.request.header.Connection}
        }
    }

    # ─── Supabase Storage ───
    handle /storage/v1/* {
        reverse_proxy localhost:54321 {
            header_up Host {http.request.host}
        }
    }

    # ─── Supabase Edge Functions ───
    handle /functions/v1/* {
        reverse_proxy localhost:54321 {
            header_up Host {http.request.host}
        }
    }

    # ─── Supabase Analytics/Ingest ───
    handle /ingest/* {
        reverse_proxy localhost:54321 {
            header_up Host {http.request.host}
        }
    }

    # ─── Supabase Studio (Deep Fork) ───
    handle /studio/* {
        reverse_proxy localhost:54323 {
            header_up Host {http.request.host}
        }
    }

    # ─── Static Assets (Laravel public/) ───
    handle /build/* {
        root * /opt/orchestra/web/public
        file_server
        header Cache-Control "public, max-age=31536000, immutable"
    }

    handle /favicon.ico {
        root * /opt/orchestra/web/public
        file_server
    }

    # ─── Laravel (everything else) ───
    handle {
        root * /opt/orchestra/web/public
        php_fastcgi unix//run/php/php8.3-fpm.sock
        file_server
    }
}
```

### 4.1 Caddy Notes

- Caddy auto-obtains and renews SSL certificates via Let's Encrypt
- If using Cloudflare proxy (orange cloud), configure Caddy with Cloudflare DNS module for cert validation
- WebSocket upgrade headers are forwarded for Supabase Realtime and MCP WebSocket
- Supabase Kong (port 54321) already routes internally between PostgREST, GoTrue, Realtime, Storage
- Studio runs on its own port (54323) since it's a separate Next.js app from the deep fork
- Laravel static assets get immutable cache headers for performance

---

## 5. Supabase Self-Hosted Setup

### 5.1 Initial Setup

Your Supabase Docker setup is already cloned and linked to your GitHub repo. The key configuration changes needed:

```bash
# In supabase/docker/.env — critical values to set:

############
# Secrets
############
POSTGRES_PASSWORD=<generated-by-setup-script>
JWT_SECRET=<generated-by-setup-script>
ANON_KEY=<generated-by-setup-script>
SERVICE_ROLE_KEY=<generated-by-setup-script>

############
# API Configuration  
############
SITE_URL=https://orchestra-mcp.dev
API_EXTERNAL_URL=https://orchestra-mcp.dev
SUPABASE_PUBLIC_URL=https://orchestra-mcp.dev

# Kong will listen on 54321 internally, Caddy proxies from 443
KONG_HTTP_PORT=54321
KONG_HTTPS_PORT=54322

############
# Studio Configuration
############
# Disable built-in Studio since we use our deep fork
STUDIO_DEFAULT_ORGANIZATION=Orchestra
STUDIO_DEFAULT_PROJECT=Orchestra MCP
STUDIO_PORT=54323
# Studio connects to Supabase via internal Docker network
SUPABASE_URL=http://kong:8000

############
# Auth Configuration
############
GOTRUE_SITE_URL=https://orchestra-mcp.dev
GOTRUE_EXTERNAL_GITHUB_ENABLED=true
GOTRUE_EXTERNAL_GITHUB_CLIENT_ID=<github-oauth-client-id>
GOTRUE_EXTERNAL_GITHUB_SECRET=<github-oauth-secret>
GOTRUE_EXTERNAL_GITHUB_REDIRECT_URI=https://orchestra-mcp.dev/auth/v1/callback
GOTRUE_EXTERNAL_GOOGLE_ENABLED=true
GOTRUE_EXTERNAL_GOOGLE_CLIENT_ID=<google-oauth-client-id>
GOTRUE_EXTERNAL_GOOGLE_SECRET=<google-oauth-secret>

# Email (for magic links, password reset)
GOTRUE_SMTP_HOST=smtp.gmail.com
GOTRUE_SMTP_PORT=587
GOTRUE_SMTP_USER=<email>
GOTRUE_SMTP_PASS=<app-password>
GOTRUE_SMTP_SENDER_NAME=Orchestra MCP
GOTRUE_MAILER_URLPATHS_CONFIRMATION=/auth/v1/verify
GOTRUE_MAILER_URLPATHS_RECOVERY=/auth/v1/verify

############
# Realtime
############
REALTIME_ENABLED=true

############
# Storage
############
STORAGE_BACKEND=file
FILE_STORAGE_BACKEND_PATH=/var/lib/storage
FILE_SIZE_LIMIT=52428800  # 50MB
```

### 5.2 Kong Route Configuration

Kong (Supabase's API gateway) needs updated routing since everything comes through the root domain, not a subdomain. Update `supabase/docker/volumes/api/kong.yml`:

Ensure the routes strip the version prefix correctly so PostgREST, GoTrue, and other services receive the paths they expect. Caddy forwards `/rest/v1/*` to Kong on port 54321, and Kong routes internally.

### 5.3 Enable Required Extensions

Add to `supabase/docker/volumes/db/init/00-extensions.sql`:

```sql
-- Required for Orchestra MCP
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
```

### 5.4 Docker Compose Modifications

Your forked `docker-compose.yml` should:

1. Mount the migrations directory: `./migrations:/docker-entrypoint-initdb.d/migrations`
2. Use the forked Studio image instead of the default: `image: orchestra/studio:latest` (or build from your fork)
3. Set Studio to run on port 54323
4. Ensure PostgreSQL has enough shared memory for pgvector: `shm_size: '2gb'`

---

## 6. Database Schema (Native Migrations)

All migrations follow Supabase native migration format. Files are in `/opt/orchestra/supabase/migrations/` and applied via `psql` or Supabase CLI during deployment.

### Migration 001: Extensions & Types

```sql
-- 20260328000001_extensions.sql

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Organization plans
DO $$ BEGIN
    CREATE TYPE org_plan AS ENUM ('free', 'pro', 'team', 'enterprise');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Team roles
DO $$ BEGIN
    CREATE TYPE team_role AS ENUM ('owner', 'admin', 'member', 'viewer');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Agent types
DO $$ BEGIN
    CREATE TYPE agent_type AS ENUM ('person', 'ai');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Task types
DO $$ BEGIN
    CREATE TYPE task_type AS ENUM ('epic', 'feature', 'task', 'bug', 'subtask');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Task status
DO $$ BEGIN
    CREATE TYPE task_status AS ENUM (
        'backlog', 'todo', 'in_progress', 'blocked',
        'in_review', 'done', 'cancelled'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Task priority
DO $$ BEGIN
    CREATE TYPE task_priority AS ENUM ('critical', 'high', 'medium', 'low');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Memory source
DO $$ BEGIN
    CREATE TYPE memory_source AS ENUM (
        'conversation', 'task', 'decision', 'document',
        'code_review', 'meeting', 'learning', 'spec'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Other enums
DO $$ BEGIN CREATE TYPE project_status AS ENUM ('active', 'archived', 'paused'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE agent_status AS ENUM ('active', 'inactive', 'archived'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE session_status AS ENUM ('active', 'idle', 'blocked', 'offline'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE spec_status AS ENUM ('draft', 'review', 'approved', 'archived'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE skill_proficiency AS ENUM ('basic', 'standard', 'expert'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE dependency_type AS ENUM ('blocks', 'relates_to'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Global updated_at trigger function
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### Migration 002: Profiles & Organizations

```sql
-- 20260328000002_profiles_organizations.sql

-- ── User Profiles (extends auth.users) ──
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT,
    username TEXT UNIQUE,
    avatar_url TEXT,
    cover_url TEXT,
    bio TEXT,
    phone TEXT,
    position TEXT,
    timezone TEXT DEFAULT 'UTC',
    language TEXT DEFAULT 'en' CHECK (language IN ('en', 'ar')),
    is_admin BOOLEAN DEFAULT false,
    onboarding_completed BOOLEAN DEFAULT false,
    settings JSONB DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TRIGGER on_profiles_updated BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name, avatar_url, username)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
        COALESCE(NEW.raw_user_meta_data->>'avatar_url', ''),
        COALESCE(NEW.raw_user_meta_data->>'preferred_username', 'user_' || substr(NEW.id::text, 1, 8))
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ── Organizations ──
CREATE TABLE IF NOT EXISTS public.organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    plan org_plan DEFAULT 'free',
    logo_url TEXT,
    description TEXT,
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT,
    settings JSONB DEFAULT '{}',
    limits JSONB DEFAULT '{
        "max_users": 1,
        "max_projects": 1,
        "max_tokens": 2,
        "max_agents": 3,
        "max_tasks_per_month": 100,
        "max_memory_mb": 50
    }',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TRIGGER on_organizations_updated BEFORE UPDATE ON public.organizations
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ── Teams ──
CREATE TABLE IF NOT EXISTS public.teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    description TEXT,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(organization_id, slug)
);

CREATE TRIGGER on_teams_updated BEFORE UPDATE ON public.teams
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE INDEX idx_teams_org ON public.teams(organization_id);

-- ── Team Members ──
CREATE TABLE IF NOT EXISTS public.team_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role team_role DEFAULT 'member',
    invited_by UUID REFERENCES auth.users(id),
    invited_at TIMESTAMPTZ,
    joined_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(team_id, user_id)
);

CREATE INDEX idx_team_members_user ON public.team_members(user_id);
CREATE INDEX idx_team_members_team ON public.team_members(team_id);
```

### Migration 003: MCP Tokens

```sql
-- 20260328000003_mcp_tokens.sql

CREATE TABLE IF NOT EXISTS public.mcp_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    token_hash TEXT UNIQUE NOT NULL,       -- SHA-256 hash
    token_prefix TEXT NOT NULL,            -- "orch_xxxxxxxx" display prefix
    name TEXT DEFAULT 'default',
    scopes TEXT[] DEFAULT ARRAY['read', 'write'],
    last_used_at TIMESTAMPTZ,
    last_used_ip TEXT,
    usage_count INTEGER DEFAULT 0,
    expires_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_mcp_tokens_hash ON public.mcp_tokens(token_hash) WHERE revoked_at IS NULL;
CREATE INDEX idx_mcp_tokens_user ON public.mcp_tokens(user_id);
CREATE INDEX idx_mcp_tokens_org ON public.mcp_tokens(organization_id);

-- Validate token and return user context
CREATE OR REPLACE FUNCTION public.validate_mcp_token(p_token_hash TEXT)
RETURNS TABLE (
    token_id UUID,
    user_id UUID,
    organization_id UUID,
    scopes TEXT[],
    plan org_plan,
    limits JSONB
) AS $$
BEGIN
    -- Update last used atomically
    UPDATE public.mcp_tokens t
    SET last_used_at = now(), usage_count = usage_count + 1
    WHERE t.token_hash = p_token_hash
        AND t.revoked_at IS NULL
        AND (t.expires_at IS NULL OR t.expires_at > now());

    RETURN QUERY
    SELECT
        t.id AS token_id,
        t.user_id,
        t.organization_id,
        t.scopes,
        o.plan,
        o.limits
    FROM public.mcp_tokens t
    JOIN public.organizations o ON o.id = t.organization_id
    WHERE t.token_hash = p_token_hash
        AND t.revoked_at IS NULL
        AND (t.expires_at IS NULL OR t.expires_at > now());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Migration 004: Projects, Skills, Agents

```sql
-- 20260328000004_projects_agents_skills.sql

-- ── Projects ──
CREATE TABLE IF NOT EXISTS public.projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
    created_by UUID NOT NULL REFERENCES auth.users(id),
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    description TEXT,
    repo_url TEXT,
    repo_default_branch TEXT DEFAULT 'main',
    workspace_path TEXT,
    status project_status DEFAULT 'active',
    settings JSONB DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(organization_id, slug)
);

CREATE TRIGGER on_projects_updated BEFORE UPDATE ON public.projects
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE INDEX idx_projects_org ON public.projects(organization_id);
CREATE INDEX idx_projects_team ON public.projects(team_id);

-- ── Skills ──
CREATE TABLE IF NOT EXISTS public.skills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES auth.users(id),
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    description TEXT,
    content TEXT,                   -- skill prompt/instructions
    category TEXT,
    is_public BOOLEAN DEFAULT false,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TRIGGER on_skills_updated BEFORE UPDATE ON public.skills
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE INDEX idx_skills_org ON public.skills(organization_id);
CREATE INDEX idx_skills_public ON public.skills(is_public) WHERE is_public = true;

-- ── Agents ──
CREATE TABLE IF NOT EXISTS public.agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
    created_by UUID NOT NULL REFERENCES auth.users(id),
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    type agent_type NOT NULL DEFAULT 'ai',
    role TEXT,                      -- CEO, Developer, QA, PM, etc.
    persona TEXT,                   -- personality for system prompt
    system_prompt TEXT,             -- full system prompt
    avatar_url TEXT,
    status agent_status DEFAULT 'active',
    linked_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    settings JSONB DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(organization_id, slug)
);

CREATE TRIGGER on_agents_updated BEFORE UPDATE ON public.agents
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE INDEX idx_agents_org ON public.agents(organization_id);
CREATE INDEX idx_agents_team ON public.agents(team_id);
CREATE INDEX idx_agents_linked ON public.agents(linked_user_id) WHERE linked_user_id IS NOT NULL;

-- ── Agent Skills (M2M) ──
CREATE TABLE IF NOT EXISTS public.agent_skills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
    skill_id UUID NOT NULL REFERENCES public.skills(id) ON DELETE CASCADE,
    proficiency skill_proficiency DEFAULT 'standard',
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(agent_id, skill_id)
);

CREATE INDEX idx_agent_skills_agent ON public.agent_skills(agent_id);
CREATE INDEX idx_agent_skills_skill ON public.agent_skills(skill_id);
```

### Migration 005: Workflows & Tasks

```sql
-- 20260328000005_workflows_tasks.sql

-- ── Workflows ──
CREATE TABLE IF NOT EXISTS public.workflows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    description TEXT,
    states JSONB NOT NULL DEFAULT '[
        {"name":"backlog","color":"#6B7280","order":0,"type":"start"},
        {"name":"todo","color":"#3B82F6","order":1,"type":"start"},
        {"name":"in_progress","color":"#F59E0B","order":2,"type":"progress"},
        {"name":"in_review","color":"#8B5CF6","order":3,"type":"progress"},
        {"name":"done","color":"#10B981","order":4,"type":"done"},
        {"name":"cancelled","color":"#EF4444","order":5,"type":"cancelled"}
    ]',
    transitions JSONB NOT NULL DEFAULT '[
        {"from":"backlog","to":"todo"},
        {"from":"todo","to":"in_progress"},
        {"from":"in_progress","to":"blocked"},
        {"from":"in_progress","to":"in_review"},
        {"from":"in_review","to":"done"},
        {"from":"in_review","to":"in_progress"},
        {"from":"blocked","to":"in_progress"},
        {"from":"*","to":"cancelled"}
    ]',
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(organization_id, slug)
);

CREATE TRIGGER on_workflows_updated BEFORE UPDATE ON public.workflows
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE UNIQUE INDEX idx_workflows_default ON public.workflows(organization_id) WHERE is_default = true;

-- ── Tasks ──
CREATE TABLE IF NOT EXISTS public.tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
    parent_task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
    workflow_id UUID REFERENCES public.workflows(id) ON DELETE SET NULL,
    assigned_agent_id UUID REFERENCES public.agents(id) ON DELETE SET NULL,
    assigned_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_by UUID NOT NULL REFERENCES auth.users(id),
    title TEXT NOT NULL,
    description TEXT,
    body TEXT,
    type task_type DEFAULT 'task',
    status task_status DEFAULT 'backlog',
    priority task_priority DEFAULT 'medium',
    estimate TEXT CHECK (estimate IN ('XS', 'S', 'M', 'L', 'XL')),
    labels TEXT[] DEFAULT '{}',
    due_date TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TRIGGER on_tasks_updated BEFORE UPDATE ON public.tasks
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE INDEX idx_tasks_project_status ON public.tasks(project_id, status);
CREATE INDEX idx_tasks_agent ON public.tasks(assigned_agent_id, status);
CREATE INDEX idx_tasks_user ON public.tasks(assigned_user_id, status);
CREATE INDEX idx_tasks_org ON public.tasks(organization_id);
CREATE INDEX idx_tasks_parent ON public.tasks(parent_task_id) WHERE parent_task_id IS NOT NULL;
CREATE INDEX idx_tasks_labels ON public.tasks USING gin(labels);
CREATE INDEX idx_tasks_priority ON public.tasks(priority, created_at);

-- Auto-set started_at / completed_at on status change
CREATE OR REPLACE FUNCTION public.handle_task_status_change()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'in_progress' AND OLD.status != 'in_progress' AND NEW.started_at IS NULL THEN
        NEW.started_at = now();
    END IF;
    IF NEW.status = 'done' AND OLD.status != 'done' AND NEW.completed_at IS NULL THEN
        NEW.completed_at = now();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_task_status_change BEFORE UPDATE OF status ON public.tasks
    FOR EACH ROW EXECUTE FUNCTION public.handle_task_status_change();

-- ── Task Dependencies ──
CREATE TABLE IF NOT EXISTS public.task_dependencies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    depends_on_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    type dependency_type DEFAULT 'blocks',
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(task_id, depends_on_id),
    CHECK (task_id != depends_on_id)
);

CREATE INDEX idx_task_deps_task ON public.task_dependencies(task_id);
CREATE INDEX idx_task_deps_depends ON public.task_dependencies(depends_on_id);
```

### Migration 006: Memory, Activity, Decisions, Sessions

```sql
-- 20260328000006_memory_activity.sql

-- ── Agent Memory (RAG via pgvector) ──
CREATE TABLE IF NOT EXISTS public.memories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    agent_id UUID REFERENCES public.agents(id) ON DELETE SET NULL,
    project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    source memory_source NOT NULL,
    source_ref TEXT,
    title TEXT,
    content TEXT NOT NULL,
    summary TEXT,
    embedding vector(1536),
    importance FLOAT DEFAULT 0.5 CHECK (importance >= 0 AND importance <= 1),
    tags TEXT[] DEFAULT '{}',
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TRIGGER on_memories_updated BEFORE UPDATE ON public.memories
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE INDEX idx_memories_embedding ON public.memories USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX idx_memories_agent ON public.memories(agent_id, source);
CREATE INDEX idx_memories_project ON public.memories(project_id, source);
CREATE INDEX idx_memories_org_time ON public.memories(organization_id, created_at DESC);
CREATE INDEX idx_memories_tags ON public.memories USING gin(tags);
CREATE INDEX idx_memories_fts ON public.memories USING gin(to_tsvector('english', coalesce(title,'') || ' ' || content));

-- ── Activity Log ──
CREATE TABLE IF NOT EXISTS public.activity_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    agent_id UUID REFERENCES public.agents(id) ON DELETE SET NULL,
    project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
    task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    summary TEXT NOT NULL,
    details JSONB DEFAULT '{}',
    session_id TEXT,
    machine_id TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_activity_org_time ON public.activity_log(organization_id, created_at DESC);
CREATE INDEX idx_activity_project ON public.activity_log(project_id, created_at DESC);
CREATE INDEX idx_activity_user ON public.activity_log(user_id, created_at DESC);
CREATE INDEX idx_activity_task ON public.activity_log(task_id) WHERE task_id IS NOT NULL;
CREATE INDEX idx_activity_action ON public.activity_log(action);

-- ── Decisions ──
CREATE TABLE IF NOT EXISTS public.decisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
    task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
    made_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    made_by_agent UUID REFERENCES public.agents(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    context TEXT,
    decision TEXT NOT NULL,
    alternatives TEXT,
    outcome TEXT,
    tags TEXT[] DEFAULT '{}',
    embedding vector(1536),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TRIGGER on_decisions_updated BEFORE UPDATE ON public.decisions
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE INDEX idx_decisions_org ON public.decisions(organization_id, created_at DESC);
CREATE INDEX idx_decisions_project ON public.decisions(project_id);
CREATE INDEX idx_decisions_embedding ON public.decisions USING ivfflat (embedding vector_cosine_ops) WITH (lists = 50);

-- ── Agent Sessions ──
CREATE TABLE IF NOT EXISTS public.agent_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id),
    agent_id UUID REFERENCES public.agents(id) ON DELETE SET NULL,
    machine_id TEXT NOT NULL,
    status session_status DEFAULT 'active',
    current_task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
    current_project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
    session_metadata JSONB DEFAULT '{}',
    last_heartbeat TIMESTAMPTZ DEFAULT now(),
    started_at TIMESTAMPTZ DEFAULT now(),
    ended_at TIMESTAMPTZ
);

CREATE INDEX idx_sessions_active ON public.agent_sessions(organization_id, status) WHERE ended_at IS NULL;
CREATE INDEX idx_sessions_user ON public.agent_sessions(user_id, status);
```

### Migration 007: Notes, Specs, GitHub

```sql
-- 20260328000007_notes_specs_github.sql

-- ── Notes ──
CREATE TABLE IF NOT EXISTS public.notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    body TEXT,
    tags TEXT[] DEFAULT '{}',
    icon TEXT,
    color TEXT,
    is_pinned BOOLEAN DEFAULT false,
    is_public BOOLEAN DEFAULT false,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TRIGGER on_notes_updated BEFORE UPDATE ON public.notes
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE INDEX idx_notes_user ON public.notes(user_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_notes_project ON public.notes(project_id) WHERE project_id IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX idx_notes_tags ON public.notes USING gin(tags);
CREATE INDEX idx_notes_fts ON public.notes USING gin(to_tsvector('english', coalesce(title,'') || ' ' || coalesce(body,'')));

-- ── Specs / Documents ──
CREATE TABLE IF NOT EXISTS public.specs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES auth.users(id),
    title TEXT NOT NULL,
    slug TEXT NOT NULL,
    content TEXT NOT NULL,
    version INTEGER DEFAULT 1,
    status spec_status DEFAULT 'draft',
    github_path TEXT,
    parent_id UUID REFERENCES public.specs(id) ON DELETE SET NULL,
    embedding vector(1536),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(project_id, slug)
);

CREATE TRIGGER on_specs_updated BEFORE UPDATE ON public.specs
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE INDEX idx_specs_project ON public.specs(project_id, status);
CREATE INDEX idx_specs_embedding ON public.specs USING ivfflat (embedding vector_cosine_ops) WITH (lists = 50);

-- ── GitHub Connections ──
CREATE TABLE IF NOT EXISTS public.github_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    github_user_id TEXT NOT NULL,
    github_username TEXT,
    access_token_encrypted TEXT NOT NULL,
    scopes TEXT[] DEFAULT '{}',
    connected_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(organization_id, user_id)
);

-- ── Project Repo Links ──
CREATE TABLE IF NOT EXISTS public.project_repos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    github_connection_id UUID NOT NULL REFERENCES public.github_connections(id) ON DELETE CASCADE,
    repo_full_name TEXT NOT NULL,
    default_branch TEXT DEFAULT 'main',
    sync_specs BOOLEAN DEFAULT true,
    sync_claude_md BOOLEAN DEFAULT true,
    webhook_secret TEXT,
    webhook_id TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(project_id, repo_full_name)
);
```

### Migration 008: RLS Policies

```sql
-- 20260328000008_rls_policies.sql

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mcp_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_dependencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.specs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.github_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_repos ENABLE ROW LEVEL SECURITY;

-- Helper: get user's org IDs
CREATE OR REPLACE FUNCTION public.user_org_ids()
RETURNS SETOF UUID AS $$
    SELECT DISTINCT t.organization_id
    FROM public.teams t
    JOIN public.team_members tm ON tm.team_id = t.id
    WHERE tm.user_id = auth.uid()
    UNION
    SELECT id FROM public.organizations WHERE owner_id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ── Profiles ──
CREATE POLICY profiles_own ON public.profiles
    FOR ALL USING (id = auth.uid());
CREATE POLICY profiles_read_org ON public.profiles
    FOR SELECT USING (
        id IN (SELECT user_id FROM public.team_members WHERE team_id IN (
            SELECT team_id FROM public.team_members WHERE user_id = auth.uid()
        ))
    );

-- ── Organizations ──
CREATE POLICY org_access ON public.organizations
    FOR ALL USING (id IN (SELECT public.user_org_ids()));

-- ── Teams ──
CREATE POLICY team_read ON public.teams
    FOR SELECT USING (organization_id IN (SELECT public.user_org_ids()));
CREATE POLICY team_write ON public.teams
    FOR ALL USING (
        organization_id IN (
            SELECT id FROM public.organizations WHERE owner_id = auth.uid()
        )
    );

-- ── Team Members ──
CREATE POLICY tm_read ON public.team_members
    FOR SELECT USING (
        team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid())
    );
CREATE POLICY tm_manage ON public.team_members
    FOR ALL USING (
        team_id IN (
            SELECT t.id FROM public.teams t
            JOIN public.organizations o ON o.id = t.organization_id
            WHERE o.owner_id = auth.uid()
        )
    );

-- ── MCP Tokens ──
CREATE POLICY tokens_own ON public.mcp_tokens
    FOR ALL USING (user_id = auth.uid());

-- ── Org-scoped tables (projects, agents, skills, tasks, etc.) ──
-- All use the same pattern: org_id must be in user's org list

CREATE POLICY projects_access ON public.projects
    FOR ALL USING (organization_id IN (SELECT public.user_org_ids()));

CREATE POLICY skills_access ON public.skills
    FOR ALL USING (
        organization_id IN (SELECT public.user_org_ids())
        OR is_public = true
    );

CREATE POLICY agents_access ON public.agents
    FOR ALL USING (organization_id IN (SELECT public.user_org_ids()));

CREATE POLICY workflows_access ON public.workflows
    FOR ALL USING (organization_id IN (SELECT public.user_org_ids()));

CREATE POLICY tasks_access ON public.tasks
    FOR ALL USING (organization_id IN (SELECT public.user_org_ids()));

CREATE POLICY memories_access ON public.memories
    FOR ALL USING (organization_id IN (SELECT public.user_org_ids()));

CREATE POLICY activity_access ON public.activity_log
    FOR ALL USING (organization_id IN (SELECT public.user_org_ids()));

CREATE POLICY decisions_access ON public.decisions
    FOR ALL USING (organization_id IN (SELECT public.user_org_ids()));

CREATE POLICY sessions_access ON public.agent_sessions
    FOR ALL USING (organization_id IN (SELECT public.user_org_ids()));

CREATE POLICY notes_access ON public.notes
    FOR ALL USING (
        user_id = auth.uid()
        OR organization_id IN (SELECT public.user_org_ids())
        OR is_public = true
    );

CREATE POLICY specs_access ON public.specs
    FOR ALL USING (organization_id IN (SELECT public.user_org_ids()));

CREATE POLICY github_access ON public.github_connections
    FOR ALL USING (user_id = auth.uid());

CREATE POLICY repos_access ON public.project_repos
    FOR ALL USING (
        project_id IN (
            SELECT id FROM public.projects WHERE organization_id IN (SELECT public.user_org_ids())
        )
    );

CREATE POLICY agent_skills_access ON public.agent_skills
    FOR ALL USING (
        agent_id IN (
            SELECT id FROM public.agents WHERE organization_id IN (SELECT public.user_org_ids())
        )
    );

CREATE POLICY task_deps_access ON public.task_dependencies
    FOR ALL USING (
        task_id IN (
            SELECT id FROM public.tasks WHERE organization_id IN (SELECT public.user_org_ids())
        )
    );
```

### Migration 009: Database Functions

```sql
-- 20260328000009_functions.sql

-- ── Vector memory search ──
CREATE OR REPLACE FUNCTION public.search_memory(
    query_embedding vector(1536),
    p_org_id UUID,
    match_count INT DEFAULT 10,
    match_threshold FLOAT DEFAULT 0.7,
    p_agent_id UUID DEFAULT NULL,
    p_project_id UUID DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    content TEXT,
    summary TEXT,
    source memory_source,
    title TEXT,
    tags TEXT[],
    similarity FLOAT,
    created_at TIMESTAMPTZ
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    RETURN QUERY
    SELECT
        m.id, m.content, m.summary, m.source, m.title, m.tags,
        1 - (m.embedding <=> query_embedding) AS similarity,
        m.created_at
    FROM public.memories m
    WHERE m.organization_id = p_org_id
        AND (p_agent_id IS NULL OR m.agent_id = p_agent_id)
        AND (p_project_id IS NULL OR m.project_id = p_project_id)
        AND 1 - (m.embedding <=> query_embedding) > match_threshold
        AND (m.expires_at IS NULL OR m.expires_at > now())
    ORDER BY m.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- ── Search decisions ──
CREATE OR REPLACE FUNCTION public.search_decisions(
    query_embedding vector(1536),
    p_org_id UUID,
    match_count INT DEFAULT 5,
    p_project_id UUID DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    title TEXT,
    decision TEXT,
    context TEXT,
    alternatives TEXT,
    outcome TEXT,
    similarity FLOAT,
    created_at TIMESTAMPTZ
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    RETURN QUERY
    SELECT
        d.id, d.title, d.decision, d.context, d.alternatives, d.outcome,
        1 - (d.embedding <=> query_embedding) AS similarity,
        d.created_at
    FROM public.decisions d
    WHERE d.organization_id = p_org_id
        AND (p_project_id IS NULL OR d.project_id = p_project_id)
        AND d.embedding IS NOT NULL
    ORDER BY d.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- ── Team activity summary ──
CREATE OR REPLACE FUNCTION public.get_team_activity(
    p_org_id UUID,
    p_hours INT DEFAULT 24
)
RETURNS TABLE (
    user_id UUID,
    total_actions BIGINT,
    tasks_completed BIGINT,
    tasks_started BIGINT,
    blockers BIGINT,
    last_action_at TIMESTAMPTZ
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    RETURN QUERY
    SELECT
        al.user_id,
        COUNT(*) AS total_actions,
        COUNT(*) FILTER (WHERE al.action = 'completed') AS tasks_completed,
        COUNT(*) FILTER (WHERE al.action = 'started') AS tasks_started,
        COUNT(*) FILTER (WHERE al.action = 'blocked') AS blockers,
        MAX(al.created_at) AS last_action_at
    FROM public.activity_log al
    WHERE al.organization_id = p_org_id
        AND al.created_at > now() - (p_hours || ' hours')::INTERVAL
    GROUP BY al.user_id;
END;
$$;

-- ── Get next unblocked task by priority ──
CREATE OR REPLACE FUNCTION public.get_next_task(
    p_org_id UUID,
    p_agent_id UUID DEFAULT NULL,
    p_user_id UUID DEFAULT NULL,
    p_project_id UUID DEFAULT NULL
)
RETURNS SETOF public.tasks
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    RETURN QUERY
    SELECT t.*
    FROM public.tasks t
    WHERE t.organization_id = p_org_id
        AND t.status IN ('todo', 'backlog')
        AND (p_agent_id IS NULL OR t.assigned_agent_id = p_agent_id)
        AND (p_user_id IS NULL OR t.assigned_user_id = p_user_id)
        AND (p_project_id IS NULL OR t.project_id = p_project_id)
        AND NOT EXISTS (
            SELECT 1 FROM public.task_dependencies td
            JOIN public.tasks bt ON bt.id = td.depends_on_id
            WHERE td.task_id = t.id AND td.type = 'blocks'
            AND bt.status NOT IN ('done', 'cancelled')
        )
    ORDER BY
        CASE t.priority
            WHEN 'critical' THEN 0
            WHEN 'high' THEN 1
            WHEN 'medium' THEN 2
            WHEN 'low' THEN 3
        END,
        t.created_at ASC
    LIMIT 1;
END;
$$;

-- ── Project progress stats ──
CREATE OR REPLACE FUNCTION public.get_project_progress(p_project_id UUID)
RETURNS TABLE (
    total_tasks BIGINT,
    completed BIGINT,
    in_progress BIGINT,
    blocked BIGINT,
    backlog BIGINT,
    completion_pct FLOAT
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(*) AS total_tasks,
        COUNT(*) FILTER (WHERE t.status = 'done') AS completed,
        COUNT(*) FILTER (WHERE t.status = 'in_progress') AS in_progress,
        COUNT(*) FILTER (WHERE t.status = 'blocked') AS blocked,
        COUNT(*) FILTER (WHERE t.status IN ('backlog', 'todo')) AS backlog,
        CASE WHEN COUNT(*) > 0
            THEN ROUND((COUNT(*) FILTER (WHERE t.status = 'done'))::NUMERIC / COUNT(*)::NUMERIC * 100, 1)
            ELSE 0
        END::FLOAT AS completion_pct
    FROM public.tasks t
    WHERE t.project_id = p_project_id;
END;
$$;

-- ── Stale session cleanup ──
CREATE OR REPLACE FUNCTION public.cleanup_stale_sessions()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    UPDATE public.agent_sessions
    SET status = 'offline', ended_at = now()
    WHERE ended_at IS NULL
        AND last_heartbeat < now() - INTERVAL '10 minutes';
END;
$$;
```

### Migration 010: Realtime & Seeding

```sql
-- 20260328000010_realtime_seeds.sql

-- Enable Supabase Realtime on sync-critical tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.activity_log;
ALTER PUBLICATION supabase_realtime ADD TABLE public.agent_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.specs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.agents;

-- ── Seed: Default workflow template ──
-- This gets created per-org during onboarding, but we store a template
CREATE TABLE IF NOT EXISTS public.workflow_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    description TEXT,
    states JSONB NOT NULL,
    transitions JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO public.workflow_templates (name, slug, description, states, transitions) VALUES
(
    'Default Software Development',
    'default-software',
    'Standard software development workflow with backlog, sprint, review, and done states',
    '[
        {"name":"backlog","color":"#6B7280","order":0,"type":"start"},
        {"name":"todo","color":"#3B82F6","order":1,"type":"start"},
        {"name":"in_progress","color":"#F59E0B","order":2,"type":"progress"},
        {"name":"in_review","color":"#8B5CF6","order":3,"type":"progress"},
        {"name":"done","color":"#10B981","order":4,"type":"done"},
        {"name":"cancelled","color":"#EF4444","order":5,"type":"cancelled"}
    ]',
    '[
        {"from":"backlog","to":"todo"},
        {"from":"todo","to":"in_progress"},
        {"from":"in_progress","to":"blocked"},
        {"from":"in_progress","to":"in_review"},
        {"from":"in_review","to":"done"},
        {"from":"in_review","to":"in_progress"},
        {"from":"blocked","to":"in_progress"},
        {"from":"*","to":"cancelled"}
    ]'
),
(
    'Kanban',
    'kanban',
    'Simple kanban board workflow',
    '[
        {"name":"todo","color":"#3B82F6","order":0,"type":"start"},
        {"name":"doing","color":"#F59E0B","order":1,"type":"progress"},
        {"name":"done","color":"#10B981","order":2,"type":"done"}
    ]',
    '[
        {"from":"todo","to":"doing"},
        {"from":"doing","to":"done"},
        {"from":"doing","to":"todo"},
        {"from":"done","to":"doing"}
    ]'
),
(
    'Bug Tracking',
    'bug-tracking',
    'Bug lifecycle from report to resolution',
    '[
        {"name":"reported","color":"#EF4444","order":0,"type":"start"},
        {"name":"confirmed","color":"#F59E0B","order":1,"type":"start"},
        {"name":"fixing","color":"#3B82F6","order":2,"type":"progress"},
        {"name":"testing","color":"#8B5CF6","order":3,"type":"progress"},
        {"name":"resolved","color":"#10B981","order":4,"type":"done"},
        {"name":"wont_fix","color":"#6B7280","order":5,"type":"cancelled"}
    ]',
    '[
        {"from":"reported","to":"confirmed"},
        {"from":"confirmed","to":"fixing"},
        {"from":"fixing","to":"testing"},
        {"from":"testing","to":"resolved"},
        {"from":"testing","to":"fixing"},
        {"from":"reported","to":"wont_fix"},
        {"from":"confirmed","to":"wont_fix"}
    ]'
)
ON CONFLICT (slug) DO NOTHING;
```

---

## 7. Go MCP Server

Full specification in PRD v1 Section 5. Key points for implementation:

### 7.1 Project Structure

```
orchestra-mcp-server/
├── cmd/server/main.go
├── internal/
│   ├── auth/middleware.go          # Token validation via Supabase
│   ├── mcp/
│   │   ├── server.go              # MCP SSE + stdio handler
│   │   ├── tools.go               # Tool registry
│   │   └── types.go               # Protocol types
│   ├── tools/
│   │   ├── agents.go              # Agent CRUD
│   │   ├── tasks.go               # Task management
│   │   ├── memory.go              # Memory + RAG search
│   │   ├── activity.go            # Activity logging
│   │   ├── team.go                # Team status/sync
│   │   ├── projects.go            # Project management
│   │   ├── specs.go               # Spec management
│   │   ├── notes.go               # Notes
│   │   ├── decisions.go           # Decision logging
│   │   ├── workflows.go           # Workflow management
│   │   ├── github.go              # GitHub API tools
│   │   └── skills.go              # Skills management
│   ├── db/supabase.go             # Supabase REST client
│   ├── embedding/embed.go         # Vector embedding generation
│   ├── github/client.go           # GitHub API client
│   └── realtime/hub.go            # Realtime subscription hub
├── Dockerfile
├── go.mod
└── go.sum
```

### 7.2 MCP Tools List

See PRD v1 Section 5.2 for full tool specifications. Total: ~40 tools across 11 categories.

### 7.3 Environment Variables

```env
PORT=3001
DATABASE_URL=postgresql://postgres:<password>@localhost:5432/postgres
SUPABASE_URL=http://localhost:54321
SUPABASE_SERVICE_KEY=<service-role-key>
EMBEDDING_PROVIDER=openai
EMBEDDING_API_KEY=<openai-key>
EMBEDDING_MODEL=text-embedding-3-small
GITHUB_APP_ID=<optional>
GITHUB_APP_KEY_PATH=<optional>
SLACK_BOT_TOKEN=<optional>
```

---

## 8. Supabase Studio Deep Fork

### 8.1 Branding Overhaul

The forked Studio gets full Orchestra branding using assets from `arts/` folder:

| Element | Change |
|---------|--------|
| Logo | Replace Supabase logo with Orchestra logo from `arts/logo.svg` |
| Dark logo | `arts/logo-dark.svg` |
| Favicon | `arts/icon.svg` |
| Color palette | Use colors from `arts/colors.css` |
| Typography | Use fonts from `arts/fonts/` |
| App name | "Orchestra Studio" |
| Title bar | "Orchestra Studio — Admin" |
| Login page | Orchestra branding, auth via Supabase GoTrue (admin JWT claim) |

### 8.2 Auth Integration (Option B)

Studio authenticates via Supabase Auth with admin role checking:

```
1. User navigates to /studio
2. Studio checks for valid Supabase JWT in cookie/localStorage
3. If no JWT → redirect to /studio/login
4. Studio login page → authenticates via Supabase GoTrue API
5. After auth → Studio checks profiles.is_admin = true
6. If not admin → show "Access Denied" page
7. If admin → load full Studio interface
```

Implementation in the Studio fork:
- Modify `apps/studio/pages/_app.tsx` to check auth on mount
- Add admin verification middleware
- Replace basic auth with JWT-based auth
- Share auth state with Laravel via same Supabase JWT

### 8.3 Custom Navigation (Restructured)

```
Orchestra Studio Sidebar:
│
├── 🏠 Dashboard
│   └── Overview (active connections, revenue, system health)
│
├── 📊 Orchestra
│   ├── Organizations (list, plan management, limits)
│   ├── MCP Tokens (active, usage stats, revoke)
│   ├── Agents (all agents across orgs, monitoring)
│   ├── Active Sessions (who's connected, heartbeat status)
│   ├── Activity Feed (global activity stream, filterable)
│   └── Workflows (template management)
│
├── 💾 Database
│   ├── Table Editor (existing Studio feature)
│   ├── SQL Editor (existing Studio feature)
│   └── Migrations (existing Studio feature)
│
├── 👤 Authentication
│   ├── Users (existing Studio feature)
│   ├── Policies (existing Studio feature)
│   └── Providers (existing Studio feature)
│
├── 📦 Storage
│   └── Buckets (existing Studio feature)
│
├── ⚡ Edge Functions
│   └── Functions (existing Studio feature)
│
├── 🔄 Realtime
│   └── Inspector (existing Studio feature)
│
├── 📡 API
│   └── API Docs (existing Studio feature, auto-generated)
│
├── 💰 Billing (custom)
│   ├── Subscriptions (Stripe data)
│   ├── Usage Metrics (per org breakdown)
│   └── Plan Limits (configuration)
│
└── ⚙️ Settings
    ├── General (existing)
    ├── Feature Flags (custom — control what's enabled)
    └── System Health (custom — service status)
```

### 8.4 Custom Pages to Build

| Page | Description | Data Source |
|------|-------------|-------------|
| Dashboard Overview | Active MCP connections, tasks/day chart, revenue, system metrics | activity_log, agent_sessions, Stripe API |
| Organizations | List all orgs, change plans, set limits, view members | organizations, team_members |
| MCP Tokens | All active tokens with usage stats, revoke action | mcp_tokens |
| Agents Monitor | List agents, current status, recent activity per agent | agents, agent_sessions, activity_log |
| Active Sessions | Live view of who's connected, what they're doing | agent_sessions (Realtime subscription) |
| Activity Feed | Global activity stream with org/project/user filters | activity_log |
| Billing | Stripe subscription data, usage per org | Stripe API, custom usage table |
| Feature Flags | Toggle features for orgs (marketplace, GitHub sync, etc.) | organizations.settings |

### 8.5 Studio Port Configuration

Studio runs as a separate Next.js process on port 54323. Caddy proxies `/studio/*` to it. In your docker-compose or supervisor config:

```yaml
# If running Studio via Docker:
studio:
  image: orchestra/studio:latest
  ports:
    - "54323:3000"
  environment:
    STUDIO_PG_META_URL: http://pg-meta:8080
    SUPABASE_URL: http://kong:8000
    SUPABASE_ANON_KEY: ${ANON_KEY}
    NEXT_PUBLIC_BASE_PATH: /studio
```

The `NEXT_PUBLIC_BASE_PATH: /studio` ensures Studio's Next.js router handles the `/studio` prefix correctly.

---

## 9. Supabase Edge Functions

### 9.1 Stripe Webhook Handler

```
supabase/functions/stripe-webhook/index.ts

Handles:
- checkout.session.completed → create/upgrade org plan
- customer.subscription.updated → update plan + limits
- customer.subscription.deleted → downgrade to free
- invoice.payment_failed → notify org owner
```

### 9.2 Cron: Agent Trigger

```
supabase/functions/cron-agent-trigger/index.ts

Runs on schedule (configured per org):
- Checks for scheduled agent tasks
- Hits Go MCP server endpoint to trigger agent execution
- Logs trigger event to activity_log
```

### 9.3 Cron: Session Cleanup

```
supabase/functions/cron-session-cleanup/index.ts

Runs every 5 minutes:
- Calls cleanup_stale_sessions() DB function
- Marks sessions with stale heartbeat as offline
```

---

## 10. Laravel Web Application

### 10.1 Stack

- **Laravel 11** (latest stable)
- **Blade** templates (server-rendered for SEO)
- **Livewire 3** (interactive components without JavaScript)
- **Tailwind CSS 4** (styling)
- **Vite** (asset bundling)
- **Alpine.js** (minimal client-side interactivity via Livewire)

No Inertia. No Vue/React. Pure Blade + Livewire for maximum SEO and simplicity.

### 10.2 Design References

The UI design draws from these reference sites:

| Reference | What to take |
|-----------|--------------|
| [filamentphp.com](https://filamentphp.com) | Dashboard card style, clean typography, sidebar patterns |
| [laravel.com](https://laravel.com) | Landing page hero, documentation layout, gradient treatments |
| [supabase.com](https://supabase.com) | Dark theme aesthetics, code block styling, feature grid |
| [inertiajs.com](https://inertiajs.com) | Minimal clean layout, documentation structure, whitespace |

Brand assets from `arts/` folder override all default framework styling.

### 10.3 Project Structure

```
web/
├── app/
│   ├── Http/
│   │   ├── Controllers/
│   │   │   ├── HomeController.php
│   │   │   ├── Auth/
│   │   │   │   ├── LoginController.php
│   │   │   │   ├── RegisterController.php
│   │   │   │   └── SupabaseAuthController.php   # Syncs with Supabase GoTrue
│   │   │   ├── OnboardingController.php
│   │   │   ├── DashboardController.php
│   │   │   ├── TokenController.php
│   │   │   ├── TeamController.php
│   │   │   ├── DocsController.php
│   │   │   ├── BlogController.php
│   │   │   └── WebhookController.php            # Stripe webhooks
│   │   └── Middleware/
│   │       ├── EnsureOnboarded.php
│   │       └── AdminMiddleware.php
│   ├── Livewire/
│   │   ├── Dashboard/
│   │   │   ├── ConnectionStatus.php              # Live MCP connection indicator
│   │   │   ├── UsageStats.php                    # Tasks, agents, memory usage
│   │   │   └── RecentActivity.php                # Activity feed
│   │   ├── Tokens/
│   │   │   ├── TokenList.php                     # List/revoke tokens
│   │   │   └── CreateToken.php                   # Generate new token modal
│   │   ├── Team/
│   │   │   ├── MemberList.php
│   │   │   └── InviteMember.php
│   │   ├── Onboarding/
│   │   │   ├── CompanySetup.php
│   │   │   ├── TeamSetup.php
│   │   │   └── ConnectClaude.php
│   │   └── Billing/
│   │       └── SubscriptionManager.php
│   ├── Models/
│   │   ├── User.php                              # Synced with Supabase auth.users
│   │   ├── Organization.php
│   │   ├── Team.php
│   │   ├── McpToken.php
│   │   └── ...                                   # Mirror Supabase tables
│   └── Services/
│       ├── SupabaseService.php                   # REST client for Supabase
│       ├── SupabaseAuthService.php               # Auth sync (Laravel ↔ GoTrue)
│       ├── TokenService.php                      # Token generation + hashing
│       └── StripeService.php
├── resources/
│   ├── views/
│   │   ├── layouts/
│   │   │   ├── app.blade.php                     # Main layout
│   │   │   ├── guest.blade.php                   # Unauthenticated layout
│   │   │   ├── dashboard.blade.php               # Dashboard layout with sidebar
│   │   │   └── docs.blade.php                    # Documentation layout
│   │   ├── pages/
│   │   │   ├── home.blade.php                    # Landing page
│   │   │   ├── pricing.blade.php
│   │   │   ├── features.blade.php
│   │   │   └── about.blade.php
│   │   ├── auth/
│   │   │   ├── login.blade.php
│   │   │   ├── register.blade.php
│   │   │   ├── forgot-password.blade.php
│   │   │   └── verify-email.blade.php
│   │   ├── dashboard/
│   │   │   ├── index.blade.php
│   │   │   ├── tokens.blade.php
│   │   │   ├── team.blade.php
│   │   │   ├── usage.blade.php
│   │   │   ├── settings.blade.php
│   │   │   └── billing.blade.php
│   │   ├── onboarding/
│   │   │   ├── company.blade.php
│   │   │   ├── team.blade.php
│   │   │   └── connect.blade.php
│   │   ├── docs/
│   │   │   ├── index.blade.php
│   │   │   ├── getting-started.blade.php
│   │   │   ├── tools.blade.php
│   │   │   └── self-hosted.blade.php
│   │   └── blog/
│   │       ├── index.blade.php
│   │       └── show.blade.php
│   └── css/
│       └── app.css                               # Tailwind + brand overrides
├── routes/
│   ├── web.php
│   └── api.php                                   # Stripe webhooks
├── arts/                                          # Brand assets
│   ├── logo.svg
│   ├── logo-dark.svg
│   ├── icon.svg
│   ├── colors.css
│   └── fonts/
├── public/
│   └── ...
├── tailwind.config.js                            # Brand colors from arts/colors.css
├── vite.config.js
└── composer.json
```

### 10.4 Laravel ↔ Supabase Auth Sync

Laravel maintains its own session/auth for web pages, but syncs users bidirectionally with Supabase GoTrue:

```
Registration flow:
1. User submits register form → Laravel creates local user
2. Laravel calls Supabase GoTrue Admin API → creates Supabase auth.users record
3. Supabase trigger creates profiles row
4. Laravel stores supabase_user_id on local user model

Login flow:
1. User submits login form → Laravel authenticates locally
2. Laravel generates a Supabase JWT for the user (using JWT_SECRET)
3. Stores JWT in session for API calls to Supabase
4. Dashboard Livewire components use this JWT for Supabase REST calls

Why both:
- Laravel auth = server-rendered pages, SEO, Blade sessions
- Supabase JWT = RLS policies work, Go MCP server validates same tokens
- Same user, same UUID, two auth systems in sync
```

### 10.5 Routes

```php
// routes/web.php

// ── Public pages (SEO) ──
Route::get('/', [HomeController::class, 'index'])->name('home');
Route::get('/pricing', [HomeController::class, 'pricing'])->name('pricing');
Route::get('/features', [HomeController::class, 'features'])->name('features');
Route::get('/about', [HomeController::class, 'about'])->name('about');
Route::get('/docs/{slug?}', [DocsController::class, 'show'])->name('docs');
Route::get('/blog', [BlogController::class, 'index'])->name('blog');
Route::get('/blog/{slug}', [BlogController::class, 'show'])->name('blog.show');

// ── Auth ──
Route::middleware('guest')->group(function () {
    Route::get('/login', [LoginController::class, 'show'])->name('login');
    Route::post('/login', [LoginController::class, 'store']);
    Route::get('/register', [RegisterController::class, 'show'])->name('register');
    Route::post('/register', [RegisterController::class, 'store']);
    Route::get('/auth/callback/{provider}', [SupabaseAuthController::class, 'callback']);
});

Route::post('/logout', [LoginController::class, 'destroy'])->name('logout');

// ── Onboarding ──
Route::middleware(['auth', 'ensure.not.onboarded'])->prefix('onboarding')->group(function () {
    Route::get('/company', [OnboardingController::class, 'company'])->name('onboarding.company');
    Route::get('/team', [OnboardingController::class, 'team'])->name('onboarding.team');
    Route::get('/connect', [OnboardingController::class, 'connect'])->name('onboarding.connect');
});

// ── Dashboard (authenticated + onboarded) ──
Route::middleware(['auth', 'ensure.onboarded'])->prefix('dashboard')->group(function () {
    Route::get('/', [DashboardController::class, 'index'])->name('dashboard');
    Route::get('/tokens', [DashboardController::class, 'tokens'])->name('dashboard.tokens');
    Route::get('/team', [DashboardController::class, 'team'])->name('dashboard.team');
    Route::get('/usage', [DashboardController::class, 'usage'])->name('dashboard.usage');
    Route::get('/settings', [DashboardController::class, 'settings'])->name('dashboard.settings');
    Route::get('/billing', [DashboardController::class, 'billing'])->name('dashboard.billing');
});

// ── Stripe webhook ──
Route::post('/webhooks/stripe', [WebhookController::class, 'stripe'])->name('webhooks.stripe');
```

### 10.6 Database Connection

Laravel connects directly to the same PostgreSQL that Supabase uses. Laravel models map to the `public.*` tables created by migrations. This means:

- Laravel reads/writes the same tables as Supabase PostgREST and Go MCP server
- No data duplication, single source of truth
- Laravel can use Eloquent for complex dashboard queries
- RLS is enforced at Supabase API level; Laravel uses service role for direct DB access

```php
// .env
DB_CONNECTION=pgsql
DB_HOST=127.0.0.1
DB_PORT=5432
DB_DATABASE=postgres
DB_USERNAME=postgres
DB_PASSWORD=<same-as-supabase-postgres-password>
DB_SCHEMA=public
```

---

## 11. Design System & Brand

### 11.1 Brand Assets (arts/ folder)

```
arts/
├── logo.svg              # Full logo (light backgrounds)
├── logo-dark.svg         # Full logo (dark backgrounds)
├── icon.svg              # Icon only (for favicon, mobile)
├── logo-mark.svg         # Logo mark without text
├── colors.css            # CSS custom properties for brand colors
├── fonts/
│   ├── *.woff2           # Brand font files
│   └── font-face.css     # @font-face declarations
└── og-image.png          # Default Open Graph image (1200x630)
```

### 11.2 Tailwind Config Integration

```javascript
// tailwind.config.js
// Import brand colors from arts/colors.css variables

export default {
    theme: {
        extend: {
            colors: {
                // Map CSS custom properties from arts/colors.css
                brand: {
                    50:  'var(--color-brand-50)',
                    100: 'var(--color-brand-100)',
                    // ...through 950
                    DEFAULT: 'var(--color-brand-500)',
                },
                surface: {
                    DEFAULT: 'var(--color-surface)',
                    alt: 'var(--color-surface-alt)',
                },
            },
            fontFamily: {
                sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
                mono: ['var(--font-mono)', 'monospace'],
            },
        },
    },
}
```

### 11.3 UI Component Patterns

Following reference site aesthetics:

| Pattern | Reference | Usage |
|---------|-----------|-------|
| Hero gradient | laravel.com | Landing page hero section |
| Feature grid | supabase.com | Features page, 3-column cards |
| Dashboard cards | filamentphp.com | Stats, connection status |
| Code blocks | supabase.com | Docs, connection instructions |
| Clean docs | inertiajs.com | Documentation pages |
| Sidebar nav | filamentphp.com | Dashboard navigation |
| Pricing table | supabase.com | Plan comparison |

---

## 12. Deployment Scripts

### 12.1 Fresh Server Setup

See `deploy/setup.sh` — installs all dependencies, configures services, generates secrets.

### 12.2 Deploy Script

See `deploy/deploy.sh` — pulls latest code, runs migrations, builds assets, restarts services.

### 12.3 Supervisor Configs

```ini
# deploy/supervisor/caddy.conf
[program:caddy]
command=/usr/bin/caddy run --config /opt/orchestra/caddy/Caddyfile
autostart=true
autorestart=true
stdout_logfile=/var/log/caddy/stdout.log
stderr_logfile=/var/log/caddy/stderr.log

# deploy/supervisor/mcp-server.conf
[program:orchestra-mcp]
command=/opt/orchestra/mcp-server/orchestra-mcp
directory=/opt/orchestra/mcp-server
environment=PORT=3001
autostart=true
autorestart=true
stdout_logfile=/var/log/orchestra/mcp.log
stderr_logfile=/var/log/orchestra/mcp-error.log

# deploy/supervisor/laravel-worker.conf
[program:laravel-worker]
command=php /opt/orchestra/web/artisan queue:work --sleep=3 --tries=3
autostart=true
autorestart=true
numprocs=2
stdout_logfile=/var/log/orchestra/worker.log
stderr_logfile=/var/log/orchestra/worker-error.log
```

---

## 13. Implementation Phases

### Phase 1: Infrastructure (Days 1-3)

- [ ] Fresh Ubuntu server provisioning
- [ ] Run setup.sh (install Docker, Caddy, PHP, Go, Redis, Node)
- [ ] Clone Supabase Docker, configure .env, start services
- [ ] Apply all 10 database migrations
- [ ] Configure Caddy with path-based routing
- [ ] Verify: Supabase API accessible at /rest/v1, /auth/v1
- [ ] Verify: Studio fork accessible at /studio
- [ ] Scaffold Laravel project, configure DB connection to Supabase Postgres
- [ ] Deploy Laravel, verify accessible at /
- [ ] Scaffold Go MCP server with basic health endpoint
- [ ] Deploy Go server, verify /mcp/health responds

**Deliverable:** All services running behind single domain with Caddy routing.

### Phase 2: Auth & Onboarding (Days 4-7)

- [ ] Laravel registration + login (Blade + Livewire)
- [ ] Supabase auth sync service (create GoTrue user on Laravel register)
- [ ] GitHub OAuth provider
- [ ] Company onboarding flow (3-step Livewire wizard)
- [ ] MCP token generation + display
- [ ] "How to connect" page with copy-paste config
- [ ] Studio auth integration (admin JWT check)
- [ ] Studio branding overhaul (logo, colors, fonts from arts/)

**Deliverable:** User can register, create company, get token, see connection instructions.

### Phase 3: Go MCP Server Core (Days 8-14)

- [ ] MCP protocol handler (SSE transport)
- [ ] Token auth middleware (validate against Supabase)
- [ ] Agent tools (create, get, list, update)
- [ ] Task tools (full CRUD + assign, complete, block, get_next)
- [ ] Activity logging tools
- [ ] Memory tools (store with embeddings, semantic search)
- [ ] Project tools
- [ ] Skills tools
- [ ] Notes tools
- [ ] Workflow tools
- [ ] Decision logging tools
- [ ] Team status tools

**Deliverable:** Full MCP tool suite works from Claude Code.

### Phase 4: GitHub + Specs (Days 15-18)

- [ ] GitHub OAuth in Laravel
- [ ] GitHub API client in Go
- [ ] Spec tools with GitHub sync
- [ ] CLAUDE.md generation
- [ ] Repo file read/write tools
- [ ] Branch + PR creation tools

**Deliverable:** PM creates spec → appears in GitHub → developer's Claude sees it.

### Phase 5: Laravel Dashboard & Polish (Days 19-24)

- [ ] Dashboard with connection status + usage stats
- [ ] Token management page (Livewire)
- [ ] Team management + invite flow
- [ ] Landing page (SEO-optimized, AR/EN ready)
- [ ] Pricing page with Stripe checkout
- [ ] Documentation pages
- [ ] Billing management
- [ ] Studio custom pages (Dashboard, Organizations, Tokens, Activity)

**Deliverable:** Production-ready web presence + admin panel.

### Phase 6: Team Sync & Notifications (Days 25-30)

- [ ] Supabase Realtime subscriptions in Go MCP server
- [ ] Slack integration for notifications
- [ ] Rate limiting per plan tier
- [ ] Usage tracking + enforcement
- [ ] Edge Functions (Stripe webhook, session cleanup)
- [ ] Cron agent trigger system

**Deliverable:** Team of developers working simultaneously with realtime sync.

---

## 14. Revenue Model

| Plan | Price | Users | Projects | Agents | Tasks/mo | Memory |
|------|-------|-------|----------|--------|----------|--------|
| Free | $0 | 1 | 1 | 3 | 100 | 50MB |
| Pro | $29/mo | 5 | 10 | 20 | 2,000 | 500MB |
| Team | $99/mo | 25 | Unlimited | 100 | 10,000 | 5GB |
| Enterprise | Custom | Unlimited | Unlimited | Unlimited | Unlimited | Custom |

---

## 15. Security

- All traffic via HTTPS (Caddy auto-SSL)
- MCP tokens: SHA-256 hashed, prefix-indexed, revocable
- RLS enforces tenant isolation at database level
- Supabase service role key never exposed to clients
- GitHub tokens encrypted at rest
- Stripe webhook signature verification
- Rate limiting on MCP and auth endpoints
- CORS not needed (single domain)

---

## 16. Success Metrics

| Metric | 3-Month Target |
|--------|---------------|
| Registered users | 500+ |
| Active daily MCP connections | 100+ |
| Paying customers | 50+ |
| MRR | $2,000+ |
| Time to first connection | < 5 minutes |
| Uptime | 99.5%+ |

---

## 17. Future Roadmap (Post-Launch)

Do NOT build until Phase 1-6 complete and revenue flowing:

- Marketplace (agents, skills, workflows)
- Mobile push notifications (FCM)
- Self-hosted enterprise kit
- SSO/SAML
- Multi-region deployment
- Public REST API alongside MCP
- Webhook system for external integrations
- Plugin/extension system

---

**This document is the entire product. 6 phases. 30 days. Ship it.**
