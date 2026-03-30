package twin

import (
	"log/slog"
	"os/exec"
	"sync"
	"time"
)

// highPriorityTypes lists event types that trigger a macOS desktop
// notification. All other event types are stored silently.
var highPriorityTypes = map[string]bool{
	"dm":         true,
	"mention":    true,
	"pr_review":  true,
	"meeting":    true,
	"call":       true,
	"alert":      true,
	"urgent":     true,
}

const notifyCooldown = 30 * time.Second

// notifyThrottle tracks when the last notification was sent per source so we
// don't spam the user.
type notifyThrottle struct {
	mu   sync.Mutex
	last map[string]time.Time
}

var globalThrottle = &notifyThrottle{
	last: make(map[string]time.Time),
}

// shouldNotify returns true when an event is high-priority and enough time has
// elapsed since the last notification for that source.
func shouldNotify(event BridgeEvent) bool {
	if !highPriorityTypes[event.Type] {
		return false
	}

	globalThrottle.mu.Lock()
	defer globalThrottle.mu.Unlock()

	if last, ok := globalThrottle.last[event.Source]; ok {
		if time.Since(last) < notifyCooldown {
			return false
		}
	}
	globalThrottle.last[event.Source] = time.Now()
	return true
}

// sendDesktopNotification sends a macOS notification via osascript. It does
// nothing on non-macOS platforms and logs errors instead of panicking.
func sendDesktopNotification(title, body string) {
	script := `display notification "` + escapeAppleScript(body) + `" with title "` + escapeAppleScript(title) + `"`
	cmd := exec.Command("osascript", "-e", script)
	if err := cmd.Run(); err != nil {
		// Non-fatal — notification failure should never crash the server.
		slog.Warn("twin bridge: desktop notification failed", "title", title, "error", err)
	}
}

// escapeAppleScript escapes a string for safe embedding in an AppleScript
// double-quoted string literal by replacing double quotes with escaped quotes.
func escapeAppleScript(s string) string {
	out := make([]byte, 0, len(s))
	for i := 0; i < len(s); i++ {
		switch s[i] {
		case '"':
			out = append(out, '\\', '"')
		case '\\':
			out = append(out, '\\', '\\')
		default:
			out = append(out, s[i])
		}
	}
	return string(out)
}
