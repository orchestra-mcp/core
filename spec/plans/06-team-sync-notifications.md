# Plan 06: Team Sync & Notifications (Phase 6)

**Duration:** Days 25-30
**Depends on:** All previous phases
**Goal:** Team of developers working simultaneously with realtime sync

---

## Tasks

### 6.1 Supabase Realtime in Go MCP Server
- [ ] Create `realtime/hub.go` — Realtime subscription hub
- [ ] Subscribe to `tasks` table changes (INSERT, UPDATE, DELETE)
- [ ] Subscribe to `activity_log` changes
- [ ] Subscribe to `agent_sessions` changes
- [ ] Forward relevant changes to connected MCP clients
- [ ] Filter by organization_id (tenant isolation)
- [ ] Reconnection logic for dropped connections

### 6.2 Slack Integration
- [ ] Configure `SLACK_BOT_TOKEN` in env
- [ ] Notification events:
  - Task assigned to user → Slack DM
  - Task completed → team channel
  - Agent blocked → team channel with context
  - New team member joined → team channel
  - Sprint started/ended → team channel
- [ ] MCP tool: `slack_notify` — send custom notification
- [ ] Configurable per-org notification preferences

### 6.3 Rate Limiting
- [ ] Rate limit per plan tier:
  - Free: 10 requests/minute
  - Pro: 60 requests/minute
  - Team: 200 requests/minute
  - Enterprise: custom
- [ ] Implement in Go middleware (token bucket or sliding window)
- [ ] Return `429 Too Many Requests` with retry-after header
- [ ] Track usage in Redis for fast lookups
- [ ] Monthly task count enforcement per plan

### 6.4 Usage Tracking & Enforcement
- [ ] Track per-org usage:
  - Tasks created this month
  - Memory storage (bytes)
  - Active agents count
  - Active tokens count
  - API requests count
- [ ] Enforce limits from `organizations.limits` JSONB
- [ ] Soft limit warnings at 80% usage
- [ ] Hard limit enforcement at 100%
- [ ] Usage reset on billing cycle (monthly)

### 6.5 Edge Functions
- [ ] **Stripe Webhook Handler** (`supabase/functions/stripe-webhook/`):
  - `checkout.session.completed` → create/upgrade org plan
  - `customer.subscription.updated` → update plan + limits
  - `customer.subscription.deleted` → downgrade to free
  - `invoice.payment_failed` → notify org owner
- [ ] **Session Cleanup Cron** (`supabase/functions/cron-session-cleanup/`):
  - Runs every 5 minutes
  - Calls `cleanup_stale_sessions()` DB function
  - Marks sessions with stale heartbeat (>10 min) as offline
- [ ] **Agent Trigger Cron** (`supabase/functions/cron-agent-trigger/`):
  - Runs on configurable schedule per org
  - Checks for scheduled agent tasks
  - Hits Go MCP server to trigger execution
  - Logs trigger event

### 6.6 Security Hardening
- [ ] HTTPS everywhere (Caddy auto-SSL)
- [ ] MCP token SHA-256 hashing verified
- [ ] RLS policies tested for tenant isolation
- [ ] Supabase service role key not exposed to clients
- [ ] GitHub tokens encrypted at rest (AES-256)
- [ ] Stripe webhook signature verification
- [ ] CORS not needed (single domain) — verify no CORS headers
- [ ] Rate limiting on auth endpoints (brute force protection)
- [ ] Input validation on all MCP tools

### 6.7 Monitoring & Health
- [ ] `/mcp/health` returns service status + DB connection + Redis connection
- [ ] Supabase health check endpoint
- [ ] Laravel health check endpoint
- [ ] Log aggregation (structured JSON logs)
- [ ] Error tracking setup
- [ ] Uptime monitoring alerts

---

## Acceptance Criteria
- Two Claude Code instances connected simultaneously, see each other's activity in real-time
- Slack notifications fire on task events
- Rate limiting enforced per plan (test with Free tier limits)
- Usage tracking accurate, hard limits enforced
- Stripe webhooks process plan changes correctly
- Stale sessions cleaned up automatically
- All security measures in place and tested
- System health endpoint returns comprehensive status
