# Request: Digital Twin Agent + Local RAG + Apple Intelligence

**Date**: 2026-03-30 03:00
**Status**: Pending
**Priority**: Critical

## 1. Apple Intelligence as Provider (macOS only)
- Desktop app connects to Apple Intelligence APIs
- Free provider for small tasks
- Use for: summaries, text processing, quick lookups
- macOS Foundation Models framework (on-device)
- Add as provider in agent_spawn: provider: "apple"

## 2. Digital Twin — Background Listener Agent
A persistent background agent that runs 24/7 on the desktop:
- Listens for new emails (Mail.app via AppleScript/EventKit)
- Listens for WhatsApp alerts (Accessibility API or notifications)
- Listens for Slack messages (Slack API or notification listener)
- Saves all incoming messages to local DB
- Can share/post to social platforms via APIs or MCP tools
- Runs on Apple Intelligence or Ollama (free, local)
- Posts summaries to cloud MCP as activity_log
- The user's digital twin — always watching, filtering, alerting

## 3. Local RAG System (Desktop, SQLite)
- Cloud MCP should NOT store all RAG data (too expensive, too much data)
- Local RAG on Desktop app using SQLite + vector embeddings
- Check: https://firecrawl.dev/blog/best-open-source-rag-frameworks
- Best options to evaluate:
  - LanceDB (Rust-native, embedded, vector DB)
  - Chroma (Python, but has REST API)
  - Qdrant (Rust, can run embedded)
  - SQLite + sqlite-vec extension (simplest, single file)
- Store: documents, conversations, code context, meeting transcripts
- Query: semantic search across all local data
- Feed context to agents before they work

## Architecture Vision
```
Desktop App (always running)
├── Digital Twin Agent (background)
│   ├── Listens: Mail, WhatsApp, Slack, Calendar
│   ├── Provider: Apple Intelligence / Ollama (free)
│   └── Posts alerts to cloud MCP
├── Local RAG (SQLite + vectors)
│   ├── Indexes: docs, conversations, code, meetings
│   ├── Semantic search for agent context
│   └── Feeds context to agent_spawn
└── MCP Server (HTTP, port 9998)
    ├── Vision tools (xcap, enigo)
    ├── Agent spawn (multi-provider)
    └── RAG query tools
```
