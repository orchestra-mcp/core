package twin

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/gorilla/websocket"
)

// ---------------------------------------------------------------------------
// WebSocket helpers
// ---------------------------------------------------------------------------

// newTestBridge creates a TwinBridge with a known token for testing.
func newTestBridge(maxAlerts int) *TwinBridge {
	tb := NewTwinBridge(Config{Port: 0, MaxAlerts: maxAlerts})
	tb.token = "test-token-1234"
	tb.startAt = time.Now()
	return tb
}

// dialTestServer starts an httptest.Server with the given handler and returns
// a connected gorilla websocket client.
func dialTestServer(t *testing.T, handler http.HandlerFunc) (*websocket.Conn, *httptest.Server) {
	t.Helper()
	srv := httptest.NewServer(handler)
	t.Cleanup(srv.Close)

	// Replace http:// with ws://
	wsURL := "ws" + strings.TrimPrefix(srv.URL, "http") + "/"
	conn, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
	if err != nil {
		t.Fatalf("dial ws: %v", err)
	}
	t.Cleanup(func() { conn.Close() })
	return conn, srv
}

// ---------------------------------------------------------------------------
// Auth tests
// ---------------------------------------------------------------------------

func TestWS_AuthSuccess(t *testing.T) {
	tb := newTestBridge(100)

	conn, _ := dialTestServer(t, func(w http.ResponseWriter, r *http.Request) {
		// Fake remote addr as loopback for the upgrader check.
		r.RemoteAddr = "127.0.0.1:99999"
		c, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			return
		}
		defer c.Close()
		tb.handleConnection(c)
	})

	// Send valid auth.
	sendWSJSON(t, conn, authMessage{
		Type:        "auth",
		Token:       "test-token-1234",
		ExtensionID: "ext-abc",
	})

	// Expect auth_ok.
	var resp map[string]string
	readWSJSON(t, conn, &resp)
	if resp["type"] != "auth_ok" {
		t.Errorf("expected auth_ok, got %q", resp["type"])
	}
}

func TestWS_AuthFail_WrongToken(t *testing.T) {
	tb := newTestBridge(100)

	conn, _ := dialTestServer(t, func(w http.ResponseWriter, r *http.Request) {
		r.RemoteAddr = "127.0.0.1:99999"
		c, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			return
		}
		defer c.Close()
		tb.handleConnection(c)
	})

	sendWSJSON(t, conn, authMessage{
		Type:        "auth",
		Token:       "wrong-token",
		ExtensionID: "ext-abc",
	})

	var resp map[string]string
	readWSJSON(t, conn, &resp)
	if resp["type"] != "error" {
		t.Errorf("expected error, got %q", resp["type"])
	}
}

func TestWS_AuthFail_MissingExtensionID(t *testing.T) {
	tb := newTestBridge(100)

	conn, _ := dialTestServer(t, func(w http.ResponseWriter, r *http.Request) {
		r.RemoteAddr = "127.0.0.1:99999"
		c, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			return
		}
		defer c.Close()
		tb.handleConnection(c)
	})

	sendWSJSON(t, conn, authMessage{
		Type:        "auth",
		Token:       "test-token-1234",
		ExtensionID: "", // missing
	})

	var resp map[string]string
	readWSJSON(t, conn, &resp)
	if resp["type"] != "error" {
		t.Errorf("expected error for missing extension_id, got %q", resp["type"])
	}
}

// ---------------------------------------------------------------------------
// Event ingestion test
// ---------------------------------------------------------------------------

func TestWS_EventStoredInAlertStore(t *testing.T) {
	tb := newTestBridge(100)

	// Run the connection handler in background.
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		r.RemoteAddr = "127.0.0.1:99999"
		c, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			return
		}
		defer c.Close()
		tb.handleConnection(c)
	}))
	t.Cleanup(srv.Close)

	wsURL := "ws" + strings.TrimPrefix(srv.URL, "http") + "/"
	conn, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
	if err != nil {
		t.Fatalf("dial: %v", err)
	}
	defer conn.Close()

	// Authenticate.
	sendWSJSON(t, conn, authMessage{
		Type:        "auth",
		Token:       "test-token-1234",
		ExtensionID: "ext-abc",
	})
	var authResp map[string]string
	readWSJSON(t, conn, &authResp)
	if authResp["type"] != "auth_ok" {
		t.Fatalf("auth failed: %v", authResp)
	}

	// Send an event.
	event := BridgeEvent{
		Source: "github",
		Type:   "mention",
		Data:   json.RawMessage(`{"body":"@me in PR #42"}`),
		Ts:     time.Now().UnixMilli(),
	}
	sendWSJSON(t, conn, event)

	// Give the server goroutine time to process.
	time.Sleep(50 * time.Millisecond)

	alerts := tb.store.GetAlerts(10, "")
	if len(alerts) == 0 {
		t.Fatal("expected alert in store after sending event")
	}
	if alerts[0].Source != "github" || alerts[0].Type != "mention" {
		t.Errorf("unexpected alert: source=%q type=%q", alerts[0].Source, alerts[0].Type)
	}
}

// ---------------------------------------------------------------------------
// Discovery file tests
// ---------------------------------------------------------------------------

func TestDiscoveryFile_WriteAndRemove(t *testing.T) {
	// Override home dir temporarily via env.
	tmpDir := t.TempDir()
	t.Setenv("HOME", tmpDir)

	if err := writeDiscoveryFile(9800, "test-token"); err != nil {
		t.Fatalf("writeDiscoveryFile: %v", err)
	}

	// Verify file exists and has the correct structure.
	path, err := discoveryPath()
	if err != nil {
		t.Fatalf("discoveryPath: %v", err)
	}
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("ReadFile: %v", err)
	}

	var info discoveryInfo
	if err := json.Unmarshal(data, &info); err != nil {
		t.Fatalf("unmarshal discovery info: %v", err)
	}
	if info.Port != 9800 {
		t.Errorf("expected port 9800, got %d", info.Port)
	}
	if info.Token != "test-token" {
		t.Errorf("expected token 'test-token', got %q", info.Token)
	}
	if info.PID != os.Getpid() {
		t.Errorf("expected PID %d, got %d", os.Getpid(), info.PID)
	}

	// Remove.
	removeDiscoveryFile()
	if _, err := os.Stat(path); !os.IsNotExist(err) {
		t.Error("expected discovery file to be removed")
	}
}

func TestDiscoveryFile_RemoveNonExistent(t *testing.T) {
	// Should not panic if file doesn't exist.
	tmpDir := t.TempDir()
	t.Setenv("HOME", tmpDir)
	removeDiscoveryFile() // no-op, no panic
}

// ---------------------------------------------------------------------------
// Token generation test
// ---------------------------------------------------------------------------

func TestGenerateToken(t *testing.T) {
	tok, err := generateToken()
	if err != nil {
		t.Fatalf("generateToken: %v", err)
	}
	if len(tok) != 64 {
		t.Errorf("expected 64 hex chars, got %d: %q", len(tok), tok)
	}

	// Tokens must be unique.
	tok2, _ := generateToken()
	if tok == tok2 {
		t.Error("generateToken produced duplicate tokens")
	}
}

// ---------------------------------------------------------------------------
// isLocalhost test
// ---------------------------------------------------------------------------

func TestIsLocalhost(t *testing.T) {
	cases := []struct {
		addr string
		want bool
	}{
		{"127.0.0.1:1234", true},
		{"::1:1234", false}, // raw IPv6 without brackets is not valid, parsed as false
		{"[::1]:1234", true},
		{"192.168.1.1:80", false},
		{"10.0.0.1:80", false},
		{"0.0.0.0:80", false},
	}
	for _, tc := range cases {
		got := isLocalhost(tc.addr)
		if got != tc.want {
			t.Errorf("isLocalhost(%q) = %v, want %v", tc.addr, got, tc.want)
		}
	}
}

// ---------------------------------------------------------------------------
// shouldNotify test
// ---------------------------------------------------------------------------

func TestShouldNotify_HighPriority(t *testing.T) {
	// Reset throttle state.
	globalThrottle.mu.Lock()
	globalThrottle.last = make(map[string]time.Time)
	globalThrottle.mu.Unlock()

	event := BridgeEvent{Source: "github", Type: "mention"}
	if !shouldNotify(event) {
		t.Error("expected high-priority mention to trigger notification")
	}
}

func TestShouldNotify_LowPriority(t *testing.T) {
	event := BridgeEvent{Source: "github", Type: "push"}
	if shouldNotify(event) {
		t.Error("low-priority push event should not trigger notification")
	}
}

func TestShouldNotify_Throttle(t *testing.T) {
	// Reset throttle state.
	globalThrottle.mu.Lock()
	globalThrottle.last = make(map[string]time.Time)
	globalThrottle.mu.Unlock()

	event := BridgeEvent{Source: "throttle-test", Type: "dm"}
	if !shouldNotify(event) {
		t.Error("first dm should trigger notification")
	}
	// Immediate second call must be throttled.
	if shouldNotify(event) {
		t.Error("second dm within cooldown should not trigger notification")
	}
}

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

func sendWSJSON(t *testing.T, conn *websocket.Conn, v interface{}) {
	t.Helper()
	data, err := json.Marshal(v)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	if err := conn.WriteMessage(websocket.TextMessage, data); err != nil {
		t.Fatalf("write ws: %v", err)
	}
}

func readWSJSON(t *testing.T, conn *websocket.Conn, v interface{}) {
	t.Helper()
	conn.SetReadDeadline(time.Now().Add(3 * time.Second))
	_, raw, err := conn.ReadMessage()
	if err != nil {
		t.Fatalf("read ws: %v", err)
	}
	if err := json.Unmarshal(raw, v); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
}
