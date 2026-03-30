import { invoke } from '@tauri-apps/api/core'
import { useCallback, useEffect, useMemo, useRef, useState, type FC } from 'react'

import { loadAllActions } from '../smart-actions/smart-action-store'
import { executeAction } from '../smart-actions/SmartActionEngine'
import type { ActionRunResult, SmartAction } from '../smart-actions/types'

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface CommandAction {
  id: string
  label: string
  category: string
  icon: React.ReactNode
  shortcut?: string
  description?: string
  onSelect: () => void
}

/** File search result from the Rust workspace search */
interface FileSearchResult {
  path: string
  name: string
  relative_path: string
  file_type: string
  matches: {
    line_number: number
    line: string
    highlight_start: number
    highlight_end: number
  }[]
}

interface CommandPaletteProps {
  open: boolean
  onClose: () => void
  onNavigate: (tab: string) => void
  onOpenFile?: (path?: string) => void
  onNewDocument?: () => void
  onExportCurrent?: () => void
  onToggleTheme?: () => void
  activeTab?: string
  workspacePath?: string | null
  onRunAction?: (result: ActionRunResult) => void
  onManageActions?: () => void
}

/* ------------------------------------------------------------------ */
/*  Custom event helpers                                               */
/* ------------------------------------------------------------------ */

export function dispatchEditorEvent(action: string, detail?: Record<string, unknown>) {
  window.dispatchEvent(
    new CustomEvent('orchestra-editor-action', {
      detail: { action, ...detail },
    })
  )
}

/* ------------------------------------------------------------------ */
/*  Fuzzy-match helper                                                 */
/* ------------------------------------------------------------------ */

function fuzzyMatch(query: string, text: string): boolean {
  const q = query.toLowerCase()
  const t = text.toLowerCase()
  let qi = 0
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) qi++
  }
  return qi === q.length
}

function matchScore(query: string, text: string): number {
  const q = query.toLowerCase()
  const t = text.toLowerCase()
  if (t.startsWith(q)) return 3
  if (t.includes(q)) return 2
  if (fuzzyMatch(q, t)) return 1
  return 0
}

/* ------------------------------------------------------------------ */
/*  Shared SVG icon helpers                                            */
/* ------------------------------------------------------------------ */

const iconCls = 'h-4 w-4 shrink-0'

const Icons = {
  dashboard: (
    <svg
      className={iconCls}
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
  ),
  editor: (
    <svg
      className={iconCls}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 4L2 8L5 12" />
      <path d="M11 4L14 8L11 12" />
      <path d="M9 2L7 14" />
    </svg>
  ),
  settings: (
    <svg
      className={iconCls}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="8" cy="8" r="2.5" />
      <path d="M8 1V3M8 13V15M1 8H3M13 8H15M2.9 2.9L4.3 4.3M11.7 11.7L13.1 13.1M13.1 2.9L11.7 4.3M4.3 11.7L2.9 13.1" />
    </svg>
  ),
  task: (
    <svg
      className={iconCls}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="2" y="2" width="12" height="12" rx="2" />
      <path d="M5 8L7 10L11 6" />
    </svg>
  ),
  taskList: (
    <svg
      className={iconCls}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2 4H5M2 8H5M2 12H5" />
      <path d="M7 4H14M7 8H14M7 12H14" />
    </svg>
  ),
  taskDone: (
    <svg
      className={iconCls}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="8" cy="8" r="6" />
      <path d="M5.5 8L7.5 10L10.5 6" />
    </svg>
  ),
  agents: (
    <svg
      className={iconCls}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="6" cy="5" r="2.5" />
      <path d="M1.5 14C1.5 11.5 3.5 9.5 6 9.5C8.5 9.5 10.5 11.5 10.5 14" />
      <circle cx="11.5" cy="5.5" r="2" />
      <path d="M14.5 14C14.5 12 13 10 11.5 10" />
    </svg>
  ),
  play: (
    <svg
      className={iconCls}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 3L13 8L4 13V3Z" />
    </svg>
  ),
  file: (
    <svg
      className={iconCls}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 1H4C3.45 1 3 1.45 3 2V14C3 14.55 3.45 15 4 15H12C12.55 15 13 14.55 13 14V5L9 1Z" />
      <path d="M9 1V5H13" />
    </svg>
  ),
  newDoc: (
    <svg
      className={iconCls}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 1H4C3.45 1 3 1.45 3 2V14C3 14.55 3.45 15 4 15H12C12.55 15 13 14.55 13 14V5L9 1Z" />
      <path d="M8 7V11M6 9H10" />
    </svg>
  ),
  download: (
    <svg
      className={iconCls}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M8 2V10M8 10L5 7M8 10L11 7" />
      <path d="M3 12V13C3 13.55 3.45 14 4 14H12C12.55 14 13 13.55 13 13V12" />
    </svg>
  ),
  theme: (
    <svg
      className={iconCls}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="8" cy="8" r="6" />
      <path d="M8 2V14" />
      <path d="M8 2C11.3 2 14 4.7 14 8C14 11.3 11.3 14 8 14" />
    </svg>
  ),
  key: (
    <svg
      className={iconCls}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="5.5" cy="10.5" r="3" />
      <path d="M8 8L14 2" />
      <path d="M11 2H14V5" />
    </svg>
  ),
  prefs: (
    <svg
      className={iconCls}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2 4H14M2 8H14M2 12H14" />
      <circle cx="5" cy="4" r="1.5" fill="currentColor" />
      <circle cx="11" cy="8" r="1.5" fill="currentColor" />
      <circle cx="7" cy="12" r="1.5" fill="currentColor" />
    </svg>
  ),
  search: (
    <svg
      className={iconCls}
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
  ),
  bolt: (
    <svg
      className={iconCls}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 1L3 9H8L7 15L13 7H8L9 1Z" />
    </svg>
  ),
  manage: (
    <svg
      className={iconCls}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2 4H14M2 8H14M2 12H14" />
      <circle cx="5" cy="4" r="1.5" fill="currentColor" />
      <circle cx="11" cy="8" r="1.5" fill="currentColor" />
      <circle cx="7" cy="12" r="1.5" fill="currentColor" />
    </svg>
  ),
  folder: (
    <svg
      className={iconCls}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2 3h3l1 1h7a1 1 0 011 1v7a1 1 0 01-1 1H3a1 1 0 01-1-1V3Z" />
    </svg>
  ),
}

/* ------------------------------------------------------------------ */
/*  Category display order + labels                                    */
/* ------------------------------------------------------------------ */

const CATEGORY_ORDER = [
  'Files',
  'Smart Actions',
  'Navigation',
  'Tasks',
  'Agents',
  'Quick Actions',
  'Settings',
]

const CATEGORY_ICONS_MAP: Record<string, React.ReactNode> = {
  Files: Icons.folder,
  'Smart Actions': Icons.bolt,
  Navigation: Icons.dashboard,
  Tasks: Icons.task,
  Agents: Icons.agents,
  'Quick Actions': Icons.play,
  Settings: Icons.settings,
}

/* ------------------------------------------------------------------ */
/*  Prompt Dialog (for smart actions that need user input)              */
/* ------------------------------------------------------------------ */

interface PromptDialogState {
  open: boolean
  message: string
  resolve: ((value: string) => void) | null
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

const CommandPalette: FC<CommandPaletteProps> = ({
  open,
  onClose,
  onNavigate,
  onOpenFile,
  onNewDocument,
  onExportCurrent,
  onToggleTheme,
  activeTab,
  workspacePath,
  onRunAction,
  onManageActions,
}) => {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)

  // Workspace file search results
  const [fileResults, setFileResults] = useState<FileSearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Smart actions loaded from store
  const [smartActions, setSmartActions] = useState<SmartAction[]>([])

  // Prompt dialog for smart action steps that need user input
  const [prompt, setPrompt] = useState<PromptDialogState>({
    open: false,
    message: '',
    resolve: null,
  })
  const [promptInput, setPromptInput] = useState('')

  // Load smart actions when palette opens
  useEffect(() => {
    if (open) {
      loadAllActions().then((actions) => setSmartActions(actions.filter((a) => a.enabled)))
    }
  }, [open])

  // Debounced workspace search
  useEffect(() => {
    if (!open || !query.trim() || !workspacePath) {
      setFileResults([])
      setSearching(false)
      return
    }

    setSearching(true)
    if (debounceRef.current) clearTimeout(debounceRef.current)

    debounceRef.current = setTimeout(async () => {
      try {
        const results = await invoke<FileSearchResult[]>('search_workspace', {
          path: workspacePath,
          query: query.trim(),
        })
        setFileResults(results.slice(0, 8)) // Limit displayed file results
      } catch {
        setFileResults([])
      }
      setSearching(false)
    }, 200)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, open, workspacePath])

  /* ---- Prompt callback for smart action engine ---- */
  const promptCallback = useCallback((message: string): Promise<string> => {
    return new Promise((resolve) => {
      setPromptInput('')
      setPrompt({ open: true, message, resolve })
    })
  }, [])

  const handlePromptSubmit = useCallback(() => {
    if (prompt.resolve) {
      prompt.resolve(promptInput.trim() || '__CANCELLED__')
    }
    setPrompt({ open: false, message: '', resolve: null })
    setPromptInput('')
  }, [prompt, promptInput])

  const handlePromptCancel = useCallback(() => {
    if (prompt.resolve) {
      prompt.resolve('__CANCELLED__')
    }
    setPrompt({ open: false, message: '', resolve: null })
    setPromptInput('')
  }, [prompt])

  /* ---- Run smart action ---- */
  const runSmartAction = useCallback(
    async (action: SmartAction) => {
      onClose()
      await executeAction(action, workspacePath ?? null, promptCallback, (result) => {
        if (onRunAction) onRunAction(result)
      })
    },
    [onClose, workspacePath, promptCallback, onRunAction]
  )

  /* ---- Build the actions list ---- */
  const baseActions: CommandAction[] = useMemo(
    () => [
      // Navigation
      {
        id: 'nav-dashboard',
        label: 'Go to Dashboard',
        category: 'Navigation',
        icon: Icons.dashboard,
        shortcut: 'D',
        onSelect: () => {
          onNavigate('dashboard')
          onClose()
        },
      },
      {
        id: 'nav-editor',
        label: 'Go to Editor',
        category: 'Navigation',
        icon: Icons.editor,
        shortcut: 'E',
        onSelect: () => {
          onNavigate('editor')
          onClose()
        },
      },
      {
        id: 'nav-workspace',
        label: 'Go to Workspace',
        category: 'Navigation',
        icon: Icons.folder,
        shortcut: 'W',
        onSelect: () => {
          onNavigate('workspace')
          onClose()
        },
      },
      {
        id: 'nav-settings',
        label: 'Go to Settings',
        category: 'Navigation',
        icon: Icons.settings,
        shortcut: ',',
        onSelect: () => {
          onNavigate('settings')
          onClose()
        },
      },

      // Tasks
      {
        id: 'task-create',
        label: 'Create Task',
        category: 'Tasks',
        icon: Icons.task,
        onSelect: () => {
          onClose()
          onNavigate('dashboard')
          setTimeout(() => dispatchEditorEvent('create-task'), 50)
        },
      },
      {
        id: 'task-active',
        label: 'View Active Tasks',
        category: 'Tasks',
        icon: Icons.taskList,
        onSelect: () => {
          onClose()
          onNavigate('dashboard')
        },
      },
      {
        id: 'task-completed',
        label: 'View Completed Tasks',
        category: 'Tasks',
        icon: Icons.taskDone,
        onSelect: () => {
          onClose()
          onNavigate('dashboard')
        },
      },

      // Agents
      {
        id: 'agents-team',
        label: 'View Team',
        category: 'Agents',
        icon: Icons.agents,
        onSelect: () => {
          onClose()
          onNavigate('dashboard')
        },
      },
      {
        id: 'agents-session',
        label: 'Start Agent Session',
        category: 'Agents',
        icon: Icons.play,
        onSelect: () => {
          onClose()
          onNavigate('dashboard')
          setTimeout(() => dispatchEditorEvent('start-agent-session'), 50)
        },
      },

      // Quick Actions
      {
        id: 'quick-open',
        label: 'Open File',
        category: 'Quick Actions',
        icon: Icons.file,
        shortcut: 'O',
        onSelect: () => {
          onClose()
          if (onOpenFile) {
            onOpenFile()
          } else {
            onNavigate('editor')
            setTimeout(() => dispatchEditorEvent('open-file'), 50)
          }
        },
      },
      {
        id: 'quick-new',
        label: 'New Document',
        category: 'Quick Actions',
        icon: Icons.newDoc,
        shortcut: 'N',
        onSelect: () => {
          onClose()
          if (onNewDocument) {
            onNewDocument()
          } else {
            onNavigate('editor')
            setTimeout(() => dispatchEditorEvent('new-document'), 50)
          }
        },
      },
      {
        id: 'quick-export',
        label: 'Export Current',
        category: 'Quick Actions',
        icon: Icons.download,
        onSelect: () => {
          onClose()
          if (onExportCurrent) {
            onExportCurrent()
          } else if (activeTab === 'editor') {
            setTimeout(() => dispatchEditorEvent('export-current'), 50)
          } else {
            onNavigate('editor')
            setTimeout(() => dispatchEditorEvent('export-current'), 100)
          }
        },
      },

      // Settings
      {
        id: 'settings-theme',
        label: 'Toggle Theme',
        category: 'Settings',
        icon: Icons.theme,
        onSelect: () => {
          onClose()
          if (onToggleTheme) onToggleTheme()
          else onNavigate('settings')
        },
      },
      {
        id: 'settings-token',
        label: 'Configure MCP Token',
        category: 'Settings',
        icon: Icons.key,
        onSelect: () => {
          onClose()
          onNavigate('mcp')
        },
      },
      {
        id: 'settings-prefs',
        label: 'Open Preferences',
        category: 'Settings',
        icon: Icons.prefs,
        onSelect: () => {
          onClose()
          onNavigate('settings')
        },
      },

      // Smart Actions management
      ...(onManageActions
        ? [
            {
              id: 'manage-smart-actions',
              label: 'Manage Smart Actions',
              category: 'Settings',
              icon: Icons.manage,
              description: 'Create, edit, and organize smart actions',
              onSelect: () => {
                onClose()
                onManageActions()
              },
            },
          ]
        : []),
    ],
    [
      onNavigate,
      onClose,
      onOpenFile,
      onNewDocument,
      onExportCurrent,
      onToggleTheme,
      activeTab,
      onManageActions,
    ]
  )

  /* ---- Build smart action items ---- */
  const smartActionItems: CommandAction[] = useMemo(
    () =>
      smartActions.map((sa) => ({
        id: `sa-${sa.id}`,
        label: sa.name,
        category: 'Smart Actions',
        icon: <span className="text-sm">{sa.icon}</span>,
        shortcut: sa.shortcut,
        description: sa.description,
        onSelect: () => runSmartAction(sa),
      })),
    [smartActions, runSmartAction]
  )

  /* ---- Build file result items ---- */
  const fileItems: CommandAction[] = useMemo(
    () =>
      fileResults.map((fr) => ({
        id: `file-${fr.path}`,
        label: fr.name,
        category: 'Files',
        icon: Icons.file,
        description:
          fr.relative_path + (fr.matches[0]?.line ? ` -- L${fr.matches[0].line_number}` : ''),
        onSelect: () => {
          onClose()
          if (onOpenFile) {
            onOpenFile(fr.path)
          } else {
            onNavigate('editor')
            setTimeout(() => dispatchEditorEvent('open-file', { path: fr.path }), 50)
          }
        },
      })),
    [fileResults, onClose, onOpenFile, onNavigate]
  )

  /* ---- Combine all items ---- */
  const allActions = useMemo(
    () => [...fileItems, ...smartActionItems, ...baseActions],
    [fileItems, smartActionItems, baseActions]
  )

  /* ---- Filter by query ---- */
  const filtered = useMemo(() => {
    if (!query.trim()) {
      // No query: show base actions + smart actions (no files)
      return [...smartActionItems, ...baseActions]
    }
    return allActions
      .map((a) => ({
        action: a,
        score: Math.max(
          matchScore(query, a.label),
          matchScore(query, a.category),
          a.description ? matchScore(query, a.description) : 0
        ),
      }))
      .filter((r) => r.score > 0 || a_isFile(r.action))
      .sort((a, b) => b.score - a.score)
      .map((r) => r.action)
  }, [query, allActions, smartActionItems, baseActions])

  /* ---- Group by category, preserving order ---- */
  const grouped = useMemo(() => {
    const map = new Map<string, CommandAction[]>()
    for (const action of filtered) {
      const list = map.get(action.category) || []
      list.push(action)
      map.set(action.category, list)
    }
    const result: { category: string; items: CommandAction[] }[] = []
    for (const cat of CATEGORY_ORDER) {
      const items = map.get(cat)
      if (items && items.length > 0) result.push({ category: cat, items })
    }
    // Also include any categories not in CATEGORY_ORDER
    for (const [cat, items] of map) {
      if (!CATEGORY_ORDER.includes(cat) && items.length > 0) {
        result.push({ category: cat, items })
      }
    }
    return result
  }, [filtered])

  /* ---- Flat list for keyboard navigation ---- */
  const flatItems = useMemo(() => grouped.flatMap((g) => g.items), [grouped])

  /* ---- Reset state when opening ---- */
  useEffect(() => {
    if (open) {
      setQuery('')
      setSelectedIndex(0)
      setFileResults([])
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [open])

  /* ---- Clamp selection when list changes ---- */
  useEffect(() => {
    setSelectedIndex((prev) => Math.min(prev, Math.max(flatItems.length - 1, 0)))
  }, [flatItems.length])

  /* ---- Scroll selected item into view ---- */
  useEffect(() => {
    if (!listRef.current) return
    const selected = listRef.current.querySelector("[data-selected='true']")
    if (selected) {
      selected.scrollIntoView({ block: 'nearest' })
    }
  }, [selectedIndex])

  /* ---- Keyboard handler ---- */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          setSelectedIndex((prev) => (prev < flatItems.length - 1 ? prev + 1 : 0))
          break
        case 'ArrowUp':
          e.preventDefault()
          setSelectedIndex((prev) => (prev > 0 ? prev - 1 : flatItems.length - 1))
          break
        case 'Enter':
          e.preventDefault()
          if (flatItems[selectedIndex]) {
            flatItems[selectedIndex].onSelect()
          }
          break
        case 'Escape':
          e.preventDefault()
          onClose()
          break
      }
    },
    [flatItems, selectedIndex, onClose]
  )

  /* ---- Overlay click to close ---- */
  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) onClose()
  }

  if (!open && !prompt.open) return null

  /* ---- Prompt dialog (shown independently from palette) ---- */
  if (prompt.open) {
    return (
      <div
        className="fixed inset-0 z-[60] flex items-start justify-center"
        style={{
          paddingTop: 'min(20vh, 160px)',
          background: 'rgba(0, 0, 0, 0.55)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
        }}
      >
        <div
          className="w-full max-w-md overflow-hidden"
          style={{
            background: 'var(--background-overlay-default)',
            border: '1px solid var(--border-overlay)',
            borderRadius: 'var(--border-radius-xl)',
            boxShadow: '0 25px 60px -12px rgba(0, 0, 0, 0.6)',
          }}
        >
          <div className="px-5 pt-5 pb-2">
            <p className="text-sm font-medium" style={{ color: 'var(--foreground-default)' }}>
              {prompt.message}
            </p>
          </div>
          <div className="px-5 pb-5">
            <input
              type="text"
              value={promptInput}
              onChange={(e) => setPromptInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handlePromptSubmit()
                if (e.key === 'Escape') handlePromptCancel()
              }}
              autoFocus
              className="w-full rounded-md px-3 py-2 text-sm outline-none"
              style={{
                background: 'var(--background-control)',
                border: '1px solid var(--border-control)',
                color: 'var(--foreground-default)',
              }}
              placeholder="Type here..."
            />
            <div className="mt-3 flex items-center justify-end gap-2">
              <button
                onClick={handlePromptCancel}
                className="rounded-md px-3 py-1.5 text-xs transition-colors"
                style={{
                  border: '1px solid var(--border-strong)',
                  color: 'var(--foreground-light)',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handlePromptSubmit}
                className="rounded-md px-3 py-1.5 text-xs transition-colors"
                style={{
                  background: 'var(--brand-default)',
                  color: 'var(--foreground-contrast)',
                }}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  /* ---- Shared inline-style helpers ---- */
  const kbdStyle: React.CSSProperties = {
    background: 'var(--background-surface-300)',
    border: '1px solid var(--border-strong)',
    borderRadius: 'var(--border-radius-sm)',
    color: 'var(--foreground-muted)',
    padding: '1px 5px',
    fontSize: '10px',
    fontWeight: 500,
    lineHeight: '16px',
  }

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-50 flex items-start justify-center"
      style={{
        paddingTop: 'min(20vh, 160px)',
        background: 'rgba(0, 0, 0, 0.55)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
      }}
    >
      <div
        className="w-full max-w-xl overflow-hidden"
        style={{
          background: 'var(--background-overlay-default)',
          border: '1px solid var(--border-overlay)',
          borderRadius: 'var(--border-radius-xl)',
          boxShadow: '0 25px 60px -12px rgba(0, 0, 0, 0.6)',
        }}
        onKeyDown={handleKeyDown}
      >
        {/* Search input */}
        <div
          className="flex items-center gap-3 px-4 py-3"
          style={{ borderBottom: '1px solid var(--border-default)' }}
        >
          <span style={{ color: 'var(--foreground-lighter)' }}>{Icons.search}</span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setSelectedIndex(0)
            }}
            placeholder={
              workspacePath
                ? 'Search files, actions, and commands...'
                : 'Type a command or search...'
            }
            className="flex-1 bg-transparent text-sm focus:outline-none"
            style={{
              color: 'var(--foreground-default)',
            }}
            autoFocus
          />
          {searching && (
            <svg
              className="h-4 w-4 shrink-0 animate-spin"
              style={{ color: 'var(--foreground-muted)' }}
              viewBox="0 0 16 16"
              fill="none"
            >
              <circle
                cx="8"
                cy="8"
                r="6"
                stroke="currentColor"
                strokeWidth="2"
                className="opacity-25"
              />
              <path
                d="M2 8a6 6 0 016-6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          )}
          <kbd style={kbdStyle}>ESC</kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="overflow-y-auto p-2" style={{ maxHeight: '420px' }}>
          {flatItems.length === 0 ? (
            <div
              className="px-3 py-8 text-center text-sm"
              style={{ color: 'var(--foreground-muted)' }}
            >
              {searching ? 'Searching...' : 'No matching results.'}
            </div>
          ) : (
            grouped.map((group) => (
              <div key={group.category} className="mb-1 last:mb-0">
                <div className="flex items-center gap-1.5 px-3 pb-1 pt-2">
                  <span style={{ color: 'var(--foreground-muted)' }}>
                    {CATEGORY_ICONS_MAP[group.category] || null}
                  </span>
                  <p
                    className="text-[10px] font-semibold uppercase tracking-wider"
                    style={{ color: 'var(--foreground-lighter)' }}
                  >
                    {group.category}
                  </p>
                  <span className="ml-1 text-[10px]" style={{ color: 'var(--foreground-muted)' }}>
                    {group.items.length}
                  </span>
                </div>
                {group.items.map((item) => {
                  const idx = flatItems.indexOf(item)
                  const isSelected = idx === selectedIndex
                  return (
                    <button
                      key={item.id}
                      data-selected={isSelected}
                      onClick={() => item.onSelect()}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors"
                      style={{
                        borderRadius: 'var(--border-radius-lg)',
                        background: isSelected ? 'var(--background-selection)' : 'transparent',
                        color: isSelected ? 'var(--foreground-default)' : 'var(--foreground-light)',
                      }}
                    >
                      <span
                        style={{
                          color: isSelected ? 'var(--brand-default)' : 'var(--foreground-muted)',
                        }}
                      >
                        {item.icon}
                      </span>
                      <div className="flex-1 min-w-0">
                        <span className="block truncate">{item.label}</span>
                        {item.description && (
                          <span
                            className="block truncate text-[11px]"
                            style={{
                              color: isSelected
                                ? 'var(--foreground-lighter)'
                                : 'var(--foreground-muted)',
                            }}
                          >
                            {item.description}
                          </span>
                        )}
                      </div>
                      {item.shortcut && <kbd style={kbdStyle}>{item.shortcut}</kbd>}
                    </button>
                  )
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-between px-4 py-2"
          style={{
            borderTop: '1px solid var(--border-default)',
            color: 'var(--foreground-muted)',
            fontSize: '10px',
          }}
        >
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd style={kbdStyle}>&uarr;</kbd>
              <kbd style={kbdStyle}>&darr;</kbd>
              <span className="ml-0.5">navigate</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd style={kbdStyle}>&crarr;</kbd>
              <span className="ml-0.5">select</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd style={kbdStyle}>esc</kbd>
              <span className="ml-0.5">close</span>
            </span>
          </div>
          <span>
            {flatItems.length} result{flatItems.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>
    </div>
  )
}

/** Check if an action is a file result (always included in search results) */
function a_isFile(action: CommandAction): boolean {
  return action.id.startsWith('file-')
}

export default CommandPalette
