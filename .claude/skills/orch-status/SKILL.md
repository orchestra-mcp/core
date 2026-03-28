---
name: orch-status
description: Check status of all Orchestra MCP services and implementation progress. Use when verifying services are running, checking plan completion, or reporting project status.
---

# Orchestra MCP — Status Check

## Service Health Checks

### Docker services
```bash
cd docker && docker compose ps
```

### PostgreSQL
```bash
PGPASSWORD=$(grep POSTGRES_PASSWORD docker/.env | cut -d= -f2) pg_isready -h 127.0.0.1 -p 5432
```

### Supabase API (Kong)
```bash
curl -s http://localhost:54321/rest/v1/ -H "apikey: $(grep ANON_KEY docker/.env | cut -d= -f2)" | head -20
```

### Studio
```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:8082
```

### Go MCP Server
```bash
curl -s http://localhost:3001/mcp/health
```

### Laravel
```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:8000
```

## Implementation Progress

Check plan files in `spec/plans/`:

```bash
# Count completed vs total tasks across all plans
for plan in spec/plans/0[1-6]*.md; do
  total=$(grep -c '^\- \[' "$plan" 2>/dev/null || echo 0)
  done=$(grep -c '^\- \[x\]' "$plan" 2>/dev/null || echo 0)
  echo "$(basename $plan): $done/$total"
done
```

## Plan Phases

| Phase | Plan File | Status |
|-------|-----------|--------|
| 1. Infrastructure | `spec/plans/01-infrastructure.md` | Check file |
| 2. Auth & Onboarding | `spec/plans/02-auth-onboarding.md` | Check file |
| 3. Go MCP Server | `spec/plans/03-go-mcp-server.md` | Check file |
| 4. GitHub & Specs | `spec/plans/04-github-specs.md` | Check file |
| 5. Dashboard & Polish | `spec/plans/05-dashboard-polish.md` | Check file |
| 6. Team Sync | `spec/plans/06-team-sync-notifications.md` | Check file |

## Cross-Reference Sources

Per Rule 11 (Client-First), always verify status from THREE sources:
1. Plan files (`spec/plans/*.md`) — checked/unchecked tasks
2. Codebase — actual files and directories that exist
3. Git history — `git log --oneline -20`

If sources disagree, flag the discrepancy.
