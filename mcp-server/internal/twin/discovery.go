package twin

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
	"time"
)

const discoveryFilename = "twin-bridge.json"

// discoveryInfo is the structure written to ~/.orchestra/run/twin-bridge.json
// so that other processes (e.g. MCP tools, the CLI) can discover the bridge.
type discoveryInfo struct {
	Port      int       `json:"port"`
	PID       int       `json:"pid"`
	Token     string    `json:"token"`
	StartedAt time.Time `json:"started_at"`
}

// generateToken produces a cryptographically random 32-byte hex string.
func generateToken() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", fmt.Errorf("generate token: %w", err)
	}
	return hex.EncodeToString(b), nil
}

// discoveryPath returns the path to the discovery file, creating the parent
// directory if it does not already exist.
func discoveryPath() (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", fmt.Errorf("user home dir: %w", err)
	}
	dir := filepath.Join(home, ".orchestra", "run")
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return "", fmt.Errorf("create run dir: %w", err)
	}
	return filepath.Join(dir, discoveryFilename), nil
}

// writeDiscoveryFile writes bridge metadata to the discovery file.
func writeDiscoveryFile(port int, token string) error {
	path, err := discoveryPath()
	if err != nil {
		return err
	}

	info := discoveryInfo{
		Port:      port,
		PID:       os.Getpid(),
		Token:     token,
		StartedAt: time.Now().UTC(),
	}

	data, err := json.MarshalIndent(info, "", "  ")
	if err != nil {
		return fmt.Errorf("marshal discovery info: %w", err)
	}

	if err := os.WriteFile(path, data, 0o600); err != nil {
		return fmt.Errorf("write discovery file: %w", err)
	}

	slog.Info("twin bridge discovery file written", "path", path, "port", port)
	return nil
}

// removeDiscoveryFile deletes the discovery file on shutdown. Errors are
// logged but not returned — the caller should not block on cleanup.
func removeDiscoveryFile() {
	path, err := discoveryPath()
	if err != nil {
		slog.Warn("twin bridge: could not resolve discovery path for cleanup", "error", err)
		return
	}
	if err := os.Remove(path); err != nil && !os.IsNotExist(err) {
		slog.Warn("twin bridge: failed to remove discovery file", "path", path, "error", err)
		return
	}
	slog.Info("twin bridge discovery file removed", "path", path)
}
