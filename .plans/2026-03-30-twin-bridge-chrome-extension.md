# Plan: Orchestra Twin Bridge — Chrome Extension

**Date**: 2026-03-30
**Status**: Approved
**Spec**: twin-bridge-chrome-extension (90a89b2c-0264-4417-86b7-0aa81eddf80d)
**Meeting**: e60c4fcf-8ad0-4eff-ae1f-da977b489bbb
**Decision**: f24d6339-fb4f-4230-a8e7-4b724ac2e2b2

## Objective

Build a Manifest V3 Chrome extension ("Orchestra Twin Bridge") that monitors 15 services via DOM reading and pushes structured JSON to Orchestra Desktop via WebSocket. Zero APIs, zero cost, real-time. Integrates with the digital twin to organize the user's day, triage alerts by priority, and provide meeting intelligence with AR/EN support.

## Features

### Feature 1: Extension Core — Manifest, Service Worker, Offscreen WS
**Task**: 395e64bc-2345-48a9-af49-f5ad1ac0bc07
**Agent**: Yassin Tamer Farouk (frontend-developer)
**Priority**: Critical | **Estimate**: M | **Phase**: 1

**Small Win**: Extension loads in Chrome, connects to Desktop WS, popup shows "Connected".

**DOD**:
- [ ] manifest.json with MV3, optional_host_permissions
- [ ] service-worker.js message router
- [ ] offscreen.js persistent WS with reconnect + offline queue
- [ ] TwinMonitor base class (observer.js)
- [ ] messenger.js helper
- [ ] popup.html/js status UI
- [ ] Token pairing flow
- [ ] Tests pass
- [ ] Documentation written

### Feature 2: Desktop WS Server — /twin endpoint + AlertStore
**Task**: a39ad872-4785-42ac-b7b0-8cb0ce63a583
**Agent**: Mostafa Ali Hassan (go-developer)
**Priority**: Critical | **Estimate**: M | **Phase**: 1

**Small Win**: Desktop starts WS server, extension connects, test event appears in `twin_alerts()`.

**DOD**:
- [ ] WS server on localhost:9800/twin
- [ ] BridgeEvent + Alert structs
- [ ] AlertStore ring buffer (500 max)
- [ ] Token auth + discovery file (~/.orchestra/run/twin-bridge.json)
- [ ] GET /pair + GET /health endpoints
- [ ] Desktop notifications for high-priority events
- [ ] twin_alerts() integration with source filter
- [ ] Tests pass
- [ ] Documentation written

### Feature 3: Content Scripts — Messaging (Slack, Discord, WhatsApp, Telegram)
**Task**: 01969191-b6ab-45d8-97c7-bd97da724ea0
**Agent**: Yassin Tamer Farouk (frontend-developer)
**Priority**: High | **Estimate**: M | **Phase**: 2

**Small Win**: Open Slack in browser, extension detects unread count and pushes to Desktop.

**DOD**:
- [ ] slack.js content script
- [ ] discord.js content script
- [ ] whatsapp.js content script
- [ ] telegram.js content script
- [ ] selectors.json config (remotely updatable)
- [ ] Tests pass
- [ ] Documentation written

### Feature 4: Content Scripts — Email, Calendar, Project Mgmt, Social
**Task**: 2c876255-81aa-4f19-80e0-18d80dc3e063
**Agent**: Yassin Tamer Farouk (frontend-developer)
**Priority**: High | **Estimate**: M | **Phase**: 2

**Small Win**: Extension silently checks GitHub notifications every 2 min, alerts show in `twin_alerts()`.

**DOD**:
- [ ] gmail.js content script
- [ ] github.js content script
- [ ] linear.js content script
- [ ] jira.js content script
- [ ] gcal.js content script
- [ ] calcom.js content script
- [ ] twitter.js content script
- [ ] Active Monitor Manager in service worker
- [ ] Collapsed "Orchestra" tab group
- [ ] Tests pass
- [ ] Documentation written

### Feature 5: Meeting Intelligence — Google Meet + Zoom + AR/EN
**Task**: 7ea5d592-0d64-476a-bb7d-7d92165d73a7
**Agent**: Yassin Tamer Farouk (frontend) + Mostafa Ali Hassan (Go/Desktop)
**Priority**: High | **Estimate**: L | **Phase**: 3

**Small Win**: Join Google Meet, click "Record", get AI summary with action items on meeting end.

**DOD**:
- [ ] gmeet.js content script (captions)
- [ ] zoom.js content script (captions)
- [ ] language.js AR/EN/mixed detection
- [ ] Opt-in UI per meeting
- [ ] Visual recording badge
- [ ] Desktop caption accumulator (SQLite)
- [ ] AI summary generation (AR/EN)
- [ ] Auto-create tasks from action items
- [ ] Raw captions auto-delete after 24h
- [ ] Tests pass
- [ ] Documentation written

### Feature 6: Cloud Sync — Patterns, Analytics, Cross-Session Memory
**Task**: eb2bd776-fd26-46d8-ad57-341e2e1c7a73
**Agent**: Mostafa Ali Hassan (go-developer)
**Priority**: Medium | **Estimate**: L | **Phase**: 4

**Small Win**: End of day sync to cloud. Next morning twin loads context: "Yesterday you were on PR #247."

**DOD**:
- [ ] Activity digest (daily summary)
- [ ] Priority patterns (contact/channel learning)
- [ ] Cross-session context (open thread tracking)
- [ ] Routine templates
- [ ] Meeting summary sync (decisions only)
- [ ] E2E encryption (user holds key)
- [ ] twin_sync() MCP tool
- [ ] twin_restore() MCP tool
- [ ] Tests pass
- [ ] Documentation written

## Execution Order

```
Phase 1 (parallel): Feature 1 (Yassin) + Feature 2 (Mostafa)
Phase 2 (parallel): Feature 3 + Feature 4 (Yassin, after F1)
Phase 3:            Feature 5 (Yassin + Mostafa, after F2+F3)
Phase 4:            Feature 6 (Mostafa, after F5)
```

## Technical Notes

- Manifest V3 — service workers die after 5min, use offscreen document for persistent WS
- Use optional_host_permissions — user grants per domain
- Privacy mode toggle — counts only, no message text
- Selectors remotely updatable from Desktop via WS push
- Token pairing — one-time, stored in chrome.storage.local
- Extension ID verified on every connection
- All cloud data E2E encrypted with user's local key
- Meeting captions auto-delete after 24h locally
- Estimated total: ~720 lines JS, ~150 lines Go, ~32KB extension
