import { useState, useCallback, useRef, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import {
  readTextFile,
  writeTextFile,
  writeFile,
} from "@tauri-apps/plugin-fs";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkFrontmatter from "remark-frontmatter";
import rehypeHighlight from "rehype-highlight";
import rehypeRaw from "rehype-raw";
import YAML from "yaml";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type EditorMode = "view" | "edit";

// ---------------------------------------------------------------------------
// Frontmatter parsing (browser-compatible, no Node fs dependency)
// ---------------------------------------------------------------------------

interface ParsedFrontmatter {
  data: Record<string, unknown>;
  content: string;
}

function parseFrontmatter(raw: string): ParsedFrontmatter {
  const trimmed = raw.trimStart();
  if (!trimmed.startsWith("---")) {
    return { data: {}, content: raw };
  }

  const endIndex = trimmed.indexOf("\n---", 3);
  if (endIndex === -1) {
    return { data: {}, content: raw };
  }

  const yamlStr = trimmed.slice(3, endIndex).trim();
  const body = trimmed.slice(endIndex + 4); // skip past "\n---"

  try {
    const data = YAML.parse(yamlStr) as Record<string, unknown>;
    return { data: data && typeof data === "object" ? data : {}, content: body };
  } catch {
    return { data: {}, content: raw };
  }
}

// ---------------------------------------------------------------------------
// Frontmatter component — renders YAML frontmatter as a styled header
// ---------------------------------------------------------------------------

function FrontmatterHeader({ raw }: { raw: string }) {
  try {
    const { data } = parseFrontmatter(raw);
    const entries = Object.entries(data);
    if (entries.length === 0) return null;

    return (
      <div className="mb-4 rounded-lg border border-zinc-700/60 bg-zinc-800/50 p-3">
        <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
          Frontmatter
        </div>
        <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
          {entries.map(([key, value]) => (
            <div key={key} className="contents">
              <span className="text-xs font-medium text-violet-400">
                {key}
              </span>
              <span className="truncate text-xs text-zinc-300">
                {typeof value === "object"
                  ? JSON.stringify(value)
                  : String(value)}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Code block with copy button
// ---------------------------------------------------------------------------

function CodeBlock({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLElement> & { children?: React.ReactNode }) {
  const [copied, setCopied] = useState(false);
  const codeRef = useRef<HTMLElement>(null);

  const language = className?.replace(/^language-/, "") ?? "";

  const handleCopy = useCallback(() => {
    const text = codeRef.current?.textContent ?? "";
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, []);

  return (
    <div className="group relative">
      {language && (
        <div className="absolute left-3 top-0 -translate-y-1/2 rounded bg-zinc-700 px-2 py-0.5 text-[10px] font-medium text-zinc-400">
          {language}
        </div>
      )}
      <button
        onClick={handleCopy}
        className="absolute right-2 top-2 rounded bg-zinc-700/80 px-2 py-1 text-[10px] text-zinc-400 opacity-0 transition-opacity hover:bg-zinc-600 hover:text-zinc-200 group-hover:opacity-100"
      >
        {copied ? "Copied!" : "Copy"}
      </button>
      <code ref={codeRef} className={className} {...props}>
        {children}
      </code>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Custom components for react-markdown
// ---------------------------------------------------------------------------

const markdownComponents: Record<string, React.ComponentType<any>> = {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  pre: ({ node, ...props }: any) => (
    <pre className="md-code-block" {...props} />
  ),
  code: ({ inline, className, children, ...props }: any) => {
    if (inline) {
      return (
        <code className="md-inline-code" {...props}>
          {children}
        </code>
      );
    }
    return (
      <CodeBlock className={className} {...props}>
        {children}
      </CodeBlock>
    );
  },
  table: ({ children, ...props }: any) => (
    <table className="md-table" {...props}>
      {children}
    </table>
  ),
  blockquote: ({ children, ...props }: any) => (
    <blockquote className="md-blockquote" {...props}>
      {children}
    </blockquote>
  ),
  h1: ({ children, ...props }: any) => (
    <h1 className="md-h1" {...props}>
      {children}
    </h1>
  ),
  h2: ({ children, ...props }: any) => (
    <h2 className="md-h2" {...props}>
      {children}
    </h2>
  ),
  h3: ({ children, ...props }: any) => (
    <h3 className="md-h3" {...props}>
      {children}
    </h3>
  ),
  h4: ({ children, ...props }: any) => (
    <h4 className="md-h4" {...props}>
      {children}
    </h4>
  ),
  h5: ({ children, ...props }: any) => (
    <h5 className="md-h5" {...props}>
      {children}
    </h5>
  ),
  h6: ({ children, ...props }: any) => (
    <h6 className="md-h6" {...props}>
      {children}
    </h6>
  ),
  a: ({ children, href, ...props }: any) => (
    <a
      className="md-link"
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      {...props}
    >
      {children}
    </a>
  ),
  ul: ({ children, ...props }: any) => (
    <ul className="md-ul" {...props}>
      {children}
    </ul>
  ),
  ol: ({ children, ...props }: any) => (
    <ol className="md-ol" {...props}>
      {children}
    </ol>
  ),
  hr: (props: any) => <hr className="md-hr" {...props} />,
  p: ({ children, ...props }: any) => (
    <p className="md-p" {...props}>
      {children}
    </p>
  ),
  img: ({ src, alt, ...props }: any) => (
    <img
      src={src}
      alt={alt ?? ""}
      className="md-img max-w-full rounded-lg"
      loading="lazy"
      {...props}
    />
  ),
  input: ({ type, checked, ...props }: any) => {
    if (type === "checkbox") {
      return (
        <input
          type="checkbox"
          checked={checked}
          readOnly
          className="md-checkbox mr-2 accent-violet-500"
          {...props}
        />
      );
    }
    return <input type={type} {...props} />;
  },
  // Suppress frontmatter YAML node from rendering (handled by FrontmatterHeader)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  yaml: (_props: any) => null,
};

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
  { label: "Strikethrough", icon: "S\u0336", prefix: "~~", suffix: "~~" },
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
  {
    label: "Task List",
    icon: "\u2611",
    prefix: "- [ ] ",
    suffix: "",
    block: true,
  },
  {
    label: "Code",
    icon: "</>",
    prefix: "```\n",
    suffix: "\n```",
    block: true,
  },
  { label: "Link", icon: "\uD83D\uDD17", prefix: "[", suffix: "](url)" },
  {
    label: "Table",
    icon: "\u2637",
    prefix:
      "| Column 1 | Column 2 | Column 3 |\n| --- | --- | --- |\n| ",
    suffix: " |  |  |",
    block: true,
  },
];

// ---------------------------------------------------------------------------
// Default content
// ---------------------------------------------------------------------------

const DEFAULT_CONTENT = `---
title: Welcome to Orchestra Editor
author: Orchestra Team
date: 2026-03-29
---

# Welcome to Orchestra Editor

Write your **markdown** here and see the rendered preview.

## Features

- Bold, italic, and ~~strikethrough~~
- Inline \`code\` and [links](https://orchestra-mcp.com)
- Code blocks with syntax highlighting
- Tables, blockquotes, task lists, and more

### Task List

- [x] Markdown editing
- [x] GFM rendering
- [ ] Export to PDF
- [ ] Cloud sync

> Orchestra Desktop: your AI-powered company OS.

---

| Feature | Status | Priority |
| :--- | :---: | ---: |
| Markdown editing | Done | High |
| Live preview | Done | High |
| Export PDF | Ready | Medium |

\`\`\`typescript
function greet(name: string): string {
  return \`Hello, \${name}!\`;
}

const result = greet("Orchestra");
console.log(result);
\`\`\`

\`\`\`python
def fibonacci(n: int) -> list[int]:
    """Generate fibonacci sequence."""
    seq = [0, 1]
    for _ in range(n - 2):
        seq.append(seq[-1] + seq[-2])
    return seq
\`\`\`
`;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function MarkdownEditor() {
  const [content, setContent] = useState(DEFAULT_CONTENT);
  const [mode, setMode] = useState<EditorMode>("view");
  const [filePath, setFilePath] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [exporting, setExporting] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  // Word count + reading time
  const words = content
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0).length;
  const readingTime = Math.max(1, Math.ceil(words / 200));

  // Parse frontmatter for the header display
  const hasFrontmatter = content.trimStart().startsWith("---");

  // Strip frontmatter from content for react-markdown (it handles YAML nodes via remark-frontmatter)
  const markdownBody = useMemo(() => {
    if (!hasFrontmatter) return content;
    try {
      const { content: body } = parseFrontmatter(content);
      return body;
    } catch {
      return content;
    }
  }, [content, hasFrontmatter]);

  // ---------------------------------------------------------------------------
  // Content change handler
  // ---------------------------------------------------------------------------

  const handleContentChange = useCallback((newContent: string) => {
    setContent(newContent);
    setDirty(true);
  }, []);

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
      handleContentChange(newContent);

      requestAnimationFrame(() => {
        ta.focus();
        const cursorPos = before.length + insertion.length;
        ta.setSelectionRange(cursorPos, cursorPos);
      });
    },
    [content, handleContentChange]
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
        insertFormatting(toolbarActions[8]); // Link
      } else if (e.key === "s") {
        e.preventDefault();
        handleSaveToView();
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [insertFormatting]
  );

  // ---------------------------------------------------------------------------
  // Sync scroll between editor and preview (split mode)
  // ---------------------------------------------------------------------------

  const handleEditorScroll = useCallback(() => {
    const ta = textareaRef.current;
    const pv = previewRef.current;
    if (!ta || !pv) return;
    const ratio = ta.scrollTop / (ta.scrollHeight - ta.clientHeight || 1);
    pv.scrollTop = ratio * (pv.scrollHeight - pv.clientHeight || 1);
  }, []);

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
        handleContentChange(newContent);
        requestAnimationFrame(() => {
          ta.setSelectionRange(start + 2, start + 2);
        });
      }
    },
    [content, handleContentChange]
  );

  // ---------------------------------------------------------------------------
  // Mode switching
  // ---------------------------------------------------------------------------

  const handleEdit = useCallback(() => {
    setMode("edit");
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
    });
  }, []);

  const handleSaveToView = useCallback(() => {
    setMode("view");
  }, []);

  // ---------------------------------------------------------------------------
  // Native file dialogs — Open
  // ---------------------------------------------------------------------------

  async function handleOpen() {
    try {
      const selected = await open({
        multiple: false,
        filters: [
          {
            name: "Markdown",
            extensions: ["md", "markdown", "mdx", "txt"],
          },
        ],
      });

      if (selected) {
        const text = await readTextFile(selected);
        setContent(text);
        setFilePath(selected);
        setDirty(false);
        setMode("view");
      }
    } catch (err) {
      console.error("Open file failed:", err);
    }
  }

  // ---------------------------------------------------------------------------
  // Native file dialogs — Save
  // ---------------------------------------------------------------------------

  async function handleSaveFile() {
    try {
      let path = filePath;
      if (!path) {
        const selected = await save({
          filters: [
            {
              name: "Markdown",
              extensions: ["md"],
            },
          ],
          defaultPath: "document.md",
        });
        if (!selected) return;
        path = selected;
        setFilePath(path);
      }

      await writeTextFile(path, content);
      setDirty(false);
    } catch (err) {
      console.error("Save file failed:", err);
    }
  }

  async function handleSaveAs() {
    try {
      const selected = await save({
        filters: [
          {
            name: "Markdown",
            extensions: ["md"],
          },
        ],
        defaultPath: filePath ?? "document.md",
      });
      if (!selected) return;

      await writeTextFile(selected, content);
      setFilePath(selected);
      setDirty(false);
    } catch (err) {
      console.error("Save As failed:", err);
    }
  }

  // ---------------------------------------------------------------------------
  // Export handlers with native save dialogs
  // ---------------------------------------------------------------------------

  async function handleExportHTML() {
    setExporting("html");
    try {
      const selected = await save({
        filters: [{ name: "HTML", extensions: ["html"] }],
        defaultPath: "document.html",
      });
      if (!selected) {
        setExporting(null);
        return;
      }

      // Build a self-contained HTML document
      const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Document</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 2rem auto; padding: 0 1rem; color: #1a1a1a; line-height: 1.7; }
    h1,h2,h3,h4,h5,h6 { margin-top: 1.5em; margin-bottom: 0.5em; }
    h1 { border-bottom: 1px solid #e5e5e5; padding-bottom: 0.3em; }
    h2 { border-bottom: 1px solid #e5e5e5; padding-bottom: 0.3em; }
    code { background: #f3f4f6; padding: 0.15em 0.4em; border-radius: 4px; font-size: 0.9em; }
    pre { background: #f3f4f6; padding: 1em; border-radius: 8px; overflow-x: auto; }
    pre code { background: none; padding: 0; }
    blockquote { border-left: 3px solid #7c3aed; padding: 0.5em 1em; margin: 1em 0; color: #555; background: #faf5ff; border-radius: 0 6px 6px 0; }
    table { border-collapse: collapse; width: 100%; margin: 1em 0; }
    th, td { border: 1px solid #e5e5e5; padding: 0.5em 0.75em; text-align: left; }
    th { background: #f9fafb; font-weight: 600; }
    a { color: #7c3aed; text-decoration: underline; }
    img { max-width: 100%; border-radius: 8px; }
    hr { border: none; border-top: 1px solid #e5e5e5; margin: 2em 0; }
    ul, ol { padding-left: 1.5em; }
    li { margin: 0.25em 0; }
    input[type="checkbox"] { margin-right: 0.5em; }
  </style>
</head>
<body>
${markdownBody}
</body>
</html>`;

      await writeTextFile(selected, html);
    } catch (err) {
      console.error("Export HTML failed:", err);
    } finally {
      setExporting(null);
    }
  }

  async function handleExportRust(format: "pdf" | "docx" | "pptx") {
    setExporting(format);
    try {
      const selected = await save({
        filters: [
          {
            name: format.toUpperCase(),
            extensions: [format],
          },
        ],
        defaultPath: `document.${format}`,
      });
      if (!selected) {
        setExporting(null);
        return;
      }

      // Invoke Rust backend for binary export formats
      const result = await invoke<number[]>("export_document", {
        content,
        format,
        path: selected,
      });

      // If the backend returns bytes, write them; otherwise it wrote directly
      if (result && Array.isArray(result) && result.length > 0) {
        await writeFile(selected, new Uint8Array(result));
      }
    } catch (err) {
      console.error(`Export ${format} failed:`, err);
    } finally {
      setExporting(null);
    }
  }

  // ---------------------------------------------------------------------------
  // Rendered markdown preview
  // ---------------------------------------------------------------------------

  const RenderedPreview = useMemo(() => {
    return (
      <div className="markdown-preview">
        {hasFrontmatter && <FrontmatterHeader raw={content} />}
        <ReactMarkdown
          remarkPlugins={[remarkGfm, remarkFrontmatter]}
          rehypePlugins={[rehypeHighlight, rehypeRaw]}
          components={markdownComponents}
        >
          {markdownBody}
        </ReactMarkdown>
      </div>
    );
  }, [markdownBody, hasFrontmatter, content]);

  // ---------------------------------------------------------------------------
  // Filename display
  // ---------------------------------------------------------------------------

  const fileName = filePath
    ? filePath.split("/").pop() ?? "Untitled"
    : "Untitled";

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="flex h-full flex-col">
      {/* Top toolbar */}
      <div className="flex shrink-0 items-center gap-1 border-b border-zinc-800 bg-zinc-900/80 px-3 py-2">
        {/* File actions */}
        <button
          onClick={handleOpen}
          title="Open File"
          className="rounded px-2.5 py-1.5 text-xs font-medium text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
        >
          Open
        </button>
        <button
          onClick={handleSaveFile}
          title="Save File (Cmd+S)"
          className="rounded px-2.5 py-1.5 text-xs font-medium text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
        >
          Save
        </button>
        <button
          onClick={handleSaveAs}
          title="Save As..."
          className="rounded px-2.5 py-1.5 text-xs font-medium text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
        >
          Save As
        </button>

        <div className="mx-2 h-4 w-px bg-zinc-700" />

        {/* Mode toggle */}
        {mode === "view" ? (
          <button
            onClick={handleEdit}
            title="Edit Mode"
            className="rounded bg-violet-600/20 px-2.5 py-1.5 text-xs font-medium text-violet-300 transition-colors hover:bg-violet-600/30"
          >
            Edit
          </button>
        ) : (
          <button
            onClick={handleSaveToView}
            title="View Mode (Cmd+S)"
            className="rounded bg-emerald-600/20 px-2.5 py-1.5 text-xs font-medium text-emerald-300 transition-colors hover:bg-emerald-600/30"
          >
            Done
          </button>
        )}

        {/* Formatting toolbar (only in edit mode) */}
        {mode === "edit" && (
          <>
            <div className="mx-2 h-4 w-px bg-zinc-700" />
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
                className="rounded px-2 py-1.5 text-xs font-medium text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
              >
                {action.icon}
              </button>
            ))}
          </>
        )}

        <div className="flex-1" />

        {/* Export buttons */}
        <button
          onClick={handleExportHTML}
          disabled={exporting !== null}
          className={`rounded px-2.5 py-1.5 text-xs font-medium transition-colors ${
            exporting === "html"
              ? "bg-violet-600/30 text-violet-300"
              : "text-zinc-500 hover:bg-violet-600/20 hover:text-violet-300"
          } disabled:cursor-not-allowed disabled:opacity-50`}
        >
          {exporting === "html" ? "Exporting..." : "HTML"}
        </button>
        {(["pdf", "docx"] as const).map((fmt) => (
          <button
            key={fmt}
            onClick={() => handleExportRust(fmt)}
            disabled={exporting !== null}
            className={`rounded px-2.5 py-1.5 text-xs font-medium transition-colors ${
              exporting === fmt
                ? "bg-violet-600/30 text-violet-300"
                : "text-zinc-500 hover:bg-violet-600/20 hover:text-violet-300"
            } disabled:cursor-not-allowed disabled:opacity-50`}
          >
            {exporting === fmt ? "..." : fmt.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Main content area */}
      {mode === "view" ? (
        /* ────────────── VIEW MODE: full-width rendered preview ────────────── */
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="flex shrink-0 items-center border-b border-zinc-800/50 px-3 py-1.5">
            <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
              Preview
            </span>
            <span className="ml-2 text-[11px] text-zinc-600">{fileName}</span>
            {dirty && (
              <span className="ml-1.5 text-[10px] text-amber-500">
                (unsaved)
              </span>
            )}
          </div>
          <div
            ref={previewRef}
            className="flex-1 overflow-auto p-6"
            onDoubleClick={handleEdit}
          >
            <div className="mx-auto max-w-3xl">{RenderedPreview}</div>
          </div>
        </div>
      ) : (
        /* ────────────── EDIT MODE: split pane (editor + preview) ────────────── */
        <div className="flex flex-1 overflow-hidden">
          {/* Left: textarea editor */}
          <div className="flex flex-1 flex-col border-r border-zinc-800">
            <div className="flex shrink-0 items-center border-b border-zinc-800/50 px-3 py-1.5">
              <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                Markdown
              </span>
              <span className="ml-2 text-[11px] text-zinc-600">
                {fileName}
              </span>
              {dirty && (
                <span className="ml-1.5 text-[10px] text-amber-500">
                  (unsaved)
                </span>
              )}
            </div>
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => handleContentChange(e.target.value)}
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
              className="flex-1 overflow-auto p-4"
            >
              {RenderedPreview}
            </div>
          </div>
        </div>
      )}

      {/* Bottom bar: word count + reading time */}
      <div className="flex shrink-0 items-center justify-between border-t border-zinc-800 bg-zinc-900/80 px-4 py-1.5">
        <div className="flex items-center gap-4">
          <span className="text-[11px] text-zinc-500">
            {words} {words === 1 ? "word" : "words"}
          </span>
          <span className="text-[11px] text-zinc-500">
            ~{readingTime} min read
          </span>
          {filePath && (
            <span className="max-w-xs truncate text-[11px] text-zinc-600">
              {filePath}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[11px] text-zinc-600">
            {mode === "view" ? "Viewing" : "Editing"}
          </span>
          <span className="text-[11px] text-zinc-600">Orchestra Editor</span>
        </div>
      </div>
    </div>
  );
}
