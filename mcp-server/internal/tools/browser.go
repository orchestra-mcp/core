package tools

import (
	"context"
	"encoding/json"
	"fmt"
	"os/exec"

	"github.com/orchestra-mcp/server/internal/mcp"
	"github.com/orchestra-mcp/server/internal/twin"
)

// ---------------------------------------------------------------------------
// JSON Schemas
// ---------------------------------------------------------------------------

var browserSearchSchema = json.RawMessage(`{
	"type": "object",
	"properties": {
		"query": {
			"type": "string",
			"description": "Search query to submit to Google"
		}
	},
	"required": ["query"]
}`)

var browserOpenSchema = json.RawMessage(`{
	"type": "object",
	"properties": {
		"url": {
			"type": "string",
			"description": "URL to open in a new background tab"
		}
	},
	"required": ["url"]
}`)

var browserReadSchema = json.RawMessage(`{
	"type": "object",
	"properties": {
		"account": {
			"type": "string",
			"description": "Registered account name to read (see browser_accounts)"
		}
	},
	"required": ["account"]
}`)

var browserClickSchema = json.RawMessage(`{
	"type": "object",
	"properties": {
		"tab_id": {
			"type": "integer",
			"description": "Chrome tab ID containing the element to click"
		},
		"selector": {
			"type": "string",
			"description": "CSS selector of the element to click"
		}
	},
	"required": ["tab_id", "selector"]
}`)

var browserFillSchema = json.RawMessage(`{
	"type": "object",
	"properties": {
		"tab_id": {
			"type": "integer",
			"description": "Chrome tab ID containing the input field"
		},
		"selector": {
			"type": "string",
			"description": "CSS selector of the input field to fill"
		},
		"value": {
			"type": "string",
			"description": "Value to enter into the input field"
		}
	},
	"required": ["tab_id", "selector", "value"]
}`)

var browserScreenshotSchema = json.RawMessage(`{
	"type": "object",
	"properties": {
		"tab_id": {
			"type": "integer",
			"description": "Chrome tab ID to capture"
		}
	},
	"required": ["tab_id"]
}`)

var browserTabsSchema = json.RawMessage(`{
	"type": "object",
	"properties": {}
}`)

var browserCloseSchema = json.RawMessage(`{
	"type": "object",
	"properties": {
		"tab_id": {
			"type": "integer",
			"description": "Chrome tab ID to close"
		}
	},
	"required": ["tab_id"]
}`)

var browserAccountsSchema = json.RawMessage(`{
	"type": "object",
	"properties": {}
}`)

var browserRegisterSchema = json.RawMessage(`{
	"type": "object",
	"properties": {
		"name": {
			"type": "string",
			"description": "Unique account name (e.g. 'work-gmail')"
		},
		"platform": {
			"type": "string",
			"description": "Platform type: gmail, github, slack, linear, jira, whatsapp, twitter",
			"enum": ["gmail", "github", "slack", "linear", "jira", "whatsapp", "twitter"]
		},
		"url": {
			"type": "string",
			"description": "URL to open when reading this account"
		}
	},
	"required": ["name", "platform", "url"]
}`)

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

// RegisterBrowserTools registers all 10 browser_* MCP tools backed by the
// Twin Bridge bidirectional command system.
func RegisterBrowserTools(registry *mcp.ToolRegistry) {
	registry.Register(
		"browser_search",
		"Search Google from the user's browser and return the top 10 results (title, url, snippet). "+
			"Requires Chrome extension to be connected.",
		browserSearchSchema,
		makeBrowserHandler("browser_search", false),
	)

	registry.Register(
		"browser_open",
		"Open a URL in a background browser tab. Returns tab_id, page title, first 5KB of text content, "+
			"and up to 20 links. Tab stays open for follow-up actions.",
		browserOpenSchema,
		makeBrowserHandler("browser_open", false),
	)

	registry.Register(
		"browser_read",
		"Read structured data from a registered account (gmail, github, slack, linear, jira, whatsapp, twitter). "+
			"Opens the account URL, runs a platform-specific extractor, then closes the tab.",
		browserReadSchema,
		makeBrowserHandler("browser_read", false),
	)

	registry.Register(
		"browser_click",
		"Click an element in an open browser tab using a CSS selector. "+
			"Blocked on password, payment, and destructive UI elements. "+
			"Requires user confirmation via macOS dialog.",
		browserClickSchema,
		makeBrowserHandler("browser_click", true),
	)

	registry.Register(
		"browser_fill",
		"Fill an input field in an open browser tab. Password fields are always blocked. "+
			"Requires user confirmation via macOS dialog.",
		browserFillSchema,
		makeBrowserHandler("browser_fill", true),
	)

	registry.Register(
		"browser_screenshot",
		"Capture a screenshot of a browser tab and return it as a base64 PNG data URL.",
		browserScreenshotSchema,
		makeBrowserHandler("browser_screenshot", false),
	)

	registry.Register(
		"browser_tabs",
		"List all open browser tabs with their id, url, title, and active state.",
		browserTabsSchema,
		makeBrowserHandler("browser_tabs", false),
	)

	registry.Register(
		"browser_close",
		"Close a browser tab by its tab_id. Requires user confirmation via macOS dialog.",
		browserCloseSchema,
		makeBrowserHandler("browser_close", true),
	)

	registry.Register(
		"browser_accounts",
		"List all registered browser accounts (name, platform, url).",
		browserAccountsSchema,
		makeBrowserHandler("browser_accounts", false),
	)

	registry.Register(
		"browser_register",
		"Register a new browser account so it can be read with browser_read. "+
			"Platforms: gmail, github, slack, linear, jira, whatsapp, twitter.",
		browserRegisterSchema,
		makeBrowserHandler("browser_register", false),
	)
}

// ---------------------------------------------------------------------------
// Handler factory
// ---------------------------------------------------------------------------

// makeBrowserHandler returns an MCP ToolHandler that sends the command to the
// Chrome extension via ExecuteCommand and returns the JSON result.
//
// requiresConfirmation: when true, a macOS dialog is shown before executing.
func makeBrowserHandler(action string, requiresConfirmation bool) mcp.ToolHandler {
	return func(_ context.Context, params json.RawMessage) (*mcp.ToolResult, error) {
		// Parse params into a plain map for forwarding.
		var paramMap map[string]any
		if len(params) > 0 && string(params) != "null" {
			if err := json.Unmarshal(params, &paramMap); err != nil {
				return mcp.ErrorResult("invalid params: " + err.Error()), nil
			}
		}
		if paramMap == nil {
			paramMap = map[string]any{}
		}

		// Show macOS confirmation dialog for write/destructive actions.
		if requiresConfirmation {
			target := describeTarget(action, paramMap)
			if !confirmAction(action, target) {
				data, _ := json.Marshal(map[string]any{
					"ok":     false,
					"action": action,
					"reason": "user denied permission",
				})
				return mcp.TextResult(string(data)), nil
			}
		}

		// Execute the command via the Twin Bridge.
		result, err := twin.ExecuteCommand(action, paramMap)
		if err != nil {
			return mcp.ErrorResult(fmt.Sprintf("browser command failed: %v", err)), nil
		}

		return mcp.TextResult(string(result)), nil
	}
}

// ---------------------------------------------------------------------------
// macOS confirmation dialog
// ---------------------------------------------------------------------------

// confirmAction shows a macOS dialog asking the user to approve an action.
// Returns true when the user clicks "Allow", false on "Deny" or if osascript
// is unavailable.
func confirmAction(action, target string) bool {
	script := fmt.Sprintf(
		`button returned of (display dialog "Orchestra wants to %s on:\n\n%s\n\nAllow?" `+
			`buttons {"Deny", "Allow"} default button "Allow" with title "Orchestra Browser Control")`,
		action, target,
	)
	cmd := exec.Command("osascript", "-e", script)
	err := cmd.Run()
	return err == nil
}

// describeTarget builds a human-readable target string for the confirmation dialog.
func describeTarget(action string, params map[string]any) string {
	switch action {
	case "browser_click", "browser_fill":
		selector, _ := params["selector"].(string)
		tabID := params["tab_id"]
		if selector != "" {
			return fmt.Sprintf("tab %v — selector: %s", tabID, selector)
		}
		return fmt.Sprintf("tab %v", tabID)
	case "browser_close":
		return fmt.Sprintf("tab %v", params["tab_id"])
	default:
		return action
	}
}
