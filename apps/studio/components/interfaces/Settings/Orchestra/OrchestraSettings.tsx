/**
 * Orchestra Platform Settings
 *
 * Admin GUI for configuring MCP server, auth keys, OAuth providers,
 * SMTP, storage, and Cloudflare settings. Reads/writes to the
 * `platform_settings` table in Supabase.
 */

import { useParams } from 'common'
import { Copy, Eye, EyeOff, Loader2, RefreshCw, Save, AlertTriangle } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button, Input_Shadcn_, Switch } from 'ui'
import { getOrchSupabaseClient, ORCH_AUTH_ENABLED } from 'lib/orch-auth'

// ─── Types ─────────────────────────────────────────────────────────────────

interface PlatformSetting {
  key: string
  value: string
  is_secret: boolean
  updated_at: string
  updated_by: string | null
}

interface SettingFieldProps {
  label: string
  settingKey: string
  value: string
  onChange: (key: string, value: string) => void
  type?: 'text' | 'password' | 'number'
  placeholder?: string
  description?: string
  isSecret?: boolean
}

// ─── Setting Field Component ────────────────────────────────────────────────

function SettingField({
  label,
  settingKey,
  value,
  onChange,
  type = 'text',
  placeholder,
  description,
  isSecret = false,
}: SettingFieldProps) {
  const [visible, setVisible] = useState(false)
  const actualType = type === 'password' && visible ? 'text' : type

  const handleCopy = useCallback(() => {
    if (value) {
      navigator.clipboard.writeText(value)
      toast.success(`Copied ${label} to clipboard`)
    }
  }, [value, label])

  return (
    <div className="grid grid-cols-12 gap-4 items-start py-3">
      <div className="col-span-4">
        <label className="text-sm text-foreground">{label}</label>
        {description && (
          <p className="text-xs text-foreground-lighter mt-0.5">{description}</p>
        )}
      </div>
      <div className="col-span-8 flex gap-2">
        <div className="relative flex-1">
          <Input_Shadcn_
            type={actualType}
            value={value}
            onChange={(e) => onChange(settingKey, e.target.value)}
            placeholder={placeholder}
            className="w-full pr-16 font-mono text-sm"
          />
          <div className="absolute right-1 top-1/2 -translate-y-1/2 flex gap-0.5">
            {type === 'password' && (
              <button
                type="button"
                onClick={() => setVisible(!visible)}
                className="p-1.5 rounded text-foreground-lighter hover:text-foreground hover:bg-surface-300 transition-colors"
                title={visible ? 'Hide' : 'Show'}
              >
                {visible ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            )}
            {isSecret && value && (
              <button
                type="button"
                onClick={handleCopy}
                className="p-1.5 rounded text-foreground-lighter hover:text-foreground hover:bg-surface-300 transition-colors"
                title="Copy to clipboard"
              >
                <Copy size={14} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Toggle Field Component ─────────────────────────────────────────────────

function ToggleField({
  label,
  settingKey,
  value,
  onChange,
  description,
}: {
  label: string
  settingKey: string
  value: boolean
  onChange: (key: string, value: string) => void
  description?: string
}) {
  return (
    <div className="grid grid-cols-12 gap-4 items-center py-3">
      <div className="col-span-4">
        <label className="text-sm text-foreground">{label}</label>
        {description && (
          <p className="text-xs text-foreground-lighter mt-0.5">{description}</p>
        )}
      </div>
      <div className="col-span-8">
        <Switch
          checked={value}
          onCheckedChange={(checked) => onChange(settingKey, checked ? 'true' : 'false')}
        />
      </div>
    </div>
  )
}

// ─── Section Component ──────────────────────────────────────────────────────

function SettingsSection({
  title,
  description,
  children,
  onSave,
  isSaving,
  hasChanges,
}: {
  title: string
  description?: string
  children: React.ReactNode
  onSave: () => void
  isSaving: boolean
  hasChanges: boolean
}) {
  return (
    <div className="bg-surface-100 border rounded-lg overflow-hidden">
      <div className="px-6 py-4 border-b">
        <h3 className="text-base font-medium text-foreground">{title}</h3>
        {description && (
          <p className="text-sm text-foreground-lighter mt-0.5">{description}</p>
        )}
      </div>
      <div className="px-6 py-2 divide-y divide-border">
        {children}
      </div>
      <div className="px-6 py-3 border-t bg-surface-200 flex items-center justify-between">
        <p className="text-xs text-foreground-muted flex items-center gap-1.5">
          <AlertTriangle size={12} />
          Some changes require service restart to take effect
        </p>
        <Button
          type="primary"
          size="small"
          onClick={onSave}
          loading={isSaving}
          disabled={!hasChanges || isSaving}
          icon={<Save size={14} />}
        >
          Save
        </Button>
      </div>
    </div>
  )
}

// ─── Main Component ─────────────────────────────────────────────────────────

export function OrchestraSettings() {
  const [settings, setSettings] = useState<Record<string, string>>({})
  const [originalSettings, setOriginalSettings] = useState<Record<string, string>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [savingSections, setSavingSections] = useState<Record<string, boolean>>({})

  // Load settings from Supabase
  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    setIsLoading(true)
    try {
      const supabase = getOrchSupabaseClient()
      const { data, error } = await supabase
        .from('platform_settings')
        .select('key, value, is_secret')

      if (error) {
        // Table might not exist yet -- that's OK, we'll create it on first save
        if (error.code === '42P01') {
          console.warn('[Orchestra Settings] platform_settings table does not exist yet')
        } else {
          toast.error(`Failed to load settings: ${error.message}`)
        }
        setIsLoading(false)
        return
      }

      const settingsMap: Record<string, string> = {}
      for (const row of data || []) {
        settingsMap[row.key] = row.value
      }

      setSettings(settingsMap)
      setOriginalSettings({ ...settingsMap })
    } catch (err: any) {
      toast.error(`Failed to load settings: ${err.message}`)
    } finally {
      setIsLoading(false)
    }
  }

  const updateSetting = useCallback((key: string, value: string) => {
    setSettings((prev) => ({ ...prev, [key]: value }))
  }, [])

  const getSectionChanges = useCallback(
    (keys: string[]) => {
      return keys.some((k) => (settings[k] ?? '') !== (originalSettings[k] ?? ''))
    },
    [settings, originalSettings]
  )

  const saveSection = useCallback(
    async (sectionId: string, keys: string[], secretKeys: string[] = []) => {
      setSavingSections((prev) => ({ ...prev, [sectionId]: true }))

      try {
        const supabase = getOrchSupabaseClient()

        // Upsert each changed key
        const changedKeys = keys.filter(
          (k) => (settings[k] ?? '') !== (originalSettings[k] ?? '')
        )

        if (changedKeys.length === 0) {
          toast('No changes to save')
          return
        }

        const rows = changedKeys.map((key) => ({
          key,
          value: settings[key] ?? '',
          is_secret: secretKeys.includes(key),
          updated_at: new Date().toISOString(),
        }))

        const { error } = await supabase
          .from('platform_settings')
          .upsert(rows, { onConflict: 'key' })

        if (error) {
          toast.error(`Failed to save: ${error.message}`)
          return
        }

        // Update original to reflect saved state
        setOriginalSettings((prev) => {
          const updated = { ...prev }
          for (const key of changedKeys) {
            updated[key] = settings[key] ?? ''
          }
          return updated
        })

        toast.success('Settings saved successfully')
      } catch (err: any) {
        toast.error(`Failed to save: ${err.message}`)
      } finally {
        setSavingSections((prev) => ({ ...prev, [sectionId]: false }))
      }
    },
    [settings, originalSettings]
  )

  const generateKeys = useCallback(() => {
    // Generate random 64-char hex strings for JWT/anon/service role keys
    const randomHex = (len: number) => {
      const arr = new Uint8Array(len)
      crypto.getRandomValues(arr)
      return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('')
    }

    const jwtSecret = randomHex(32)
    const anonKey = randomHex(32)
    const serviceRoleKey = randomHex(32)

    setSettings((prev) => ({
      ...prev,
      jwt_secret: jwtSecret,
      anon_key: anonKey,
      service_role_key: serviceRoleKey,
    }))

    toast.success('New keys generated (not yet saved)')
  }, [])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-foreground-lighter" size={24} />
      </div>
    )
  }

  // ─── Section Definitions ────────────────────────────────────────────────

  const mcpKeys = ['mcp_server_url', 'mcp_server_port']
  const authKeys = ['jwt_secret', 'anon_key', 'service_role_key']
  const supabaseKeys = ['supabase_url', 'postgres_connection_string']
  const githubKeys = ['github_client_id', 'github_client_secret', 'github_enabled']
  const googleKeys = ['google_client_id', 'google_client_secret', 'google_enabled']
  const smtpKeys = [
    'smtp_host',
    'smtp_port',
    'smtp_username',
    'smtp_password',
    'smtp_from_email',
    'smtp_from_name',
    'email_confirmations_enabled',
  ]
  const storageKeys = [
    'storage_backend',
    's3_bucket',
    's3_region',
    's3_access_key',
    's3_secret_key',
  ]
  const cloudflareKeys = ['cloudflare_api_token', 'cloudflare_domain']

  return (
    <div className="flex flex-col gap-6">
      {/* MCP Server Configuration */}
      <SettingsSection
        title="MCP Server Configuration"
        description="Configure the Go MCP server connection"
        onSave={() => saveSection('mcp', mcpKeys)}
        isSaving={savingSections['mcp'] ?? false}
        hasChanges={getSectionChanges(mcpKeys)}
      >
        <SettingField
          label="MCP Server URL"
          settingKey="mcp_server_url"
          value={settings['mcp_server_url'] ?? ''}
          onChange={updateSetting}
          placeholder="http://localhost:9999"
          description="Base URL of the Go MCP server"
        />
        <SettingField
          label="MCP Server Port"
          settingKey="mcp_server_port"
          value={settings['mcp_server_port'] ?? ''}
          onChange={updateSetting}
          type="number"
          placeholder="9999"
          description="Port the MCP server listens on"
        />
      </SettingsSection>

      {/* Authentication Keys */}
      <SettingsSection
        title="Authentication Keys"
        description="JWT and API key configuration for Supabase auth"
        onSave={() =>
          saveSection('auth', authKeys, ['jwt_secret', 'anon_key', 'service_role_key'])
        }
        isSaving={savingSections['auth'] ?? false}
        hasChanges={getSectionChanges(authKeys)}
      >
        <SettingField
          label="JWT Secret"
          settingKey="jwt_secret"
          value={settings['jwt_secret'] ?? ''}
          onChange={updateSetting}
          type="password"
          isSecret
          placeholder="your-jwt-secret"
          description="Used to sign and verify JWTs"
        />
        <SettingField
          label="Anon Key"
          settingKey="anon_key"
          value={settings['anon_key'] ?? ''}
          onChange={updateSetting}
          type="password"
          isSecret
          placeholder="your-anon-key"
          description="Public anonymous API key"
        />
        <SettingField
          label="Service Role Key"
          settingKey="service_role_key"
          value={settings['service_role_key'] ?? ''}
          onChange={updateSetting}
          type="password"
          isSecret
          placeholder="your-service-role-key"
          description="Server-side key with elevated privileges"
        />
        <div className="py-3">
          <Button
            type="default"
            size="small"
            onClick={generateKeys}
            icon={<RefreshCw size={14} />}
          >
            Generate New Keys
          </Button>
        </div>
      </SettingsSection>

      {/* Supabase Connection */}
      <SettingsSection
        title="Supabase Connection"
        description="Database and API connection settings"
        onSave={() =>
          saveSection('supabase', supabaseKeys, ['postgres_connection_string'])
        }
        isSaving={savingSections['supabase'] ?? false}
        hasChanges={getSectionChanges(supabaseKeys)}
      >
        <SettingField
          label="Supabase URL"
          settingKey="supabase_url"
          value={settings['supabase_url'] ?? ''}
          onChange={updateSetting}
          placeholder="http://localhost:8000"
          description="Kong gateway URL for Supabase"
        />
        <SettingField
          label="PostgreSQL Connection String"
          settingKey="postgres_connection_string"
          value={settings['postgres_connection_string'] ?? ''}
          onChange={updateSetting}
          type="password"
          isSecret
          placeholder="postgresql://postgres:password@localhost:5432/postgres"
          description="Direct database connection"
        />
      </SettingsSection>

      {/* OAuth: GitHub */}
      <SettingsSection
        title="GitHub OAuth Provider"
        description="Enable GitHub login via Supabase GoTrue"
        onSave={() =>
          saveSection('github', githubKeys, ['github_client_secret'])
        }
        isSaving={savingSections['github'] ?? false}
        hasChanges={getSectionChanges(githubKeys)}
      >
        <ToggleField
          label="Enable GitHub Auth"
          settingKey="github_enabled"
          value={(settings['github_enabled'] ?? 'false') === 'true'}
          onChange={updateSetting}
          description="GOTRUE_EXTERNAL_GITHUB_ENABLED"
        />
        <SettingField
          label="Client ID"
          settingKey="github_client_id"
          value={settings['github_client_id'] ?? ''}
          onChange={updateSetting}
          placeholder="GitHub OAuth App Client ID"
        />
        <SettingField
          label="Client Secret"
          settingKey="github_client_secret"
          value={settings['github_client_secret'] ?? ''}
          onChange={updateSetting}
          type="password"
          isSecret
          placeholder="GitHub OAuth App Client Secret"
        />
      </SettingsSection>

      {/* OAuth: Google */}
      <SettingsSection
        title="Google OAuth Provider"
        description="Enable Google login via Supabase GoTrue"
        onSave={() =>
          saveSection('google', googleKeys, ['google_client_secret'])
        }
        isSaving={savingSections['google'] ?? false}
        hasChanges={getSectionChanges(googleKeys)}
      >
        <ToggleField
          label="Enable Google Auth"
          settingKey="google_enabled"
          value={(settings['google_enabled'] ?? 'false') === 'true'}
          onChange={updateSetting}
          description="GOTRUE_EXTERNAL_GOOGLE_ENABLED"
        />
        <SettingField
          label="Client ID"
          settingKey="google_client_id"
          value={settings['google_client_id'] ?? ''}
          onChange={updateSetting}
          placeholder="Google OAuth Client ID"
        />
        <SettingField
          label="Client Secret"
          settingKey="google_client_secret"
          value={settings['google_client_secret'] ?? ''}
          onChange={updateSetting}
          type="password"
          isSecret
          placeholder="Google OAuth Client Secret"
        />
      </SettingsSection>

      {/* Email / SMTP */}
      <SettingsSection
        title="Email / SMTP"
        description="Configure email delivery for auth confirmations"
        onSave={() =>
          saveSection('smtp', smtpKeys, ['smtp_password'])
        }
        isSaving={savingSections['smtp'] ?? false}
        hasChanges={getSectionChanges(smtpKeys)}
      >
        <SettingField
          label="SMTP Host"
          settingKey="smtp_host"
          value={settings['smtp_host'] ?? ''}
          onChange={updateSetting}
          placeholder="smtp.example.com"
        />
        <SettingField
          label="SMTP Port"
          settingKey="smtp_port"
          value={settings['smtp_port'] ?? ''}
          onChange={updateSetting}
          type="number"
          placeholder="587"
        />
        <SettingField
          label="SMTP Username"
          settingKey="smtp_username"
          value={settings['smtp_username'] ?? ''}
          onChange={updateSetting}
          placeholder="your-smtp-username"
        />
        <SettingField
          label="SMTP Password"
          settingKey="smtp_password"
          value={settings['smtp_password'] ?? ''}
          onChange={updateSetting}
          type="password"
          isSecret
          placeholder="your-smtp-password"
        />
        <SettingField
          label="From Email"
          settingKey="smtp_from_email"
          value={settings['smtp_from_email'] ?? ''}
          onChange={updateSetting}
          placeholder="noreply@example.com"
        />
        <SettingField
          label="From Name"
          settingKey="smtp_from_name"
          value={settings['smtp_from_name'] ?? ''}
          onChange={updateSetting}
          placeholder="Orchestra"
        />
        <ToggleField
          label="Email Confirmations"
          settingKey="email_confirmations_enabled"
          value={(settings['email_confirmations_enabled'] ?? 'false') === 'true'}
          onChange={updateSetting}
          description="Require email confirmation for new signups"
        />
      </SettingsSection>

      {/* Storage */}
      <SettingsSection
        title="Storage"
        description="File storage backend configuration"
        onSave={() =>
          saveSection('storage', storageKeys, ['s3_secret_key'])
        }
        isSaving={savingSections['storage'] ?? false}
        hasChanges={getSectionChanges(storageKeys)}
      >
        <ToggleField
          label="Use S3 Backend"
          settingKey="storage_backend"
          value={(settings['storage_backend'] ?? 'file') === 's3'}
          onChange={(key, val) => updateSetting(key, val === 'true' ? 's3' : 'file')}
          description="Toggle between local file system and S3-compatible storage"
        />
        {(settings['storage_backend'] ?? 'file') === 's3' && (
          <>
            <SettingField
              label="S3 Bucket"
              settingKey="s3_bucket"
              value={settings['s3_bucket'] ?? ''}
              onChange={updateSetting}
              placeholder="my-orchestra-bucket"
            />
            <SettingField
              label="S3 Region"
              settingKey="s3_region"
              value={settings['s3_region'] ?? ''}
              onChange={updateSetting}
              placeholder="us-east-1"
            />
            <SettingField
              label="S3 Access Key"
              settingKey="s3_access_key"
              value={settings['s3_access_key'] ?? ''}
              onChange={updateSetting}
              type="password"
              isSecret
              placeholder="AKIA..."
            />
            <SettingField
              label="S3 Secret Key"
              settingKey="s3_secret_key"
              value={settings['s3_secret_key'] ?? ''}
              onChange={updateSetting}
              type="password"
              isSecret
              placeholder="your-s3-secret-key"
            />
          </>
        )}
      </SettingsSection>

      {/* Cloudflare */}
      <SettingsSection
        title="Cloudflare"
        description="Cloudflare API configuration for TLS and DNS"
        onSave={() =>
          saveSection('cloudflare', cloudflareKeys, ['cloudflare_api_token'])
        }
        isSaving={savingSections['cloudflare'] ?? false}
        hasChanges={getSectionChanges(cloudflareKeys)}
      >
        <SettingField
          label="API Token"
          settingKey="cloudflare_api_token"
          value={settings['cloudflare_api_token'] ?? ''}
          onChange={updateSetting}
          type="password"
          isSecret
          placeholder="your-cloudflare-api-token"
          description="Used for automatic TLS certificate provisioning"
        />
        <SettingField
          label="Domain"
          settingKey="cloudflare_domain"
          value={settings['cloudflare_domain'] ?? ''}
          onChange={updateSetting}
          placeholder="example.com"
          description="Root domain managed by Cloudflare"
        />
      </SettingsSection>
    </div>
  )
}
