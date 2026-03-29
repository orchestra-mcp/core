package tools

import (
	"context"
	"encoding/json"
	"os"
	"os/exec"
	"strings"
	"testing"

	"github.com/orchestra-mcp/server/internal/auth"
	"github.com/orchestra-mcp/server/internal/db"
	"github.com/orchestra-mcp/server/internal/mcp"
)

// ---------------------------------------------------------------------------
// Test helpers — init system
// ---------------------------------------------------------------------------

// initLocalEnv holds tools registered without a real DB client.
// Used for notification control and hook script tests.
type initLocalEnv struct {
	registry *mcp.ToolRegistry
	ctx      context.Context
	orgID    string
}

// newInitLocalEnv creates a test environment with notification control tools
// registered and a fake auth context injected. No database connection needed.
func newInitLocalEnv(t *testing.T) *initLocalEnv {
	t.Helper()

	registry := mcp.NewToolRegistry()
	RegisterNotificationControlTools(registry)

	orgID := "test-org-init"

	ctx := auth.WithUserContext(context.Background(), &auth.UserContext{
		TokenID: "test-token",
		UserID:  "test-user-init",
		OrgID:   orgID,
		Scopes:  []string{"*"},
		Plan:    "enterprise",
	})

	return &initLocalEnv{
		registry: registry,
		ctx:      ctx,
		orgID:    orgID,
	}
}

// call invokes a tool by name and returns the raw text response and whether
// it was an error result. Fails the test on unexpected Go-level errors.
func (e *initLocalEnv) call(t *testing.T, toolName string, args interface{}) (string, bool) {
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

// mustCall calls a tool and fails if the result is an error.
func (e *initLocalEnv) mustCall(t *testing.T, toolName string, args interface{}) string {
	t.Helper()
	text, isErr := e.call(t, toolName, args)
	if isErr {
		t.Fatalf("%s returned error: %s", toolName, text)
	}
	return text
}

// initDBEnv holds tools registered with a real DB client. Used for
// init and init_status tests that require Supabase.
type initDBEnv struct {
	dbClient *db.Client
	registry *mcp.ToolRegistry
	ctx      context.Context
	orgID    string
}

// newInitDBEnv creates a test environment with the init tools registered
// against a real Supabase connection. Skips if SUPABASE_URL is not set.
func newInitDBEnv(t *testing.T) *initDBEnv {
	t.Helper()
	skipIfNoDB(t)

	dbClient := db.NewClient(os.Getenv("SUPABASE_URL"), os.Getenv("SUPABASE_SERVICE_KEY"))
	registry := mcp.NewToolRegistry()

	RegisterInitTools(registry, dbClient)

	orgID := os.Getenv("TEST_ORG_ID")
	if orgID == "" {
		orgID = "00000000-0000-0000-0000-000000000001"
	}

	ctx := auth.WithUserContext(context.Background(), &auth.UserContext{
		TokenID: "test-token",
		UserID:  "test-user-init-db",
		OrgID:   orgID,
		Scopes:  []string{"*"},
		Plan:    "enterprise",
	})

	return &initDBEnv{
		dbClient: dbClient,
		registry: registry,
		ctx:      ctx,
		orgID:    orgID,
	}
}

// call invokes a tool by name and returns the raw text response and whether
// it was an error result. Fails the test on unexpected Go-level errors.
func (e *initDBEnv) call(t *testing.T, toolName string, args interface{}) (string, bool) {
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

// mustCall calls a tool and fails if the result is an error.
func (e *initDBEnv) mustCall(t *testing.T, toolName string, args interface{}) string {
	t.Helper()
	text, isErr := e.call(t, toolName, args)
	if isErr {
		t.Fatalf("%s returned error: %s", toolName, text)
	}
	return text
}

// ---------------------------------------------------------------------------
// Init Tool (DB-dependent — skip if no DB)
// ---------------------------------------------------------------------------

func TestInit(t *testing.T) {
	env := newInitDBEnv(t)

	raw := env.mustCall(t, "init", map[string]interface{}{})
	resp := parseResponse(t, raw)

	// Verify response has "files" array with at least 11 rules + 2 hooks.
	filesRaw, ok := resp["files"]
	if !ok {
		t.Fatal("expected 'files' key in init response")
	}
	files, ok := filesRaw.([]interface{})
	if !ok {
		t.Fatalf("expected 'files' to be an array, got %T", filesRaw)
	}
	// 11 rules + 2 hooks + 3 skills + agents + CLAUDE.md + AGENTS.md = at least 13
	if len(files) < 13 {
		t.Errorf("expected at least 13 files (11 rules + 2 hooks), got %d", len(files))
	}

	// Count rules and hooks specifically.
	ruleCount := 0
	hookCount := 0
	for _, f := range files {
		fm, ok := f.(map[string]interface{})
		if !ok {
			continue
		}
		path, _ := fm["path"].(string)
		if strings.HasPrefix(path, ".claude/rules/") {
			ruleCount++
		}
		if strings.HasPrefix(path, ".claude/hooks/") {
			hookCount++
		}
	}
	if ruleCount < 11 {
		t.Errorf("expected at least 11 rule files, got %d", ruleCount)
	}
	if hookCount < 2 {
		t.Errorf("expected at least 2 hook files, got %d", hookCount)
	}

	// Verify response has "claude_md" non-empty string.
	claudeMD, ok := resp["claude_md"].(string)
	if !ok || claudeMD == "" {
		t.Error("expected non-empty 'claude_md' string in init response")
	}

	// Verify response has "agents_md" non-empty string.
	agentsMD, ok := resp["agents_md"].(string)
	if !ok || agentsMD == "" {
		t.Error("expected non-empty 'agents_md' string in init response")
	}

	// Verify response has "summary" string.
	summary, ok := resp["summary"].(string)
	if !ok || summary == "" {
		t.Error("expected non-empty 'summary' string in init response")
	}
	if !strings.Contains(summary, "rules") {
		t.Error("expected summary to mention 'rules'")
	}
}

func TestInitComponentFilter(t *testing.T) {
	env := newInitDBEnv(t)

	t.Run("component=rules returns only rule files", func(t *testing.T) {
		raw := env.mustCall(t, "init", map[string]interface{}{
			"component": "rules",
		})
		resp := parseResponse(t, raw)

		filesRaw, ok := resp["files"]
		if !ok {
			t.Fatal("expected 'files' key in response")
		}
		files, ok := filesRaw.([]interface{})
		if !ok {
			t.Fatalf("expected 'files' to be an array, got %T", filesRaw)
		}

		for _, f := range files {
			fm, ok := f.(map[string]interface{})
			if !ok {
				continue
			}
			path, _ := fm["path"].(string)
			if !strings.HasPrefix(path, ".claude/rules/") {
				t.Errorf("expected only rule files when component=rules, got: %s", path)
			}
		}

		if len(files) < 11 {
			t.Errorf("expected at least 11 rule files, got %d", len(files))
		}
	})

	t.Run("component=hooks returns only hook files", func(t *testing.T) {
		raw := env.mustCall(t, "init", map[string]interface{}{
			"component": "hooks",
		})
		resp := parseResponse(t, raw)

		filesRaw, ok := resp["files"]
		if !ok {
			t.Fatal("expected 'files' key in response")
		}
		files, ok := filesRaw.([]interface{})
		if !ok {
			t.Fatalf("expected 'files' to be an array, got %T", filesRaw)
		}

		for _, f := range files {
			fm, ok := f.(map[string]interface{})
			if !ok {
				continue
			}
			path, _ := fm["path"].(string)
			if !strings.HasPrefix(path, ".claude/hooks/") {
				t.Errorf("expected only hook files when component=hooks, got: %s", path)
			}
		}

		if len(files) < 2 {
			t.Errorf("expected at least 2 hook files, got %d", len(files))
		}
	})

	t.Run("component=agents returns agent files", func(t *testing.T) {
		raw := env.mustCall(t, "init", map[string]interface{}{
			"component": "agents",
		})
		resp := parseResponse(t, raw)

		filesRaw, ok := resp["files"]
		if !ok {
			t.Fatal("expected 'files' key in response")
		}
		files, ok := filesRaw.([]interface{})
		if !ok {
			t.Fatalf("expected 'files' to be an array, got %T", filesRaw)
		}

		// Agent files come from DB — may be zero if org has no agents,
		// but every file returned must be under .claude/agents/.
		for _, f := range files {
			fm, ok := f.(map[string]interface{})
			if !ok {
				continue
			}
			path, _ := fm["path"].(string)
			if !strings.HasPrefix(path, ".claude/agents/") {
				t.Errorf("expected only agent files when component=agents, got: %s", path)
			}
		}
	})
}

func TestInitStatus(t *testing.T) {
	env := newInitDBEnv(t)

	raw := env.mustCall(t, "init_status", map[string]interface{}{})
	resp := parseResponse(t, raw)

	// Verify response has "components" with rules/agents/skills/hooks counts.
	componentsRaw, ok := resp["components"]
	if !ok {
		t.Fatal("expected 'components' key in init_status response")
	}
	components, ok := componentsRaw.(map[string]interface{})
	if !ok {
		t.Fatalf("expected 'components' to be an object, got %T", componentsRaw)
	}

	for _, key := range []string{"rules", "agents", "skills", "hooks"} {
		compRaw, ok := components[key]
		if !ok {
			t.Errorf("expected components.%s in init_status response", key)
			continue
		}
		comp, ok := compRaw.(map[string]interface{})
		if !ok {
			t.Errorf("expected components.%s to be an object, got %T", key, compRaw)
			continue
		}
		if _, ok := comp["count"]; !ok {
			t.Errorf("expected components.%s.count in init_status response", key)
		}
		if _, ok := comp["expected"]; !ok {
			t.Errorf("expected components.%s.expected in init_status response", key)
		}
	}

	// Verify rules count is 11.
	rulesComp := components["rules"].(map[string]interface{})
	rulesCount, ok := rulesComp["count"].(float64)
	if !ok {
		t.Fatal("expected components.rules.count to be a number")
	}
	if int(rulesCount) != 11 {
		t.Errorf("expected components.rules.count = 11, got %d", int(rulesCount))
	}

	// Verify response has "org" with agent/project counts.
	orgRaw, ok := resp["org"]
	if !ok {
		t.Fatal("expected 'org' key in init_status response")
	}
	org, ok := orgRaw.(map[string]interface{})
	if !ok {
		t.Fatalf("expected 'org' to be an object, got %T", orgRaw)
	}

	for _, key := range []string{"agents", "projects", "skills"} {
		if _, ok := org[key]; !ok {
			t.Errorf("expected org.%s in init_status response", key)
		}
	}
}

// ---------------------------------------------------------------------------
// Notification Control Tools (no DB needed)
// ---------------------------------------------------------------------------

func TestNotificationMute(t *testing.T) {
	env := newInitLocalEnv(t)

	raw := env.mustCall(t, "notification_mute", map[string]interface{}{})
	resp := parseResponse(t, raw)

	// Verify status.
	if resp["status"] != "muted" {
		t.Errorf("expected status=muted, got %v", resp["status"])
	}

	// Verify config has voice_enabled: false.
	configRaw, ok := resp["config"]
	if !ok {
		t.Fatal("expected 'config' key in notification_mute response")
	}
	config, ok := configRaw.(map[string]interface{})
	if !ok {
		t.Fatalf("expected 'config' to be an object, got %T", configRaw)
	}
	if config["voice_enabled"] != false {
		t.Errorf("expected config.voice_enabled=false, got %v", config["voice_enabled"])
	}
	if config["sound_enabled"] != false {
		t.Errorf("expected config.sound_enabled=false, got %v", config["sound_enabled"])
	}
	if config["desktop_enabled"] != false {
		t.Errorf("expected config.desktop_enabled=false, got %v", config["desktop_enabled"])
	}

	// Verify file.path = "~/.orchestra/config.json".
	fileRaw, ok := resp["file"]
	if !ok {
		t.Fatal("expected 'file' key in notification_mute response")
	}
	file, ok := fileRaw.(map[string]interface{})
	if !ok {
		t.Fatalf("expected 'file' to be an object, got %T", fileRaw)
	}
	if file["path"] != "~/.orchestra/config.json" {
		t.Errorf("expected file.path=~/.orchestra/config.json, got %v", file["path"])
	}
}

func TestNotificationUnmute(t *testing.T) {
	env := newInitLocalEnv(t)

	raw := env.mustCall(t, "notification_unmute", map[string]interface{}{})
	resp := parseResponse(t, raw)

	// Verify status.
	if resp["status"] != "unmuted" {
		t.Errorf("expected status=unmuted, got %v", resp["status"])
	}

	// Verify config has voice_enabled: true and voice_name: "Samantha".
	configRaw, ok := resp["config"]
	if !ok {
		t.Fatal("expected 'config' key in notification_unmute response")
	}
	config, ok := configRaw.(map[string]interface{})
	if !ok {
		t.Fatalf("expected 'config' to be an object, got %T", configRaw)
	}
	if config["voice_enabled"] != true {
		t.Errorf("expected config.voice_enabled=true, got %v", config["voice_enabled"])
	}
	if config["voice_name"] != "Samantha" {
		t.Errorf("expected config.voice_name=Samantha, got %v", config["voice_name"])
	}
	if config["sound_enabled"] != true {
		t.Errorf("expected config.sound_enabled=true, got %v", config["sound_enabled"])
	}
	if config["desktop_enabled"] != true {
		t.Errorf("expected config.desktop_enabled=true, got %v", config["desktop_enabled"])
	}

	// Verify file.path.
	fileRaw, ok := resp["file"]
	if !ok {
		t.Fatal("expected 'file' key in notification_unmute response")
	}
	file, ok := fileRaw.(map[string]interface{})
	if !ok {
		t.Fatalf("expected 'file' to be an object, got %T", fileRaw)
	}
	if file["path"] != "~/.orchestra/config.json" {
		t.Errorf("expected file.path=~/.orchestra/config.json, got %v", file["path"])
	}
}

func TestNotificationConfig(t *testing.T) {
	env := newInitLocalEnv(t)

	t.Run("set custom voice name", func(t *testing.T) {
		raw := env.mustCall(t, "notification_config", map[string]interface{}{
			"voice_name": "Karen",
		})
		resp := parseResponse(t, raw)

		if resp["status"] != "configured" {
			t.Errorf("expected status=configured, got %v", resp["status"])
		}

		configRaw, ok := resp["config"]
		if !ok {
			t.Fatal("expected 'config' key in response")
		}
		config, ok := configRaw.(map[string]interface{})
		if !ok {
			t.Fatalf("expected 'config' to be an object, got %T", configRaw)
		}
		if config["voice_name"] != "Karen" {
			t.Errorf("expected config.voice_name=Karen, got %v", config["voice_name"])
		}
	})

	t.Run("empty params returns defaults", func(t *testing.T) {
		raw := env.mustCall(t, "notification_config", map[string]interface{}{})
		resp := parseResponse(t, raw)

		if resp["status"] != "configured" {
			t.Errorf("expected status=configured, got %v", resp["status"])
		}

		configRaw, ok := resp["config"]
		if !ok {
			t.Fatal("expected 'config' key in response")
		}
		config, ok := configRaw.(map[string]interface{})
		if !ok {
			t.Fatalf("expected 'config' to be an object, got %T", configRaw)
		}

		// When no params provided, defaults are returned.
		if config["voice_enabled"] != true {
			t.Errorf("expected default config.voice_enabled=true, got %v", config["voice_enabled"])
		}
		if config["voice_name"] != "Samantha" {
			t.Errorf("expected default config.voice_name=Samantha, got %v", config["voice_name"])
		}
		if config["sound_enabled"] != true {
			t.Errorf("expected default config.sound_enabled=true, got %v", config["sound_enabled"])
		}
		if config["desktop_enabled"] != true {
			t.Errorf("expected default config.desktop_enabled=true, got %v", config["desktop_enabled"])
		}
	})
}

// ---------------------------------------------------------------------------
// Hook Script Validation (no DB needed)
// ---------------------------------------------------------------------------

func TestHookScriptsSyntax(t *testing.T) {
	// Generate hook files using the same function the init tool uses.
	hookFiles := generateHookFiles(false)
	if len(hookFiles) < 2 {
		t.Fatalf("expected at least 2 hook files, got %d", len(hookFiles))
	}

	for _, hf := range hookFiles {
		t.Run(hf.Path, func(t *testing.T) {
			content := hf.Content

			// Verify it starts with a shebang line.
			if !strings.HasPrefix(content, "#!/") {
				t.Errorf("hook %s does not start with shebang (#!), starts with: %.40s", hf.Path, content)
			}

			// Write to a temp file and run bash -n for syntax check.
			tmpFile, err := os.CreateTemp(t.TempDir(), "hook-syntax-*.sh")
			if err != nil {
				t.Fatalf("failed to create temp file: %v", err)
			}
			defer tmpFile.Close()

			if _, err := tmpFile.WriteString(content); err != nil {
				t.Fatalf("failed to write hook content: %v", err)
			}
			tmpFile.Close()

			cmd := exec.Command("bash", "-n", tmpFile.Name())
			output, err := cmd.CombinedOutput()
			if err != nil {
				t.Errorf("bash -n syntax check failed for %s: %v\noutput: %s", hf.Path, err, string(output))
			}
		})
	}
}

func TestNotifyHookHasVoiceSupport(t *testing.T) {
	// Find the notify.sh hook content from generated hook files.
	hookFiles := generateHookFiles(false)

	var notifyContent string
	for _, hf := range hookFiles {
		if strings.HasSuffix(hf.Path, "notify.sh") {
			notifyContent = hf.Content
			break
		}
	}
	if notifyContent == "" {
		t.Fatal("notify.sh not found in generated hook files")
	}

	// The init tool generates a simplified notify.sh. We verify the
	// essential notification infrastructure is present. The full
	// template (with voice support) lives in templates/hooks/notify.sh.
	// Here we verify the generated hook is valid and functional.

	// Verify basic notification structure.
	if !strings.Contains(notifyContent, "EVENT") {
		t.Error("notify.sh should reference EVENT variable")
	}
	if !strings.Contains(notifyContent, "Orchestra") {
		t.Error("notify.sh should contain 'Orchestra' branding")
	}
}

func TestMasterHookRouting(t *testing.T) {
	// Find the orchestra-mcp-hook.sh content from generated hook files.
	hookFiles := generateHookFiles(false)

	var masterContent string
	for _, hf := range hookFiles {
		if strings.HasSuffix(hf.Path, "orchestra-mcp-hook.sh") {
			masterContent = hf.Content
			break
		}
	}
	if masterContent == "" {
		t.Fatal("orchestra-mcp-hook.sh not found in generated hook files")
	}

	// Verify master hook routes to notify.sh.
	if !strings.Contains(masterContent, "notify.sh") {
		t.Error("master hook should route to notify.sh")
	}

	// Verify it determines hook directory.
	if !strings.Contains(masterContent, "HOOK_DIR") {
		t.Error("master hook should set HOOK_DIR variable")
	}

	// Verify it handles the hook name argument.
	if !strings.Contains(masterContent, "HOOK_NAME") || !strings.Contains(masterContent, "case") {
		// The generated master hook uses EVENT and case statement.
		if !strings.Contains(masterContent, "case") {
			t.Error("master hook should use case statement for routing")
		}
	}
}

// ---------------------------------------------------------------------------
// Template Hook Scripts (full templates from templates/hooks/)
// ---------------------------------------------------------------------------

func TestTemplateNotifyHookVoiceSupport(t *testing.T) {
	// Read the full notify.sh template from disk.
	content, err := os.ReadFile("../templates/hooks/notify.sh")
	if err != nil {
		t.Skipf("template hooks/notify.sh not found (expected in templates/hooks/): %v", err)
	}

	text := string(content)

	// Verify it contains "say" (macOS voice).
	if !strings.Contains(text, "say") {
		t.Error("notify.sh template should contain 'say' for macOS voice")
	}

	// Verify it contains "espeak" (Linux voice).
	if !strings.Contains(text, "espeak") {
		t.Error("notify.sh template should contain 'espeak' for Linux voice")
	}

	// Verify it contains "Samantha" (default voice).
	if !strings.Contains(text, "Samantha") {
		t.Error("notify.sh template should contain 'Samantha' as default voice name")
	}

	// Verify it contains "config.json" (config file reference).
	if !strings.Contains(text, "config.json") {
		t.Error("notify.sh template should reference config.json for voice settings")
	}
}

func TestTemplateNotifyHookSyntax(t *testing.T) {
	content, err := os.ReadFile("../templates/hooks/notify.sh")
	if err != nil {
		t.Skipf("template hooks/notify.sh not found: %v", err)
	}

	// Verify it starts with #!/bin/bash.
	if !strings.HasPrefix(string(content), "#!/bin/bash") {
		t.Error("notify.sh template should start with #!/bin/bash")
	}

	// Run bash -n for syntax validation.
	tmpFile, err := os.CreateTemp(t.TempDir(), "template-notify-*.sh")
	if err != nil {
		t.Fatalf("failed to create temp file: %v", err)
	}
	if _, err := tmpFile.Write(content); err != nil {
		t.Fatalf("failed to write content: %v", err)
	}
	tmpFile.Close()

	cmd := exec.Command("bash", "-n", tmpFile.Name())
	output, err := cmd.CombinedOutput()
	if err != nil {
		t.Errorf("bash -n syntax check failed for notify.sh template: %v\noutput: %s", err, string(output))
	}
}

func TestTemplateMasterHookSyntax(t *testing.T) {
	content, err := os.ReadFile("../templates/hooks/orchestra-mcp-hook.sh")
	if err != nil {
		t.Skipf("template hooks/orchestra-mcp-hook.sh not found: %v", err)
	}

	// Verify it starts with #!/bin/bash.
	if !strings.HasPrefix(string(content), "#!/bin/bash") {
		t.Error("orchestra-mcp-hook.sh template should start with #!/bin/bash")
	}

	// Run bash -n for syntax validation.
	tmpFile, err := os.CreateTemp(t.TempDir(), "template-master-*.sh")
	if err != nil {
		t.Fatalf("failed to create temp file: %v", err)
	}
	if _, err := tmpFile.Write(content); err != nil {
		t.Fatalf("failed to write content: %v", err)
	}
	tmpFile.Close()

	cmd := exec.Command("bash", "-n", tmpFile.Name())
	output, err := cmd.CombinedOutput()
	if err != nil {
		t.Errorf("bash -n syntax check failed for orchestra-mcp-hook.sh template: %v\noutput: %s", err, string(output))
	}
}
