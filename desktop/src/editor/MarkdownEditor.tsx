import { invoke } from '@tauri-apps/api/core'
import { open, save } from '@tauri-apps/plugin-dialog'
import { readTextFile, writeFile, writeTextFile } from '@tauri-apps/plugin-fs'
import html2canvas from 'html2canvas'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import rehypeHighlight from 'rehype-highlight'
import rehypeRaw from 'rehype-raw'
import remarkFrontmatter from 'remark-frontmatter'
import remarkGfm from 'remark-gfm'
import YAML from 'yaml'

import ContextMenu, {
  CopyIcon,
  DownloadIcon,
  FileIcon,
  ImageIcon,
  MarkdownIcon,
  TableIcon,
  TextIcon,
} from '../components/ContextMenu'
import type { ContextMenuItem, ContextMenuPosition } from '../components/ContextMenu'
import MermaidBlock, { AsciiToMermaidModal, DiagramIcon } from '../components/MermaidBlock'
import ShareDialog from '../components/ShareDialog'
import { asciiToMermaid, looksLikeAsciiDiagram } from '../lib/ascii-to-mermaid'
import {
  copyToClipboard,
  exportAsCSV,
  exportAsFile,
  exportAsImage,
  tableToCSV,
  tableToData,
  tableToMarkdown,
  tableToPlainText,
} from '../lib/export-utils'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type EditorMode = 'view' | 'edit'

// ---------------------------------------------------------------------------
// Frontmatter parsing (browser-compatible, no Node fs dependency)
// ---------------------------------------------------------------------------

interface ParsedFrontmatter {
  data: Record<string, unknown>
  content: string
}

function parseFrontmatter(raw: string): ParsedFrontmatter {
  const trimmed = raw.trimStart()
  if (!trimmed.startsWith('---')) {
    return { data: {}, content: raw }
  }

  const endIndex = trimmed.indexOf('\n---', 3)
  if (endIndex === -1) {
    return { data: {}, content: raw }
  }

  const yamlStr = trimmed.slice(3, endIndex).trim()
  const body = trimmed.slice(endIndex + 4) // skip past "\n---"

  try {
    const data = YAML.parse(yamlStr) as Record<string, unknown>
    return { data: data && typeof data === 'object' ? data : {}, content: body }
  } catch {
    return { data: {}, content: raw }
  }
}

// ---------------------------------------------------------------------------
// Language extension map (for "Export as File")
// ---------------------------------------------------------------------------

const LANG_EXT_MAP: Record<string, string> = {
  javascript: 'js',
  typescript: 'ts',
  python: 'py',
  ruby: 'rb',
  go: 'go',
  rust: 'rs',
  java: 'java',
  kotlin: 'kt',
  swift: 'swift',
  c: 'c',
  cpp: 'cpp',
  csharp: 'cs',
  css: 'css',
  html: 'html',
  json: 'json',
  yaml: 'yaml',
  yml: 'yml',
  toml: 'toml',
  xml: 'xml',
  sql: 'sql',
  bash: 'sh',
  shell: 'sh',
  sh: 'sh',
  zsh: 'sh',
  dockerfile: 'Dockerfile',
  markdown: 'md',
  md: 'md',
  php: 'php',
  lua: 'lua',
  dart: 'dart',
  scala: 'scala',
  r: 'r',
  perl: 'pl',
  powershell: 'ps1',
  graphql: 'graphql',
  proto: 'proto',
  protobuf: 'proto',
  makefile: 'Makefile',
  cmake: 'cmake',
  nginx: 'conf',
  ini: 'ini',
  plaintext: 'txt',
  text: 'txt',
  txt: 'txt',
}

function getExtForLang(lang: string): string {
  return LANG_EXT_MAP[lang.toLowerCase()] ?? 'txt'
}

// ---------------------------------------------------------------------------
// Frontmatter component — renders YAML frontmatter as a styled header
// ---------------------------------------------------------------------------

function FrontmatterHeader({ raw }: { raw: string }) {
  try {
    const { data } = parseFrontmatter(raw)
    const entries = Object.entries(data)
    if (entries.length === 0) return null

    return (
      <div
        className="mb-4 rounded-lg p-3"
        style={{
          background: 'var(--background-surface-200)',
          border: '1px solid var(--border-default)',
        }}
      >
        <div
          className="mb-2 text-[10px] font-semibold uppercase tracking-wider"
          style={{ color: 'var(--foreground-lighter)' }}
        >
          Frontmatter
        </div>
        <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
          {entries.map(([key, value]) => (
            <div key={key} className="contents">
              <span className="text-xs font-medium" style={{ color: 'var(--brand-default)' }}>
                {key}
              </span>
              <span className="truncate text-xs" style={{ color: 'var(--foreground-light)' }}>
                {typeof value === 'object' ? JSON.stringify(value) : String(value)}
              </span>
            </div>
          ))}
        </div>
      </div>
    )
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Code block — VS Code / GitHub reference style with line numbers
// ---------------------------------------------------------------------------

function CodeBlock({
  children,
  className,
  language: langProp,
  onContextMenu,
  ...props
}: React.HTMLAttributes<HTMLElement> & {
  children?: React.ReactNode
  language?: string
  onContextMenu?: (e: React.MouseEvent, codeEl: HTMLElement, lang: string) => void
}) {
  const [copied, setCopied] = useState(false)
  const codeRef = useRef<HTMLElement>(null)

  // Use explicit language prop if provided, otherwise extract from className
  const language = langProp ?? /language-(\w+)/.exec(className || '')?.[1] ?? ''
  // Clean display label: uppercase, fallback to "CODE"
  const displayLang = language ? language.toUpperCase() : 'CODE'

  const handleCopy = useCallback(() => {
    const text = codeRef.current?.textContent ?? ''
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }, [])

  // Compute line count from rendered DOM text
  const [lineCount, setLineCount] = useState(1)
  useMemo(() => {
    requestAnimationFrame(() => {
      if (codeRef.current) {
        const text = codeRef.current.textContent ?? ''
        const lines = text.split('\n')
        const count =
          lines.length > 0 && lines[lines.length - 1] === '' ? lines.length - 1 : lines.length
        setLineCount(Math.max(1, count))
      }
    })
  }, [children])

  const handleRightClick = useCallback(
    (e: React.MouseEvent) => {
      if (onContextMenu && codeRef.current) {
        onContextMenu(e, codeRef.current, language)
      }
    },
    [onContextMenu, language]
  )

  return (
    <div className="code-block-wrapper group" onContextMenu={handleRightClick}>
      {/* Header bar with macOS traffic light dots, language label, and copy button */}
      <div className="code-block-header">
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <span
            style={{
              width: 12,
              height: 12,
              borderRadius: '50%',
              background: '#ff5f57',
              flexShrink: 0,
            }}
          />
          <span
            style={{
              width: 12,
              height: 12,
              borderRadius: '50%',
              background: '#febc2e',
              flexShrink: 0,
            }}
          />
          <span
            style={{
              width: 12,
              height: 12,
              borderRadius: '50%',
              background: '#28c840',
              flexShrink: 0,
            }}
          />
          <span className="code-block-lang" style={{ marginLeft: 8 }}>
            {displayLang}
          </span>
        </div>
        <div className="flex-1" />
        <button
          onClick={handleCopy}
          className="code-block-copy-btn opacity-0 transition-opacity group-hover:opacity-100"
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      {/* Code area with line numbers */}
      <div className="code-block-body">
        <div className="code-block-line-numbers" aria-hidden="true">
          {Array.from({ length: lineCount }, (_, i) => (
            <span key={i}>{i + 1}</span>
          ))}
        </div>
        <code ref={codeRef} className={className} {...props}>
          {children}
        </code>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// DataTable — sortable, themed, with row count header
// ---------------------------------------------------------------------------

interface DataTableProps {
  children: React.ReactNode
  onContextMenu?: (e: React.MouseEvent, tableEl: HTMLTableElement) => void
}

/** Recursively extract plain text from React children. */
function extractText(children: React.ReactNode): string {
  if (typeof children === 'string') return children
  if (typeof children === 'number') return String(children)
  if (!children) return ''
  if (Array.isArray(children)) return children.map(extractText).join('')
  if (typeof children === 'object' && 'props' in children) {
    return extractText((children as React.ReactElement<any>).props.children)
  }
  return ''
}

function DataTable({ children, onContextMenu }: DataTableProps) {
  const tableRef = useRef<HTMLTableElement>(null)
  const [sortCol, setSortCol] = useState<number | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  // Extract header and body rows from react-markdown children
  const { headers, bodyRows } = useMemo(() => {
    const headers: string[] = []
    const bodyRows: { cells: string[]; node: React.ReactNode }[] = []

    const childArr = Array.isArray(children) ? children : [children]
    for (const child of childArr) {
      if (!child || typeof child !== 'object' || !('type' in (child as any))) continue
      const el = child as React.ReactElement<any>

      // thead
      if (el.type === 'thead') {
        const trArr = Array.isArray(el.props.children) ? el.props.children : [el.props.children]
        for (const tr of trArr) {
          if (!tr || typeof tr !== 'object') continue
          const trEl = tr as React.ReactElement<any>
          const thArr = Array.isArray(trEl.props?.children)
            ? trEl.props.children
            : [trEl.props?.children]
          for (const th of thArr) {
            if (!th || typeof th !== 'object') continue
            const thEl = th as React.ReactElement<any>
            headers.push(extractText(thEl.props?.children ?? ''))
          }
        }
      }

      // tbody
      if (el.type === 'tbody') {
        const trArr = Array.isArray(el.props.children) ? el.props.children : [el.props.children]
        for (const tr of trArr) {
          if (!tr || typeof tr !== 'object') continue
          const trEl = tr as React.ReactElement<any>
          const cells: string[] = []
          const tdArr = Array.isArray(trEl.props?.children)
            ? trEl.props.children
            : [trEl.props?.children]
          for (const td of tdArr) {
            if (!td || typeof td !== 'object') continue
            const tdEl = td as React.ReactElement<any>
            cells.push(extractText(tdEl.props?.children ?? ''))
          }
          bodyRows.push({ cells, node: tr })
        }
      }
    }

    return { headers, bodyRows }
  }, [children])

  // Sort body rows
  const sortedBodyRows = useMemo(() => {
    if (sortCol === null) return bodyRows
    const sorted = [...bodyRows].sort((a, b) => {
      const av = a.cells[sortCol] ?? ''
      const bv = b.cells[sortCol] ?? ''
      const an = parseFloat(av)
      const bn = parseFloat(bv)
      if (!isNaN(an) && !isNaN(bn)) {
        return sortDir === 'asc' ? an - bn : bn - an
      }
      return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
    })
    return sorted
  }, [bodyRows, sortCol, sortDir])

  const handleHeaderClick = useCallback(
    (colIndex: number) => {
      if (sortCol === colIndex) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
      } else {
        setSortCol(colIndex)
        setSortDir('asc')
      }
    },
    [sortCol]
  )

  const rowCount = bodyRows.length

  const handleRightClick = useCallback(
    (e: React.MouseEvent) => {
      if (onContextMenu && tableRef.current) {
        onContextMenu(e, tableRef.current)
      }
    },
    [onContextMenu]
  )

  return (
    <div className="data-table-wrapper" onContextMenu={handleRightClick}>
      {/* Header bar with row count */}
      <div className="data-table-header-bar">
        <span className="data-table-icon">
          <TableIcon />
        </span>
        <span className="data-table-title">
          Table &mdash; {rowCount} {rowCount === 1 ? 'row' : 'rows'}
        </span>
      </div>
      {/* Scrollable table area */}
      <div className="data-table-scroll">
        <table ref={tableRef} className="data-table">
          <thead>
            <tr>
              {headers.map((h, i) => (
                <th
                  key={i}
                  onClick={() => handleHeaderClick(i)}
                  className="data-table-th"
                  title={`Sort by ${h}`}
                >
                  <span className="data-table-th-content">
                    {h}
                    {sortCol === i && (
                      <span className="data-table-sort-arrow">
                        {sortDir === 'asc' ? '\u2191' : '\u2193'}
                      </span>
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedBodyRows.map((row, ri) => (
              <tr key={ri} className={ri % 2 === 1 ? 'data-table-row-alt' : ''}>
                {row.node && typeof row.node === 'object' && 'props' in (row.node as any)
                  ? (row.node as React.ReactElement<any>).props.children
                  : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Toolbar config
// ---------------------------------------------------------------------------

interface ToolbarAction {
  label: string
  icon: string
  prefix: string
  suffix: string
  block?: boolean
}

const toolbarActions: ToolbarAction[] = [
  { label: 'Bold', icon: 'B', prefix: '**', suffix: '**' },
  { label: 'Italic', icon: 'I', prefix: '*', suffix: '*' },
  { label: 'Strikethrough', icon: 'S\u0336', prefix: '~~', suffix: '~~' },
  { label: 'Heading', icon: 'H', prefix: '## ', suffix: '', block: true },
  {
    label: 'Unordered List',
    icon: '\u2022',
    prefix: '- ',
    suffix: '',
    block: true,
  },
  {
    label: 'Ordered List',
    icon: '1.',
    prefix: '1. ',
    suffix: '',
    block: true,
  },
  {
    label: 'Task List',
    icon: '\u2611',
    prefix: '- [ ] ',
    suffix: '',
    block: true,
  },
  {
    label: 'Code',
    icon: '</>',
    prefix: '```\n',
    suffix: '\n```',
    block: true,
  },
  { label: 'Link', icon: '\uD83D\uDD17', prefix: '[', suffix: '](url)' },
  {
    label: 'Table',
    icon: '\u2637',
    prefix: '| Column 1 | Column 2 | Column 3 |\n| --- | --- | --- |\n| ',
    suffix: ' |  |  |',
    block: true,
  },
  {
    label: 'Mermaid',
    icon: '\u25C8',
    prefix: '```mermaid\ngraph TD\n    A[Start] --> B[End]\n',
    suffix: '```',
    block: true,
  },
]

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

### Mermaid Diagram

\`\`\`mermaid
graph TD
    A[User Request] --> B{Auth Check}
    B -->|Authenticated| C[MCP Server]
    B -->|Denied| D[Login Page]
    C --> E[Tool Execution]
    C --> F[Memory Store]
    E --> G[Response]
    F --> G
\`\`\`
`

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface MarkdownEditorProps {
  initialFilePath?: string | null
}

export default function MarkdownEditor({ initialFilePath }: MarkdownEditorProps = {}) {
  const [content, setContent] = useState(DEFAULT_CONTENT)
  const [mode, setMode] = useState<EditorMode>('view')
  const [filePath, setFilePath] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)
  const [exporting, setExporting] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // ASCII-to-Mermaid conversion modal state
  const [conversionModal, setConversionModal] = useState<{
    mermaidCode: string
    originalAscii: string
  } | null>(null)
  const previewRef = useRef<HTMLDivElement>(null)

  // Context menu state
  const [ctxMenuPos, setCtxMenuPos] = useState<ContextMenuPosition | null>(null)
  const [ctxMenuItems, setCtxMenuItems] = useState<ContextMenuItem[]>([])

  // Share dialog state
  const [shareDialogOpen, setShareDialogOpen] = useState(false)

  const closeContextMenu = useCallback(() => {
    setCtxMenuPos(null)
    setCtxMenuItems([])
  }, [])

  // ---------------------------------------------------------------------------
  // Load file from workspace when initialFilePath changes
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (initialFilePath && initialFilePath !== filePath) {
      readTextFile(initialFilePath)
        .then((text) => {
          setContent(text)
          setFilePath(initialFilePath)
          setDirty(false)
          setMode('view')
        })
        .catch((err) => {
          console.error('Failed to open file from workspace:', err)
        })
    }
  }, [initialFilePath])

  // ---------------------------------------------------------------------------
  // Listen for command palette events (open-file, new-document, export-current)
  // Uses a ref to always call the latest handler, avoiding stale closures.
  // ---------------------------------------------------------------------------

  const editorActionsRef = useRef<Record<string, () => void>>({})

  // This ref is updated every render so it always has fresh closures.
  // The actual assignment of handleOpen / handleExportHTML happens below
  // after those functions are declared (function hoisting makes this safe
  // within the same render, but we also explicitly reassign in an effect).

  useEffect(() => {
    function handleEditorAction(e: Event) {
      const detail = (e as CustomEvent).detail
      if (!detail?.action) return

      const handler = editorActionsRef.current[detail.action]
      if (handler) handler()
    }

    window.addEventListener('orchestra-editor-action', handleEditorAction)
    return () => window.removeEventListener('orchestra-editor-action', handleEditorAction)
  }, [])

  // Word count + reading time
  const words = content
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0).length
  const readingTime = Math.max(1, Math.ceil(words / 200))

  // Parse frontmatter for the header display
  const hasFrontmatter = content.trimStart().startsWith('---')

  // Strip frontmatter from content for react-markdown
  const markdownBody = useMemo(() => {
    if (!hasFrontmatter) return content
    try {
      const { content: body } = parseFrontmatter(content)
      return body
    } catch {
      return content
    }
  }, [content, hasFrontmatter])

  // ---------------------------------------------------------------------------
  // Context menu handlers
  // ---------------------------------------------------------------------------

  const handleCodeContextMenu = useCallback(
    (e: React.MouseEvent, codeEl: HTMLElement, lang: string) => {
      e.preventDefault()
      e.stopPropagation()
      const rawCode = codeEl.textContent ?? ''
      const ext = getExtForLang(lang || 'txt')
      const fenceBlock = '```' + lang + '\n' + rawCode.trimEnd() + '\n```'

      const items: ContextMenuItem[] = [
        {
          id: 'copy-code',
          label: 'Copy Code',
          icon: <CopyIcon />,
          onClick: () => copyToClipboard(rawCode),
        },
        {
          id: 'copy-plain',
          label: 'Copy as Plain Text',
          icon: <TextIcon />,
          onClick: () => copyToClipboard(rawCode),
        },
        {
          id: 'export-image',
          label: 'Export as Image',
          icon: <ImageIcon />,
          separator: true,
          onClick: () => {
            const wrapper = codeEl.closest('.code-block-wrapper') as HTMLElement
            if (wrapper) {
              exportAsImage(wrapper, 'code-block.png')
            }
          },
        },
        {
          id: 'export-file',
          label: `Export as File (.${ext})`,
          icon: <FileIcon />,
          onClick: () => exportAsFile(rawCode, 'code-block', ext),
        },
        {
          id: 'copy-markdown',
          label: 'Copy as Markdown',
          icon: <MarkdownIcon />,
          separator: true,
          onClick: () => copyToClipboard(fenceBlock),
        },
      ]

      setCtxMenuItems(items)
      setCtxMenuPos({ x: e.clientX, y: e.clientY })
    },
    []
  )

  const handleTableContextMenu = useCallback((e: React.MouseEvent, tableEl: HTMLTableElement) => {
    e.preventDefault()
    e.stopPropagation()

    const items: ContextMenuItem[] = [
      {
        id: 'copy-table',
        label: 'Copy Table',
        icon: <CopyIcon />,
        onClick: () => copyToClipboard(tableToPlainText(tableEl)),
      },
      {
        id: 'copy-plain',
        label: 'Copy as Plain Text',
        icon: <TextIcon />,
        onClick: () => copyToClipboard(tableToPlainText(tableEl)),
      },
      {
        id: 'export-csv',
        label: 'Export as CSV',
        icon: <DownloadIcon />,
        separator: true,
        onClick: () => exportAsCSV(tableToData(tableEl), 'table'),
      },
      {
        id: 'export-excel',
        label: 'Export as Excel',
        icon: <DownloadIcon />,
        onClick: () => {
          const csv = tableToCSV(tableEl)
          exportAsFile(csv, 'table', 'xlsx')
        },
      },
      {
        id: 'export-image',
        label: 'Export as Image',
        icon: <ImageIcon />,
        onClick: () => {
          const wrapper = tableEl.closest('.data-table-wrapper') as HTMLElement
          if (wrapper) {
            exportAsImage(wrapper, 'table.png')
          }
        },
      },
      {
        id: 'copy-markdown',
        label: 'Export as Markdown',
        icon: <MarkdownIcon />,
        separator: true,
        onClick: () => copyToClipboard(tableToMarkdown(tableEl)),
      },
    ]

    setCtxMenuItems(items)
    setCtxMenuPos({ x: e.clientX, y: e.clientY })
  }, [])

  // ---------------------------------------------------------------------------
  // Mermaid diagram context menu
  // ---------------------------------------------------------------------------

  const handleMermaidContextMenu = useCallback(
    (e: React.MouseEvent, svgHtml: string, mermaidCode: string) => {
      e.preventDefault()
      e.stopPropagation()

      const items: ContextMenuItem[] = [
        {
          id: 'copy-svg',
          label: 'Copy as SVG',
          icon: <CopyIcon />,
          onClick: () => copyToClipboard(svgHtml),
        },
        {
          id: 'copy-source',
          label: 'Copy Mermaid Source',
          icon: <TextIcon />,
          onClick: () => copyToClipboard(mermaidCode),
        },
        {
          id: 'copy-image',
          label: 'Copy as Image',
          icon: <ImageIcon />,
          separator: true,
          onClick: async () => {
            try {
              // Find the mermaid wrapper element near the click
              const target = e.target as HTMLElement
              const wrapper = target.closest('.mermaid-block-wrapper') as HTMLElement
              if (!wrapper) return
              const svgEl = wrapper.querySelector('.mermaid-block-svg') as HTMLElement
              if (!svgEl) return
              const canvas = await html2canvas(svgEl, {
                backgroundColor: '#171717',
                scale: 2,
                useCORS: true,
                logging: false,
              })
              canvas.toBlob(async (blob) => {
                if (!blob) return
                await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
              }, 'image/png')
            } catch (err) {
              console.error('Copy as image failed:', err)
            }
          },
        },
        {
          id: 'export-png',
          label: 'Export as PNG',
          icon: <DownloadIcon />,
          separator: true,
          onClick: async () => {
            try {
              const target = e.target as HTMLElement
              const wrapper = target.closest('.mermaid-block-wrapper') as HTMLElement
              if (!wrapper) return
              const svgEl = wrapper.querySelector('.mermaid-block-svg') as HTMLElement
              if (!svgEl) return
              const canvas = await html2canvas(svgEl, {
                backgroundColor: '#171717',
                scale: 2,
                useCORS: true,
                logging: false,
              })
              const blob = await new Promise<Blob>((resolve, reject) => {
                canvas.toBlob(
                  (b) => (b ? resolve(b) : reject(new Error('toBlob failed'))),
                  'image/png'
                )
              })
              const selected = await save({
                filters: [{ name: 'PNG Image', extensions: ['png'] }],
                defaultPath: 'diagram.png',
              })
              if (!selected) return
              const arrayBuf = await blob.arrayBuffer()
              await writeFile(selected, new Uint8Array(arrayBuf))
            } catch (err) {
              console.error('Export PNG failed:', err)
            }
          },
        },
        {
          id: 'export-svg',
          label: 'Export as SVG',
          icon: <FileIcon />,
          onClick: () => exportAsFile(svgHtml, 'diagram', 'svg'),
        },
        {
          id: 'edit-source',
          label: 'Edit Source',
          icon: <MarkdownIcon />,
          separator: true,
          onClick: () => {
            // Switch to edit mode to allow editing the mermaid source
            setMode('edit')
            requestAnimationFrame(() => {
              textareaRef.current?.focus()
            })
          },
        },
      ]

      setCtxMenuItems(items)
      setCtxMenuPos({ x: e.clientX, y: e.clientY })
    },
    []
  )

  // ---------------------------------------------------------------------------
  // ASCII diagram context menu (adds "Convert to Mermaid" option)
  // ---------------------------------------------------------------------------

  const handleAsciiCodeContextMenu = useCallback(
    (e: React.MouseEvent, codeEl: HTMLElement, lang: string) => {
      const rawCode = codeEl.textContent ?? ''

      // Check if this code block looks like an ASCII diagram
      if (!looksLikeAsciiDiagram(rawCode)) {
        // Fall through to normal code context menu
        handleCodeContextMenu(e, codeEl, lang)
        return
      }

      e.preventDefault()
      e.stopPropagation()
      const ext = getExtForLang(lang || 'txt')
      const fenceBlock = '```' + lang + '\n' + rawCode.trimEnd() + '\n```'

      const items: ContextMenuItem[] = [
        {
          id: 'convert-mermaid',
          label: 'Convert to Mermaid',
          icon: <DiagramIcon />,
          onClick: () => {
            const converted = asciiToMermaid(rawCode)
            setConversionModal({
              mermaidCode: converted,
              originalAscii: rawCode,
            })
          },
        },
        {
          id: 'copy-code',
          label: 'Copy Code',
          icon: <CopyIcon />,
          separator: true,
          onClick: () => copyToClipboard(rawCode),
        },
        {
          id: 'copy-plain',
          label: 'Copy as Plain Text',
          icon: <TextIcon />,
          onClick: () => copyToClipboard(rawCode),
        },
        {
          id: 'export-image',
          label: 'Export as Image',
          icon: <ImageIcon />,
          separator: true,
          onClick: () => {
            const wrapper = codeEl.closest('.code-block-wrapper') as HTMLElement
            if (wrapper) {
              exportAsImage(wrapper, 'code-block.png')
            }
          },
        },
        {
          id: 'export-file',
          label: `Export as File (.${ext})`,
          icon: <FileIcon />,
          onClick: () => exportAsFile(rawCode, 'code-block', ext),
        },
        {
          id: 'copy-markdown',
          label: 'Copy as Markdown',
          icon: <MarkdownIcon />,
          separator: true,
          onClick: () => copyToClipboard(fenceBlock),
        },
      ]

      setCtxMenuItems(items)
      setCtxMenuPos({ x: e.clientX, y: e.clientY })
    },
    [handleCodeContextMenu]
  )

  // ---------------------------------------------------------------------------
  // ASCII-to-Mermaid conversion modal handlers
  // ---------------------------------------------------------------------------

  const handleConversionAccept = useCallback(
    (mode: 'replace' | 'insert-below', code: string) => {
      if (!conversionModal) return
      const mermaidFence = '```mermaid\n' + code + '\n```'
      const originalBlock = conversionModal.originalAscii

      if (mode === 'replace') {
        // Find and replace the ASCII block in content
        const idx = content.indexOf(originalBlock)
        if (idx !== -1) {
          const newContent =
            content.slice(0, idx) + mermaidFence + content.slice(idx + originalBlock.length)
          setContent(newContent)
          setDirty(true)
        } else {
          // Fallback: append at end
          setContent(content + '\n\n' + mermaidFence)
          setDirty(true)
        }
      } else {
        // Insert below: find the end of the ASCII block and insert after
        const idx = content.indexOf(originalBlock)
        if (idx !== -1) {
          // Find the end of the code fence containing this block
          const afterBlock = idx + originalBlock.length
          // Look for closing ``` after the block
          const closingIdx = content.indexOf('```', afterBlock)
          const insertPos = closingIdx !== -1 ? closingIdx + 3 : afterBlock
          const newContent =
            content.slice(0, insertPos) + '\n\n' + mermaidFence + content.slice(insertPos)
          setContent(newContent)
          setDirty(true)
        } else {
          setContent(content + '\n\n' + mermaidFence)
          setDirty(true)
        }
      }

      setConversionModal(null)
    },
    [conversionModal, content]
  )

  const handleConversionCancel = useCallback(() => {
    setConversionModal(null)
  }, [])

  // ---------------------------------------------------------------------------
  // Custom components for react-markdown
  // ---------------------------------------------------------------------------

  const markdownComponents: Record<string, React.ComponentType<any>> = useMemo(
    () => ({
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      pre: ({ node, ...props }: any) => <pre className="md-code-block" {...props} />,
      code: ({ className, children, ...props }: any) => {
        // Detect inline vs block code:
        // - Fenced code blocks: react-markdown renders <pre><code className="language-xxx">
        // - Inline code: react-markdown renders just <code> without className
        // rehype-highlight may add classes like "hljs language-bash"
        const match = /language-(\w+)/.exec(className || '')
        const isInline = !className

        if (isInline) {
          return (
            <code
              style={{
                background: 'rgba(255,255,255,0.06)',
                padding: '2px 6px',
                borderRadius: '4px',
                fontSize: '0.875em',
                fontFamily: 'ui-monospace, "SF Mono", "Cascadia Code", monospace',
                color: 'var(--foreground-default)',
              }}
              {...props}
            >
              {children}
            </code>
          )
        }

        // Extract clean language name from className (handles "hljs language-bash", "language-typescript", etc.)
        const language = match?.[1] ?? ''

        // Detect mermaid code blocks and render as diagrams
        if (language === 'mermaid') {
          const mermaidCode =
            typeof children === 'string'
              ? children
              : Array.isArray(children)
                ? children.map((c: any) => (typeof c === 'string' ? c : '')).join('')
                : String(children ?? '')
          return (
            <MermaidBlock
              code={mermaidCode.replace(/\n$/, '')}
              onContextMenu={handleMermaidContextMenu}
            />
          )
        }

        return (
          <CodeBlock
            className={className}
            language={language}
            onContextMenu={handleAsciiCodeContextMenu}
            {...props}
          >
            {children}
          </CodeBlock>
        )
      },
      table: ({ children, ...props }: any) => (
        <DataTable onContextMenu={handleTableContextMenu} {...props}>
          {children}
        </DataTable>
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
        <a className="md-link" href={href} target="_blank" rel="noopener noreferrer" {...props}>
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
          alt={alt ?? ''}
          className="md-img max-w-full rounded-lg"
          loading="lazy"
          {...props}
        />
      ),
      input: ({ type, checked, ...props }: any) => {
        if (type === 'checkbox') {
          return (
            <input
              type="checkbox"
              checked={checked}
              readOnly
              className="md-checkbox mr-2"
              style={{ accentColor: 'hsl(277, 100%, 50%)' }}
              {...props}
            />
          )
        }
        return <input type={type} {...props} />
      },
      // Suppress frontmatter YAML node from rendering (handled by FrontmatterHeader)
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      yaml: (_props: any) => null,
    }),
    [
      handleCodeContextMenu,
      handleAsciiCodeContextMenu,
      handleMermaidContextMenu,
      handleTableContextMenu,
    ]
  )

  // ---------------------------------------------------------------------------
  // Content change handler
  // ---------------------------------------------------------------------------

  const handleContentChange = useCallback((newContent: string) => {
    setContent(newContent)
    setDirty(true)
  }, [])

  // ---------------------------------------------------------------------------
  // Toolbar insertion
  // ---------------------------------------------------------------------------

  const insertFormatting = useCallback(
    (action: ToolbarAction) => {
      const ta = textareaRef.current
      if (!ta) return

      const start = ta.selectionStart
      const end = ta.selectionEnd
      const selected = content.slice(start, end)
      const before = content.slice(0, start)
      const after = content.slice(end)

      let insertion: string
      if (action.block) {
        const needsNewline = before.length > 0 && !before.endsWith('\n')
        insertion =
          (needsNewline ? '\n' : '') + action.prefix + (selected || 'text') + action.suffix
      } else {
        insertion = action.prefix + (selected || 'text') + action.suffix
      }

      const newContent = before + insertion + after
      handleContentChange(newContent)

      requestAnimationFrame(() => {
        ta.focus()
        const cursorPos = before.length + insertion.length
        ta.setSelectionRange(cursorPos, cursorPos)
      })
    },
    [content, handleContentChange]
  )

  // ---------------------------------------------------------------------------
  // Keyboard shortcuts
  // ---------------------------------------------------------------------------

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      const mod = e.metaKey || e.ctrlKey
      if (!mod) return

      if (e.key === 'b') {
        e.preventDefault()
        insertFormatting(toolbarActions[0]) // Bold
      } else if (e.key === 'i') {
        e.preventDefault()
        insertFormatting(toolbarActions[1]) // Italic
      } else if (e.key === 'k') {
        e.preventDefault()
        insertFormatting(toolbarActions[8]) // Link
      } else if (e.key === 's') {
        e.preventDefault()
        handleSaveToView()
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [insertFormatting]
  )

  // ---------------------------------------------------------------------------
  // Sync scroll between editor and preview (split mode)
  // ---------------------------------------------------------------------------

  const handleEditorScroll = useCallback(() => {
    const ta = textareaRef.current
    const pv = previewRef.current
    if (!ta || !pv) return
    const ratio = ta.scrollTop / (ta.scrollHeight - ta.clientHeight || 1)
    pv.scrollTop = ratio * (pv.scrollHeight - pv.clientHeight || 1)
  }, [])

  // ---------------------------------------------------------------------------
  // Tab handling in textarea
  // ---------------------------------------------------------------------------

  const handleTab = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Tab') {
        e.preventDefault()
        const ta = textareaRef.current
        if (!ta) return
        const start = ta.selectionStart
        const end = ta.selectionEnd
        const newContent = content.slice(0, start) + '  ' + content.slice(end)
        handleContentChange(newContent)
        requestAnimationFrame(() => {
          ta.setSelectionRange(start + 2, start + 2)
        })
      }
    },
    [content, handleContentChange]
  )

  // ---------------------------------------------------------------------------
  // Mode switching
  // ---------------------------------------------------------------------------

  const handleEdit = useCallback(() => {
    setMode('edit')
    requestAnimationFrame(() => {
      textareaRef.current?.focus()
    })
  }, [])

  const handleSaveToView = useCallback(() => {
    setMode('view')
  }, [])

  // ---------------------------------------------------------------------------
  // Native file dialogs — Open
  // ---------------------------------------------------------------------------

  async function handleOpen() {
    try {
      const selected = await open({
        multiple: false,
        filters: [
          {
            name: 'Markdown',
            extensions: ['md', 'markdown', 'mdx', 'txt'],
          },
        ],
      })

      if (selected) {
        const text = await readTextFile(selected)
        setContent(text)
        setFilePath(selected)
        setDirty(false)
        setMode('view')
      }
    } catch (err) {
      console.error('Open file failed:', err)
    }
  }

  // ---------------------------------------------------------------------------
  // Native file dialogs — Save
  // ---------------------------------------------------------------------------

  async function handleSaveFile() {
    try {
      let path = filePath
      if (!path) {
        const selected = await save({
          filters: [
            {
              name: 'Markdown',
              extensions: ['md'],
            },
          ],
          defaultPath: 'document.md',
        })
        if (!selected) return
        path = selected
        setFilePath(path)
      }

      await writeTextFile(path, content)
      setDirty(false)
    } catch (err) {
      console.error('Save file failed:', err)
    }
  }

  async function handleSaveAs() {
    try {
      const selected = await save({
        filters: [
          {
            name: 'Markdown',
            extensions: ['md'],
          },
        ],
        defaultPath: filePath ?? 'document.md',
      })
      if (!selected) return

      await writeTextFile(selected, content)
      setFilePath(selected)
      setDirty(false)
    } catch (err) {
      console.error('Save As failed:', err)
    }
  }

  // ---------------------------------------------------------------------------
  // Export handlers with native save dialogs
  // ---------------------------------------------------------------------------

  async function handleExportHTML() {
    setExporting('html')
    try {
      const selected = await save({
        filters: [{ name: 'HTML', extensions: ['html'] }],
        defaultPath: 'document.html',
      })
      if (!selected) {
        setExporting(null)
        return
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
</html>`

      await writeTextFile(selected, html)
    } catch (err) {
      console.error('Export HTML failed:', err)
    } finally {
      setExporting(null)
    }
  }

  async function handleExportRust(format: 'pdf' | 'docx' | 'pptx') {
    setExporting(format)
    try {
      const selected = await save({
        filters: [
          {
            name: format.toUpperCase(),
            extensions: [format],
          },
        ],
        defaultPath: `document.${format}`,
      })
      if (!selected) {
        setExporting(null)
        return
      }

      // Invoke Rust backend for binary export formats
      const result = await invoke<number[]>('export_document', {
        content,
        format,
        path: selected,
      })

      // If the backend returns bytes, write them; otherwise it wrote directly
      if (result && Array.isArray(result) && result.length > 0) {
        await writeFile(selected, new Uint8Array(result))
      }
    } catch (err) {
      console.error(`Export ${format} failed:`, err)
    } finally {
      setExporting(null)
    }
  }

  // ---------------------------------------------------------------------------
  // Register command palette action handlers (kept in ref for fresh closures)
  // ---------------------------------------------------------------------------

  editorActionsRef.current = {
    'open-file': handleOpen,
    'new-document': () => {
      setContent('')
      setFilePath(null)
      setDirty(false)
      setMode('edit')
    },
    'export-current': handleExportHTML,
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
    )
  }, [markdownBody, hasFrontmatter, content, markdownComponents])

  // ---------------------------------------------------------------------------
  // Filename display
  // ---------------------------------------------------------------------------

  const fileName = filePath ? (filePath.split('/').pop() ?? 'Untitled') : 'Untitled'

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="flex h-full flex-col">
      {/* Context menu overlay */}
      <ContextMenu items={ctxMenuItems} position={ctxMenuPos} onClose={closeContextMenu} />

      {/* ASCII-to-Mermaid conversion modal */}
      {conversionModal && (
        <AsciiToMermaidModal
          mermaidCode={conversionModal.mermaidCode}
          onAccept={handleConversionAccept}
          onCancel={handleConversionCancel}
        />
      )}

      {/* Share dialog */}
      <ShareDialog
        open={shareDialogOpen}
        onClose={() => setShareDialogOpen(false)}
        content={content}
        title={fileName}
        fileType="markdown"
      />

      {/* Top toolbar */}
      <div
        className="flex shrink-0 items-center gap-1 px-3 py-2"
        style={{
          background: 'var(--background-dash-sidebar)',
          borderBottom: '1px solid var(--border-default)',
        }}
      >
        {/* File actions */}
        {[
          { onClick: handleOpen, title: 'Open File', label: 'Open' },
          { onClick: handleSaveFile, title: 'Save File (Cmd+S)', label: 'Save' },
          { onClick: handleSaveAs, title: 'Save As...', label: 'Save As' },
        ].map((btn) => (
          <button
            key={btn.label}
            onClick={btn.onClick}
            title={btn.title}
            className="rounded px-2.5 py-1.5 text-xs font-medium transition-colors"
            style={{ color: 'var(--foreground-lighter)' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--background-surface-300)'
              e.currentTarget.style.color = 'var(--foreground-default)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.color = 'var(--foreground-lighter)'
            }}
          >
            {btn.label}
          </button>
        ))}

        <div className="mx-2 h-4 w-px" style={{ background: 'var(--border-strong)' }} />

        {/* Mode toggle */}
        {mode === 'view' ? (
          <button
            onClick={handleEdit}
            title="Edit Mode"
            className="rounded px-2.5 py-1.5 text-xs font-medium transition-colors"
            style={{ background: 'var(--brand-400)', color: 'var(--brand-600)' }}
          >
            Edit
          </button>
        ) : (
          <button
            onClick={handleSaveToView}
            title="View Mode (Cmd+S)"
            className="rounded px-2.5 py-1.5 text-xs font-medium transition-colors"
            style={{ background: 'var(--brand-400)', color: 'var(--brand-default)' }}
          >
            Done
          </button>
        )}

        {/* Formatting toolbar (only in edit mode) */}
        {mode === 'edit' && (
          <>
            <div className="mx-2 h-4 w-px" style={{ background: 'var(--border-strong)' }} />
            {toolbarActions.map((action) => (
              <button
                key={action.label}
                onClick={() => insertFormatting(action)}
                title={
                  action.label +
                  (action.label === 'Bold'
                    ? ' (Cmd+B)'
                    : action.label === 'Italic'
                      ? ' (Cmd+I)'
                      : action.label === 'Link'
                        ? ' (Cmd+K)'
                        : '')
                }
                className="rounded px-2 py-1.5 text-xs font-medium transition-colors"
                style={{ color: 'var(--foreground-lighter)' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--background-surface-300)'
                  e.currentTarget.style.color = 'var(--foreground-default)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent'
                  e.currentTarget.style.color = 'var(--foreground-lighter)'
                }}
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
          className="rounded px-2.5 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50"
          style={
            exporting === 'html'
              ? { background: 'var(--brand-400)', color: 'var(--brand-default)' }
              : { color: 'var(--foreground-lighter)' }
          }
        >
          {exporting === 'html' ? 'Exporting...' : 'HTML'}
        </button>
        {(['pdf', 'docx'] as const).map((fmt) => (
          <button
            key={fmt}
            onClick={() => handleExportRust(fmt)}
            disabled={exporting !== null}
            className="rounded px-2.5 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50"
            style={
              exporting === fmt
                ? { background: 'var(--brand-400)', color: 'var(--brand-default)' }
                : { color: 'var(--foreground-lighter)' }
            }
          >
            {exporting === fmt ? '...' : fmt.toUpperCase()}
          </button>
        ))}

        <div className="mx-2 h-4 w-px" style={{ background: 'var(--border-strong)' }} />

        {/* Share button */}
        <button
          onClick={() => setShareDialogOpen(true)}
          className="flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs font-medium transition-colors"
          style={{ background: 'var(--brand-400)', color: 'var(--brand-default)' }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--brand-500)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'var(--brand-400)'
          }}
          title="Share Document"
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M4 12V8.5a3.5 3.5 0 1 1 7 0V9" />
            <path d="M11 8l3 3-3 3" />
            <path d="M14 11H7" />
          </svg>
          Share
        </button>
      </div>

      {/* Main content area */}
      {mode === 'view' ? (
        /* ────────────── VIEW MODE: full-width rendered preview ────────────── */
        <div className="flex flex-1 flex-col overflow-hidden">
          <div
            className="flex shrink-0 items-center px-3 py-1.5"
            style={{ borderBottom: '1px solid var(--border-muted)' }}
          >
            <span
              className="text-[11px] font-medium uppercase tracking-wider"
              style={{ color: 'var(--foreground-lighter)' }}
            >
              Preview
            </span>
            <span className="ml-2 text-[11px]" style={{ color: 'var(--foreground-muted)' }}>
              {fileName}
            </span>
            {dirty && (
              <span className="ml-1.5 text-[10px]" style={{ color: 'var(--warning-default)' }}>
                (unsaved)
              </span>
            )}
          </div>
          <div ref={previewRef} className="flex-1 overflow-auto p-6" onDoubleClick={handleEdit}>
            <div className="mx-auto max-w-3xl">{RenderedPreview}</div>
          </div>
        </div>
      ) : (
        /* ────────────── EDIT MODE: split pane (editor + preview) ────────────── */
        <div className="flex flex-1 overflow-hidden">
          {/* Left: textarea editor */}
          <div
            className="flex flex-1 flex-col"
            style={{ borderRight: '1px solid var(--border-default)' }}
          >
            <div
              className="flex shrink-0 items-center px-3 py-1.5"
              style={{ borderBottom: '1px solid var(--border-muted)' }}
            >
              <span
                className="text-[11px] font-medium uppercase tracking-wider"
                style={{ color: 'var(--foreground-lighter)' }}
              >
                Markdown
              </span>
              <span className="ml-2 text-[11px]" style={{ color: 'var(--foreground-muted)' }}>
                {fileName}
              </span>
              {dirty && (
                <span className="ml-1.5 text-[10px]" style={{ color: 'var(--warning-default)' }}>
                  (unsaved)
                </span>
              )}
            </div>
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => handleContentChange(e.target.value)}
              onKeyDown={(e) => {
                handleKeyDown(e)
                handleTab(e)
              }}
              onScroll={handleEditorScroll}
              spellCheck={false}
              className="flex-1 resize-none p-4 font-mono text-sm leading-relaxed focus:outline-none"
              style={{
                background: 'var(--background-default)',
                color: 'var(--foreground-light)',
              }}
              placeholder="Start writing markdown..."
            />
          </div>

          {/* Right: live preview */}
          <div className="flex flex-1 flex-col">
            <div
              className="flex shrink-0 items-center px-3 py-1.5"
              style={{ borderBottom: '1px solid var(--border-muted)' }}
            >
              <span
                className="text-[11px] font-medium uppercase tracking-wider"
                style={{ color: 'var(--foreground-lighter)' }}
              >
                Preview
              </span>
            </div>
            <div className="flex-1 overflow-auto p-4">{RenderedPreview}</div>
          </div>
        </div>
      )}

      {/* Bottom bar: word count + reading time */}
      <div
        className="flex shrink-0 items-center justify-between px-4 py-1.5"
        style={{
          background: 'var(--background-dash-sidebar)',
          borderTop: '1px solid var(--border-default)',
        }}
      >
        <div className="flex items-center gap-4">
          <span className="text-[11px]" style={{ color: 'var(--foreground-lighter)' }}>
            {words} {words === 1 ? 'word' : 'words'}
          </span>
          <span className="text-[11px]" style={{ color: 'var(--foreground-lighter)' }}>
            ~{readingTime} min read
          </span>
          {filePath && (
            <span
              className="max-w-xs truncate text-[11px]"
              style={{ color: 'var(--foreground-muted)' }}
            >
              {filePath}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[11px]" style={{ color: 'var(--foreground-muted)' }}>
            {mode === 'view' ? 'Viewing' : 'Editing'}
          </span>
          <span className="text-[11px]" style={{ color: 'var(--foreground-muted)' }}>
            Orchestra Editor
          </span>
        </div>
      </div>
    </div>
  )
}
