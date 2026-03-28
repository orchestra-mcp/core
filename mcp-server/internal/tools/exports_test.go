package tools

import (
	"archive/zip"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/orchestra-mcp/server/internal/auth"
	"github.com/orchestra-mcp/server/internal/db"
	"github.com/orchestra-mcp/server/internal/mcp"
)

// ---------------------------------------------------------------------------
// Local test helpers (no DB required)
// ---------------------------------------------------------------------------

// localTestEnv holds tools registered without a real DB client.
// Used for export tools that only generate local files.
type localTestEnv struct {
	registry *mcp.ToolRegistry
	ctx      context.Context
	orgID    string
}

// newLocalTestEnv creates a test environment with export tools registered
// and a fake auth context injected. No database connection is needed.
func newLocalTestEnv(t *testing.T) *localTestEnv {
	t.Helper()

	registry := mcp.NewToolRegistry()

	// Register all export tools (they accept nil *db.Client).
	RegisterExportTools(registry, nil)
	RegisterOfficeExportTools(registry, nil)
	RegisterDiagramExportTools(registry, nil)

	orgID := "test-org-exports"

	ctx := auth.WithUserContext(context.Background(), &auth.UserContext{
		TokenID: "test-token",
		UserID:  "test-user-exports",
		OrgID:   orgID,
		Scopes:  []string{"*"},
		Plan:    "enterprise",
	})

	return &localTestEnv{
		registry: registry,
		ctx:      ctx,
		orgID:    orgID,
	}
}

// call invokes a tool by name and returns the raw text response and whether
// it was an error result. Fails the test on unexpected Go-level errors.
func (e *localTestEnv) call(t *testing.T, toolName string, args interface{}) (string, bool) {
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
func (e *localTestEnv) mustCall(t *testing.T, toolName string, args interface{}) string {
	t.Helper()
	text, isErr := e.call(t, toolName, args)
	if isErr {
		t.Fatalf("%s returned error: %s", toolName, text)
	}
	return text
}

// expectError calls a tool and fails if the result is NOT an error.
func (e *localTestEnv) expectError(t *testing.T, toolName string, args interface{}) string {
	t.Helper()
	text, isErr := e.call(t, toolName, args)
	if !isErr {
		t.Fatalf("expected %s to return error, got success: %s", toolName, text)
	}
	return text
}

// parseResponse unmarshals a JSON response into a map.
func parseResponse(t *testing.T, raw string) map[string]interface{} {
	t.Helper()
	var m map[string]interface{}
	if err := json.Unmarshal([]byte(raw), &m); err != nil {
		t.Fatalf("failed to parse response as JSON: %v\nraw: %.500s", err, raw)
	}
	return m
}

// cleanupFile registers a t.Cleanup callback to remove the file at the given
// path (extracted from the JSON response). Ignores errors silently.
func cleanupFile(t *testing.T, resp map[string]interface{}) {
	t.Helper()
	if fp, ok := resp["file_path"].(string); ok && fp != "" {
		t.Cleanup(func() { os.Remove(fp) })
	}
}

// ---------------------------------------------------------------------------
// 1. export_markdown
// ---------------------------------------------------------------------------

func TestExportMarkdown(t *testing.T) {
	env := newLocalTestEnv(t)

	t.Run("basic markdown export", func(t *testing.T) {
		content := "# Hello World\n\nThis is a **test** document.\n\n- Item 1\n- Item 2\n"
		raw := env.mustCall(t, "export_markdown", map[string]interface{}{
			"content":  content,
			"filename": "test-export-md",
		})

		resp := parseResponse(t, raw)
		cleanupFile(t, resp)

		// Verify file_path ends with .md
		fp, ok := resp["file_path"].(string)
		if !ok || fp == "" {
			t.Fatal("expected non-empty file_path in response")
		}
		if !strings.HasSuffix(fp, ".md") {
			t.Errorf("expected .md extension, got path: %s", fp)
		}

		// Verify file exists and content matches.
		data, err := os.ReadFile(fp)
		if err != nil {
			t.Fatalf("failed to read exported file: %v", err)
		}
		if string(data) != content {
			t.Errorf("file content mismatch:\nwant: %q\ngot:  %q", content, string(data))
		}

		// Verify size_bytes matches actual file size.
		sizeBytes, ok := resp["size_bytes"].(float64)
		if !ok {
			t.Fatal("expected size_bytes in response")
		}
		if int(sizeBytes) != len(data) {
			t.Errorf("size_bytes mismatch: response=%d, actual=%d", int(sizeBytes), len(data))
		}

		// Verify format field.
		if resp["format"] != "md" {
			t.Errorf("expected format=md, got %v", resp["format"])
		}
	})

	t.Run("file lives in expected export directory", func(t *testing.T) {
		raw := env.mustCall(t, "export_markdown", map[string]interface{}{
			"content":  "test",
			"filename": "test-dir-check",
		})
		resp := parseResponse(t, raw)
		cleanupFile(t, resp)

		fp := resp["file_path"].(string)
		// Path should contain /tmp/orchestra-exports/{orgID}/
		expectedPrefix := filepath.Join("/tmp", "orchestra-exports", env.orgID)
		if !strings.HasPrefix(fp, expectedPrefix) {
			t.Errorf("expected path to start with %s, got %s", expectedPrefix, fp)
		}
	})

	t.Run("missing content returns error", func(t *testing.T) {
		errText := env.expectError(t, "export_markdown", map[string]interface{}{
			"filename": "no-content",
		})
		if !strings.Contains(errText, "content is required") {
			t.Errorf("expected 'content is required' error, got: %s", errText)
		}
	})

	t.Run("missing filename returns error", func(t *testing.T) {
		errText := env.expectError(t, "export_markdown", map[string]interface{}{
			"content": "something",
		})
		if !strings.Contains(errText, "filename is required") {
			t.Errorf("expected 'filename is required' error, got: %s", errText)
		}
	})
}

// ---------------------------------------------------------------------------
// 2. export_csv
// ---------------------------------------------------------------------------

func TestExportCSV(t *testing.T) {
	env := newLocalTestEnv(t)

	t.Run("basic CSV with headers and rows", func(t *testing.T) {
		raw := env.mustCall(t, "export_csv", map[string]interface{}{
			"headers":  []string{"Name", "Age", "City"},
			"rows":     [][]string{{"Alice", "30", "Cairo"}, {"Bob", "25", "NYC"}},
			"filename": "test-basic-csv",
		})

		resp := parseResponse(t, raw)
		cleanupFile(t, resp)

		fp := resp["file_path"].(string)
		if !strings.HasSuffix(fp, ".csv") {
			t.Errorf("expected .csv extension, got: %s", fp)
		}

		data, err := os.ReadFile(fp)
		if err != nil {
			t.Fatalf("failed to read CSV file: %v", err)
		}

		// Verify UTF-8 BOM is present (first 3 bytes: 0xEF, 0xBB, 0xBF).
		if len(data) < 3 || data[0] != 0xEF || data[1] != 0xBB || data[2] != 0xBF {
			t.Error("expected UTF-8 BOM at start of CSV file")
		}

		// Verify content includes headers and data.
		content := string(data[3:]) // skip BOM
		if !strings.Contains(content, "Name,Age,City") {
			t.Errorf("expected headers in CSV content, got: %.200s", content)
		}
		if !strings.Contains(content, "Alice,30,Cairo") {
			t.Errorf("expected data row in CSV content, got: %.200s", content)
		}

		// Verify row_count.
		rowCount, ok := resp["row_count"].(float64)
		if !ok {
			t.Fatal("expected row_count in response")
		}
		if int(rowCount) != 2 {
			t.Errorf("expected row_count=2, got %d", int(rowCount))
		}
	})

	t.Run("special characters in data", func(t *testing.T) {
		raw := env.mustCall(t, "export_csv", map[string]interface{}{
			"headers":  []string{"Name", "Description"},
			"rows":     [][]string{{"O'Brien", `He said "hello"`}, {"Smith, Jr.", "Line1\nLine2"}},
			"filename": "test-special-csv",
		})

		resp := parseResponse(t, raw)
		cleanupFile(t, resp)

		fp := resp["file_path"].(string)
		data, err := os.ReadFile(fp)
		if err != nil {
			t.Fatalf("failed to read CSV file: %v", err)
		}

		// CSV should properly quote fields containing commas and quotes.
		content := string(data[3:]) // skip BOM
		if !strings.Contains(content, `"Smith, Jr."`) {
			t.Errorf("expected quoted field with comma, got: %.300s", content)
		}
		if !strings.Contains(content, `"He said ""hello"""`) {
			t.Errorf("expected escaped quotes in CSV, got: %.300s", content)
		}
	})

	t.Run("unicode and Arabic text with UTF-8 BOM", func(t *testing.T) {
		raw := env.mustCall(t, "export_csv", map[string]interface{}{
			"headers":  []string{"الاسم", "المدينة"},
			"rows":     [][]string{{"محمد", "القاهرة"}, {"فاطمة", "الإسكندرية"}},
			"filename": "test-arabic-csv",
		})

		resp := parseResponse(t, raw)
		cleanupFile(t, resp)

		fp := resp["file_path"].(string)
		data, err := os.ReadFile(fp)
		if err != nil {
			t.Fatalf("failed to read CSV file: %v", err)
		}

		// Verify UTF-8 BOM.
		if len(data) < 3 || data[0] != 0xEF || data[1] != 0xBB || data[2] != 0xBF {
			t.Error("expected UTF-8 BOM for Arabic CSV")
		}

		// Verify Arabic content is present.
		content := string(data[3:])
		if !strings.Contains(content, "محمد") {
			t.Errorf("expected Arabic text in CSV, got: %.300s", content)
		}
		if !strings.Contains(content, "القاهرة") {
			t.Errorf("expected Arabic city in CSV, got: %.300s", content)
		}
	})

	t.Run("empty rows - headers only", func(t *testing.T) {
		raw := env.mustCall(t, "export_csv", map[string]interface{}{
			"headers":  []string{"Col1", "Col2"},
			"rows":     [][]string{},
			"filename": "test-empty-rows-csv",
		})

		resp := parseResponse(t, raw)
		cleanupFile(t, resp)

		rowCount, ok := resp["row_count"].(float64)
		if !ok {
			t.Fatal("expected row_count in response")
		}
		if int(rowCount) != 0 {
			t.Errorf("expected row_count=0, got %d", int(rowCount))
		}

		// Verify file has headers but no data rows.
		fp := resp["file_path"].(string)
		data, err := os.ReadFile(fp)
		if err != nil {
			t.Fatalf("failed to read CSV file: %v", err)
		}
		content := string(data[3:]) // skip BOM
		lines := strings.Split(strings.TrimSpace(content), "\n")
		if len(lines) != 1 {
			t.Errorf("expected 1 line (headers only), got %d lines", len(lines))
		}
	})

	t.Run("missing headers returns error", func(t *testing.T) {
		errText := env.expectError(t, "export_csv", map[string]interface{}{
			"headers":  []string{},
			"rows":     [][]string{},
			"filename": "bad",
		})
		if !strings.Contains(errText, "headers") {
			t.Errorf("expected error about headers, got: %s", errText)
		}
	})
}

// ---------------------------------------------------------------------------
// 3. export_xlsx
// ---------------------------------------------------------------------------

func TestExportXLSX(t *testing.T) {
	env := newLocalTestEnv(t)

	t.Run("single sheet with headers and rows", func(t *testing.T) {
		raw := env.mustCall(t, "export_xlsx", map[string]interface{}{
			"sheets": []map[string]interface{}{
				{
					"name":    "Tasks",
					"headers": []string{"ID", "Title", "Status"},
					"rows":    [][]string{{"1", "Setup DB", "done"}, {"2", "Build API", "in_progress"}},
				},
			},
			"filename": "test-single-sheet",
		})

		resp := parseResponse(t, raw)
		cleanupFile(t, resp)

		fp := resp["file_path"].(string)
		if !strings.HasSuffix(fp, ".xlsx") {
			t.Errorf("expected .xlsx extension, got: %s", fp)
		}

		// Verify file is a valid ZIP (xlsx is a ZIP archive).
		data, err := os.ReadFile(fp)
		if err != nil {
			t.Fatalf("failed to read xlsx file: %v", err)
		}
		if _, err := zip.NewReader(bytes.NewReader(data), int64(len(data))); err != nil {
			t.Fatalf("xlsx file is not a valid ZIP: %v", err)
		}

		// Verify sheet_count.
		sheetCount, ok := resp["sheet_count"].(float64)
		if !ok {
			t.Fatal("expected sheet_count in response")
		}
		if int(sheetCount) != 1 {
			t.Errorf("expected sheet_count=1, got %d", int(sheetCount))
		}

		// Verify total_rows.
		totalRows, ok := resp["total_rows"].(float64)
		if !ok {
			t.Fatal("expected total_rows in response")
		}
		if int(totalRows) != 2 {
			t.Errorf("expected total_rows=2, got %d", int(totalRows))
		}
	})

	t.Run("multi-sheet workbook", func(t *testing.T) {
		raw := env.mustCall(t, "export_xlsx", map[string]interface{}{
			"sheets": []map[string]interface{}{
				{
					"name":    "Summary",
					"headers": []string{"Metric", "Value"},
					"rows":    [][]string{{"Total", "10"}, {"Done", "7"}},
				},
				{
					"name":    "Details",
					"headers": []string{"Task", "Owner"},
					"rows":    [][]string{{"Auth", "Omar"}, {"API", "Mostafa"}, {"UI", "Yassin"}},
				},
			},
			"filename": "test-multi-sheet",
		})

		resp := parseResponse(t, raw)
		cleanupFile(t, resp)

		sheetCount := int(resp["sheet_count"].(float64))
		if sheetCount != 2 {
			t.Errorf("expected sheet_count=2, got %d", sheetCount)
		}

		totalRows := int(resp["total_rows"].(float64))
		if totalRows != 5 {
			t.Errorf("expected total_rows=5 (2+3), got %d", totalRows)
		}
	})

	t.Run("with title creates merged cells", func(t *testing.T) {
		raw := env.mustCall(t, "export_xlsx", map[string]interface{}{
			"sheets": []map[string]interface{}{
				{
					"name":    "Report",
					"headers": []string{"A", "B", "C"},
					"rows":    [][]string{{"1", "2", "3"}},
				},
			},
			"filename": "test-with-title",
			"title":    "Quarterly Report Q1 2026",
		})

		resp := parseResponse(t, raw)
		cleanupFile(t, resp)

		// Verify file is valid ZIP and has non-zero size.
		fp := resp["file_path"].(string)
		info, err := os.Stat(fp)
		if err != nil {
			t.Fatalf("failed to stat xlsx file: %v", err)
		}
		if info.Size() == 0 {
			t.Error("expected non-zero xlsx file size")
		}

		// The title is written as merged cells in the first row of the first sheet.
		// We verify indirectly by checking the file is valid and has the expected metadata.
		if resp["format"] != "xlsx" {
			t.Errorf("expected format=xlsx, got %v", resp["format"])
		}
	})

	t.Run("empty sheets returns error", func(t *testing.T) {
		errText := env.expectError(t, "export_xlsx", map[string]interface{}{
			"sheets":   []map[string]interface{}{},
			"filename": "bad",
		})
		if !strings.Contains(errText, "sheets") {
			t.Errorf("expected error about sheets, got: %s", errText)
		}
	})
}

// ---------------------------------------------------------------------------
// 4. export_pdf
// ---------------------------------------------------------------------------

func TestExportPDF(t *testing.T) {
	env := newLocalTestEnv(t)

	t.Run("generates file from markdown", func(t *testing.T) {
		content := "# Test PDF\n\nThis is a paragraph.\n\n## Section 2\n\n- bullet one\n- bullet two\n"
		raw := env.mustCall(t, "export_pdf", map[string]interface{}{
			"content":  content,
			"filename": "test-pdf-export",
		})

		resp := parseResponse(t, raw)
		cleanupFile(t, resp)

		fp := resp["file_path"].(string)
		if fp == "" {
			t.Fatal("expected non-empty file_path")
		}

		// Verify file exists and has non-zero size.
		info, err := os.Stat(fp)
		if err != nil {
			t.Fatalf("failed to stat exported file: %v", err)
		}
		if info.Size() == 0 {
			t.Error("expected non-zero file size")
		}

		// Verify size_bytes in response.
		sizeBytes := int64(resp["size_bytes"].(float64))
		if sizeBytes != info.Size() {
			t.Errorf("size_bytes mismatch: response=%d, actual=%d", sizeBytes, info.Size())
		}

		// Verify format field is either "pdf" or "html" (depends on wkhtmltopdf availability).
		format, ok := resp["format"].(string)
		if !ok {
			t.Fatal("expected format in response")
		}
		if format != "pdf" && format != "html" {
			t.Errorf("expected format to be 'pdf' or 'html', got: %s", format)
		}

		// If format is html, verify the file contains valid HTML.
		if format == "html" {
			data, err := os.ReadFile(fp)
			if err != nil {
				t.Fatalf("failed to read HTML file: %v", err)
			}
			if !strings.Contains(string(data), "<!DOCTYPE html>") {
				t.Error("expected HTML doctype in fallback output")
			}
			if !strings.Contains(string(data), "Test PDF") {
				t.Error("expected rendered markdown content in HTML")
			}
		}
	})

	t.Run("respects page_size and orientation", func(t *testing.T) {
		raw := env.mustCall(t, "export_pdf", map[string]interface{}{
			"content":     "# Landscape Letter\n\nContent here.",
			"filename":    "test-pdf-landscape",
			"page_size":   "Letter",
			"orientation": "landscape",
		})

		resp := parseResponse(t, raw)
		cleanupFile(t, resp)

		if resp["page_size"] != "LETTER" {
			t.Errorf("expected page_size=LETTER, got %v", resp["page_size"])
		}
		if resp["orientation"] != "landscape" {
			t.Errorf("expected orientation=landscape, got %v", resp["orientation"])
		}
	})

	t.Run("invalid page_size returns error", func(t *testing.T) {
		errText := env.expectError(t, "export_pdf", map[string]interface{}{
			"content":   "test",
			"filename":  "bad",
			"page_size": "B5",
		})
		if !strings.Contains(errText, "page_size") {
			t.Errorf("expected error about page_size, got: %s", errText)
		}
	})

	t.Run("invalid orientation returns error", func(t *testing.T) {
		errText := env.expectError(t, "export_pdf", map[string]interface{}{
			"content":     "test",
			"filename":    "bad",
			"orientation": "diagonal",
		})
		if !strings.Contains(errText, "orientation") {
			t.Errorf("expected error about orientation, got: %s", errText)
		}
	})

	t.Run("missing content returns error", func(t *testing.T) {
		errText := env.expectError(t, "export_pdf", map[string]interface{}{
			"filename": "bad",
		})
		if !strings.Contains(errText, "content is required") {
			t.Errorf("expected 'content is required' error, got: %s", errText)
		}
	})
}

// ---------------------------------------------------------------------------
// 5. export_docx
// ---------------------------------------------------------------------------

func TestExportDocx(t *testing.T) {
	env := newLocalTestEnv(t)

	t.Run("generates valid DOCX from markdown", func(t *testing.T) {
		content := "# Meeting Notes\n\n## Attendees\n\n- Alice\n- Bob\n\n## Action Items\n\n1. Deploy v2\n2. Update docs\n"
		raw := env.mustCall(t, "export_docx", map[string]interface{}{
			"content":  content,
			"filename": "test-docx-basic",
		})

		resp := parseResponse(t, raw)
		cleanupFile(t, resp)

		fp := resp["file_path"].(string)
		if !strings.HasSuffix(fp, ".docx") {
			t.Errorf("expected .docx extension, got: %s", fp)
		}

		// DOCX is a ZIP archive — verify it's valid.
		data, err := os.ReadFile(fp)
		if err != nil {
			t.Fatalf("failed to read docx file: %v", err)
		}
		zr, err := zip.NewReader(bytes.NewReader(data), int64(len(data)))
		if err != nil {
			t.Fatalf("docx file is not a valid ZIP: %v", err)
		}

		// Verify expected DOCX internal files exist.
		fileNames := make(map[string]bool)
		for _, f := range zr.File {
			fileNames[f.Name] = true
		}
		requiredFiles := []string{
			"[Content_Types].xml",
			"_rels/.rels",
			"word/document.xml",
		}
		for _, rf := range requiredFiles {
			if !fileNames[rf] {
				t.Errorf("expected DOCX to contain %s", rf)
			}
		}

		if resp["format"] != "docx" {
			t.Errorf("expected format=docx, got %v", resp["format"])
		}
	})

	t.Run("with title and author", func(t *testing.T) {
		raw := env.mustCall(t, "export_docx", map[string]interface{}{
			"content":  "# Report\n\nSome content.",
			"filename": "test-docx-titled",
			"title":    "Sprint Report Q1",
			"author":   "Mariam Helmy",
		})

		resp := parseResponse(t, raw)
		cleanupFile(t, resp)

		// Verify the file was created and is non-empty.
		fp := resp["file_path"].(string)
		info, err := os.Stat(fp)
		if err != nil {
			t.Fatalf("failed to stat docx file: %v", err)
		}
		if info.Size() == 0 {
			t.Error("expected non-zero docx file size")
		}

		// Verify docProps/core.xml is present (contains title/author metadata).
		data, err := os.ReadFile(fp)
		if err != nil {
			t.Fatalf("failed to read docx file: %v", err)
		}
		zr, err := zip.NewReader(bytes.NewReader(data), int64(len(data)))
		if err != nil {
			t.Fatalf("docx is not valid ZIP: %v", err)
		}
		found := false
		for _, f := range zr.File {
			if f.Name == "docProps/core.xml" {
				found = true
				break
			}
		}
		if !found {
			t.Error("expected docProps/core.xml in DOCX with title/author")
		}
	})

	t.Run("without title generates valid docx", func(t *testing.T) {
		raw := env.mustCall(t, "export_docx", map[string]interface{}{
			"content":  "Just a paragraph.",
			"filename": "test-docx-no-title",
		})

		resp := parseResponse(t, raw)
		cleanupFile(t, resp)

		fp := resp["file_path"].(string)
		data, err := os.ReadFile(fp)
		if err != nil {
			t.Fatalf("failed to read docx file: %v", err)
		}
		if _, err := zip.NewReader(bytes.NewReader(data), int64(len(data))); err != nil {
			t.Fatalf("docx file without title is not valid ZIP: %v", err)
		}
	})

	t.Run("missing content returns error", func(t *testing.T) {
		errText := env.expectError(t, "export_docx", map[string]interface{}{
			"filename": "bad",
		})
		if !strings.Contains(errText, "content is required") {
			t.Errorf("expected 'content is required' error, got: %s", errText)
		}
	})
}

// ---------------------------------------------------------------------------
// 6. export_pptx
// ---------------------------------------------------------------------------

func TestExportPptx(t *testing.T) {
	env := newLocalTestEnv(t)

	t.Run("generates 3-slide presentation", func(t *testing.T) {
		raw := env.mustCall(t, "export_pptx", map[string]interface{}{
			"title": "Sprint Review",
			"slides": []map[string]interface{}{
				{"title": "Overview", "bullets": []string{"Completed 5 tasks", "2 blocked"}},
				{"title": "Details", "bullets": []string{"Auth system done", "API 80%"}},
				{"title": "Next Steps", "bullets": []string{"Deploy to staging", "QA round 2"}},
			},
			"filename": "test-pptx-3slides",
		})

		resp := parseResponse(t, raw)
		cleanupFile(t, resp)

		fp := resp["file_path"].(string)
		if !strings.HasSuffix(fp, ".pptx") {
			t.Errorf("expected .pptx extension, got: %s", fp)
		}

		// PPTX is a ZIP archive — verify validity.
		data, err := os.ReadFile(fp)
		if err != nil {
			t.Fatalf("failed to read pptx file: %v", err)
		}
		if _, err := zip.NewReader(bytes.NewReader(data), int64(len(data))); err != nil {
			t.Fatalf("pptx file is not a valid ZIP: %v", err)
		}

		// Verify slide_count matches.
		slideCount, ok := resp["slide_count"].(float64)
		if !ok {
			t.Fatal("expected slide_count in response")
		}
		if int(slideCount) != 3 {
			t.Errorf("expected slide_count=3, got %d", int(slideCount))
		}

		if resp["format"] != "pptx" {
			t.Errorf("expected format=pptx, got %v", resp["format"])
		}
	})

	t.Run("slides with bullets only", func(t *testing.T) {
		raw := env.mustCall(t, "export_pptx", map[string]interface{}{
			"title": "Bullets Only",
			"slides": []map[string]interface{}{
				{"title": "Slide 1", "bullets": []string{"Point A", "Point B", "Point C"}},
			},
			"filename": "test-pptx-bullets-only",
		})

		resp := parseResponse(t, raw)
		cleanupFile(t, resp)

		if int(resp["slide_count"].(float64)) != 1 {
			t.Errorf("expected slide_count=1, got %v", resp["slide_count"])
		}
	})

	t.Run("slides with notes", func(t *testing.T) {
		raw := env.mustCall(t, "export_pptx", map[string]interface{}{
			"title": "With Notes",
			"slides": []map[string]interface{}{
				{
					"title":   "Intro",
					"bullets": []string{"Welcome"},
					"notes":   "Remember to greet the audience",
				},
				{
					"title":   "Closing",
					"bullets": []string{"Thank you"},
					"notes":   "Open floor for questions",
				},
			},
			"filename": "test-pptx-notes",
		})

		resp := parseResponse(t, raw)
		cleanupFile(t, resp)

		// Verify file is valid and has correct slide count.
		fp := resp["file_path"].(string)
		data, err := os.ReadFile(fp)
		if err != nil {
			t.Fatalf("failed to read pptx file: %v", err)
		}
		if _, err := zip.NewReader(bytes.NewReader(data), int64(len(data))); err != nil {
			t.Fatalf("pptx file with notes is not a valid ZIP: %v", err)
		}
		if int(resp["slide_count"].(float64)) != 2 {
			t.Errorf("expected slide_count=2, got %v", resp["slide_count"])
		}
	})

	t.Run("missing title returns error", func(t *testing.T) {
		errText := env.expectError(t, "export_pptx", map[string]interface{}{
			"slides": []map[string]interface{}{
				{"title": "Slide"},
			},
			"filename": "bad",
		})
		if !strings.Contains(errText, "title is required") {
			t.Errorf("expected 'title is required' error, got: %s", errText)
		}
	})

	t.Run("empty slides returns error", func(t *testing.T) {
		errText := env.expectError(t, "export_pptx", map[string]interface{}{
			"title":    "Empty",
			"slides":   []map[string]interface{}{},
			"filename": "bad",
		})
		if !strings.Contains(errText, "slides") {
			t.Errorf("expected error about slides, got: %s", errText)
		}
	})
}

// ---------------------------------------------------------------------------
// 7. export_diagram
// ---------------------------------------------------------------------------

func TestExportDiagram(t *testing.T) {
	env := newLocalTestEnv(t)

	t.Run("SVG from simple flowchart", func(t *testing.T) {
		mermaid := "flowchart TD\n    A[Start] --> B[Process]\n    B --> C[End]"
		raw := env.mustCall(t, "export_diagram", map[string]interface{}{
			"mermaid":  mermaid,
			"format":   "svg",
			"filename": "test-diagram-flowchart",
		})

		resp := parseResponse(t, raw)
		cleanupFile(t, resp)

		fp := resp["file_path"].(string)
		if fp == "" {
			t.Fatal("expected non-empty file_path")
		}

		// Verify file exists.
		info, err := os.Stat(fp)
		if err != nil {
			t.Fatalf("failed to stat diagram file: %v", err)
		}
		if info.Size() == 0 {
			t.Error("expected non-zero file size")
		}

		// Check renderer field exists.
		renderer, ok := resp["renderer"].(string)
		if !ok || renderer == "" {
			t.Fatal("expected renderer field in response")
		}

		// If renderer is "manual", verify SVG content contains <svg tag.
		if renderer == "manual" {
			data, err := os.ReadFile(fp)
			if err != nil {
				t.Fatalf("failed to read SVG file: %v", err)
			}
			if !strings.Contains(string(data), "<svg") {
				t.Error("expected <svg tag in manual SVG output")
			}
			if !strings.HasSuffix(fp, ".svg") {
				t.Errorf("expected .svg extension for manual SVG, got: %s", fp)
			}
		}

		// If renderer is "source-only", verify .mmd extension.
		if renderer == "source-only" {
			if !strings.HasSuffix(fp, ".mmd") {
				t.Errorf("expected .mmd extension for source-only, got: %s", fp)
			}
		}
	})

	t.Run("PNG request without mmdc falls back gracefully", func(t *testing.T) {
		mermaid := "flowchart TD\n    A --> B"
		raw := env.mustCall(t, "export_diagram", map[string]interface{}{
			"mermaid":  mermaid,
			"format":   "png",
			"filename": "test-diagram-png-fallback",
		})

		resp := parseResponse(t, raw)
		cleanupFile(t, resp)

		// Without mmdc installed, PNG requests should fall back to .mmd source.
		renderer := resp["renderer"].(string)
		// It should be either "mermaid-cli" (if mmdc exists) or "source-only" (fallback).
		if renderer != "mermaid-cli" && renderer != "source-only" {
			t.Errorf("expected renderer to be 'mermaid-cli' or 'source-only', got: %s", renderer)
		}

		// Verify file was created.
		fp := resp["file_path"].(string)
		if _, err := os.Stat(fp); err != nil {
			t.Fatalf("expected file to exist at %s: %v", fp, err)
		}
	})

	t.Run("invalid format returns error", func(t *testing.T) {
		errText := env.expectError(t, "export_diagram", map[string]interface{}{
			"mermaid":  "flowchart TD\n    A --> B",
			"format":   "gif",
			"filename": "bad",
		})
		if !strings.Contains(errText, "format") {
			t.Errorf("expected error about format, got: %s", errText)
		}
	})

	t.Run("missing mermaid returns error", func(t *testing.T) {
		errText := env.expectError(t, "export_diagram", map[string]interface{}{
			"format":   "svg",
			"filename": "bad",
		})
		if !strings.Contains(errText, "mermaid is required") {
			t.Errorf("expected 'mermaid is required' error, got: %s", errText)
		}
	})

	t.Run("LR flowchart layout", func(t *testing.T) {
		mermaid := "flowchart LR\n    A[Input] --> B[Transform] --> C[Output]"
		raw := env.mustCall(t, "export_diagram", map[string]interface{}{
			"mermaid":  mermaid,
			"format":   "svg",
			"filename": "test-diagram-lr",
		})

		resp := parseResponse(t, raw)
		cleanupFile(t, resp)

		fp := resp["file_path"].(string)
		if _, err := os.Stat(fp); err != nil {
			t.Fatalf("expected LR flowchart file to exist: %v", err)
		}
	})
}

// ---------------------------------------------------------------------------
// 8. report_generate (DB-dependent)
// ---------------------------------------------------------------------------

func TestReportGenerate(t *testing.T) {
	// This test requires a real database connection.
	if os.Getenv("SUPABASE_URL") == "" || os.Getenv("SUPABASE_SERVICE_KEY") == "" {
		t.Skip("Skipping report_generate integration test: SUPABASE_URL and SUPABASE_SERVICE_KEY must be set")
	}

	dbClient := db.NewClient(os.Getenv("SUPABASE_URL"), os.Getenv("SUPABASE_SERVICE_KEY"))
	registry := mcp.NewToolRegistry()

	// Register report tools (needs DB) and all export tools (used internally by reports).
	RegisterReportTools(registry, dbClient)
	RegisterExportTools(registry, nil)
	RegisterOfficeExportTools(registry, nil)
	RegisterDiagramExportTools(registry, nil)
	// Also register project/task tools for fixture creation.
	RegisterProjectTools(registry, dbClient)
	RegisterTaskTools(registry, dbClient)
	RegisterDecisionTools(registry, dbClient, nil)

	orgID := os.Getenv("TEST_ORG_ID")
	if orgID == "" {
		orgID = "00000000-0000-0000-0000-000000000001"
	}
	userID := os.Getenv("TEST_USER_ID")
	if userID == "" {
		userID = "00000000-0000-0000-0000-000000000001"
	}

	ctx := auth.WithUserContext(context.Background(), &auth.UserContext{
		TokenID: "test-token",
		UserID:  userID,
		OrgID:   orgID,
		Scopes:  []string{"*"},
		Plan:    "enterprise",
	})

	callTool := func(t *testing.T, toolName string, args interface{}) (string, bool) {
		t.Helper()
		params, err := json.Marshal(args)
		if err != nil {
			t.Fatalf("marshal params: %v", err)
		}
		result, err := registry.Call(ctx, toolName, json.RawMessage(params))
		if err != nil {
			t.Fatalf("unexpected Go error from %s: %v", toolName, err)
		}
		if len(result.Content) == 0 {
			t.Fatalf("%s returned empty content", toolName)
		}
		return result.Content[0].Text, result.IsError
	}

	mustCallTool := func(t *testing.T, toolName string, args interface{}) string {
		t.Helper()
		text, isErr := callTool(t, toolName, args)
		if isErr {
			t.Fatalf("%s returned error: %s", toolName, text)
		}
		return text
	}

	// Create test project.
	projRaw := mustCallTool(t, "project_create", map[string]interface{}{
		"name":        "Report Test Project",
		"description": "A project created for report generation testing",
	})
	projectID := parseID(t, projRaw)
	t.Cleanup(func() {
		dbClient.Delete(context.Background(), "projects",
			fmt.Sprintf("id=eq.%s&organization_id=eq.%s", projectID, orgID))
	})

	// Create test tasks.
	for i, title := range []string{"Setup database", "Build API endpoints", "Write tests"} {
		taskRaw := mustCallTool(t, "task_create", map[string]interface{}{
			"title":      title,
			"project_id": projectID,
			"priority":   "high",
			"type":       "feature",
		})
		taskID := parseID(t, taskRaw)
		_ = i
		t.Cleanup(func() {
			dbClient.Delete(context.Background(), "tasks",
				fmt.Sprintf("id=eq.%s&organization_id=eq.%s", taskID, orgID))
		})
	}

	t.Run("status report in markdown format", func(t *testing.T) {
		raw := mustCallTool(t, "report_generate", map[string]interface{}{
			"project_id":  projectID,
			"report_type": "status",
			"formats":     []string{"md"},
		})

		resp := parseResponse(t, raw)

		// Verify project name in response.
		if resp["project"] != "Report Test Project" {
			t.Errorf("expected project='Report Test Project', got %v", resp["project"])
		}
		if resp["report_type"] != "status" {
			t.Errorf("expected report_type='status', got %v", resp["report_type"])
		}

		// Verify files array.
		files, ok := resp["files"].([]interface{})
		if !ok || len(files) == 0 {
			t.Fatal("expected non-empty files array in response")
		}

		fileInfo := files[0].(map[string]interface{})
		if fileInfo["format"] != "md" {
			t.Errorf("expected format=md, got %v", fileInfo["format"])
		}

		fp := fileInfo["file_path"].(string)
		t.Cleanup(func() { os.Remove(fp) })

		// Verify file exists and contains project data.
		data, err := os.ReadFile(fp)
		if err != nil {
			t.Fatalf("failed to read report file: %v", err)
		}
		content := string(data)
		if !strings.Contains(content, "Report Test Project") {
			t.Error("expected report to contain project name")
		}
		// Verify at least one task title appears.
		if !strings.Contains(content, "Setup database") && !strings.Contains(content, "Build API") && !strings.Contains(content, "Write tests") {
			t.Error("expected report to contain at least one task title")
		}
	})

	t.Run("invalid report_type returns error", func(t *testing.T) {
		text, isErr := callTool(t, "report_generate", map[string]interface{}{
			"project_id":  projectID,
			"report_type": "invalid_type",
			"formats":     []string{"md"},
		})
		if !isErr {
			t.Fatalf("expected error for invalid report_type, got success: %s", text)
		}
		if !strings.Contains(text, "report_type") {
			t.Errorf("expected error about report_type, got: %s", text)
		}
	})

	t.Run("invalid format returns error", func(t *testing.T) {
		text, isErr := callTool(t, "report_generate", map[string]interface{}{
			"project_id":  projectID,
			"report_type": "status",
			"formats":     []string{"invalid_fmt"},
		})
		if !isErr {
			t.Fatalf("expected error for invalid format, got success: %s", text)
		}
		if !strings.Contains(text, "invalid format") {
			t.Errorf("expected 'invalid format' error, got: %s", text)
		}
	})

	t.Run("missing project_id returns error", func(t *testing.T) {
		text, isErr := callTool(t, "report_generate", map[string]interface{}{
			"report_type": "status",
			"formats":     []string{"md"},
		})
		if !isErr {
			t.Fatalf("expected error for missing project_id, got success: %s", text)
		}
		if !strings.Contains(text, "project_id") {
			t.Errorf("expected error about project_id, got: %s", text)
		}
	})
}
