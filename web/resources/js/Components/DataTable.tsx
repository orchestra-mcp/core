import { useState, type ReactNode } from 'react'
import { Search, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'

export interface Column<T> {
    key: string
    label: string
    sortable?: boolean
    render?: (item: T) => ReactNode
    width?: string
}

interface Props<T> {
    columns: Column<T>[]
    data: T[]
    searchPlaceholder?: string
    searchKeys?: string[]
    onRowClick?: (item: T) => void
    emptyMessage?: string
    emptyIcon?: ReactNode
}

export function DataTable<T extends Record<string, any>>({
    columns,
    data,
    searchPlaceholder = 'Search...',
    searchKeys = [],
    onRowClick,
    emptyMessage = 'No items found',
    emptyIcon,
}: Props<T>) {
    const [search, setSearch] = useState('')
    const [sortKey, setSortKey] = useState<string | null>(null)
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

    // Filter by search
    const filtered = search.trim()
        ? data.filter((item) =>
              searchKeys.some((key) => {
                  const val = item[key]
                  return typeof val === 'string' && val.toLowerCase().includes(search.toLowerCase())
              })
          )
        : data

    // Sort
    const sorted = sortKey
        ? [...filtered].sort((a, b) => {
              const aVal = a[sortKey] ?? ''
              const bVal = b[sortKey] ?? ''
              const cmp = String(aVal).localeCompare(String(bVal))
              return sortDir === 'asc' ? cmp : -cmp
          })
        : filtered

    function handleSort(key: string) {
        if (sortKey === key) {
            setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'))
        } else {
            setSortKey(key)
            setSortDir('asc')
        }
    }

    return (
        <div
            className="rounded-lg overflow-hidden"
            style={{ border: '1px solid var(--color-border)', background: 'var(--color-bg-sidebar)' }}
        >
            {/* Search bar */}
            <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--color-border-muted)' }}>
                <div
                    className="flex items-center gap-2 px-3 py-1.5 rounded"
                    style={{ background: 'var(--color-bg-input)', border: '1px solid var(--color-border)' }}
                >
                    <Search className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--color-text-muted)' }} />
                    <input
                        type="text"
                        placeholder={searchPlaceholder}
                        className="flex-1 text-[13px] bg-transparent border-none outline-none"
                        style={{ color: 'var(--color-text-primary)' }}
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead>
                        <tr style={{ borderBottom: '1px solid var(--color-border-muted)' }}>
                            {columns.map((col) => (
                                <th
                                    key={col.key}
                                    className={`px-4 py-2.5 text-left text-[12px] font-medium uppercase tracking-wider ${
                                        col.sortable ? 'cursor-pointer select-none' : ''
                                    }`}
                                    style={{ color: 'var(--color-text-faint)', width: col.width }}
                                    onClick={() => col.sortable && handleSort(col.key)}
                                >
                                    <div className="flex items-center gap-1">
                                        {col.label}
                                        {col.sortable && (
                                            <span className="inline-flex flex-col">
                                                {sortKey === col.key ? (
                                                    sortDir === 'asc' ? (
                                                        <ChevronUp className="w-3 h-3" />
                                                    ) : (
                                                        <ChevronDown className="w-3 h-3" />
                                                    )
                                                ) : (
                                                    <ChevronsUpDown className="w-3 h-3 opacity-40" />
                                                )}
                                            </span>
                                        )}
                                    </div>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {sorted.length === 0 ? (
                            <tr>
                                <td colSpan={columns.length} className="px-4 py-12 text-center">
                                    <div className="flex flex-col items-center gap-2">
                                        {emptyIcon && (
                                            <div style={{ color: 'var(--color-text-faint)' }}>{emptyIcon}</div>
                                        )}
                                        <p className="text-[13px]" style={{ color: 'var(--color-text-muted)' }}>
                                            {emptyMessage}
                                        </p>
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            sorted.map((item, i) => (
                                <tr
                                    key={item.id || i}
                                    className={`data-table-row ${onRowClick ? 'cursor-pointer' : ''}`}
                                    style={{ borderBottom: '1px solid var(--color-border-muted)' }}
                                    onClick={() => onRowClick?.(item)}
                                >
                                    {columns.map((col) => (
                                        <td
                                            key={col.key}
                                            className="px-4 py-3 text-[13px]"
                                            style={{ color: 'var(--color-text-primary)' }}
                                        >
                                            {col.render ? col.render(item) : String(item[col.key] ?? '')}
                                        </td>
                                    ))}
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Footer with count */}
            <div
                className="px-4 py-2.5 text-[12px]"
                style={{ borderTop: '1px solid var(--color-border-muted)', color: 'var(--color-text-faint)' }}
            >
                {sorted.length} item{sorted.length !== 1 ? 's' : ''}
                {search && ` (filtered from ${data.length})`}
            </div>
        </div>
    )
}
