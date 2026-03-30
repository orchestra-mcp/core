import { useEffect, type ReactNode } from 'react'
import { X } from 'lucide-react'

interface Props {
    open: boolean
    onClose: () => void
    title: string
    children: ReactNode
    width?: string
}

export function Modal({ open, onClose, title, children, width = '480px' }: Props) {
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

    // Prevent body scroll
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

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center modal-overlay" onClick={onClose}>
            <div
                onClick={(e) => e.stopPropagation()}
                className="rounded-lg overflow-hidden shadow-2xl mx-4"
                style={{
                    width,
                    maxWidth: '100vw',
                    maxHeight: '80vh',
                    background: 'var(--color-bg-default)',
                    border: '1px solid var(--color-border)',
                }}
            >
                {/* Header */}
                <div
                    className="flex items-center justify-between px-4 py-3"
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

                {/* Content */}
                <div className="overflow-y-auto" style={{ maxHeight: 'calc(80vh - 52px)' }}>
                    {children}
                </div>
            </div>
        </div>
    )
}
