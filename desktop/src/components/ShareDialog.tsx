/**
 * ShareDialog — modal for sharing markdown documents via Supabase.
 *
 * Uploads content to `shared_documents` table and generates a shareable link.
 * Supports public, private (token-based), and team visibility.
 */

import { useCallback, useEffect, useRef, useState } from 'react'

import { useAuth } from '../auth'
import { supabase } from '../lib/supabase'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ShareDialogProps {
  open: boolean
  onClose: () => void
  /** The markdown content to share. */
  content: string
  /** Pre-filled title (from file name or first heading). */
  title: string
  /** File type hint (e.g. "markdown", "generic"). */
  fileType?: string
}

type Visibility = 'public' | 'private' | 'team'

type Expiration = 'never' | '1h' | '1d' | '1w' | '1m'

interface ShareResult {
  url: string
  token: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateToken(): string {
  const bytes = new Uint8Array(8)
  crypto.getRandomValues(bytes)
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80)
}

function getExpirationDate(exp: Expiration): string | null {
  if (exp === 'never') return null
  const now = new Date()
  switch (exp) {
    case '1h':
      return new Date(now.getTime() + 60 * 60 * 1000).toISOString()
    case '1d':
      return new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString()
    case '1w':
      return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString()
    case '1m':
      return new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString()
    default:
      return null
  }
}

const SHARE_BASE_URL = 'https://orchestra-mcp.dev/share'

// ---------------------------------------------------------------------------
// ShareDialog Component
// ---------------------------------------------------------------------------

export default function ShareDialog({
  open,
  onClose,
  content,
  title: initialTitle,
  fileType = 'markdown',
}: ShareDialogProps) {
  const { user } = useAuth()
  const dialogRef = useRef<HTMLDivElement>(null)

  // Form state
  const [title, setTitle] = useState(initialTitle)
  const [visibility, setVisibility] = useState<Visibility>('private')
  const [customSlug, setCustomSlug] = useState('')
  const [usePassword, setUsePassword] = useState(false)
  const [password, setPassword] = useState('')
  const [expiration, setExpiration] = useState<Expiration>('never')

  // Upload state
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<ShareResult | null>(null)
  const [copied, setCopied] = useState(false)

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setTitle(initialTitle)
      setVisibility('private')
      setCustomSlug('')
      setUsePassword(false)
      setPassword('')
      setExpiration('never')
      setUploading(false)
      setError(null)
      setResult(null)
      setCopied(false)
    }
  }, [open, initialTitle])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  // Close on outside click
  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (dialogRef.current && !dialogRef.current.contains(e.target as Node)) {
        onClose()
      }
    },
    [onClose]
  )

  // Handle share upload
  const handleShare = useCallback(async () => {
    if (!user) {
      setError('You must be signed in to share documents.')
      return
    }
    if (!title.trim()) {
      setError('Title is required.')
      return
    }

    setUploading(true)
    setError(null)

    try {
      const token = generateToken()
      const slug = customSlug.trim() ? slugify(customSlug) : null

      // Simple password hash (SHA-256 via SubtleCrypto)
      let passwordHash: string | null = null
      if (usePassword && password) {
        const encoder = new TextEncoder()
        const data = encoder.encode(password)
        const hashBuffer = await crypto.subtle.digest('SHA-256', data)
        const hashArray = Array.from(new Uint8Array(hashBuffer))
        passwordHash = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
      }

      const expiresAt = getExpirationDate(expiration)

      // Get user's organization_id from profile
      let organizationId: string | null = null
      if (visibility === 'team') {
        const { data: profile } = await supabase
          .from('profiles')
          .select('organization_id')
          .eq('id', user.id)
          .single()
        organizationId = profile?.organization_id ?? null
      }

      const { error: insertError } = await supabase.from('shared_documents').insert({
        created_by: user.id,
        organization_id: organizationId,
        title: title.trim(),
        content,
        file_type: fileType,
        visibility,
        share_token: token,
        slug,
        password_hash: passwordHash,
        expires_at: expiresAt,
        metadata: {
          shared_from: 'desktop',
          content_length: content.length,
        },
      })

      if (insertError) {
        throw new Error(insertError.message)
      }

      const url = slug ? `${SHARE_BASE_URL}/${slug}` : `${SHARE_BASE_URL}/${token}`

      setResult({ url, token })
    } catch (err: any) {
      setError(err.message || 'Failed to share document.')
    } finally {
      setUploading(false)
    }
  }, [user, title, content, fileType, visibility, customSlug, usePassword, password, expiration])

  // Copy link to clipboard
  const handleCopyLink = useCallback(async () => {
    if (!result) return
    try {
      await navigator.clipboard.writeText(result.url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback
      const input = document.createElement('input')
      input.value = result.url
      document.body.appendChild(input)
      input.select()
      document.execCommand('copy')
      document.body.removeChild(input)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }, [result])

  // Open in browser
  const handleOpenInBrowser = useCallback(async () => {
    if (!result) return
    try {
      const { open: openUrl } = await import('@tauri-apps/plugin-shell')
      await openUrl(result.url)
    } catch {
      window.open(result.url, '_blank')
    }
  }, [result])

  if (!open) return null

  // ---------------------------------------------------------------------------
  // Styles
  // ---------------------------------------------------------------------------

  const labelStyle: React.CSSProperties = {
    fontSize: '11px',
    fontWeight: 600,
    color: 'var(--foreground-lighter)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: '6px',
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px 12px',
    background: 'var(--background-surface-100)',
    border: '1px solid var(--border-default)',
    borderRadius: 'var(--border-radius-sm)',
    color: 'var(--foreground-default)',
    fontSize: '13px',
    outline: 'none',
    transition: 'border-color 0.15s',
  }

  const btnSecondary: React.CSSProperties = {
    padding: '8px 16px',
    borderRadius: '6px',
    fontSize: '13px',
    fontWeight: 500,
    background: 'var(--background-surface-300)',
    color: 'var(--foreground-light)',
    border: '1px solid var(--border-default)',
    cursor: 'pointer',
    transition: 'all 0.15s',
  }

  const btnPrimary: React.CSSProperties = {
    padding: '8px 20px',
    borderRadius: '6px',
    fontSize: '13px',
    fontWeight: 500,
    background: 'var(--brand-default)',
    color: '#fff',
    border: '1px solid var(--brand-default)',
    cursor: 'pointer',
    transition: 'all 0.15s',
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={handleOverlayClick}
    >
      <div
        ref={dialogRef}
        className="w-full max-w-lg rounded-xl shadow-2xl"
        style={{
          background: 'var(--background-default)',
          border: '1px solid var(--border-strong)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: '1px solid var(--border-default)' }}
        >
          <div className="flex items-center gap-3">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-lg"
              style={{ background: 'var(--brand-400)' }}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                stroke="var(--brand-default)"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M4 12V8.5a3.5 3.5 0 1 1 7 0V9" />
                <path d="M11 8l3 3-3 3" />
                <path d="M14 11H7" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-semibold" style={{ color: 'var(--foreground-default)' }}>
                Share Document
              </h3>
              <p className="text-xs" style={{ color: 'var(--foreground-lighter)' }}>
                Generate a shareable link for this document
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-md transition-colors"
            style={{ color: 'var(--foreground-lighter)' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--background-surface-300)'
              e.currentTarget.style.color = 'var(--foreground-default)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.color = 'var(--foreground-lighter)'
            }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path d="M1 1l12 12M13 1L1 13" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="space-y-5 px-6 py-5">
          {/* Success state */}
          {result ? (
            <div className="space-y-4">
              {/* Success banner */}
              <div
                className="flex items-center gap-3 rounded-lg p-3"
                style={{
                  background: 'hsla(153, 60%, 53%, 0.1)',
                  border: '1px solid hsla(153, 60%, 53%, 0.3)',
                }}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="hsl(153, 60%, 53%)"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="8" cy="8" r="6.5" />
                  <path d="M5.5 8l2 2 3.5-3.5" />
                </svg>
                <span className="text-sm" style={{ color: 'hsl(153, 60%, 70%)' }}>
                  Document shared successfully!
                </span>
              </div>

              {/* URL display */}
              <div>
                <div style={labelStyle}>Shareable Link</div>
                <div
                  className="flex items-center gap-2 rounded-lg p-2"
                  style={{
                    background: 'var(--background-surface-100)',
                    border: '1px solid var(--border-default)',
                  }}
                >
                  <input
                    type="text"
                    readOnly
                    value={result.url}
                    className="flex-1 bg-transparent text-xs outline-none"
                    style={{ color: 'var(--brand-link)' }}
                    onClick={(e) => (e.target as HTMLInputElement).select()}
                  />
                  <button
                    onClick={handleCopyLink}
                    className="shrink-0 rounded-md px-3 py-1.5 text-xs font-medium transition-colors"
                    style={
                      copied
                        ? {
                            background: 'hsla(153, 60%, 53%, 0.15)',
                            color: 'hsl(153, 60%, 53%)',
                          }
                        : {
                            background: 'var(--background-surface-300)',
                            color: 'var(--foreground-light)',
                          }
                    }
                  >
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-2">
                <button
                  onClick={handleOpenInBrowser}
                  className="flex items-center gap-2 rounded-md px-3 py-2 text-xs font-medium transition-colors"
                  style={{
                    background: 'var(--background-surface-300)',
                    color: 'var(--foreground-light)',
                    border: '1px solid var(--border-default)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--background-button)'
                    e.currentTarget.style.color = 'var(--foreground-default)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'var(--background-surface-300)'
                    e.currentTarget.style.color = 'var(--foreground-light)'
                  }}
                >
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M12 8.5V12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h3.5" />
                    <path d="M10 2h4v4" />
                    <path d="M14 2L7.5 8.5" />
                  </svg>
                  Open in Browser
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Title */}
              <div>
                <div style={labelStyle}>Title</div>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Document title..."
                  style={inputStyle}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = 'var(--brand-default)'
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border-default)'
                  }}
                />
              </div>

              {/* Visibility */}
              <div>
                <div style={labelStyle}>Visibility</div>
                <div className="flex gap-2">
                  {(
                    [
                      { value: 'public', label: 'Public', desc: 'Anyone with the link' },
                      { value: 'private', label: 'Private', desc: 'Token-based URL only' },
                      { value: 'team', label: 'Team', desc: 'Org members (login required)' },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setVisibility(opt.value)}
                      className="flex-1 rounded-lg p-3 text-left transition-colors"
                      style={
                        visibility === opt.value
                          ? {
                              background: 'var(--brand-400)',
                              border: '1px solid var(--brand-default)',
                            }
                          : {
                              background: 'var(--background-surface-100)',
                              border: '1px solid var(--border-default)',
                            }
                      }
                    >
                      <div
                        className="text-xs font-semibold"
                        style={{
                          color:
                            visibility === opt.value
                              ? 'var(--brand-default)'
                              : 'var(--foreground-light)',
                        }}
                      >
                        {opt.label}
                      </div>
                      <div
                        className="mt-0.5 text-[10px]"
                        style={{ color: 'var(--foreground-muted)' }}
                      >
                        {opt.desc}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Slug */}
              <div>
                <div style={labelStyle}>Custom URL Slug (optional)</div>
                <div className="flex items-center gap-0">
                  <span
                    className="rounded-l-[4px] border border-r-0 px-2.5 py-[8px] text-xs"
                    style={{
                      background: 'var(--background-surface-200)',
                      borderColor: 'var(--border-default)',
                      color: 'var(--foreground-muted)',
                    }}
                  >
                    /share/
                  </span>
                  <input
                    type="text"
                    value={customSlug}
                    onChange={(e) => setCustomSlug(e.target.value)}
                    placeholder="my-document"
                    style={{
                      ...inputStyle,
                      borderTopLeftRadius: 0,
                      borderBottomLeftRadius: 0,
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = 'var(--brand-default)'
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = 'var(--border-default)'
                    }}
                  />
                </div>
              </div>

              {/* Password Protection */}
              <div>
                <label
                  className="flex cursor-pointer items-center gap-2"
                  style={{ color: 'var(--foreground-light)' }}
                >
                  <input
                    type="checkbox"
                    checked={usePassword}
                    onChange={(e) => setUsePassword(e.target.checked)}
                    className="h-3.5 w-3.5"
                    style={{ accentColor: 'var(--brand-default)' }}
                  />
                  <span className="text-xs font-medium">Password protection</span>
                </label>
                {usePassword && (
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password..."
                    className="mt-2"
                    style={inputStyle}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = 'var(--brand-default)'
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = 'var(--border-default)'
                    }}
                  />
                )}
              </div>

              {/* Expiration */}
              <div>
                <div style={labelStyle}>Expiration</div>
                <select
                  value={expiration}
                  onChange={(e) => setExpiration(e.target.value as Expiration)}
                  style={{
                    ...inputStyle,
                    cursor: 'pointer',
                    appearance: 'none',
                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12' fill='none' stroke='%23888' stroke-width='1.5'%3E%3Cpath d='M3 4.5l3 3 3-3'/%3E%3C/svg%3E")`,
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'right 12px center',
                    paddingRight: '36px',
                  }}
                >
                  <option value="never">Never expires</option>
                  <option value="1h">1 hour</option>
                  <option value="1d">1 day</option>
                  <option value="1w">1 week</option>
                  <option value="1m">1 month</option>
                </select>
              </div>

              {/* Error message */}
              {error && (
                <div
                  className="rounded-lg px-3 py-2 text-xs"
                  style={{
                    background: 'var(--destructive-200)',
                    color: 'var(--destructive-600)',
                    border: '1px solid hsla(10, 78%, 54%, 0.3)',
                  }}
                >
                  {error}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-end gap-2 px-6 py-4"
          style={{ borderTop: '1px solid var(--border-default)' }}
        >
          <button
            onClick={onClose}
            style={btnSecondary}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--background-button)'
              e.currentTarget.style.color = 'var(--foreground-default)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--background-surface-300)'
              e.currentTarget.style.color = 'var(--foreground-light)'
            }}
          >
            {result ? 'Done' : 'Cancel'}
          </button>
          {!result && (
            <button
              onClick={handleShare}
              disabled={uploading || !title.trim()}
              style={{
                ...btnPrimary,
                opacity: uploading || !title.trim() ? 0.5 : 1,
                cursor: uploading || !title.trim() ? 'not-allowed' : 'pointer',
              }}
            >
              {uploading ? 'Sharing...' : 'Share'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
