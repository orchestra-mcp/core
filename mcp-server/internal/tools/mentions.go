package tools

import (
	"context"
	"encoding/json"
	"fmt"
	"net/url"
	"regexp"
	"strings"

	"github.com/orchestra-mcp/server/internal/db"
)

// mentionPattern matches @slug patterns in message content.
// Examples: @go-developer, @cto, @qa-engineer
var mentionPattern = regexp.MustCompile(`@([a-z][a-z0-9-]*)`)

// MentionedAgent holds info about a detected @mention.
type MentionedAgent struct {
	Slug     string `json:"slug"`
	Name     string `json:"name"`
	ID       string `json:"id"`
	Model    string `json:"model"`
	Provider string `json:"provider"`
	Role     string `json:"role"`
}

// DetectMentions scans content for @slug patterns and resolves them
// against the agents table. Returns a list of matched agents.
func DetectMentions(ctx context.Context, dbClient *db.Client, orgID string, content string) []MentionedAgent {
	matches := mentionPattern.FindAllStringSubmatch(content, -1)
	if len(matches) == 0 {
		return nil
	}

	// Deduplicate slugs
	slugSet := make(map[string]bool)
	var slugs []string
	for _, m := range matches {
		slug := m[1]
		if !slugSet[slug] {
			slugSet[slug] = true
			slugs = append(slugs, slug)
		}
	}

	// Resolve slugs against agents table
	var mentioned []MentionedAgent
	for _, slug := range slugs {
		q := url.Values{}
		q.Set("slug", "eq."+slug)
		q.Set("organization_id", "eq."+orgID)
		q.Set("status", "eq.active")
		q.Set("select", "id,name,slug,role,model,provider")
		q.Set("limit", "1")

		raw, err := dbClient.Get(ctx, "agents", q.Encode())
		if err != nil {
			continue
		}

		var agents []struct {
			ID       string `json:"id"`
			Name     string `json:"name"`
			Slug     string `json:"slug"`
			Role     string `json:"role"`
			Model    string `json:"model"`
			Provider string `json:"provider"`
		}
		if err := json.Unmarshal(raw, &agents); err != nil || len(agents) == 0 {
			continue
		}

		a := agents[0]
		mentioned = append(mentioned, MentionedAgent{
			Slug:     a.Slug,
			Name:     a.Name,
			ID:       a.ID,
			Model:    a.Model,
			Provider: a.Provider,
			Role:     a.Role,
		})
	}

	return mentioned
}

// FormatMentionsMarkdown returns a markdown section listing mentioned agents
// with their spawn commands for the orchestrator to follow up.
func FormatMentionsMarkdown(mentioned []MentionedAgent) string {
	if len(mentioned) == 0 {
		return ""
	}

	var sb strings.Builder
	sb.WriteString("\n\n## Mentioned Agents\n\n")
	sb.WriteString("| Agent | Role | Model | Action |\n")
	sb.WriteString("|-------|------|-------|--------|\n")
	for _, a := range mentioned {
		sb.WriteString(fmt.Sprintf("| **%s** (@%s) | %s | %s | `agent_spawn(agent_slug: \"%s\")` |\n",
			a.Name, a.Slug, a.Role, a.Model, a.Slug))
	}
	sb.WriteString("\n> **Orchestrator:** spawn the mentioned agents to respond to this message.\n")
	return sb.String()
}
