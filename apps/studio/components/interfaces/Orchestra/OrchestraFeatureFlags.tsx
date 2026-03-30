/**
 * Orchestra Feature Flags
 *
 * Admin GUI for managing platform-level feature flags stored in
 * the `platform_settings` table (keys prefixed with `flag_`).
 * Each flag has a scope (global, desktop, studio, laravel) and
 * a boolean value stored as 'true'/'false'.
 */

import { getOrchSupabaseClient } from 'lib/orch-auth'
import {
  Flag,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
  Badge,
  Button,
  Input_Shadcn_,
  Switch,
} from 'ui'

// ─── Types ─────────────────────────────────────────────────────────────────

type FlagScope = 'global' | 'desktop' | 'studio' | 'laravel'

interface FeatureFlag {
  key: string
  value: string
  scope: FlagScope
  is_secret: boolean
  updated_at: string
  updated_by: string | null
}

const SCOPE_OPTIONS: { value: FlagScope; label: string }[] = [
  { value: 'global', label: 'Global' },
  { value: 'desktop', label: 'Desktop' },
  { value: 'studio', label: 'Studio' },
  { value: 'laravel', label: 'Laravel' },
]

const SCOPE_COLORS: Record<FlagScope, string> = {
  global: 'bg-brand-400 text-white',
  desktop: 'bg-purple-400 text-white',
  studio: 'bg-blue-400 text-white',
  laravel: 'bg-orange-400 text-white',
}

// ─── Add Flag Form ─────────────────────────────────────────────────────────

function AddFlagForm({
  onAdd,
  onCancel,
}: {
  onAdd: (key: string, description: string, scope: FlagScope, defaultValue: boolean) => void
  onCancel: () => void
}) {
  const [key, setKey] = useState('')
  const [description, setDescription] = useState('')
  const [scope, setScope] = useState<FlagScope>('global')
  const [defaultValue, setDefaultValue] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    const sanitizedKey = key.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_')
    if (!sanitizedKey) {
      toast.error('Flag key is required')
      return
    }

    const finalKey = sanitizedKey.startsWith('flag_') ? sanitizedKey : `flag_${sanitizedKey}`
    onAdd(finalKey, description.trim(), scope, defaultValue)
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-surface-100 border rounded-lg p-4 space-y-4"
    >
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-foreground">Add New Feature Flag</h4>
        <button
          type="button"
          onClick={onCancel}
          className="p-1 rounded text-foreground-lighter hover:text-foreground hover:bg-surface-300 transition-colors"
        >
          <X size={16} />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs text-foreground-lighter mb-1 block">
            Key <span className="text-destructive">*</span>
          </label>
          <Input_Shadcn_
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="my_feature"
            className="font-mono text-sm"
            autoFocus
          />
          <p className="text-xs text-foreground-muted mt-1">
            Will be prefixed with <code className="text-xs">flag_</code> if not already
          </p>
        </div>

        <div>
          <label className="text-xs text-foreground-lighter mb-1 block">Scope</label>
          <select
            value={scope}
            onChange={(e) => setScope(e.target.value as FlagScope)}
            className="w-full rounded-md border bg-surface-200 px-3 py-2 text-sm text-foreground"
          >
            {SCOPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="text-xs text-foreground-lighter mb-1 block">Description</label>
        <Input_Shadcn_
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What this flag controls..."
          className="text-sm"
        />
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Switch
            checked={defaultValue}
            onCheckedChange={setDefaultValue}
          />
          <span className="text-sm text-foreground-lighter">
            Default: {defaultValue ? 'Enabled' : 'Disabled'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Button type="default" size="small" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="primary" size="small" htmlType="submit" icon={<Plus size={14} />}>
            Add Flag
          </Button>
        </div>
      </div>
    </form>
  )
}

// ─── Flag Row ──────────────────────────────────────────────────────────────

function FlagRow({
  flag,
  onToggle,
  onDelete,
  isUpdating,
}: {
  flag: FeatureFlag
  onToggle: (key: string, newValue: boolean) => void
  onDelete: (key: string) => void
  isUpdating: boolean
}) {
  const isEnabled = flag.value === 'true'
  // Strip the flag_ prefix for display
  const displayName = flag.key.replace(/^flag_/, '')

  return (
    <div className="flex items-center justify-between py-3 px-4 border-b last:border-b-0 group">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <Flag
          size={16}
          className={isEnabled ? 'text-brand-600' : 'text-foreground-muted'}
        />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <code className="text-sm font-mono text-foreground truncate">
              {displayName}
            </code>
            <Badge
              className={`text-[10px] px-1.5 py-0 leading-4 ${SCOPE_COLORS[flag.scope]}`}
            >
              {flag.scope}
            </Badge>
          </div>
          {flag.updated_at && (
            <p className="text-xs text-foreground-muted mt-0.5">
              Updated {new Date(flag.updated_at).toLocaleDateString()}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Switch
          checked={isEnabled}
          disabled={isUpdating}
          onCheckedChange={(checked) => onToggle(flag.key, checked)}
        />
        <button
          type="button"
          onClick={() => onDelete(flag.key)}
          className="p-1.5 rounded text-foreground-muted opacity-0 group-hover:opacity-100 hover:text-destructive hover:bg-destructive/10 transition-all"
          title="Delete flag"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  )
}

// ─── Main Component ────────────────────────────────────────────────────────

export function OrchestraFeatureFlags() {
  const [flags, setFlags] = useState<FeatureFlag[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [updatingKeys, setUpdatingKeys] = useState<Set<string>>(new Set())
  const [showAddForm, setShowAddForm] = useState(false)

  // Load flags from Supabase
  const loadFlags = useCallback(async () => {
    setIsLoading(true)
    try {
      const supabase = getOrchSupabaseClient()
      const { data, error } = await supabase
        .from('platform_settings')
        .select('key, value, is_secret, scope, updated_at, updated_by')
        .like('key', 'flag_%')
        .order('key')

      if (error) {
        if (error.code === '42P01') {
          console.warn('[Orchestra Feature Flags] platform_settings table does not exist yet')
        } else {
          toast.error(`Failed to load feature flags: ${error.message}`)
        }
        setIsLoading(false)
        return
      }

      setFlags((data as FeatureFlag[]) || [])
    } catch (err: any) {
      toast.error(`Failed to load feature flags: ${err.message}`)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadFlags()
  }, [loadFlags])

  // Toggle a flag value
  const handleToggle = useCallback(
    async (key: string, newValue: boolean) => {
      setUpdatingKeys((prev) => new Set(prev).add(key))

      try {
        const supabase = getOrchSupabaseClient()
        const { error } = await supabase
          .from('platform_settings')
          .update({ value: newValue ? 'true' : 'false' })
          .eq('key', key)

        if (error) {
          toast.error(`Failed to update flag: ${error.message}`)
          return
        }

        setFlags((prev) =>
          prev.map((f) => (f.key === key ? { ...f, value: newValue ? 'true' : 'false' } : f))
        )
        toast.success(`Flag ${key.replace('flag_', '')} ${newValue ? 'enabled' : 'disabled'}`)
      } catch (err: any) {
        toast.error(`Failed to update flag: ${err.message}`)
      } finally {
        setUpdatingKeys((prev) => {
          const next = new Set(prev)
          next.delete(key)
          return next
        })
      }
    },
    []
  )

  // Add a new flag
  const handleAdd = useCallback(
    async (key: string, _description: string, scope: FlagScope, defaultValue: boolean) => {
      try {
        const supabase = getOrchSupabaseClient()
        const { error } = await supabase.from('platform_settings').upsert(
          {
            key,
            value: defaultValue ? 'true' : 'false',
            is_secret: false,
            scope,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'key' }
        )

        if (error) {
          toast.error(`Failed to add flag: ${error.message}`)
          return
        }

        toast.success(`Flag "${key.replace('flag_', '')}" created`)
        setShowAddForm(false)
        await loadFlags()
      } catch (err: any) {
        toast.error(`Failed to add flag: ${err.message}`)
      }
    },
    [loadFlags]
  )

  // Delete a flag
  const handleDelete = useCallback(
    async (key: string) => {
      if (!confirm(`Delete flag "${key.replace('flag_', '')}"? This cannot be undone.`)) {
        return
      }

      try {
        const supabase = getOrchSupabaseClient()
        const { error } = await supabase
          .from('platform_settings')
          .delete()
          .eq('key', key)

        if (error) {
          toast.error(`Failed to delete flag: ${error.message}`)
          return
        }

        setFlags((prev) => prev.filter((f) => f.key !== key))
        toast.success(`Flag "${key.replace('flag_', '')}" deleted`)
      } catch (err: any) {
        toast.error(`Failed to delete flag: ${err.message}`)
      }
    },
    []
  )

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-foreground-lighter" size={24} />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-foreground-lighter">
          {flags.length} feature flag{flags.length !== 1 ? 's' : ''} configured
        </p>
        <div className="flex items-center gap-2">
          <Button
            type="default"
            size="small"
            onClick={loadFlags}
            icon={<RefreshCw size={14} />}
          >
            Refresh
          </Button>
          <Button
            type="primary"
            size="small"
            onClick={() => setShowAddForm(true)}
            disabled={showAddForm}
            icon={<Plus size={14} />}
          >
            Add Flag
          </Button>
        </div>
      </div>

      {/* Add Form */}
      {showAddForm && (
        <AddFlagForm
          onAdd={handleAdd}
          onCancel={() => setShowAddForm(false)}
        />
      )}

      {/* Flags List */}
      {flags.length === 0 && !showAddForm ? (
        <div className="bg-surface-100 border rounded-lg p-8 text-center">
          <Flag size={32} className="mx-auto text-foreground-muted mb-3" />
          <h3 className="text-sm font-medium text-foreground mb-1">No feature flags yet</h3>
          <p className="text-sm text-foreground-lighter mb-4">
            Feature flags let you enable or disable functionality per client scope (global,
            desktop, studio, laravel).
          </p>
          <Button
            type="primary"
            size="small"
            onClick={() => setShowAddForm(true)}
            icon={<Plus size={14} />}
          >
            Add your first flag
          </Button>
        </div>
      ) : (
        <div className="bg-surface-100 border rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b bg-surface-200">
            <div className="flex items-center justify-between text-xs text-foreground-lighter uppercase tracking-wide">
              <span>Flag</span>
              <span>Status</span>
            </div>
          </div>
          {flags.map((flag) => (
            <FlagRow
              key={flag.key}
              flag={flag}
              onToggle={handleToggle}
              onDelete={handleDelete}
              isUpdating={updatingKeys.has(flag.key)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
