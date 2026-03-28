package github

import (
	"net/http"
	"time"
)

// Client is a GitHub API client for Orchestra MCP integrations.
type Client struct {
	Token      string
	HTTPClient *http.Client
}

// NewClient creates a new GitHub API client.
func NewClient(token string) *Client {
	return &Client{
		Token: token,
		HTTPClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}
