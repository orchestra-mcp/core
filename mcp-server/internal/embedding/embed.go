package embedding

import (
	"context"
	"errors"
)

// Client handles text embedding via an external provider.
type Client struct {
	Provider string
	APIKey   string
	Model    string
}

// NewClient creates a new embedding client.
func NewClient(provider, apiKey, model string) *Client {
	return &Client{
		Provider: provider,
		APIKey:   apiKey,
		Model:    model,
	}
}

// Embed generates a vector embedding for the given text.
func (c *Client) Embed(_ context.Context, _ string) ([]float32, error) {
	return nil, errors.New("not implemented")
}
