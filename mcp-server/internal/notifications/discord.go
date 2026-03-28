package notifications

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"time"
)

const discordAPIBase = "https://discord.com/api/v10"

// DiscordClient sends notifications via Discord webhooks or the Bot API.
type DiscordClient struct {
	webhookURL string
	botToken   string
	enabled    bool
	httpClient *http.Client
}

// NewDiscordClient creates a DiscordClient configured from environment variables.
// It checks DISCORD_WEBHOOK_URL and DISCORD_BOT_TOKEN. If neither is set, the
// client is disabled and all operations are no-ops.
func NewDiscordClient() *DiscordClient {
	webhook := os.Getenv("DISCORD_WEBHOOK_URL")
	token := os.Getenv("DISCORD_BOT_TOKEN")
	return &DiscordClient{
		webhookURL: webhook,
		botToken:   token,
		enabled:    webhook != "" || token != "",
		httpClient: &http.Client{
			Timeout: 15 * time.Second,
		},
	}
}

// Enabled returns whether the Discord client has valid credentials configured.
func (d *DiscordClient) Enabled() bool {
	return d.enabled
}

// SendMessage posts a message to the given Discord channel.
// If a webhook URL is configured it is used first (channelID is ignored for
// webhooks). Otherwise the Bot API endpoint is used with channelID.
func (d *DiscordClient) SendMessage(ctx context.Context, channelID, text string) error {
	if !d.enabled {
		return nil
	}

	if d.webhookURL != "" {
		return d.sendViaWebhook(ctx, text)
	}

	return d.sendViaBotAPI(ctx, channelID, text)
}

// sendViaWebhook posts a message using a Discord webhook URL.
func (d *DiscordClient) sendViaWebhook(ctx context.Context, text string) error {
	payload := map[string]string{"content": text}

	data, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("marshal payload: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, d.webhookURL, bytes.NewReader(data))
	if err != nil {
		return fmt.Errorf("create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := d.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("http request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("discord webhook returned HTTP %d: %s", resp.StatusCode, string(body))
	}

	return nil
}

// sendViaBotAPI posts a message using the Discord Bot API.
func (d *DiscordClient) sendViaBotAPI(ctx context.Context, channelID, text string) error {
	if channelID == "" {
		return fmt.Errorf("channel_id is required when using bot token")
	}

	url := fmt.Sprintf("%s/channels/%s/messages", discordAPIBase, channelID)

	payload := map[string]string{"content": text}

	data, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("marshal payload: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(data))
	if err != nil {
		return fmt.Errorf("create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bot "+d.botToken)

	resp, err := d.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("http request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("discord bot API returned HTTP %d: %s", resp.StatusCode, string(body))
	}

	return nil
}
