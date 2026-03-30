import { invoke } from '@tauri-apps/api/core'
import { useCallback, useEffect, useMemo, useState, type FC } from 'react'

import { MarkdownViewer } from '@orchestra-mcp/markdown'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DocFile {
  name: string
  path: string
  category: string
}

interface DocCategory {
  id: string
  label: string
  icon: string
  pattern: string
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CATEGORIES: DocCategory[] = [
  { id: 'getting-started', label: 'Getting Started', icon: 'rocket', pattern: 'getting-started' },
  { id: 'api-reference', label: 'API Reference', icon: 'code', pattern: 'api' },
  { id: 'architecture', label: 'Architecture', icon: 'layers', pattern: 'architecture' },
  { id: 'guides', label: 'Guides', icon: 'book', pattern: 'guides' },
]

/** Classify a file path into a category based on its directory or filename */
function classifyDoc(filePath: string): string {
  const lower = filePath.toLowerCase()
  for (const cat of CATEGORIES) {
    if (lower.includes(cat.pattern)) return cat.id
  }
  // Default bucket: if the file is in an api/ folder or contains "api" in name
  if (lower.includes('api') || lower.includes('reference')) return 'api-reference'
  if (lower.includes('arch') || lower.includes('design') || lower.includes('adr')) return 'architecture'
  if (lower.includes('guide') || lower.includes('howto') || lower.includes('tutorial')) return 'guides'
  return 'getting-started'
}

// ---------------------------------------------------------------------------
// Category Icon
// ---------------------------------------------------------------------------

function CategoryIcon({ icon }: { icon: string }) {
  const cls = 'h-4 w-4 shrink-0'
  switch (icon) {
    case 'rocket':
      return (
        <svg className={cls} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 10L2 14M10 6l4-4M8.5 2.5C10.5 3.5 12.5 5.5 13.5 7.5L10 11 5 6 8.5 2.5Z" />
          <circle cx="10" cy="6" r="1" />
        </svg>
      )
    case 'code':
      return (
        <svg className={cls} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 4L1 8l4 4M11 4l4 4-4 4M9 2l-2 12" />
        </svg>
      )
    case 'layers':
      return (
        <svg className={cls} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M1 8l7 4 7-4M1 11l7 4 7-4M1 5l7-4 7 4-7 4-7-4Z" />
        </svg>
      )
    case 'book':
      return (
        <svg className={cls} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 2h4.5c1 0 1.5.5 1.5 1.5V14L6.5 13H2V2ZM14 2H9.5C8.5 2 8 2.5 8 3.5V14l1.5-1H14V2Z" />
        </svg>
      )
    default:
      return null
  }
}

// ---------------------------------------------------------------------------
// Docs Browser Page
// ---------------------------------------------------------------------------

const DocsPage: FC = () => {
  const [docs, setDocs] = useState<DocFile[]>([])
  const [selectedDoc, setSelectedDoc] = useState<DocFile | null>(null)
  const [content, setContent] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [contentLoading, setContentLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(CATEGORIES.map((c) => c.id))
  )

  // ─── Load docs list from /docs directory ────────────────────────

  const loadDocs = useCallback(async () => {
    setLoading(true)
    try {
      // Use Tauri to list markdown files in the workspace /docs directory
      const files = await invoke<string[]>('list_docs_files')
      const docFiles: DocFile[] = files.map((f) => {
        const name = f.split('/').pop()?.replace(/\.md$/, '').replace(/[-_]/g, ' ') ?? f
        return {
          name: name.charAt(0).toUpperCase() + name.slice(1),
          path: f,
          category: classifyDoc(f),
        }
      })
      setDocs(docFiles)
      // Auto-select first doc
      if (docFiles.length > 0 && !selectedDoc) {
        handleSelectDoc(docFiles[0])
      }
    } catch {
      // Fallback: use empty list (Tauri command might not be available yet)
      setDocs([])
    } finally {
      setLoading(false)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSelectDoc = useCallback(async (doc: DocFile) => {
    setSelectedDoc(doc)
    setContentLoading(true)
    try {
      const text = await invoke<string>('read_file_content', { path: doc.path })
      setContent(text)
    } catch {
      setContent(`# Error\n\nCould not load file: ${doc.path}`)
    } finally {
      setContentLoading(false)
    }
  }, [])

  useEffect(() => {
    loadDocs()
  }, [loadDocs])

  // ─── Filtering ─────────────────────────────────────────────────

  const filteredDocs = useMemo(() => {
    if (!searchQuery.trim()) return docs
    const q = searchQuery.toLowerCase()
    return docs.filter(
      (d) =>
        d.name.toLowerCase().includes(q) ||
        d.path.toLowerCase().includes(q) ||
        d.category.toLowerCase().includes(q)
    )
  }, [docs, searchQuery])

  const groupedDocs = useMemo(() => {
    const groups: Record<string, DocFile[]> = {}
    for (const cat of CATEGORIES) {
      groups[cat.id] = []
    }
    for (const doc of filteredDocs) {
      if (groups[doc.category]) {
        groups[doc.category].push(doc)
      } else {
        groups['getting-started'].push(doc)
      }
    }
    return groups
  }, [filteredDocs])

  const toggleCategory = useCallback((catId: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev)
      if (next.has(catId)) {
        next.delete(catId)
      } else {
        next.add(catId)
      }
      return next
    })
  }, [])

  // ─── Breadcrumbs ───────────────────────────────────────────────

  const breadcrumbs = useMemo(() => {
    const parts = [{ label: 'Docs', onClick: () => setSelectedDoc(null) }]
    if (selectedDoc) {
      const cat = CATEGORIES.find((c) => c.id === selectedDoc.category)
      if (cat) {
        parts.push({ label: cat.label, onClick: () => {} })
      }
      parts.push({ label: selectedDoc.name, onClick: () => {} })
    }
    return parts
  }, [selectedDoc])

  // ─── Render ────────────────────────────────────────────────────

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <aside
        className="flex w-64 shrink-0 flex-col overflow-hidden"
        style={{
          background: 'var(--background-surface-100)',
          borderRight: '1px solid var(--border-default)',
        }}
      >
        {/* Search */}
        <div className="p-3" style={{ borderBottom: '1px solid var(--border-default)' }}>
          <div
            className="flex items-center gap-2 rounded-md px-2.5 py-1.5"
            style={{
              background: 'var(--background-surface-200)',
              border: '1px solid var(--border-default)',
            }}
          >
            <svg
              className="h-3.5 w-3.5 shrink-0"
              style={{ color: 'var(--foreground-muted)' }}
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="7" cy="7" r="5" />
              <path d="M11 11l3 3" />
            </svg>
            <input
              type="text"
              placeholder="Search docs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-transparent text-xs outline-none"
              style={{ color: 'var(--foreground-default)' }}
            />
          </div>
        </div>

        {/* Category Tree */}
        <div className="flex-1 overflow-y-auto p-2">
          {loading ? (
            Array.from({ length: 4 }).map((_, idx) => (
              <div key={idx} className="mb-3 space-y-2 px-2">
                <div
                  className="h-3 w-24 animate-pulse rounded"
                  style={{ background: 'var(--background-surface-300)' }}
                />
                <div
                  className="h-3 w-32 animate-pulse rounded"
                  style={{ background: 'var(--background-surface-300)' }}
                />
              </div>
            ))
          ) : (
            CATEGORIES.map((cat) => {
              const catDocs = groupedDocs[cat.id] || []
              const isExpanded = expandedCategories.has(cat.id)
              return (
                <div key={cat.id} className="mb-1">
                  <button
                    onClick={() => toggleCategory(cat.id)}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors"
                    style={{ color: 'var(--foreground-lighter)' }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'var(--background-surface-200)'
                      e.currentTarget.style.color = 'var(--foreground-default)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent'
                      e.currentTarget.style.color = 'var(--foreground-lighter)'
                    }}
                  >
                    <svg
                      className="h-3 w-3 shrink-0 transition-transform"
                      style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}
                      viewBox="0 0 16 16"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    >
                      <path d="M6 4l4 4-4 4" />
                    </svg>
                    <CategoryIcon icon={cat.icon} />
                    <span className="text-xs font-medium">{cat.label}</span>
                    <span
                      className="ml-auto text-[10px]"
                      style={{ color: 'var(--foreground-muted)' }}
                    >
                      {catDocs.length}
                    </span>
                  </button>
                  {isExpanded && catDocs.length > 0 && (
                    <div className="ml-5 mt-0.5 space-y-0.5">
                      {catDocs.map((doc) => {
                        const isActive = selectedDoc?.path === doc.path
                        return (
                          <button
                            key={doc.path}
                            onClick={() => handleSelectDoc(doc)}
                            className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left transition-colors"
                            style={{
                              background: isActive ? 'var(--background-surface-300)' : 'transparent',
                              color: isActive
                                ? 'var(--foreground-default)'
                                : 'var(--foreground-lighter)',
                              fontSize: '12px',
                            }}
                            onMouseEnter={(e) => {
                              if (!isActive) {
                                e.currentTarget.style.background = 'var(--background-surface-200)'
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (!isActive) {
                                e.currentTarget.style.background = 'transparent'
                              }
                            }}
                          >
                            <svg
                              className="h-3 w-3 shrink-0"
                              style={{ color: 'var(--foreground-muted)' }}
                              viewBox="0 0 16 16"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.5"
                            >
                              <path d="M4 2h6l3 3v9a1 1 0 01-1 1H4a1 1 0 01-1-1V3a1 1 0 011-1Z" />
                              <path d="M10 2v3h3" />
                            </svg>
                            <span className="truncate">{doc.name}</span>
                          </button>
                        )
                      })}
                    </div>
                  )}
                  {isExpanded && catDocs.length === 0 && (
                    <div className="ml-7 py-1">
                      <span className="text-[11px]" style={{ color: 'var(--foreground-muted)' }}>
                        No docs found
                      </span>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>

        {/* Footer */}
        <div
          className="p-3 text-center"
          style={{ borderTop: '1px solid var(--border-default)' }}
        >
          <span className="text-[10px]" style={{ color: 'var(--foreground-muted)' }}>
            {docs.length} doc{docs.length !== 1 ? 's' : ''} found
          </span>
        </div>
      </aside>

      {/* Content Area */}
      <main className="flex-1 overflow-auto" style={{ background: 'var(--background-dash-canvas)' }}>
        {/* Breadcrumbs */}
        <div
          className="flex items-center gap-1.5 px-6 py-3"
          style={{ borderBottom: '1px solid var(--border-default)' }}
        >
          {breadcrumbs.map((crumb, idx) => (
            <span key={idx} className="flex items-center gap-1.5">
              {idx > 0 && (
                <svg
                  className="h-3 w-3"
                  style={{ color: 'var(--foreground-muted)' }}
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                >
                  <path d="M6 4l4 4-4 4" />
                </svg>
              )}
              <button
                onClick={crumb.onClick}
                className="text-xs transition-colors"
                style={{
                  color:
                    idx === breadcrumbs.length - 1
                      ? 'var(--foreground-default)'
                      : 'var(--foreground-lighter)',
                }}
              >
                {crumb.label}
              </button>
            </span>
          ))}
        </div>

        {/* Doc Content */}
        <div className="p-6">
          {contentLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 6 }).map((_, idx) => (
                <div
                  key={idx}
                  className="h-4 animate-pulse rounded"
                  style={{
                    background: 'var(--background-surface-300)',
                    width: `${60 + Math.random() * 40}%`,
                  }}
                />
              ))}
            </div>
          ) : selectedDoc ? (
            <div className="mx-auto max-w-3xl">
              <MarkdownViewer content={content} />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20">
              <svg
                className="h-12 w-12 mb-4"
                style={{ color: 'var(--foreground-muted)' }}
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M2 2h4.5c1 0 1.5.5 1.5 1.5V14L6.5 13H2V2ZM14 2H9.5C8.5 2 8 2.5 8 3.5V14l1.5-1H14V2Z" />
              </svg>
              <h2
                className="text-lg font-semibold"
                style={{ color: 'var(--foreground-default)' }}
              >
                Documentation
              </h2>
              <p className="mt-1 text-sm" style={{ color: 'var(--foreground-lighter)' }}>
                Select a document from the sidebar to get started.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

export default DocsPage
