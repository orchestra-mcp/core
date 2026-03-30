import { invoke } from '@tauri-apps/api/core'
import { open as tauriOpen } from '@tauri-apps/plugin-dialog'
import { useCallback, useEffect, useRef, useState } from 'react'

import { AuthProvider, LoginScreen, useAuth } from './auth'
import { CommandPalette } from './components'
import { Dashboard } from './dashboard'
import { DocsPage } from './docs'
import { MarkdownEditor } from './editor'
import { Explorer } from './explorer'
import { supabase } from './lib/supabase'
import { McpConnector } from './mcp'
import { SettingsPage } from './settings'
import { ActionOutput, SmartActionSettings } from './smart-actions'
import type { ActionRunResult } from './smart-actions'
import { WelcomePage } from './welcome'
import { WorkspaceManager } from './workspace'
import {
  addRecentWorkspace,
  loadPreferences,
  savePreferences,
  type RecentWorkspace,
  type WorkspacePreferences,
} from './workspace/workspace-store'

// ─── Sidebar State ─────────────────────────────────────────────

type SidebarState = 'collapsed' | 'expanded' | 'hover'

function AppShell() {
  const { user, loading: authLoading, signOut } = useAuth()
  const [version, setVersion] = useState<string>('')
  const [activeTab, setActiveTab] = useState<string>('dashboard')
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)
  const [supabaseConnected, setSupabaseConnected] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [editorFilePath, setEditorFilePath] = useState<string | null>(null)
  const [sidebarState, setSidebarState] = useState<SidebarState>('collapsed')
  const [sidebarPinned, setSidebarPinned] = useState(false)
  const [fileMenuOpen, setFileMenuOpen] = useState(false)
  const [recentWorkspaces, setRecentWorkspaces] = useState<RecentWorkspace[]>([])
  const [workspacePath, setWorkspacePath] = useState<string | null>(null)
  const [prefs, setPrefs] = useState<WorkspacePreferences | null>(null)
  const [actionRuns, setActionRuns] = useState<ActionRunResult[]>([])
  const [actionOutputVisible, setActionOutputVisible] = useState(false)
  const [smartActionSettingsOpen, setSmartActionSettingsOpen] = useState(false)
  const userMenuRef = useRef<HTMLDivElement>(null)
  const fileMenuRef = useRef<HTMLDivElement>(null)
  const sidebarRef = useRef<HTMLElement>(null)
  const sidebarHoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Close user menu on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false)
      }
      if (fileMenuRef.current && !fileMenuRef.current.contains(e.target as Node)) {
        setFileMenuOpen(false)
      }
    }
    if (userMenuOpen || fileMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [userMenuOpen, fileMenuOpen])

  // Load preferences
  useEffect(() => {
    loadPreferences().then((p) => {
      setPrefs(p)
      setRecentWorkspaces(p.recentWorkspaces || [])
      if (p.lastWorkspacePath) {
        setWorkspacePath(p.lastWorkspacePath)
      } else {
        // No workspace configured — show the welcome/explorer page
        setActiveTab('explorer')
      }
      if (!p.sidebarCollapsed) {
        setSidebarPinned(true)
        setSidebarState('expanded')
      }
    })
  }, [])

  useEffect(() => {
    invoke<string>('get_version').then(setVersion)
  }, [])

  /* ---- Global Cmd+K / Ctrl+K listener ---- */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setCommandPaletteOpen((prev) => !prev)
      }
      // Cmd+S save
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        // Save handled by editor
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  /* ---- Tauri global shortcut ---- */
  useEffect(() => {
    let cleanup: (() => void) | null = null
    async function registerGlobal() {
      try {
        const { register } = await import('@tauri-apps/plugin-global-shortcut')
        await register('CommandOrControl+K', () => {
          setCommandPaletteOpen((prev) => !prev)
        })
        cleanup = () => {
          import('@tauri-apps/plugin-global-shortcut')
            .then(({ unregister }) => unregister('CommandOrControl+K'))
            .catch(() => {})
        }
      } catch {}
    }
    registerGlobal()
    return () => {
      if (cleanup) cleanup()
    }
  }, [])

  const handleNavigate = useCallback((tab: string) => {
    setActiveTab(tab)
  }, [])

  const handleActionRun = useCallback((result: ActionRunResult) => {
    setActionOutputVisible(true)
    setActionRuns((prev: ActionRunResult[]) => {
      const idx = prev.findIndex(
        (r: ActionRunResult) => r.actionId === result.actionId && r.startedAt === result.startedAt
      )
      if (idx >= 0) {
        const copy = [...prev]
        copy[idx] = result
        return copy
      }
      return [result, ...prev].slice(0, 20)
    })
  }, [])

  const handlePaletteOpenFile = useCallback((path?: string) => {
    if (path) {
      setEditorFilePath(path)
      setActiveTab('editor')
    }
  }, [])

  // Check Supabase connection
  useEffect(() => {
    if (!user) return
    async function checkConnection() {
      try {
        const { error } = await supabase.from('agents').select('id', { count: 'exact', head: true })
        setSupabaseConnected(!error)
      } catch {
        setSupabaseConnected(false)
      }
    }
    checkConnection()
    const interval = setInterval(checkConnection, 30_000)
    return () => clearInterval(interval)
  }, [user])

  // ── File Menu Actions ────────────────────────────────────────

  const handleOpenWorkspace = useCallback(async () => {
    setFileMenuOpen(false)
    try {
      const selected = await tauriOpen({ directory: true, multiple: false })
      if (selected && typeof selected === 'string') {
        setWorkspacePath(selected)
        setActiveTab('workspace')
        setEditorFilePath(null)
        const updated = await addRecentWorkspace(selected)
        setRecentWorkspaces(updated)
        if (prefs) {
          const p = { ...prefs, lastWorkspacePath: selected }
          setPrefs(p)
          savePreferences(p)
        }
      }
    } catch (e) {
      console.error('Failed to open workspace:', e)
    }
  }, [prefs])

  const handleOpenFile = useCallback(async () => {
    setFileMenuOpen(false)
    try {
      const selected = await tauriOpen({
        directory: false,
        multiple: false,
        filters: [{ name: 'Markdown', extensions: ['md', 'mdx'] }],
      })
      if (selected && typeof selected === 'string') {
        setEditorFilePath(selected)

        setActiveTab('editor')
      }
    } catch (e) {
      console.error('Failed to open file:', e)
    }
  }, [])

  const handleOpenRecentWorkspace = useCallback(
    async (path: string) => {
      setFileMenuOpen(false)
      setWorkspacePath(path)
      setActiveTab('workspace')
      const updated = await addRecentWorkspace(path)
      setRecentWorkspaces(updated)
      if (prefs) {
        const p = { ...prefs, lastWorkspacePath: path }
        setPrefs(p)
        savePreferences(p)
      }
    },
    [prefs]
  )

  const handleCloseWorkspace = useCallback(() => {
    setFileMenuOpen(false)
    setWorkspacePath(null)
    setEditorFilePath(null)
    setActiveTab('dashboard')
    if (prefs) {
      const p = { ...prefs, lastWorkspacePath: null }
      setPrefs(p)
      savePreferences(p)
    }
  }, [prefs])

  // ── Sidebar Hover Logic ──────────────────────────────────────

  const handleSidebarMouseEnter = useCallback(() => {
    if (sidebarPinned) return
    sidebarHoverTimer.current = setTimeout(() => {
      setSidebarState('hover')
    }, 200)
  }, [sidebarPinned])

  const handleSidebarMouseLeave = useCallback(() => {
    if (sidebarPinned) return
    if (sidebarHoverTimer.current) {
      clearTimeout(sidebarHoverTimer.current)
      sidebarHoverTimer.current = null
    }
    setSidebarState('collapsed')
  }, [sidebarPinned])

  const toggleSidebarPin = useCallback(() => {
    const newPinned = !sidebarPinned
    setSidebarPinned(newPinned)
    setSidebarState(newPinned ? 'expanded' : 'collapsed')
    if (prefs) {
      const p = { ...prefs, sidebarCollapsed: !newPinned }
      setPrefs(p)
      savePreferences(p)
    }
  }, [sidebarPinned, prefs])

  // ── Auto-init: generate .mcp.json when workspace opens ──────

  useEffect(() => {
    if (!workspacePath) return
    invoke('generate_mcp_config', { workspacePath }).catch((e: unknown) => {
      // Non-critical — just log if the command fails or .mcp.json already exists
      console.debug('Auto-init .mcp.json:', e)
    })
  }, [workspacePath])

  // ── File Open from Workspace ─────────────────────────────────

  const handleWorkspaceFileOpen = useCallback((path: string) => {
    setEditorFilePath(path)
    setActiveTab('editor')
  }, [])

  // Loading
  if (authLoading) {
    return (
      <div
        className="flex h-full items-center justify-center"
        style={{ background: 'var(--background-default)' }}
      >
        <div className="flex flex-col items-center gap-4">
          <svg
            className="h-12 w-12 shrink-0"
            viewBox="0 0 725.06 724.82"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <linearGradient
                id="logo-grad"
                x1="671.57"
                y1="599.9"
                x2="188.27"
                y2="219.43"
                gradientUnits="userSpaceOnUse"
              >
                <stop offset="0" stopColor="#a900ff" />
                <stop offset="1" stopColor="#00e5ff" />
              </linearGradient>
            </defs>
            <path
              fill="url(#logo-grad)"
              d="M670.75,54.19c-8.34-8.34-21.81-8.54-30.39-.45L61.86,599.32c-6.59,6.22-11.12,14.18-13.08,23.03-3.36,15.13,1.17,30.71,12.14,41.68,8.58,8.58,19.99,13.22,31.8,13.22,3.28,0,6.59-.36,9.87-1.09,8.84-1.96,16.81-6.49,23.03-13.08L671.19,84.58c8.09-8.58,7.9-22.05-.45-30.39Z"
            />
            <path
              fill="url(#logo-grad)"
              d="M661.8,158.12l-54.6,57.88c25.67,42.78,40.44,92.88,40.44,146.41,0,157.51-127.72,285.23-285.23,285.23-47.55,0-92.41-11.64-131.84-32.28l-54.56,57.88c54.46,32.75,118.25,51.58,186.41,51.58,200.16,0,362.41-162.25,362.41-362.41,0-75.77-23.25-146.11-63.02-204.29ZM362.41,77.18c53.59,0,103.72,14.8,146.54,40.54l57.88-54.6C508.65,23.29,438.25,0,362.41,0,162.25,0,0,162.25,0,362.41c0,68.22,18.86,132.04,51.68,186.54l57.85-54.56c-20.67-39.46-32.35-84.36-32.35-131.98,0-157.51,127.72-285.23,285.23-285.23Z"
            />
            <path
              fill="url(#logo-grad)"
              d="M362.41,130.87c-127.88,0-231.54,103.66-231.54,231.54,0,33.22,6.98,64.8,19.6,93.35l58.82-55.47c-3.02-12.15-4.6-24.83-4.6-37.89,0-87.11,70.6-157.72,157.72-157.72,16.31,0,32.01,2.48,46.81,7.05l58.79-55.44c-31.64-16.27-67.55-25.44-105.6-25.44ZM568.58,256.94l-55.47,58.82c4.56,14.73,7.01,30.4,7.01,46.64,0,87.11-70.6,157.72-157.72,157.72-12.99,0-25.64-1.58-37.72-4.53l-55.5,58.82c28.52,12.55,60.03,19.53,93.22,19.53,127.88,0,231.54-103.66,231.54-231.54,0-37.99-9.16-73.86-25.37-105.47Z"
            />
          </svg>
          <svg
            className="h-6 w-6 animate-spin"
            style={{ color: 'var(--brand-default)' }}
            viewBox="0 0 24 24"
            fill="none"
          >
            <circle
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              className="opacity-25"
            />
            <path
              d="M4 12a8 8 0 018-8"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
            />
          </svg>
          <p className="text-sm" style={{ color: 'var(--foreground-lighter)' }}>
            Loading...
          </p>
        </div>
      </div>
    )
  }

  if (!user) {
    return <LoginScreen />
  }

  const sidebarWidth = sidebarState === 'collapsed' ? 48 : 240
  const isExpanded = sidebarState !== 'collapsed'

  const tabs = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'explorer', label: 'Explorer' },
    { id: 'workspace', label: 'Workspace' },
    { id: 'docs', label: 'Docs' },
  ]

  return (
    <div className="flex h-full flex-col" style={{ background: 'var(--background-default)' }}>
      {/* Title bar */}
      <header
        className="flex h-12 shrink-0 items-center px-3"
        style={{
          background: 'var(--background-dash-sidebar)',
          borderBottom: '1px solid var(--border-default)',
        }}
        data-tauri-drag-region
      >
        {/* Left: File Menu + Logo */}
        <div className="flex items-center gap-2">
          {/* File Menu */}
          <div className="relative" ref={fileMenuRef}>
            <button
              onClick={() => setFileMenuOpen(!fileMenuOpen)}
              className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors"
              style={{
                color: fileMenuOpen ? 'var(--foreground-default)' : 'var(--foreground-lighter)',
                background: fileMenuOpen ? 'var(--background-surface-200)' : 'transparent',
              }}
              onMouseEnter={(e) => {
                if (!fileMenuOpen) {
                  e.currentTarget.style.background = 'var(--background-surface-100)'
                  e.currentTarget.style.color = 'var(--foreground-light)'
                }
              }}
              onMouseLeave={(e) => {
                if (!fileMenuOpen) {
                  e.currentTarget.style.background = 'transparent'
                  e.currentTarget.style.color = 'var(--foreground-lighter)'
                }
              }}
            >
              File
              <svg
                className="h-3 w-3"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <path d="M4 6l4 4 4-4" />
              </svg>
            </button>

            {fileMenuOpen && (
              <div
                className="absolute left-0 top-full mt-1 w-72 rounded-lg py-1 shadow-xl"
                style={{
                  background: 'var(--background-overlay-default)',
                  border: '1px solid var(--border-overlay)',
                  zIndex: 100,
                }}
              >
                <FileMenuItem
                  label="Open Workspace..."
                  shortcut={`${navigator.platform?.includes('Mac') ? '\u2318' : 'Ctrl+'}O`}
                  onClick={handleOpenWorkspace}
                />
                <FileMenuItem
                  label="Open File..."
                  shortcut={`${navigator.platform?.includes('Mac') ? '\u2318\u21E7' : 'Ctrl+Shift+'}O`}
                  onClick={handleOpenFile}
                />
                <div style={{ borderTop: '1px solid var(--border-default)', margin: '4px 0' }} />

                {/* Recent Workspaces */}
                <div className="px-3 py-1">
                  <span
                    className="text-[10px] font-medium uppercase tracking-wider"
                    style={{ color: 'var(--foreground-muted)' }}
                  >
                    Recent Workspaces
                  </span>
                </div>
                {recentWorkspaces.length > 0 ? (
                  recentWorkspaces.slice(0, 5).map((w) => (
                    <button
                      key={w.path}
                      className="flex w-full items-center gap-2 px-3 py-1.5 text-left transition-colors"
                      style={{ color: 'var(--foreground-light)' }}
                      onClick={() => handleOpenRecentWorkspace(w.path)}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'var(--background-overlay-hover)'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent'
                      }}
                    >
                      <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none">
                        <path
                          d="M2 6V20C2 21.1 2.9 22 4 22H20C21.1 22 22 21.1 22 20V8C22 6.9 21.1 6 20 6H12L10 4H4C2.9 4 2 4.9 2 6Z"
                          fill="#90a4ae"
                        />
                      </svg>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium truncate">{w.name}</div>
                        <div
                          className="text-[10px] truncate"
                          style={{ color: 'var(--foreground-muted)' }}
                        >
                          {w.path}
                        </div>
                      </div>
                      <span
                        className="text-[10px] shrink-0"
                        style={{ color: 'var(--foreground-muted)' }}
                      >
                        {formatRecentDate(w.lastOpened)}
                      </span>
                    </button>
                  ))
                ) : (
                  <div className="px-3 py-2 text-xs" style={{ color: 'var(--foreground-muted)' }}>
                    No recent workspaces
                  </div>
                )}

                <div style={{ borderTop: '1px solid var(--border-default)', margin: '4px 0' }} />
                <FileMenuItem
                  label="Save"
                  shortcut={`${navigator.platform?.includes('Mac') ? '\u2318' : 'Ctrl+'}S`}
                  onClick={() => setFileMenuOpen(false)}
                  disabled={activeTab !== 'editor'}
                />
                <FileMenuItem
                  label="Close Workspace"
                  onClick={handleCloseWorkspace}
                  disabled={!workspacePath}
                />
              </div>
            )}
          </div>

          <div className="h-4 w-px" style={{ background: 'var(--border-default)' }} />

          {/* Logo */}
          <svg
            className="h-6 w-6 shrink-0"
            viewBox="0 0 725.06 724.82"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <linearGradient
                id="logo-grad-h"
                x1="671.57"
                y1="599.9"
                x2="188.27"
                y2="219.43"
                gradientUnits="userSpaceOnUse"
              >
                <stop offset="0" stopColor="#a900ff" />
                <stop offset="1" stopColor="#00e5ff" />
              </linearGradient>
            </defs>
            <path
              fill="url(#logo-grad-h)"
              d="M670.75,54.19c-8.34-8.34-21.81-8.54-30.39-.45L61.86,599.32c-6.59,6.22-11.12,14.18-13.08,23.03-3.36,15.13,1.17,30.71,12.14,41.68,8.58,8.58,19.99,13.22,31.8,13.22,3.28,0,6.59-.36,9.87-1.09,8.84-1.96,16.81-6.49,23.03-13.08L671.19,84.58c8.09-8.58,7.9-22.05-.45-30.39Z"
            />
            <path
              fill="url(#logo-grad-h)"
              d="M661.8,158.12l-54.6,57.88c25.67,42.78,40.44,92.88,40.44,146.41,0,157.51-127.72,285.23-285.23,285.23-47.55,0-92.41-11.64-131.84-32.28l-54.56,57.88c54.46,32.75,118.25,51.58,186.41,51.58,200.16,0,362.41-162.25,362.41-362.41,0-75.77-23.25-146.11-63.02-204.29ZM362.41,77.18c53.59,0,103.72,14.8,146.54,40.54l57.88-54.6C508.65,23.29,438.25,0,362.41,0,162.25,0,0,162.25,0,362.41c0,68.22,18.86,132.04,51.68,186.54l57.85-54.56c-20.67-39.46-32.35-84.36-32.35-131.98,0-157.51,127.72-285.23,285.23-285.23Z"
            />
            <path
              fill="url(#logo-grad-h)"
              d="M362.41,130.87c-127.88,0-231.54,103.66-231.54,231.54,0,33.22,6.98,64.8,19.6,93.35l58.82-55.47c-3.02-12.15-4.6-24.83-4.6-37.89,0-87.11,70.6-157.72,157.72-157.72,16.31,0,32.01,2.48,46.81,7.05l58.79-55.44c-31.64-16.27-67.55-25.44-105.6-25.44ZM568.58,256.94l-55.47,58.82c4.56,14.73,7.01,30.4,7.01,46.64,0,87.11-70.6,157.72-157.72,157.72-12.99,0-25.64-1.58-37.72-4.53l-55.5,58.82c28.52,12.55,60.03,19.53,93.22,19.53,127.88,0,231.54-103.66,231.54-231.54,0-37.99-9.16-73.86-25.37-105.47Z"
            />
          </svg>
          <span className="text-sm font-semibold" style={{ color: 'var(--foreground-default)' }}>
            Orchestra
          </span>
          {version && (
            <span
              className="rounded px-1.5 py-0.5 text-[10px] font-medium"
              style={{ background: 'var(--brand-400)', color: 'var(--brand-default)' }}
            >
              v{version}
            </span>
          )}

          {/* Breadcrumb for editor */}
          {activeTab === 'editor' && editorFilePath && (
            <>
              <span className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
                /
              </span>
              <span
                className="text-xs truncate max-w-[300px]"
                style={{ color: 'var(--foreground-lighter)' }}
              >
                {editorFilePath.split('/').pop()}
              </span>
            </>
          )}
        </div>

        {/* Right: Spotlight + User dropdown */}
        <div className="ml-auto flex items-center gap-2">
          {/* Spotlight trigger */}
          <button
            onClick={() => setCommandPaletteOpen(true)}
            className="flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs transition-colors"
            style={{
              background: 'var(--background-surface-100)',
              border: '1px solid var(--border-default)',
              color: 'var(--foreground-lighter)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--border-strong)'
              e.currentTarget.style.color = 'var(--foreground-light)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--border-default)'
              e.currentTarget.style.color = 'var(--foreground-lighter)'
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
              <circle cx="7" cy="7" r="4.5" />
              <path d="M10.5 10.5L14 14" />
            </svg>
            <span>Actions</span>
            <kbd
              style={{
                background: 'var(--background-surface-300)',
                border: '1px solid var(--border-strong)',
                borderRadius: 'var(--border-radius-sm)',
                color: 'var(--foreground-muted)',
                padding: '1px 5px',
                fontSize: '9px',
                fontWeight: 500,
              }}
            >
              {navigator.platform?.includes('Mac') ? '\u2318K' : 'Ctrl+K'}
            </kbd>
          </button>

          {/* User avatar dropdown */}
          <div className="relative" ref={userMenuRef}>
            <button
              onClick={() => setUserMenuOpen((prev) => !prev)}
              className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition-colors"
              style={{
                background: 'var(--brand-400)',
                color: 'var(--brand-default)',
                border: userMenuOpen ? '2px solid var(--brand-default)' : '2px solid transparent',
              }}
              onMouseEnter={(e) => {
                if (!userMenuOpen) e.currentTarget.style.borderColor = 'var(--border-stronger)'
              }}
              onMouseLeave={(e) => {
                if (!userMenuOpen) e.currentTarget.style.borderColor = 'transparent'
              }}
              title={user.email ?? 'User menu'}
            >
              {(user.email ?? 'U')[0].toUpperCase()}
            </button>

            {userMenuOpen && (
              <div
                className="absolute right-0 top-full mt-2 w-64 rounded-lg py-1 shadow-xl"
                style={{
                  background: 'var(--background-overlay-default)',
                  border: '1px solid var(--border-overlay)',
                  zIndex: 50,
                }}
              >
                <div
                  className="px-3 py-2.5"
                  style={{ borderBottom: '1px solid var(--border-default)' }}
                >
                  <p
                    className="text-[10px] uppercase tracking-wider"
                    style={{ color: 'var(--foreground-muted)' }}
                  >
                    Signed in as
                  </p>
                  <p
                    className="mt-0.5 truncate text-sm font-medium"
                    style={{ color: 'var(--foreground-default)' }}
                  >
                    {user.email}
                  </p>
                </div>
                <div className="py-1">
                  <DropdownItem
                    icon={<SettingsIcon />}
                    label="Settings"
                    onClick={() => {
                      setUserMenuOpen(false)
                      setActiveTab('settings')
                    }}
                  />
                  <DropdownItem
                    icon={<McpIcon />}
                    label="MCP Connection"
                    onClick={() => {
                      setUserMenuOpen(false)
                      setActiveTab('mcp')
                    }}
                  />
                </div>
                <div style={{ borderTop: '1px solid var(--border-default)' }} className="py-1">
                  <DropdownItem
                    icon={<LogoutIcon />}
                    label="Sign Out"
                    danger
                    onClick={() => {
                      setUserMenuOpen(false)
                      signOut()
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar — Collapsed by default, expands on hover or pin */}
        <nav
          ref={sidebarRef}
          className="flex shrink-0 flex-col"
          style={{
            width: `${sidebarWidth}px`,
            transition: 'width 200ms cubic-bezier(0.4, 0, 0.2, 1)',
            background: 'var(--background-dash-sidebar)',
            borderRight: '1px solid var(--border-default)',
            overflow: 'hidden',
          }}
          onMouseEnter={handleSidebarMouseEnter}
          onMouseLeave={handleSidebarMouseLeave}
        >
          {/* Navigation items */}
          <div className="flex-1 py-2">
            {tabs.map((tab) => {
              const isActive =
                activeTab === tab.id ||
                (tab.id === 'workspace' && activeTab === 'editor') ||
                (tab.id === 'explorer' && activeTab === 'editor')
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors"
                  style={{
                    background: isActive ? 'var(--background-surface-200)' : 'transparent',
                    color: isActive ? 'var(--foreground-default)' : 'var(--foreground-lighter)',
                    fontWeight: isActive ? 500 : 400,
                    fontSize: '13px',
                    minHeight: '36px',
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.background = 'var(--background-surface-100)'
                      e.currentTarget.style.color = 'var(--foreground-light)'
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.background = 'transparent'
                      e.currentTarget.style.color = 'var(--foreground-lighter)'
                    }
                  }}
                  title={!isExpanded ? tab.label : undefined}
                >
                  <SidebarTabIcon id={tab.id} />
                  {isExpanded && <span className="truncate whitespace-nowrap">{tab.label}</span>}
                </button>
              )
            })}

            {/* Separator */}
            {isExpanded && (
              <div className="mx-3 my-2" style={{ borderTop: '1px solid var(--border-default)' }} />
            )}

            {/* Workspace path when expanded */}
            {isExpanded && workspacePath && (
              <div className="px-3 py-1">
                <div
                  className="text-[10px] font-medium uppercase tracking-wider"
                  style={{ color: 'var(--foreground-muted)' }}
                >
                  Workspace
                </div>
                <div
                  className="mt-1 text-xs truncate"
                  style={{ color: 'var(--foreground-lighter)' }}
                  title={workspacePath}
                >
                  {workspacePath.split('/').pop()}
                </div>
              </div>
            )}
          </div>

          {/* Bottom: Connection status + toggle */}
          <div className="mt-auto">
            {/* Connection indicator */}
            <div
              className="flex items-center gap-2 px-3 py-2"
              title={!isExpanded ? (supabaseConnected ? 'Connected' : 'Disconnected') : undefined}
            >
              <div
                className="h-2 w-2 shrink-0 rounded-full"
                style={{
                  background: supabaseConnected
                    ? 'var(--status-online)'
                    : 'var(--destructive-default)',
                }}
              />
              {isExpanded && (
                <span className="text-xs" style={{ color: 'var(--foreground-light)' }}>
                  {supabaseConnected ? 'Connected' : 'Disconnected'}
                </span>
              )}
            </div>

            {/* Collapse/Expand toggle */}
            <button
              onClick={toggleSidebarPin}
              className="flex w-full items-center gap-2 px-3 py-2.5 transition-colors"
              style={{
                color: 'var(--foreground-muted)',
                borderTop: '1px solid var(--border-default)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--background-surface-100)'
                e.currentTarget.style.color = 'var(--foreground-light)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent'
                e.currentTarget.style.color = 'var(--foreground-muted)'
              }}
              title={sidebarPinned ? 'Collapse sidebar' : 'Pin sidebar open'}
            >
              <svg
                className="h-4 w-4 shrink-0 transition-transform"
                style={{ transform: sidebarPinned ? 'rotate(180deg)' : 'rotate(0deg)' }}
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M4 2l6 6-6 6" />
              </svg>
              {isExpanded && (
                <span className="text-xs whitespace-nowrap">
                  {sidebarPinned ? 'Collapse' : 'Pin open'}
                </span>
              )}
            </button>
          </div>
        </nav>

        {/* Main content */}
        <main
          className={`flex-1 overflow-auto ${activeTab === 'editor' || activeTab === 'workspace' || activeTab === 'explorer' || activeTab === 'docs' ? '' : 'p-6'}`}
          style={{ background: 'var(--background-dash-canvas)' }}
        >
          {activeTab === 'dashboard' && <Dashboard />}

          {activeTab === 'explorer' && workspacePath && (
            <Explorer
              workspacePath={workspacePath}
              onOpenFile={(path) => {
                setEditorFilePath(path)
                // Stay on explorer with preview — single click
              }}
              onEditFile={(path) => {
                setEditorFilePath(path)
                setActiveTab('editor')
              }}
            />
          )}

          {activeTab === 'explorer' && !workspacePath && (
            <WelcomePage
              recentWorkspaces={recentWorkspaces}
              onOpenWorkspace={async (path) => {
                setWorkspacePath(path)
                setEditorFilePath(null)
                const updated = await addRecentWorkspace(path)
                setRecentWorkspaces(updated)
                if (prefs) {
                  const p = { ...prefs, lastWorkspacePath: path }
                  setPrefs(p)
                  savePreferences(p)
                }
              }}
              onSelectFolder={async () => {
                try {
                  const selected = await tauriOpen({ directory: true, multiple: false })
                  if (selected && typeof selected === 'string') {
                    setWorkspacePath(selected)
                    setEditorFilePath(null)
                    const updated = await addRecentWorkspace(selected)
                    setRecentWorkspaces(updated)
                    if (prefs) {
                      const p = { ...prefs, lastWorkspacePath: selected }
                      setPrefs(p)
                      savePreferences(p)
                    }
                  }
                } catch (e) {
                  console.error('Failed to open workspace:', e)
                }
              }}
            />
          )}

          {activeTab === 'workspace' && (
            <WorkspaceManager
              externalWorkspacePath={workspacePath}
              onWorkspacePathChange={(path) => {
                setWorkspacePath(path)
                if (path) {
                  addRecentWorkspace(path).then(setRecentWorkspaces)
                  if (prefs) {
                    const p = { ...prefs, lastWorkspacePath: path }
                    setPrefs(p)
                    savePreferences(p)
                  }
                }
              }}
              onOpenFile={handleWorkspaceFileOpen}
            />
          )}

          {activeTab === 'editor' && <MarkdownEditor initialFilePath={editorFilePath} />}

          {activeTab === 'docs' && <DocsPage />}

          {activeTab === 'mcp' && <McpConnector />}

          {activeTab === 'settings' && <SettingsPage />}
        </main>
      </div>

      {/* Command Palette */}
      <CommandPalette
        open={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        onNavigate={handleNavigate}
        activeTab={activeTab}
        workspacePath={workspacePath}
        onOpenFile={handlePaletteOpenFile}
        onRunAction={handleActionRun}
        onManageActions={() => setSmartActionSettingsOpen(true)}
      />

      {/* Smart Action Output Panel */}
      <ActionOutput
        runs={actionRuns}
        visible={actionOutputVisible}
        onClear={() => setActionRuns([])}
        onClose={() => setActionOutputVisible(false)}
      />

      {/* Smart Action Settings / Manager */}
      <SmartActionSettings
        open={smartActionSettingsOpen}
        onClose={() => setSmartActionSettingsOpen(false)}
      />
    </div>
  )
}

// ─── Helper Components ─────────────────────────────────────────

function SidebarTabIcon({ id }: { id: string }) {
  const cls = 'h-4 w-4 shrink-0'
  switch (id) {
    case 'dashboard':
      return (
        <svg
          className={cls}
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
      )
    case 'explorer':
      return (
        <svg
          className={cls}
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M3 1h7l3 3v11H3V1Z" />
          <path d="M10 1v3h3" />
          <path d="M5 8h6M5 10h4" />
        </svg>
      )
    case 'workspace':
      return (
        <svg
          className={cls}
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M2 3h3l1 1h7a1 1 0 011 1v7a1 1 0 01-1 1H3a1 1 0 01-1-1V3Z" />
        </svg>
      )
    case 'docs':
      return (
        <svg
          className={cls}
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M2 2h4.5c1 0 1.5.5 1.5 1.5V14L6.5 13H2V2ZM14 2H9.5C8.5 2 8 2.5 8 3.5V14l1.5-1H14V2Z" />
        </svg>
      )
    default:
      return null
  }
}

function SettingsIcon() {
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
      <circle cx="8" cy="8" r="2.5" />
      <path d="M8 1V3M8 13V15M1 8H3M13 8H15M2.9 2.9L4.3 4.3M11.7 11.7L13.1 13.1M13.1 2.9L11.7 4.3M4.3 11.7L2.9 13.1" />
    </svg>
  )
}

function McpIcon() {
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
      <circle cx="4" cy="8" r="2" />
      <circle cx="12" cy="4" r="2" />
      <circle cx="12" cy="12" r="2" />
      <path d="M6 8L10 5M6 8L10 11" />
    </svg>
  )
}

function LogoutIcon() {
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
      <path d="M6 14H3a1 1 0 01-1-1V3a1 1 0 011-1h3" />
      <path d="M10 11l3-3-3-3" />
      <path d="M13 8H6" />
    </svg>
  )
}

function DropdownItem({
  icon,
  label,
  danger,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  danger?: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors"
      style={{ color: danger ? 'var(--foreground-lighter)' : 'var(--foreground-light)' }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'var(--background-overlay-hover)'
        e.currentTarget.style.color = danger
          ? 'var(--destructive-default)'
          : 'var(--foreground-default)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent'
        e.currentTarget.style.color = danger
          ? 'var(--foreground-lighter)'
          : 'var(--foreground-light)'
      }}
    >
      {icon}
      {label}
    </button>
  )
}

function FileMenuItem({
  label,
  shortcut,
  onClick,
  disabled,
}: {
  label: string
  shortcut?: string
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      onClick={disabled ? undefined : onClick}
      className="flex w-full items-center justify-between px-3 py-1.5 text-left text-xs transition-colors"
      style={{
        color: disabled ? 'var(--foreground-muted)' : 'var(--foreground-light)',
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.5 : 1,
      }}
      onMouseEnter={(e) => {
        if (!disabled) {
          e.currentTarget.style.background = 'var(--background-overlay-hover)'
          e.currentTarget.style.color = 'var(--foreground-default)'
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent'
        e.currentTarget.style.color = disabled
          ? 'var(--foreground-muted)'
          : 'var(--foreground-light)'
      }}
    >
      <span>{label}</span>
      {shortcut && (
        <kbd className="text-[10px] font-medium" style={{ color: 'var(--foreground-muted)' }}>
          {shortcut}
        </kbd>
      )}
    </button>
  )
}

function formatRecentDate(iso: string): string {
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

function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  )
}

export default App
