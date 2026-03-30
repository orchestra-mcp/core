# Rule 15: Multi-Provider Agents

Agents can run on any supported AI provider. The provider is stored in the agent's DB record and respected at spawn time.

## Supported Providers

| Provider | Models | Notes |
|----------|--------|-------|
| `claude` | opus, sonnet, haiku | Default — Claude Code Bridge |
| `gemini` | gemini-2.0-flash, gemini-2.5-pro | Google Gemini via API |
| `openai` | gpt-4o, gpt-4.1, o3 | OpenAI via API |
| `deepseek` | deepseek-r2, deepseek-v3 | DeepSeek via API |
| `qwen` | qwen3-235b, qwen3-72b | Alibaba Qwen via API |
| `ollama` | llama3.3, mistral, etc. | Self-hosted via Ollama |

## Rules

1. **Default is Claude Code Bridge** — all agents default to `provider: "claude"` unless overridden
2. **MCP tools are universal interface** — every provider updates status via MCP tools (task_update, agent_update, etc.) regardless of which AI is running
3. **Provider stored in DB** — `agents.provider` and `agents.provider_config` hold the provider and any provider-specific config (e.g., `base_url` for Ollama, API key overrides)
4. **Model tier maps per provider** — `opus` → high-capability, `sonnet` → standard, `haiku` → fast/cheap (exact model IDs resolved per provider)
5. **Account pool auto-rotates on rate limit** — when a provider returns a rate limit error, the orchestrator pulls the next account from `user_configs.account_pool` and retries
6. **Never hard-code provider in tasks** — use agent slug; the orchestrator resolves the provider from the agent's DB record
7. **Ollama requires `base_url`** — set `provider_config: {"base_url": "http://localhost:11434"}` when using Ollama

## Provider Config Examples

```json
// Claude (default — no config needed)
{"provider": "claude"}

// OpenAI with custom key
{"provider": "openai", "provider_config": {"api_key": "sk-..."}}

// Ollama self-hosted
{"provider": "ollama", "provider_config": {"base_url": "http://localhost:11434", "model": "llama3.3"}}

// Gemini
{"provider": "gemini", "provider_config": {"api_key": "AIza..."}}
```
