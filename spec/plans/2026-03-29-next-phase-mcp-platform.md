# Plan: Orchestra MCP Platform — Next Phase

**Date**: 2026-03-29
**Status**: Approved

## Objective

Complete the Orchestra MCP platform with task comments, meetings system, working init, Desktop MCP server with tunnel, Studio admin panel with feature flags, Laravel public pages, and shared markdown component. Remove Chrome/CDP tools (replaced by Desktop OS interaction).

## Features

### Spec 1: Task Comments System
**Small Win**: Add a comment to a task via MCP, see it in task detail
**Lead**: Mostafa (Go) | Support: Karim (Rust/Desktop)
**DOD**:
- [x] DB migration: task_comments table
- [x] MCP tools: task_comment_add, task_comment_list
- [ ] Desktop: comment timeline in task detail view
- [ ] Tests pass

### Spec 2: Meetings System + Decision Linking
**Small Win**: Create a meeting via MCP, enter meeting mode, log a decision linked to it
**Lead**: Mostafa (Go) | Support: Khaled (Supabase)
**DOD**:
- [ ] DB migration: meetings + meeting_agents + meeting_id on decisions
- [ ] MCP tools: meeting_create, meeting_get, meeting_list, meeting_update, meeting_end
- [ ] Session mode: meeting mode with team chat feel
- [ ] Decisions auto-link to active meeting
- [ ] Tests pass

### Spec 3: Init MCP — Full Working Setup
**Small Win**: Run init, get .mcp.json that connects Claude Code to Orchestra MCP
**Lead**: Mostafa (Go) | Support: Seif (Desktop)
**DOD**:
- [ ] Generate .mcp.json with server URL + auth token
- [ ] CLAUDE.md lists all tools by category
- [ ] AGENTS.md with delegation patterns
- [ ] Desktop auto-install offered
- [ ] Workspace auto-config on open
- [ ] Tests pass

### Spec 4: Remove Chrome/CDP
**Small Win**: Go server builds without chromedp, 6 browser tools gone
**Lead**: Mostafa (Go)
**DOD**:
- [ ] Delete browser.go, browser_test.go, cmd/browser/main.go
- [ ] Modify main.go, init.go, hook template
- [ ] go mod tidy removes chromedp
- [ ] All tests pass

### Spec 5: Desktop Local MCP Server (Rust)
**Small Win**: Desktop app starts, Claude Code connects to local MCP, calls vision tool
**Lead**: Karim (Rust) | Support: Seif (Desktop)
**DOD**:
- [ ] Rust MCP server (stdio transport) starts with app
- [ ] Tools: vision control, workspace management
- [ ] Auto-generates .mcp.json entry
- [ ] MCP 2025-11-25 compliant
- [ ] Tests pass

### Spec 6: Cloud-Desktop Tunnel
**Small Win**: Desktop connects to cloud, cloud calls desktop vision tool remotely
**Lead**: Karim (Rust) | Support: Mostafa (Go/cloud)
**DOD**:
- [ ] Reverse WebSocket tunnel (reuse plugin-tunnel pattern)
- [ ] Auto-register with JWT
- [ ] Reconnection with exponential backoff
- [ ] Remote actions: run_tool, file_read, vision capture
- [ ] Tests pass

### Spec 7: Desktop UI Overhaul
**Small Win**: Open Desktop, see dashboard + file explorer with workspace
**Lead**: Yassin (Frontend) | Support: Seif (OS integration)
**DOD**:
- [ ] Dashboard (Supabase component view clone)
- [ ] Explorer (markdown file browser + viewer/editor)
- [ ] Workspace management (OS File menu, open/switch/recent)
- [ ] Welcome screen (no workspace)
- [ ] Supabase connected (auth, realtime)
- [ ] Auto-init on workspace open

### Spec 8: Studio Admin Panel + Feature Flags
**Small Win**: Studio shows Orchestra admin pages with feature flag toggles
**Lead**: Yassin (Frontend) | Support: Khaled (Supabase)
**DOD**:
- [ ] Admin panel for Orchestra MCP management
- [ ] Feature flags (IS_PLATFORM + ConfigCat + localStorage previews)
- [ ] Scope across clients (desktop/studio/laravel)
- [ ] Platform settings with scope column
- [ ] Settings UI in Supabase Settings

### Spec 9: Studio Logs Refactor
**Small Win**: Each log type on its own page, matching LogFlare style
**Lead**: Yassin (Frontend)
**DOD**:
- [ ] Per-page routes: /logs/go-mcp, /logs/laravel, /logs/orchestra-activity
- [ ] Sidebar entries in LogsSidebarMenuV2
- [ ] Reuse LogsPreviewer with custom queryType
- [ ] Type-specific filters

### Spec 10: Laravel Public Pages
**Small Win**: Public profile page at /@username matching Next.js design
**Lead**: Omar (Laravel)
**DOD**:
- [ ] Dark theme matching Next.js (#0f0f12, cyan/purple gradient)
- [ ] Sidebar layout (240px/56px collapsed)
- [ ] Public profiles (/@username) with Livewire SPA
- [ ] Private pages with Inertia + React
- [ ] Profile schema (username, handle, bio, avatar, badges, is_public)

### Spec 11: Shared Markdown Component
**Small Win**: Same markdown renders identically on Desktop, Studio, and Laravel
**Lead**: Yassin (Frontend)
**DOD**:
- [ ] @orchestra-mcp/markdown package extracted from Desktop
- [ ] Viewer + Editor modes, GFM, Mermaid, code highlighting
- [ ] Integrated in Desktop, Studio, Laravel

### Spec 12: Docs System
**Small Win**: Browse and read docs using shared markdown in Desktop Explorer
**Lead**: Yassin (Frontend) | Support: Omar (Laravel)
**DOD**:
- [ ] Desktop Explorer docs browser
- [ ] Studio docs viewer
- [ ] Laravel public docs pages

## Technical Notes

- Tunnel reuses proven plugin-tunnel WebSocket reverse tunnel architecture
- Feature flags follow Supabase's 3-layer pattern (env + remote + localStorage)
- Meeting mode changes session state, agents respond in character
- Decisions auto-link to active meeting via meeting_id FK
- Desktop MCP lifecycle tied to app (not daemon)
- Shared markdown is the standard format across all clients
