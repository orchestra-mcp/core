package embedding

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

// Client handles text embedding via an external provider (OpenAI-compatible).
type Client struct {
	Provider   string
	APIKey     string
	Model      string
	HTTPClient *http.Client
}

// NewClient creates a new embedding client.
func NewClient(provider, apiKey, model string) *Client {
	return &Client{
		Provider: provider,
		APIKey:   apiKey,
		Model:    model,
		HTTPClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// embeddingRequest is the request body for the OpenAI embeddings API.
type embeddingRequest struct {
	Input string `json:"input"`
	Model string `json:"model"`
}

// embeddingResponse is the response from the OpenAI embeddings API.
type embeddingResponse struct {
	Data []struct {
		Embedding []float32 `json:"embedding"`
		Index     int       `json:"index"`
	} `json:"data"`
	Usage struct {
		PromptTokens int `json:"prompt_tokens"`
		TotalTokens  int `json:"total_tokens"`
	} `json:"usage"`
}

// embeddingErrorResponse is returned when the API call fails.
type embeddingErrorResponse struct {
	Error struct {
		Message string `json:"message"`
		Type    string `json:"type"`
		Code    string `json:"code"`
	} `json:"error"`
}

// endpointURL returns the API endpoint based on the provider.
func (c *Client) endpointURL() string {
	switch c.Provider {
	case "openai":
		return "https://api.openai.com/v1/embeddings"
	default:
		// Default to OpenAI-compatible endpoint.
		return "https://api.openai.com/v1/embeddings"
	}
}

// Embed generates a vector embedding for the given text.
func (c *Client) Embed(ctx context.Context, text string) ([]float32, error) {
	if c == nil {
		return nil, fmt.Errorf("embedding: client not initialized (set EMBEDDING_API_KEY)")
	}
	if c.APIKey == "" {
		return nil, fmt.Errorf("embedding: API key not configured (set EMBEDDING_API_KEY)")
	}
	if text == "" {
		return nil, fmt.Errorf("embedding: empty input text")
	}

	reqBody := embeddingRequest{
		Input: text,
		Model: c.Model,
	}

	bodyBytes, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("embedding: failed to marshal request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.endpointURL(), bytes.NewReader(bodyBytes))
	if err != nil {
		return nil, fmt.Errorf("embedding: failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+c.APIKey)

	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("embedding: request failed: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("embedding: failed to read response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		var errResp embeddingErrorResponse
		if json.Unmarshal(respBody, &errResp) == nil && errResp.Error.Message != "" {
			return nil, fmt.Errorf("embedding: API error (%d): %s", resp.StatusCode, errResp.Error.Message)
		}
		return nil, fmt.Errorf("embedding: API returned %d: %s", resp.StatusCode, string(respBody))
	}

	var embResp embeddingResponse
	if err := json.Unmarshal(respBody, &embResp); err != nil {
		return nil, fmt.Errorf("embedding: failed to parse response: %w", err)
	}

	if len(embResp.Data) == 0 {
		return nil, fmt.Errorf("embedding: empty response from API")
	}

	return embResp.Data[0].Embedding, nil
}
