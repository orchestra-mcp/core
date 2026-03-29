package tools

import (
	"context"
	"encoding/json"
	"net/http"
	"os"
	"strings"
	"testing"

	"github.com/orchestra-mcp/server/internal/auth"
	"github.com/orchestra-mcp/server/internal/mcp"
)

// ---------------------------------------------------------------------------
// Browser test helpers
// ---------------------------------------------------------------------------

// skipIfNoCDP skips the test when Chrome CDP is not reachable.
func skipIfNoCDP(t *testing.T) {
	t.Helper()
	cdpURL := os.Getenv("CHROME_CDP_URL")
	if cdpURL == "" {
		cdpURL = "http://localhost:9222"
	}
	resp, err := http.Get(cdpURL + "/json/version")
	if err != nil || resp.StatusCode != 200 {
		t.Skip("Chrome CDP not available — skipping browser tests")
	}
	resp.Body.Close()
}

// browserTestEnv holds a BrowserClient, tool registry, and auth context for
// browser integration tests. Similar to localTestEnv but backed by a real
// Chrome CDP connection.
type browserTestEnv struct {
	bc       *BrowserClient
	registry *mcp.ToolRegistry
	ctx      context.Context
	orgID    string
}

// newBrowserTestEnv connects to Chrome via CDP, registers all browser tools,
// and injects a fake auth context. It calls t.Cleanup to close the client.
func newBrowserTestEnv(t *testing.T) *browserTestEnv {
	t.Helper()
	skipIfNoCDP(t)

	cdpURL := os.Getenv("CHROME_CDP_URL")
	if cdpURL == "" {
		cdpURL = "http://localhost:9222"
	}

	bc, err := NewBrowserClient(cdpURL)
	if err != nil {
		t.Fatalf("failed to connect to Chrome CDP at %s: %v", cdpURL, err)
	}
	t.Cleanup(func() { bc.Close() })

	registry := mcp.NewToolRegistry()
	RegisterBrowserTools(registry, bc)

	orgID := "test-org-browser"

	ctx := auth.WithUserContext(context.Background(), &auth.UserContext{
		TokenID: "test-token",
		UserID:  "test-user-browser",
		OrgID:   orgID,
		Scopes:  []string{"*"},
		Plan:    "enterprise",
	})

	return &browserTestEnv{
		bc:       bc,
		registry: registry,
		ctx:      ctx,
		orgID:    orgID,
	}
}

// call invokes a tool by name and returns the raw JSON text response and
// whether the result was flagged as an error.
func (e *browserTestEnv) call(t *testing.T, toolName string, args interface{}) (string, bool) {
	t.Helper()
	params, err := json.Marshal(args)
	if err != nil {
		t.Fatalf("marshal params for %s: %v", toolName, err)
	}
	result, err := e.registry.Call(e.ctx, toolName, json.RawMessage(params))
	if err != nil {
		t.Fatalf("unexpected Go error from %s: %v", toolName, err)
	}
	if len(result.Content) == 0 {
		t.Fatalf("%s returned empty content", toolName)
	}
	return result.Content[0].Text, result.IsError
}

// mustCall calls a tool and fails the test if the result is an error.
func (e *browserTestEnv) mustCall(t *testing.T, toolName string, args interface{}) string {
	t.Helper()
	text, isErr := e.call(t, toolName, args)
	if isErr {
		t.Fatalf("%s returned error: %s", toolName, text)
	}
	return text
}

// expectError calls a tool and fails the test if the result is NOT an error.
func (e *browserTestEnv) expectError(t *testing.T, toolName string, args interface{}) string {
	t.Helper()
	text, isErr := e.call(t, toolName, args)
	if !isErr {
		t.Fatalf("expected %s to return error, got success: %s", toolName, text)
	}
	return text
}

// parseBrowserResponse unmarshals a JSON text response into a map.
func parseBrowserResponse(t *testing.T, raw string) map[string]interface{} {
	t.Helper()
	var m map[string]interface{}
	if err := json.Unmarshal([]byte(raw), &m); err != nil {
		t.Fatalf("failed to parse response as JSON: %v\nraw: %.500s", err, raw)
	}
	return m
}

// navigateToExample is a convenience that navigates to https://example.com
// and verifies it succeeded before returning. Used as setup for many tests.
func (e *browserTestEnv) navigateToExample(t *testing.T) {
	t.Helper()
	raw := e.mustCall(t, "browser_navigate", map[string]interface{}{
		"url": "https://example.com",
	})
	resp := parseBrowserResponse(t, raw)
	if resp["url"] != "https://example.com" {
		t.Fatalf("navigate did not return expected url, got: %v", resp["url"])
	}
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

func TestBrowserTabs(t *testing.T) {
	env := newBrowserTestEnv(t)

	raw := env.mustCall(t, "browser_tabs", map[string]interface{}{})
	resp := parseBrowserResponse(t, raw)

	// Verify tab count is at least 1.
	count, ok := resp["count"].(float64)
	if !ok {
		t.Fatal("expected count field in response")
	}
	if int(count) < 1 {
		t.Fatalf("expected at least 1 tab, got %d", int(count))
	}

	// Verify tabs array exists and has the required fields.
	tabs, ok := resp["tabs"].([]interface{})
	if !ok || len(tabs) == 0 {
		t.Fatal("expected non-empty tabs array")
	}

	firstTab, ok := tabs[0].(map[string]interface{})
	if !ok {
		t.Fatal("expected first tab to be an object")
	}

	// Check that id, title, and url fields are present.
	for _, field := range []string{"id", "title", "url"} {
		if _, exists := firstTab[field]; !exists {
			t.Errorf("tab missing required field %q", field)
		}
	}

	// id must be a non-empty string (it is a Chrome target ID).
	if id, ok := firstTab["id"].(string); !ok || id == "" {
		t.Error("tab id should be a non-empty string")
	}
}

func TestBrowserNavigate(t *testing.T) {
	env := newBrowserTestEnv(t)

	raw := env.mustCall(t, "browser_navigate", map[string]interface{}{
		"url": "https://example.com",
	})
	resp := parseBrowserResponse(t, raw)

	// Verify response contains url and title.
	if resp["url"] != "https://example.com" {
		t.Errorf("expected url=https://example.com, got %v", resp["url"])
	}

	title, ok := resp["title"].(string)
	if !ok || title == "" {
		t.Fatal("expected non-empty title in response")
	}
	if !strings.Contains(title, "Example") {
		t.Errorf("expected title to contain 'Example', got %q", title)
	}

	t.Run("missing url returns error", func(t *testing.T) {
		errText := env.expectError(t, "browser_navigate", map[string]interface{}{})
		if !strings.Contains(errText, "url is required") {
			t.Errorf("expected 'url is required' error, got: %s", errText)
		}
	})
}

func TestBrowserScreenshot(t *testing.T) {
	env := newBrowserTestEnv(t)

	// Navigate to a page first so there is content to screenshot.
	env.navigateToExample(t)

	raw := env.mustCall(t, "browser_screenshot", map[string]interface{}{})
	resp := parseBrowserResponse(t, raw)

	// Verify file_path is present and non-empty.
	filePath, ok := resp["file_path"].(string)
	if !ok || filePath == "" {
		t.Fatal("expected non-empty file_path in response")
	}

	// Register cleanup to remove the screenshot file.
	t.Cleanup(func() { os.Remove(filePath) })

	// Verify the file actually exists on disk.
	info, err := os.Stat(filePath)
	if err != nil {
		t.Fatalf("screenshot file does not exist at %s: %v", filePath, err)
	}
	if info.Size() == 0 {
		t.Fatal("screenshot file is empty")
	}

	// Read the first 4 bytes and verify the PNG magic header.
	data, err := os.ReadFile(filePath)
	if err != nil {
		t.Fatalf("failed to read screenshot file: %v", err)
	}
	pngHeader := []byte{0x89, 0x50, 0x4E, 0x47}
	if len(data) < 4 || data[0] != pngHeader[0] || data[1] != pngHeader[1] ||
		data[2] != pngHeader[2] || data[3] != pngHeader[3] {
		t.Errorf("file does not start with PNG header, first 4 bytes: %x", data[:4])
	}

	// Verify size_bytes in response matches actual file size.
	sizeBytes, ok := resp["size_bytes"].(float64)
	if !ok {
		t.Fatal("expected size_bytes in response")
	}
	if int(sizeBytes) <= 0 {
		t.Errorf("expected size_bytes > 0, got %d", int(sizeBytes))
	}
	if int(sizeBytes) != len(data) {
		t.Errorf("size_bytes mismatch: response=%d, actual=%d", int(sizeBytes), len(data))
	}
}

func TestBrowserEval(t *testing.T) {
	env := newBrowserTestEnv(t)

	// Navigate to example.com first so there is a page context.
	env.navigateToExample(t)

	t.Run("evaluate document.title", func(t *testing.T) {
		raw := env.mustCall(t, "browser_eval", map[string]interface{}{
			"expression": "document.title",
		})
		resp := parseBrowserResponse(t, raw)

		result, ok := resp["result"].(string)
		if !ok {
			t.Fatalf("expected result to be a string, got %T: %v", resp["result"], resp["result"])
		}
		if !strings.Contains(result, "Example") {
			t.Errorf("expected result to contain 'Example', got %q", result)
		}
	})

	t.Run("evaluate arithmetic expression", func(t *testing.T) {
		raw := env.mustCall(t, "browser_eval", map[string]interface{}{
			"expression": "1 + 1",
		})
		resp := parseBrowserResponse(t, raw)

		// JSON numbers decode as float64 in Go.
		result, ok := resp["result"].(float64)
		if !ok {
			t.Fatalf("expected result to be a number, got %T: %v", resp["result"], resp["result"])
		}
		if result != 2 {
			t.Errorf("expected result=2, got %v", result)
		}
	})

	t.Run("evaluate invalid JS returns error", func(t *testing.T) {
		errText := env.expectError(t, "browser_eval", map[string]interface{}{
			"expression": "this.is.not.valid.property.chain.that.will.throw()",
		})
		if errText == "" {
			t.Error("expected non-empty error text for invalid JS")
		}
	})

	t.Run("missing expression returns error", func(t *testing.T) {
		errText := env.expectError(t, "browser_eval", map[string]interface{}{})
		if !strings.Contains(errText, "expression is required") {
			t.Errorf("expected 'expression is required' error, got: %s", errText)
		}
	})
}

func TestBrowserDom(t *testing.T) {
	env := newBrowserTestEnv(t)

	// Navigate to example.com first.
	env.navigateToExample(t)

	t.Run("query h1 selector", func(t *testing.T) {
		raw := env.mustCall(t, "browser_dom", map[string]interface{}{
			"selector": "h1",
		})
		resp := parseBrowserResponse(t, raw)

		// Verify elements array has at least 1 element.
		elements, ok := resp["elements"].([]interface{})
		if !ok || len(elements) == 0 {
			t.Fatal("expected at least 1 element matching 'h1'")
		}

		firstEl, ok := elements[0].(map[string]interface{})
		if !ok {
			t.Fatal("expected first element to be an object")
		}

		// The DOM query JS returns tag in lowercase, but the task spec says
		// to check for "H1". The implementation uses el.tagName.toLowerCase()
		// so we check for "h1".
		tag, ok := firstEl["tag"].(string)
		if !ok {
			t.Fatal("expected tag field in element")
		}
		if !strings.EqualFold(tag, "h1") {
			t.Errorf("expected tag to be 'h1' (case-insensitive), got %q", tag)
		}

		// Verify count field reflects total matches.
		count, ok := resp["count"].(float64)
		if !ok {
			t.Fatal("expected count field in response")
		}
		if int(count) < 1 {
			t.Errorf("expected count >= 1, got %d", int(count))
		}
	})

	t.Run("query non-existent selector returns 0 elements", func(t *testing.T) {
		raw := env.mustCall(t, "browser_dom", map[string]interface{}{
			"selector": "#this-id-does-not-exist-anywhere",
		})
		resp := parseBrowserResponse(t, raw)

		count, ok := resp["count"].(float64)
		if !ok {
			t.Fatal("expected count field in response")
		}
		if int(count) != 0 {
			t.Errorf("expected 0 elements for non-existent selector, got %d", int(count))
		}

		// elements should be an empty array or nil.
		elements, _ := resp["elements"].([]interface{})
		if len(elements) != 0 {
			t.Errorf("expected empty elements array, got %d elements", len(elements))
		}
	})

	t.Run("missing selector returns error", func(t *testing.T) {
		errText := env.expectError(t, "browser_dom", map[string]interface{}{})
		if !strings.Contains(errText, "selector is required") {
			t.Errorf("expected 'selector is required' error, got: %s", errText)
		}
	})
}

func TestBrowserClick(t *testing.T) {
	env := newBrowserTestEnv(t)

	// Navigate to example.com first.
	env.navigateToExample(t)

	t.Run("click on link element", func(t *testing.T) {
		raw := env.mustCall(t, "browser_click", map[string]interface{}{
			"selector": "a",
		})
		resp := parseBrowserResponse(t, raw)

		clicked, ok := resp["clicked"].(bool)
		if !ok || !clicked {
			t.Errorf("expected clicked=true, got %v", resp["clicked"])
		}

		selector, ok := resp["selector"].(string)
		if !ok || selector != "a" {
			t.Errorf("expected selector='a' in response, got %v", resp["selector"])
		}
	})

	t.Run("click non-existent selector returns error", func(t *testing.T) {
		// Re-navigate since the click above may have changed the page.
		env.navigateToExample(t)

		errText := env.expectError(t, "browser_click", map[string]interface{}{
			"selector": "#non-existent-element-99999",
		})
		if errText == "" {
			t.Error("expected non-empty error text for non-existent selector")
		}
	})

	t.Run("missing selector returns error", func(t *testing.T) {
		errText := env.expectError(t, "browser_click", map[string]interface{}{})
		if !strings.Contains(errText, "selector is required") {
			t.Errorf("expected 'selector is required' error, got: %s", errText)
		}
	})
}
