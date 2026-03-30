// Settings persistence via Tauri Store plugin
// Stores settings as JSON on disk at $APPDATA/settings.json

import { load, type Store } from '@tauri-apps/plugin-store'
import { useCallback, useEffect, useRef, useState } from 'react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ConnectionSettings {
  supabaseUrl: string
  supabaseAnonKey: string
  mcpServerUrl: string
  mcpToken: string
}

export type ThemeMode = 'dark' | 'light' | 'system'
export type SidebarPosition = 'left' | 'right'
export type EditorFont =
  | 'ui-monospace'
  | 'SF Mono'
  | 'Cascadia Code'
  | 'Fira Code'
  | 'JetBrains Mono'
  | 'Source Code Pro'

export interface AppearanceSettings {
  theme: ThemeMode
  sidebarPosition: SidebarPosition
  fontSize: number
  editorFont: EditorFont
}

export interface AppSettings {
  connection: ConnectionSettings
  appearance: AppearanceSettings
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

export const DEFAULT_SETTINGS: AppSettings = {
  connection: {
    supabaseUrl: 'http://localhost:8000',
    supabaseAnonKey: '',
    mcpServerUrl: 'http://localhost:9999',
    mcpToken: '',
  },
  appearance: {
    theme: 'dark',
    sidebarPosition: 'left',
    fontSize: 14,
    editorFont: 'ui-monospace',
  },
}

// ---------------------------------------------------------------------------
// Store singleton
// ---------------------------------------------------------------------------

let storePromise: Promise<Store> | null = null

function getStore(): Promise<Store> {
  if (!storePromise) {
    storePromise = load('settings.json', {
      autoSave: true,
      defaults: {
        connection: DEFAULT_SETTINGS.connection,
        appearance: DEFAULT_SETTINGS.appearance,
      },
    })
  }
  return storePromise
}

// ---------------------------------------------------------------------------
// Load / Save
// ---------------------------------------------------------------------------

export async function loadSettings(): Promise<AppSettings> {
  try {
    const store = await getStore()
    const connection = await store.get<ConnectionSettings>('connection')
    const appearance = await store.get<AppearanceSettings>('appearance')

    return {
      connection: connection
        ? { ...DEFAULT_SETTINGS.connection, ...connection }
        : { ...DEFAULT_SETTINGS.connection },
      appearance: appearance
        ? { ...DEFAULT_SETTINGS.appearance, ...appearance }
        : { ...DEFAULT_SETTINGS.appearance },
    }
  } catch (err) {
    console.warn('Failed to load settings, using defaults:', err)
    return { ...DEFAULT_SETTINGS }
  }
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  const store = await getStore()
  await store.set('connection', settings.connection)
  await store.set('appearance', settings.appearance)
  await store.save()
}

// ---------------------------------------------------------------------------
// React hook
// ---------------------------------------------------------------------------

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    loadSettings().then((s) => {
      setSettings(s)
      setLoading(false)
    })
  }, [])

  const save = useCallback(async (next: AppSettings) => {
    setSaving(true)
    setSaveSuccess(false)
    try {
      await saveSettings(next)
      setSettings(next)
      setSaveSuccess(true)
      // Clear success indicator after 2 s
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      timeoutRef.current = setTimeout(() => setSaveSuccess(false), 2000)
    } finally {
      setSaving(false)
    }
  }, [])

  // Update a single section without replacing the whole object
  const updateConnection = useCallback(
    async (patch: Partial<ConnectionSettings>) => {
      const next = {
        ...settings,
        connection: { ...settings.connection, ...patch },
      }
      await save(next)
    },
    [settings, save]
  )

  const updateAppearance = useCallback(
    async (patch: Partial<AppearanceSettings>) => {
      const next = {
        ...settings,
        appearance: { ...settings.appearance, ...patch },
      }
      await save(next)
    },
    [settings, save]
  )

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  return {
    settings,
    loading,
    saving,
    saveSuccess,
    save,
    updateConnection,
    updateAppearance,
  }
}
