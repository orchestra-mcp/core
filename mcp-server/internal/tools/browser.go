package tools

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
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

	"github.com/orchestra-mcp/server/internal/auth"
	"github.com/orchestra-mcp/server/internal/mcp"
)

// ---------------------------------------------------------------------------
// BrowserClient — shared CDP connection to an existing Chrome instance
// ---------------------------------------------------------------------------

// BrowserClient holds the remote allocator context for connecting to a
// Chrome instance via Chrome DevTools Protocol (CDP). If no existing Chrome
// is running, it auto-launches one with CDP enabled.
type BrowserClient struct {
	allocCtx context.Context
	cancel   context.CancelFunc
	cdpURL   string
	managed  bool     // true if we launched Chrome ourselves
	cmd      *exec.Cmd // process handle for managed Chrome
}

// NewBrowserClient connects to a running Chrome instance at the given CDP URL.
// If no Chrome is available, it auto-launches one with the appropriate flags.
// The URL should be an HTTP endpoint like "http://localhost:9222".
func NewBrowserClient(cdpURL string) (*BrowserClient, error) {
	// Step 1: Try to connect to an existing Chrome instance.
	if isChromeCDPAvailable(cdpURL) {
		slog.Info("connecting to existing Chrome CDP", "url", cdpURL)
		allocCtx, cancel := chromedp.NewRemoteAllocator(context.Background(), cdpURL)

		// Verify the connection by listing targets with a short timeout.
		testCtx, testCancel := context.WithTimeout(allocCtx, 5*time.Second)
		defer testCancel()

		if _, err := chromedp.Targets(testCtx); err != nil {
			cancel()
			return nil, fmt.Errorf("Chrome CDP responded but target listing failed at %s: %w", cdpURL, err)
		}

		return &BrowserClient{
			allocCtx: allocCtx,
			cancel:   cancel,
			cdpURL:   cdpURL,
			managed:  false,
		}, nil
	}

	// Step 2: Auto-launch Chrome with CDP.
	slog.Info("no existing Chrome CDP found, auto-launching", "url", cdpURL)
	cmd, err := launchChrome(cdpURL)
	if err != nil {
		return nil, fmt.Errorf("no Chrome CDP available at %s and auto-launch failed: %w", cdpURL, err)
	}

	// Step 3: Wait for Chrome to be ready.
	if err := waitForCDP(cdpURL, 10*time.Second); err != nil {
		cmd.Process.Kill()
		cmd.Wait()
		return nil, fmt.Errorf("Chrome launched but CDP not responding at %s: %w", cdpURL, err)
	}

	// Step 4: Connect via chromedp remote allocator.
	allocCtx, cancel := chromedp.NewRemoteAllocator(context.Background(), cdpURL)

	// Verify the connection.
	testCtx, testCancel := context.WithTimeout(allocCtx, 5*time.Second)
	defer testCancel()

	if _, err := chromedp.Targets(testCtx); err != nil {
		cancel()
		cmd.Process.Kill()
		cmd.Wait()
		return nil, fmt.Errorf("Chrome launched and CDP responded, but target listing failed: %w", err)
	}

	slog.Info("auto-launched Chrome with CDP", "url", cdpURL, "pid", cmd.Process.Pid)

	return &BrowserClient{
		allocCtx: allocCtx,
		cancel:   cancel,
		cdpURL:   cdpURL,
		managed:  true,
		cmd:      cmd,
	}, nil
}

// Close releases the allocator resources and kills a managed Chrome process.
func (bc *BrowserClient) Close() {
	if bc.cancel != nil {
		bc.cancel()
	}
	if bc.managed && bc.cmd != nil && bc.cmd.Process != nil {
		slog.Info("shutting down managed Chrome", "pid", bc.cmd.Process.Pid)
		bc.cmd.Process.Kill()
		bc.cmd.Wait()
	}
}

// ---------------------------------------------------------------------------
// Chrome auto-launch helpers
// ---------------------------------------------------------------------------

// isChromeCDPAvailable checks whether a Chrome CDP endpoint is reachable by
// making an HTTP GET to /json/version.
func isChromeCDPAvailable(cdpURL string) bool {
	client := &http.Client{Timeout: 2 * time.Second}
	resp, err := client.Get(cdpURL + "/json/version")
	if err != nil {
		return false
	}
	resp.Body.Close()
	return resp.StatusCode == http.StatusOK
}

// findChromeBinary locates the Chrome executable on the current platform.
func findChromeBinary() (string, error) {
	switch runtime.GOOS {
	case "darwin":
		// macOS: check standard application paths.
		candidates := []string{
			"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
			"/Applications/Chromium.app/Contents/MacOS/Chromium",
		}
		for _, p := range candidates {
			if _, err := os.Stat(p); err == nil {
				return p, nil
			}
		}
		// Also check PATH.
		if p, err := exec.LookPath("google-chrome"); err == nil {
			return p, nil
		}
		return "", fmt.Errorf("Chrome not found — install Google Chrome or set CHROME_CDP_URL to a running instance")

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
		return "", fmt.Errorf("Chrome/Chromium not found on PATH — install google-chrome or chromium-browser")

	default:
		return "", fmt.Errorf("auto-launch not supported on %s — start Chrome manually with --remote-debugging-port", runtime.GOOS)
	}
}

// launchChrome starts a Chrome process with CDP enabled on the port extracted
// from cdpURL. It respects the CHROME_HEADLESS env var (default "false" — visible browser).
func launchChrome(cdpURL string) (*exec.Cmd, error) {
	binary, err := findChromeBinary()
	if err != nil {
		return nil, err
	}

	// Extract port from the CDP URL.
	port, err := extractPort(cdpURL)
	if err != nil {
		return nil, fmt.Errorf("invalid CDP URL %q: %w", cdpURL, err)
	}

	// Determine headless mode from env var. Default is VISIBLE (not headless).
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

	slog.Info("launching Chrome", "binary", binary, "port", port, "headless", headless)

	cmd := exec.Command(binary, args...)
	cmd.Stdout = nil // discard Chrome stdout
	cmd.Stderr = nil // discard Chrome stderr

	if err := cmd.Start(); err != nil {
		return nil, fmt.Errorf("failed to start Chrome at %s: %w", binary, err)
	}

	return cmd, nil
}

// waitForCDP polls the CDP /json/version endpoint until it responds with 200
// or the timeout expires.
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

// extractPort parses the port from a CDP URL like "http://localhost:9222".
func extractPort(cdpURL string) (string, error) {
	u, err := url.Parse(cdpURL)
	if err != nil {
		return "", err
	}
	_, port, err := net.SplitHostPort(u.Host)
	if err != nil {
		// If no port in the URL, default to 9222.
		return "9222", nil
	}
	if port == "" {
		return "9222", nil
	}
	return port, nil
}

// ---------------------------------------------------------------------------
// JSON Schemas
// ---------------------------------------------------------------------------

var browserTabsSchema = json.RawMessage(`{
	"type": "object",
	"properties": {},
	"required": []
}`)

var browserNavigateSchema = json.RawMessage(`{
	"type": "object",
	"properties": {
		"url":    {"type": "string", "description": "URL to navigate to"},
		"tab_id": {"type": "string", "description": "Target ID of the tab (uses first tab if omitted)"}
	},
	"required": ["url"]
}`)

var browserScreenshotSchema = json.RawMessage(`{
	"type": "object",
	"properties": {
		"tab_id":    {"type": "string", "description": "Target ID of the tab (uses first tab if omitted)"},
		"selector":  {"type": "string", "description": "CSS selector to screenshot a specific element"},
		"full_page": {"type": "boolean", "description": "Capture the full scrollable page (default: false)"}
	},
	"required": []
}`)

var browserEvalSchema = json.RawMessage(`{
	"type": "object",
	"properties": {
		"expression": {"type": "string", "description": "JavaScript expression to evaluate in the page"},
		"tab_id":     {"type": "string", "description": "Target ID of the tab (uses first tab if omitted)"}
	},
	"required": ["expression"]
}`)

var browserDOMSchema = json.RawMessage(`{
	"type": "object",
	"properties": {
		"selector":     {"type": "string", "description": "CSS selector to query"},
		"tab_id":       {"type": "string", "description": "Target ID of the tab (uses first tab if omitted)"},
		"max_elements": {"type": "integer", "description": "Maximum number of elements to return (default: 10)"}
	},
	"required": ["selector"]
}`)

var browserClickSchema = json.RawMessage(`{
	"type": "object",
	"properties": {
		"selector": {"type": "string", "description": "CSS selector of the element to click"},
		"tab_id":   {"type": "string", "description": "Target ID of the tab (uses first tab if omitted)"}
	},
	"required": ["selector"]
}`)

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

// RegisterBrowserTools registers all browser CDP MCP tools.
func RegisterBrowserTools(registry *mcp.ToolRegistry, bc *BrowserClient) {
	registry.Register("browser_tabs", "List all open browser tabs with their IDs, titles, and URLs", browserTabsSchema, makeBrowserTabs(bc))
	registry.Register("browser_navigate", "Navigate a browser tab to a URL", browserNavigateSchema, makeBrowserNavigate(bc))
	registry.Register("browser_screenshot", "Capture a screenshot of the current page or a specific element", browserScreenshotSchema, makeBrowserScreenshot(bc))
	registry.Register("browser_eval", "Execute JavaScript in the browser page and return the result", browserEvalSchema, makeBrowserEval(bc))
	registry.Register("browser_dom", "Get DOM elements matching a CSS selector with their attributes", browserDOMSchema, makeBrowserDOM(bc))
	registry.Register("browser_click", "Click an element matching a CSS selector in the browser", browserClickSchema, makeBrowserClick(bc))
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const browserNotConnected = "Browser not connected. Chrome auto-launch may have failed — check logs or set CHROME_CDP_URL"
const defaultBrowserTimeout = 5 * time.Second

// findPageTarget returns the target ID for a specific tab, or the first page
// target if tabID is empty.
func findPageTarget(ctx context.Context, bc *BrowserClient, tabID string) (*target.Info, error) {
	targets, err := chromedp.Targets(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to list targets: %w", err)
	}

	for _, t := range targets {
		if t.Type == "page" {
			if tabID == "" || string(t.TargetID) == tabID {
				return t, nil
			}
		}
	}

	if tabID != "" {
		return nil, fmt.Errorf("tab %q not found", tabID)
	}
	return nil, fmt.Errorf("no open page tabs found")
}

// newTabContext creates a new chromedp context attached to a specific tab target.
func newTabContext(bc *BrowserClient, targetID target.ID, timeout time.Duration) (context.Context, context.CancelFunc) {
	ctx, cancel := chromedp.NewContext(bc.allocCtx, chromedp.WithTargetID(targetID))
	tCtx, tCancel := context.WithTimeout(ctx, timeout)
	return tCtx, func() {
		tCancel()
		cancel()
	}
}

// ensureScreenshotDir creates the screenshot directory for the given org and
// returns the path: /tmp/orchestra-exports/{orgID}/screenshots/
func ensureScreenshotDir(orgID string) (string, error) {
	dir := filepath.Join("/tmp", "orchestra-exports", orgID, "screenshots")
	if err := os.MkdirAll(dir, 0755); err != nil {
		return "", fmt.Errorf("create screenshot dir: %w", err)
	}
	return dir, nil
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

func makeBrowserTabs(bc *BrowserClient) mcp.ToolHandler {
	return func(ctx context.Context, params json.RawMessage) (*mcp.ToolResult, error) {
		if bc == nil {
			return mcp.ErrorResult(browserNotConnected), nil
		}

		listCtx, cancel := context.WithTimeout(bc.allocCtx, defaultBrowserTimeout)
		defer cancel()

		targets, err := chromedp.Targets(listCtx)
		if err != nil {
			return mcp.ErrorResult("failed to list browser tabs: " + err.Error()), nil
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
					ID:    string(t.TargetID),
					Title: t.Title,
					URL:   t.URL,
				})
			}
		}

		result := map[string]interface{}{
			"tabs":  tabs,
			"count": len(tabs),
		}
		return jsonResult(result)
	}
}

func makeBrowserNavigate(bc *BrowserClient) mcp.ToolHandler {
	return func(ctx context.Context, params json.RawMessage) (*mcp.ToolResult, error) {
		if bc == nil {
			return mcp.ErrorResult(browserNotConnected), nil
		}

		var input struct {
			URL   string `json:"url"`
			TabID string `json:"tab_id"`
		}
		if err := json.Unmarshal(params, &input); err != nil {
			return mcp.ErrorResult("invalid params: " + err.Error()), nil
		}
		if input.URL == "" {
			return mcp.ErrorResult("url is required"), nil
		}

		findCtx, findCancel := context.WithTimeout(bc.allocCtx, defaultBrowserTimeout)
		defer findCancel()

		tgt, err := findPageTarget(findCtx, bc, input.TabID)
		if err != nil {
			return mcp.ErrorResult(err.Error()), nil
		}

		tabCtx, tabCancel := newTabContext(bc, tgt.TargetID, 15*time.Second)
		defer tabCancel()

		var title string
		if err := chromedp.Run(tabCtx,
			chromedp.Navigate(input.URL),
			chromedp.Title(&title),
		); err != nil {
			return mcp.ErrorResult("navigation failed: " + err.Error()), nil
		}

		result := map[string]interface{}{
			"url":   input.URL,
			"title": title,
		}
		return jsonResult(result)
	}
}

func makeBrowserScreenshot(bc *BrowserClient) mcp.ToolHandler {
	return func(ctx context.Context, params json.RawMessage) (*mcp.ToolResult, error) {
		if bc == nil {
			return mcp.ErrorResult(browserNotConnected), nil
		}

		var input struct {
			TabID    string `json:"tab_id"`
			Selector string `json:"selector"`
			FullPage bool   `json:"full_page"`
		}
		if err := json.Unmarshal(params, &input); err != nil {
			return mcp.ErrorResult("invalid params: " + err.Error()), nil
		}

		userCtx := auth.UserContextFromContext(ctx)
		orgID := "default"
		if userCtx != nil {
			orgID = userCtx.OrgID
		}

		findCtx, findCancel := context.WithTimeout(bc.allocCtx, defaultBrowserTimeout)
		defer findCancel()

		tgt, err := findPageTarget(findCtx, bc, input.TabID)
		if err != nil {
			return mcp.ErrorResult(err.Error()), nil
		}

		tabCtx, tabCancel := newTabContext(bc, tgt.TargetID, 15*time.Second)
		defer tabCancel()

		var buf []byte

		switch {
		case input.Selector != "":
			// Screenshot a specific element.
			if err := chromedp.Run(tabCtx,
				chromedp.Screenshot(input.Selector, &buf, chromedp.NodeVisible),
			); err != nil {
				return mcp.ErrorResult("element screenshot failed: " + err.Error()), nil
			}

		case input.FullPage:
			// Full-page screenshot.
			if err := chromedp.Run(tabCtx,
				chromedp.FullScreenshot(&buf, 90),
			); err != nil {
				return mcp.ErrorResult("full-page screenshot failed: " + err.Error()), nil
			}

		default:
			// Viewport screenshot.
			if err := chromedp.Run(tabCtx,
				chromedp.ActionFunc(func(ctx context.Context) error {
					var err error
					buf, err = page.CaptureScreenshot().
						WithFormat(page.CaptureScreenshotFormatPng).
						Do(ctx)
					return err
				}),
			); err != nil {
				return mcp.ErrorResult("screenshot failed: " + err.Error()), nil
			}
		}

		// Save the screenshot to disk.
		dir, err := ensureScreenshotDir(orgID)
		if err != nil {
			return mcp.ErrorResult("failed to create screenshot directory: " + err.Error()), nil
		}

		timestamp := time.Now().UTC().Format("20060102-150405")
		fileName := fmt.Sprintf("screenshot-%s.png", timestamp)
		filePath := filepath.Join(dir, fileName)

		if err := os.WriteFile(filePath, buf, 0644); err != nil {
			return mcp.ErrorResult("failed to write screenshot: " + err.Error()), nil
		}

		result := map[string]interface{}{
			"file_path":  filePath,
			"size_bytes": len(buf),
		}
		return jsonResult(result)
	}
}

func makeBrowserEval(bc *BrowserClient) mcp.ToolHandler {
	return func(ctx context.Context, params json.RawMessage) (*mcp.ToolResult, error) {
		if bc == nil {
			return mcp.ErrorResult(browserNotConnected), nil
		}

		var input struct {
			Expression string `json:"expression"`
			TabID      string `json:"tab_id"`
		}
		if err := json.Unmarshal(params, &input); err != nil {
			return mcp.ErrorResult("invalid params: " + err.Error()), nil
		}
		if input.Expression == "" {
			return mcp.ErrorResult("expression is required"), nil
		}

		findCtx, findCancel := context.WithTimeout(bc.allocCtx, defaultBrowserTimeout)
		defer findCancel()

		tgt, err := findPageTarget(findCtx, bc, input.TabID)
		if err != nil {
			return mcp.ErrorResult(err.Error()), nil
		}

		tabCtx, tabCancel := newTabContext(bc, tgt.TargetID, defaultBrowserTimeout)
		defer tabCancel()

		var res interface{}
		if err := chromedp.Run(tabCtx,
			chromedp.Evaluate(input.Expression, &res),
		); err != nil {
			return mcp.ErrorResult("eval failed: " + err.Error()), nil
		}

		result := map[string]interface{}{
			"result": res,
		}
		return jsonResult(result)
	}
}

func makeBrowserDOM(bc *BrowserClient) mcp.ToolHandler {
	return func(ctx context.Context, params json.RawMessage) (*mcp.ToolResult, error) {
		if bc == nil {
			return mcp.ErrorResult(browserNotConnected), nil
		}

		var input struct {
			Selector    string `json:"selector"`
			TabID       string `json:"tab_id"`
			MaxElements int    `json:"max_elements"`
		}
		if err := json.Unmarshal(params, &input); err != nil {
			return mcp.ErrorResult("invalid params: " + err.Error()), nil
		}
		if input.Selector == "" {
			return mcp.ErrorResult("selector is required"), nil
		}
		if input.MaxElements <= 0 {
			input.MaxElements = 10
		}

		findCtx, findCancel := context.WithTimeout(bc.allocCtx, defaultBrowserTimeout)
		defer findCancel()

		tgt, err := findPageTarget(findCtx, bc, input.TabID)
		if err != nil {
			return mcp.ErrorResult(err.Error()), nil
		}

		tabCtx, tabCancel := newTabContext(bc, tgt.TargetID, defaultBrowserTimeout)
		defer tabCancel()

		// Use JavaScript to extract element info — this gives us richer data
		// than chromedp.Nodes and avoids serialization issues with DOM node types.
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
			return mcp.ErrorResult("DOM query failed: " + err.Error()), nil
		}

		return jsonResult(res)
	}
}

func makeBrowserClick(bc *BrowserClient) mcp.ToolHandler {
	return func(ctx context.Context, params json.RawMessage) (*mcp.ToolResult, error) {
		if bc == nil {
			return mcp.ErrorResult(browserNotConnected), nil
		}

		var input struct {
			Selector string `json:"selector"`
			TabID    string `json:"tab_id"`
		}
		if err := json.Unmarshal(params, &input); err != nil {
			return mcp.ErrorResult("invalid params: " + err.Error()), nil
		}
		if input.Selector == "" {
			return mcp.ErrorResult("selector is required"), nil
		}

		findCtx, findCancel := context.WithTimeout(bc.allocCtx, defaultBrowserTimeout)
		defer findCancel()

		tgt, err := findPageTarget(findCtx, bc, input.TabID)
		if err != nil {
			return mcp.ErrorResult(err.Error()), nil
		}

		tabCtx, tabCancel := newTabContext(bc, tgt.TargetID, defaultBrowserTimeout)
		defer tabCancel()

		if err := chromedp.Run(tabCtx,
			chromedp.Click(input.Selector, chromedp.NodeVisible),
		); err != nil {
			return mcp.ErrorResult("click failed: " + err.Error()), nil
		}

		result := map[string]interface{}{
			"clicked":  true,
			"selector": input.Selector,
		}
		return jsonResult(result)
	}
}
