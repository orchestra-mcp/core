// Orchestra Desktop — Explorer / File Browser
//
// Sidebar-style file tree showing workspace markdown files.
// Calls Tauri commands to list and search files.
// Single-click opens read-only viewer; double-click or Edit button
// switches to the full MarkdownEditor.

import { invoke } from '@tauri-apps/api/core'
import { useCallback, useEffect, useMemo, useRef, useState, type FC } from 'react'
import ReactMarkdown from 'react-markdown'
import rehypeHighlight from 'rehype-highlight'
import rehypeRaw from 'rehype-raw'
import remarkGfm from 'remark-gfm'

// ---------------------------------------------------------------------------
// Types (matching Rust workspace structs)
// ---------------------------------------------------------------------------

interface WorkspaceEntry {
  path: string
  name: string
  relative_path: string
  folder: string
  file_type: string
  size: number
  modified: string
  preview: string
  title: string | null
  frontmatter: string | null
}

// ---------------------------------------------------------------------------
// Section config for folder categorization
// ---------------------------------------------------------------------------

interface FolderSection {
  key: string
  label: string
  folders: string[]
  icon: React.ReactNode
}

const FOLDER_SECTIONS: FolderSection[] = [
  {
    key: 'agents',
    label: 'Agents',
    folders: ['.claude/agents', 'agents'],
    icon: (
      <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="8" cy="5" r="3" />
        <path d="M2 14c0-3.3 2.7-6 6-6s6 2.7 6 6" />
      </svg>
    ),
  },
  {
    key: 'skills',
    label: 'Skills',
    folders: ['.claude/skills', 'skills'],
    icon: (
      <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8 1l2.5 5 5.5.8-4 3.9L13 16 8 13.2 3 16l1-5.3-4-3.9 5.5-.8L8 1Z" />
      </svg>
    ),
  },
  {
    key: 'rules',
    label: 'Rules',
    folders: ['.claude/rules', 'rules'],
    icon: (
      <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 2h12v12H2z" />
        <path d="M5 6h6M5 8h6M5 10h4" />
      </svg>
    ),
  },
  {
    key: 'specs',
    label: 'Specs',
    folders: ['spec', 'specs'],
    icon: (
      <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 1h7l3 3v11H3V1Z" />
        <path d="M10 1v3h3" />
      </svg>
    ),
  },
  {
    key: 'plans',
    label: 'Plans',
    folders: ['.plans', 'plans', 'spec/plans'],
    icon: (
      <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 3h12M2 6h8M2 9h10M2 12h6" />
      </svg>
    ),
  },
  {
    key: 'docs',
    label: 'Docs',
    folders: ['docs', 'doc', 'documentation'],
    icon: (
      <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 2h5l1 1v10H3a1 1 0 01-1-1V2Z" />
        <path d="M8 3h5a1 1 0 011 1v9a1 1 0 01-1 1H8V3Z" />
      </svg>
    ),
  },
  {
    key: 'notes',
    label: 'Notes',
    folders: ['notes', '.notes'],
    icon: (
      <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 2h10a1 1 0 011 1v10a1 1 0 01-1 1H3a1 1 0 01-1-1V3a1 1 0 011-1Z" />
        <path d="M5 5h6M5 8h6M5 11h3" />
      </svg>
    ),
  },
]

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ExplorerProps {
  workspacePath: string
  onOpenFile: (path: string) => void
  onEditFile: (path: string) => void
}

// ---------------------------------------------------------------------------
// Explorer Component
// ---------------------------------------------------------------------------

export const Explorer: FC<ExplorerProps> = ({ workspacePath, onOpenFile, onEditFile }) => {
  const [files, setFiles] = useState<WorkspaceEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedFile, setSelectedFile] = useState<WorkspaceEntry | null>(null)
  const [fileContent, setFileContent] = useState<string | null>(null)
  const [loadingContent, setLoadingContent] = useState(false)
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set())
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Scan workspace ────────────────────────────────────────────

  const scanFiles = useCallback(async () => {
    if (!workspacePath) return
    setLoading(true)
    try {
      const entries = await invoke<WorkspaceEntry[]>('scan_workspace', { path: workspacePath })
      setFiles(entries)
    } catch (e) {
      console.error('Failed to scan workspace:', e)
      setFiles([])
    } finally {
      setLoading(false)
    }
  }, [workspacePath])

  useEffect(() => {
    scanFiles()
  }, [scanFiles])

  // ── File content loading ──────────────────────────────────────

  const loadFileContent = useCallback(async (entry: WorkspaceEntry) => {
    setLoadingContent(true)
    try {
      const content = await invoke<string>('read_workspace_file', { path: entry.path })
      setFileContent(content)
    } catch (e) {
      console.error('Failed to read file:', e)
      setFileContent(null)
    } finally {
      setLoadingContent(false)
    }
  }, [])

  // ── Click handling (single = view, double = edit) ─────────────

  const handleFileClick = useCallback(
    (entry: WorkspaceEntry) => {
      if (clickTimerRef.current) {
        // Double-click detected
        clearTimeout(clickTimerRef.current)
        clickTimerRef.current = null
        onEditFile(entry.path)
        return
      }

      clickTimerRef.current = setTimeout(() => {
        clickTimerRef.current = null
        // Single click — show read-only preview
        setSelectedFile(entry)
        loadFileContent(entry)
        onOpenFile(entry.path)
      }, 250)
    },
    [onEditFile, loadFileContent]
  )

  // ── Section toggling ──────────────────────────────────────────

  const toggleSection = useCallback((key: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }, [])

  // ── Categorize files into sections ────────────────────────────

  const categorized = useMemo(() => {
    const result: Record<string, WorkspaceEntry[]> = {}
    const uncategorized: WorkspaceEntry[] = []

    // Filter by search query first
    const filtered = searchQuery.trim()
      ? files.filter(
          (f) =>
            f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            f.relative_path.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (f.title && f.title.toLowerCase().includes(searchQuery.toLowerCase()))
        )
      : files

    for (const file of filtered) {
      let placed = false
      for (const section of FOLDER_SECTIONS) {
        for (const folder of section.folders) {
          if (
            file.relative_path.startsWith(folder + '/') ||
            file.folder === folder ||
            file.relative_path.startsWith('./' + folder + '/')
          ) {
            if (!result[section.key]) result[section.key] = []
            result[section.key].push(file)
            placed = true
            break
          }
        }
        if (placed) break
      }
      if (!placed) {
        uncategorized.push(file)
      }
    }

    return { sections: result, uncategorized }
  }, [files, searchQuery])

  // ── File type badge color ─────────────────────────────────────

  const getTypeBadge = (fileType: string) => {
    const TYPE_COLORS: Record<string, { color: string; bg: string }> = {
      agent: { color: '#a78bfa', bg: 'rgba(167,139,250,0.12)' },
      skill: { color: '#facc15', bg: 'rgba(250,204,21,0.12)' },
      rule: { color: '#fb923c', bg: 'rgba(251,146,60,0.12)' },
      'claude-md': { color: '#34d399', bg: 'rgba(52,211,153,0.12)' },
      readme: { color: '#60a5fa', bg: 'rgba(96,165,250,0.12)' },
      plan: { color: '#f472b6', bg: 'rgba(244,114,182,0.12)' },
      spec: { color: '#38bdf8', bg: 'rgba(56,189,248,0.12)' },
      doc: { color: '#94a3b8', bg: 'rgba(148,163,184,0.10)' },
      markdown: { color: '#64748b', bg: 'rgba(100,116,139,0.10)' },
    }
    const c = TYPE_COLORS[fileType] ?? TYPE_COLORS.markdown
    return (
      <span
        className="rounded px-1.5 py-0.5 text-[9px] font-medium uppercase"
        style={{ color: c.color, background: c.bg }}
      >
        {fileType}
      </span>
    )
  }

  // ── Render file list item ─────────────────────────────────────

  const renderFileItem = (entry: WorkspaceEntry) => {
    const isSelected = selectedFile?.path === entry.path
    return (
      <button
        key={entry.path}
        className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors"
        style={{
          background: isSelected ? 'var(--background-surface-200)' : 'transparent',
          borderLeft: isSelected ? '2px solid var(--brand-default)' : '2px solid transparent',
        }}
        onClick={() => handleFileClick(entry)}
        onMouseEnter={(e) => {
          if (!isSelected) {
            e.currentTarget.style.background = 'var(--background-surface-100)'
          }
        }}
        onMouseLeave={(e) => {
          if (!isSelected) {
            e.currentTarget.style.background = 'transparent'
          }
        }}
        title={`Click to preview, double-click to edit\n${entry.relative_path}`}
      >
        {/* File icon */}
        <svg
          className="h-4 w-4 shrink-0"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M3 1h7l3 3v11H3V1Z" />
          <path d="M10 1v3h3" />
          <path d="M5 8h6M5 10h4" />
        </svg>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span
              className="truncate text-xs font-medium"
              style={{ color: isSelected ? 'var(--foreground-default)' : 'var(--foreground-light)' }}
            >
              {entry.title || entry.name}
            </span>
            {getTypeBadge(entry.file_type)}
          </div>
          <span
            className="block truncate text-[10px]"
            style={{ color: 'var(--foreground-muted)' }}
          >
            {entry.relative_path}
          </span>
        </div>
      </button>
    )
  }

  // ── Render section ────────────────────────────────────────────

  const renderSection = (section: FolderSection, sectionFiles: WorkspaceEntry[]) => {
    if (sectionFiles.length === 0) return null
    const isCollapsed = collapsedSections.has(section.key)

    return (
      <div key={section.key}>
        <button
          className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors"
          style={{ color: 'var(--foreground-lighter)' }}
          onClick={() => toggleSection(section.key)}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--background-surface-100)'
            e.currentTarget.style.color = 'var(--foreground-light)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent'
            e.currentTarget.style.color = 'var(--foreground-lighter)'
          }}
        >
          <svg
            className="h-3 w-3 shrink-0 transition-transform"
            style={{ transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <path d="M4 6l4 4 4-4" />
          </svg>
          {section.icon}
          <span className="text-xs font-semibold uppercase tracking-wider">{section.label}</span>
          <span
            className="ml-auto text-[10px] font-medium"
            style={{ color: 'var(--foreground-muted)' }}
          >
            {sectionFiles.length}
          </span>
        </button>
        {!isCollapsed && (
          <div className="pb-1">{sectionFiles.map((f) => renderFileItem(f))}</div>
        )}
      </div>
    )
  }

  // ── Main render ───────────────────────────────────────────────

  return (
    <div className="flex h-full">
      {/* Left: File tree sidebar */}
      <div
        className="flex h-full w-72 shrink-0 flex-col"
        style={{
          background: 'var(--background-dash-sidebar)',
          borderRight: '1px solid var(--border-default)',
        }}
      >
        {/* Search bar */}
        <div className="p-2">
          <div className="relative">
            <svg
              className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2"
              style={{ color: 'var(--foreground-muted)' }}
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="7" cy="7" r="4.5" />
              <path d="M10.5 10.5L14 14" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search files..."
              className="w-full rounded-md py-1.5 pl-8 pr-3 text-xs outline-none transition"
              style={{
                background: 'var(--background-control)',
                border: '1px solid var(--border-control)',
                color: 'var(--foreground-default)',
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = 'var(--brand-default)'
                e.currentTarget.style.boxShadow = '0 0 0 1px hsla(277, 100%, 50%, 0.3)'
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-control)'
                e.currentTarget.style.boxShadow = 'none'
              }}
            />
            {searchQuery && (
              <button
                className="absolute right-2 top-1/2 -translate-y-1/2"
                style={{ color: 'var(--foreground-muted)' }}
                onClick={() => setSearchQuery('')}
              >
                <svg
                  className="h-3 w-3"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                >
                  <path d="M4 4l8 8M12 4l-8 8" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* File count */}
        <div className="flex items-center justify-between px-3 py-1">
          <span className="text-[10px]" style={{ color: 'var(--foreground-muted)' }}>
            {files.length} file{files.length !== 1 ? 's' : ''}
          </span>
          <button
            onClick={scanFiles}
            className="rounded p-1 transition-colors"
            style={{ color: 'var(--foreground-muted)' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--foreground-light)'
              e.currentTarget.style.background = 'var(--background-surface-200)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--foreground-muted)'
              e.currentTarget.style.background = 'transparent'
            }}
            title="Refresh file list"
          >
            <svg
              className="h-3 w-3"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M1 8a7 7 0 0113.1-3.5M15 8a7 7 0 01-13.1 3.5" />
              <path d="M14.1 1v3.5h-3.5M1.9 15v-3.5h3.5" />
            </svg>
          </button>
        </div>

        {/* File tree */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="space-y-2 px-3 py-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div
                    className="h-4 w-4 animate-pulse rounded"
                    style={{ background: 'var(--background-surface-300)' }}
                  />
                  <div
                    className="h-3 animate-pulse rounded"
                    style={{
                      background: 'var(--background-surface-300)',
                      width: `${60 + Math.random() * 80}px`,
                    }}
                  />
                </div>
              ))}
            </div>
          ) : files.length === 0 ? (
            <div className="px-3 py-8 text-center">
              <p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
                No markdown files found in workspace.
              </p>
            </div>
          ) : (
            <>
              {/* Categorized sections */}
              {FOLDER_SECTIONS.map((section) => {
                const sectionFiles = categorized.sections[section.key]
                if (!sectionFiles || sectionFiles.length === 0) return null
                return renderSection(section, sectionFiles)
              })}

              {/* Uncategorized files */}
              {categorized.uncategorized.length > 0 && (
                <div>
                  <div
                    className="px-3 py-2"
                    style={{ borderTop: '1px solid var(--border-default)' }}
                  >
                    <span
                      className="text-[10px] font-semibold uppercase tracking-wider"
                      style={{ color: 'var(--foreground-muted)' }}
                    >
                      Other Files ({categorized.uncategorized.length})
                    </span>
                  </div>
                  {categorized.uncategorized.map((f) => renderFileItem(f))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Right: File preview / viewer */}
      <div className="flex-1 overflow-auto" style={{ background: 'var(--background-dash-canvas)' }}>
        {selectedFile ? (
          <div className="h-full flex flex-col">
            {/* Preview header */}
            <div
              className="flex items-center justify-between px-4 py-3 shrink-0"
              style={{
                borderBottom: '1px solid var(--border-default)',
                background: 'var(--background-surface-100)',
              }}
            >
              <div className="min-w-0 flex-1">
                <h3
                  className="truncate text-sm font-semibold"
                  style={{ color: 'var(--foreground-default)' }}
                >
                  {selectedFile.title || selectedFile.name}
                </h3>
                <p className="truncate text-[11px]" style={{ color: 'var(--foreground-muted)' }}>
                  {selectedFile.relative_path}
                </p>
              </div>
              <button
                onClick={() => onEditFile(selectedFile.path)}
                className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors"
                style={{
                  background: 'var(--brand-default)',
                  color: 'var(--foreground-contrast)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--brand-600)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'var(--brand-default)'
                }}
              >
                <svg
                  className="h-3.5 w-3.5 shrink-0"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M11.5 1.5l3 3L5 14H2v-3L11.5 1.5Z" />
                </svg>
                Edit
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto p-6">
              {loadingContent ? (
                <div className="space-y-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div
                      key={i}
                      className="h-4 animate-pulse rounded"
                      style={{
                        background: 'var(--background-surface-300)',
                        width: `${40 + Math.random() * 50}%`,
                      }}
                    />
                  ))}
                </div>
              ) : fileContent ? (
                <div className="prose prose-invert max-w-none">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    rehypePlugins={[rehypeRaw, rehypeHighlight]}
                  >
                    {fileContent}
                  </ReactMarkdown>
                </div>
              ) : (
                <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>
                  Unable to load file content.
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <svg
                className="mx-auto h-12 w-12"
                style={{ color: 'var(--foreground-muted)' }}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3 3h7l2 2h9v14H3V3Z" />
                <path d="M9 13h6M9 16h4" />
              </svg>
              <p
                className="mt-3 text-sm font-medium"
                style={{ color: 'var(--foreground-lighter)' }}
              >
                Select a file to preview
              </p>
              <p className="mt-1 text-xs" style={{ color: 'var(--foreground-muted)' }}>
                Click to view, double-click to edit
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default Explorer
