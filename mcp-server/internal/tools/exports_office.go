package tools

import (
	"archive/zip"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"html"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/orchestra-mcp/server/internal/auth"
	"github.com/orchestra-mcp/server/internal/db"
	"github.com/orchestra-mcp/server/internal/mcp"
)

// ---------------------------------------------------------------------------
// JSON Schemas
// ---------------------------------------------------------------------------

var exportDocxSchema = json.RawMessage(`{
	"type": "object",
	"properties": {
		"content":  {"type": "string", "description": "Markdown content to convert to DOCX"},
		"filename": {"type": "string", "description": "Output filename without extension"},
		"title":    {"type": "string", "description": "Document title (shown on title page)"},
		"author":   {"type": "string", "description": "Document author (shown on title page)"}
	},
	"required": ["content", "filename"]
}`)

var exportPptxSchema = json.RawMessage(`{
	"type": "object",
	"properties": {
		"title":    {"type": "string", "description": "Presentation title"},
		"slides":   {
			"type": "array",
			"description": "Array of slide objects",
			"items": {
				"type": "object",
				"properties": {
					"title":      {"type": "string", "description": "Slide title"},
					"bullets":    {"type": "array", "items": {"type": "string"}, "description": "Bullet points"},
					"notes":      {"type": "string", "description": "Speaker notes"},
					"image_path": {"type": "string", "description": "Path to an image file (optional)"}
				},
				"required": ["title"]
			}
		},
		"filename": {"type": "string", "description": "Output filename without extension"}
	},
	"required": ["title", "slides", "filename"]
}`)

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

// RegisterOfficeExportTools registers the export_docx and export_pptx MCP tools.
func RegisterOfficeExportTools(registry *mcp.ToolRegistry, _ *db.Client) {
	registry.Register("export_docx", "Generate a Word document (DOCX) from Markdown content with title page and styled headings", exportDocxSchema, makeExportDocx())
	registry.Register("export_pptx", "Generate a PowerPoint presentation (PPTX) from structured slide data with titles, bullets, and speaker notes", exportPptxSchema, makeExportPptx())
}

// ---------------------------------------------------------------------------
// DOCX Handler
// ---------------------------------------------------------------------------

func makeExportDocx() mcp.ToolHandler {
	return func(ctx context.Context, params json.RawMessage) (*mcp.ToolResult, error) {
		var input struct {
			Content  string `json:"content"`
			Filename string `json:"filename"`
			Title    string `json:"title"`
			Author   string `json:"author"`
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

		docxBytes, err := buildDocx(input.Content, input.Title, input.Author)
		if err != nil {
			return mcp.ErrorResult("failed to generate DOCX: " + err.Error()), nil
		}

		filePath := filepath.Join(dir, input.Filename+".docx")
		if err := os.WriteFile(filePath, docxBytes, 0644); err != nil {
			return mcp.ErrorResult("failed to write file: " + err.Error()), nil
		}

		result := map[string]interface{}{
			"file_path":  filePath,
			"format":     "docx",
			"size_bytes": len(docxBytes),
		}
		return jsonResult(result)
	}
}

// ---------------------------------------------------------------------------
// PPTX Handler
// ---------------------------------------------------------------------------

type slideInput struct {
	Title     string   `json:"title"`
	Bullets   []string `json:"bullets"`
	Notes     string   `json:"notes"`
	ImagePath string   `json:"image_path"`
}

func makeExportPptx() mcp.ToolHandler {
	return func(ctx context.Context, params json.RawMessage) (*mcp.ToolResult, error) {
		var input struct {
			Title    string       `json:"title"`
			Slides   []slideInput `json:"slides"`
			Filename string       `json:"filename"`
		}
		if err := json.Unmarshal(params, &input); err != nil {
			return mcp.ErrorResult("invalid params: " + err.Error()), nil
		}
		if input.Title == "" {
			return mcp.ErrorResult("title is required"), nil
		}
		if len(input.Slides) == 0 {
			return mcp.ErrorResult("slides is required and must not be empty"), nil
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

		pptxBytes, err := buildPptx(input.Title, input.Slides)
		if err != nil {
			return mcp.ErrorResult("failed to generate PPTX: " + err.Error()), nil
		}

		filePath := filepath.Join(dir, input.Filename+".pptx")
		if err := os.WriteFile(filePath, pptxBytes, 0644); err != nil {
			return mcp.ErrorResult("failed to write file: " + err.Error()), nil
		}

		result := map[string]interface{}{
			"file_path":   filePath,
			"format":      "pptx",
			"size_bytes":  len(pptxBytes),
			"slide_count": len(input.Slides),
		}
		return jsonResult(result)
	}
}

// ===========================================================================
// DOCX Generation (raw XML-in-ZIP)
// ===========================================================================

// buildDocx creates a valid DOCX file from markdown content.
// DOCX is an Open XML package: a ZIP containing XML parts.
func buildDocx(markdown, title, author string) ([]byte, error) {
	var buf bytes.Buffer
	zw := zip.NewWriter(&buf)

	// [Content_Types].xml
	if err := addZipFile(zw, "[Content_Types].xml", docxContentTypes); err != nil {
		return nil, err
	}

	// _rels/.rels
	if err := addZipFile(zw, "_rels/.rels", docxRels); err != nil {
		return nil, err
	}

	// word/_rels/document.xml.rels
	if err := addZipFile(zw, "word/_rels/document.xml.rels", docxDocumentRels); err != nil {
		return nil, err
	}

	// word/styles.xml
	if err := addZipFile(zw, "word/styles.xml", docxStyles); err != nil {
		return nil, err
	}

	// word/document.xml — the actual content
	docXML := markdownToDocxBody(markdown, title, author)
	if err := addZipFile(zw, "word/document.xml", docXML); err != nil {
		return nil, err
	}

	// docProps/core.xml — metadata
	coreXML := buildDocxCoreProps(title, author)
	if err := addZipFile(zw, "docProps/core.xml", coreXML); err != nil {
		return nil, err
	}

	if err := zw.Close(); err != nil {
		return nil, fmt.Errorf("close zip: %w", err)
	}

	return buf.Bytes(), nil
}

func addZipFile(zw *zip.Writer, name, content string) error {
	w, err := zw.Create(name)
	if err != nil {
		return fmt.Errorf("create %s: %w", name, err)
	}
	_, err = w.Write([]byte(content))
	return err
}

// markdownToDocxBody parses simple Markdown into DOCX XML paragraphs.
// Supports: headings (#-######), bullet lists (- or *), code blocks (```),
// tables (| header |), and plain paragraphs.
func markdownToDocxBody(md, title, author string) string {
	var body strings.Builder

	body.WriteString(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas"
            xmlns:mo="http://schemas.microsoft.com/office/mac/office/2008/main"
            xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
            xmlns:mv="urn:schemas-microsoft-com:mac:vml"
            xmlns:o="urn:schemas-microsoft-com:office:office"
            xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
            xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"
            xmlns:v="urn:schemas-microsoft-com:vml"
            xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
            xmlns:w10="urn:schemas-microsoft-com:office:word"
            xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
            xmlns:wne="http://schemas.microsoft.com/office/word/2006/wordml">
<w:body>`)

	// Title page if title is provided.
	if title != "" {
		body.WriteString(docxParagraph("Title", title))
		if author != "" {
			body.WriteString(docxParagraph("Subtitle", author))
		}
		dateStr := time.Now().UTC().Format("January 2, 2006")
		body.WriteString(docxParagraph("Subtitle", dateStr))
		// Page break after title page.
		body.WriteString(`<w:p><w:r><w:br w:type="page"/></w:r></w:p>`)
	}

	lines := strings.Split(md, "\n")
	inCodeBlock := false
	var codeLines []string
	inTable := false
	var tableRows []string

	for _, line := range lines {
		trimmed := strings.TrimSpace(line)

		// Code block toggle.
		if strings.HasPrefix(trimmed, "```") {
			if inCodeBlock {
				// End code block: emit collected lines.
				body.WriteString(docxCodeBlock(codeLines))
				codeLines = nil
				inCodeBlock = false
			} else {
				inCodeBlock = true
			}
			continue
		}
		if inCodeBlock {
			codeLines = append(codeLines, line)
			continue
		}

		// Table detection.
		if strings.HasPrefix(trimmed, "|") && strings.HasSuffix(trimmed, "|") {
			// Skip separator rows like |---|---|
			if isTableSeparator(trimmed) {
				continue
			}
			if !inTable {
				inTable = true
				tableRows = nil
			}
			tableRows = append(tableRows, trimmed)
			continue
		}
		if inTable {
			// End of table — emit it.
			body.WriteString(docxTable(tableRows))
			tableRows = nil
			inTable = false
		}

		// Headings.
		if strings.HasPrefix(trimmed, "#") {
			level, text := parseHeading(trimmed)
			style := fmt.Sprintf("Heading%d", level)
			if level > 6 {
				style = "Heading6"
			}
			body.WriteString(docxParagraph(style, text))
			continue
		}

		// Bullet lists.
		if strings.HasPrefix(trimmed, "- ") || strings.HasPrefix(trimmed, "* ") {
			text := trimmed[2:]
			body.WriteString(docxListItem(text))
			continue
		}

		// Numbered lists.
		if len(trimmed) > 2 && trimmed[0] >= '0' && trimmed[0] <= '9' {
			dotIdx := strings.Index(trimmed, ". ")
			if dotIdx > 0 && dotIdx <= 3 {
				text := trimmed[dotIdx+2:]
				body.WriteString(docxListItem(text))
				continue
			}
		}

		// Empty line.
		if trimmed == "" {
			continue
		}

		// Regular paragraph.
		body.WriteString(docxParagraph("Normal", trimmed))
	}

	// Flush remaining table.
	if inTable && len(tableRows) > 0 {
		body.WriteString(docxTable(tableRows))
	}

	body.WriteString(`<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr>`)
	body.WriteString(`</w:body></w:document>`)

	return body.String()
}

func parseHeading(line string) (int, string) {
	level := 0
	for _, ch := range line {
		if ch == '#' {
			level++
		} else {
			break
		}
	}
	text := strings.TrimSpace(line[level:])
	return level, text
}

func docxParagraph(style, text string) string {
	escaped := html.EscapeString(text)
	return fmt.Sprintf(`<w:p><w:pPr><w:pStyle w:val="%s"/></w:pPr><w:r><w:t xml:space="preserve">%s</w:t></w:r></w:p>`, style, escaped)
}

func docxListItem(text string) string {
	escaped := html.EscapeString(text)
	return fmt.Sprintf(`<w:p><w:pPr><w:pStyle w:val="ListParagraph"/><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr><w:r><w:t xml:space="preserve">%s</w:t></w:r></w:p>`, escaped)
}

func docxCodeBlock(lines []string) string {
	var sb strings.Builder
	for _, line := range lines {
		escaped := html.EscapeString(line)
		sb.WriteString(fmt.Sprintf(`<w:p><w:pPr><w:pStyle w:val="CodeBlock"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Courier New" w:hAnsi="Courier New"/><w:sz w:val="20"/></w:rPr><w:t xml:space="preserve">%s</w:t></w:r></w:p>`, escaped))
	}
	return sb.String()
}

func isTableSeparator(line string) bool {
	cleaned := strings.ReplaceAll(line, "|", "")
	cleaned = strings.ReplaceAll(cleaned, "-", "")
	cleaned = strings.ReplaceAll(cleaned, ":", "")
	cleaned = strings.TrimSpace(cleaned)
	return cleaned == ""
}

func docxTable(rows []string) string {
	if len(rows) == 0 {
		return ""
	}

	var sb strings.Builder
	sb.WriteString(`<w:tbl><w:tblPr><w:tblStyle w:val="TableGrid"/><w:tblW w:w="0" w:type="auto"/><w:tblBorders>`)
	sb.WriteString(`<w:top w:val="single" w:sz="4" w:space="0" w:color="auto"/>`)
	sb.WriteString(`<w:left w:val="single" w:sz="4" w:space="0" w:color="auto"/>`)
	sb.WriteString(`<w:bottom w:val="single" w:sz="4" w:space="0" w:color="auto"/>`)
	sb.WriteString(`<w:right w:val="single" w:sz="4" w:space="0" w:color="auto"/>`)
	sb.WriteString(`<w:insideH w:val="single" w:sz="4" w:space="0" w:color="auto"/>`)
	sb.WriteString(`<w:insideV w:val="single" w:sz="4" w:space="0" w:color="auto"/>`)
	sb.WriteString(`</w:tblBorders></w:tblPr>`)

	for i, row := range rows {
		cells := parseTableRow(row)
		sb.WriteString(`<w:tr>`)
		for _, cell := range cells {
			escaped := html.EscapeString(strings.TrimSpace(cell))
			sb.WriteString(`<w:tc>`)
			if i == 0 {
				// Bold header cells.
				sb.WriteString(fmt.Sprintf(`<w:p><w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">%s</w:t></w:r></w:p>`, escaped))
			} else {
				sb.WriteString(fmt.Sprintf(`<w:p><w:r><w:t xml:space="preserve">%s</w:t></w:r></w:p>`, escaped))
			}
			sb.WriteString(`</w:tc>`)
		}
		sb.WriteString(`</w:tr>`)
	}

	sb.WriteString(`</w:tbl>`)
	return sb.String()
}

func parseTableRow(row string) []string {
	// Trim leading/trailing pipes then split by |.
	row = strings.TrimSpace(row)
	if strings.HasPrefix(row, "|") {
		row = row[1:]
	}
	if strings.HasSuffix(row, "|") {
		row = row[:len(row)-1]
	}
	return strings.Split(row, "|")
}

func buildDocxCoreProps(title, author string) string {
	now := time.Now().UTC().Format(time.RFC3339)
	t := html.EscapeString(title)
	a := html.EscapeString(author)
	if t == "" {
		t = "Untitled"
	}
	if a == "" {
		a = "Orchestra MCP"
	}
	return fmt.Sprintf(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties"
                   xmlns:dc="http://purl.org/dc/elements/1.1/"
                   xmlns:dcterms="http://purl.org/dc/terms/"
                   xmlns:dcmitype="http://purl.org/dc/dcmitype/"
                   xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>%s</dc:title>
  <dc:creator>%s</dc:creator>
  <dcterms:created xsi:type="dcterms:W3CDTF">%s</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">%s</dcterms:modified>
</cp:coreProperties>`, t, a, now, now)
}

// ---------------------------------------------------------------------------
// DOCX static XML parts
// ---------------------------------------------------------------------------

const docxContentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
</Types>`

const docxRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
</Relationships>`

const docxDocumentRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`

const docxStyles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal">
    <w:name w:val="Normal"/>
    <w:rPr><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Title">
    <w:name w:val="Title"/>
    <w:pPr><w:jc w:val="center"/><w:spacing w:before="4800" w:after="200"/></w:pPr>
    <w:rPr><w:b/><w:sz w:val="56"/><w:szCs w:val="56"/><w:color w:val="1F3864"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Subtitle">
    <w:name w:val="Subtitle"/>
    <w:pPr><w:jc w:val="center"/><w:spacing w:after="200"/></w:pPr>
    <w:rPr><w:sz w:val="28"/><w:szCs w:val="28"/><w:color w:val="404040"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading1">
    <w:name w:val="heading 1"/>
    <w:pPr><w:spacing w:before="360" w:after="120"/></w:pPr>
    <w:rPr><w:b/><w:sz w:val="40"/><w:szCs w:val="40"/><w:color w:val="1F3864"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading2">
    <w:name w:val="heading 2"/>
    <w:pPr><w:spacing w:before="280" w:after="100"/></w:pPr>
    <w:rPr><w:b/><w:sz w:val="32"/><w:szCs w:val="32"/><w:color w:val="2E5A88"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading3">
    <w:name w:val="heading 3"/>
    <w:pPr><w:spacing w:before="240" w:after="80"/></w:pPr>
    <w:rPr><w:b/><w:sz w:val="28"/><w:szCs w:val="28"/><w:color w:val="2E5A88"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading4">
    <w:name w:val="heading 4"/>
    <w:pPr><w:spacing w:before="200" w:after="60"/></w:pPr>
    <w:rPr><w:b/><w:sz w:val="26"/><w:szCs w:val="26"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading5">
    <w:name w:val="heading 5"/>
    <w:pPr><w:spacing w:before="160" w:after="40"/></w:pPr>
    <w:rPr><w:b/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading6">
    <w:name w:val="heading 6"/>
    <w:pPr><w:spacing w:before="120" w:after="40"/></w:pPr>
    <w:rPr><w:b/><w:i/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="ListParagraph">
    <w:name w:val="List Paragraph"/>
    <w:pPr><w:ind w:left="720"/><w:spacing w:after="60"/></w:pPr>
    <w:rPr><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="CodeBlock">
    <w:name w:val="Code Block"/>
    <w:pPr><w:shd w:val="clear" w:color="auto" w:fill="F2F2F2"/><w:spacing w:after="0" w:line="240" w:lineRule="auto"/><w:ind w:left="360"/></w:pPr>
    <w:rPr><w:rFonts w:ascii="Courier New" w:hAnsi="Courier New"/><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr>
  </w:style>
  <w:style w:type="table" w:styleId="TableGrid">
    <w:name w:val="Table Grid"/>
    <w:tblPr>
      <w:tblBorders>
        <w:top w:val="single" w:sz="4" w:space="0" w:color="auto"/>
        <w:left w:val="single" w:sz="4" w:space="0" w:color="auto"/>
        <w:bottom w:val="single" w:sz="4" w:space="0" w:color="auto"/>
        <w:right w:val="single" w:sz="4" w:space="0" w:color="auto"/>
        <w:insideH w:val="single" w:sz="4" w:space="0" w:color="auto"/>
        <w:insideV w:val="single" w:sz="4" w:space="0" w:color="auto"/>
      </w:tblBorders>
    </w:tblPr>
  </w:style>
</w:styles>`

// ===========================================================================
// PPTX Generation (raw XML-in-ZIP)
// ===========================================================================

// buildPptx creates a valid PPTX file from structured slide data.
// PPTX is an Open XML package: a ZIP containing XML parts.
func buildPptx(title string, slides []slideInput) ([]byte, error) {
	var buf bytes.Buffer
	zw := zip.NewWriter(&buf)

	// [Content_Types].xml — must list every slide.
	ct := buildPptxContentTypes(len(slides))
	if err := addZipFile(zw, "[Content_Types].xml", ct); err != nil {
		return nil, err
	}

	// _rels/.rels
	if err := addZipFile(zw, "_rels/.rels", pptxRels); err != nil {
		return nil, err
	}

	// ppt/presentation.xml
	presXML := buildPptxPresentation(len(slides))
	if err := addZipFile(zw, "ppt/presentation.xml", presXML); err != nil {
		return nil, err
	}

	// ppt/_rels/presentation.xml.rels
	presRelsXML := buildPptxPresentationRels(len(slides))
	if err := addZipFile(zw, "ppt/_rels/presentation.xml.rels", presRelsXML); err != nil {
		return nil, err
	}

	// ppt/slideLayouts/slideLayout1.xml
	if err := addZipFile(zw, "ppt/slideLayouts/slideLayout1.xml", pptxSlideLayout); err != nil {
		return nil, err
	}

	// ppt/slideLayouts/_rels/slideLayout1.xml.rels
	if err := addZipFile(zw, "ppt/slideLayouts/_rels/slideLayout1.xml.rels", pptxSlideLayoutRels); err != nil {
		return nil, err
	}

	// ppt/slideMasters/slideMaster1.xml
	if err := addZipFile(zw, "ppt/slideMasters/slideMaster1.xml", buildPptxSlideMaster(len(slides))); err != nil {
		return nil, err
	}

	// ppt/slideMasters/_rels/slideMaster1.xml.rels
	if err := addZipFile(zw, "ppt/slideMasters/_rels/slideMaster1.xml.rels", buildPptxSlideMasterRels(len(slides))); err != nil {
		return nil, err
	}

	// ppt/theme/theme1.xml
	if err := addZipFile(zw, "ppt/theme/theme1.xml", pptxTheme); err != nil {
		return nil, err
	}

	// Generate each slide.
	for i, slide := range slides {
		slideNum := i + 1

		// ppt/slides/slideN.xml
		slideXML := buildPptxSlide(slide)
		if err := addZipFile(zw, fmt.Sprintf("ppt/slides/slide%d.xml", slideNum), slideXML); err != nil {
			return nil, err
		}

		// ppt/slides/_rels/slideN.xml.rels
		slideRels := pptxSlideRels
		if err := addZipFile(zw, fmt.Sprintf("ppt/slides/_rels/slide%d.xml.rels", slideNum), slideRels); err != nil {
			return nil, err
		}
	}

	if err := zw.Close(); err != nil {
		return nil, fmt.Errorf("close zip: %w", err)
	}

	return buf.Bytes(), nil
}

func buildPptxContentTypes(slideCount int) string {
	var sb strings.Builder
	sb.WriteString(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
  <Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>
  <Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>
  <Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>`)
	for i := 1; i <= slideCount; i++ {
		sb.WriteString(fmt.Sprintf(`
  <Override PartName="/ppt/slides/slide%d.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`, i))
	}
	sb.WriteString(`
</Types>`)
	return sb.String()
}

func buildPptxPresentation(slideCount int) string {
	var sb strings.Builder
	sb.WriteString(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
                xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
                xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:sldMasterIdLst>
    <p:sldMasterId id="2147483648" r:id="rId1"/>
  </p:sldMasterIdLst>
  <p:sldIdLst>`)
	for i := 1; i <= slideCount; i++ {
		sb.WriteString(fmt.Sprintf(`
    <p:sldId id="%d" r:id="rId%d"/>`, 255+i, 1+i))
	}
	sb.WriteString(`
  </p:sldIdLst>
  <p:sldSz cx="12192000" cy="6858000"/>
  <p:notesSz cx="6858000" cy="9144000"/>
</p:presentation>`)
	return sb.String()
}

func buildPptxPresentationRels(slideCount int) string {
	var sb strings.Builder
	sb.WriteString(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>`)
	for i := 1; i <= slideCount; i++ {
		sb.WriteString(fmt.Sprintf(`
  <Relationship Id="rId%d" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide%d.xml"/>`, 1+i, i))
	}
	sb.WriteString(`
</Relationships>`)
	return sb.String()
}

func buildPptxSlideMaster(slideCount int) string {
	var sb strings.Builder
	sb.WriteString(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
             xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
             xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
      <p:grpSpPr/>
    </p:spTree>
  </p:cSld>
  <p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>
  <p:sldLayoutIdLst>
    <p:sldLayoutId id="2147483649" r:id="rId1"/>
  </p:sldLayoutIdLst>
</p:sldMaster>`)
	return sb.String()
}

func buildPptxSlideMasterRels(slideCount int) string {
	var sb strings.Builder
	sb.WriteString(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/>
</Relationships>`)
	return sb.String()
}

func buildPptxSlide(slide slideInput) string {
	var sb strings.Builder
	sb.WriteString(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
       xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
       xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
      <p:grpSpPr/>`)

	// Title shape.
	escapedTitle := html.EscapeString(slide.Title)
	sb.WriteString(fmt.Sprintf(`
      <p:sp>
        <p:nvSpPr><p:cNvPr id="2" name="Title"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr>
        <p:spPr>
          <a:xfrm><a:off x="457200" y="274638"/><a:ext cx="8229600" cy="1143000"/></a:xfrm>
        </p:spPr>
        <p:txBody>
          <a:bodyPr/>
          <a:lstStyle/>
          <a:p><a:r><a:rPr lang="en-US" sz="3600" b="1" dirty="0"/><a:t>%s</a:t></a:r></a:p>
        </p:txBody>
      </p:sp>`, escapedTitle))

	// Bullets shape.
	if len(slide.Bullets) > 0 {
		sb.WriteString(`
      <p:sp>
        <p:nvSpPr><p:cNvPr id="3" name="Content"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph idx="1"/></p:nvPr></p:nvSpPr>
        <p:spPr>
          <a:xfrm><a:off x="457200" y="1600200"/><a:ext cx="8229600" cy="4525963"/></a:xfrm>
        </p:spPr>
        <p:txBody>
          <a:bodyPr/>
          <a:lstStyle/>`)
		for _, bullet := range slide.Bullets {
			escaped := html.EscapeString(bullet)
			sb.WriteString(fmt.Sprintf(`
          <a:p><a:pPr lvl="0"><a:buChar char="%s"/></a:pPr><a:r><a:rPr lang="en-US" sz="2000" dirty="0"/><a:t>%s</a:t></a:r></a:p>`, html.EscapeString("\u2022"), escaped))
		}
		sb.WriteString(`
        </p:txBody>
      </p:sp>`)
	}

	sb.WriteString(`
    </p:spTree>
  </p:cSld>`)

	// Speaker notes.
	if slide.Notes != "" {
		escapedNotes := html.EscapeString(slide.Notes)
		sb.WriteString(fmt.Sprintf(`
  <p:notes>
    <p:cSld>
      <p:spTree>
        <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
        <p:grpSpPr/>
        <p:sp>
          <p:nvSpPr><p:cNvPr id="4" name="Notes"/><p:cNvSpPr/><p:nvPr><p:ph type="body" idx="1"/></p:nvPr></p:nvSpPr>
          <p:spPr/>
          <p:txBody>
            <a:bodyPr/>
            <a:lstStyle/>
            <a:p><a:r><a:rPr lang="en-US" dirty="0"/><a:t>%s</a:t></a:r></a:p>
          </p:txBody>
        </p:sp>
      </p:spTree>
    </p:cSld>
  </p:notes>`, escapedNotes))
	}

	sb.WriteString(`
</p:sld>`)
	return sb.String()
}

// ---------------------------------------------------------------------------
// PPTX static XML parts
// ---------------------------------------------------------------------------

const pptxRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
</Relationships>`

const pptxSlideLayout = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
             xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
             xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
             type="obj" preserve="1">
  <p:cSld name="Title and Content">
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
      <p:grpSpPr/>
    </p:spTree>
  </p:cSld>
</p:sldLayout>`

const pptxSlideLayoutRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/>
</Relationships>`

const pptxSlideRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
</Relationships>`

const pptxTheme = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Orchestra">
  <a:themeElements>
    <a:clrScheme name="Orchestra">
      <a:dk1><a:srgbClr val="000000"/></a:dk1>
      <a:lt1><a:srgbClr val="FFFFFF"/></a:lt1>
      <a:dk2><a:srgbClr val="1F3864"/></a:dk2>
      <a:lt2><a:srgbClr val="E7E6E6"/></a:lt2>
      <a:accent1><a:srgbClr val="4472C4"/></a:accent1>
      <a:accent2><a:srgbClr val="ED7D31"/></a:accent2>
      <a:accent3><a:srgbClr val="A5A5A5"/></a:accent3>
      <a:accent4><a:srgbClr val="FFC000"/></a:accent4>
      <a:accent5><a:srgbClr val="5B9BD5"/></a:accent5>
      <a:accent6><a:srgbClr val="70AD47"/></a:accent6>
      <a:hlink><a:srgbClr val="0563C1"/></a:hlink>
      <a:folHlink><a:srgbClr val="954F72"/></a:folHlink>
    </a:clrScheme>
    <a:fontScheme name="Orchestra">
      <a:majorFont><a:latin typeface="Calibri Light"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont>
      <a:minorFont><a:latin typeface="Calibri"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont>
    </a:fontScheme>
    <a:fmtScheme name="Orchestra">
      <a:fillStyleLst>
        <a:solidFill><a:schemeClr val="phClr"/></a:solidFill>
        <a:solidFill><a:schemeClr val="phClr"/></a:solidFill>
        <a:solidFill><a:schemeClr val="phClr"/></a:solidFill>
      </a:fillStyleLst>
      <a:lnStyleLst>
        <a:ln w="6350"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln>
        <a:ln w="6350"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln>
        <a:ln w="6350"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln>
      </a:lnStyleLst>
      <a:effectStyleLst>
        <a:effectStyle><a:effectLst/></a:effectStyle>
        <a:effectStyle><a:effectLst/></a:effectStyle>
        <a:effectStyle><a:effectLst/></a:effectStyle>
      </a:effectStyleLst>
      <a:bgFillStyleLst>
        <a:solidFill><a:schemeClr val="phClr"/></a:solidFill>
        <a:solidFill><a:schemeClr val="phClr"/></a:solidFill>
        <a:solidFill><a:schemeClr val="phClr"/></a:solidFill>
      </a:bgFillStyleLst>
    </a:fmtScheme>
  </a:themeElements>
</a:theme>`
