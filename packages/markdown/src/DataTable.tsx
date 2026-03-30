import { useCallback, useMemo, useRef, useState } from 'react'

// ---------------------------------------------------------------------------
// DataTable — sortable, themed, with row count header
// ---------------------------------------------------------------------------

/** Simple table icon SVG */
function TableIcon() {
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
      <rect x="2" y="2" width="12" height="12" rx="2" />
      <line x1="2" y1="6" x2="14" y2="6" />
      <line x1="6" y1="2" x2="6" y2="14" />
    </svg>
  )
}

/** Recursively extract plain text from React children. */
function extractText(children: React.ReactNode): string {
  if (typeof children === 'string') return children
  if (typeof children === 'number') return String(children)
  if (!children) return ''
  if (Array.isArray(children)) return children.map(extractText).join('')
  if (typeof children === 'object' && 'props' in children) {
    return extractText((children as React.ReactElement<any>).props.children)
  }
  return ''
}

export interface DataTableProps {
  children: React.ReactNode
  onContextMenu?: (e: React.MouseEvent, tableEl: HTMLTableElement) => void
}

export function DataTable({ children, onContextMenu }: DataTableProps) {
  const tableRef = useRef<HTMLTableElement>(null)
  const [sortCol, setSortCol] = useState<number | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  // Extract header and body rows from react-markdown children
  const { headers, bodyRows } = useMemo(() => {
    const headers: string[] = []
    const bodyRows: { cells: string[]; node: React.ReactNode }[] = []

    const childArr = Array.isArray(children) ? children : [children]
    for (const child of childArr) {
      if (!child || typeof child !== 'object' || !('type' in (child as any))) continue
      const el = child as React.ReactElement<any>

      // thead
      if (el.type === 'thead') {
        const trArr = Array.isArray(el.props.children) ? el.props.children : [el.props.children]
        for (const tr of trArr) {
          if (!tr || typeof tr !== 'object') continue
          const trEl = tr as React.ReactElement<any>
          const thArr = Array.isArray(trEl.props?.children)
            ? trEl.props.children
            : [trEl.props?.children]
          for (const th of thArr) {
            if (!th || typeof th !== 'object') continue
            const thEl = th as React.ReactElement<any>
            headers.push(extractText(thEl.props?.children ?? ''))
          }
        }
      }

      // tbody
      if (el.type === 'tbody') {
        const trArr = Array.isArray(el.props.children) ? el.props.children : [el.props.children]
        for (const tr of trArr) {
          if (!tr || typeof tr !== 'object') continue
          const trEl = tr as React.ReactElement<any>
          const cells: string[] = []
          const tdArr = Array.isArray(trEl.props?.children)
            ? trEl.props.children
            : [trEl.props?.children]
          for (const td of tdArr) {
            if (!td || typeof td !== 'object') continue
            const tdEl = td as React.ReactElement<any>
            cells.push(extractText(tdEl.props?.children ?? ''))
          }
          bodyRows.push({ cells, node: tr })
        }
      }
    }

    return { headers, bodyRows }
  }, [children])

  // Sort body rows
  const sortedBodyRows = useMemo(() => {
    if (sortCol === null) return bodyRows
    const sorted = [...bodyRows].sort((a, b) => {
      const av = a.cells[sortCol] ?? ''
      const bv = b.cells[sortCol] ?? ''
      const an = parseFloat(av)
      const bn = parseFloat(bv)
      if (!isNaN(an) && !isNaN(bn)) {
        return sortDir === 'asc' ? an - bn : bn - an
      }
      return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
    })
    return sorted
  }, [bodyRows, sortCol, sortDir])

  const handleHeaderClick = useCallback(
    (colIndex: number) => {
      if (sortCol === colIndex) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
      } else {
        setSortCol(colIndex)
        setSortDir('asc')
      }
    },
    [sortCol]
  )

  const rowCount = bodyRows.length

  const handleRightClick = useCallback(
    (e: React.MouseEvent) => {
      if (onContextMenu && tableRef.current) {
        onContextMenu(e, tableRef.current)
      }
    },
    [onContextMenu]
  )

  return (
    <div className="data-table-wrapper" onContextMenu={handleRightClick}>
      {/* Header bar with row count */}
      <div className="data-table-header-bar">
        <span className="data-table-icon">
          <TableIcon />
        </span>
        <span className="data-table-title">
          Table &mdash; {rowCount} {rowCount === 1 ? 'row' : 'rows'}
        </span>
      </div>
      {/* Scrollable table area */}
      <div className="data-table-scroll">
        <table ref={tableRef} className="data-table">
          <thead>
            <tr>
              {headers.map((h, i) => (
                <th
                  key={i}
                  onClick={() => handleHeaderClick(i)}
                  className="data-table-th"
                  title={`Sort by ${h}`}
                >
                  <span className="data-table-th-content">
                    {h}
                    {sortCol === i && (
                      <span className="data-table-sort-arrow">
                        {sortDir === 'asc' ? '\u2191' : '\u2193'}
                      </span>
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedBodyRows.map((row, ri) => (
              <tr key={ri} className={ri % 2 === 1 ? 'data-table-row-alt' : ''}>
                {row.node && typeof row.node === 'object' && 'props' in (row.node as any)
                  ? (row.node as React.ReactElement<any>).props.children
                  : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
