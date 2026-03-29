// orchestra-browser — standalone CLI for local Chrome CDP control.
//
// Usage:
//
//	orchestra-browser <command> [json-args]
//
// Commands: tabs, navigate, screenshot, eval, dom, click
//
// All output is JSON to stdout. Exits 0 on success, 1 on error.
package main

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"time"

	"github.com/chromedp/cdproto/page"
	"github.com/chromedp/cdproto/target"
	"github.com/chromedp/chromedp"
)

// ---------------------------------------------------------------------------
// Output helpers
// ---------------------------------------------------------------------------

type response struct {
	Status string      `json:"status"`
	Data   interface{} `json:"data,omitempty"`
	Error  string      `json:"error,omitempty"`
}

func printOK(data interface{}) {
	b, _ := json.Marshal(response{Status: "ok", Data: data})
	fmt.Fprintln(os.Stdout, string(b))
	// Exit immediately to prevent deferred chromedp context cancellations
	// from closing browser tabs. This CLI is stateless — each invocation
	// should leave browser state intact for the next one.
	os.Exit(0)
}

func printError(msg string) {
	b, _ := json.Marshal(response{Status: "error", Error: msg})
	fmt.Fprintln(os.Stdout, string(b))
}

func fatal(msg string) {
	printError(msg)
	os.Exit(1)
}

// ---------------------------------------------------------------------------
// Chrome discovery & launch  (reused from internal/tools/browser.go)
// ---------------------------------------------------------------------------

func defaultCDPURL() string {
	if v := os.Getenv("CHROME_CDP_URL"); v != "" {
		return v
	}
	return "http://localhost:9222"
}

func isChromeCDPAvailable(cdpURL string) bool {
	client := &http.Client{Timeout: 2 * time.Second}
	resp, err := client.Get(cdpURL + "/json/version")
	if err != nil {
		return false
	}
	resp.Body.Close()
	return resp.StatusCode == http.StatusOK
}

func findChromeBinary() (string, error) {
	switch runtime.GOOS {
	case "darwin":
		candidates := []string{
			"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
			"/Applications/Chromium.app/Contents/MacOS/Chromium",
		}
		for _, p := range candidates {
			if _, err := os.Stat(p); err == nil {
				return p, nil
			}
		}
		if p, err := exec.LookPath("google-chrome"); err == nil {
			return p, nil
		}
		return "", fmt.Errorf("Chrome not found — install Google Chrome or set CHROME_CDP_URL")

	case "linux":
		candidates := []string{
			"google-chrome",
			"google-chrome-stable",
			"chromium-browser",
			"chromium",
		}
		for _, name := range candidates {
			if p, err := exec.LookPath(name); err == nil {
				return p, nil
			}
		}
		return "", fmt.Errorf("Chrome/Chromium not found on PATH")

	default:
		return "", fmt.Errorf("auto-launch not supported on %s", runtime.GOOS)
	}
}

func extractPort(cdpURL string) (string, error) {
	u, err := url.Parse(cdpURL)
	if err != nil {
		return "", err
	}
	_, port, err := net.SplitHostPort(u.Host)
	if err != nil {
		return "9222", nil
	}
	if port == "" {
		return "9222", nil
	}
	return port, nil
}

func launchChrome(cdpURL string) (*exec.Cmd, error) {
	binary, err := findChromeBinary()
	if err != nil {
		return nil, err
	}

	port, err := extractPort(cdpURL)
	if err != nil {
		return nil, fmt.Errorf("invalid CDP URL %q: %w", cdpURL, err)
	}

	headless := false
	if v := os.Getenv("CHROME_HEADLESS"); v == "true" || v == "1" {
		headless = true
	}

	args := []string{
		"--remote-debugging-port=" + port,
		"--no-first-run",
		"--no-default-browser-check",
		"--disable-gpu",
		"--no-sandbox",
		"--disable-dev-shm-usage",
		"--disable-background-timer-throttling",
		"--user-data-dir=/tmp/orchestra-chrome-profile",
	}
	if headless {
		args = append(args, "--headless=new")
	}

	cmd := exec.Command(binary, args...)
	cmd.Stdout = nil
	cmd.Stderr = nil
	if err := cmd.Start(); err != nil {
		return nil, fmt.Errorf("failed to start Chrome: %w", err)
	}
	return cmd, nil
}

func waitForCDP(cdpURL string, timeout time.Duration) error {
	deadline := time.Now().Add(timeout)
	client := &http.Client{Timeout: 1 * time.Second}
	versionURL := cdpURL + "/json/version"

	for time.Now().Before(deadline) {
		resp, err := client.Get(versionURL)
		if err == nil {
			resp.Body.Close()
			if resp.StatusCode == http.StatusOK {
				return nil
			}
		}
		time.Sleep(250 * time.Millisecond)
	}
	return fmt.Errorf("CDP endpoint %s did not respond within %s", cdpURL, timeout)
}

// ---------------------------------------------------------------------------
// CDP connection (ensure Chrome is running with CDP)
// ---------------------------------------------------------------------------

// ensureChrome verifies Chrome is running with CDP enabled.
// It NEVER launches a new Chrome — it connects to the user's existing browser.
// If Chrome is not available with CDP, it returns clear instructions.
func ensureChrome() {
	cdpURL := defaultCDPURL()

	if isChromeCDPAvailable(cdpURL) {
		return
	}

	// Chrome is not running with CDP — give the user clear instructions
	// to restart their existing Chrome with the debug flag.
	port := "9222"
	if p, err := extractPort(cdpURL); err == nil {
		port = p
	}

	msg := fmt.Sprintf(
		"Chrome is not running with CDP enabled. "+
			"Please quit Chrome and relaunch it with remote debugging:\n\n"+
			"  macOS:  open -a 'Google Chrome' --args --remote-debugging-port=%s\n"+
			"  Linux:  google-chrome --remote-debugging-port=%s\n\n"+
			"This reopens your existing Chrome with all your tabs, cookies, and sessions intact. "+
			"The --remote-debugging-port flag simply opens a debug port — nothing else changes.\n\n"+
			"After restarting Chrome, run this command again.",
		port, port)

	fatal(msg)
}

// newAllocator creates a fresh remote allocator context for the CDP URL.
func newAllocator() (context.Context, context.CancelFunc) {
	return chromedp.NewRemoteAllocator(context.Background(), defaultCDPURL())
}

// ---------------------------------------------------------------------------
// Tab targeting helpers
// ---------------------------------------------------------------------------

// listPageTargets returns all page targets from the CDP endpoint using the
// HTTP /json/list API (avoids needing a full chromedp browser connection).
func listPageTargets() ([]struct {
	ID    string `json:"id"`
	Title string `json:"title"`
	URL   string `json:"url"`
	Type  string `json:"type"`
}, error) {
	cdpURL := defaultCDPURL()
	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Get(cdpURL + "/json/list")
	if err != nil {
		return nil, fmt.Errorf("failed to list targets: %w", err)
	}
	defer resp.Body.Close()

	var targets []struct {
		ID    string `json:"id"`
		Title string `json:"title"`
		URL   string `json:"url"`
		Type  string `json:"type"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&targets); err != nil {
		return nil, fmt.Errorf("failed to decode targets: %w", err)
	}
	return targets, nil
}

// findPageTargetID finds a page target by ID, or returns the first page target.
func findPageTargetID(tabID string) (string, error) {
	targets, err := listPageTargets()
	if err != nil {
		return "", err
	}
	for _, t := range targets {
		if t.Type == "page" {
			if tabID == "" || t.ID == tabID {
				return t.ID, nil
			}
		}
	}
	if tabID != "" {
		return "", fmt.Errorf("tab %q not found", tabID)
	}
	return "", fmt.Errorf("no open page tabs found")
}

// connectToTab creates a chromedp context attached to a specific tab target.
// It creates a fresh allocator + context each time.
//
// IMPORTANT: Cancel functions are intentionally not called here. This is a
// stateless CLI — each command prints its result and calls os.Exit(0) via
// printOK. If we canceled the chromedp context, it would close/detach the
// browser tab (chromedp's default behavior for non-first contexts). By not
// canceling and relying on process exit, tabs persist for future invocations.
func connectToTab(targetID string, timeout time.Duration) context.Context {
	allocCtx, allocCancel := newAllocator()
	ctx, ctxCancel := chromedp.NewContext(allocCtx,
		chromedp.WithTargetID(target.ID(targetID)),
	)
	tCtx, tCancel := context.WithTimeout(ctx, timeout)

	// Prevent "unused variable" errors. These are intentionally leaked —
	// the process exits before they matter, and calling them would close
	// the browser tab.
	_ = allocCancel
	_ = ctxCancel
	_ = tCancel

	return tCtx
}

// createNewTab opens a new browser tab via the CDP HTTP API (PUT /json/new).
// This works even when there are no existing page targets. Returns the new
// target's metadata.
func createNewTab(targetURL string) (*struct {
	ID  string `json:"id"`
	URL string `json:"url"`
}, error) {
	cdpURL := defaultCDPURL()
	reqURL := cdpURL + "/json/new"
	if targetURL != "" {
		reqURL += "?" + targetURL
	}

	req, err := http.NewRequest(http.MethodPut, reqURL, nil)
	if err != nil {
		return nil, err
	}

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("CDP /json/new request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("CDP /json/new returned status %d", resp.StatusCode)
	}

	var result struct {
		ID  string `json:"id"`
		URL string `json:"url"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode /json/new response: %w", err)
	}
	return &result, nil
}

// ---------------------------------------------------------------------------
// Command: tabs
// ---------------------------------------------------------------------------

func cmdTabs() {
	targets, err := listPageTargets()
	if err != nil {
		fatal("failed to list tabs: " + err.Error())
	}

	type tabInfo struct {
		ID    string `json:"id"`
		Title string `json:"title"`
		URL   string `json:"url"`
	}

	var tabs []tabInfo
	for _, t := range targets {
		if t.Type == "page" {
			tabs = append(tabs, tabInfo{
				ID:    t.ID,
				Title: t.Title,
				URL:   t.URL,
			})
		}
	}

	printOK(map[string]interface{}{
		"tabs":  tabs,
		"count": len(tabs),
	})
}

// ---------------------------------------------------------------------------
// Command: navigate
// ---------------------------------------------------------------------------

func cmdNavigate(args json.RawMessage) {
	var input struct {
		URL   string `json:"url"`
		TabID string `json:"tab_id"`
	}
	if err := json.Unmarshal(args, &input); err != nil {
		fatal("invalid args: " + err.Error())
	}
	if input.URL == "" {
		fatal("url is required")
	}

	targetID, err := findPageTargetID(input.TabID)
	if err != nil {
		// No existing tab — create one via CDP HTTP API.
		newTarget, createErr := createNewTab(input.URL)
		if createErr != nil {
			fatal("no tabs and failed to create one: " + createErr.Error())
		}

		// Attach to the new tab and read the title.
		tabCtx := connectToTab(newTarget.ID, 15*time.Second)

		var title string
		_ = chromedp.Run(tabCtx, chromedp.Title(&title))

		printOK(map[string]interface{}{
			"url":    input.URL,
			"title":  title,
			"tab_id": newTarget.ID,
		})
		return
	}

	tabCtx := connectToTab(targetID, 15*time.Second)

	var title string
	if err := chromedp.Run(tabCtx,
		chromedp.Navigate(input.URL),
		chromedp.Title(&title),
	); err != nil {
		fatal("navigation failed: " + err.Error())
	}

	printOK(map[string]interface{}{
		"url":   input.URL,
		"title": title,
	})
}

// ---------------------------------------------------------------------------
// Command: screenshot
// ---------------------------------------------------------------------------

func cmdScreenshot(args json.RawMessage) {
	var input struct {
		TabID    string `json:"tab_id"`
		Selector string `json:"selector"`
		FullPage bool   `json:"full_page"`
	}
	if err := json.Unmarshal(args, &input); err != nil {
		fatal("invalid args: " + err.Error())
	}

	targetID, err := findPageTargetID(input.TabID)
	if err != nil {
		fatal(err.Error())
	}

	tabCtx := connectToTab(targetID, 15*time.Second)

	var buf []byte

	switch {
	case input.Selector != "":
		if err := chromedp.Run(tabCtx,
			chromedp.WaitReady(input.Selector, chromedp.ByQuery),
			chromedp.Screenshot(input.Selector, &buf, chromedp.ByQuery),
		); err != nil {
			fatal("element screenshot failed: " + err.Error())
		}

	case input.FullPage:
		if err := chromedp.Run(tabCtx,
			chromedp.FullScreenshot(&buf, 90),
		); err != nil {
			fatal("full-page screenshot failed: " + err.Error())
		}

	default:
		if err := chromedp.Run(tabCtx,
			chromedp.ActionFunc(func(ctx context.Context) error {
				var captureErr error
				buf, captureErr = page.CaptureScreenshot().
					WithFormat(page.CaptureScreenshotFormatPng).
					Do(ctx)
				return captureErr
			}),
		); err != nil {
			fatal("screenshot failed: " + err.Error())
		}
	}

	// Save to /tmp/orchestra-screenshots/{timestamp}.png
	dir := "/tmp/orchestra-screenshots"
	if err := os.MkdirAll(dir, 0755); err != nil {
		fatal("failed to create screenshot dir: " + err.Error())
	}

	timestamp := time.Now().UTC().Format("20060102-150405")
	fileName := fmt.Sprintf("screenshot-%s.png", timestamp)
	filePath := filepath.Join(dir, fileName)

	if err := os.WriteFile(filePath, buf, 0644); err != nil {
		fatal("failed to write screenshot: " + err.Error())
	}

	printOK(map[string]interface{}{
		"file_path":  filePath,
		"size_bytes": len(buf),
	})
}

// ---------------------------------------------------------------------------
// Command: eval
// ---------------------------------------------------------------------------

func cmdEval(args json.RawMessage) {
	var input struct {
		Expression string `json:"expression"`
		TabID      string `json:"tab_id"`
	}
	if err := json.Unmarshal(args, &input); err != nil {
		fatal("invalid args: " + err.Error())
	}
	if input.Expression == "" {
		fatal("expression is required")
	}

	targetID, err := findPageTargetID(input.TabID)
	if err != nil {
		fatal(err.Error())
	}

	tabCtx := connectToTab(targetID, 10*time.Second)

	var res interface{}
	if err := chromedp.Run(tabCtx,
		chromedp.Evaluate(input.Expression, &res),
	); err != nil {
		fatal("eval failed: " + err.Error())
	}

	printOK(map[string]interface{}{
		"result": res,
	})
}

// ---------------------------------------------------------------------------
// Command: dom
// ---------------------------------------------------------------------------

func cmdDOM(args json.RawMessage) {
	var input struct {
		Selector    string `json:"selector"`
		TabID       string `json:"tab_id"`
		MaxElements int    `json:"max_elements"`
	}
	if err := json.Unmarshal(args, &input); err != nil {
		fatal("invalid args: " + err.Error())
	}
	if input.Selector == "" {
		fatal("selector is required")
	}
	if input.MaxElements <= 0 {
		input.MaxElements = 10
	}

	targetID, err := findPageTargetID(input.TabID)
	if err != nil {
		fatal(err.Error())
	}

	tabCtx := connectToTab(targetID, 10*time.Second)

	jsExpr := fmt.Sprintf(`
		(function() {
			const els = document.querySelectorAll(%q);
			const max = %d;
			const result = [];
			for (let i = 0; i < Math.min(els.length, max); i++) {
				const el = els[i];
				const attrs = {};
				for (const attr of el.attributes) {
					attrs[attr.name] = attr.value;
				}
				result.push({
					tag:        el.tagName.toLowerCase(),
					id:         el.id || "",
					class:      el.className || "",
					text:       (el.textContent || "").trim().substring(0, 200),
					attributes: attrs
				});
			}
			return { elements: result, count: els.length };
		})()
	`, input.Selector, input.MaxElements)

	var res interface{}
	if err := chromedp.Run(tabCtx,
		chromedp.Evaluate(jsExpr, &res),
	); err != nil {
		fatal("DOM query failed: " + err.Error())
	}

	printOK(res)
}

// ---------------------------------------------------------------------------
// Command: click
// ---------------------------------------------------------------------------

func cmdClick(args json.RawMessage) {
	var input struct {
		Selector string `json:"selector"`
		TabID    string `json:"tab_id"`
	}
	if err := json.Unmarshal(args, &input); err != nil {
		fatal("invalid args: " + err.Error())
	}
	if input.Selector == "" {
		fatal("selector is required")
	}

	targetID, err := findPageTargetID(input.TabID)
	if err != nil {
		fatal(err.Error())
	}

	tabCtx := connectToTab(targetID, 10*time.Second)

	if err := chromedp.Run(tabCtx,
		chromedp.WaitReady(input.Selector, chromedp.ByQuery),
		chromedp.Click(input.Selector, chromedp.ByQuery),
	); err != nil {
		fatal("click failed: " + err.Error())
	}

	printOK(map[string]interface{}{
		"clicked":  true,
		"selector": input.Selector,
	})
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const usage = `orchestra-browser — Chrome CDP control CLI

Usage:
  orchestra-browser <command> [json-args]

Commands:
  tabs                           List open browser tabs
  navigate  '{"url": "..."}'     Navigate a tab to a URL
  screenshot [json-args]         Capture a screenshot (viewport, element, or full page)
  eval      '{"expression":".."}' Evaluate JavaScript in the page
  dom       '{"selector":"..."}'  Query DOM elements by CSS selector
  click     '{"selector":"..."}'  Click an element by CSS selector

Environment:
  CHROME_CDP_URL     CDP endpoint (default: http://localhost:9222)
  CHROME_HEADLESS    Set to "true" for headless Chrome (default: visible)

All output is JSON to stdout.
`

func main() {
	if len(os.Args) < 2 {
		fmt.Fprint(os.Stderr, usage)
		os.Exit(1)
	}

	command := os.Args[1]

	// Handle help flags.
	if command == "-h" || command == "--help" || command == "help" {
		fmt.Fprint(os.Stderr, usage)
		os.Exit(0)
	}

	// Parse JSON args: from second argument or stdin.
	var args json.RawMessage
	if len(os.Args) >= 3 {
		args = json.RawMessage(os.Args[2])
	} else if command != "tabs" {
		// Try reading from stdin (non-blocking check).
		stat, _ := os.Stdin.Stat()
		if (stat.Mode() & os.ModeCharDevice) == 0 {
			data, err := io.ReadAll(os.Stdin)
			if err == nil && len(data) > 0 {
				args = json.RawMessage(data)
			}
		}
	}

	// Default empty JSON object for commands that need args.
	if args == nil {
		args = json.RawMessage(`{}`)
	}

	// Validate command before connecting to Chrome.
	validCommands := map[string]bool{
		"tabs": true, "navigate": true, "screenshot": true,
		"eval": true, "dom": true, "click": true,
	}
	if !validCommands[command] {
		fatal(fmt.Sprintf("unknown command: %s (valid: tabs, navigate, screenshot, eval, dom, click)", command))
	}

	// Ensure Chrome is running with CDP.
	ensureChrome()

	// Dispatch command.
	switch command {
	case "tabs":
		cmdTabs()
	case "navigate":
		cmdNavigate(args)
	case "screenshot":
		cmdScreenshot(args)
	case "eval":
		cmdEval(args)
	case "dom":
		cmdDOM(args)
	case "click":
		cmdClick(args)
	}
}
