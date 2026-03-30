/**
 * MermaidBlock — renders Mermaid diagram code as an SVG diagram.
 *
 * Features:
 * - Dark-themed Mermaid rendering via mermaid.render()
 * - Toggle between rendered diagram and source code view
 * - Loading state while rendering
 * - Context menu support (handled by parent via onContextMenu)
 */

import mermaid from 'mermaid'
import { useCallback, useEffect, useId, useRef, useState } from 'react'

// ---------------------------------------------------------------------------
// Initialize Mermaid once with dark theme
// ---------------------------------------------------------------------------

let mermaidInitialized = false

function ensureMermaidInit() {
  if (mermaidInitialized) return
  mermaid.initialize({
    startOnLoad: false,
    theme: 'dark',
    themeVariables: {
      darkMode: true,
      background: 'hsl(0, 0%, 9%)',
      primaryColor: 'hsl(277, 100%, 50%)',
      primaryTextColor: 'hsl(0, 0%, 98%)',
      primaryBorderColor: 'hsl(0, 0%, 21.2%)',
      secondaryColor: 'hsl(0, 0%, 16.1%)',
      secondaryTextColor: 'hsl(0, 0%, 70.6%)',
      tertiaryColor: 'hsl(0, 0%, 12.9%)',
      lineColor: 'hsl(0, 0%, 53.7%)',
      textColor: 'hsl(0, 0%, 70.6%)',
      mainBkg: 'hsl(0, 0%, 12.9%)',
      nodeBorder: 'hsl(0, 0%, 21.2%)',
      clusterBkg: 'hsl(0, 0%, 9%)',
      clusterBorder: 'hsl(0, 0%, 21.2%)',
      edgeLabelBackground: 'hsl(0, 0%, 12.9%)',
      fontSize: '14px',
    },
    flowchart: {
      htmlLabels: true,
      curve: 'basis',
    },
    securityLevel: 'loose',
  })
  mermaidInitialized = true
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MermaidBlockProps {
  /** The raw Mermaid source code. */
  code: string
  /** Context menu handler for the rendered diagram. */
  onContextMenu?: (e: React.MouseEvent, svgHtml: string, code: string) => void
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function MermaidBlock({ code, onContextMenu }: MermaidBlockProps) {
  const [svgHtml, setSvgHtml] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [showSource, setShowSource] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const uniqueId = useId().replace(/:/g, '_')
  const renderIdRef = useRef(0)

  // Render mermaid diagram
  useEffect(() => {
    ensureMermaidInit()

    const currentRender = ++renderIdRef.current
    setLoading(true)
    setError(null)

    const diagramId = `mermaid_${uniqueId}_${currentRender}`

    // Use async render
    ;(async () => {
      try {
        const { svg } = await mermaid.render(diagramId, code.trim())
        // Only apply if this is still the latest render
        if (currentRender === renderIdRef.current) {
          setSvgHtml(svg)
          setLoading(false)
        }
      } catch (err: any) {
        if (currentRender === renderIdRef.current) {
          setError(err?.message || 'Failed to render diagram')
          setLoading(false)
        }
        // Clean up any orphaned elements mermaid may have created
        const orphan = document.getElementById(diagramId)
        if (orphan) orphan.remove()
      }
    })()

    return () => {
      // Cleanup on unmount or re-render
      const orphan = document.getElementById(diagramId)
      if (orphan) orphan.remove()
    }
  }, [code, uniqueId])

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      if (onContextMenu && svgHtml) {
        onContextMenu(e, svgHtml, code)
      }
    },
    [onContextMenu, svgHtml, code]
  )

  const toggleView = useCallback(() => {
    setShowSource((prev) => !prev)
  }, [])

  return (
    <div className="mermaid-block-wrapper group" onContextMenu={handleContextMenu}>
      {/* Header bar */}
      <div className="mermaid-block-header">
        <span className="mermaid-block-icon">
          <DiagramIcon />
        </span>
        <span className="mermaid-block-lang">Diagram</span>
        <div className="flex-1" />
        <button
          onClick={toggleView}
          className="mermaid-block-toggle opacity-0 transition-opacity group-hover:opacity-100"
        >
          {showSource ? 'View Diagram' : 'View Source'}
        </button>
      </div>

      {/* Content area */}
      <div className="mermaid-block-body">
        {loading && !showSource && (
          <div className="mermaid-block-loading">
            <div className="mermaid-block-spinner" />
            <span>Rendering diagram...</span>
          </div>
        )}

        {error && !showSource && (
          <div className="mermaid-block-error">
            <span className="mermaid-block-error-icon">!</span>
            <div>
              <div className="mermaid-block-error-title">Diagram Error</div>
              <div className="mermaid-block-error-msg">{error}</div>
            </div>
          </div>
        )}

        {showSource ? (
          <pre className="mermaid-block-source">
            <code>{code}</code>
          </pre>
        ) : (
          !loading &&
          !error && (
            <div
              ref={containerRef}
              className="mermaid-block-svg"
              dangerouslySetInnerHTML={{ __html: svgHtml }}
            />
          )
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// SVG Icon for "Diagram"
// ---------------------------------------------------------------------------

export function DiagramIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="1" y="1" width="5" height="4" rx="1" />
      <rect x="10" y="1" width="5" height="4" rx="1" />
      <rect x="5.5" y="11" width="5" height="4" rx="1" />
      <line x1="3.5" y1="5" x2="3.5" y2="8" />
      <line x1="12.5" y1="5" x2="12.5" y2="8" />
      <line x1="3.5" y1="8" x2="12.5" y2="8" />
      <line x1="8" y1="8" x2="8" y2="11" />
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Conversion Modal
// ---------------------------------------------------------------------------

export interface ConversionModalProps {
  /** The generated Mermaid code to preview. */
  mermaidCode: string
  /** Called when user accepts — mode is "replace" or "insert-below". */
  onAccept: (mode: 'replace' | 'insert-below', code: string) => void
  /** Called when user cancels. */
  onCancel: () => void
}

export function AsciiToMermaidModal({ mermaidCode, onAccept, onCancel }: ConversionModalProps) {
  const [editedCode, setEditedCode] = useState(mermaidCode)
  const [previewSvg, setPreviewSvg] = useState<string>('')
  const [previewError, setPreviewError] = useState<string | null>(null)
  const renderIdRef = useRef(0)

  // Render preview
  useEffect(() => {
    ensureMermaidInit()
    const currentRender = ++renderIdRef.current

    const diagramId = `modal_preview_${currentRender}`

    ;(async () => {
      try {
        const { svg } = await mermaid.render(diagramId, editedCode.trim())
        if (currentRender === renderIdRef.current) {
          setPreviewSvg(svg)
          setPreviewError(null)
        }
      } catch (err: any) {
        if (currentRender === renderIdRef.current) {
          setPreviewError(err?.message || 'Invalid Mermaid syntax')
          setPreviewSvg('')
        }
        const orphan = document.getElementById(diagramId)
        if (orphan) orphan.remove()
      }
    })()

    return () => {
      const orphan = document.getElementById(diagramId)
      if (orphan) orphan.remove()
    }
  }, [editedCode])

  return (
    <div className="mermaid-modal-overlay" onClick={onCancel}>
      <div className="mermaid-modal" onClick={(e) => e.stopPropagation()}>
        <div className="mermaid-modal-header">
          <h3>Convert to Mermaid Diagram</h3>
          <button className="mermaid-modal-close" onClick={onCancel}>
            x
          </button>
        </div>

        <div className="mermaid-modal-body">
          {/* Left: editor */}
          <div className="mermaid-modal-editor">
            <div className="mermaid-modal-section-label">Mermaid Source</div>
            <textarea
              value={editedCode}
              onChange={(e) => setEditedCode(e.target.value)}
              spellCheck={false}
              className="mermaid-modal-textarea"
            />
          </div>

          {/* Right: preview */}
          <div className="mermaid-modal-preview">
            <div className="mermaid-modal-section-label">Preview</div>
            <div className="mermaid-modal-preview-area">
              {previewError ? (
                <div className="mermaid-block-error">
                  <span className="mermaid-block-error-icon">!</span>
                  <span className="mermaid-block-error-msg">{previewError}</span>
                </div>
              ) : previewSvg ? (
                <div dangerouslySetInnerHTML={{ __html: previewSvg }} />
              ) : (
                <div className="mermaid-block-loading">
                  <div className="mermaid-block-spinner" />
                  <span>Rendering...</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="mermaid-modal-footer">
          <button className="mermaid-modal-btn mermaid-modal-btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button
            className="mermaid-modal-btn mermaid-modal-btn-primary"
            onClick={() => onAccept('insert-below', editedCode)}
          >
            Insert Below
          </button>
          <button
            className="mermaid-modal-btn mermaid-modal-btn-primary"
            onClick={() => onAccept('replace', editedCode)}
          >
            Replace ASCII
          </button>
        </div>
      </div>
    </div>
  )
}
