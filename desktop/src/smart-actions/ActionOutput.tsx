// Orchestra Desktop -- Action Output Panel
//
// A floating panel at the bottom of the screen that shows real-time
// output from smart action execution, with history of recent runs.

import { useEffect, useRef, useState, type FC } from 'react'

import type { ActionRunResult } from './types'

interface ActionOutputProps {
  runs: ActionRunResult[]
  onClear: () => void
  onClose: () => void
  visible: boolean
}

const ActionOutput: FC<ActionOutputProps> = ({ runs, onClear, onClose, visible }) => {
  const [activeRunIndex, setActiveRunIndex] = useState(0)
  const outputRef = useRef<HTMLPreElement>(null)

  // Auto-scroll to bottom
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight
    }
  }, [runs, activeRunIndex])

  // Select latest run when new one is added
  useEffect(() => {
    if (runs.length > 0) {
      setActiveRunIndex(0)
    }
  }, [runs.length])

  if (!visible || runs.length === 0) return null

  const activeRun = runs[activeRunIndex] ?? runs[0]

  const statusIcon =
    activeRun?.status === 'running'
      ? '\u25CF' // filled circle
      : activeRun?.status === 'success'
        ? '\u2713'
        : '\u2717'

  const statusColor =
    activeRun?.status === 'running'
      ? 'var(--warning-default)'
      : activeRun?.status === 'success'
        ? 'var(--status-online)'
        : 'var(--destructive-default)'

  return (
    <div
      className="fixed bottom-0 left-52 right-0 z-40 flex flex-col"
      style={{
        height: '280px',
        background: 'var(--background-surface-100)',
        borderTop: '1px solid var(--border-strong)',
      }}
    >
      {/* Header bar */}
      <div
        className="flex shrink-0 items-center gap-2 px-3 py-1.5"
        style={{
          background: 'var(--background-surface-200)',
          borderBottom: '1px solid var(--border-default)',
        }}
      >
        {/* Run tabs */}
        <div className="flex items-center gap-1 overflow-x-auto">
          {runs.map((run, i) => (
            <button
              key={`${run.actionId}-${run.startedAt}`}
              onClick={() => setActiveRunIndex(i)}
              className="shrink-0 rounded px-2 py-0.5 text-[11px] transition-colors"
              style={{
                background: i === activeRunIndex ? 'var(--background-surface-300)' : 'transparent',
                color:
                  i === activeRunIndex ? 'var(--foreground-default)' : 'var(--foreground-muted)',
                border:
                  i === activeRunIndex ? '1px solid var(--border-strong)' : '1px solid transparent',
              }}
            >
              <span
                style={{
                  color:
                    run.status === 'running'
                      ? 'var(--warning-default)'
                      : run.status === 'success'
                        ? 'var(--status-online)'
                        : 'var(--destructive-default)',
                }}
              >
                {run.status === 'running'
                  ? '\u25CF '
                  : run.status === 'success'
                    ? '\u2713 '
                    : '\u2717 '}
              </span>
              {run.actionName}
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2">
          {/* Status */}
          {activeRun && (
            <span className="flex items-center gap-1 text-[11px]" style={{ color: statusColor }}>
              {activeRun.status === 'running' && (
                <svg className="h-3 w-3 animate-spin" viewBox="0 0 16 16" fill="none">
                  <circle
                    cx="8"
                    cy="8"
                    r="6"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="opacity-25"
                  />
                  <path
                    d="M2 8a6 6 0 016-6"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              )}
              {statusIcon} {activeRun.status}
            </span>
          )}

          {/* Clear button */}
          <button
            onClick={onClear}
            className="rounded px-2 py-0.5 text-[11px] transition-colors"
            style={{ color: 'var(--foreground-muted)' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--background-surface-300)'
              e.currentTarget.style.color = 'var(--foreground-default)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.color = 'var(--foreground-muted)'
            }}
          >
            Clear
          </button>

          {/* Close button */}
          <button
            onClick={onClose}
            className="rounded p-0.5 transition-colors"
            style={{ color: 'var(--foreground-muted)' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--background-surface-300)'
              e.currentTarget.style.color = 'var(--foreground-default)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.color = 'var(--foreground-muted)'
            }}
          >
            <svg
              className="h-3.5 w-3.5"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M4 4L12 12M12 4L4 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Output area */}
      <pre
        ref={outputRef}
        className="flex-1 overflow-auto p-3 font-mono text-xs leading-relaxed"
        style={{
          color: 'var(--foreground-light)',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        {activeRun?.output || 'No output yet.'}
      </pre>
    </div>
  )
}

export default ActionOutput
