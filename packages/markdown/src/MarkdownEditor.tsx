import { useCallback, useRef, useState } from 'react'

import { MarkdownViewer, type MarkdownViewerProps } from './MarkdownViewer'

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
// Export format button config
// ---------------------------------------------------------------------------

export interface ExportFormatButton {
  /** Display label (e.g. "PDF", "DOCX") */
  label: string
  /** Format key used in the onExport callback */
  format: string
}

// ---------------------------------------------------------------------------
// MarkdownEditor — full editor with toolbar, split-pane preview, exports
// ---------------------------------------------------------------------------

export interface MarkdownEditorProps {
  /** Current markdown content (controlled) */
  value: string
  /** Called when content changes */
  onChange: (value: string) => void
  /** File name to display in the header bars */
  fileName?: string
  /** Whether the document has unsaved changes */
  dirty?: boolean
  /** Export buttons to display (e.g. [{label:'PDF', format:'pdf'}]) */
  exportFormats?: ExportFormatButton[]
  /** Called when an export button is clicked */
  onExport?: (format: string) => void
  /** Format currently being exported (disables all export buttons) */
  exportingFormat?: string | null
  /** Props forwarded to the MarkdownViewer preview pane */
  viewerProps?: Omit<MarkdownViewerProps, 'content'>
}

export function MarkdownEditor({
  value,
  onChange,
  fileName = 'Untitled',
  dirty = false,
  exportFormats = [],
  onExport,
  exportingFormat = null,
  viewerProps,
}: MarkdownEditorProps) {
  const [mode, setMode] = useState<'view' | 'edit'>('view')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const previewRef = useRef<HTMLDivElement>(null)

  // Word count + reading time
  const words = value
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0).length
  const readingTime = Math.max(1, Math.ceil(words / 200))

  // ---------------------------------------------------------------------------
  // Content change
  // ---------------------------------------------------------------------------

  const handleContentChange = useCallback(
    (newContent: string) => {
      onChange(newContent)
    },
    [onChange]
  )

  // ---------------------------------------------------------------------------
  // Toolbar insertion
  // ---------------------------------------------------------------------------

  const insertFormatting = useCallback(
    (action: ToolbarAction) => {
      const ta = textareaRef.current
      if (!ta) return

      const start = ta.selectionStart
      const end = ta.selectionEnd
      const selected = value.slice(start, end)
      const before = value.slice(0, start)
      const after = value.slice(end)

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
    [value, handleContentChange]
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
        setMode('view')
      }
    },
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
        const newContent = value.slice(0, start) + '  ' + value.slice(end)
        handleContentChange(newContent)
        requestAnimationFrame(() => {
          ta.setSelectionRange(start + 2, start + 2)
        })
      }
    },
    [value, handleContentChange]
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
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="flex h-full flex-col">
      {/* Top toolbar */}
      <div
        className="flex shrink-0 items-center gap-1 px-3 py-2"
        style={{
          background: 'var(--background-dash-sidebar)',
          borderBottom: '1px solid var(--border-default)',
        }}
      >
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
        {exportFormats.map((fmt) => (
          <button
            key={fmt.format}
            onClick={() => onExport?.(fmt.format)}
            disabled={exportingFormat !== null}
            className="rounded px-2.5 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50"
            style={
              exportingFormat === fmt.format
                ? { background: 'var(--brand-400)', color: 'var(--brand-default)' }
                : { color: 'var(--foreground-lighter)' }
            }
          >
            {exportingFormat === fmt.format ? '...' : fmt.label}
          </button>
        ))}
      </div>

      {/* Main content area */}
      {mode === 'view' ? (
        /* View mode: full-width rendered preview */
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
            <div className="mx-auto max-w-3xl">
              <MarkdownViewer content={value} {...viewerProps} />
            </div>
          </div>
        </div>
      ) : (
        /* Edit mode: split pane (editor + preview) */
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
              value={value}
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
            <div className="flex-1 overflow-auto p-4">
              <MarkdownViewer content={value} {...viewerProps} />
            </div>
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
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[11px]" style={{ color: 'var(--foreground-muted)' }}>
            {mode === 'view' ? 'Viewing' : 'Editing'}
          </span>
        </div>
      </div>
    </div>
  )
}
