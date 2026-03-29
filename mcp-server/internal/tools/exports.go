package tools

import (
	"bytes"
	"context"
	"encoding/csv"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/orchestra-mcp/server/internal/auth"
	"github.com/orchestra-mcp/server/internal/db"
	"github.com/orchestra-mcp/server/internal/mcp"
	"github.com/xuri/excelize/v2"
	"github.com/yuin/goldmark"
)

// ---------------------------------------------------------------------------
// JSON Schemas
// ---------------------------------------------------------------------------

var exportMarkdownSchema = json.RawMessage(`{
	"type": "object",
	"properties": {
		"content":    {"type": "string", "description": "Markdown content to export"},
		"filename":   {"type": "string", "description": "Output filename without extension"},
		"project_id": {"type": "string", "format": "uuid", "description": "Optional project ID for context"}
	},
	"required": ["content", "filename"]
}`)

var exportCSVSchema = json.RawMessage(`{
	"type": "object",
	"properties": {
		"headers":  {"type": "array", "items": {"type": "string"}, "description": "Column headers"},
		"rows":     {"type": "array", "items": {"type": "array", "items": {"type": "string"}}, "description": "Data rows (array of arrays of strings)"},
		"filename": {"type": "string", "description": "Output filename without extension"}
	},
	"required": ["headers", "rows", "filename"]
}`)

var exportXLSXSchema = json.RawMessage(`{
	"type": "object",
	"properties": {
		"sheets": {
			"type": "array",
			"description": "Array of sheet definitions",
			"items": {
				"type": "object",
				"properties": {
					"name":    {"type": "string", "description": "Sheet name"},
					"headers": {"type": "array", "items": {"type": "string"}, "description": "Column headers"},
					"rows":    {"type": "array", "items": {"type": "array", "items": {"type": "string"}}, "description": "Data rows"}
				},
				"required": ["name", "headers", "rows"]
			}
		},
		"filename": {"type": "string", "description": "Output filename without extension"},
		"title":    {"type": "string", "description": "Optional title added as merged cells at top of first sheet"}
	},
	"required": ["sheets", "filename"]
}`)

var exportPDFSchema = json.RawMessage(`{
	"type": "object",
	"properties": {
		"content":     {"type": "string", "description": "Markdown content to convert to PDF"},
		"filename":    {"type": "string", "description": "Output filename without extension"},
		"page_size":   {"type": "string", "enum": ["A4", "Letter"], "description": "Page size (default: A4)"},
		"orientation": {"type": "string", "enum": ["portrait", "landscape"], "description": "Page orientation (default: portrait)"}
	},
	"required": ["content", "filename"]
}`)

// ---------------------------------------------------------------------------
// Shared Helper
// ---------------------------------------------------------------------------

// ensureExportDir creates the export directory for the given org and returns
// the path: /tmp/orchestra-exports/{orgID}/{YYYY-MM-DD}/
func ensureExportDir(orgID string) (string, error) {
	date := time.Now().UTC().Format("2006-01-02")
	dir := filepath.Join("/tmp", "orchestra-exports", orgID, date)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return "", fmt.Errorf("create export dir: %w", err)
	}
	return dir, nil
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

// RegisterExportTools registers all export MCP tools.
func RegisterExportTools(registry *mcp.ToolRegistry, _ *db.Client) {
	registry.Register("export_markdown", "Export markdown content to a file and return the file path", exportMarkdownSchema, makeExportMarkdown())
	registry.Register("export_csv", "Export headers and rows to a CSV file with UTF-8 BOM for Excel compatibility", exportCSVSchema, makeExportCSV())
	registry.Register("export_xlsx", "Generate an Excel spreadsheet from tabular data with multiple sheets and auto-width columns", exportXLSXSchema, makeExportXLSX())
	registry.Register("export_pdf", "Convert Markdown content to PDF (requires wkhtmltopdf on PATH; falls back to styled HTML)", exportPDFSchema, makeExportPDF())
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

func makeExportMarkdown() mcp.ToolHandler {
	return func(ctx context.Context, params json.RawMessage) (*mcp.ToolResult, error) {
		var input struct {
			Content   string `json:"content"`
			Filename  string `json:"filename"`
			ProjectID string `json:"project_id"`
		}
		if err := json.Unmarshal(params, &input); err != nil {
			return mcp.ErrorResult("invalid params: " + err.Error()), nil
		}
		if input.Content == "" {
			return mcp.ErrorResult("content is required"), nil
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

		filePath := filepath.Join(dir, input.Filename+".md")
		data := []byte(input.Content)

		if err := os.WriteFile(filePath, data, 0644); err != nil {
			return mcp.ErrorResult("failed to write file: " + err.Error()), nil
		}

		result := map[string]interface{}{
			"file_path":  filePath,
			"format":     "md",
			"size_bytes": len(data),
		}
		return jsonResult(result)
	}
}

func makeExportCSV() mcp.ToolHandler {
	return func(ctx context.Context, params json.RawMessage) (*mcp.ToolResult, error) {
		// Try normal parse first; if it fails, try string-encoded JSON arrays
		var input struct {
			Headers  []string   `json:"headers"`
			Rows     [][]string `json:"rows"`
			Filename string     `json:"filename"`
		}
		if err := json.Unmarshal(params, &input); err != nil {
			// Claude Code may send arrays as JSON strings — try fallback
			var raw struct {
				Headers  json.RawMessage `json:"headers"`
				Rows     json.RawMessage `json:"rows"`
				Filename string          `json:"filename"`
			}
			if err2 := json.Unmarshal(params, &raw); err2 != nil {
				return mcp.ErrorResult("invalid params: " + err.Error()), nil
			}
			// Try unmarshaling string-encoded arrays
			h := string(raw.Headers)
			if len(h) > 0 && h[0] == '"' {
				var hs string
				json.Unmarshal(raw.Headers, &hs)
				json.Unmarshal([]byte(hs), &input.Headers)
			} else {
				json.Unmarshal(raw.Headers, &input.Headers)
			}
			r := string(raw.Rows)
			if len(r) > 0 && r[0] == '"' {
				var rs string
				json.Unmarshal(raw.Rows, &rs)
				json.Unmarshal([]byte(rs), &input.Rows)
			} else {
				json.Unmarshal(raw.Rows, &input.Rows)
			}
			input.Filename = raw.Filename
		}
		if len(input.Headers) == 0 {
			return mcp.ErrorResult("headers is required and must not be empty"), nil
		}
		if input.Rows == nil {
			return mcp.ErrorResult("rows is required"), nil
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

		// Build CSV content in memory with UTF-8 BOM for Excel compatibility.
		var buf bytes.Buffer

		// Write UTF-8 BOM (0xEF, 0xBB, 0xBF).
		buf.Write([]byte{0xEF, 0xBB, 0xBF})

		writer := csv.NewWriter(&buf)

		// Write headers.
		if err := writer.Write(input.Headers); err != nil {
			return mcp.ErrorResult("failed to write CSV headers: " + err.Error()), nil
		}

		// Write data rows.
		for i, row := range input.Rows {
			if err := writer.Write(row); err != nil {
				return mcp.ErrorResult(fmt.Sprintf("failed to write CSV row %d: %s", i, err.Error())), nil
			}
		}

		writer.Flush()
		if err := writer.Error(); err != nil {
			return mcp.ErrorResult("CSV encoding error: " + err.Error()), nil
		}

		filePath := filepath.Join(dir, input.Filename+".csv")
		data := buf.Bytes()

		if err := os.WriteFile(filePath, data, 0644); err != nil {
			return mcp.ErrorResult("failed to write file: " + err.Error()), nil
		}

		result := map[string]interface{}{
			"file_path":  filePath,
			"format":     "csv",
			"size_bytes": len(data),
			"row_count":  len(input.Rows),
		}
		return jsonResult(result)
	}
}

// ---------------------------------------------------------------------------
// export_xlsx handler
// ---------------------------------------------------------------------------

// colWidth calculates a reasonable column width based on content.
// Returns the max character count across all values in a column, clamped
// between 10 and 60 characters.
func colWidth(header string, rows [][]string, colIdx int) float64 {
	maxLen := utf8.RuneCountInString(header)
	for _, row := range rows {
		if colIdx < len(row) {
			if n := utf8.RuneCountInString(row[colIdx]); n > maxLen {
				maxLen = n
			}
		}
	}
	// Add padding and clamp.
	w := float64(maxLen) + 2
	if w < 10 {
		w = 10
	}
	if w > 60 {
		w = 60
	}
	return w
}

func makeExportXLSX() mcp.ToolHandler {
	return func(ctx context.Context, params json.RawMessage) (*mcp.ToolResult, error) {
		var input struct {
			Sheets []struct {
				Name    string     `json:"name"`
				Headers []string   `json:"headers"`
				Rows    [][]string `json:"rows"`
			} `json:"sheets"`
			Filename string `json:"filename"`
			Title    string `json:"title"`
		}
		if err := json.Unmarshal(params, &input); err != nil {
			return mcp.ErrorResult("invalid params: " + err.Error()), nil
		}
		if len(input.Sheets) == 0 {
			return mcp.ErrorResult("sheets is required and must not be empty"), nil
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

		f := excelize.NewFile()
		defer f.Close()

		// Bold style for headers.
		boldStyle, err := f.NewStyle(&excelize.Style{
			Font: &excelize.Font{Bold: true},
		})
		if err != nil {
			return mcp.ErrorResult("failed to create bold style: " + err.Error()), nil
		}

		totalRows := 0

		for i, sheet := range input.Sheets {
			if sheet.Name == "" {
				return mcp.ErrorResult(fmt.Sprintf("sheet %d: name is required", i)), nil
			}
			if len(sheet.Headers) == 0 {
				return mcp.ErrorResult(fmt.Sprintf("sheet %d (%s): headers is required", i, sheet.Name)), nil
			}

			// The first sheet is "Sheet1" by default — rename it.
			// Subsequent sheets are created fresh.
			if i == 0 {
				f.SetSheetName("Sheet1", sheet.Name)
			} else {
				if _, err := f.NewSheet(sheet.Name); err != nil {
					return mcp.ErrorResult(fmt.Sprintf("failed to create sheet %q: %s", sheet.Name, err.Error())), nil
				}
			}

			// Determine the starting data row: if there's a title on the first sheet,
			// rows shift down by 2 (title row + blank row).
			dataStartRow := 1
			if i == 0 && input.Title != "" {
				dataStartRow = 3 // row 1 = title, row 2 = blank, row 3 = headers
			}

			// Write title on the first sheet if provided.
			if i == 0 && input.Title != "" {
				titleCell, _ := excelize.CoordinatesToCellName(1, 1)
				f.SetCellValue(sheet.Name, titleCell, input.Title)

				// Create bold+larger style for title.
				titleStyle, _ := f.NewStyle(&excelize.Style{
					Font: &excelize.Font{Bold: true, Size: 14},
				})

				// Merge across all header columns.
				endCell, _ := excelize.CoordinatesToCellName(len(sheet.Headers), 1)
				f.MergeCell(sheet.Name, titleCell, endCell)
				f.SetCellStyle(sheet.Name, titleCell, endCell, titleStyle)
			}

			// Write headers.
			for j, h := range sheet.Headers {
				cell, _ := excelize.CoordinatesToCellName(j+1, dataStartRow)
				f.SetCellValue(sheet.Name, cell, h)
				f.SetCellStyle(sheet.Name, cell, cell, boldStyle)
			}

			// Write data rows.
			for ri, row := range sheet.Rows {
				for ci, val := range row {
					cell, _ := excelize.CoordinatesToCellName(ci+1, dataStartRow+1+ri)
					f.SetCellValue(sheet.Name, cell, val)
				}
			}
			totalRows += len(sheet.Rows)

			// Auto-width columns.
			for j, h := range sheet.Headers {
				colName, _ := excelize.ColumnNumberToName(j + 1)
				w := colWidth(h, sheet.Rows, j)
				f.SetColWidth(sheet.Name, colName, colName, w)
			}
		}

		filePath := filepath.Join(dir, input.Filename+".xlsx")
		if err := f.SaveAs(filePath); err != nil {
			return mcp.ErrorResult("failed to save xlsx: " + err.Error()), nil
		}

		info, err := os.Stat(filePath)
		if err != nil {
			return mcp.ErrorResult("failed to stat file: " + err.Error()), nil
		}

		result := map[string]interface{}{
			"file_path":   filePath,
			"format":      "xlsx",
			"size_bytes":  info.Size(),
			"sheet_count": len(input.Sheets),
			"total_rows":  totalRows,
		}
		return jsonResult(result)
	}
}

// ---------------------------------------------------------------------------
// export_pdf handler
// ---------------------------------------------------------------------------

// pdfHTMLTemplate is the HTML wrapper for rendering Markdown content.
// It includes sensible typography defaults and page-break hints.
const pdfHTMLTemplate = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    font-size: 14px;
    line-height: 1.6;
    color: #1a1a1a;
    max-width: 800px;
    margin: 40px auto;
    padding: 0 20px;
  }
  h1 { font-size: 2em; border-bottom: 2px solid #e5e5e5; padding-bottom: 0.3em; }
  h2 { font-size: 1.5em; border-bottom: 1px solid #e5e5e5; padding-bottom: 0.2em; }
  h3 { font-size: 1.25em; }
  code {
    background: #f4f4f4;
    padding: 2px 6px;
    border-radius: 3px;
    font-size: 0.9em;
  }
  pre {
    background: #f4f4f4;
    padding: 16px;
    border-radius: 6px;
    overflow-x: auto;
  }
  pre code { background: none; padding: 0; }
  blockquote {
    border-left: 4px solid #ddd;
    margin: 0;
    padding: 0.5em 1em;
    color: #555;
  }
  table { border-collapse: collapse; width: 100%%; margin: 1em 0; }
  th, td { border: 1px solid #ddd; padding: 8px 12px; text-align: left; }
  th { background: #f4f4f4; font-weight: 600; }
  img { max-width: 100%%; }
  hr { border: none; border-top: 1px solid #e5e5e5; margin: 2em 0; }
</style>
</head>
<body>
%s
</body>
</html>`

func makeExportPDF() mcp.ToolHandler {
	return func(ctx context.Context, params json.RawMessage) (*mcp.ToolResult, error) {
		var input struct {
			Content     string `json:"content"`
			Filename    string `json:"filename"`
			PageSize    string `json:"page_size"`
			Orientation string `json:"orientation"`
		}
		if err := json.Unmarshal(params, &input); err != nil {
			return mcp.ErrorResult("invalid params: " + err.Error()), nil
		}
		if input.Content == "" {
			return mcp.ErrorResult("content is required"), nil
		}
		if input.Filename == "" {
			return mcp.ErrorResult("filename is required"), nil
		}

		// Defaults.
		if input.PageSize == "" {
			input.PageSize = "A4"
		}
		if input.Orientation == "" {
			input.Orientation = "portrait"
		}

		// Validate page_size and orientation.
		switch strings.ToUpper(input.PageSize) {
		case "A4", "LETTER":
			input.PageSize = strings.ToUpper(input.PageSize)
		default:
			return mcp.ErrorResult("page_size must be A4 or Letter"), nil
		}
		switch strings.ToLower(input.Orientation) {
		case "portrait", "landscape":
			input.Orientation = strings.ToLower(input.Orientation)
		default:
			return mcp.ErrorResult("orientation must be portrait or landscape"), nil
		}

		userCtx := auth.UserContextFromContext(ctx)
		if userCtx == nil {
			return mcp.ErrorResult("authentication required"), nil
		}

		dir, err := ensureExportDir(userCtx.OrgID)
		if err != nil {
			return mcp.ErrorResult("failed to create export directory: " + err.Error()), nil
		}

		// Convert Markdown to HTML using goldmark.
		var htmlBuf bytes.Buffer
		md := goldmark.New()
		if err := md.Convert([]byte(input.Content), &htmlBuf); err != nil {
			return mcp.ErrorResult("failed to convert markdown: " + err.Error()), nil
		}

		// Wrap in styled HTML document.
		fullHTML := fmt.Sprintf(pdfHTMLTemplate, htmlBuf.String())

		// Write the HTML to a temp file (needed by wkhtmltopdf).
		htmlPath := filepath.Join(dir, input.Filename+".html")
		if err := os.WriteFile(htmlPath, []byte(fullHTML), 0644); err != nil {
			return mcp.ErrorResult("failed to write HTML file: " + err.Error()), nil
		}

		// Try to convert to PDF using wkhtmltopdf if available.
		wkhtmltopdf, lookErr := exec.LookPath("wkhtmltopdf")
		if lookErr == nil {
			pdfPath := filepath.Join(dir, input.Filename+".pdf")
			args := []string{
				"--page-size", input.PageSize,
				"--orientation", capitalize(input.Orientation),
				"--encoding", "UTF-8",
				"--margin-top", "20mm",
				"--margin-bottom", "20mm",
				"--margin-left", "15mm",
				"--margin-right", "15mm",
				htmlPath, pdfPath,
			}
			cmd := exec.CommandContext(ctx, wkhtmltopdf, args...)
			if output, err := cmd.CombinedOutput(); err != nil {
				// wkhtmltopdf failed — fall back to HTML.
				_ = output // ignore output, fall through to HTML fallback
			} else {
				// PDF generated successfully — clean up HTML and return.
				os.Remove(htmlPath)

				info, err := os.Stat(pdfPath)
				if err != nil {
					return mcp.ErrorResult("failed to stat PDF: " + err.Error()), nil
				}

				result := map[string]interface{}{
					"file_path":   pdfPath,
					"format":      "pdf",
					"size_bytes":  info.Size(),
					"page_size":   input.PageSize,
					"orientation": input.Orientation,
				}
				return jsonResult(result)
			}
		}

		// Fallback: return the styled HTML file.
		info, err := os.Stat(htmlPath)
		if err != nil {
			return mcp.ErrorResult("failed to stat HTML: " + err.Error()), nil
		}

		result := map[string]interface{}{
			"file_path":   htmlPath,
			"format":      "html",
			"size_bytes":  info.Size(),
			"page_size":   input.PageSize,
			"orientation": input.Orientation,
			"note":        "PDF generation requires wkhtmltopdf on PATH. Styled HTML has been produced instead.",
		}
		return jsonResult(result)
	}
}

// capitalize returns the string with its first letter uppercased.
func capitalize(s string) string {
	if s == "" {
		return s
	}
	return strings.ToUpper(s[:1]) + s[1:]
}
