package tools

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/orchestra-mcp/server/internal/auth"
	"github.com/orchestra-mcp/server/internal/mcp"
	"github.com/orchestra-mcp/server/internal/notifications"
)

// ---------------------------------------------------------------------------
// JSON Schemas
// ---------------------------------------------------------------------------

var slackNotifySchema = json.RawMessage(`{
	"type": "object",
	"properties": {
		"channel": {
			"type": "string",
			"description": "Slack channel name or ID to post in (e.g. #general or C01234ABCDE)"
		},
		"message": {
			"type": "string",
			"description": "Message text to send (supports Slack mrkdwn formatting)"
		},
		"mention_user": {
			"type": "string",
			"description": "Optional: email address of a user to mention in the message"
		}
	},
	"required": ["channel", "message"]
}`)

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

// RegisterSlackTools registers all Slack notification MCP tools.
func RegisterSlackTools(registry *mcp.ToolRegistry, slack *notifications.SlackClient) {
	registry.Register(
		"slack_notify",
		"Send a Slack notification to a channel, optionally mentioning a user by email",
		slackNotifySchema,
		makeSlackNotify(slack),
	)
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

func makeSlackNotify(slack *notifications.SlackClient) mcp.ToolHandler {
	return func(ctx context.Context, params json.RawMessage) (*mcp.ToolResult, error) {
		var input struct {
			Channel     string `json:"channel"`
			Message     string `json:"message"`
			MentionUser string `json:"mention_user"`
		}
		if err := json.Unmarshal(params, &input); err != nil {
			return errorResult("invalid params: " + err.Error()), nil
		}
		if input.Channel == "" || input.Message == "" {
			return errorResult("channel and message are required"), nil
		}

		// Verify auth context is present.
		uc := auth.UserContextFromContext(ctx)
		if uc == nil {
			return errorResult("authentication required"), nil
		}

		if !slack.Enabled() {
			return errorResult("Slack integration is not configured — set SLACK_BOT_TOKEN"), nil
		}

		text := input.Message

		// If a user email is provided, look up and mention them.
		if input.MentionUser != "" {
			text = fmt.Sprintf("cc <mailto:%s|%s> — %s", input.MentionUser, input.MentionUser, text)
		}

		if err := slack.SendMessage(ctx, input.Channel, text); err != nil {
			return errorResult("failed to send Slack message: " + err.Error()), nil
		}

		return textResult(fmt.Sprintf("Message sent to %s", input.Channel)), nil
	}
}
