import { parseFrontmatter } from './utils'

// ---------------------------------------------------------------------------
// FrontmatterHeader — renders YAML frontmatter as a styled header
// ---------------------------------------------------------------------------

export interface FrontmatterHeaderProps {
  /** The raw markdown string (with frontmatter) */
  raw: string
}

export function FrontmatterHeader({ raw }: FrontmatterHeaderProps) {
  try {
    const { data } = parseFrontmatter(raw)
    const entries = Object.entries(data)
    if (entries.length === 0) return null

    return (
      <div
        className="mb-4 rounded-lg p-3"
        style={{
          background: 'var(--background-surface-200)',
          border: '1px solid var(--border-default)',
        }}
      >
        <div
          className="mb-2 text-[10px] font-semibold uppercase tracking-wider"
          style={{ color: 'var(--foreground-lighter)' }}
        >
          Frontmatter
        </div>
        <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
          {entries.map(([key, value]) => (
            <div key={key} className="contents">
              <span className="text-xs font-medium" style={{ color: 'var(--brand-default)' }}>
                {key}
              </span>
              <span className="truncate text-xs" style={{ color: 'var(--foreground-light)' }}>
                {typeof value === 'object' ? JSON.stringify(value) : String(value)}
              </span>
            </div>
          ))}
        </div>
      </div>
    )
  } catch {
    return null
  }
}
