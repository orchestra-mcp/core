# Plan 04: GitHub Integration & Specs (Phase 4)

**Duration:** Days 15-18
**Depends on:** Plan 03 (Go MCP Server Core)
**Goal:** PM creates spec -> appears in GitHub -> developer's Claude sees it

---

## Tasks

### 4.1 GitHub OAuth in Laravel
- [ ] GitHub OAuth connection page in dashboard (`/dashboard/settings`)
- [ ] Store encrypted access token in `github_connections` table
- [ ] GitHub scopes: `repo`, `read:user`, `read:org`
- [ ] Token refresh flow
- [ ] Disconnect GitHub button

### 4.2 GitHub API Client in Go
- [ ] Create `github/client.go` — GitHub REST API v3 client
- [ ] Auth: use user's encrypted access token (decrypt from DB)
- [ ] Repository listing
- [ ] File read/write (get contents, create/update file)
- [ ] Branch management (create, list, delete)
- [ ] Pull request creation
- [ ] Commit creation
- [ ] Rate limit handling

### 4.3 Project Repo Link
- [ ] MCP tool: `project_link_repo` — link GitHub repo to project
- [ ] Store in `project_repos` table
- [ ] Set up webhook for push events (via Laravel webhook endpoint)
- [ ] Auto-sync settings: `sync_specs`, `sync_claude_md`

### 4.4 Spec Tools with GitHub Sync
- [ ] Enhanced `spec_create` — optionally push to GitHub as markdown file
- [ ] Enhanced `spec_update` — commit new version to GitHub
- [ ] `spec_sync_from_github` — pull spec content from repo file
- [ ] Auto-generate embedding on spec create/update
- [ ] Version tracking (increment on each update)

### 4.5 CLAUDE.md Generation
- [ ] MCP tool: `generate_claude_md` — generate CLAUDE.md from project context
- [ ] Include: project description, active agents, current sprint tasks, key decisions
- [ ] Push generated CLAUDE.md to repo root
- [ ] Update on significant project changes (new spec, sprint start, etc.)

### 4.6 Repo File Tools
- [ ] `repo_read_file` — read file from GitHub repo
- [ ] `repo_write_file` — write/update file in repo
- [ ] `repo_list_files` — list files in directory
- [ ] `repo_create_branch` — create feature branch
- [ ] `repo_create_pr` — create pull request with title, body, branch

### 4.7 Webhook Handler
- [ ] Laravel webhook endpoint: `/webhooks/github`
- [ ] Verify webhook signature with `webhook_secret`
- [ ] Handle `push` event: sync changed spec files back to DB
- [ ] Handle `pull_request` event: log activity
- [ ] Handle `issues` event: optional task sync

---

## Acceptance Criteria
- User connects GitHub from Laravel dashboard
- PM creates spec via MCP tool -> file appears in GitHub repo
- Developer's Claude can read specs from project
- CLAUDE.md auto-generated with project context
- Branch creation and PR tools work end-to-end
- Webhook syncs GitHub changes back to DB
