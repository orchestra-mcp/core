// Package config provides helpers for managing local configuration files used
// by Orchestra MCP tooling, including .mcp.json which Claude Code reads to
// discover available MCP servers.
package config

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
)

// mcpServer represents a single server entry inside .mcp.json.
type mcpServer struct {
	Type string `json:"type"`
	URL  string `json:"url"`
}

// mcpConfig is the top-level structure of a .mcp.json file.
type mcpConfig struct {
	MCPServers map[string]mcpServer `json:"mcpServers"`
}

// UpdateMCPJSON finds the nearest .mcp.json file and updates the URL for the
// named server entry. All other entries are preserved unchanged.
//
// Search order:
//  1. Current working directory (./.mcp.json)
//  2. Home directory (~/.mcp.json)
//  3. Parent directories, up to 5 levels above cwd
//
// If no .mcp.json is found anywhere, a new one is created in the current
// working directory containing only the supplied server entry.
//
// File-permission errors are logged as warnings — the function returns nil so
// the caller (server startup) does not crash due to a missing or read-only
// config file.
func UpdateMCPJSON(serverName, serverURL string) error {
	path, err := findMCPJSON()
	if err != nil {
		// No existing file found anywhere — create one in cwd.
		cwd, wdErr := os.Getwd()
		if wdErr != nil {
			slog.Warn("mcp.json: could not determine working directory", "error", wdErr)
			return nil
		}
		path = filepath.Join(cwd, ".mcp.json")
		slog.Info("mcp.json: no existing file found, will create", "path", path)
	}

	cfg, readErr := readMCPJSON(path)
	if readErr != nil {
		// File exists but is unreadable / malformed — warn and bail; don't
		// silently overwrite a file we couldn't parse.
		slog.Warn("mcp.json: could not read file, skipping update",
			"path", path, "error", readErr)
		return nil
	}

	// Ensure the map is initialised (empty or brand-new file).
	if cfg.MCPServers == nil {
		cfg.MCPServers = make(map[string]mcpServer)
	}

	existing, ok := cfg.MCPServers[serverName]
	if ok && existing.URL == serverURL {
		// Nothing changed — skip the write.
		slog.Debug("mcp.json: URL unchanged, skipping write",
			"server", serverName, "url", serverURL)
		return nil
	}

	// Preserve the existing type field if present; default to "http".
	entryType := "http"
	if ok && existing.Type != "" {
		entryType = existing.Type
	}

	cfg.MCPServers[serverName] = mcpServer{
		Type: entryType,
		URL:  serverURL,
	}

	if writeErr := writeMCPJSON(path, cfg); writeErr != nil {
		slog.Warn("mcp.json: could not write file, skipping update",
			"path", path, "error", writeErr)
		return nil
	}

	slog.Info("mcp.json: updated",
		"server", serverName,
		"url", serverURL,
		"path", path)
	fmt.Printf("Updated .mcp.json: %s → %s\n", serverName, serverURL)
	return nil
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

// findMCPJSON searches for .mcp.json in the following order:
//  1. Current working directory
//  2. Home directory
//  3. Up to 5 parent directories above cwd
//
// Returns the absolute path of the first file found, or an error if none
// exists.
func findMCPJSON() (string, error) {
	const filename = ".mcp.json"

	// 1. CWD
	cwd, err := os.Getwd()
	if err == nil {
		if p := filepath.Join(cwd, filename); fileExists(p) {
			return p, nil
		}
	}

	// 2. Home directory
	home, err := os.UserHomeDir()
	if err == nil {
		if p := filepath.Join(home, filename); fileExists(p) {
			return p, nil
		}
	}

	// 3. Walk up from cwd (up to 5 levels)
	if cwd != "" {
		dir := cwd
		for i := 0; i < 5; i++ {
			parent := filepath.Dir(dir)
			if parent == dir {
				// Reached filesystem root.
				break
			}
			dir = parent
			if p := filepath.Join(dir, filename); fileExists(p) {
				return p, nil
			}
		}
	}

	return "", fmt.Errorf("mcp.json: no .mcp.json found in cwd, home, or parent dirs")
}

// fileExists returns true when path points to an existing regular file.
func fileExists(path string) bool {
	info, err := os.Stat(path)
	return err == nil && !info.IsDir()
}

// readMCPJSON reads and parses the JSON at path. If the file is empty or does
// not exist it returns an empty mcpConfig (no error).
func readMCPJSON(path string) (mcpConfig, error) {
	var cfg mcpConfig

	data, err := os.ReadFile(path)
	if os.IsNotExist(err) {
		// Brand-new file — return an empty, valid config.
		return cfg, nil
	}
	if err != nil {
		return cfg, fmt.Errorf("read %s: %w", path, err)
	}

	if len(data) == 0 {
		return cfg, nil
	}

	if err := json.Unmarshal(data, &cfg); err != nil {
		return cfg, fmt.Errorf("parse %s: %w", path, err)
	}
	return cfg, nil
}

// writeMCPJSON serialises cfg to path with 2-space indentation. The file
// permissions are set to 0o644 (owner rw, group/other r).
func writeMCPJSON(path string, cfg mcpConfig) error {
	data, err := json.MarshalIndent(cfg, "", "  ")
	if err != nil {
		return fmt.Errorf("marshal mcp.json: %w", err)
	}
	// Append a trailing newline for clean diffs.
	data = append(data, '\n')

	if err := os.WriteFile(path, data, 0o644); err != nil {
		return fmt.Errorf("write %s: %w", path, err)
	}
	return nil
}
