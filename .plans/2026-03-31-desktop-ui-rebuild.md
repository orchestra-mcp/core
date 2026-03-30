# Plan: Desktop App UI Rebuild

**Date**: 2026-03-31
**Status**: Approved

## Objective

Rebuild the Orchestra Desktop frontend to match Studio's design system. Reuse existing components, replace Tauri's HTML file menu with macOS native menu, enhance Workspace Manager, and add AI-powered Spotlight via Claude Bridge.

## Current State

The desktop app already has most features built:
- React 19 + Tailwind 4.2 + Vite 6 (same stack as Studio)
- Auth (Supabase), Dashboard, MarkdownEditor, Settings, SmartActions, CommandPalette
- Tray menu + global shortcuts (Cmd+Shift+N/O/D)
- 43 TypeScript files, 42KB App.tsx

**What needs to change:**
- Replace HTML file menu with macOS native menu bar
- Polish UI to match Studio's design language
- Use Studio's icon system (same icons as Orchestra dashboard)
- Simplify navigation to 3 pages: Dashboard, Workspace, Settings
- Upgrade Spotlight (CommandPalette) to use Claude Bridge for dynamic AI actions
- Add status bar with MCP connection status

## Features

### Feature 1: OS Native Menu Bar

**Small Win**: File menu disappears from the app window, macOS menu bar shows Orchestra menus
**DOD**:
- [ ] Tests pass
- [ ] Documentation written
- [ ] Code reviewed

#### Tasks
- [ ] Remove HTML file menu from App.tsx header
- [ ] Build macOS native menu in lib.rs using `tauri::menu::Menu`
- [ ] Menu items: Orchestra (About, Preferences, Quit), File (Open Workspace, Open File, Recent), Edit (Undo, Redo, Cut, Copy, Paste), View (Dashboard, Workspace, Settings, Toggle Sidebar), Window (Minimize, Zoom, Spotlight)
- [ ] Wire menu events to frontend via IPC (emit events)
- [ ] Handle menu events in App.tsx

### Feature 2: Studio Design System Alignment

**Small Win**: Desktop app visually matches Studio — same sidebar, colors, icons
**DOD**:
- [ ] Tests pass
- [ ] Documentation written
- [ ] Code reviewed

#### Tasks
- [ ] Import Studio's icon set (from apps/studio or packages/ui) — use same icons as Orchestra Studio dashboard
- [ ] Update color tokens in index.css to match Studio's purple palette (#7c3aed primary)
- [ ] Rebuild sidebar to match Studio's collapsed icon sidebar style
- [ ] Sidebar items: Dashboard, Workspace, Agents, Twin Monitor, Media Library, Marketplace
- [ ] Settings stays in user menu (top-right avatar dropdown) — NOT in sidebar
- [ ] Icons: same as Orchestra Studio dashboard icons
- [ ] Remove unused tabs (docs, mcp connector, explorer — consolidated into Dashboard/Workspace)
- [ ] Add status bar at bottom: MCP connection dot + agent count + workspace name

### Feature 3: Workspace Manager Enhancement

**Small Win**: File tree on left, markdown preview on right, edit via context menu
**DOD**:
- [ ] Tests pass
- [ ] Documentation written
- [ ] Code reviewed

#### Tasks
- [ ] Build `WorkspaceTree` component — recursive file tree using `workspace_list_files` IPC
- [ ] File tree shows: folders collapsible, files with type icons, .md files highlighted
- [ ] Click file → shows markdown preview in right panel (read-only, rendered)
- [ ] Right-click file → context menu: Edit, Rename, Delete, Copy Path
- [ ] Edit → opens Monaco editor (existing MarkdownEditor component)
- [ ] Save → calls `workspace_write_file` IPC
- [ ] Breadcrumb path at top of preview panel

### Feature 4: AI Spotlight via Claude Bridge

**Small Win**: Press ⌘K, type any command, Claude executes it via MCP tools
**DOD**:
- [ ] Tests pass
- [ ] Documentation written
- [ ] Code reviewed

#### Tasks
- [ ] Refactor existing CommandPalette to support AI mode
- [ ] AI mode: user types free text → sends to Rust backend via IPC
- [ ] Rust backend: spawns `claude --print - --output-format stream-json --dangerously-skip-permissions`
- [ ] Stream results back to frontend via Tauri events
- [ ] Display results in spotlight overlay (markdown rendered)
- [ ] Show tool usage indicators (loading spinner per tool call)
- [ ] Quick actions still work (navigation, file open) alongside AI mode
- [ ] Global shortcut ⌘K registered via `tauri::global_shortcut`

### Feature 5: Settings & Tray Polish

**Small Win**: Settings page shows MCP status, tray shows connection dot
**DOD**:
- [ ] Tests pass
- [ ] Documentation written
- [ ] Code reviewed

#### Tasks
- [ ] Settings page sections: Account, MCP Servers, Twin Bridge, Integrations, About
- [ ] MCP Servers section: list connected servers with status dots (green/red)
- [ ] Twin Bridge section: extension connection status, registered accounts
- [ ] Tray icon: green dot overlay when MCP connected, red when disconnected
- [ ] Tray menu: Show/Hide Orchestra, Dashboard, Workspace, Settings, separator, MCP Status, separator, Quit

### Feature 6: Media Library

**Small Win**: Screenshots and exported files appear in a gallery, shareable and cloud-synced
**DOD**:
- [ ] Tests pass
- [ ] Documentation written
- [ ] Code reviewed

#### Tasks
- [ ] Create `MediaLibrary` component — grid/list view of all media files
- [ ] Auto-capture: screen_capture screenshots saved to `~/.orchestra/media/`
- [ ] Export integration: exported files (PDF, DOCX, XLSX, PNG, SVG) saved to media library
- [ ] File types: images (PNG, JPG, SVG), documents (PDF, DOCX, XLSX, CSV, PPTX), diagrams (Mermaid SVG)
- [ ] Preview: click to preview image/document in a modal
- [ ] Context menu: Share (copy link), Export (save as), Delete, Open in Finder
- [ ] Cloud sync: upload media to Orchestra Cloud via API (background sync)
- [ ] Sync status indicator per file (synced/syncing/local-only)
- [ ] Sidebar icon: Image/Gallery icon for Media tab

### Feature 7: Agents Tab

**Small Win**: See all agents with profiles, status, and running tasks — same as Studio agents page
**DOD**:
- [ ] Tests pass
- [ ] Documentation written
- [ ] Code reviewed

#### Tasks
- [ ] Reuse design from Studio's `/project/default/orchestra/agents` page
- [ ] Agent card grid: avatar, name, role, provider, model, status (idle/running/error)
- [ ] Click agent → detail panel: full profile, current task, history, logs
- [ ] Running tasks section: shows active tasks per agent with progress
- [ ] Actions: Start agent, Stop agent, Assign task, View logs
- [ ] Real-time status updates via MCP (`agent_list`, `agent_status`, `team_status`)
- [ ] Use same icons and card layout as Studio Orchestra agents page
- [ ] Sidebar icon: Users/Bot icon for Agents tab

### Feature 8: Digital Twin Live Monitor

**Small Win**: Live log of tool calls, monitor status, running agents — one screen to track everything
**DOD**:
- [ ] Tests pass
- [ ] Documentation written
- [ ] Code reviewed

#### Tasks
- [ ] Create `TwinMonitor` component — split layout: live log (left) + status panel (right)
- [ ] Live log: real-time feed of all twin events (TWIN_EVENT, tool calls, agent spawns)
- [ ] Log entries: timestamp, source (whatsapp/slack/gmail), event type, data preview
- [ ] Color-coded: green=success, yellow=running, red=error, blue=info
- [ ] Status panel: active watchers list with start/stop controls per watcher
- [ ] Running agents: PID, slug, status, duration, kill button
- [ ] Monitor scripts: last run time, next run, success/fail indicator
- [ ] Dispatch status: events received, agents spawned, completed, failed
- [ ] Auto-scroll live log with pause button
- [ ] Filter log by source (whatsapp, slack, gmail, system)
- [ ] Sidebar icon: Activity/Monitor icon for Twin tab

### Feature 9: Marketplace & Plugin Manager

**Small Win**: Browse, install, and manage skills/agents/plugins from the desktop — edit plugin scripts like Supabase Edge Functions
**DOD**:
- [ ] Tests pass
- [ ] Documentation written
- [ ] Code reviewed

#### Tasks
- [ ] Create `Marketplace` component — tabbed layout: Skills, Agents, Companies, Plugins (Chrome)
- [ ] Skills tab: browse/search skills from cloud MCP (`marketplace_list`, `marketplace_search`)
- [ ] Agents tab: browse community agents, install to local catalogue
- [ ] Companies tab: browse company profiles with their published packs
- [ ] Plugins tab: Chrome extension scripts (dynamic scripts from `script_load`/`script_unload`)
- [ ] Install flow: click Install → `marketplace_install` → shows in installed list
- [ ] Uninstall flow: click Uninstall → `marketplace_uninstall`
- [ ] Update checker: badge on Marketplace icon when updates available (`marketplace_check_updates`)
- [ ] Featured & trending sections on marketplace home (`marketplace_featured`, `marketplace_trending`)
- [ ] Reviews: show ratings, leave reviews (`marketplace_reviews`, `marketplace_review`)

#### Plugin Script Editor (Supabase Edge Function style)
- [ ] Create `PluginEditor` component — Monaco editor for plugin scripts
- [ ] List installed plugins with status (active/inactive) toggle
- [ ] Click plugin → opens script in Monaco editor (full code view)
- [ ] Edit script → Save → hot-reload via `script_load` IPC
- [ ] New plugin: scaffold from template, edit, test, publish
- [ ] Plugin logs: show console output from last execution
- [ ] Deploy to cloud: `marketplace_publish` from the editor
- [ ] Diff view: compare local changes vs published version
- [ ] Sidebar icon: Store/Package icon for Marketplace tab

## Technical Notes

**Architecture:**
- Frontend stays in `desktop/src/` as standalone React app (Vite)
- Studio components referenced via icon imports (copy needed icons, don't create monorepo dependency yet)
- Tauri 2.x menu API for native menu
- Existing IPC commands (`workspace_list_files`, `workspace_read_file`, `workspace_write_file`) already handle file operations
- Claude Bridge for Spotlight uses existing `agent_spawn` module with `--print -` pattern

**Dependencies:** No new npm packages needed. All exists: React, Tailwind, Monaco, react-markdown, Tauri plugins.

**Risk:** App.tsx is 42KB monolith — needs refactoring into smaller components during this work.
