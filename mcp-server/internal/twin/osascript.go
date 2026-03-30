package twin

import (
	"bytes"
	"os/exec"
)

// runOsascript executes an AppleScript snippet via /usr/bin/osascript and
// returns stdout as a string.  On non-macOS systems (or if osascript is not
// in PATH) it returns an error so callers can choose a safe fallback.
func runOsascript(script string) (string, error) {
	cmd := exec.Command("osascript", "-e", script)
	var out bytes.Buffer
	cmd.Stdout = &out
	if err := cmd.Run(); err != nil {
		return "", err
	}
	return out.String(), nil
}
