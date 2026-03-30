// Orchestra Desktop -- Smart Action Settings / Manager
//
// Manage built-in and custom smart actions: enable/disable, create,
// edit, delete, import/export, reorder.

import { useCallback, useEffect, useState, type FC } from 'react'

import {
  deleteCustomAction,
  exportActions,
  importActions,
  loadAllActions,
  saveCustomAction,
  toggleBuiltinEnabled,
} from './smart-action-store'
import type { SmartAction, SmartActionCategory, SmartActionStep } from './types'
import { CATEGORY_ICONS } from './types'

interface SmartActionSettingsProps {
  open: boolean
  onClose: () => void
}

const CATEGORIES: SmartActionCategory[] = ['Git', 'Build', 'MCP', 'File', 'Template', 'Custom']

const STEP_TYPES: SmartActionStep['type'][] = ['shell', 'command', 'url', 'file', 'prompt']

function newStepId(): string {
  return Math.random().toString(36).slice(2, 10)
}

function newActionId(): string {
  return `custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
}

const SmartActionSettings: FC<SmartActionSettingsProps> = ({ open, onClose }) => {
  const [actions, setActions] = useState<SmartAction[]>([])
  const [loading, setLoading] = useState(true)
  const [editingAction, setEditingAction] = useState<SmartAction | null>(null)
  const [filterCategory, setFilterCategory] = useState<string>('all')
  const [importError, setImportError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const all = await loadAllActions()
      setActions(all)
    } catch (e) {
      console.warn('Failed to load actions:', e)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    if (open) refresh()
  }, [open, refresh])

  // ── Handlers ──────────────────────────────────────────

  const handleToggle = async (action: SmartAction) => {
    if (action.builtin) {
      await toggleBuiltinEnabled(action.id, !action.enabled)
    } else {
      await saveCustomAction({ ...action, enabled: !action.enabled })
    }
    await refresh()
  }

  const handleDelete = async (action: SmartAction) => {
    if (action.builtin) return
    await deleteCustomAction(action.id)
    await refresh()
  }

  const handleCreateNew = () => {
    setEditingAction({
      id: newActionId(),
      name: '',
      description: '',
      icon: '\uD83D\uDD27',
      category: 'Custom',
      steps: [],
      enabled: true,
      builtin: false,
    })
  }

  const handleSaveEditing = async () => {
    if (!editingAction) return
    if (!editingAction.name.trim()) return
    await saveCustomAction(editingAction)
    setEditingAction(null)
    await refresh()
  }

  const handleExport = async () => {
    try {
      const json = await exportActions()
      // Create a download-friendly blob
      const blob = new Blob([json], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'orchestra-smart-actions.json'
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      console.error('Export failed:', e)
    }
  }

  const handleImport = async () => {
    setImportError(null)
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      try {
        const text = await file.text()
        const count = await importActions(text)
        await refresh()
        setImportError(null)
        alert(`Imported ${count} action(s) successfully.`)
      } catch (err) {
        setImportError(String(err))
      }
    }
    input.click()
  }

  if (!open) return null

  const filteredActions =
    filterCategory === 'all' ? actions : actions.filter((a) => a.category === filterCategory)

  // ── Editor sub-view ───────────────────────────────────

  if (editingAction) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center"
        style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)' }}
      >
        <div
          className="w-full max-w-2xl overflow-hidden rounded-xl"
          style={{
            background: 'var(--background-overlay-default)',
            border: '1px solid var(--border-overlay)',
            maxHeight: '85vh',
          }}
        >
          {/* Editor Header */}
          <div
            className="flex items-center justify-between px-6 py-4"
            style={{ borderBottom: '1px solid var(--border-default)' }}
          >
            <h2 className="text-base font-semibold" style={{ color: 'var(--foreground-default)' }}>
              {editingAction.builtin
                ? 'View Action'
                : editingAction.name
                  ? 'Edit Action'
                  : 'New Action'}
            </h2>
            <button
              onClick={() => setEditingAction(null)}
              className="rounded p-1 transition-colors"
              style={{ color: 'var(--foreground-muted)' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--background-surface-300)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent'
              }}
            >
              <svg
                className="h-4 w-4"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M4 4L12 12M12 4L4 12" />
              </svg>
            </button>
          </div>

          <div className="overflow-y-auto p-6" style={{ maxHeight: 'calc(85vh - 120px)' }}>
            <div className="space-y-4">
              {/* Name */}
              <div>
                <label
                  className="mb-1 block text-xs font-medium"
                  style={{ color: 'var(--foreground-lighter)' }}
                >
                  Name
                </label>
                <input
                  type="text"
                  value={editingAction.name}
                  onChange={(e) => setEditingAction({ ...editingAction, name: e.target.value })}
                  disabled={editingAction.builtin}
                  className="w-full rounded-md px-3 py-2 text-sm outline-none"
                  style={{
                    background: 'var(--background-control)',
                    border: '1px solid var(--border-control)',
                    color: 'var(--foreground-default)',
                    opacity: editingAction.builtin ? 0.6 : 1,
                  }}
                  placeholder="Action name"
                />
              </div>

              {/* Description */}
              <div>
                <label
                  className="mb-1 block text-xs font-medium"
                  style={{ color: 'var(--foreground-lighter)' }}
                >
                  Description
                </label>
                <input
                  type="text"
                  value={editingAction.description}
                  onChange={(e) =>
                    setEditingAction({
                      ...editingAction,
                      description: e.target.value,
                    })
                  }
                  disabled={editingAction.builtin}
                  className="w-full rounded-md px-3 py-2 text-sm outline-none"
                  style={{
                    background: 'var(--background-control)',
                    border: '1px solid var(--border-control)',
                    color: 'var(--foreground-default)',
                    opacity: editingAction.builtin ? 0.6 : 1,
                  }}
                  placeholder="Short description"
                />
              </div>

              {/* Category + Icon row */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label
                    className="mb-1 block text-xs font-medium"
                    style={{ color: 'var(--foreground-lighter)' }}
                  >
                    Category
                  </label>
                  <select
                    value={editingAction.category}
                    onChange={(e) =>
                      setEditingAction({
                        ...editingAction,
                        category: e.target.value as SmartActionCategory,
                      })
                    }
                    disabled={editingAction.builtin}
                    className="w-full rounded-md px-3 py-2 text-sm outline-none"
                    style={{
                      background: 'var(--background-control)',
                      border: '1px solid var(--border-control)',
                      color: 'var(--foreground-default)',
                    }}
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {CATEGORY_ICONS[c]} {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label
                    className="mb-1 block text-xs font-medium"
                    style={{ color: 'var(--foreground-lighter)' }}
                  >
                    Icon (emoji)
                  </label>
                  <input
                    type="text"
                    value={editingAction.icon}
                    onChange={(e) => setEditingAction({ ...editingAction, icon: e.target.value })}
                    disabled={editingAction.builtin}
                    className="w-full rounded-md px-3 py-2 text-sm outline-none"
                    style={{
                      background: 'var(--background-control)',
                      border: '1px solid var(--border-control)',
                      color: 'var(--foreground-default)',
                    }}
                    placeholder="Emoji icon"
                  />
                </div>
              </div>

              {/* Shortcut */}
              <div>
                <label
                  className="mb-1 block text-xs font-medium"
                  style={{ color: 'var(--foreground-lighter)' }}
                >
                  Keyboard Shortcut{' '}
                  <span style={{ color: 'var(--foreground-muted)' }}>(optional)</span>
                </label>
                <input
                  type="text"
                  value={editingAction.shortcut ?? ''}
                  onChange={(e) =>
                    setEditingAction({
                      ...editingAction,
                      shortcut: e.target.value || undefined,
                    })
                  }
                  disabled={editingAction.builtin}
                  className="w-full rounded-md px-3 py-2 text-sm outline-none"
                  style={{
                    background: 'var(--background-control)',
                    border: '1px solid var(--border-control)',
                    color: 'var(--foreground-default)',
                  }}
                  placeholder="e.g. Ctrl+Shift+T"
                />
              </div>

              {/* Steps */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label
                    className="text-xs font-medium"
                    style={{ color: 'var(--foreground-lighter)' }}
                  >
                    Steps ({editingAction.steps.length})
                  </label>
                  {!editingAction.builtin && (
                    <button
                      onClick={() => {
                        setEditingAction({
                          ...editingAction,
                          steps: [
                            ...editingAction.steps,
                            {
                              id: newStepId(),
                              type: 'shell',
                              shell: '',
                              label: '',
                            },
                          ],
                        })
                      }}
                      className="rounded px-2 py-1 text-xs transition-colors"
                      style={{
                        background: 'var(--brand-400)',
                        color: 'var(--brand-default)',
                      }}
                    >
                      + Add Step
                    </button>
                  )}
                </div>

                <div className="space-y-3">
                  {editingAction.steps.map((step, si) => (
                    <div
                      key={step.id}
                      className="rounded-lg p-3"
                      style={{
                        background: 'var(--background-surface-200)',
                        border: '1px solid var(--border-default)',
                      }}
                    >
                      <div className="mb-2 flex items-center gap-2">
                        <span
                          className="text-[10px] font-bold"
                          style={{ color: 'var(--foreground-muted)' }}
                        >
                          #{si + 1}
                        </span>
                        <select
                          value={step.type}
                          onChange={(e) => {
                            const steps = [...editingAction.steps]
                            steps[si] = {
                              ...steps[si],
                              type: e.target.value as SmartActionStep['type'],
                            }
                            setEditingAction({ ...editingAction, steps })
                          }}
                          disabled={editingAction.builtin}
                          className="rounded px-2 py-1 text-xs"
                          style={{
                            background: 'var(--background-control)',
                            border: '1px solid var(--border-control)',
                            color: 'var(--foreground-default)',
                          }}
                        >
                          {STEP_TYPES.map((t) => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                        </select>

                        {!editingAction.builtin && (
                          <button
                            onClick={() => {
                              const steps = editingAction.steps.filter((_, i) => i !== si)
                              setEditingAction({ ...editingAction, steps })
                            }}
                            className="ml-auto rounded p-1 text-xs transition-colors"
                            style={{ color: 'var(--destructive-default)' }}
                          >
                            <svg
                              className="h-3.5 w-3.5"
                              viewBox="0 0 16 16"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                            >
                              <path d="M4 4L12 12M12 4L4 12" />
                            </svg>
                          </button>
                        )}
                      </div>

                      {/* Type-specific fields */}
                      {step.type === 'shell' && (
                        <input
                          type="text"
                          value={step.shell ?? ''}
                          onChange={(e) => {
                            const steps = [...editingAction.steps]
                            steps[si] = { ...steps[si], shell: e.target.value }
                            setEditingAction({ ...editingAction, steps })
                          }}
                          disabled={editingAction.builtin}
                          className="w-full rounded px-2 py-1 font-mono text-xs outline-none"
                          style={{
                            background: 'var(--background-control)',
                            border: '1px solid var(--border-control)',
                            color: 'var(--foreground-default)',
                          }}
                          placeholder="Shell command..."
                        />
                      )}
                      {step.type === 'command' && (
                        <input
                          type="text"
                          value={step.command ?? ''}
                          onChange={(e) => {
                            const steps = [...editingAction.steps]
                            steps[si] = { ...steps[si], command: e.target.value }
                            setEditingAction({ ...editingAction, steps })
                          }}
                          disabled={editingAction.builtin}
                          className="w-full rounded px-2 py-1 font-mono text-xs outline-none"
                          style={{
                            background: 'var(--background-control)',
                            border: '1px solid var(--border-control)',
                            color: 'var(--foreground-default)',
                          }}
                          placeholder="Tauri command name..."
                        />
                      )}
                      {step.type === 'url' && (
                        <input
                          type="text"
                          value={step.url ?? ''}
                          onChange={(e) => {
                            const steps = [...editingAction.steps]
                            steps[si] = { ...steps[si], url: e.target.value }
                            setEditingAction({ ...editingAction, steps })
                          }}
                          disabled={editingAction.builtin}
                          className="w-full rounded px-2 py-1 text-xs outline-none"
                          style={{
                            background: 'var(--background-control)',
                            border: '1px solid var(--border-control)',
                            color: 'var(--foreground-default)',
                          }}
                          placeholder="https://..."
                        />
                      )}
                      {step.type === 'prompt' && (
                        <input
                          type="text"
                          value={step.prompt ?? ''}
                          onChange={(e) => {
                            const steps = [...editingAction.steps]
                            steps[si] = { ...steps[si], prompt: e.target.value }
                            setEditingAction({ ...editingAction, steps })
                          }}
                          disabled={editingAction.builtin}
                          className="w-full rounded px-2 py-1 text-xs outline-none"
                          style={{
                            background: 'var(--background-control)',
                            border: '1px solid var(--border-control)',
                            color: 'var(--foreground-default)',
                          }}
                          placeholder="Prompt message..."
                        />
                      )}
                      {step.type === 'file' && (
                        <div className="space-y-2">
                          <input
                            type="text"
                            value={step.filePath ?? ''}
                            onChange={(e) => {
                              const steps = [...editingAction.steps]
                              steps[si] = { ...steps[si], filePath: e.target.value }
                              setEditingAction({ ...editingAction, steps })
                            }}
                            disabled={editingAction.builtin}
                            className="w-full rounded px-2 py-1 text-xs outline-none"
                            style={{
                              background: 'var(--background-control)',
                              border: '1px solid var(--border-control)',
                              color: 'var(--foreground-default)',
                            }}
                            placeholder="File path..."
                          />
                          <textarea
                            value={step.content ?? ''}
                            onChange={(e) => {
                              const steps = [...editingAction.steps]
                              steps[si] = { ...steps[si], content: e.target.value }
                              setEditingAction({ ...editingAction, steps })
                            }}
                            disabled={editingAction.builtin}
                            rows={3}
                            className="w-full resize-none rounded px-2 py-1 font-mono text-xs outline-none"
                            style={{
                              background: 'var(--background-control)',
                              border: '1px solid var(--border-control)',
                              color: 'var(--foreground-default)',
                            }}
                            placeholder="File content..."
                          />
                        </div>
                      )}

                      {/* Label */}
                      <input
                        type="text"
                        value={step.label ?? ''}
                        onChange={(e) => {
                          const steps = [...editingAction.steps]
                          steps[si] = { ...steps[si], label: e.target.value }
                          setEditingAction({ ...editingAction, steps })
                        }}
                        disabled={editingAction.builtin}
                        className="mt-2 w-full rounded px-2 py-1 text-xs outline-none"
                        style={{
                          background: 'var(--background-control)',
                          border: '1px solid var(--border-control)',
                          color: 'var(--foreground-muted)',
                        }}
                        placeholder="Step label (optional)"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          {!editingAction.builtin && (
            <div
              className="flex items-center justify-end gap-2 px-6 py-3"
              style={{ borderTop: '1px solid var(--border-default)' }}
            >
              <button
                onClick={() => setEditingAction(null)}
                className="rounded-md px-4 py-2 text-sm font-medium transition-colors"
                style={{
                  border: '1px solid var(--border-strong)',
                  color: 'var(--foreground-light)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--background-surface-300)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEditing}
                disabled={!editingAction.name.trim()}
                className="rounded-md px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50"
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
                Save Action
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── Main list view ────────────────────────────────────

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="w-full max-w-2xl overflow-hidden rounded-xl"
        style={{
          background: 'var(--background-overlay-default)',
          border: '1px solid var(--border-overlay)',
          maxHeight: '80vh',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: '1px solid var(--border-default)' }}
        >
          <h2 className="text-base font-semibold" style={{ color: 'var(--foreground-default)' }}>
            Smart Actions Manager
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={handleImport}
              className="rounded-md px-3 py-1.5 text-xs transition-colors"
              style={{
                border: '1px solid var(--border-strong)',
                color: 'var(--foreground-light)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--background-surface-300)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent'
              }}
            >
              Import
            </button>
            <button
              onClick={handleExport}
              className="rounded-md px-3 py-1.5 text-xs transition-colors"
              style={{
                border: '1px solid var(--border-strong)',
                color: 'var(--foreground-light)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--background-surface-300)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent'
              }}
            >
              Export
            </button>
            <button
              onClick={handleCreateNew}
              className="rounded-md px-3 py-1.5 text-xs transition-colors"
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
              + New Action
            </button>
            <button
              onClick={onClose}
              className="ml-2 rounded p-1 transition-colors"
              style={{ color: 'var(--foreground-muted)' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--background-surface-300)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent'
              }}
            >
              <svg
                className="h-4 w-4"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <path d="M4 4L12 12M12 4L4 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Category filter */}
        <div
          className="flex items-center gap-1 overflow-x-auto px-6 py-2"
          style={{ borderBottom: '1px solid var(--border-default)' }}
        >
          <button
            onClick={() => setFilterCategory('all')}
            className="shrink-0 rounded-full px-3 py-1 text-xs transition-colors"
            style={{
              background:
                filterCategory === 'all' ? 'var(--background-surface-300)' : 'transparent',
              color:
                filterCategory === 'all' ? 'var(--foreground-default)' : 'var(--foreground-muted)',
              border:
                '1px solid ' + (filterCategory === 'all' ? 'var(--border-strong)' : 'transparent'),
            }}
          >
            All ({actions.length})
          </button>
          {CATEGORIES.map((cat) => {
            const count = actions.filter((a) => a.category === cat).length
            if (count === 0) return null
            return (
              <button
                key={cat}
                onClick={() => setFilterCategory(cat)}
                className="shrink-0 rounded-full px-3 py-1 text-xs transition-colors"
                style={{
                  background:
                    filterCategory === cat ? 'var(--background-surface-300)' : 'transparent',
                  color:
                    filterCategory === cat
                      ? 'var(--foreground-default)'
                      : 'var(--foreground-muted)',
                  border:
                    '1px solid ' +
                    (filterCategory === cat ? 'var(--border-strong)' : 'transparent'),
                }}
              >
                {CATEGORY_ICONS[cat]} {cat} ({count})
              </button>
            )
          })}
        </div>

        {importError && (
          <div
            className="mx-6 mt-2 rounded-md px-3 py-2 text-xs"
            style={{ background: 'var(--destructive-200)', color: 'var(--destructive-600)' }}
          >
            Import error: {importError}
          </div>
        )}

        {/* Actions list */}
        <div className="overflow-y-auto p-4" style={{ maxHeight: 'calc(80vh - 140px)' }}>
          {loading ? (
            <div className="py-8 text-center text-sm" style={{ color: 'var(--foreground-muted)' }}>
              Loading...
            </div>
          ) : filteredActions.length === 0 ? (
            <div className="py-8 text-center text-sm" style={{ color: 'var(--foreground-muted)' }}>
              No actions in this category.
            </div>
          ) : (
            <div className="space-y-1">
              {filteredActions.map((action) => (
                <div
                  key={action.id}
                  className="flex items-center gap-3 rounded-lg px-4 py-3 transition-colors"
                  style={{
                    background: 'var(--background-surface-100)',
                    border: '1px solid var(--border-default)',
                    opacity: action.enabled ? 1 : 0.5,
                  }}
                >
                  <span className="text-lg shrink-0">{action.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className="text-sm font-medium truncate"
                        style={{ color: 'var(--foreground-default)' }}
                      >
                        {action.name}
                      </span>
                      {action.builtin && (
                        <span
                          className="shrink-0 rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase"
                          style={{
                            background: 'var(--background-surface-300)',
                            color: 'var(--foreground-muted)',
                          }}
                        >
                          Built-in
                        </span>
                      )}
                      <span
                        className="shrink-0 rounded px-1.5 py-0.5 text-[9px]"
                        style={{
                          background: 'var(--background-surface-200)',
                          color: 'var(--foreground-lighter)',
                        }}
                      >
                        {action.category}
                      </span>
                    </div>
                    <p
                      className="mt-0.5 text-xs truncate"
                      style={{ color: 'var(--foreground-lighter)' }}
                    >
                      {action.description}
                    </p>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {/* Edit */}
                    <button
                      onClick={() => setEditingAction({ ...action })}
                      className="rounded p-1.5 transition-colors"
                      style={{ color: 'var(--foreground-muted)' }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'var(--background-surface-300)'
                        e.currentTarget.style.color = 'var(--foreground-default)'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent'
                        e.currentTarget.style.color = 'var(--foreground-muted)'
                      }}
                      title={action.builtin ? 'View' : 'Edit'}
                    >
                      <svg
                        className="h-3.5 w-3.5"
                        viewBox="0 0 16 16"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                      >
                        <path d="M11 2l3 3-8 8H3v-3l8-8z" />
                      </svg>
                    </button>

                    {/* Toggle enabled */}
                    <button
                      onClick={() => handleToggle(action)}
                      className="rounded p-1.5 transition-colors"
                      style={{
                        color: action.enabled ? 'var(--status-online)' : 'var(--foreground-muted)',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'var(--background-surface-300)'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent'
                      }}
                      title={action.enabled ? 'Disable' : 'Enable'}
                    >
                      {action.enabled ? (
                        <svg
                          className="h-3.5 w-3.5"
                          viewBox="0 0 16 16"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                        >
                          <path d="M3 8L7 12L13 4" />
                        </svg>
                      ) : (
                        <svg
                          className="h-3.5 w-3.5"
                          viewBox="0 0 16 16"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                        >
                          <circle cx="8" cy="8" r="5" />
                        </svg>
                      )}
                    </button>

                    {/* Delete (custom only) */}
                    {!action.builtin && (
                      <button
                        onClick={() => handleDelete(action)}
                        className="rounded p-1.5 transition-colors"
                        style={{ color: 'var(--foreground-muted)' }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'var(--destructive-200)'
                          e.currentTarget.style.color = 'var(--destructive-default)'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'transparent'
                          e.currentTarget.style.color = 'var(--foreground-muted)'
                        }}
                        title="Delete"
                      >
                        <svg
                          className="h-3.5 w-3.5"
                          viewBox="0 0 16 16"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                        >
                          <path d="M3 4h10M6 4V2h4v2M5 4v9h6V4" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default SmartActionSettings
