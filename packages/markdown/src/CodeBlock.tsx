import { useCallback, useMemo, useRef, useState } from 'react'

// ---------------------------------------------------------------------------
// CodeBlock — VS Code / GitHub reference style with line numbers, copy button
// ---------------------------------------------------------------------------

export interface CodeBlockProps extends React.HTMLAttributes<HTMLElement> {
  children?: React.ReactNode
  /** Explicit language override (otherwise parsed from className) */
  language?: string
  /** Right-click handler — receives the <code> element and the detected language */
  onContextMenu?: (e: React.MouseEvent, codeEl: HTMLElement, lang: string) => void
}

export function CodeBlock({
  children,
  className,
  language: langProp,
  onContextMenu,
  ...props
}: CodeBlockProps) {
  const [copied, setCopied] = useState(false)
  const codeRef = useRef<HTMLElement>(null)

  // Use explicit language prop if provided, otherwise extract from className
  const language = langProp ?? /language-(\w+)/.exec(className || '')?.[1] ?? ''
  // Clean display label: uppercase, fallback to "CODE"
  const displayLang = language ? language.toUpperCase() : 'CODE'

  const handleCopy = useCallback(() => {
    const text = codeRef.current?.textContent ?? ''
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }, [])

  // Compute line count from rendered DOM text
  const [lineCount, setLineCount] = useState(1)
  useMemo(() => {
    requestAnimationFrame(() => {
      if (codeRef.current) {
        const text = codeRef.current.textContent ?? ''
        const lines = text.split('\n')
        const count =
          lines.length > 0 && lines[lines.length - 1] === '' ? lines.length - 1 : lines.length
        setLineCount(Math.max(1, count))
      }
    })
  }, [children])

  const handleRightClick = useCallback(
    (e: React.MouseEvent) => {
      if (onContextMenu && codeRef.current) {
        onContextMenu(e, codeRef.current, language)
      }
    },
    [onContextMenu, language]
  )

  return (
    <div className="code-block-wrapper group" onContextMenu={handleRightClick}>
      {/* Header bar with macOS traffic light dots, language label, and copy button */}
      <div className="code-block-header">
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <span
            style={{
              width: 12,
              height: 12,
              borderRadius: '50%',
              background: '#ff5f57',
              flexShrink: 0,
            }}
          />
          <span
            style={{
              width: 12,
              height: 12,
              borderRadius: '50%',
              background: '#febc2e',
              flexShrink: 0,
            }}
          />
          <span
            style={{
              width: 12,
              height: 12,
              borderRadius: '50%',
              background: '#28c840',
              flexShrink: 0,
            }}
          />
          <span className="code-block-lang" style={{ marginLeft: 8 }}>
            {displayLang}
          </span>
        </div>
        <div className="flex-1" />
        <button
          onClick={handleCopy}
          className="code-block-copy-btn opacity-0 transition-opacity group-hover:opacity-100"
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      {/* Code area with line numbers */}
      <div className="code-block-body">
        <div className="code-block-line-numbers" aria-hidden="true">
          {Array.from({ length: lineCount }, (_, i) => (
            <span key={i}>{i + 1}</span>
          ))}
        </div>
        <code ref={codeRef} className={className} {...props}>
          {children}
        </code>
      </div>
    </div>
  )
}
