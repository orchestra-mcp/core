# Request: MCP Context Command + Project Memory

**Date**: 2026-03-30 01:45
**Status**: Pending
**Priority**: Critical
**Context**: After building request tools, realized MCP should be the first source of truth for everything — not the codebase.

## What's Needed

### 1. `context_get` MCP Tool
Single tool that returns the full project context as markdown:
- User identity (from token)
- Active agents (count + roster)
- Recent decisions (last 10)
- Recent meetings (last 5 with summaries)
- Active tasks (in_progress + blocked)
- Pending requests
- Project progress stats

### 2. MCP-First Rule
When answering questions or making decisions:
- Check MCP first (decisions, meetings, memory) before searching codebase
- The MCP board IS the source of truth for project state
- Only search code when MCP doesn't have the answer

### 3. `/orch` Skill Auto-Context
When `/orch` is invoked:
- Calls `context_get` to load full project state
- Identifies user from MCP token
- Presents personalized welcome with actionable context
- Injects relevant decisions/meetings into the conversation

### 4. Init Memory Injection
When `init` runs on a workspace:
- Syncs agents from DB → `.claude/agents/` files
- Syncs skills from DB → `.claude/skills/` files
- Generates CLAUDE.md with live project context
- AGENTS.md with current agent roster from DB
