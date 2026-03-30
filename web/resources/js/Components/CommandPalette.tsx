import { useEffect, useRef, useState } from 'react'
import { router } from '@inertiajs/react'
import { Search } from 'lucide-react'

interface Props {
    open: boolean
    onClose: () => void
}

interface SearchResult {
    label: string
    href: string
    section: string
}

const allResults: SearchResult[] = [
    { label: 'Project Overview', href: '/dashboard', section: 'Pages' },
    { label: 'MCP Tokens', href: '/dashboard/tokens', section: 'Pages' },
    { label: 'Agents', href: '/dashboard/agents', section: 'Pages' },
    { label: 'Connections', href: '/dashboard/connections', section: 'Pages' },
    { label: 'Notifications', href: '/dashboard/notifications', section: 'Pages' },
    { label: 'Settings', href: '/dashboard/settings', section: 'Pages' },
    { label: 'Billing', href: '/dashboard/billing', section: 'Pages' },
    { label: 'Documentation', href: '/docs', section: 'External' },
    { label: 'Create Token', href: '/dashboard/tokens', section: 'Actions' },
    { label: 'Add Agent', href: '/dashboard/agents', section: 'Actions' },
]

export function CommandPalette({ open, onClose }: Props) {
    const inputRef = useRef<HTMLInputElement>(null)
    const [query, setQuery] = useState('')
    const [selectedIndex, setSelectedIndex] = useState(0)

    const filtered = query.trim()
        ? allResults.filter((r) => r.label.toLowerCase().includes(query.toLowerCase()))
        : allResults

    // Focus input when opened
    useEffect(() => {
        if (open) {
            setQuery('')
            setSelectedIndex(0)
            setTimeout(() => inputRef.current?.focus(), 50)
        }
    }, [open])

    // Keyboard navigation
    useEffect(() => {
        if (!open) return

        function handleKeyDown(e: KeyboardEvent) {
            if (e.key === 'Escape') {
                onClose()
            } else if (e.key === 'ArrowDown') {
                e.preventDefault()
                setSelectedIndex((prev) => Math.min(prev + 1, filtered.length - 1))
            } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                setSelectedIndex((prev) => Math.max(prev - 1, 0))
            } else if (e.key === 'Enter' && filtered[selectedIndex]) {
                e.preventDefault()
                navigateTo(filtered[selectedIndex].href)
            }
        }

        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [open, filtered, selectedIndex, onClose])

    function navigateTo(href: string) {
        onClose()
        router.visit(href)
    }

    if (!open) return null

    return (
        <div
            className="fixed inset-0 z-[60] flex items-start justify-center pt-[20vh] cmdk-backdrop"
            onClick={onClose}
        >
            <div
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-lg mx-4 rounded-lg overflow-hidden shadow-2xl"
                style={{
                    background: 'var(--color-bg-default)',
                    border: '1px solid var(--color-border)',
                }}
            >
                {/* Search input */}
                <div
                    className="flex items-center gap-3 px-4 py-3"
                    style={{ borderBottom: '1px solid var(--color-border)' }}
                >
                    <Search className="w-4 h-4 shrink-0" style={{ color: 'var(--color-text-muted)' }} />
                    <input
                        ref={inputRef}
                        type="text"
                        placeholder="Search pages, agents, tokens..."
                        className="flex-1 text-[14px] bg-transparent border-none outline-none"
                        style={{ color: 'var(--color-text-primary)' }}
                        value={query}
                        onChange={(e) => {
                            setQuery(e.target.value)
                            setSelectedIndex(0)
                        }}
                    />
                </div>

                {/* Results */}
                <div className="max-h-64 overflow-y-auto py-1">
                    {filtered.length === 0 ? (
                        <div className="px-4 py-6 text-center text-[13px]" style={{ color: 'var(--color-text-faint)' }}>
                            No results found
                        </div>
                    ) : (
                        filtered.map((result, i) => (
                            <button
                                key={`${result.href}-${result.label}`}
                                onClick={() => navigateTo(result.href)}
                                className="flex items-center justify-between w-full px-4 py-2 text-[13px] text-left transition-colors cursor-pointer"
                                style={{
                                    background: i === selectedIndex ? 'var(--color-bg-surface)' : 'transparent',
                                    color: i === selectedIndex ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                                }}
                                onMouseEnter={() => setSelectedIndex(i)}
                            >
                                <span>{result.label}</span>
                                <span className="text-[11px]" style={{ color: 'var(--color-text-faint)' }}>
                                    {result.section}
                                </span>
                            </button>
                        ))
                    )}
                </div>

                {/* Footer hint */}
                <div
                    className="px-3 py-2 text-[12px] flex items-center gap-3"
                    style={{ color: 'var(--color-text-faint)', borderTop: '1px solid var(--color-border)' }}
                >
                    <span>
                        <kbd className="px-1 py-0.5 rounded text-[10px]" style={{ background: 'var(--color-bg-input)' }}>
                            ↑↓
                        </kbd>{' '}
                        navigate
                    </span>
                    <span>
                        <kbd className="px-1 py-0.5 rounded text-[10px]" style={{ background: 'var(--color-bg-input)' }}>
                            ↵
                        </kbd>{' '}
                        select
                    </span>
                    <span>
                        <kbd className="px-1 py-0.5 rounded text-[10px]" style={{ background: 'var(--color-bg-input)' }}>
                            ESC
                        </kbd>{' '}
                        close
                    </span>
                </div>
            </div>
        </div>
    )
}
