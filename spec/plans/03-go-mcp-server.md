# Plan 03: Go MCP Server Core (Phase 3)

**Duration:** Days 8-14
**Depends on:** Plan 01 (Infrastructure), Plan 02 (Auth — for token validation)
**Goal:** Full MCP tool suite works from Claude Code

---

## Tasks

### 3.1 MCP Protocol Handler
- [ ] Implement MCP SSE transport at `/mcp` (Server-Sent Events)
- [ ] Implement MCP WebSocket transport at `/mcp/ws`
- [ ] Handle `initialize`, `tools/list`, `tools/call` messages
- [ ] Handle `ping/pong` for keep-alive
- [ ] Proper error response formatting per MCP spec
- [ ] Request/response JSON-RPC 2.0 compliance
- [ ] Graceful connection handling (timeouts, reconnects)

### 3.2 Token Auth Middleware
- [ ] Extract token from MCP `initialize` params or HTTP header
- [ ] Hash token with SHA-256
- [ ] Call `validate_mcp_token(hash)` DB function
- [ ] Return user context (user_id, org_id, scopes, plan, limits)
- [ ] Reject expired/revoked tokens
- [ ] Update `last_used_at` and `usage_count`
- [ ] Inject user context into request handler

### 3.3 Supabase DB Client
- [ ] Create `db/supabase.go` — REST client for Supabase PostgREST
- [ ] Direct PostgreSQL connection for complex queries
- [ ] Service role key authentication for admin operations
- [ ] Connection pooling
- [ ] Error mapping (Supabase errors -> MCP errors)

### 3.4 Embedding Client
- [ ] Create `embedding/embed.go` — vector embedding generator
- [ ] Support OpenAI `text-embedding-3-small` (1536 dimensions)
- [ ] Configurable provider (ENV: `EMBEDDING_PROVIDER`, `EMBEDDING_API_KEY`, `EMBEDDING_MODEL`)
- [ ] Batch embedding support
- [ ] Rate limiting / retry logic

### 3.5 Agent Tools
- [ ] `agent_create` — create new agent with name, role, persona, system_prompt
- [ ] `agent_get` — get agent by ID or slug
- [ ] `agent_list` — list agents (filtered by team, status)
- [ ] `agent_update` — update agent fields
- [ ] `agent_delete` — soft-delete (archive) agent

### 3.6 Task Tools
- [ ] `task_create` — create task with title, description, type, priority, assignment
- [ ] `task_get` — get task by ID with dependencies
- [ ] `task_list` — list tasks (filtered by project, status, assignee, priority)
- [ ] `task_update` — update task fields
- [ ] `task_assign` — assign to agent or user
- [ ] `task_complete` — mark as done (sets completed_at)
- [ ] `task_block` — mark as blocked with reason
- [ ] `task_get_next` — call `get_next_task()` DB function (unblocked, priority-ordered)
- [ ] `task_add_dependency` — create task dependency

### 3.7 Memory Tools
- [ ] `memory_store` — store memory with content, source, tags; generate embedding
- [ ] `memory_search` — semantic search via `search_memory()` DB function
- [ ] `memory_list` — list recent memories (filtered by agent, project, source)
- [ ] `memory_delete` — delete memory by ID

### 3.8 Activity Tools
- [ ] `activity_log` — log activity with action, summary, details
- [ ] `activity_list` — list recent activity (filtered by project, user, agent)
- [ ] `team_status` — call `get_team_activity()` for team overview

### 3.9 Project Tools
- [ ] `project_create` — create project with name, repo_url
- [ ] `project_get` — get project by ID or slug
- [ ] `project_list` — list projects
- [ ] `project_progress` — call `get_project_progress()` for stats

### 3.10 Skills Tools
- [ ] `skill_create` — create skill with name, description, content (prompt)
- [ ] `skill_get` — get skill by ID or slug
- [ ] `skill_list` — list skills (org + public)
- [ ] `skill_assign` — assign skill to agent

### 3.11 Notes Tools
- [ ] `note_create` — create note with title, body, tags
- [ ] `note_get` — get note by ID
- [ ] `note_list` — list notes (filtered by project, tags)
- [ ] `note_update` — update note
- [ ] `note_delete` — soft-delete

### 3.12 Workflow Tools
- [ ] `workflow_create` — create custom workflow with states and transitions
- [ ] `workflow_list` — list workflows
- [ ] `workflow_get` — get workflow details

### 3.13 Decision Tools
- [ ] `decision_log` — log decision with context, alternatives, outcome; generate embedding
- [ ] `decision_search` — semantic search via `search_decisions()` DB function
- [ ] `decision_list` — list recent decisions

### 3.14 Session Management
- [ ] `session_start` — create agent session (machine_id, current project/task)
- [ ] `session_heartbeat` — update last_heartbeat timestamp
- [ ] `session_end` — close session
- [ ] `session_list` — list active sessions for org

### 3.15 Specs Tools
- [ ] `spec_create` — create spec with title, content, version
- [ ] `spec_get` — get spec by ID or slug
- [ ] `spec_list` — list specs (filtered by project, status)
- [ ] `spec_update` — update spec (increment version)

---

## Acceptance Criteria
- Connect Claude Code to MCP server with `orch_` token
- All ~40 tools appear in `tools/list`
- Create agent, create project, create task, complete task — full lifecycle
- Store memory, search memory — semantic search returns relevant results
- Log activity, view team status
- Sessions track active connections
