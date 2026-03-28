package db

import (
	"net/http"
	"time"
)

// Client is a Supabase REST API client.
type Client struct {
	BaseURL    string
	ServiceKey string
	HTTPClient *http.Client
}

// NewClient creates a new Supabase client.
func NewClient(baseURL, serviceKey string) *Client {
	return &Client{
		BaseURL:    baseURL,
		ServiceKey: serviceKey,
		HTTPClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}
