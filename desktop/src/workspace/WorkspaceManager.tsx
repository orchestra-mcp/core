// Orchestra Desktop — Workspace Manager
//
// Full-featured workspace panel for scanning, browsing, searching,
// and organizing markdown files within a project folder.

import { invoke } from '@tauri-apps/api/core'
import { open } from '@tauri-apps/plugin-dialog'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import {
  getFileIcon as getMaterialFileIcon,
  getFolderIcon as getMaterialFolderIcon,
} from '../components/FileIcons'
import {
  loadPreferences,
  PRESET_COLORS,
  savePreferences,
  setFileColor,
  togglePin,
  type SortMode,
  type ViewMode,
  type WorkspacePreferences,
} from './workspace-store'

// ─── Types (matching Rust structs) ────────────────────────────────

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

interface SearchMatch {
  line_number: number
  line: string
  highlight_start: number
  highlight_end: number
}

interface SearchResult {
  path: string
  name: string
  relative_path: string
  file_type: string
  matches: SearchMatch[]
}

interface WorkspaceManagerProps {
  onOpenFile?: (path: string) => void
  externalWorkspacePath?: string | null
  onWorkspacePathChange?: (path: string | null) => void
}

// ─── File Type Config ─────────────────────────────────────────────

const FILE_TYPE_CONFIG: Record<string, { label: string; badgeColor: string; badgeBg: string }> = {
  agent: {
    label: 'Agent',
    badgeColor: '#a78bfa',
    badgeBg: 'rgba(167,139,250,0.12)',
  },
  skill: {
    label: 'Skill',
    badgeColor: '#facc15',
    badgeBg: 'rgba(250,204,21,0.12)',
  },
  rule: {
    label: 'Rule',
    badgeColor: '#fb923c',
    badgeBg: 'rgba(251,146,60,0.12)',
  },
  'claude-md': {
    label: 'CLAUDE',
    badgeColor: '#34d399',
    badgeBg: 'rgba(52,211,153,0.12)',
  },
  readme: {
    label: 'README',
    badgeColor: '#60a5fa',
    badgeBg: 'rgba(96,165,250,0.12)',
  },
  plan: {
    label: 'Plan',
    badgeColor: '#f472b6',
    badgeBg: 'rgba(244,114,182,0.12)',
  },
  spec: {
    label: 'Spec',
    badgeColor: '#38bdf8',
    badgeBg: 'rgba(56,189,248,0.12)',
  },
  doc: {
    label: 'Doc',
    badgeColor: '#818cf8',
    badgeBg: 'rgba(129,140,248,0.12)',
  },
  note: {
    label: 'Note',
    badgeColor: '#94a3b8',
    badgeBg: 'rgba(148,163,184,0.12)',
  },
  generic: {
    label: 'File',
    badgeColor: '#71717a',
    badgeBg: 'rgba(113,113,122,0.12)',
  },
}

// ─── SVG Icon Components (kept for Pin, Chevron, Search) ─────────

function PinIcon({ filled }: { filled?: boolean }) {
  return (
    <svg
      className="h-3 w-3 shrink-0"
      viewBox="0 0 16 16"
      fill={filled ? 'var(--brand-default)' : 'none'}
      stroke={filled ? 'var(--brand-default)' : 'currentColor'}
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 1l1 5-3 2v1h4.5L8 15l.5-6H13V8l-3-2 1-5H5Z" />
    </svg>
  )
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      className="h-3 w-3 shrink-0 transition-transform duration-150"
      style={{ transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)' }}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 4l4 4-4 4" />
    </svg>
  )
}

function SearchIcon() {
  return (
    <svg
      className="h-4 w-4 shrink-0"
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
  )
}

function getFileIcon(fileType: string, name?: string, parentPath?: string) {
  return getMaterialFileIcon(name || 'file.md', fileType, parentPath)
}

// ─── Utility ──────────────────────────────────────────────────────

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso)
    const now = new Date()
    const diff = now.getTime() - d.getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    if (days < 7) return `${days}d ago`
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  } catch {
    return ''
  }
}

// ─── Build Folder Tree ────────────────────────────────────────────

interface TreeNode {
  name: string
  fullPath: string // folder path relative to workspace root
  children: TreeNode[]
  files: WorkspaceEntry[]
}

function buildTree(entries: WorkspaceEntry[]): TreeNode {
  const root: TreeNode = { name: '', fullPath: '', children: [], files: [] }

  for (const entry of entries) {
    const parts = entry.relative_path.split('/')
    let current = root

    // Navigate/create folders
    for (let i = 0; i < parts.length - 1; i++) {
      const folderName = parts[i]
      const folderPath = parts.slice(0, i + 1).join('/')
      let child = current.children.find((c) => c.name === folderName)
      if (!child) {
        child = {
          name: folderName,
          fullPath: folderPath,
          children: [],
          files: [],
        }
        current.children.push(child)
      }
      current = child
    }

    current.files.push(entry)
  }

  // Sort children alphabetically
  function sortNode(node: TreeNode) {
    node.children.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()))
    for (const child of node.children) {
      sortNode(child)
    }
  }
  sortNode(root)

  return root
}

// ─── Filter Chips ─────────────────────────────────────────────────

const FILTER_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'agent', label: 'Agent' },
  { value: 'skill', label: 'Skill' },
  { value: 'rule', label: 'Rule' },
  { value: 'plan', label: 'Plan' },
  { value: 'doc', label: 'Doc' },
  { value: 'spec', label: 'Spec' },
  { value: 'claude-md', label: 'CLAUDE' },
  { value: 'readme', label: 'README' },
] as const

// ─── Component ────────────────────────────────────────────────────

export default function WorkspaceManager({
  onOpenFile,
  externalWorkspacePath,
  onWorkspacePathChange,
}: WorkspaceManagerProps) {
  // State
  const [entries, setEntries] = useState<WorkspaceEntry[]>([])
  const [workspacePath, setWorkspacePath] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [prefs, setPrefs] = useState<WorkspacePreferences | null>(null)
  const [selectedFile, setSelectedFile] = useState<WorkspaceEntry | null>(null)
  const [previewContent, setPreviewContent] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[] | null>(null)
  const [searching, setSearching] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('tree')
  const [sortMode, setSortMode] = useState<SortMode>('type')
  const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set(['all']))
  const [filterDropdownOpen, setFilterDropdownOpen] = useState(false)
  const [filterSearch, setFilterSearch] = useState('')
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
  const [contextMenu, setContextMenu] = useState<{
    x: number
    y: number
    entry: WorkspaceEntry
  } | null>(null)
  const [renaming, setRenaming] = useState<string | null>(null) // relative_path being renamed
  const [renameValue, setRenameValue] = useState('')
  const [colorPicker, setColorPicker] = useState<{
    x: number
    y: number
    relativePath: string
  } | null>(null)

  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const renameInputRef = useRef<HTMLInputElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const filterDropdownRef = useRef<HTMLDivElement>(null)

  // ── Sync External Workspace Path ───────────────────────────────
  useEffect(() => {
    if (externalWorkspacePath !== undefined && externalWorkspacePath !== workspacePath) {
      setWorkspacePath(externalWorkspacePath)
    }
  }, [externalWorkspacePath])

  // ── Close filter dropdown on outside click ─────────────────────
  useEffect(() => {
    if (!filterDropdownOpen) return
    function handleClick(e: MouseEvent) {
      if (filterDropdownRef.current && !filterDropdownRef.current.contains(e.target as Node)) {
        setFilterDropdownOpen(false)
        setFilterSearch('')
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [filterDropdownOpen])

  // ── Load Preferences on Mount ───────────────────────────────────
  useEffect(() => {
    loadPreferences().then((p) => {
      setPrefs(p)
      setViewMode(p.viewMode)
      setSortMode(p.sortMode)
      setExpandedFolders(new Set(p.expandedFolders))
      if (p.lastWorkspacePath) {
        setWorkspacePath(p.lastWorkspacePath)
      }
    })
  }, [])

  // ── Scan Workspace When Path Changes ────────────────────────────
  useEffect(() => {
    if (!workspacePath) return
    scanWorkspace(workspacePath)
  }, [workspacePath])

  const scanWorkspace = useCallback(async (path: string) => {
    setLoading(true)
    try {
      const result = await invoke<WorkspaceEntry[]>('scan_workspace', {
        path,
      })
      setEntries(result)
    } catch (e) {
      console.error('Scan failed:', e)
      setEntries([])
    } finally {
      setLoading(false)
    }
  }, [])

  // ── Open Folder Dialog ──────────────────────────────────────────
  const handleOpenFolder = useCallback(async () => {
    try {
      const selected = await open({ directory: true, multiple: false })
      if (selected && typeof selected === 'string') {
        setWorkspacePath(selected)
        setSelectedFile(null)
        setPreviewContent(null)
        setSearchQuery('')
        setSearchResults(null)
        onWorkspacePathChange?.(selected)
        if (prefs) {
          const updated = { ...prefs, lastWorkspacePath: selected }
          setPrefs(updated)
          savePreferences(updated)
        }
      }
    } catch (e) {
      console.error('Failed to open folder:', e)
    }
  }, [prefs, onWorkspacePathChange])

  // ── Search (debounced) ──────────────────────────────────────────
  const handleSearchChange = useCallback(
    (value: string) => {
      setSearchQuery(value)
      if (searchTimerRef.current) {
        clearTimeout(searchTimerRef.current)
      }
      if (!value.trim()) {
        setSearchResults(null)
        setSearching(false)
        return
      }
      setSearching(true)
      searchTimerRef.current = setTimeout(async () => {
        if (!workspacePath) return
        try {
          const results = await invoke<SearchResult[]>('search_workspace', {
            path: workspacePath,
            query: value.trim(),
          })
          setSearchResults(results)
        } catch {
          setSearchResults([])
        } finally {
          setSearching(false)
        }
      }, 300)
    },
    [workspacePath]
  )

  // ── File Selection & Preview ────────────────────────────────────
  const handleSelectFile = useCallback(async (entry: WorkspaceEntry) => {
    setSelectedFile(entry)
    try {
      const content = await invoke<string>('read_workspace_file', {
        path: entry.path,
      })
      setPreviewContent(content)
    } catch {
      setPreviewContent('Failed to read file.')
    }
  }, [])

  const handleOpenInEditor = useCallback(
    (entry: WorkspaceEntry) => {
      if (onOpenFile) {
        onOpenFile(entry.path)
      }
    },
    [onOpenFile]
  )

  // ── Pin / Unpin ─────────────────────────────────────────────────
  const handleTogglePin = useCallback(
    async (relativePath: string) => {
      const newPinned = await togglePin(relativePath)
      if (prefs) {
        const updated = { ...prefs, pinnedFiles: newPinned }
        setPrefs(updated)
      }
      setContextMenu(null)
    },
    [prefs]
  )

  // ── Delete ──────────────────────────────────────────────────────
  const handleDelete = useCallback(
    async (entry: WorkspaceEntry) => {
      setContextMenu(null)
      try {
        await invoke('delete_workspace_file', { path: entry.path })
        setEntries((prev) => prev.filter((e) => e.path !== entry.path))
        if (selectedFile?.path === entry.path) {
          setSelectedFile(null)
          setPreviewContent(null)
        }
      } catch (e) {
        console.error('Delete failed:', e)
      }
    },
    [selectedFile]
  )

  // ── Rename ──────────────────────────────────────────────────────
  const startRename = useCallback((entry: WorkspaceEntry) => {
    setContextMenu(null)
    setRenaming(entry.relative_path)
    // Get filename with extension
    const filename = entry.path.split('/').pop() || entry.name
    setRenameValue(filename)
    setTimeout(() => renameInputRef.current?.select(), 50)
  }, [])

  const commitRename = useCallback(
    async (entry: WorkspaceEntry) => {
      if (!renameValue.trim() || !workspacePath) {
        setRenaming(null)
        return
      }
      const dir = entry.path.substring(0, entry.path.lastIndexOf('/'))
      const newPath = `${dir}/${renameValue.trim()}`
      if (newPath === entry.path) {
        setRenaming(null)
        return
      }
      try {
        await invoke('rename_workspace_file', {
          oldPath: entry.path,
          newPath,
        })
        // Rescan
        scanWorkspace(workspacePath)
      } catch (e) {
        console.error('Rename failed:', e)
      }
      setRenaming(null)
    },
    [renameValue, workspacePath, scanWorkspace]
  )

  // ── Color Picker ────────────────────────────────────────────────
  const handleSetColor = useCallback(
    async (relativePath: string, color: string | undefined) => {
      await setFileColor(relativePath, color)
      if (prefs) {
        const customizations = { ...prefs.fileCustomizations }
        if (color) {
          customizations[relativePath] = {
            ...customizations[relativePath],
            color,
          }
        } else if (customizations[relativePath]) {
          delete customizations[relativePath].color
        }
        const updated = { ...prefs, fileCustomizations: customizations }
        setPrefs(updated)
      }
      setColorPicker(null)
      setContextMenu(null)
    },
    [prefs]
  )

  // ── Copy Path ───────────────────────────────────────────────────
  const handleCopyPath = useCallback((entry: WorkspaceEntry) => {
    navigator.clipboard.writeText(entry.path).catch(() => {})
    setContextMenu(null)
  }, [])

  // ── Copy Content ────────────────────────────────────────────────
  const handleCopyContent = useCallback(async (entry: WorkspaceEntry) => {
    try {
      const content = await invoke<string>('read_workspace_file', {
        path: entry.path,
      })
      await navigator.clipboard.writeText(content)
    } catch {}
    setContextMenu(null)
  }, [])

  // ── Toggle Folder ───────────────────────────────────────────────
  const toggleFolder = useCallback(
    (folderPath: string) => {
      setExpandedFolders((prev) => {
        const next = new Set(prev)
        if (next.has(folderPath)) {
          next.delete(folderPath)
        } else {
          next.add(folderPath)
        }
        // Persist
        if (prefs) {
          const updated = {
            ...prefs,
            expandedFolders: Array.from(next),
          }
          setPrefs(updated)
          savePreferences(updated)
        }
        return next
      })
    },
    [prefs]
  )

  // ── View/Sort Changes ──────────────────────────────────────────
  const handleViewChange = useCallback(
    (mode: ViewMode) => {
      setViewMode(mode)
      if (prefs) {
        const updated = { ...prefs, viewMode: mode }
        setPrefs(updated)
        savePreferences(updated)
      }
    },
    [prefs]
  )

  const handleSortChange = useCallback(
    (mode: SortMode) => {
      setSortMode(mode)
      if (prefs) {
        const updated = { ...prefs, sortMode: mode }
        setPrefs(updated)
        savePreferences(updated)
      }
    },
    [prefs]
  )

  // ── Close context menu on outside click ─────────────────────────
  useEffect(() => {
    if (!contextMenu && !colorPicker) return
    const handler = () => {
      setContextMenu(null)
      setColorPicker(null)
    }
    window.addEventListener('click', handler)
    return () => window.removeEventListener('click', handler)
  }, [contextMenu, colorPicker])

  // ── Filtered + Sorted Entries ───────────────────────────────────
  const filteredEntries = useMemo(() => {
    let list = entries
    if (!activeFilters.has('all') && activeFilters.size > 0) {
      list = list.filter((e) => activeFilters.has(e.file_type))
    }
    // Sort
    const sorted = [...list]
    switch (sortMode) {
      case 'name':
        sorted.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()))
        break
      case 'date':
        sorted.sort((a, b) => new Date(b.modified).getTime() - new Date(a.modified).getTime())
        break
      case 'size':
        sorted.sort((a, b) => b.size - a.size)
        break
      case 'type':
      default:
        // Already sorted by type from Rust
        break
    }
    return sorted
  }, [entries, activeFilters, sortMode])

  // ── Pinned Entries ──────────────────────────────────────────────
  const pinnedEntries = useMemo(() => {
    if (!prefs) return []
    return filteredEntries.filter((e) => prefs.pinnedFiles.includes(e.relative_path))
  }, [filteredEntries, prefs])

  const unpinnedEntries = useMemo(() => {
    if (!prefs) return filteredEntries
    return filteredEntries.filter((e) => !prefs.pinnedFiles.includes(e.relative_path))
  }, [filteredEntries, prefs])

  const tree = useMemo(() => buildTree(unpinnedEntries), [unpinnedEntries])

  // ── Context Menu Handler ────────────────────────────────────────
  const handleContextMenu = useCallback((e: React.MouseEvent, entry: WorkspaceEntry) => {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({ x: e.clientX, y: e.clientY, entry })
    setColorPicker(null)
  }, [])

  // ── Keyboard: Escape to clear search ────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (searchQuery) {
          setSearchQuery('')
          setSearchResults(null)
        }
        if (contextMenu) setContextMenu(null)
        if (colorPicker) setColorPicker(null)
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault()
        searchInputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [searchQuery, contextMenu, colorPicker])

  // ── Render: File Item ───────────────────────────────────────────
  const renderFileItem = (entry: WorkspaceEntry, indent: number = 0) => {
    const isPinned = prefs?.pinnedFiles.includes(entry.relative_path)
    const customColor = prefs?.fileCustomizations?.[entry.relative_path]?.color
    const isSelected = selectedFile?.path === entry.path
    const isRenaming = renaming === entry.relative_path
    const config = FILE_TYPE_CONFIG[entry.file_type] || FILE_TYPE_CONFIG.generic

    return (
      <div
        key={entry.path}
        className="group flex items-center gap-2 rounded-md px-2 py-1.5 cursor-pointer transition-colors duration-100"
        style={{
          paddingLeft: `${indent * 16 + 8}px`,
          background: isSelected ? 'var(--background-selection)' : 'transparent',
          borderLeft: customColor ? `2px solid ${customColor}` : '2px solid transparent',
        }}
        onClick={() => handleSelectFile(entry)}
        onDoubleClick={() => handleOpenInEditor(entry)}
        onContextMenu={(e) => handleContextMenu(e, entry)}
        onMouseEnter={(e) => {
          if (!isSelected) {
            ;(e.currentTarget as HTMLElement).style.background = 'var(--background-surface-100)'
          }
        }}
        onMouseLeave={(e) => {
          if (!isSelected) {
            ;(e.currentTarget as HTMLElement).style.background = 'transparent'
          }
        }}
      >
        {/* Icon */}
        {getFileIcon(entry.file_type, entry.name, entry.relative_path)}

        {/* Name or rename input */}
        {isRenaming ? (
          <input
            ref={renameInputRef}
            className="flex-1 rounded px-1 py-0.5 text-xs outline-none"
            style={{
              background: 'var(--background-control)',
              color: 'var(--foreground-default)',
              border: '1px solid var(--brand-default)',
            }}
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onBlur={() => commitRename(entry)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitRename(entry)
              if (e.key === 'Escape') setRenaming(null)
            }}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span
            className="flex-1 truncate text-xs"
            style={{
              color: isSelected ? 'var(--foreground-default)' : 'var(--foreground-light)',
            }}
            title={entry.relative_path}
          >
            {entry.title || entry.name}
          </span>
        )}

        {/* Pin indicator */}
        {isPinned && (
          <span className="shrink-0 opacity-60">
            <PinIcon filled />
          </span>
        )}

        {/* Type badge */}
        <span
          className="shrink-0 rounded px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-opacity"
          style={{
            background: config.badgeBg,
            color: config.badgeColor,
          }}
        >
          {config.label}
        </span>

        {/* Modified date (visible on hover) */}
        <span
          className="shrink-0 text-[10px] opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ color: 'var(--foreground-muted)' }}
        >
          {formatDate(entry.modified)}
        </span>
      </div>
    )
  }

  // ── Render: Tree Folder ─────────────────────────────────────────
  const renderTreeNode = (node: TreeNode, depth: number = 0) => {
    if (!node.name && node.children.length === 0 && node.files.length === 0) return null

    const isExpanded = expandedFolders.has(node.fullPath)
    const hasContent = node.children.length > 0 || node.files.length > 0

    return (
      <div key={node.fullPath || 'root'}>
        {/* Folder header (skip root) */}
        {node.name && (
          <div
            className="flex items-center gap-1.5 rounded-md px-2 py-1 cursor-pointer transition-colors duration-100"
            style={{ paddingLeft: `${depth * 16 + 4}px` }}
            onClick={() => toggleFolder(node.fullPath)}
            onMouseEnter={(e) => {
              ;(e.currentTarget as HTMLElement).style.background = 'var(--background-surface-100)'
            }}
            onMouseLeave={(e) => {
              ;(e.currentTarget as HTMLElement).style.background = 'transparent'
            }}
          >
            <span style={{ color: 'var(--foreground-muted)' }}>
              <ChevronIcon expanded={isExpanded} />
            </span>
            {getMaterialFolderIcon(node.name, isExpanded)}
            <span className="text-xs font-medium" style={{ color: 'var(--foreground-lighter)' }}>
              {node.name}
            </span>
            <span className="ml-auto text-[10px]" style={{ color: 'var(--foreground-muted)' }}>
              {node.files.length + node.children.reduce((sum, c) => sum + countFiles(c), 0)}
            </span>
          </div>
        )}

        {/* Children (folders + files) */}
        {(isExpanded || !node.name) && hasContent && (
          <div
            className={node.name ? 'overflow-hidden' : ''}
            style={{
              animation: node.name ? 'slideDown 150ms ease-out' : undefined,
            }}
          >
            {node.children.map((child) => renderTreeNode(child, node.name ? depth + 1 : depth))}
            {node.files.map((file) => renderFileItem(file, node.name ? depth + 1 : depth))}
          </div>
        )}
      </div>
    )
  }

  // ── Render: List View ───────────────────────────────────────────
  const renderListView = () => (
    <div className="space-y-px">
      {filteredEntries.map((entry) => {
        const config = FILE_TYPE_CONFIG[entry.file_type] || FILE_TYPE_CONFIG.generic
        const isSelected = selectedFile?.path === entry.path

        return (
          <div
            key={entry.path}
            className="group flex items-center gap-3 rounded-md px-3 py-2 cursor-pointer transition-colors"
            style={{
              background: isSelected ? 'var(--background-selection)' : 'transparent',
            }}
            onClick={() => handleSelectFile(entry)}
            onDoubleClick={() => handleOpenInEditor(entry)}
            onContextMenu={(e) => handleContextMenu(e, entry)}
            onMouseEnter={(e) => {
              if (!isSelected)
                (e.currentTarget as HTMLElement).style.background = 'var(--background-surface-100)'
            }}
            onMouseLeave={(e) => {
              if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'transparent'
            }}
          >
            {getFileIcon(entry.file_type, entry.name, entry.relative_path)}
            <div className="flex-1 min-w-0">
              <div
                className="text-xs font-medium truncate"
                style={{ color: 'var(--foreground-default)' }}
              >
                {entry.title || entry.name}
              </div>
              <div className="text-[10px] truncate" style={{ color: 'var(--foreground-muted)' }}>
                {entry.relative_path}
              </div>
            </div>
            <span
              className="shrink-0 rounded px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider"
              style={{ background: config.badgeBg, color: config.badgeColor }}
            >
              {config.label}
            </span>
            <span className="shrink-0 text-[10px]" style={{ color: 'var(--foreground-muted)' }}>
              {formatFileSize(entry.size)}
            </span>
            <span className="shrink-0 text-[10px]" style={{ color: 'var(--foreground-muted)' }}>
              {formatDate(entry.modified)}
            </span>
          </div>
        )
      })}
    </div>
  )

  // ── Render: Grid View ───────────────────────────────────────────
  const renderGridView = () => (
    <div
      className="grid gap-2 p-2"
      style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}
    >
      {filteredEntries.map((entry) => {
        const config = FILE_TYPE_CONFIG[entry.file_type] || FILE_TYPE_CONFIG.generic
        const isSelected = selectedFile?.path === entry.path

        return (
          <div
            key={entry.path}
            className="group flex flex-col rounded-lg p-3 cursor-pointer transition-colors"
            style={{
              background: isSelected
                ? 'var(--background-selection)'
                : 'var(--background-surface-75)',
              border: isSelected
                ? '1px solid var(--brand-default)'
                : '1px solid var(--border-default)',
            }}
            onClick={() => handleSelectFile(entry)}
            onDoubleClick={() => handleOpenInEditor(entry)}
            onContextMenu={(e) => handleContextMenu(e, entry)}
            onMouseEnter={(e) => {
              if (!isSelected) {
                ;(e.currentTarget as HTMLElement).style.borderColor = 'var(--border-strong)'
                ;(e.currentTarget as HTMLElement).style.background = 'var(--background-surface-100)'
              }
            }}
            onMouseLeave={(e) => {
              if (!isSelected) {
                ;(e.currentTarget as HTMLElement).style.borderColor = 'var(--border-default)'
                ;(e.currentTarget as HTMLElement).style.background = 'var(--background-surface-75)'
              }
            }}
          >
            <div className="flex items-center gap-2 mb-2">
              {getFileIcon(entry.file_type, entry.name, entry.relative_path)}
              <span
                className="rounded px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider"
                style={{
                  background: config.badgeBg,
                  color: config.badgeColor,
                }}
              >
                {config.label}
              </span>
            </div>
            <div
              className="text-xs font-medium truncate"
              style={{ color: 'var(--foreground-default)' }}
            >
              {entry.title || entry.name}
            </div>
            <div
              className="text-[10px] truncate mt-0.5"
              style={{ color: 'var(--foreground-muted)' }}
            >
              {entry.folder || 'root'}
            </div>
            <div
              className="text-[10px] mt-2 line-clamp-2"
              style={{
                color: 'var(--foreground-lighter)',
                lineHeight: '1.4',
              }}
            >
              {entry.preview.slice(0, 80)}
              {entry.preview.length > 80 ? '...' : ''}
            </div>
          </div>
        )
      })}
    </div>
  )

  // ── Render: Search Results ──────────────────────────────────────
  const renderSearchResults = () => {
    if (!searchResults) return null
    if (searchResults.length === 0) {
      return (
        <div
          className="flex flex-col items-center justify-center py-12"
          style={{ color: 'var(--foreground-muted)' }}
        >
          <SearchIcon />
          <p className="mt-2 text-xs">No results for "{searchQuery}"</p>
        </div>
      )
    }
    return (
      <div className="space-y-1 p-1">
        {searchResults.map((result) => {
          const config = FILE_TYPE_CONFIG[result.file_type] || FILE_TYPE_CONFIG.generic
          return (
            <div key={result.path}>
              <div
                className="flex items-center gap-2 rounded-md px-2 py-1.5 cursor-pointer transition-colors"
                onClick={() => {
                  const entry = entries.find((e) => e.path === result.path)
                  if (entry) handleSelectFile(entry)
                }}
                onDoubleClick={() => onOpenFile?.(result.path)}
                onMouseEnter={(e) => {
                  ;(e.currentTarget as HTMLElement).style.background =
                    'var(--background-surface-100)'
                }}
                onMouseLeave={(e) => {
                  ;(e.currentTarget as HTMLElement).style.background = 'transparent'
                }}
              >
                {getFileIcon(result.file_type, result.name, result.relative_path)}
                <span
                  className="flex-1 text-xs font-medium truncate"
                  style={{ color: 'var(--foreground-default)' }}
                >
                  {result.name}
                </span>
                <span
                  className="shrink-0 rounded px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider"
                  style={{
                    background: config.badgeBg,
                    color: config.badgeColor,
                  }}
                >
                  {config.label}
                </span>
              </div>
              {/* Match snippets */}
              <div className="ml-7 space-y-0.5 mb-1">
                {result.matches.slice(0, 3).map((m, i) => (
                  <div
                    key={i}
                    className="text-[10px] truncate rounded px-2 py-0.5"
                    style={{
                      color: 'var(--foreground-lighter)',
                      background: 'var(--background-surface-75)',
                    }}
                  >
                    {m.line_number > 0 && (
                      <span style={{ color: 'var(--foreground-muted)' }}>L{m.line_number}: </span>
                    )}
                    {m.line.slice(0, m.highlight_start)}
                    <span
                      style={{
                        background: 'rgba(169,0,255,0.2)',
                        color: 'var(--brand-600)',
                        borderRadius: '2px',
                        padding: '0 1px',
                      }}
                    >
                      {m.line.slice(m.highlight_start, m.highlight_end)}
                    </span>
                    {m.line.slice(m.highlight_end, m.highlight_end + 60)}
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  // ── Render: Preview Panel ───────────────────────────────────────
  const renderPreview = () => {
    if (!selectedFile) {
      return (
        <div
          className="flex flex-col items-center justify-center h-full"
          style={{ color: 'var(--foreground-muted)' }}
        >
          <svg
            className="h-12 w-12 mb-3 opacity-30"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
          >
            <path d="M4 1h6l4 4v9a1 1 0 01-1 1H4a1 1 0 01-1-1V2a1 1 0 011-1Z" />
            <path d="M10 1v4h4" />
          </svg>
          <p className="text-xs">Select a file to preview</p>
          <p className="text-[10px] mt-1 opacity-60">Double-click to open in editor</p>
        </div>
      )
    }

    const config = FILE_TYPE_CONFIG[selectedFile.file_type] || FILE_TYPE_CONFIG.generic

    return (
      <div className="flex flex-col h-full">
        {/* Preview header */}
        <div
          className="flex items-center gap-2 px-4 py-2.5 shrink-0"
          style={{
            borderBottom: '1px solid var(--border-default)',
            background: 'var(--background-surface-75)',
          }}
        >
          {getFileIcon(selectedFile.file_type, selectedFile.name, selectedFile.relative_path)}
          <span
            className="text-sm font-medium truncate"
            style={{ color: 'var(--foreground-default)' }}
          >
            {selectedFile.title || selectedFile.name}
          </span>
          <span
            className="rounded px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider"
            style={{ background: config.badgeBg, color: config.badgeColor }}
          >
            {config.label}
          </span>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-[10px]" style={{ color: 'var(--foreground-muted)' }}>
              {formatFileSize(selectedFile.size)}
            </span>
            <button
              className="rounded px-2 py-1 text-[10px] font-medium transition-colors"
              style={{
                background: 'var(--brand-400)',
                color: 'var(--brand-default)',
                border: '1px solid var(--brand-500)',
              }}
              onClick={() => handleOpenInEditor(selectedFile)}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--brand-500)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'var(--brand-400)'
              }}
            >
              Open
            </button>
          </div>
        </div>

        {/* File path breadcrumb */}
        <div
          className="px-4 py-1.5 text-[10px] shrink-0"
          style={{
            color: 'var(--foreground-muted)',
            borderBottom: '1px solid var(--border-muted)',
          }}
        >
          {selectedFile.relative_path}
        </div>

        {/* Content */}
        <div
          className="flex-1 overflow-auto p-4"
          style={{
            fontFamily: 'ui-monospace, "SF Mono", "Cascadia Code", monospace',
            fontSize: '12px',
            lineHeight: '1.7',
            color: 'var(--foreground-light)',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        >
          {previewContent ?? 'Loading...'}
        </div>
      </div>
    )
  }

  // ── Render: Empty State ─────────────────────────────────────────
  if (!workspacePath) {
    return (
      <div
        className="flex flex-col items-center justify-center h-full gap-4"
        style={{ color: 'var(--foreground-muted)' }}
      >
        <svg
          className="h-16 w-16 opacity-20"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="0.8"
        >
          <path d="M2 3h3l1 1h7a1 1 0 011 1v7a1 1 0 01-1 1H3a1 1 0 01-1-1V3Z" />
        </svg>
        <div className="text-center">
          <p className="text-sm font-medium" style={{ color: 'var(--foreground-light)' }}>
            No workspace open
          </p>
          <p className="text-xs mt-1">Open a project folder to browse its markdown files</p>
        </div>
        <button
          className="rounded-lg px-4 py-2 text-sm font-medium transition-colors"
          style={{
            background: 'var(--brand-default)',
            color: '#fff',
          }}
          onClick={handleOpenFolder}
          onMouseEnter={(e) => {
            e.currentTarget.style.filter = 'brightness(1.15)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.filter = 'brightness(1)'
          }}
        >
          Open Folder
        </button>
      </div>
    )
  }

  // ── Main Layout ─────────────────────────────────────────────────
  return (
    <div className="flex h-full overflow-hidden">
      {/* Left Panel — File Tree + Search */}
      <div
        className="flex flex-col shrink-0 overflow-hidden"
        style={{
          width: '320px',
          borderRight: '1px solid var(--border-default)',
          background: 'var(--background-dash-sidebar)',
        }}
      >
        {/* Toolbar */}
        <div
          className="flex items-center gap-1.5 px-2 py-2 shrink-0"
          style={{ borderBottom: '1px solid var(--border-default)' }}
        >
          {/* Open Folder */}
          <button
            className="flex items-center gap-1.5 rounded px-2 py-1 text-[10px] font-medium transition-colors"
            style={{
              background: 'var(--background-surface-100)',
              color: 'var(--foreground-lighter)',
              border: '1px solid var(--border-default)',
            }}
            onClick={handleOpenFolder}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--border-strong)'
              e.currentTarget.style.color = 'var(--foreground-light)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--border-default)'
              e.currentTarget.style.color = 'var(--foreground-lighter)'
            }}
            title="Open folder"
          >
            <svg
              className="h-3.5 w-3.5"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M2 3h3l1 1h7a1 1 0 011 1v7a1 1 0 01-1 1H3a1 1 0 01-1-1V3Z" />
              <path d="M8 7v4M6 9h4" />
            </svg>
            Open
          </button>

          {/* Refresh */}
          <button
            className="flex items-center justify-center rounded p-1 transition-colors"
            style={{ color: 'var(--foreground-muted)' }}
            onClick={() => workspacePath && scanWorkspace(workspacePath)}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--background-surface-100)'
              e.currentTarget.style.color = 'var(--foreground-light)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.color = 'var(--foreground-muted)'
            }}
            title="Refresh"
          >
            <svg
              className="h-3.5 w-3.5"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M2 8a6 6 0 0110.5-4M14 2v4h-4" />
              <path d="M14 8a6 6 0 01-10.5 4M2 14v-4h4" />
            </svg>
          </button>

          <div className="flex-1" />

          {/* View mode toggle */}
          {(['tree', 'list', 'grid'] as const).map((mode) => (
            <button
              key={mode}
              className="flex items-center justify-center rounded p-1 transition-colors"
              style={{
                background: viewMode === mode ? 'var(--background-surface-200)' : 'transparent',
                color: viewMode === mode ? 'var(--foreground-default)' : 'var(--foreground-muted)',
              }}
              onClick={() => handleViewChange(mode)}
              onMouseEnter={(e) => {
                if (viewMode !== mode) {
                  e.currentTarget.style.background = 'var(--background-surface-100)'
                }
              }}
              onMouseLeave={(e) => {
                if (viewMode !== mode) {
                  e.currentTarget.style.background = 'transparent'
                }
              }}
              title={`${mode.charAt(0).toUpperCase() + mode.slice(1)} view`}
            >
              {mode === 'tree' && (
                <svg
                  className="h-3.5 w-3.5"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M4 3h9M7 8h6M7 13h6M2 3h0M4 8h0M4 13h0" />
                </svg>
              )}
              {mode === 'list' && (
                <svg
                  className="h-3.5 w-3.5"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M5 3h9M5 8h9M5 13h9M2 3h0M2 8h0M2 13h0" />
                </svg>
              )}
              {mode === 'grid' && (
                <svg
                  className="h-3.5 w-3.5"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="1" y="1" width="6" height="6" rx="1" />
                  <rect x="9" y="1" width="6" height="6" rx="1" />
                  <rect x="1" y="9" width="6" height="6" rx="1" />
                  <rect x="9" y="9" width="6" height="6" rx="1" />
                </svg>
              )}
            </button>
          ))}

          {/* Sort dropdown */}
          <select
            className="rounded px-1 py-0.5 text-[10px]"
            style={{
              background: 'var(--background-surface-100)',
              color: 'var(--foreground-lighter)',
              border: '1px solid var(--border-default)',
              outline: 'none',
            }}
            value={sortMode}
            onChange={(e) => handleSortChange(e.target.value as SortMode)}
          >
            <option value="type">By Type</option>
            <option value="name">By Name</option>
            <option value="date">By Date</option>
            <option value="size">By Size</option>
          </select>
        </div>

        {/* Search Bar */}
        <div
          className="px-2 py-2 shrink-0"
          style={{ borderBottom: '1px solid var(--border-default)' }}
        >
          <div
            className="flex items-center gap-2 rounded-md px-2 py-1.5"
            style={{
              background: 'var(--background-control)',
              border: '1px solid var(--border-default)',
            }}
          >
            <span style={{ color: 'var(--foreground-muted)' }}>
              <SearchIcon />
            </span>
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search files... (Cmd+F)"
              className="flex-1 bg-transparent text-xs outline-none"
              style={{ color: 'var(--foreground-default)' }}
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
            />
            {searchQuery && (
              <button
                className="text-xs"
                style={{ color: 'var(--foreground-muted)' }}
                onClick={() => {
                  setSearchQuery('')
                  setSearchResults(null)
                }}
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
            {searching && (
              <svg
                className="h-3 w-3 animate-spin"
                viewBox="0 0 16 16"
                fill="none"
                stroke="var(--brand-default)"
                strokeWidth="2"
              >
                <circle cx="8" cy="8" r="6" className="opacity-25" />
                <path d="M8 2a6 6 0 014.24 1.76" />
              </svg>
            )}
          </div>
        </div>

        {/* Filter Dropdown + Chips */}
        <div
          className="flex items-center gap-1.5 px-2 py-1.5 shrink-0 flex-wrap"
          style={{ borderBottom: '1px solid var(--border-default)' }}
        >
          {/* Filter dropdown button */}
          <div className="relative" ref={filterDropdownRef}>
            <button
              className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[10px] font-medium transition-colors"
              style={{
                background: filterDropdownOpen
                  ? 'var(--background-surface-200)'
                  : 'var(--background-surface-100)',
                color: filterDropdownOpen
                  ? 'var(--foreground-default)'
                  : 'var(--foreground-lighter)',
                border: '1px solid var(--border-default)',
              }}
              onClick={() => {
                setFilterDropdownOpen(!filterDropdownOpen)
                setFilterSearch('')
              }}
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
                <path d="M1 2h14L10 8v5l-4 2V8L1 2Z" />
              </svg>
              Filter
              {!activeFilters.has('all') && activeFilters.size > 0 && (
                <span
                  className="rounded-full px-1.5 py-0 text-[9px]"
                  style={{ background: 'var(--brand-400)', color: 'var(--brand-default)' }}
                >
                  {activeFilters.size}
                </span>
              )}
              <svg
                className="h-2.5 w-2.5"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <path d="M4 6l4 4 4-4" />
              </svg>
            </button>

            {filterDropdownOpen && (
              <div
                className="absolute left-0 top-full mt-1 w-52 rounded-lg py-1 shadow-xl"
                style={{
                  background: 'var(--background-overlay-default)',
                  border: '1px solid var(--border-overlay)',
                  zIndex: 100,
                }}
              >
                {/* Search input */}
                <div className="px-2 py-1.5">
                  <input
                    className="w-full rounded px-2 py-1 text-xs outline-none"
                    style={{
                      background: 'var(--background-control)',
                      border: '1px solid var(--border-default)',
                      color: 'var(--foreground-default)',
                    }}
                    placeholder="Search filters..."
                    value={filterSearch}
                    onChange={(e) => setFilterSearch(e.target.value)}
                    autoFocus
                  />
                </div>
                {/* Filter options */}
                {FILTER_OPTIONS.filter((opt) =>
                  opt.label.toLowerCase().includes(filterSearch.toLowerCase())
                ).map((opt) => {
                  const isChecked =
                    opt.value === 'all' ? activeFilters.has('all') : activeFilters.has(opt.value)
                  return (
                    <button
                      key={opt.value}
                      className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors"
                      style={{ color: 'var(--foreground-light)' }}
                      onClick={() => {
                        setActiveFilters((prev) => {
                          const next = new Set(prev)
                          if (opt.value === 'all') {
                            return new Set(['all'])
                          }
                          next.delete('all')
                          if (next.has(opt.value)) {
                            next.delete(opt.value)
                          } else {
                            next.add(opt.value)
                          }
                          if (next.size === 0) return new Set(['all'])
                          return next
                        })
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'var(--background-overlay-hover)'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent'
                      }}
                    >
                      <div
                        className="flex h-3.5 w-3.5 items-center justify-center rounded border"
                        style={{
                          borderColor: isChecked ? 'var(--brand-default)' : 'var(--border-strong)',
                          background: isChecked ? 'var(--brand-default)' : 'transparent',
                        }}
                      >
                        {isChecked && (
                          <svg
                            className="h-2.5 w-2.5"
                            viewBox="0 0 16 16"
                            fill="none"
                            stroke="white"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M3 8l4 4 6-8" />
                          </svg>
                        )}
                      </div>
                      {opt.label}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Active filter chips (pill-shaped, removable) */}
          {!activeFilters.has('all') &&
            Array.from(activeFilters).map((f) => {
              const opt = FILTER_OPTIONS.find((o) => o.value === f)
              if (!opt) return null
              return (
                <span
                  key={f}
                  className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
                  style={{
                    background: 'var(--brand-400)',
                    color: 'var(--brand-default)',
                    border: '1px solid var(--brand-500)',
                  }}
                >
                  {opt.label}
                  <button
                    className="flex items-center justify-center"
                    onClick={() => {
                      setActiveFilters((prev) => {
                        const next = new Set(prev)
                        next.delete(f)
                        if (next.size === 0) return new Set(['all'])
                        return next
                      })
                    }}
                  >
                    <svg
                      className="h-2.5 w-2.5"
                      viewBox="0 0 16 16"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                    >
                      <path d="M4 4l8 8M12 4l-8 8" />
                    </svg>
                  </button>
                </span>
              )
            })}
        </div>

        {/* File Count */}
        <div
          className="px-3 py-1 text-[10px] shrink-0"
          style={{
            color: 'var(--foreground-muted)',
            borderBottom: '1px solid var(--border-muted)',
          }}
        >
          {filteredEntries.length} file{filteredEntries.length !== 1 ? 's' : ''}
          {!activeFilters.has('all') &&
            activeFilters.size > 0 &&
            ` (${Array.from(activeFilters).join(', ')})`}
          {loading && ' — scanning...'}
        </div>

        {/* File tree / list / search results */}
        <div className="flex-1 overflow-auto">
          {searchResults ? (
            renderSearchResults()
          ) : loading ? (
            <div
              className="flex items-center justify-center py-12"
              style={{ color: 'var(--foreground-muted)' }}
            >
              <svg
                className="h-5 w-5 animate-spin"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="8" cy="8" r="6" className="opacity-25" />
                <path d="M8 2a6 6 0 014.24 1.76" />
              </svg>
            </div>
          ) : (
            <>
              {/* Pinned files section */}
              {pinnedEntries.length > 0 && (
                <div>
                  <div
                    className="px-3 py-1.5 text-[10px] font-medium uppercase tracking-wider"
                    style={{
                      color: 'var(--foreground-muted)',
                      borderBottom: '1px solid var(--border-muted)',
                    }}
                  >
                    <span className="flex items-center gap-1.5">
                      <PinIcon filled />
                      Pinned
                    </span>
                  </div>
                  {pinnedEntries.map((e) => renderFileItem(e, 0))}
                  <div
                    style={{
                      borderBottom: '1px solid var(--border-muted)',
                      margin: '4px 0',
                    }}
                  />
                </div>
              )}

              {/* Main file tree / list / grid */}
              {viewMode === 'tree' && renderTreeNode(tree)}
              {viewMode === 'list' && renderListView()}
              {viewMode === 'grid' && renderGridView()}

              {filteredEntries.length === 0 && !loading && (
                <div
                  className="flex flex-col items-center justify-center py-12"
                  style={{ color: 'var(--foreground-muted)' }}
                >
                  <p className="text-xs">No markdown files found</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Right Panel — Preview */}
      <div
        className="flex-1 overflow-hidden"
        style={{ background: 'var(--background-dash-canvas)' }}
      >
        {renderPreview()}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="fixed rounded-lg py-1 shadow-xl"
          style={{
            left: contextMenu.x,
            top: contextMenu.y,
            background: 'var(--background-overlay-default)',
            border: '1px solid var(--border-overlay)',
            zIndex: 10000,
            minWidth: '180px',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <CtxMenuItem
            label="Open in Editor"
            onClick={() => {
              handleOpenInEditor(contextMenu.entry)
              setContextMenu(null)
            }}
          />
          <CtxMenuItem
            label={prefs?.pinnedFiles.includes(contextMenu.entry.relative_path) ? 'Unpin' : 'Pin'}
            onClick={() => handleTogglePin(contextMenu.entry.relative_path)}
          />
          <CtxMenuItem label="Rename" onClick={() => startRename(contextMenu.entry)} />
          <CtxMenuSeparator />
          <CtxMenuItem
            label="Set Color"
            onClick={(e) => {
              e.stopPropagation()
              setColorPicker({
                x: contextMenu.x + 180,
                y: contextMenu.y,
                relativePath: contextMenu.entry.relative_path,
              })
            }}
          />
          <CtxMenuSeparator />
          <CtxMenuItem label="Copy Path" onClick={() => handleCopyPath(contextMenu.entry)} />
          <CtxMenuItem label="Copy Content" onClick={() => handleCopyContent(contextMenu.entry)} />
          <CtxMenuSeparator />
          <CtxMenuItem label="Delete" danger onClick={() => handleDelete(contextMenu.entry)} />
        </div>
      )}

      {/* Color Picker Popover */}
      {colorPicker && (
        <div
          className="fixed rounded-lg p-2 shadow-xl"
          style={{
            left: colorPicker.x,
            top: colorPicker.y,
            background: 'var(--background-overlay-default)',
            border: '1px solid var(--border-overlay)',
            zIndex: 10001,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="grid grid-cols-4 gap-1.5">
            {PRESET_COLORS.map((color) => (
              <button
                key={color}
                className="h-6 w-6 rounded-full border-2 transition-transform hover:scale-110"
                style={{
                  background: color,
                  borderColor:
                    prefs?.fileCustomizations?.[colorPicker.relativePath]?.color === color
                      ? '#fff'
                      : 'transparent',
                }}
                onClick={() => handleSetColor(colorPicker.relativePath, color)}
              />
            ))}
          </div>
          <button
            className="mt-2 w-full rounded px-2 py-1 text-[10px] transition-colors"
            style={{
              background: 'var(--background-surface-200)',
              color: 'var(--foreground-lighter)',
            }}
            onClick={() => handleSetColor(colorPicker.relativePath, undefined)}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--foreground-default)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--foreground-lighter)'
            }}
          >
            Clear Color
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Context Menu Helpers ─────────────────────────────────────────

function CtxMenuItem({
  label,
  danger,
  onClick,
}: {
  label: string
  danger?: boolean
  onClick: (e: React.MouseEvent) => void
}) {
  return (
    <button
      className="flex w-full items-center px-3 py-1.5 text-left text-xs transition-colors"
      style={{
        color: danger ? 'var(--destructive-default)' : 'var(--foreground-light)',
      }}
      onClick={onClick}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'var(--background-overlay-hover)'
        if (!danger) e.currentTarget.style.color = 'var(--foreground-default)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent'
        e.currentTarget.style.color = danger
          ? 'var(--destructive-default)'
          : 'var(--foreground-light)'
      }}
    >
      {label}
    </button>
  )
}

function CtxMenuSeparator() {
  return <div className="my-1" style={{ borderTop: '1px solid var(--border-default)' }} />
}

// ─── Helper: count files in tree ──────────────────────────────────

function countFiles(node: TreeNode): number {
  return node.files.length + node.children.reduce((sum, c) => sum + countFiles(c), 0)
}
