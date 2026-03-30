package tools

import (
	"context"
	"crypto/aes"
	"crypto/cipher"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/url"
	"os"
	"strings"
	"time"

	"github.com/orchestra-mcp/server/internal/auth"
	"github.com/orchestra-mcp/server/internal/db"
	"github.com/orchestra-mcp/server/internal/github"
	"github.com/orchestra-mcp/server/internal/mcp"
)

// ---------------------------------------------------------------------------
// JSON Schemas
// ---------------------------------------------------------------------------

var repoListSchema = json.RawMessage(`{
	"type": "object",
	"properties": {
		"page":     {"type": "integer", "default": 1, "description": "Page number (1-based)"},
		"per_page": {"type": "integer", "default": 30, "description": "Results per page (max 100)"}
	}
}`)

var repoReadFileSchema = json.RawMessage(`{
	"type": "object",
	"properties": {
		"repo": {"type": "string", "description": "Repository in owner/repo format"},
		"path": {"type": "string", "description": "File path within the repository"},
		"ref":  {"type": "string", "default": "main", "description": "Git ref (branch, tag, or SHA)"}
	},
	"required": ["repo", "path"]
}`)

var repoWriteFileSchema = json.RawMessage(`{
	"type": "object",
	"properties": {
		"repo":    {"type": "string", "description": "Repository in owner/repo format"},
		"path":    {"type": "string", "description": "File path within the repository"},
		"content": {"type": "string", "description": "File content (text)"},
		"message": {"type": "string", "description": "Commit message"},
		"branch":  {"type": "string", "description": "Target branch (optional, defaults to repo default)"},
		"sha":     {"type": "string", "description": "SHA of existing file (required for updates, omit for new files)"}
	},
	"required": ["repo", "path", "content", "message"]
}`)

var repoCreateBranchSchema = json.RawMessage(`{
	"type": "object",
	"properties": {
		"repo":        {"type": "string", "description": "Repository in owner/repo format"},
		"branch_name": {"type": "string", "description": "Name for the new branch"},
		"from_ref":    {"type": "string", "default": "main", "description": "Source branch or ref to branch from"}
	},
	"required": ["repo", "branch_name"]
}`)

var repoCreatePRSchema = json.RawMessage(`{
	"type": "object",
	"properties": {
		"repo":  {"type": "string", "description": "Repository in owner/repo format"},
		"title": {"type": "string", "description": "Pull request title"},
		"body":  {"type": "string", "description": "Pull request description"},
		"head":  {"type": "string", "description": "Branch containing changes"},
		"base":  {"type": "string", "default": "main", "description": "Branch to merge into"}
	},
	"required": ["repo", "title", "head"]
}`)

var repoListBranchesSchema = json.RawMessage(`{
	"type": "object",
	"properties": {
		"repo": {"type": "string", "description": "Repository in owner/repo format"}
	},
	"required": ["repo"]
}`)

var projectLinkRepoSchema = json.RawMessage(`{
	"type": "object",
	"properties": {
		"project_id":      {"type": "string", "format": "uuid", "description": "Orchestra project UUID"},
		"repo_full_name":  {"type": "string", "description": "GitHub repo full name (owner/repo)"},
		"default_branch":  {"type": "string", "default": "main", "description": "Default branch name"}
	},
	"required": ["project_id", "repo_full_name"]
}`)

var generateClaudeMDSchema = json.RawMessage(`{
	"type": "object",
	"properties": {
		"project_id": {"type": "string", "format": "uuid", "description": "Orchestra project UUID"},
		"push_to_repo": {"type": "boolean", "default": false, "description": "Push generated CLAUDE.md to linked repo"}
	},
	"required": ["project_id"]
}`)

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

// RegisterGitHubTools registers all GitHub integration MCP tools.
func RegisterGitHubTools(registry *mcp.ToolRegistry, dbClient *db.Client) {
	registry.Register("repo_list", "List the authenticated user's GitHub repositories", repoListSchema, makeRepoList(dbClient))
	registry.Register("repo_read_file", "Read a file from a GitHub repository", repoReadFileSchema, makeRepoReadFile(dbClient))
	registry.Register("repo_write_file", "Create or update a file in a GitHub repository", repoWriteFileSchema, makeRepoWriteFile(dbClient))
	registry.Register("repo_create_branch", "Create a new branch in a GitHub repository", repoCreateBranchSchema, makeRepoCreateBranch(dbClient))
	registry.Register("repo_create_pr", "Create a pull request in a GitHub repository", repoCreatePRSchema, makeRepoCreatePR(dbClient))
	registry.Register("repo_list_branches", "List branches in a GitHub repository", repoListBranchesSchema, makeRepoListBranches(dbClient))
	registry.Register("project_link_repo", "Link a GitHub repository to an Orchestra project", projectLinkRepoSchema, makeProjectLinkRepo(dbClient))
	registry.Register("generate_claude_md", "Generate a CLAUDE.md file from Orchestra project context", generateClaudeMDSchema, makeGenerateClaudeMD(dbClient))
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// decryptToken decrypts an AES-256-GCM encrypted token.
// The encrypted value is expected to be base64-encoded with the nonce (12 bytes)
// prepended to the ciphertext: base64(nonce + ciphertext).
func decryptToken(encrypted string, key string) (string, error) {
	cipherData, err := base64.StdEncoding.DecodeString(encrypted)
	if err != nil {
		return "", fmt.Errorf("base64 decode: %w", err)
	}

	block, err := aes.NewCipher([]byte(key))
	if err != nil {
		return "", fmt.Errorf("create cipher: %w", err)
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", fmt.Errorf("create GCM: %w", err)
	}

	nonceSize := gcm.NonceSize() // 12 bytes for standard GCM
	if len(cipherData) < nonceSize {
		return "", fmt.Errorf("ciphertext too short (got %d bytes, need at least %d for nonce)", len(cipherData), nonceSize)
	}

	nonce := cipherData[:nonceSize]
	ciphertext := cipherData[nonceSize:]

	plaintext, err := gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return "", fmt.Errorf("decrypt: %w", err)
	}

	return string(plaintext), nil
}

// getGitHubClient fetches the user's GitHub access token from the github_connections
// table, decrypts it if GITHUB_ENCRYPTION_KEY is set, and returns an authenticated
// GitHub API client.
func getGitHubClient(ctx context.Context, dbClient *db.Client, userID string) (*github.Client, error) {
	q := url.Values{}
	q.Set("user_id", "eq."+userID)
	q.Set("select", "access_token_encrypted")
	q.Set("limit", "1")

	data, err := dbClient.Get(ctx, "github_connections", q.Encode())
	if err != nil {
		return nil, fmt.Errorf("query github_connections: %w", err)
	}

	var rows []struct {
		AccessTokenEncrypted string `json:"access_token_encrypted"`
	}
	if err := json.Unmarshal(data, &rows); err != nil {
		return nil, fmt.Errorf("decode github_connections: %w", err)
	}
	if len(rows) == 0 || rows[0].AccessTokenEncrypted == "" {
		return nil, fmt.Errorf("no GitHub connection found — please connect GitHub first")
	}

	token := rows[0].AccessTokenEncrypted

	// Decrypt the token if GITHUB_ENCRYPTION_KEY is set.
	// If not set, use the token as-is (for dev/testing with plaintext tokens).
	encryptionKey := os.Getenv("GITHUB_ENCRYPTION_KEY")
	if encryptionKey != "" {
		decrypted, err := decryptToken(token, encryptionKey)
		if err != nil {
			return nil, fmt.Errorf("decrypt GitHub token: %w", err)
		}
		token = decrypted
	} else {
		slog.Warn("GITHUB_ENCRYPTION_KEY not set — using token as-is (plaintext mode)")
	}

	return github.NewClient(token), nil
}

// splitRepo splits "owner/repo" into owner and repo parts.
func splitRepo(fullName string) (owner, repo string, err error) {
	parts := strings.SplitN(fullName, "/", 2)
	if len(parts) != 2 || parts[0] == "" || parts[1] == "" {
		return "", "", fmt.Errorf("invalid repo format %q — expected owner/repo", fullName)
	}
	return parts[0], parts[1], nil
}

// requireAuth extracts and validates user context, returning an error result if absent.
func requireAuth(ctx context.Context) (*auth.UserContext, *mcp.ToolResult) {
	uc := auth.UserContextFromContext(ctx)
	if uc == nil {
		return nil, mcp.ErrorResult("authentication required")
	}
	return uc, nil
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

func makeRepoList(dbClient *db.Client) mcp.ToolHandler {
	return func(ctx context.Context, params json.RawMessage) (*mcp.ToolResult, error) {
		var input struct {
			Page    int `json:"page"`
			PerPage int `json:"per_page"`
		}
		if err := json.Unmarshal(params, &input); err != nil {
			return mcp.ErrorResult("invalid params: " + err.Error()), nil
		}

		uc, errResult := requireAuth(ctx)
		if errResult != nil {
			return errResult, nil
		}

		ghClient, err := getGitHubClient(ctx, dbClient, uc.UserID)
		if err != nil {
			return mcp.ErrorResult(err.Error()), nil
		}

		page := input.Page
		if page < 1 {
			page = 1
		}
		perPage := input.PerPage
		if perPage < 1 {
			perPage = 30
		}

		repos, err := ghClient.ListRepos(ctx, page, perPage)
		if err != nil {
			return mcp.ErrorResult("failed to list repos: " + err.Error()), nil
		}

		data, err := json.MarshalIndent(repos, "", "  ")
		if err != nil {
			return mcp.ErrorResult("failed to marshal repos: " + err.Error()), nil
		}
		return mcp.TextResult(string(data)), nil
	}
}

func makeRepoReadFile(dbClient *db.Client) mcp.ToolHandler {
	return func(ctx context.Context, params json.RawMessage) (*mcp.ToolResult, error) {
		var input struct {
			Repo string `json:"repo"`
			Path string `json:"path"`
			Ref  string `json:"ref"`
		}
		if err := json.Unmarshal(params, &input); err != nil {
			return mcp.ErrorResult("invalid params: " + err.Error()), nil
		}
		if input.Repo == "" || input.Path == "" {
			return mcp.ErrorResult("repo and path are required"), nil
		}

		uc, errResult := requireAuth(ctx)
		if errResult != nil {
			return errResult, nil
		}

		ghClient, err := getGitHubClient(ctx, dbClient, uc.UserID)
		if err != nil {
			return mcp.ErrorResult(err.Error()), nil
		}

		owner, repo, err := splitRepo(input.Repo)
		if err != nil {
			return mcp.ErrorResult(err.Error()), nil
		}

		ref := input.Ref
		if ref == "" {
			ref = "main"
		}

		file, err := ghClient.GetFile(ctx, owner, repo, input.Path, ref)
		if err != nil {
			return mcp.ErrorResult("failed to read file: " + err.Error()), nil
		}

		data, err := json.MarshalIndent(file, "", "  ")
		if err != nil {
			return mcp.ErrorResult("failed to marshal file: " + err.Error()), nil
		}
		return mcp.TextResult(string(data)), nil
	}
}

func makeRepoWriteFile(dbClient *db.Client) mcp.ToolHandler {
	return func(ctx context.Context, params json.RawMessage) (*mcp.ToolResult, error) {
		var input struct {
			Repo    string `json:"repo"`
			Path    string `json:"path"`
			Content string `json:"content"`
			Message string `json:"message"`
			Branch  string `json:"branch"`
			SHA     string `json:"sha"`
		}
		if err := json.Unmarshal(params, &input); err != nil {
			return mcp.ErrorResult("invalid params: " + err.Error()), nil
		}
		if input.Repo == "" || input.Path == "" || input.Content == "" || input.Message == "" {
			return mcp.ErrorResult("repo, path, content, and message are required"), nil
		}

		uc, errResult := requireAuth(ctx)
		if errResult != nil {
			return errResult, nil
		}

		ghClient, err := getGitHubClient(ctx, dbClient, uc.UserID)
		if err != nil {
			return mcp.ErrorResult(err.Error()), nil
		}

		owner, repo, err := splitRepo(input.Repo)
		if err != nil {
			return mcp.ErrorResult(err.Error()), nil
		}

		if err := ghClient.CreateOrUpdateFile(ctx, owner, repo, input.Path, input.Message, []byte(input.Content), input.SHA, input.Branch); err != nil {
			return mcp.ErrorResult("failed to write file: " + err.Error()), nil
		}

		return mcp.TextResult(fmt.Sprintf("Successfully wrote %s to %s", input.Path, input.Repo)), nil
	}
}

func makeRepoCreateBranch(dbClient *db.Client) mcp.ToolHandler {
	return func(ctx context.Context, params json.RawMessage) (*mcp.ToolResult, error) {
		var input struct {
			Repo       string `json:"repo"`
			BranchName string `json:"branch_name"`
			FromRef    string `json:"from_ref"`
		}
		if err := json.Unmarshal(params, &input); err != nil {
			return mcp.ErrorResult("invalid params: " + err.Error()), nil
		}
		if input.Repo == "" || input.BranchName == "" {
			return mcp.ErrorResult("repo and branch_name are required"), nil
		}

		uc, errResult := requireAuth(ctx)
		if errResult != nil {
			return errResult, nil
		}

		ghClient, err := getGitHubClient(ctx, dbClient, uc.UserID)
		if err != nil {
			return mcp.ErrorResult(err.Error()), nil
		}

		owner, repo, err := splitRepo(input.Repo)
		if err != nil {
			return mcp.ErrorResult(err.Error()), nil
		}

		fromRef := input.FromRef
		if fromRef == "" {
			fromRef = "main"
		}

		if err := ghClient.CreateBranch(ctx, owner, repo, input.BranchName, fromRef); err != nil {
			return mcp.ErrorResult("failed to create branch: " + err.Error()), nil
		}

		return mcp.TextResult(fmt.Sprintf("Branch %q created from %q in %s", input.BranchName, fromRef, input.Repo)), nil
	}
}

func makeRepoCreatePR(dbClient *db.Client) mcp.ToolHandler {
	return func(ctx context.Context, params json.RawMessage) (*mcp.ToolResult, error) {
		var input struct {
			Repo  string `json:"repo"`
			Title string `json:"title"`
			Body  string `json:"body"`
			Head  string `json:"head"`
			Base  string `json:"base"`
		}
		if err := json.Unmarshal(params, &input); err != nil {
			return mcp.ErrorResult("invalid params: " + err.Error()), nil
		}
		if input.Repo == "" || input.Title == "" || input.Head == "" {
			return mcp.ErrorResult("repo, title, and head are required"), nil
		}

		uc, errResult := requireAuth(ctx)
		if errResult != nil {
			return errResult, nil
		}

		ghClient, err := getGitHubClient(ctx, dbClient, uc.UserID)
		if err != nil {
			return mcp.ErrorResult(err.Error()), nil
		}

		owner, repo, err := splitRepo(input.Repo)
		if err != nil {
			return mcp.ErrorResult(err.Error()), nil
		}

		base := input.Base
		if base == "" {
			base = "main"
		}

		pr, err := ghClient.CreatePR(ctx, owner, repo, input.Title, input.Body, input.Head, base)
		if err != nil {
			return mcp.ErrorResult("failed to create PR: " + err.Error()), nil
		}

		data, err := json.MarshalIndent(pr, "", "  ")
		if err != nil {
			return mcp.ErrorResult("failed to marshal PR: " + err.Error()), nil
		}
		return mcp.TextResult(string(data)), nil
	}
}

func makeRepoListBranches(dbClient *db.Client) mcp.ToolHandler {
	return func(ctx context.Context, params json.RawMessage) (*mcp.ToolResult, error) {
		var input struct {
			Repo string `json:"repo"`
		}
		if err := json.Unmarshal(params, &input); err != nil {
			return mcp.ErrorResult("invalid params: " + err.Error()), nil
		}
		if input.Repo == "" {
			return mcp.ErrorResult("repo is required"), nil
		}

		uc, errResult := requireAuth(ctx)
		if errResult != nil {
			return errResult, nil
		}

		ghClient, err := getGitHubClient(ctx, dbClient, uc.UserID)
		if err != nil {
			return mcp.ErrorResult(err.Error()), nil
		}

		owner, repo, err := splitRepo(input.Repo)
		if err != nil {
			return mcp.ErrorResult(err.Error()), nil
		}

		branches, err := ghClient.ListBranches(ctx, owner, repo)
		if err != nil {
			return mcp.ErrorResult("failed to list branches: " + err.Error()), nil
		}

		data, err := json.MarshalIndent(branches, "", "  ")
		if err != nil {
			return mcp.ErrorResult("failed to marshal branches: " + err.Error()), nil
		}
		return mcp.TextResult(string(data)), nil
	}
}

func makeProjectLinkRepo(dbClient *db.Client) mcp.ToolHandler {
	return func(ctx context.Context, params json.RawMessage) (*mcp.ToolResult, error) {
		var input struct {
			ProjectID     string `json:"project_id"`
			RepoFullName  string `json:"repo_full_name"`
			DefaultBranch string `json:"default_branch"`
		}
		if err := json.Unmarshal(params, &input); err != nil {
			return mcp.ErrorResult("invalid params: " + err.Error()), nil
		}
		if input.ProjectID == "" || input.RepoFullName == "" {
			return mcp.ErrorResult("project_id and repo_full_name are required"), nil
		}

		uc, errResult := requireAuth(ctx)
		if errResult != nil {
			return errResult, nil
		}

		// Look up the user's github_connection to get the connection ID.
		connQ := url.Values{}
		connQ.Set("user_id", "eq."+uc.UserID)
		connQ.Set("select", "id")
		connQ.Set("limit", "1")
		connData, err := dbClient.Get(ctx, "github_connections", connQ.Encode())
		if err != nil {
			return mcp.ErrorResult("failed to query github_connections: " + err.Error()), nil
		}
		var conns []struct {
			ID string `json:"id"`
		}
		if err := json.Unmarshal(connData, &conns); err != nil || len(conns) == 0 {
			return mcp.ErrorResult("no GitHub connection found — please connect GitHub first"), nil
		}

		defaultBranch := input.DefaultBranch
		if defaultBranch == "" {
			defaultBranch = "main"
		}

		row := map[string]interface{}{
			"project_id":           input.ProjectID,
			"github_connection_id": conns[0].ID,
			"repo_full_name":       input.RepoFullName,
			"default_branch":       defaultBranch,
		}

		result, err := dbClient.Post(ctx, "project_repos", row)
		if err != nil {
			return mcp.ErrorResult("failed to link repo: " + err.Error()), nil
		}
		return mcp.TextResult(string(result)), nil
	}
}

func makeGenerateClaudeMD(dbClient *db.Client) mcp.ToolHandler {
	return func(ctx context.Context, params json.RawMessage) (*mcp.ToolResult, error) {
		var input struct {
			ProjectID  string `json:"project_id"`
			PushToRepo bool   `json:"push_to_repo"`
		}
		if err := json.Unmarshal(params, &input); err != nil {
			return mcp.ErrorResult("invalid params: " + err.Error()), nil
		}
		if input.ProjectID == "" {
			return mcp.ErrorResult("project_id is required"), nil
		}

		uc, errResult := requireAuth(ctx)
		if errResult != nil {
			return errResult, nil
		}

		// Fetch project details.
		projectQ := url.Values{}
		projectQ.Set("id", "eq."+input.ProjectID)
		projectQ.Set("organization_id", "eq."+uc.OrgID)
		projectData, err := dbClient.GetSingle(ctx, "projects", projectQ.Encode())
		if err != nil {
			return mcp.ErrorResult("failed to fetch project: " + err.Error()), nil
		}
		var project struct {
			ID          string `json:"id"`
			Name        string `json:"name"`
			Description string `json:"description"`
			Slug        string `json:"slug"`
		}
		if err := json.Unmarshal(projectData, &project); err != nil {
			return mcp.ErrorResult("failed to decode project: " + err.Error()), nil
		}

		// Fetch agents assigned to this project.
		agentsQ := url.Values{}
		agentsQ.Set("project_id", "eq."+input.ProjectID)
		agentsQ.Set("select", "name,role,description")
		agentsQ.Set("order", "name.asc")
		agentsData, err := dbClient.Get(ctx, "agents", agentsQ.Encode())
		if err != nil {
			// Non-fatal: agents table might not exist or be empty.
			agentsData = json.RawMessage("[]")
		}
		var agents []struct {
			Name        string `json:"name"`
			Role        string `json:"role"`
			Description string `json:"description"`
		}
		_ = json.Unmarshal(agentsData, &agents)

		// Fetch active tasks.
		tasksQ := url.Values{}
		tasksQ.Set("project_id", "eq."+input.ProjectID)
		tasksQ.Set("status", "in.(active,in_progress)")
		tasksQ.Set("select", "title,status,priority,assigned_to")
		tasksQ.Set("order", "priority.desc,created_at.desc")
		tasksQ.Set("limit", "20")
		tasksData, err := dbClient.Get(ctx, "tasks", tasksQ.Encode())
		if err != nil {
			tasksData = json.RawMessage("[]")
		}
		var tasks []struct {
			Title      string `json:"title"`
			Status     string `json:"status"`
			Priority   string `json:"priority"`
			AssignedTo string `json:"assigned_to"`
		}
		_ = json.Unmarshal(tasksData, &tasks)

		// Fetch recent decisions.
		decisionsQ := url.Values{}
		decisionsQ.Set("project_id", "eq."+input.ProjectID)
		decisionsQ.Set("select", "title,status,decided_at")
		decisionsQ.Set("order", "decided_at.desc")
		decisionsQ.Set("limit", "10")
		decisionsData, err := dbClient.Get(ctx, "decisions", decisionsQ.Encode())
		if err != nil {
			decisionsData = json.RawMessage("[]")
		}
		var decisions []struct {
			Title     string `json:"title"`
			Status    string `json:"status"`
			DecidedAt string `json:"decided_at"`
		}
		_ = json.Unmarshal(decisionsData, &decisions)

		// Build the CLAUDE.md content.
		var b strings.Builder
		b.WriteString("# CLAUDE.md\n\n")
		b.WriteString(fmt.Sprintf("Generated by Orchestra MCP on %s\n\n", time.Now().UTC().Format("2006-01-02 15:04 UTC")))

		b.WriteString("## Project\n\n")
		b.WriteString(fmt.Sprintf("- **Name**: %s\n", project.Name))
		if project.Description != "" {
			b.WriteString(fmt.Sprintf("- **Description**: %s\n", project.Description))
		}
		if project.Slug != "" {
			b.WriteString(fmt.Sprintf("- **Slug**: %s\n", project.Slug))
		}
		b.WriteString("\n")

		if len(agents) > 0 {
			b.WriteString("## Agents\n\n")
			b.WriteString("| Name | Role | Description |\n")
			b.WriteString("|------|------|-------------|\n")
			for _, a := range agents {
				b.WriteString(fmt.Sprintf("| %s | %s | %s |\n", a.Name, a.Role, a.Description))
			}
			b.WriteString("\n")
		}

		if len(tasks) > 0 {
			b.WriteString("## Active Tasks\n\n")
			b.WriteString("| Task | Status | Priority | Assigned To |\n")
			b.WriteString("|------|--------|----------|-------------|\n")
			for _, t := range tasks {
				b.WriteString(fmt.Sprintf("| %s | %s | %s | %s |\n", t.Title, t.Status, t.Priority, t.AssignedTo))
			}
			b.WriteString("\n")
		}

		if len(decisions) > 0 {
			b.WriteString("## Recent Decisions\n\n")
			b.WriteString("| Decision | Status | Date |\n")
			b.WriteString("|----------|--------|------|\n")
			for _, d := range decisions {
				b.WriteString(fmt.Sprintf("| %s | %s | %s |\n", d.Title, d.Status, d.DecidedAt))
			}
			b.WriteString("\n")
		}

		claudeMD := b.String()

		// Optionally push to linked repo.
		if input.PushToRepo {
			repoQ := url.Values{}
			repoQ.Set("project_id", "eq."+input.ProjectID)
			repoQ.Set("select", "repo_full_name,default_branch")
			repoQ.Set("limit", "1")
			repoData, err := dbClient.Get(ctx, "project_repos", repoQ.Encode())
			if err != nil {
				return mcp.ErrorResult("generated CLAUDE.md but failed to query linked repo: " + err.Error()), nil
			}
			var repos []struct {
				RepoFullName  string `json:"repo_full_name"`
				DefaultBranch string `json:"default_branch"`
			}
			if err := json.Unmarshal(repoData, &repos); err != nil || len(repos) == 0 {
				return mcp.ErrorResult("generated CLAUDE.md but no linked repo found — link a repo first with project_link_repo"), nil
			}

			linkedRepo := repos[0]
			owner, repo, err := splitRepo(linkedRepo.RepoFullName)
			if err != nil {
				return mcp.ErrorResult("generated CLAUDE.md but linked repo name is invalid: " + err.Error()), nil
			}

			ghClient, err := getGitHubClient(ctx, dbClient, uc.UserID)
			if err != nil {
				return mcp.ErrorResult("generated CLAUDE.md but cannot connect to GitHub: " + err.Error()), nil
			}

			// Try to get existing file SHA for update.
			branch := linkedRepo.DefaultBranch
			if branch == "" {
				branch = "main"
			}
			var existingSHA string
			existingFile, err := ghClient.GetFile(ctx, owner, repo, "CLAUDE.md", branch)
			if err == nil && existingFile != nil {
				existingSHA = existingFile.SHA
			}

			if err := ghClient.CreateOrUpdateFile(ctx, owner, repo, "CLAUDE.md", "chore: update CLAUDE.md via Orchestra MCP", []byte(claudeMD), existingSHA, branch); err != nil {
				return mcp.ErrorResult("generated CLAUDE.md but failed to push: " + err.Error()), nil
			}

			return mcp.TextResult(fmt.Sprintf("CLAUDE.md generated and pushed to %s\n\n%s", linkedRepo.RepoFullName, claudeMD)), nil
		}

		return mcp.TextResult(claudeMD), nil
	}
}
