package db

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
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
		BaseURL:    strings.TrimRight(baseURL, "/"),
		ServiceKey: serviceKey,
		HTTPClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// do executes an HTTP request against the Supabase REST API with standard headers.
func (c *Client) do(ctx context.Context, method, path string, body interface{}, headers map[string]string) (json.RawMessage, error) {
	var reqBody io.Reader
	if body != nil {
		b, err := json.Marshal(body)
		if err != nil {
			return nil, fmt.Errorf("marshal body: %w", err)
		}
		reqBody = bytes.NewReader(b)
	}

	url := c.BaseURL + "/rest/v1/" + strings.TrimLeft(path, "/")
	req, err := http.NewRequestWithContext(ctx, method, url, reqBody)
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}

	req.Header.Set("apikey", c.ServiceKey)
	req.Header.Set("Authorization", "Bearer "+c.ServiceKey)
	req.Header.Set("Content-Type", "application/json")
	// Return inserted/updated rows as JSON.
	req.Header.Set("Prefer", "return=representation")

	for k, v := range headers {
		req.Header.Set(k, v)
	}

	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("http request: %w", err)
	}
	defer resp.Body.Close()

	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read response: %w", err)
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("supabase %s %s returned %d: %s", method, path, resp.StatusCode, string(data))
	}

	return json.RawMessage(data), nil
}

// Get performs a GET request on a table with the given query string (PostgREST filters).
func (c *Client) Get(ctx context.Context, table string, query string) (json.RawMessage, error) {
	path := table
	if query != "" {
		path += "?" + query
	}
	return c.do(ctx, http.MethodGet, path, nil, nil)
}

// Post inserts one or more rows into a table.
func (c *Client) Post(ctx context.Context, table string, body interface{}) (json.RawMessage, error) {
	return c.do(ctx, http.MethodPost, table, body, nil)
}

// Patch updates rows matching the query string.
func (c *Client) Patch(ctx context.Context, table string, query string, body interface{}) (json.RawMessage, error) {
	path := table
	if query != "" {
		path += "?" + query
	}
	return c.do(ctx, http.MethodPatch, path, body, nil)
}

// Delete removes rows matching the query string.
func (c *Client) Delete(ctx context.Context, table string, query string) (json.RawMessage, error) {
	path := table
	if query != "" {
		path += "?" + query
	}
	return c.do(ctx, http.MethodDelete, path, nil, nil)
}

// RPC calls a Supabase/PostgREST stored procedure (RPC endpoint).
func (c *Client) RPC(ctx context.Context, fn string, params interface{}) (json.RawMessage, error) {
	path := "rpc/" + fn
	return c.do(ctx, http.MethodPost, path, params, nil)
}

// GetSingle fetches a single row from a table, returning the object directly
// instead of a JSON array. It uses the Accept: application/vnd.pgrst.object+json header.
func (c *Client) GetSingle(ctx context.Context, table string, query string) (json.RawMessage, error) {
	path := table
	if query != "" {
		path += "?" + query
	}
	return c.do(ctx, http.MethodGet, path, nil, map[string]string{
		"Accept": "application/vnd.pgrst.object+json",
	})
}

// Upsert inserts or updates rows using PostgREST's conflict resolution.
// onConflict is a comma-separated list of column names forming the unique constraint
// (e.g. "user_id,organization_id,key").
func (c *Client) Upsert(ctx context.Context, table string, body interface{}, onConflict string) (json.RawMessage, error) {
	path := table
	if onConflict != "" {
		path += "?on_conflict=" + onConflict
	}
	return c.do(ctx, http.MethodPost, path, body, map[string]string{
		"Prefer": "return=representation,resolution=merge-duplicates",
	})
}
