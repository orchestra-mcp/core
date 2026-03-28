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

const telegramAPIBase = "https://api.telegram.org"

// TelegramClient sends notifications via the Telegram Bot API.
type TelegramClient struct {
	botToken   string
	enabled    bool
	httpClient *http.Client
}

// NewTelegramClient creates a TelegramClient configured from the TELEGRAM_BOT_TOKEN
// environment variable. If the token is not set, the client is disabled and all
// operations are no-ops.
func NewTelegramClient() *TelegramClient {
	token := os.Getenv("TELEGRAM_BOT_TOKEN")
	return &TelegramClient{
		botToken: token,
		enabled:  token != "",
		httpClient: &http.Client{
			Timeout: 15 * time.Second,
		},
	}
}

// Enabled returns whether the Telegram client has a valid bot token configured.
func (t *TelegramClient) Enabled() bool {
	return t.enabled
}

// SendMessage sends a text message to the given Telegram chat using Markdown
// parse mode.
func (t *TelegramClient) SendMessage(ctx context.Context, chatID, text string) error {
	if !t.enabled {
		return nil
	}

	if chatID == "" {
		return fmt.Errorf("chat_id is required")
	}

	url := fmt.Sprintf("%s/bot%s/sendMessage", telegramAPIBase, t.botToken)

	payload := map[string]string{
		"chat_id":    chatID,
		"text":       text,
		"parse_mode": "Markdown",
	}

	data, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("marshal payload: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(data))
	if err != nil {
		return fmt.Errorf("create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := t.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("http request: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("read response: %w", err)
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("telegram API returned HTTP %d: %s", resp.StatusCode, string(body))
	}

	var result struct {
		OK          bool   `json:"ok"`
		Description string `json:"description"`
	}
	if err := json.Unmarshal(body, &result); err != nil {
		return fmt.Errorf("decode telegram response: %w", err)
	}
	if !result.OK {
		return fmt.Errorf("telegram sendMessage: %s", result.Description)
	}

	return nil
}
