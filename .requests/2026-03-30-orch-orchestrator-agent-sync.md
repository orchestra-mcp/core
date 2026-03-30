# Request: Orch Orchestrator + Agent Sync + Inter-Agent Communication

**Date**: 2026-03-30 01:30
**Status**: Pending
**Priority**: Critical
**Context**: After completing 12 specs + 4 enhancement specs, the MCP tools work but aren't properly integrated with Claude Code's native agent/skill system.

## Problems Identified

### 1. Agent Sync Gap
- MCP agents live in database (38 agents)
- Claude Code agents live in `.claude/agents/*.md` files
- `init` generates static copies but they go stale
- Need: real-time sync between DB agents and Claude Code agent files

### 2. No Orchestrator
- No `/orch` skill that acts as the master entry point
- User should type `/orch` and get a personalized welcome (knows who they are via MCP token)
- Orchestrator should list all available tools, agents, skills
- Should be the conductor that delegates to specialized agents

### 3. Agent-to-Agent Communication
- Currently agents can't talk to each other
- Need: message bus where agents post/read messages
- meeting_message and task_comment can serve as channels
- Agent A should be able to @mention Agent B and get a response

### 4. Skills Not Bridged
- `.claude/skills/orch:*/` exist as static markdown
- They don't actually invoke MCP tools
- Need: skills that are live bridges to MCP tool calls

## Proposed Solution

### `/orch` Master Skill
- Reads MCP token → identifies user → personalized welcome
- Lists: agents (from DB), skills (from DB), tools (from MCP), projects, active meetings
- Commands: `/orch meeting`, `/orch status`, `/orch task`, `/orch agent {name}`
- Drives the orchestration layer

### Agent Sync Service
- On `init` or on Desktop workspace open: sync DB agents → `.claude/agents/` files
- On agent create/update via MCP: auto-regenerate the agent file
- Agent files include system prompt + tools they can use + delegation patterns

### Inter-Agent Protocol
- Agents communicate via `meeting_message` (during meetings) or `task_comment` (during task work)
- An agent can "call" another by creating a task assigned to them
- Meeting mode enables round-robin agent responses

## Notes
- This is the missing glue between MCP tools and Claude Code's native capabilities
- Without this, MCP is just an API — with it, it becomes a true operating system
