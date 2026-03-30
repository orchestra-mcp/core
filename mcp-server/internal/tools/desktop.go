package tools

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"runtime"

	"github.com/orchestra-mcp/server/internal/mcp"
)

// ---------------------------------------------------------------------------
// JSON Schema
// ---------------------------------------------------------------------------

var desktopInstallSchema = json.RawMessage(`{
	"type": "object",
	"properties": {
		"install_path": {
			"type": "string",
			"description": "Where to install the desktop binary (default: ~/.orchestra/bin/)"
		},
		"token": {
			"type": "string",
			"description": "MCP token to pre-configure in the desktop app"
		},
		"server_url": {
			"type": "string",
			"description": "MCP server URL to pre-configure (default: https://orchestra-mcp.com)"
		}
	}
}`)

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

// RegisterDesktopTools registers the desktop_install MCP tool.
func RegisterDesktopTools(registry *mcp.ToolRegistry) {
	registry.Register(
		"desktop_install",
		"Get platform-specific installation instructions for the Orchestra Desktop app",
		desktopInstallSchema,
		handleDesktopInstall,
	)
}

// ---------------------------------------------------------------------------
// Handler: desktop_install
// ---------------------------------------------------------------------------

func handleDesktopInstall(_ context.Context, params json.RawMessage) (*mcp.ToolResult, error) {
	var input struct {
		InstallPath string `json:"install_path"`
		Token       string `json:"token"`
		ServerURL   string `json:"server_url"`
	}
	if err := json.Unmarshal(params, &input); err != nil {
		return mcp.ErrorResult("invalid params: " + err.Error()), nil
	}

	// Resolve defaults.
	installPath := input.InstallPath
	if installPath == "" {
		installPath = "~/.orchestra/bin"
	}

	serverURL := input.ServerURL
	if serverURL == "" {
		serverURL = os.Getenv("ORCHESTRA_BASE_URL")
	}
	if serverURL == "" {
		serverURL = "https://orchestra-mcp.com"
	}

	// Detect platform.
	goos := runtime.GOOS
	goarch := runtime.GOARCH
	platform := goos + "-" + goarch

	// Determine if the current platform is supported.
	supported := false
	supportedPlatforms := []string{"darwin-arm64", "darwin-amd64", "linux-amd64"}
	for _, p := range supportedPlatforms {
		if p == platform {
			supported = true
			break
		}
	}

	downloadURL := fmt.Sprintf("%s/api/bin/orchestra-desktop-%s", serverURL, platform)
	binaryName := "orchestra-desktop"

	// Build platform-specific install commands.
	var steps []string

	if !supported {
		steps = []string{
			fmt.Sprintf("# Platform %s is not yet supported.", platform),
			fmt.Sprintf("# Supported platforms: %v", supportedPlatforms),
			"# Check https://orchestra-mcp.com/downloads for updates.",
		}
	} else {
		steps = []string{
			fmt.Sprintf("mkdir -p %s", installPath),
			fmt.Sprintf("curl -fSL -o %s/%s %s", installPath, binaryName, downloadURL),
			fmt.Sprintf("chmod +x %s/%s", installPath, binaryName),
		}
	}

	// Build config commands if token or server_url provided.
	var configCommands []string
	if input.Token != "" {
		configCommands = append(configCommands,
			fmt.Sprintf("%s/%s config set token %s", installPath, binaryName, input.Token),
		)
	}
	if input.ServerURL != "" || os.Getenv("ORCHESTRA_BASE_URL") != "" {
		configCommands = append(configCommands,
			fmt.Sprintf("%s/%s config set server_url %s", installPath, binaryName, serverURL),
		)
	}

	result := map[string]interface{}{
		"platform":            platform,
		"supported":           supported,
		"supported_platforms": supportedPlatforms,
		"download_url":        downloadURL,
		"install_path":        installPath,
		"binary_name":         binaryName,
		"version":             "0.2.0",
		"install_commands":    steps,
		"config_commands":     configCommands,
		"features": []string{
			"Vision control — screen capture and AI-driven UI interaction",
			"Markdown editor — rich editing with live preview",
			"Smart actions — context-aware automation shortcuts",
			"System tray integration — background operation with notifications",
		},
		"instructions": fmt.Sprintf(
			"Install Orchestra Desktop for enhanced features. "+
				"Run the install commands below, then use config commands to connect to your MCP server.\n\n"+
				"After installation, start with: %s/%s serve",
			installPath, binaryName,
		),
	}

	return jsonResult(result)
}
