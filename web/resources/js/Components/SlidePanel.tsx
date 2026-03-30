import { useEffect, type ReactNode } from 'react'
import { X } from 'lucide-react'

interface Tab {
    key: string
    label: string
    content: ReactNode
}

interface Props {
    open: boolean
    onClose: () => void
    title: string
    tabs?: Tab[]
    activeTab?: string
    onTabChange?: (key: string) => void
    children?: ReactNode
    width?: string
}

export function SlidePanel({
    open,
    onClose,
    title,
    tabs,
    activeTab,
    onTabChange,
    children,
    width = '480px',
}: Props) {
    // Close on Escape
    useEffect(() => {
        function handleKeyDown(e: KeyboardEvent) {
            if (e.key === 'Escape' && open) {
                onClose()
            }
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [open, onClose])

    // Prevent body scroll when open
    useEffect(() => {
        if (open) {
            document.body.style.overflow = 'hidden'
        } else {
            document.body.style.overflow = ''
        }
        return () => {
            document.body.style.overflow = ''
        }
    }, [open])

    if (!open) return null

    const currentTab = tabs?.find((t) => t.key === activeTab)

    return (
        <div className="fixed inset-0 z-[55] flex justify-end">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/40"
                onClick={onClose}
            />

            {/* Panel */}
            <div
                className="relative flex flex-col h-full overflow-hidden"
                style={{
                    width,
                    maxWidth: '100vw',
                    background: 'var(--color-bg-default)',
                    borderLeft: '1px solid var(--color-border)',
                    animation: 'slideInRight 0.2s ease-out',
                }}
            >
                {/* Header */}
                <div
                    className="flex items-center justify-between px-4 py-3 shrink-0"
                    style={{ borderBottom: '1px solid var(--color-border-muted)' }}
                >
                    <h3 className="text-[14px] font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                        {title}
                    </h3>
                    <button
                        onClick={onClose}
                        className="p-1 rounded transition-colors cursor-pointer"
                        style={{ color: 'var(--color-text-muted)' }}
                        onMouseEnter={(e) => {
                            ;(e.currentTarget as HTMLElement).style.background = 'var(--color-bg-surface)'
                        }}
                        onMouseLeave={(e) => {
                            ;(e.currentTarget as HTMLElement).style.background = ''
                        }}
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Tabs (if provided) */}
                {tabs && tabs.length > 0 && (
                    <div
                        className="flex shrink-0 px-4 gap-4"
                        style={{ borderBottom: '1px solid var(--color-border-muted)' }}
                    >
                        {tabs.map((tab) => (
                            <button
                                key={tab.key}
                                onClick={() => onTabChange?.(tab.key)}
                                className="py-2.5 text-[13px] transition-colors cursor-pointer relative"
                                style={{
                                    color: activeTab === tab.key ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
                                }}
                            >
                                {tab.label}
                                {activeTab === tab.key && (
                                    <div
                                        className="absolute bottom-0 left-0 right-0 h-0.5"
                                        style={{ background: 'var(--color-brand-default)' }}
                                    />
                                )}
                            </button>
                        ))}
                    </div>
                )}

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4">
                    {tabs && currentTab ? currentTab.content : children}
                </div>
            </div>
        </div>
    )
}
