package tools

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/orchestra-mcp/server/internal/auth"
	"github.com/orchestra-mcp/server/internal/mcp"
	"github.com/orchestra-mcp/server/internal/notifications"
)

// ---------------------------------------------------------------------------
// JSON Schemas
// ---------------------------------------------------------------------------

var notifySchema = json.RawMessage(`{
	"type": "object",
	"properties": {
		"title": {
			"type": "string",
			"description": "Notification title or subject"
		},
		"message": {
			"type": "string",
			"description": "Notification body text"
		},
		"channels": {
			"type": "array",
			"items": {"type": "string", "enum": ["slack", "discord", "telegram"]},
			"description": "Optional list of channels to notify. If omitted, all configured channels are used."
		},
		"slack_channel": {
			"type": "string",
			"description": "Slack channel name or ID (required if sending to Slack)"
		},
		"discord_channel": {
			"type": "string",
			"description": "Discord channel ID (required if sending to Discord via bot)"
		},
		"telegram_chat": {
			"type": "string",
			"description": "Telegram chat ID (required if sending to Telegram)"
		}
	},
	"required": ["title", "message"]
}`)

var discordNotifySchema = json.RawMessage(`{
	"type": "object",
	"properties": {
		"channel_id": {
			"type": "string",
			"description": "Discord channel ID to post in"
		},
		"message": {
			"type": "string",
			"description": "Message text to send"
		}
	},
	"required": ["channel_id", "message"]
}`)

var telegramNotifySchema = json.RawMessage(`{
	"type": "object",
	"properties": {
		"chat_id": {
			"type": "string",
			"description": "Telegram chat ID to send to"
		},
		"message": {
			"type": "string",
			"description": "Message text to send (supports Markdown)"
		}
	},
	"required": ["chat_id", "message"]
}`)

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

// RegisterNotifyTools registers the unified notify tool and per-provider tools
// for Discord and Telegram.
func RegisterNotifyTools(registry *mcp.ToolRegistry, router *notifications.Router) {
	registry.Register(
		"notify",
		"Send a notification to one or more configured channels (Slack, Discord, Telegram)",
		notifySchema,
		makeNotify(router),
	)

	registry.Register(
		"discord_notify",
		"Send a notification to a Discord channel",
		discordNotifySchema,
		makeDiscordNotify(router),
	)

	registry.Register(
		"telegram_notify",
		"Send a notification to a Telegram chat",
		telegramNotifySchema,
		makeTelegramNotify(router),
	)
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

func makeNotify(router *notifications.Router) mcp.ToolHandler {
	return func(ctx context.Context, params json.RawMessage) (*mcp.ToolResult, error) {
		var input struct {
			Title          string   `json:"title"`
			Message        string   `json:"message"`
			Channels       []string `json:"channels"`
			SlackChannel   string   `json:"slack_channel"`
			DiscordChannel string   `json:"discord_channel"`
			TelegramChat   string   `json:"telegram_chat"`
		}
		if err := json.Unmarshal(params, &input); err != nil {
			return errorResult("invalid params: " + err.Error()), nil
		}
		if input.Title == "" || input.Message == "" {
			return errorResult("title and message are required"), nil
		}

		uc := auth.UserContextFromContext(ctx)
		if uc == nil {
			return errorResult("authentication required"), nil
		}

		// Build a set of requested channels. If none specified, use all.
		wantAll := len(input.Channels) == 0
		channelSet := make(map[string]bool, len(input.Channels))
		for _, ch := range input.Channels {
			channelSet[ch] = true
		}

		event := notifications.NotifyEvent{
			Title:   input.Title,
			Message: input.Message,
		}

		var sent []string

		if (wantAll || channelSet["slack"]) && router.Slack.Enabled() {
			if input.SlackChannel == "" {
				return errorResult("slack_channel is required when sending to Slack"), nil
			}
			event.SlackChannel = input.SlackChannel
			sent = append(sent, "slack")
		}

		if (wantAll || channelSet["discord"]) && router.Discord.Enabled() {
			// Discord channel is optional when webhook is used
			event.DiscordChannel = input.DiscordChannel
			sent = append(sent, "discord")
		}

		if (wantAll || channelSet["telegram"]) && router.Telegram.Enabled() {
			if input.TelegramChat == "" {
				return errorResult("telegram_chat is required when sending to Telegram"), nil
			}
			event.TelegramChat = input.TelegramChat
			sent = append(sent, "telegram")
		}

		if len(sent) == 0 {
			return errorResult("no notification channels are configured — set SLACK_BOT_TOKEN, DISCORD_WEBHOOK_URL/DISCORD_BOT_TOKEN, or TELEGRAM_BOT_TOKEN"), nil
		}

		router.Notify(ctx, event)

		return textResult(fmt.Sprintf("Notification dispatched to: %v", sent)), nil
	}
}

func makeDiscordNotify(router *notifications.Router) mcp.ToolHandler {
	return func(ctx context.Context, params json.RawMessage) (*mcp.ToolResult, error) {
		var input struct {
			ChannelID string `json:"channel_id"`
			Message   string `json:"message"`
		}
		if err := json.Unmarshal(params, &input); err != nil {
			return errorResult("invalid params: " + err.Error()), nil
		}
		if input.ChannelID == "" || input.Message == "" {
			return errorResult("channel_id and message are required"), nil
		}

		uc := auth.UserContextFromContext(ctx)
		if uc == nil {
			return errorResult("authentication required"), nil
		}

		if !router.Discord.Enabled() {
			return errorResult("Discord integration is not configured — set DISCORD_WEBHOOK_URL or DISCORD_BOT_TOKEN"), nil
		}

		if err := router.Discord.SendMessage(ctx, input.ChannelID, input.Message); err != nil {
			return errorResult("failed to send Discord message: " + err.Error()), nil
		}

		return textResult(fmt.Sprintf("Message sent to Discord channel %s", input.ChannelID)), nil
	}
}

func makeTelegramNotify(router *notifications.Router) mcp.ToolHandler {
	return func(ctx context.Context, params json.RawMessage) (*mcp.ToolResult, error) {
		var input struct {
			ChatID  string `json:"chat_id"`
			Message string `json:"message"`
		}
		if err := json.Unmarshal(params, &input); err != nil {
			return errorResult("invalid params: " + err.Error()), nil
		}
		if input.ChatID == "" || input.Message == "" {
			return errorResult("chat_id and message are required"), nil
		}

		uc := auth.UserContextFromContext(ctx)
		if uc == nil {
			return errorResult("authentication required"), nil
		}

		if !router.Telegram.Enabled() {
			return errorResult("Telegram integration is not configured — set TELEGRAM_BOT_TOKEN"), nil
		}

		if err := router.Telegram.SendMessage(ctx, input.ChatID, input.Message); err != nil {
			return errorResult("failed to send Telegram message: " + err.Error()), nil
		}

		return textResult(fmt.Sprintf("Message sent to Telegram chat %s", input.ChatID)), nil
	}
}
