import { useState, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";

// ---------------------------------------------------------------------------
// Simple Markdown-to-HTML parser (no external deps)
// ---------------------------------------------------------------------------

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function parseInline(text: string): string {
  let out = escapeHtml(text);
  // Bold **text** or __text__
  out = out.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/__(.+?)__/g, "<strong>$1</strong>");
  // Italic *text* or _text_ (but not inside **)
  out = out.replace(/\*(.+?)\*/g, "<em>$1</em>");
  out = out.replace(/(?<![\\w])_(.+?)_(?![\\w])/g, "<em>$1</em>");
  // Inline code `text`
  out = out.replace(/`([^`]+)`/g, '<code class="md-inline-code">$1</code>');
  // Links [text](url)
  out = out.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" class="md-link" target="_blank" rel="noopener">$1</a>'
  );
  return out;
}

function parseMarkdown(md: string): string {
  const lines = md.split("\n");
  const htmlParts: string[] = [];
  let inCodeBlock = false;
  let codeLang = "";
  let codeLines: string[] = [];
  let inTable = false;
  let tableRows: string[][] = [];
  let tableAligns: string[] = [];

  function flushTable() {
    if (!inTable || tableRows.length === 0) return;
    let html = '<table class="md-table"><thead><tr>';
    const header = tableRows[0];
    for (let i = 0; i < header.length; i++) {
      const align = tableAligns[i] || "left";
      html += `<th style="text-align:${align}">${parseInline(header[i])}</th>`;
    }
    html += "</tr></thead><tbody>";
    for (let r = 1; r < tableRows.length; r++) {
      html += "<tr>";
      for (let c = 0; c < tableRows[r].length; c++) {
        const align = tableAligns[c] || "left";
        html += `<td style="text-align:${align}">${parseInline(tableRows[r][c])}</td>`;
      }
      html += "</tr>";
    }
    html += "</tbody></table>";
    htmlParts.push(html);
    inTable = false;
    tableRows = [];
    tableAligns = [];
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Code block toggle
    if (line.trimStart().startsWith("```")) {
      if (!inCodeBlock) {
        flushTable();
        inCodeBlock = true;
        codeLang = line.trimStart().slice(3).trim();
        codeLines = [];
      } else {
        htmlParts.push(
          `<pre class="md-code-block"${codeLang ? ` data-lang="${escapeHtml(codeLang)}"` : ""}><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`
        );
        inCodeBlock = false;
        codeLang = "";
        codeLines = [];
      }
      continue;
    }

    if (inCodeBlock) {
      codeLines.push(line);
      continue;
    }

    // Blank line — flush table
    if (line.trim() === "") {
      flushTable();
      htmlParts.push("");
      continue;
    }

    // Table row detection: starts and ends with |
    const trimmed = line.trim();
    if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
      const cells = trimmed
        .slice(1, -1)
        .split("|")
        .map((c) => c.trim());

      // Check if this is a separator row like |---|:---:|
      const isSeparator = cells.every((c) => /^:?-+:?$/.test(c));

      if (isSeparator) {
        // Parse alignment
        tableAligns = cells.map((c) => {
          if (c.startsWith(":") && c.endsWith(":")) return "center";
          if (c.endsWith(":")) return "right";
          return "left";
        });
        continue;
      }

      if (!inTable) {
        flushTable();
        inTable = true;
      }
      tableRows.push(cells);
      continue;
    }

    // If we were in a table but this line isn't a table row, flush
    flushTable();

    // Horizontal rule
    if (/^(-{3,}|_{3,}|\*{3,})$/.test(trimmed)) {
      htmlParts.push('<hr class="md-hr" />');
      continue;
    }

    // Headings
    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      htmlParts.push(
        `<h${level} class="md-h${level}">${parseInline(headingMatch[2])}</h${level}>`
      );
      continue;
    }

    // Blockquote
    if (trimmed.startsWith("> ")) {
      htmlParts.push(
        `<blockquote class="md-blockquote">${parseInline(trimmed.slice(2))}</blockquote>`
      );
      continue;
    }

    // Unordered list
    if (/^[\s]*[-*+]\s+/.test(line)) {
      const text = line.replace(/^[\s]*[-*+]\s+/, "");
      htmlParts.push(
        `<ul class="md-ul"><li>${parseInline(text)}</li></ul>`
      );
      continue;
    }

    // Ordered list
    if (/^[\s]*\d+\.\s+/.test(line)) {
      const text = line.replace(/^[\s]*\d+\.\s+/, "");
      htmlParts.push(
        `<ol class="md-ol"><li>${parseInline(text)}</li></ol>`
      );
      continue;
    }

    // Normal paragraph
    htmlParts.push(`<p class="md-p">${parseInline(trimmed)}</p>`);
  }

  // Flush any remaining code block or table
  if (inCodeBlock) {
    htmlParts.push(
      `<pre class="md-code-block"><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`
    );
  }
  flushTable();

  // Merge adjacent list items into single <ul> / <ol>
  let merged = htmlParts.join("\n");
  merged = merged.replace(/<\/ul>\n<ul class="md-ul">/g, "");
  merged = merged.replace(/<\/ol>\n<ol class="md-ol">/g, "");
  // Merge adjacent blockquotes
  merged = merged.replace(
    /<\/blockquote>\n<blockquote class="md-blockquote">/g,
    "<br/>"
  );

  return merged;
}

// ---------------------------------------------------------------------------
// Toolbar config
// ---------------------------------------------------------------------------

interface ToolbarAction {
  label: string;
  icon: string;
  prefix: string;
  suffix: string;
  block?: boolean;
}

const toolbarActions: ToolbarAction[] = [
  { label: "Bold", icon: "B", prefix: "**", suffix: "**" },
  { label: "Italic", icon: "I", prefix: "*", suffix: "*" },
  { label: "Heading", icon: "H", prefix: "## ", suffix: "", block: true },
  {
    label: "Unordered List",
    icon: "\u2022",
    prefix: "- ",
    suffix: "",
    block: true,
  },
  {
    label: "Ordered List",
    icon: "1.",
    prefix: "1. ",
    suffix: "",
    block: true,
  },
  { label: "Code", icon: "</>", prefix: "```\n", suffix: "\n```", block: true },
  { label: "Link", icon: "\uD83D\uDD17", prefix: "[", suffix: "](url)" },
  {
    label: "Table",
    icon: "\u2637",
    prefix: "| Column 1 | Column 2 | Column 3 |\n| --- | --- | --- |\n| ",
    suffix: " |  |  |",
    block: true,
  },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const DEFAULT_CONTENT = `# Welcome to Orchestra Editor

Write your **markdown** here and see the *live preview* on the right.

## Features

- Bold, italic, and inline \`code\`
- [Links](https://orchestra-mcp.com)
- Code blocks with syntax hints
- Tables, blockquotes, and more

> Orchestra Desktop: your AI-powered company OS.

---

| Feature | Status |
| --- | --- |
| Markdown editing | Done |
| Live preview | Done |
| Export PDF | Ready |

\`\`\`typescript
function greet(name: string) {
  return \`Hello, \${name}!\`;
}
\`\`\`
`;

export default function MarkdownEditor() {
  const [content, setContent] = useState(DEFAULT_CONTENT);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState<string | null>(null);

  // Word count + reading time
  const words = content
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0).length;
  const readingTime = Math.max(1, Math.ceil(words / 200));

  // ---------------------------------------------------------------------------
  // Toolbar insertion
  // ---------------------------------------------------------------------------

  const insertFormatting = useCallback(
    (action: ToolbarAction) => {
      const ta = textareaRef.current;
      if (!ta) return;

      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const selected = content.slice(start, end);
      const before = content.slice(0, start);
      const after = content.slice(end);

      let insertion: string;
      if (action.block) {
        // For block-level, put on its own line
        const needsNewline = before.length > 0 && !before.endsWith("\n");
        insertion =
          (needsNewline ? "\n" : "") +
          action.prefix +
          (selected || "text") +
          action.suffix;
      } else {
        insertion = action.prefix + (selected || "text") + action.suffix;
      }

      const newContent = before + insertion + after;
      setContent(newContent);

      // Restore cursor after state update
      requestAnimationFrame(() => {
        ta.focus();
        const cursorPos = before.length + insertion.length;
        ta.setSelectionRange(cursorPos, cursorPos);
      });
    },
    [content]
  );

  // ---------------------------------------------------------------------------
  // Keyboard shortcuts
  // ---------------------------------------------------------------------------

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;

      if (e.key === "b") {
        e.preventDefault();
        insertFormatting(toolbarActions[0]); // Bold
      } else if (e.key === "i") {
        e.preventDefault();
        insertFormatting(toolbarActions[1]); // Italic
      } else if (e.key === "k") {
        e.preventDefault();
        insertFormatting(toolbarActions[6]); // Link
      }
    },
    [insertFormatting]
  );

  // ---------------------------------------------------------------------------
  // Sync scroll between editor and preview
  // ---------------------------------------------------------------------------

  const handleEditorScroll = useCallback(() => {
    const ta = textareaRef.current;
    const pv = previewRef.current;
    if (!ta || !pv) return;
    const ratio = ta.scrollTop / (ta.scrollHeight - ta.clientHeight || 1);
    pv.scrollTop = ratio * (pv.scrollHeight - pv.clientHeight || 1);
  }, []);

  // ---------------------------------------------------------------------------
  // Export handlers
  // ---------------------------------------------------------------------------

  async function handleExport(format: "pdf" | "docx" | "pptx") {
    setExporting(format);
    try {
      await invoke("export_document", {
        content,
        format,
      });
    } catch (err) {
      console.error(`Export ${format} failed:`, err);
    } finally {
      setExporting(null);
    }
  }

  // ---------------------------------------------------------------------------
  // Tab handling in textarea
  // ---------------------------------------------------------------------------

  const handleTab = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Tab") {
        e.preventDefault();
        const ta = textareaRef.current;
        if (!ta) return;
        const start = ta.selectionStart;
        const end = ta.selectionEnd;
        const newContent =
          content.slice(0, start) + "  " + content.slice(end);
        setContent(newContent);
        requestAnimationFrame(() => {
          ta.setSelectionRange(start + 2, start + 2);
        });
      }
    },
    [content]
  );

  // ---------------------------------------------------------------------------
  // Preview HTML
  // ---------------------------------------------------------------------------

  const previewHtml = parseMarkdown(content);

  return (
    <div className="flex h-full flex-col">
      {/* Formatting toolbar */}
      <div className="flex shrink-0 items-center gap-1 border-b border-zinc-800 bg-zinc-900/80 px-3 py-2">
        {toolbarActions.map((action) => (
          <button
            key={action.label}
            onClick={() => insertFormatting(action)}
            title={
              action.label +
              (action.label === "Bold"
                ? " (Cmd+B)"
                : action.label === "Italic"
                  ? " (Cmd+I)"
                  : action.label === "Link"
                    ? " (Cmd+K)"
                    : "")
            }
            className="rounded px-2.5 py-1.5 text-xs font-medium text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
          >
            {action.icon}
          </button>
        ))}

        <div className="mx-2 h-4 w-px bg-zinc-700" />

        {/* Export buttons */}
        {(["pdf", "docx", "pptx"] as const).map((fmt) => (
          <button
            key={fmt}
            onClick={() => handleExport(fmt)}
            disabled={exporting !== null}
            className={`rounded px-2.5 py-1.5 text-xs font-medium transition-colors ${
              exporting === fmt
                ? "bg-violet-600/30 text-violet-300"
                : "text-zinc-500 hover:bg-violet-600/20 hover:text-violet-300"
            } disabled:cursor-not-allowed disabled:opacity-50`}
          >
            {exporting === fmt ? "Exporting..." : `Export ${fmt.toUpperCase()}`}
          </button>
        ))}
      </div>

      {/* Split pane: editor + preview */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: textarea editor */}
        <div className="flex flex-1 flex-col border-r border-zinc-800">
          <div className="flex shrink-0 items-center border-b border-zinc-800/50 px-3 py-1.5">
            <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
              Markdown
            </span>
          </div>
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={(e) => {
              handleKeyDown(e);
              handleTab(e);
            }}
            onScroll={handleEditorScroll}
            spellCheck={false}
            className="flex-1 resize-none bg-zinc-950 p-4 font-mono text-sm leading-relaxed text-zinc-300 placeholder:text-zinc-700 focus:outline-none"
            placeholder="Start writing markdown..."
          />
        </div>

        {/* Right: live preview */}
        <div className="flex flex-1 flex-col">
          <div className="flex shrink-0 items-center border-b border-zinc-800/50 px-3 py-1.5">
            <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
              Preview
            </span>
          </div>
          <div
            ref={previewRef}
            className="markdown-preview flex-1 overflow-auto p-4"
            dangerouslySetInnerHTML={{ __html: previewHtml }}
          />
        </div>
      </div>

      {/* Bottom bar: word count + reading time */}
      <div className="flex shrink-0 items-center justify-between border-t border-zinc-800 bg-zinc-900/80 px-4 py-1.5">
        <div className="flex items-center gap-4">
          <span className="text-[11px] text-zinc-500">
            {words} {words === 1 ? "word" : "words"}
          </span>
          <span className="text-[11px] text-zinc-500">
            ~{readingTime} min read
          </span>
        </div>
        <span className="text-[11px] text-zinc-600">Orchestra Editor</span>
      </div>
    </div>
  );
}
