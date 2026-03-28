---
name: orch-setup
description: Bootstrap local development environment for Orchestra MCP. Use when setting up the project for the first time, starting Docker services, or troubleshooting local dev issues.
---

# Orchestra MCP — Local Dev Setup

## Prerequisites

- Node.js 24 LTS
- pnpm 10.24.0 (`corepack enable && corepack prepare pnpm@10.24.0`)
- Docker Desktop with at least 8GB RAM allocated
- Go 1.26 (for MCP server development)
- PHP 8.5 + Composer (for Laravel development)

## Quick Start

```bash
# 1. Install monorepo dependencies
pnpm install

# 2. Start Supabase backend services
cd docker
cp .env.example .env  # if not done
docker compose up -d

# 3. Generate Studio .env from running services
cd ..
pnpm setup:cli

# 4. Start Studio dev server (port 8082)
pnpm dev:studio
```

## Service Ports

| Service | Port | URL |
|---------|------|-----|
| Studio | 8082 | http://localhost:8082 |
| Kong (API Gateway) | 54321 | http://localhost:54321 |
| Kong HTTPS | 54322 | https://localhost:54322 |
| Studio (Docker) | 54323 | http://localhost:54323 |
| PostgreSQL | 5432 | postgresql://postgres:password@localhost:5432/postgres |
| GoTrue (Auth) | 9999 | (internal) |
| PostgREST | 3000 | (internal) |

## Troubleshooting

### Docker "no space left on device"
```bash
docker system prune -a --volumes -f
```

### Reset everything
```bash
cd docker && ./reset.sh
```

### Check service health
```bash
docker compose ps
docker compose logs <service-name>
```

### Studio not connecting to Supabase
Regenerate env: `pnpm setup:cli`
