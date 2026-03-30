# Request: Integration Settings + Multi-Channel Notifications

**Date**: 2026-03-28 15:25
**Status**: Pending
**Priority**: High

## Admin Settings (Supabase Studio → Project Settings)

### GitHub Integration

- Admin configures: GitHub App ID, GitHub App Private Key, OAuth Client ID/Secret
- Stored in: organizations.settings JSONB or dedicated config table
- Location: Studio → Project Settings → Integrations → GitHub

### Slack Integration

- Admin configures: Slack Bot Token, default notification channel
- Stored in: organizations.settings
- Location: Studio → Project Settings → Integrations → Slack

### Discord Integration (NEW)

- Admin configures: Discord Bot Token, webhook URL, server ID
- Location: Studio → Project Settings → Integrations → Discord

### Telegram Integration (NEW)

- Admin configures: Telegram Bot Token, default chat ID
- Location: Studio → Project Settings → Integrations → Telegram

### WhatsApp Integration (NEW)

- Admin configures: WhatsApp Business API credentials
- Location: Studio → Project Settings → Integrations → WhatsApp

## User Dashboard (Laravel → Settings)

### OAuth Connections

- User connects: GitHub account (OAuth flow)
- User connects: Slack workspace
- User connects: Discord account
- Stored in: github_connections table (extend for other providers)
- Location: Laravel → Dashboard → Settings → Connections

### Notification Preferences

- User selects: which channels to receive notifications on
- Per-event toggles: task assigned, task completed, agent blocked, etc.
- Location: Laravel → Dashboard → Settings → Notifications

## Go MCP Server Changes

- Read integration config from organizations.settings
- Extend slack_notify to support Discord, Telegram, WhatsApp
- Add: discord_notify, telegram_notify, whatsapp_notify tools
- Notification router: send to all configured channels

## Migration

- Add integrations JSONB to organizations or create integrations table
- Add notification_preferences to profiles
