package tools

import (
	"context"
	"encoding/json"
	"fmt"
	"net/url"
	"strings"
	"time"

	"github.com/orchestra-mcp/server/internal/auth"
	"github.com/orchestra-mcp/server/internal/db"
	"github.com/orchestra-mcp/server/internal/mcp"
)

// ---------------------------------------------------------------------------
// JSON Schemas
// ---------------------------------------------------------------------------

var meetingCreateSchema = json.RawMessage(`{
	"type": "object",
	"properties": {
		"title":      {"type": "string", "description": "Meeting title"},
		"topic":      {"type": "string", "description": "Meeting topic or agenda"},
		"project_id": {"type": "string", "format": "uuid", "description": "Associated project ID"},
		"agent_ids":  {"type": "array", "items": {"type": "string", "format": "uuid"}, "description": "Agent UUIDs to invite to the meeting"}
	},
	"required": ["title"]
}`)

var meetingGetSchema = json.RawMessage(`{
	"type": "object",
	"properties": {
		"id": {"type": "string", "format": "uuid", "description": "Meeting UUID"}
	},
	"required": ["id"]
}`)

var meetingListSchema = json.RawMessage(`{
	"type": "object",
	"properties": {
		"status":     {"type": "string", "enum": ["pending", "active", "ended", "cancelled"], "description": "Filter by status"},
		"project_id": {"type": "string", "format": "uuid", "description": "Filter by project"},
		"limit":      {"type": "integer", "description": "Max results to return", "default": 20}
	}
}`)

var meetingUpdateSchema = json.RawMessage(`{
	"type": "object",
	"properties": {
		"id":      {"type": "string", "format": "uuid", "description": "Meeting UUID"},
		"title":   {"type": "string", "description": "Updated title"},
		"topic":   {"type": "string", "description": "Updated topic"},
		"result":  {"type": "string", "description": "Meeting result"},
		"summary": {"type": "string", "description": "Meeting summary"}
	},
	"required": ["id"]
}`)

var meetingEndSchema = json.RawMessage(`{
	"type": "object",
	"properties": {
		"id":      {"type": "string", "format": "uuid", "description": "Meeting UUID"},
		"summary": {"type": "string", "description": "Final meeting summary"}
	},
	"required": ["id"]
}`)

var meetingMessageSchema = json.RawMessage(`{
	"type": "object",
	"properties": {
		"meeting_id":   {"type": "string", "format": "uuid", "description": "Meeting UUID"},
		"content":      {"type": "string", "description": "Message content"},
		"author_name":  {"type": "string", "description": "Name of the message author"},
		"author_type":  {"type": "string", "enum": ["agent", "user", "system"], "description": "Type of author (default: user)"}
	},
	"required": ["meeting_id", "content"]
}`)

var meetingListMessagesSchema = json.RawMessage(`{
	"type": "object",
	"properties": {
		"meeting_id": {"type": "string", "format": "uuid", "description": "Meeting UUID"},
		"limit":      {"type": "integer", "description": "Max messages to return", "default": 50}
	},
	"required": ["meeting_id"]
}`)

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

// RegisterMeetingTools registers all meeting-related MCP tools.
func RegisterMeetingTools(registry *mcp.ToolRegistry, dbClient *db.Client) {
	registry.Register("meeting_create", "Create a new meeting and optionally invite agents", meetingCreateSchema, makeMeetingCreate(dbClient))
	registry.Register("meeting_get", "Get a meeting by ID with its agents", meetingGetSchema, makeMeetingGet(dbClient))
	registry.Register("meeting_list", "List meetings with optional filters", meetingListSchema, makeMeetingList(dbClient))
	registry.Register("meeting_update", "Update meeting details", meetingUpdateSchema, makeMeetingUpdate(dbClient))
	registry.Register("meeting_end", "End a meeting and set its summary", meetingEndSchema, makeMeetingEnd(dbClient))
	registry.Register("meeting_message", "Post a message to a meeting conversation thread", meetingMessageSchema, makeMeetingMessage(dbClient))
	registry.Register("meeting_list_messages", "List messages in a meeting conversation thread", meetingListMessagesSchema, makeMeetingListMessages(dbClient))
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

func makeMeetingCreate(dbClient *db.Client) mcp.ToolHandler {
	return func(ctx context.Context, params json.RawMessage) (*mcp.ToolResult, error) {
		var input struct {
			Title     string   `json:"title"`
			Topic     string   `json:"topic"`
			ProjectID string   `json:"project_id"`
			AgentIDs  []string `json:"agent_ids"`
		}
		if err := json.Unmarshal(params, &input); err != nil {
			return errorResult("invalid params: " + err.Error()), nil
		}
		if input.Title == "" {
			return errorResult("title is required"), nil
		}

		userCtx, ok := auth.FromContext(ctx)
		if !ok {
			return errorResult("authentication required"), nil
		}

		now := time.Now().UTC().Format(time.RFC3339)
		row := map[string]interface{}{
			"organization_id": userCtx.OrgID,
			"created_by":      userCtx.UserID,
			"title":           input.Title,
			"status":          "active",
			"started_at":      now,
			"created_at":      now,
		}
		if input.Topic != "" {
			row["topic"] = input.Topic
		}
		if input.ProjectID != "" {
			row["project_id"] = input.ProjectID
		}

		meetingRaw, err := dbClient.Post(ctx, "meetings", row)
		if err != nil {
			return errorResult("failed to create meeting: " + err.Error()), nil
		}

		// Parse the created meeting to get its ID.
		var created []struct {
			ID string `json:"id"`
		}
		if err := json.Unmarshal(meetingRaw, &created); err != nil || len(created) == 0 {
			return errorResult("failed to parse created meeting"), nil
		}
		meetingID := created[0].ID

		// If no agent_ids provided, auto-invite ALL active agents in the org.
		agentIDs := input.AgentIDs
		type agentInfo struct {
			ID   string `json:"id"`
			Name string `json:"name"`
			Role string `json:"role"`
			Slug string `json:"slug"`
		}
		var agents []agentInfo

		if len(agentIDs) == 0 {
			agentsQ := fmt.Sprintf("organization_id=eq.%s&status=eq.active&select=id,name,role,slug&order=name.asc", userCtx.OrgID)
			agentsRaw, err := dbClient.Get(ctx, "agents", agentsQ)
			if err == nil {
				if err := json.Unmarshal(agentsRaw, &agents); err == nil {
					agentIDs = make([]string, len(agents))
					for i, a := range agents {
						agentIDs[i] = a.ID
					}
				}
			}
		} else {
			// Fetch agent info for the provided IDs to build the roster.
			for _, aid := range agentIDs {
				infoQ := fmt.Sprintf("id=eq.%s&select=id,name,role,slug", aid)
				infoRaw, err := dbClient.Get(ctx, "agents", infoQ)
				if err == nil {
					var fetched []agentInfo
					if err := json.Unmarshal(infoRaw, &fetched); err == nil && len(fetched) > 0 {
						agents = append(agents, fetched[0])
					}
				}
			}
		}

		// Insert meeting_agents pivot rows.
		addedCount := 0
		for _, agentID := range agentIDs {
			pivot := map[string]interface{}{
				"meeting_id": meetingID,
				"agent_id":   agentID,
			}
			// Best effort — don't fail the whole meeting if one agent link fails.
			if _, err := dbClient.Post(ctx, "meeting_agents", pivot); err == nil {
				addedCount++
			}
		}

		// Build participant table.
		var participantSection string
		if len(agents) > 0 {
			pRows := make([][]string, 0, len(agents))
			for _, a := range agents {
				name := a.Name
				if name == "" {
					name = a.Slug
				}
				role := a.Role
				if role == "" {
					role = "-"
				}
				pRows = append(pRows, []string{name, role})
			}
			participantSection = fmt.Sprintf("### Participants (%d)\n\n%s", addedCount, mdTable([]string{"Agent", "Role"}, pRows))
		} else {
			participantSection = "### Participants\n\nNo agents added to this meeting.\n"
		}

		var bodyParts []string
		bodyParts = append(bodyParts, fmt.Sprintf("# Meeting: %s\n", input.Title))
		if input.Topic != "" {
			bodyParts = append(bodyParts, fmt.Sprintf("**Topic:** %s\n", input.Topic))
		}
		bodyParts = append(bodyParts, participantSection)

		return mdResult(MarkdownResponse{
			Frontmatter: map[string]interface{}{
				"id":     meetingID,
				"type":   "meeting",
				"status": "active",
				"export": fmt.Sprintf("meetings/%s.md", meetingID),
			},
			Body: strings.Join(bodyParts, "\n"),
			NextSteps: []NextStep{
				{Label: "Post a message", Command: fmt.Sprintf(`meeting_message(meeting_id: "%s", content: "...")`, meetingID)},
				{Label: "Log a decision", Command: fmt.Sprintf(`decision_log(title: "...", decision: "...", meeting_id: "%s")`, meetingID)},
				{Label: "End the meeting", Command: fmt.Sprintf(`meeting_end(id: "%s", summary: "...")`, meetingID)},
			},
		}), nil
	}
}

func makeMeetingGet(dbClient *db.Client) mcp.ToolHandler {
	return func(ctx context.Context, params json.RawMessage) (*mcp.ToolResult, error) {
		var input struct {
			ID string `json:"id"`
		}
		if err := json.Unmarshal(params, &input); err != nil {
			return errorResult("invalid params: " + err.Error()), nil
		}
		if input.ID == "" {
			return errorResult("id is required"), nil
		}

		userCtx, ok := auth.FromContext(ctx)
		if !ok {
			return errorResult("authentication required"), nil
		}

		// Fetch meeting with embedded meeting_agents->agents via PostgREST.
		q := url.Values{}
		q.Set("id", "eq."+input.ID)
		q.Set("organization_id", "eq."+userCtx.OrgID)
		q.Set("select", "*, meeting_agents(id, agent_id, agents(id, name, slug, role))")

		meetingRaw, err := dbClient.GetSingle(ctx, "meetings", q.Encode())
		if err != nil {
			return errorResult("failed to get meeting: " + err.Error()), nil
		}
		return jsonResult(map[string]json.RawMessage{"meeting": meetingRaw})
	}
}

func makeMeetingList(dbClient *db.Client) mcp.ToolHandler {
	return func(ctx context.Context, params json.RawMessage) (*mcp.ToolResult, error) {
		var input struct {
			Status    string `json:"status"`
			ProjectID string `json:"project_id"`
			Limit     int    `json:"limit"`
		}
		if err := json.Unmarshal(params, &input); err != nil {
			return errorResult("invalid params: " + err.Error()), nil
		}

		userCtx, ok := auth.FromContext(ctx)
		if !ok {
			return errorResult("authentication required"), nil
		}

		if input.Limit <= 0 {
			input.Limit = 20
		}

		q := fmt.Sprintf("organization_id=eq.%s&order=created_at.desc&limit=%d", userCtx.OrgID, input.Limit)
		if input.Status != "" {
			q += "&status=eq." + input.Status
		}
		if input.ProjectID != "" {
			q += "&project_id=eq." + input.ProjectID
		}

		result, err := dbClient.Get(ctx, "meetings", q)
		if err != nil {
			return errorResult("failed to list meetings: " + err.Error()), nil
		}
		return jsonResult(map[string]json.RawMessage{"meetings": result})
	}
}

func makeMeetingUpdate(dbClient *db.Client) mcp.ToolHandler {
	return func(ctx context.Context, params json.RawMessage) (*mcp.ToolResult, error) {
		var input struct {
			ID      string `json:"id"`
			Title   string `json:"title"`
			Topic   string `json:"topic"`
			Result  string `json:"result"`
			Summary string `json:"summary"`
		}
		if err := json.Unmarshal(params, &input); err != nil {
			return errorResult("invalid params: " + err.Error()), nil
		}
		if input.ID == "" {
			return errorResult("id is required"), nil
		}

		userCtx, ok := auth.FromContext(ctx)
		if !ok {
			return errorResult("authentication required"), nil
		}

		patch := map[string]interface{}{}
		if input.Title != "" {
			patch["title"] = input.Title
		}
		if input.Topic != "" {
			patch["topic"] = input.Topic
		}
		if input.Result != "" {
			patch["result"] = input.Result
		}
		if input.Summary != "" {
			patch["summary"] = input.Summary
		}
		if len(patch) == 0 {
			return errorResult("at least one field to update is required"), nil
		}

		q := fmt.Sprintf("id=eq.%s&organization_id=eq.%s", input.ID, userCtx.OrgID)
		result, err := dbClient.Patch(ctx, "meetings", q, patch)
		if err != nil {
			return errorResult("failed to update meeting: " + err.Error()), nil
		}
		return jsonResult(map[string]json.RawMessage{"meeting": result})
	}
}

func makeMeetingEnd(dbClient *db.Client) mcp.ToolHandler {
	return func(ctx context.Context, params json.RawMessage) (*mcp.ToolResult, error) {
		var input struct {
			ID      string `json:"id"`
			Summary string `json:"summary"`
		}
		if err := json.Unmarshal(params, &input); err != nil {
			return errorResult("invalid params: " + err.Error()), nil
		}
		if input.ID == "" {
			return errorResult("id is required"), nil
		}

		userCtx, ok := auth.FromContext(ctx)
		if !ok {
			return errorResult("authentication required"), nil
		}

		// Fetch meeting_agents for participant count.
		agentsQ := fmt.Sprintf("meeting_id=eq.%s&select=agent_id,agents(name,role)", input.ID)
		agentsRaw, _ := dbClient.Get(ctx, "meeting_agents", agentsQ)
		var meetingAgents []struct {
			AgentID string `json:"agent_id"`
			Agents  struct {
				Name string `json:"name"`
				Role string `json:"role"`
			} `json:"agents"`
		}
		_ = json.Unmarshal(agentsRaw, &meetingAgents)

		// Fetch all meeting messages.
		msgsQ := fmt.Sprintf("meeting_id=eq.%s&order=created_at.asc&select=author_name,author_type,content,created_at", input.ID)
		msgsRaw, _ := dbClient.Get(ctx, "meeting_messages", msgsQ)
		var messages []struct {
			AuthorName string `json:"author_name"`
			AuthorType string `json:"author_type"`
			Content    string `json:"content"`
			CreatedAt  string `json:"created_at"`
		}
		_ = json.Unmarshal(msgsRaw, &messages)

		// Fetch decisions linked to this meeting.
		decisionsQ := fmt.Sprintf("meeting_id=eq.%s&select=title,decision&order=created_at.asc", input.ID)
		decisionsRaw, _ := dbClient.Get(ctx, "decisions", decisionsQ)
		var decisions []struct {
			Title    string `json:"title"`
			Decision string `json:"decision"`
		}
		_ = json.Unmarshal(decisionsRaw, &decisions)

		// Build markdown summary.
		var md strings.Builder
		md.WriteString("## Meeting Summary\n\n")
		md.WriteString(fmt.Sprintf("- **Participants**: %d agents\n", len(meetingAgents)))
		md.WriteString(fmt.Sprintf("- **Messages**: %d\n", len(messages)))
		md.WriteString(fmt.Sprintf("- **Decisions**: %d\n\n", len(decisions)))

		if len(decisions) > 0 {
			md.WriteString("### Decisions\n\n")
			for i, d := range decisions {
				md.WriteString(fmt.Sprintf("%d. **%s** — %s\n", i+1, d.Title, d.Decision))
			}
			md.WriteString("\n")
		}

		if len(messages) > 0 {
			md.WriteString("### Conversation Highlights\n\n")
			// Show up to 10 key messages as highlights.
			limit := len(messages)
			if limit > 10 {
				limit = 10
			}
			for _, m := range messages[:limit] {
				author := m.AuthorName
				if author == "" {
					author = m.AuthorType
				}
				// Truncate long messages for the summary.
				content := m.Content
				if len(content) > 200 {
					content = content[:200] + "..."
				}
				md.WriteString(fmt.Sprintf("- **%s**: %s\n", author, content))
			}
			if len(messages) > 10 {
				md.WriteString(fmt.Sprintf("\n*... and %d more messages*\n", len(messages)-10))
			}
		}

		// Use auto-generated summary unless user provided one.
		summary := md.String()
		if input.Summary != "" {
			summary = input.Summary
		}

		patch := map[string]interface{}{
			"status":   "ended",
			"ended_at": time.Now().UTC().Format(time.RFC3339),
			"summary":  summary,
		}

		q := fmt.Sprintf("id=eq.%s&organization_id=eq.%s", input.ID, userCtx.OrgID)
		_, err := dbClient.Patch(ctx, "meetings", q, patch)
		if err != nil {
			return errorResult("failed to end meeting: " + err.Error()), nil
		}
		return textResult(summary), nil
	}
}

func makeMeetingMessage(dbClient *db.Client) mcp.ToolHandler {
	return func(ctx context.Context, params json.RawMessage) (*mcp.ToolResult, error) {
		var input struct {
			MeetingID  string `json:"meeting_id"`
			Content    string `json:"content"`
			AuthorName string `json:"author_name"`
			AuthorType string `json:"author_type"`
		}
		if err := json.Unmarshal(params, &input); err != nil {
			return errorResult("invalid params: " + err.Error()), nil
		}
		if input.MeetingID == "" {
			return errorResult("meeting_id is required"), nil
		}
		if input.Content == "" {
			return errorResult("content is required"), nil
		}

		userCtx, ok := auth.FromContext(ctx)
		if !ok {
			return errorResult("authentication required"), nil
		}

		authorType := input.AuthorType
		if authorType == "" {
			authorType = "user"
		}

		row := map[string]interface{}{
			"organization_id": userCtx.OrgID,
			"meeting_id":      input.MeetingID,
			"author_type":     authorType,
			"content":         input.Content,
		}
		if input.AuthorName != "" {
			row["author_name"] = input.AuthorName
		}
		// Set author_id for user messages.
		if authorType == "user" {
			row["author_id"] = userCtx.UserID
		}

		msgRaw, err := dbClient.Post(ctx, "meeting_messages", row)
		if err != nil {
			return errorResult("failed to post message: " + err.Error()), nil
		}

		// Parse created message for confirmation.
		var created []struct {
			ID        string `json:"id"`
			CreatedAt string `json:"created_at"`
		}
		ts := "now"
		if err := json.Unmarshal(msgRaw, &created); err == nil && len(created) > 0 {
			if t, err := time.Parse(time.RFC3339Nano, created[0].CreatedAt); err == nil {
				ts = t.Format("3:04 PM")
			}
		}

		author := input.AuthorName
		if author == "" {
			author = authorType
		}

		md := fmt.Sprintf("**%s** posted at %s\n\n%s", author, ts, input.Content)

		// Detect @mentions and append routing instructions
		mentioned := DetectMentions(ctx, dbClient, userCtx.OrgID, input.Content)
		if len(mentioned) > 0 {
			md += FormatMentionsMarkdown(mentioned)
		}

		return textResult(md), nil
	}
}

func makeMeetingListMessages(dbClient *db.Client) mcp.ToolHandler {
	return func(ctx context.Context, params json.RawMessage) (*mcp.ToolResult, error) {
		var input struct {
			MeetingID string `json:"meeting_id"`
			Limit     int    `json:"limit"`
		}
		if err := json.Unmarshal(params, &input); err != nil {
			return errorResult("invalid params: " + err.Error()), nil
		}
		if input.MeetingID == "" {
			return errorResult("meeting_id is required"), nil
		}
		if input.Limit <= 0 {
			input.Limit = 50
		}

		_, ok := auth.FromContext(ctx)
		if !ok {
			return errorResult("authentication required"), nil
		}

		q := fmt.Sprintf("meeting_id=eq.%s&order=created_at.asc&limit=%d&select=id,author_name,author_type,content,created_at", input.MeetingID, input.Limit)
		msgsRaw, err := dbClient.Get(ctx, "meeting_messages", q)
		if err != nil {
			return errorResult("failed to list messages: " + err.Error()), nil
		}

		var messages []struct {
			ID         string `json:"id"`
			AuthorName string `json:"author_name"`
			AuthorType string `json:"author_type"`
			Content    string `json:"content"`
			CreatedAt  string `json:"created_at"`
		}
		if err := json.Unmarshal(msgsRaw, &messages); err != nil {
			return errorResult("failed to parse messages: " + err.Error()), nil
		}

		if len(messages) == 0 {
			return textResult("*No messages in this meeting yet.*"), nil
		}

		var md strings.Builder
		md.WriteString(fmt.Sprintf("## Meeting Thread (%d messages)\n\n", len(messages)))

		for _, m := range messages {
			author := m.AuthorName
			if author == "" {
				// Capitalize author_type (e.g. "user" -> "User").
				at := m.AuthorType
				if len(at) > 0 {
					author = strings.ToUpper(at[:1]) + at[1:]
				} else {
					author = "Unknown"
				}
			}
			ts := m.CreatedAt
			if t, err := time.Parse(time.RFC3339Nano, m.CreatedAt); err == nil {
				ts = t.Format("3:04 PM")
			}
			md.WriteString(fmt.Sprintf("### %s — %s\n%s\n\n", author, ts, m.Content))
		}

		return textResult(md.String()), nil
	}
}
