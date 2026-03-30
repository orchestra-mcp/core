// Orchestra Desktop -- Smart Actions Persistent Store
//
// Uses Tauri Store plugin to persist custom smart actions and
// enabled/disabled state of built-in actions.

import { load, type Store } from '@tauri-apps/plugin-store'

import { BUILTIN_ACTIONS } from './builtin-actions'
import type { SmartAction } from './types'

const STORE_NAME = 'smart-actions.json'

// ─── Store Singleton ──────────────────────────────────────────────

let _store: Store | null = null

async function getStore(): Promise<Store> {
  if (!_store) {
    _store = await load(STORE_NAME, {
      autoSave: true,
      defaults: {
        customActions: [],
        disabledBuiltins: [],
      },
    })
  }
  return _store
}

// ─── Public API ───────────────────────────────────────────────────

/** Load all smart actions: built-in (with enabled state) + custom */
export async function loadAllActions(): Promise<SmartAction[]> {
  try {
    const store = await getStore()
    const customActions = (await store.get<SmartAction[]>('customActions')) ?? []
    const disabledBuiltins = (await store.get<string[]>('disabledBuiltins')) ?? []

    const builtins = BUILTIN_ACTIONS.map((a) => ({
      ...a,
      enabled: !disabledBuiltins.includes(a.id),
    }))

    return [...builtins, ...customActions]
  } catch (e) {
    console.warn('Failed to load smart actions:', e)
    return [...BUILTIN_ACTIONS]
  }
}

/** Save a custom action (create or update) */
export async function saveCustomAction(action: SmartAction): Promise<void> {
  const store = await getStore()
  const existing = (await store.get<SmartAction[]>('customActions')) ?? []
  const idx = existing.findIndex((a) => a.id === action.id)
  if (idx >= 0) {
    existing[idx] = action
  } else {
    existing.push(action)
  }
  await store.set('customActions', existing)
  await store.save()
}

/** Delete a custom action */
export async function deleteCustomAction(actionId: string): Promise<void> {
  const store = await getStore()
  const existing = (await store.get<SmartAction[]>('customActions')) ?? []
  const filtered = existing.filter((a) => a.id !== actionId)
  await store.set('customActions', filtered)
  await store.save()
}

/** Toggle enabled/disabled for a built-in action */
export async function toggleBuiltinEnabled(actionId: string, enabled: boolean): Promise<void> {
  const store = await getStore()
  const disabledBuiltins = (await store.get<string[]>('disabledBuiltins')) ?? []

  if (enabled) {
    const filtered = disabledBuiltins.filter((id) => id !== actionId)
    await store.set('disabledBuiltins', filtered)
  } else {
    if (!disabledBuiltins.includes(actionId)) {
      disabledBuiltins.push(actionId)
      await store.set('disabledBuiltins', disabledBuiltins)
    }
  }
  await store.save()
}

/** Export all actions as JSON string */
export async function exportActions(): Promise<string> {
  const actions = await loadAllActions()
  return JSON.stringify(actions, null, 2)
}

/** Import actions from a JSON string, returns count of imported actions */
export async function importActions(json: string): Promise<number> {
  const parsed = JSON.parse(json) as SmartAction[]
  if (!Array.isArray(parsed)) throw new Error('Invalid format: expected an array')

  const store = await getStore()
  const existing = (await store.get<SmartAction[]>('customActions')) ?? []

  let count = 0
  for (const action of parsed) {
    if (!action.id || !action.name || !action.steps) continue
    // Skip built-in actions
    if (BUILTIN_ACTIONS.some((b) => b.id === action.id)) continue

    const a: SmartAction = {
      ...action,
      builtin: false,
    }
    const idx = existing.findIndex((e) => e.id === a.id)
    if (idx >= 0) {
      existing[idx] = a
    } else {
      existing.push(a)
    }
    count++
  }

  await store.set('customActions', existing)
  await store.save()
  return count
}
