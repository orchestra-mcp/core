package tools

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strings"

	"github.com/orchestra-mcp/server/internal/auth"
	"github.com/orchestra-mcp/server/internal/db"
	"github.com/orchestra-mcp/server/internal/mcp"
)

// ---------------------------------------------------------------------------
// JSON Schema
// ---------------------------------------------------------------------------

var exportDiagramSchema = json.RawMessage(`{
	"type": "object",
	"properties": {
		"mermaid":  {"type": "string", "description": "Mermaid diagram syntax (e.g. flowchart TD, sequence diagram, etc.)"},
		"format":   {"type": "string", "enum": ["svg", "png"], "description": "Output format: svg or png"},
		"filename": {"type": "string", "description": "Output filename without extension"}
	},
	"required": ["mermaid", "format", "filename"]
}`)

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

// RegisterDiagramExportTools registers the export_diagram MCP tool.
func RegisterDiagramExportTools(registry *mcp.ToolRegistry, _ *db.Client) {
	registry.Register(
		"export_diagram",
		"Generate SVG or PNG diagram from Mermaid DSL. Uses mermaid-cli (mmdc) if available, falls back to manual SVG rendering for simple flowcharts, or returns the .mmd source file.",
		exportDiagramSchema,
		makeExportDiagram(),
	)
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

func makeExportDiagram() mcp.ToolHandler {
	return func(ctx context.Context, params json.RawMessage) (*mcp.ToolResult, error) {
		var input struct {
			Mermaid  string `json:"mermaid"`
			Format   string `json:"format"`
			Filename string `json:"filename"`
		}
		if err := json.Unmarshal(params, &input); err != nil {
			return mcp.ErrorResult("invalid params: " + err.Error()), nil
		}
		if input.Mermaid == "" {
			return mcp.ErrorResult("mermaid is required"), nil
		}
		if input.Format != "svg" && input.Format != "png" {
			return mcp.ErrorResult("format must be 'svg' or 'png'"), nil
		}
		if input.Filename == "" {
			return mcp.ErrorResult("filename is required"), nil
		}

		userCtx := auth.UserContextFromContext(ctx)
		if userCtx == nil {
			return mcp.ErrorResult("authentication required"), nil
		}

		dir, err := ensureExportDir(userCtx.OrgID)
		if err != nil {
			return mcp.ErrorResult("failed to create export directory: " + err.Error()), nil
		}

		// Strategy 1: Try mermaid-cli (mmdc) — highest quality output.
		if mmdcPath, err := exec.LookPath("mmdc"); err == nil {
			return renderWithMMDC(mmdcPath, input.Mermaid, input.Format, input.Filename, dir)
		}

		// Strategy 2: Manual SVG for simple flowcharts (svg format only).
		if input.Format == "svg" {
			if svgContent, ok := renderFlowchartSVG(input.Mermaid); ok {
				filePath := filepath.Join(dir, input.Filename+".svg")
				data := []byte(svgContent)
				if err := os.WriteFile(filePath, data, 0644); err != nil {
					return mcp.ErrorResult("failed to write file: " + err.Error()), nil
				}
				result := map[string]interface{}{
					"file_path":  filePath,
					"format":     "svg",
					"size_bytes": len(data),
					"renderer":   "manual",
				}
				return jsonResult(result)
			}
		}

		// Strategy 3: Final fallback — save the .mmd source file.
		return saveMMDSource(input.Mermaid, input.Filename, dir)
	}
}

// ---------------------------------------------------------------------------
// Strategy 1: mermaid-cli (mmdc)
// ---------------------------------------------------------------------------

func renderWithMMDC(mmdcPath, mermaid, format, filename, dir string) (*mcp.ToolResult, error) {
	// Write Mermaid source to a temp file.
	tmpFile, err := os.CreateTemp("", "orchestra-mermaid-*.mmd")
	if err != nil {
		return mcp.ErrorResult("failed to create temp file: " + err.Error()), nil
	}
	tmpPath := tmpFile.Name()
	defer os.Remove(tmpPath)

	if _, err := tmpFile.WriteString(mermaid); err != nil {
		tmpFile.Close()
		return mcp.ErrorResult("failed to write temp file: " + err.Error()), nil
	}
	tmpFile.Close()

	ext := "." + format
	outPath := filepath.Join(dir, filename+ext)

	// Run mmdc.
	cmd := exec.Command(mmdcPath, "-i", tmpPath, "-o", outPath)
	if output, err := cmd.CombinedOutput(); err != nil {
		return mcp.ErrorResult(fmt.Sprintf("mmdc failed: %s — %s", err.Error(), string(output))), nil
	}

	// Read file size.
	info, err := os.Stat(outPath)
	if err != nil {
		return mcp.ErrorResult("failed to stat output file: " + err.Error()), nil
	}

	result := map[string]interface{}{
		"file_path":  outPath,
		"format":     format,
		"size_bytes": info.Size(),
		"renderer":   "mermaid-cli",
	}
	return jsonResult(result)
}

// ---------------------------------------------------------------------------
// Strategy 2: Manual SVG for simple flowcharts
// ---------------------------------------------------------------------------

// flowNode represents a parsed node from Mermaid flowchart syntax.
type flowNode struct {
	id    string
	label string
	shape string // "rect", "rounded", "diamond", "circle"
}

// flowEdge represents a parsed edge between two nodes.
type flowEdge struct {
	from  string
	to    string
	label string
}

// renderFlowchartSVG attempts to parse basic Mermaid flowchart syntax and
// generate an SVG. Returns ("", false) if the syntax is not a simple flowchart.
func renderFlowchartSVG(mermaid string) (string, bool) {
	lines := strings.Split(strings.TrimSpace(mermaid), "\n")
	if len(lines) == 0 {
		return "", false
	}

	// Detect flowchart direction.
	header := strings.TrimSpace(lines[0])
	headerLower := strings.ToLower(header)

	isVertical := true
	if strings.HasPrefix(headerLower, "flowchart") || strings.HasPrefix(headerLower, "graph") {
		parts := strings.Fields(header)
		if len(parts) >= 2 {
			dir := strings.ToUpper(parts[1])
			if dir == "LR" || dir == "RL" {
				isVertical = false
			}
		}
	} else {
		return "", false
	}

	nodes := make(map[string]*flowNode)
	var edges []flowEdge
	var nodeOrder []string

	// Regex patterns for node shapes.
	reRounded := regexp.MustCompile(`^(\w+)\((.+)\)$`)        // A(text)
	reRect := regexp.MustCompile(`^(\w+)\[(.+)\]$`)           // A[text]
	reDiamond := regexp.MustCompile(`^(\w+)\{(.+)\}$`)        // A{text}
	reCircle := regexp.MustCompile(`^(\w+)\(\((.+)\)\)$`)     // A((text))
	reStadium := regexp.MustCompile(`^(\w+)\(\[(.+)\]\)$`)    // A([text])
	reSubroutine := regexp.MustCompile(`^(\w+)\[\[(.+)\]\]$`) // A[[text]]

	// Parse a single node token and register it.
	parseNodeToken := func(token string) string {
		token = strings.TrimSpace(token)
		if token == "" {
			return ""
		}

		// Try each shape pattern.
		patterns := []struct {
			re    *regexp.Regexp
			shape string
		}{
			{reCircle, "circle"},
			{reStadium, "rounded"},
			{reSubroutine, "rect"},
			{reRounded, "rounded"},
			{reRect, "rect"},
			{reDiamond, "diamond"},
		}

		for _, p := range patterns {
			if m := p.re.FindStringSubmatch(token); m != nil {
				id := m[1]
				label := strings.Trim(m[2], "\"' ")
				if _, exists := nodes[id]; !exists {
					nodes[id] = &flowNode{id: id, label: label, shape: p.shape}
					nodeOrder = append(nodeOrder, id)
				}
				return id
			}
		}

		// Plain identifier — no shape specified.
		id := token
		if _, exists := nodes[id]; !exists {
			nodes[id] = &flowNode{id: id, label: id, shape: "rect"}
			nodeOrder = append(nodeOrder, id)
		}
		return id
	}

	// Edge pattern: matches A -->|label| B, A --> B, A --- B, A ==> B, etc.
	reEdge := regexp.MustCompile(`^(.+?)\s*(-->|---|--->|==>|-.->)\s*(?:\|(.+?)\|\s*)?(.+)$`)

	for _, line := range lines[1:] {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "%%") || strings.HasPrefix(line, "style") || strings.HasPrefix(line, "class") || strings.HasPrefix(line, "click") {
			continue
		}

		if m := reEdge.FindStringSubmatch(line); m != nil {
			fromToken := m[1]
			edgeLabel := m[3]
			toToken := m[4]

			fromID := parseNodeToken(fromToken)
			toID := parseNodeToken(toToken)

			if fromID != "" && toID != "" {
				edges = append(edges, flowEdge{from: fromID, to: toID, label: edgeLabel})
			}
		} else {
			// Possibly a standalone node definition.
			parseNodeToken(line)
		}
	}

	if len(nodes) == 0 {
		return "", false
	}

	// Layout — assign positions.
	const (
		nodeW   = 160
		nodeH   = 50
		padX    = 80
		padY    = 70
		marginX = 40
		marginY = 40
	)

	type pos struct{ x, y int }
	positions := make(map[string]pos)

	for i, id := range nodeOrder {
		if isVertical {
			positions[id] = pos{x: marginX, y: marginY + i*(nodeH+padY)}
		} else {
			positions[id] = pos{x: marginX + i*(nodeW+padX), y: marginY}
		}
	}

	// Compute SVG canvas size.
	maxX, maxY := 0, 0
	for _, p := range positions {
		if ex := p.x + nodeW + marginX; ex > maxX {
			maxX = ex
		}
		if ey := p.y + nodeH + marginY; ey > maxY {
			maxY = ey
		}
	}

	var svg strings.Builder
	svg.WriteString(fmt.Sprintf(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 %d %d" width="%d" height="%d" font-family="Arial, Helvetica, sans-serif" font-size="14">`, maxX, maxY, maxX, maxY))
	svg.WriteString("\n")

	// Defs: arrowhead marker.
	svg.WriteString(`  <defs>
    <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
      <polygon points="0 0, 10 3.5, 0 7" fill="#333"/>
    </marker>
  </defs>
`)

	// Draw edges first (behind nodes).
	for _, e := range edges {
		fp := positions[e.from]
		tp := positions[e.to]

		var x1, y1, x2, y2 int
		if isVertical {
			x1 = fp.x + nodeW/2
			y1 = fp.y + nodeH
			x2 = tp.x + nodeW/2
			y2 = tp.y
		} else {
			x1 = fp.x + nodeW
			y1 = fp.y + nodeH/2
			x2 = tp.x
			y2 = tp.y + nodeH/2
		}

		svg.WriteString(fmt.Sprintf(`  <line x1="%d" y1="%d" x2="%d" y2="%d" stroke="#333" stroke-width="2" marker-end="url(#arrowhead)"/>`, x1, y1, x2, y2))
		svg.WriteString("\n")

		if e.label != "" {
			midX := (x1 + x2) / 2
			midY := (y1 + y2) / 2
			svg.WriteString(fmt.Sprintf(`  <text x="%d" y="%d" text-anchor="middle" fill="#666" font-size="12">%s</text>`, midX, midY-5, escapeXML(e.label)))
			svg.WriteString("\n")
		}
	}

	// Draw nodes.
	for _, id := range nodeOrder {
		n := nodes[id]
		p := positions[id]

		switch n.shape {
		case "diamond":
			cx := p.x + nodeW/2
			cy := p.y + nodeH/2
			svg.WriteString(fmt.Sprintf(`  <polygon points="%d,%d %d,%d %d,%d %d,%d" fill="#fff3cd" stroke="#f0ad4e" stroke-width="2"/>`,
				cx, p.y, p.x+nodeW, cy, cx, p.y+nodeH, p.x, cy))
			svg.WriteString("\n")
			svg.WriteString(fmt.Sprintf(`  <text x="%d" y="%d" text-anchor="middle" dominant-baseline="central" fill="#333">%s</text>`, cx, cy, escapeXML(n.label)))
		case "rounded":
			svg.WriteString(fmt.Sprintf(`  <rect x="%d" y="%d" width="%d" height="%d" rx="15" ry="15" fill="#d4edda" stroke="#28a745" stroke-width="2"/>`, p.x, p.y, nodeW, nodeH))
			svg.WriteString("\n")
			svg.WriteString(fmt.Sprintf(`  <text x="%d" y="%d" text-anchor="middle" dominant-baseline="central" fill="#333">%s</text>`, p.x+nodeW/2, p.y+nodeH/2, escapeXML(n.label)))
		case "circle":
			cx := p.x + nodeW/2
			cy := p.y + nodeH/2
			r := nodeH / 2
			svg.WriteString(fmt.Sprintf(`  <circle cx="%d" cy="%d" r="%d" fill="#cce5ff" stroke="#007bff" stroke-width="2"/>`, cx, cy, r))
			svg.WriteString("\n")
			svg.WriteString(fmt.Sprintf(`  <text x="%d" y="%d" text-anchor="middle" dominant-baseline="central" fill="#333">%s</text>`, cx, cy, escapeXML(n.label)))
		default: // rect
			svg.WriteString(fmt.Sprintf(`  <rect x="%d" y="%d" width="%d" height="%d" fill="#e2e3f1" stroke="#6c757d" stroke-width="2"/>`, p.x, p.y, nodeW, nodeH))
			svg.WriteString("\n")
			svg.WriteString(fmt.Sprintf(`  <text x="%d" y="%d" text-anchor="middle" dominant-baseline="central" fill="#333">%s</text>`, p.x+nodeW/2, p.y+nodeH/2, escapeXML(n.label)))
		}
		svg.WriteString("\n")
	}

	svg.WriteString("</svg>\n")
	return svg.String(), true
}

// escapeXML escapes special characters for XML text content.
func escapeXML(s string) string {
	s = strings.ReplaceAll(s, "&", "&amp;")
	s = strings.ReplaceAll(s, "<", "&lt;")
	s = strings.ReplaceAll(s, ">", "&gt;")
	s = strings.ReplaceAll(s, "\"", "&quot;")
	s = strings.ReplaceAll(s, "'", "&apos;")
	return s
}

// ---------------------------------------------------------------------------
// Strategy 3: Save .mmd source file
// ---------------------------------------------------------------------------

func saveMMDSource(mermaid, filename, dir string) (*mcp.ToolResult, error) {
	filePath := filepath.Join(dir, filename+".mmd")

	content := mermaid + "\n\n%% To render this diagram:\n%% 1. Paste the content above into https://mermaid.live\n%% 2. Or install mermaid-cli: npm install -g @mermaid-js/mermaid-cli\n%%    Then run: mmdc -i " + filename + ".mmd -o " + filename + ".svg\n"

	data := []byte(content)
	if err := os.WriteFile(filePath, data, 0644); err != nil {
		return mcp.ErrorResult("failed to write file: " + err.Error()), nil
	}

	result := map[string]interface{}{
		"file_path":  filePath,
		"format":     "mmd",
		"size_bytes": len(data),
		"renderer":   "source-only",
	}
	return jsonResult(result)
}
