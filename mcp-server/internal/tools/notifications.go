package tools

import (
	"context"
	"encoding/json"

	"github.com/orchestra-mcp/server/internal/mcp"
)

// ---------------------------------------------------------------------------
// JSON Schemas
// ---------------------------------------------------------------------------

var notificationMuteSchema = json.RawMessage(`{
	"type": "object",
	"properties": {}
}`)

var notificationUnmuteSchema = json.RawMessage(`{
	"type": "object",
	"properties": {}
}`)

var notificationConfigSchema = json.RawMessage(`{
	"type": "object",
	"properties": {
		"voice_enabled": {"type": "boolean", "description": "Enable/disable voice notifications"},
		"voice_name":    {"type": "string", "description": "macOS voice name (e.g. Samantha, Karen, Daniel)"},
		"sound_enabled": {"type": "boolean", "description": "Enable/disable notification sounds"},
		"desktop_enabled": {"type": "boolean", "description": "Enable/disable desktop notifications"}
	}
}`)

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

// RegisterNotificationControlTools registers tools to control notification behavior.
// These return config that Claude Code writes to ~/.orchestra/config.json on the user's machine.
func RegisterNotificationControlTools(registry *mcp.ToolRegistry) {
	registry.Register("notification_mute", "Mute all notifications (voice, sound, desktop). Returns config for ~/.orchestra/config.json", notificationMuteSchema, makeNotificationMute())
	registry.Register("notification_unmute", "Unmute all notifications. Returns config for ~/.orchestra/config.json", notificationUnmuteSchema, makeNotificationUnmute())
	registry.Register("notification_config", "Configure notification settings (voice name, sound, desktop). Returns config for ~/.orchestra/config.json", notificationConfigSchema, makeNotificationConfig())
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

func makeNotificationMute() mcp.ToolHandler {
	return func(ctx context.Context, params json.RawMessage) (*mcp.ToolResult, error) {
		config := map[string]interface{}{
			"voice_enabled":   false,
			"sound_enabled":   false,
			"desktop_enabled": false,
		}
		return jsonResult(map[string]interface{}{
			"status":  "muted",
			"config":  config,
			"message": "All notifications muted. Write this config to ~/.orchestra/config.json",
			"file": map[string]interface{}{
				"path":    "~/.orchestra/config.json",
				"content": mustMarshal(config),
			},
		})
	}
}

func makeNotificationUnmute() mcp.ToolHandler {
	return func(ctx context.Context, params json.RawMessage) (*mcp.ToolResult, error) {
		config := map[string]interface{}{
			"voice_enabled":   true,
			"voice_name":      "Samantha",
			"sound_enabled":   true,
			"desktop_enabled": true,
		}
		return jsonResult(map[string]interface{}{
			"status":  "unmuted",
			"config":  config,
			"message": "All notifications enabled with voice (Samantha). Write this config to ~/.orchestra/config.json",
			"file": map[string]interface{}{
				"path":    "~/.orchestra/config.json",
				"content": mustMarshal(config),
			},
		})
	}
}

func makeNotificationConfig() mcp.ToolHandler {
	return func(ctx context.Context, params json.RawMessage) (*mcp.ToolResult, error) {
		var args struct {
			VoiceEnabled   *bool   `json:"voice_enabled"`
			VoiceName      *string `json:"voice_name"`
			SoundEnabled   *bool   `json:"sound_enabled"`
			DesktopEnabled *bool   `json:"desktop_enabled"`
		}
		if err := json.Unmarshal(params, &args); err != nil {
			return mcp.ErrorResult("invalid params: " + err.Error()), nil
		}

		config := make(map[string]interface{})

		if args.VoiceEnabled != nil {
			config["voice_enabled"] = *args.VoiceEnabled
		}
		if args.VoiceName != nil {
			config["voice_name"] = *args.VoiceName
		}
		if args.SoundEnabled != nil {
			config["sound_enabled"] = *args.SoundEnabled
		}
		if args.DesktopEnabled != nil {
			config["desktop_enabled"] = *args.DesktopEnabled
		}

		if len(config) == 0 {
			// No changes — return current defaults
			config = map[string]interface{}{
				"voice_enabled":   true,
				"voice_name":      "Samantha",
				"sound_enabled":   true,
				"desktop_enabled": true,
			}
		}

		return jsonResult(map[string]interface{}{
			"status":  "configured",
			"config":  config,
			"message": "Notification config updated. Write this config to ~/.orchestra/config.json",
			"file": map[string]interface{}{
				"path":    "~/.orchestra/config.json",
				"content": mustMarshal(config),
			},
		})
	}
}

func mustMarshal(v interface{}) string {
	b, _ := json.MarshalIndent(v, "", "  ")
	return string(b)
}
