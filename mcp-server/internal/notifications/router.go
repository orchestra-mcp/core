package notifications

import (
	"context"
	"fmt"
	"log/slog"
)

// NotifyEvent describes a notification to be sent across one or more channels.
type NotifyEvent struct {
	Title          string
	Message        string
	SlackChannel   string
	DiscordChannel string
	TelegramChat   string
}

// Router fans out notifications to all configured providers.
type Router struct {
	Slack    *SlackClient
	Discord  *DiscordClient
	Telegram *TelegramClient
}

// NewRouter creates a Router with all notification clients initialized from
// environment variables.
func NewRouter() *Router {
	return &Router{
		Slack:    NewSlackClient(),
		Discord:  NewDiscordClient(),
		Telegram: NewTelegramClient(),
	}
}

// Notify sends a notification to all configured and targeted channels.
// Delivery is asynchronous — errors are logged but not returned.
func (r *Router) Notify(ctx context.Context, event NotifyEvent) {
	text := fmt.Sprintf("**%s**: %s", event.Title, event.Message)

	if r.Slack.Enabled() && event.SlackChannel != "" {
		go func() {
			if err := r.Slack.SendMessage(ctx, event.SlackChannel, text); err != nil {
				slog.Error("slack notification failed", "channel", event.SlackChannel, "error", err)
			}
		}()
	}

	if r.Discord.Enabled() && event.DiscordChannel != "" {
		go func() {
			if err := r.Discord.SendMessage(ctx, event.DiscordChannel, text); err != nil {
				slog.Error("discord notification failed", "channel", event.DiscordChannel, "error", err)
			}
		}()
	}

	if r.Telegram.Enabled() && event.TelegramChat != "" {
		go func() {
			if err := r.Telegram.SendMessage(ctx, event.TelegramChat, text); err != nil {
				slog.Error("telegram notification failed", "chat", event.TelegramChat, "error", err)
			}
		}()
	}
}
