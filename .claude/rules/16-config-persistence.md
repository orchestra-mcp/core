# Rule 16: Config Persistence

User configuration is saved on the cloud MCP server and auto-loaded at session start. This ensures AI agents know user preferences without repeating setup every session.

## How It Works

1. **Save config** — use `config_save(key, value)` to persist any preference
2. **Load config** — use `config_get()` at session start to retrieve all saved config
3. **Auto-load** — every new session should call `config_get()` as part of initialization (via `context_get` or `init`)

## Config Keys

| Key | Type | Description |
|-----|------|-------------|
| `preferences` | object | Theme, language, notification settings |
| `active_project` | string (UUID) | Current project ID the user is working on |
| `work_patterns` | object | How user prefers to work (plan-first, meeting-heavy, async, etc.) |
| `account_pool` | array | List of API accounts with labels and tiers for provider rotation |
| `default_provider` | string | Preferred AI provider: `claude`, `gemini`, `openai`, `deepseek`, `qwen`, `ollama` |
| `default_model` | string | Preferred model tier: `opus`, `sonnet`, `haiku` |

## Rules

1. **Save preferences immediately** — when user states a preference, call `config_save` right away
2. **Load at session start** — always call `config_get()` at the beginning of a session to restore context
3. **Config is per-user per-org** — config is scoped to `(user_id, organization_id)`, isolated per org
4. **Never ask twice** — if `preferences.theme` is already saved, never ask about theme again
5. **Work patterns guide delegation** — if `work_patterns.style = "plan-first"`, always create a plan before coding; if `"async"`, batch updates rather than real-time
6. **Account pool rotation** — if `account_pool` contains multiple entries, rotate when rate-limited (see Rule 15)
7. **Default provider applies to new agents** — when `default_provider` is set, new agents created via `agent_create` should use it as their provider unless explicitly overridden

## Example: Saving Preferences

```
config_save(key: "preferences", value: {
  "theme": "dark",
  "language": "en",
  "notifications": {"slack": true, "email": false}
})

config_save(key: "default_provider", value: "claude")

config_save(key: "work_patterns", value: {
  "style": "plan-first",
  "meeting_cadence": "weekly",
  "prefer_async": true
})

config_save(key: "account_pool", value: [
  {"label": "primary", "provider": "claude", "tier": "pro"},
  {"label": "backup", "provider": "openai", "tier": "gpt-4o"}
])
```

## Example: Loading at Session Start

```
config_get()
→ Returns all saved configs so AI knows user preferences without asking
```
