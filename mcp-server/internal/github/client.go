package github

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

const baseURL = "https://api.github.com"

// Client is a GitHub REST API v3 client for Orchestra MCP integrations.
type Client struct {
	token      string
	httpClient *http.Client
}

// NewClient creates a new GitHub API client authenticated with the given access token.
func NewClient(accessToken string) *Client {
	return &Client{
		token: accessToken,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

// GitHubUser represents a GitHub user profile.
type GitHubUser struct {
	Login     string `json:"login"`
	Email     string `json:"email"`
	AvatarURL string `json:"avatar_url"`
	ID        int    `json:"id"`
}

// GitHubRepo represents a GitHub repository.
type GitHubRepo struct {
	FullName      string `json:"full_name"`
	DefaultBranch string `json:"default_branch"`
	Description   string `json:"description"`
	Private       bool   `json:"private"`
}

// GitHubFile represents a file fetched from a GitHub repository.
type GitHubFile struct {
	Content  string `json:"content"`
	SHA      string `json:"sha"`
	Path     string `json:"path"`
	Encoding string `json:"encoding"`
}

// GitHubBranch represents a branch in a GitHub repository.
type GitHubBranch struct {
	Name   string `json:"name"`
	Commit struct {
		SHA string `json:"sha"`
	} `json:"commit"`
}

// GitHubPR represents a GitHub pull request.
type GitHubPR struct {
	Number  int    `json:"number"`
	HTMLURL string `json:"html_url"`
	Title   string `json:"title"`
	State   string `json:"state"`
}

// gitHubRef is used internally for reading and creating Git references.
type gitHubRef struct {
	Ref    string `json:"ref"`
	Object struct {
		SHA string `json:"sha"`
	} `json:"object"`
}

// ---------------------------------------------------------------------------
// Internal HTTP helpers
// ---------------------------------------------------------------------------

func (c *Client) do(ctx context.Context, method, path string, body interface{}) ([]byte, error) {
	var reqBody io.Reader
	if body != nil {
		b, err := json.Marshal(body)
		if err != nil {
			return nil, fmt.Errorf("github: marshal body: %w", err)
		}
		reqBody = bytes.NewReader(b)
	}

	url := baseURL + path
	req, err := http.NewRequestWithContext(ctx, method, url, reqBody)
	if err != nil {
		return nil, fmt.Errorf("github: create request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+c.token)
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("X-GitHub-Api-Version", "2022-11-28")
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("github: http request: %w", err)
	}
	defer resp.Body.Close()

	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("github: read response: %w", err)
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("github: %s %s returned %d: %s", method, path, resp.StatusCode, string(data))
	}

	return data, nil
}

// ---------------------------------------------------------------------------
// API methods
// ---------------------------------------------------------------------------

// GetUser returns the authenticated GitHub user.
func (c *Client) GetUser(ctx context.Context) (*GitHubUser, error) {
	data, err := c.do(ctx, http.MethodGet, "/user", nil)
	if err != nil {
		return nil, err
	}
	var user GitHubUser
	if err := json.Unmarshal(data, &user); err != nil {
		return nil, fmt.Errorf("github: decode user: %w", err)
	}
	return &user, nil
}

// ListRepos returns the authenticated user's repositories, paginated.
func (c *Client) ListRepos(ctx context.Context, page, perPage int) ([]GitHubRepo, error) {
	if page < 1 {
		page = 1
	}
	if perPage < 1 || perPage > 100 {
		perPage = 30
	}
	path := fmt.Sprintf("/user/repos?sort=updated&per_page=%d&page=%d", perPage, page)
	data, err := c.do(ctx, http.MethodGet, path, nil)
	if err != nil {
		return nil, err
	}
	var repos []GitHubRepo
	if err := json.Unmarshal(data, &repos); err != nil {
		return nil, fmt.Errorf("github: decode repos: %w", err)
	}
	return repos, nil
}

// GetFile reads a file from a GitHub repository at the given ref.
func (c *Client) GetFile(ctx context.Context, owner, repo, path, ref string) (*GitHubFile, error) {
	apiPath := fmt.Sprintf("/repos/%s/%s/contents/%s", owner, repo, path)
	if ref != "" {
		apiPath += "?ref=" + ref
	}
	data, err := c.do(ctx, http.MethodGet, apiPath, nil)
	if err != nil {
		return nil, err
	}
	var file GitHubFile
	if err := json.Unmarshal(data, &file); err != nil {
		return nil, fmt.Errorf("github: decode file: %w", err)
	}
	return &file, nil
}

// CreateOrUpdateFile creates or updates a file in a GitHub repository.
// For updates, pass the existing SHA of the file. For new files, pass sha as "".
func (c *Client) CreateOrUpdateFile(ctx context.Context, owner, repo, path, message string, content []byte, sha string, branch string) error {
	apiPath := fmt.Sprintf("/repos/%s/%s/contents/%s", owner, repo, path)

	body := map[string]interface{}{
		"message": message,
		"content": base64.StdEncoding.EncodeToString(content),
	}
	if sha != "" {
		body["sha"] = sha
	}
	if branch != "" {
		body["branch"] = branch
	}

	_, err := c.do(ctx, http.MethodPut, apiPath, body)
	return err
}

// CreateBranch creates a new branch from the given ref (e.g. "main" or a SHA).
func (c *Client) CreateBranch(ctx context.Context, owner, repo, branchName, fromRef string) error {
	// First, resolve the fromRef to a SHA.
	refPath := fmt.Sprintf("/repos/%s/%s/git/ref/heads/%s", owner, repo, fromRef)
	data, err := c.do(ctx, http.MethodGet, refPath, nil)
	if err != nil {
		return fmt.Errorf("resolve ref %q: %w", fromRef, err)
	}
	var ref gitHubRef
	if err := json.Unmarshal(data, &ref); err != nil {
		return fmt.Errorf("decode ref: %w", err)
	}

	// Create the new branch ref.
	createPath := fmt.Sprintf("/repos/%s/%s/git/refs", owner, repo)
	body := map[string]string{
		"ref": "refs/heads/" + branchName,
		"sha": ref.Object.SHA,
	}
	_, err = c.do(ctx, http.MethodPost, createPath, body)
	return err
}

// CreatePR creates a new pull request.
func (c *Client) CreatePR(ctx context.Context, owner, repo, title, body, head, base string) (*GitHubPR, error) {
	apiPath := fmt.Sprintf("/repos/%s/%s/pulls", owner, repo)
	payload := map[string]string{
		"title": title,
		"body":  body,
		"head":  head,
		"base":  base,
	}
	data, err := c.do(ctx, http.MethodPost, apiPath, payload)
	if err != nil {
		return nil, err
	}
	var pr GitHubPR
	if err := json.Unmarshal(data, &pr); err != nil {
		return nil, fmt.Errorf("github: decode PR: %w", err)
	}
	return &pr, nil
}

// ListBranches lists branches of a GitHub repository.
func (c *Client) ListBranches(ctx context.Context, owner, repo string) ([]GitHubBranch, error) {
	apiPath := fmt.Sprintf("/repos/%s/%s/branches?per_page=100", owner, repo)
	data, err := c.do(ctx, http.MethodGet, apiPath, nil)
	if err != nil {
		return nil, err
	}
	var branches []GitHubBranch
	if err := json.Unmarshal(data, &branches); err != nil {
		return nil, fmt.Errorf("github: decode branches: %w", err)
	}
	return branches, nil
}
