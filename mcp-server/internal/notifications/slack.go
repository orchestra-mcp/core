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

const slackAPIBase = "https://slack.com/api"

// SlackClient sends notifications via the Slack API.
type SlackClient struct {
	botToken   string
	enabled    bool
	httpClient *http.Client
}

// NewSlackClient creates a SlackClient configured from the SLACK_BOT_TOKEN env var.
// If the token is not set, the client is disabled and all operations are no-ops.
func NewSlackClient() *SlackClient {
	token := os.Getenv("SLACK_BOT_TOKEN")
	return &SlackClient{
		botToken: token,
		enabled:  token != "",
		httpClient: &http.Client{
			Timeout: 15 * time.Second,
		},
	}
}

// Enabled returns whether the Slack client has a valid bot token configured.
func (s *SlackClient) Enabled() bool {
	return s.enabled
}

// SendMessage posts a message to the given Slack channel.
func (s *SlackClient) SendMessage(ctx context.Context, channel, text string) error {
	if !s.enabled {
		return nil
	}

	payload := map[string]string{
		"channel": channel,
		"text":    text,
	}

	return s.post(ctx, "/chat.postMessage", payload)
}

// SendDM sends a direct message to a Slack user identified by email.
// It first looks up the user ID via users.lookupByEmail, then sends a DM.
func (s *SlackClient) SendDM(ctx context.Context, userEmail, text string) error {
	if !s.enabled {
		return nil
	}

	// Look up user by email.
	userID, err := s.lookupUserByEmail(ctx, userEmail)
	if err != nil {
		return fmt.Errorf("lookup user %q: %w", userEmail, err)
	}

	// Open a DM conversation.
	convPayload := map[string]string{
		"users": userID,
	}
	convBody, err := s.postRaw(ctx, "/conversations.open", convPayload)
	if err != nil {
		return fmt.Errorf("open DM conversation: %w", err)
	}

	var convResp struct {
		OK      bool   `json:"ok"`
		Error   string `json:"error"`
		Channel struct {
			ID string `json:"id"`
		} `json:"channel"`
	}
	if err := json.Unmarshal(convBody, &convResp); err != nil {
		return fmt.Errorf("decode conversations.open response: %w", err)
	}
	if !convResp.OK {
		return fmt.Errorf("conversations.open: %s", convResp.Error)
	}

	// Send the message to the DM channel.
	return s.SendMessage(ctx, convResp.Channel.ID, text)
}

// lookupUserByEmail resolves a Slack user ID from an email address.
func (s *SlackClient) lookupUserByEmail(ctx context.Context, email string) (string, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet,
		slackAPIBase+"/users.lookupByEmail?email="+email, nil)
	if err != nil {
		return "", err
	}
	req.Header.Set("Authorization", "Bearer "+s.botToken)

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}

	var result struct {
		OK    bool   `json:"ok"`
		Error string `json:"error"`
		User  struct {
			ID string `json:"id"`
		} `json:"user"`
	}
	if err := json.Unmarshal(body, &result); err != nil {
		return "", fmt.Errorf("decode response: %w", err)
	}
	if !result.OK {
		return "", fmt.Errorf("users.lookupByEmail: %s", result.Error)
	}

	return result.User.ID, nil
}

// post sends a JSON POST request to the Slack API and checks the response for errors.
func (s *SlackClient) post(ctx context.Context, endpoint string, payload interface{}) error {
	body, err := s.postRaw(ctx, endpoint, payload)
	if err != nil {
		return err
	}

	var result struct {
		OK    bool   `json:"ok"`
		Error string `json:"error"`
	}
	if err := json.Unmarshal(body, &result); err != nil {
		return fmt.Errorf("decode slack response: %w", err)
	}
	if !result.OK {
		return fmt.Errorf("slack %s: %s", endpoint, result.Error)
	}
	return nil
}

// postRaw sends a JSON POST request and returns the raw response body.
func (s *SlackClient) postRaw(ctx context.Context, endpoint string, payload interface{}) ([]byte, error) {
	data, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("marshal payload: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, slackAPIBase+endpoint, bytes.NewReader(data))
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json; charset=utf-8")
	req.Header.Set("Authorization", "Bearer "+s.botToken)

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("http request: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read response: %w", err)
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("slack %s returned HTTP %d: %s", endpoint, resp.StatusCode, string(body))
	}

	return body, nil
}
