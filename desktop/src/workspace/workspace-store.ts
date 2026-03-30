// Orchestra Desktop — Workspace Persistent Store
//
// Uses Tauri Store plugin to persist workspace preferences across sessions.

import { load, type Store } from '@tauri-apps/plugin-store'

// ─── Types ────────────────────────────────────────────────────────

export type ViewMode = 'tree' | 'list' | 'grid'
export type SortMode = 'name' | 'type' | 'date' | 'size'

export interface FileCustomization {
  color?: string
  icon?: string
}

export interface RecentWorkspace {
  path: string
  name: string // folder name
  lastOpened: string // ISO date
}

export interface WorkspacePreferences {
  lastWorkspacePath: string | null
  recentWorkspaces: RecentWorkspace[]
  pinnedFiles: string[] // relative paths
  fileCustomizations: Record<string, FileCustomization> // keyed by relative path
  viewMode: ViewMode
  sortMode: SortMode
  expandedFolders: string[] // folder paths that are expanded
  sidebarCollapsed: boolean
}

const STORE_NAME = 'workspace-preferences.json'

const DEFAULT_PREFERENCES: WorkspacePreferences = {
  lastWorkspacePath: null,
  recentWorkspaces: [],
  pinnedFiles: [],
  fileCustomizations: {},
  viewMode: 'tree',
  sortMode: 'type',
  expandedFolders: [],
  sidebarCollapsed: true,
}

// ─── Store Singleton ──────────────────────────────────────────────

let _store: Store | null = null

async function getStore(): Promise<Store> {
  if (!_store) {
    _store = await load(STORE_NAME, {
      autoSave: true,
      defaults: { preferences: DEFAULT_PREFERENCES },
    })
  }
  return _store
}

// ─── Public API ───────────────────────────────────────────────────

export async function loadPreferences(): Promise<WorkspacePreferences> {
  try {
    const store = await getStore()
    const prefs = await store.get<WorkspacePreferences>('preferences')
    if (prefs) {
      return { ...DEFAULT_PREFERENCES, ...prefs }
    }
  } catch (e) {
    console.warn('Failed to load workspace preferences:', e)
  }
  return { ...DEFAULT_PREFERENCES }
}

export async function savePreferences(prefs: WorkspacePreferences): Promise<void> {
  try {
    const store = await getStore()
    await store.set('preferences', prefs)
    await store.save()
  } catch (e) {
    console.warn('Failed to save workspace preferences:', e)
  }
}

export async function updatePreferences(
  partial: Partial<WorkspacePreferences>
): Promise<WorkspacePreferences> {
  const current = await loadPreferences()
  const updated = { ...current, ...partial }
  await savePreferences(updated)
  return updated
}

// ─── Convenience Helpers ──────────────────────────────────────────

export async function togglePin(relativePath: string): Promise<string[]> {
  const prefs = await loadPreferences()
  const idx = prefs.pinnedFiles.indexOf(relativePath)
  if (idx >= 0) {
    prefs.pinnedFiles.splice(idx, 1)
  } else {
    prefs.pinnedFiles.push(relativePath)
  }
  await savePreferences(prefs)
  return prefs.pinnedFiles
}

export async function setFileColor(relativePath: string, color: string | undefined): Promise<void> {
  const prefs = await loadPreferences()
  if (!prefs.fileCustomizations[relativePath]) {
    prefs.fileCustomizations[relativePath] = {}
  }
  prefs.fileCustomizations[relativePath].color = color
  await savePreferences(prefs)
}

export async function setFileIcon(relativePath: string, icon: string | undefined): Promise<void> {
  const prefs = await loadPreferences()
  if (!prefs.fileCustomizations[relativePath]) {
    prefs.fileCustomizations[relativePath] = {}
  }
  prefs.fileCustomizations[relativePath].icon = icon
  await savePreferences(prefs)
}

export const PRESET_COLORS = [
  '#ef4444', // red
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#06b6d4', // cyan
  '#3b82f6', // blue
  '#8b5cf6', // purple
  '#ec4899', // pink
] as const

const MAX_RECENT_WORKSPACES = 10

export async function addRecentWorkspace(path: string): Promise<RecentWorkspace[]> {
  const prefs = await loadPreferences()
  const name = path.split('/').pop() || path
  const entry: RecentWorkspace = {
    path,
    name,
    lastOpened: new Date().toISOString(),
  }
  // Remove existing entry for same path
  const filtered = prefs.recentWorkspaces.filter((w) => w.path !== path)
  // Prepend new entry
  const updated = [entry, ...filtered].slice(0, MAX_RECENT_WORKSPACES)
  prefs.recentWorkspaces = updated
  await savePreferences(prefs)
  return updated
}

export async function getRecentWorkspaces(): Promise<RecentWorkspace[]> {
  const prefs = await loadPreferences()
  return prefs.recentWorkspaces || []
}

export async function setSidebarCollapsed(collapsed: boolean): Promise<void> {
  const prefs = await loadPreferences()
  prefs.sidebarCollapsed = collapsed
  await savePreferences(prefs)
}
