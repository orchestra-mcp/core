package templates

import (
	"strings"
	"testing"
)

func TestGenerateCLAUDEMD(t *testing.T) {
	data := CLAUDEMDData{
		OrgName:     "Acme Corp",
		ProjectName: "Widget Platform",
		Agents: []AgentInfo{
			{Name: "Omar", Slug: "omar", Role: "Backend Developer", Type: "ai"},
			{Name: "Layla", Slug: "layla", Role: "UI Designer", Type: "ai"},
		},
		Skills: []SkillInfo{
			{Name: "Laravel Dev", Slug: "laravel-dev", Category: "Backend"},
			{Name: "Flutter Dev", Slug: "flutter-dev", Category: "Mobile"},
		},
		Projects: []ProjectInfo{
			{Name: "API Gateway", Slug: "api-gateway"},
		},
		MCPToolCount: 49,
		MCPURL:       "https://mcp.acme.com",
	}

	result, err := GenerateCLAUDEMD(data)
	if err != nil {
		t.Fatalf("GenerateCLAUDEMD returned error: %v", err)
	}

	// Check header
	if !strings.Contains(result, "# CLAUDE.md — Acme Corp: Widget Platform") {
		t.Error("missing header with org and project name")
	}

	// Check MCP URL
	if !strings.Contains(result, "https://mcp.acme.com") {
		t.Error("missing MCP URL")
	}

	// Check tool count
	if !strings.Contains(result, "**49** MCP tools") {
		t.Error("missing tool count")
	}

	// Check agents table
	if !strings.Contains(result, "| Omar |") {
		t.Error("missing agent Omar in table")
	}
	if !strings.Contains(result, "| Layla |") {
		t.Error("missing agent Layla in table")
	}

	// Check skills table
	if !strings.Contains(result, "| Laravel Dev |") {
		t.Error("missing skill Laravel Dev in table")
	}

	// Check projects
	if !strings.Contains(result, "**API Gateway**") {
		t.Error("missing project API Gateway")
	}

	// Check rules table
	if !strings.Contains(result, "Plan-First") {
		t.Error("missing Plan-First rule in rules table")
	}
	if !strings.Contains(result, "Client-First") {
		t.Error("missing Client-First rule in rules table")
	}

	// Check quick start sections
	if !strings.Contains(result, "## Quick Start") {
		t.Error("missing Quick Start section")
	}
}

func TestGenerateCLAUDEMD_Empty(t *testing.T) {
	data := CLAUDEMDData{
		OrgName:      "Empty Org",
		MCPToolCount: 0,
	}

	result, err := GenerateCLAUDEMD(data)
	if err != nil {
		t.Fatalf("GenerateCLAUDEMD returned error: %v", err)
	}

	// Should have header without project name
	if !strings.Contains(result, "# CLAUDE.md — Empty Org") {
		t.Error("missing header for empty org")
	}

	// Should show "no agents" message
	if !strings.Contains(result, "No agents configured yet") {
		t.Error("missing empty agents message")
	}

	// Should show "no skills" message
	if !strings.Contains(result, "No skills configured yet") {
		t.Error("missing empty skills message")
	}

	// Should show "no projects" message
	if !strings.Contains(result, "No projects yet") {
		t.Error("missing empty projects message")
	}
}

func TestGenerateAGENTSMD(t *testing.T) {
	agents := []AgentDetailInfo{
		{
			Name:         "Omar Magdy",
			Slug:         "omar-magdy",
			Role:         "Laravel Developer",
			Type:         "ai",
			Persona:      "Senior Laravel developer with 10 years experience.",
			SystemPrompt: "You are Omar, a senior Laravel developer.",
		},
		{
			Name:         "Layla Hossam",
			Slug:         "layla-hossam",
			Role:         "UI Designer",
			Type:         "ai",
			Persona:      "Creative UI designer focused on accessibility.",
			SystemPrompt: "You are Layla, a UI designer who values usability.",
		},
	}

	result, err := GenerateAGENTSMD(agents)
	if err != nil {
		t.Fatalf("GenerateAGENTSMD returned error: %v", err)
	}

	// Check header
	if !strings.Contains(result, "# Orchestra Team — Agent Roster") {
		t.Error("missing roster header")
	}

	// Check summary table
	if !strings.Contains(result, "| 1 | Omar Magdy |") {
		t.Error("missing Omar Magdy in summary table")
	}
	if !strings.Contains(result, "| 2 | Layla Hossam |") {
		t.Error("missing Layla Hossam in summary table")
	}

	// Check detailed sections
	if !strings.Contains(result, "## Omar Magdy") {
		t.Error("missing Omar Magdy detail section")
	}
	if !strings.Contains(result, "### Persona") {
		t.Error("missing Persona section")
	}
	if !strings.Contains(result, "### System Prompt") {
		t.Error("missing System Prompt section")
	}
	if !strings.Contains(result, "Senior Laravel developer") {
		t.Error("missing persona content")
	}

	// Check how-to-use section
	if !strings.Contains(result, "### How to Use") {
		t.Error("missing How to Use section")
	}
}

func TestGenerateAGENTSMD_Empty(t *testing.T) {
	result, err := GenerateAGENTSMD([]AgentDetailInfo{})
	if err != nil {
		t.Fatalf("GenerateAGENTSMD returned error for empty input: %v", err)
	}

	if !strings.Contains(result, "# Orchestra Team — Agent Roster") {
		t.Error("missing header for empty roster")
	}
}

func TestRulesMapCompleteness(t *testing.T) {
	// Verify all 11 rules are present
	if len(Rules) != 11 {
		t.Errorf("expected 11 rules, got %d", len(Rules))
	}

	// Verify each rule has content
	for _, slug := range RuleNames {
		content, ok := Rules[slug]
		if !ok {
			t.Errorf("rule %q missing from Rules map", slug)
			continue
		}
		if len(content) < 50 {
			t.Errorf("rule %q seems too short (%d chars)", slug, len(content))
		}
	}

	// Verify RuleTitles completeness
	if len(RuleTitles) != 11 {
		t.Errorf("expected 11 rule titles, got %d", len(RuleTitles))
	}

	for _, slug := range RuleNames {
		if _, ok := RuleTitles[slug]; !ok {
			t.Errorf("rule title missing for %q", slug)
		}
	}
}

func TestRuleNamesOrder(t *testing.T) {
	expected := []string{
		"01-plan-first",
		"02-multi-feature-todos",
		"03-plan-review",
		"04-clarify-unknowns",
		"05-interrupt-handling",
		"06-definition-of-done",
		"07-component-ui-design",
		"08-package-scaffolding",
		"09-small-wins",
		"10-parallel-execution",
		"11-client-first",
	}

	if len(RuleNames) != len(expected) {
		t.Fatalf("RuleNames length mismatch: got %d, want %d", len(RuleNames), len(expected))
	}

	for i, name := range RuleNames {
		if name != expected[i] {
			t.Errorf("RuleNames[%d] = %q, want %q", i, name, expected[i])
		}
	}
}

func TestRuleContentHeaders(t *testing.T) {
	// Each rule should start with a markdown header
	for slug, content := range Rules {
		if !strings.HasPrefix(content, "# Rule ") {
			t.Errorf("rule %q does not start with '# Rule ' header", slug)
		}
	}
}
