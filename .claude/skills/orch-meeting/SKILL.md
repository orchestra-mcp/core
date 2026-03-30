---
name: Orchestra Meeting
description: Start a team meeting with all agents. Shortcut for meeting_create.
user_invocable: true
---

# /orch-meeting — Start Team Meeting

When invoked, immediately:
1. Call `meeting_create(title: "{user's topic or 'Team Meeting'}")` — this auto-loads all 38 agents
2. Present the participant roster
3. Enter meeting mode — agents respond in character
4. Store every message via `meeting_message`
5. Log decisions via `decision_log(meeting_id: "...")`
6. When user says "end meeting" or "close" → call `meeting_end` with auto-summary

## A2UI Visualization
Suggest MeetingTranscript component for Claude Desktop:
```yaml
visualization:
  component: MeetingTranscript
  props:
    meeting_id: "{id}"
    live: true
```
