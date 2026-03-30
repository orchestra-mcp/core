import { useState, useEffect, useRef } from 'react'
import { Link } from '@inertiajs/react'
import { Bell } from 'lucide-react'

interface NotificationPreview {
    id: string
    type: string
    title: string
    body: string
    action_url: string | null
    read: boolean
    type_color: string
    created_at: string
}

export function NotificationBell() {
    const [open, setOpen] = useState(false)
    const [count, setCount] = useState(0)
    const [notifications, setNotifications] = useState<NotificationPreview[]>([])
    const [loading, setLoading] = useState(false)
    const ref = useRef<HTMLDivElement>(null)

    // Close on outside click
    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    // Fetch unread count on mount and every 30s
    useEffect(() => {
        fetchCount()
        const interval = setInterval(fetchCount, 30000)
        return () => clearInterval(interval)
    }, [])

    async function fetchCount() {
        try {
            const res = await fetch('/dashboard/notifications/unread-count', {
                headers: { 'Accept': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
            })
            if (res.ok) {
                const data = await res.json()
                setCount(data.count)
            }
        } catch {
            // silently fail
        }
    }

    async function fetchRecent() {
        setLoading(true)
        try {
            const res = await fetch('/dashboard/notifications/recent', {
                headers: { 'Accept': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
            })
            if (res.ok) {
                const data = await res.json()
                setNotifications(data.notifications)
            }
        } catch {
            // silently fail
        } finally {
            setLoading(false)
        }
    }

    function handleOpen() {
        setOpen(!open)
        if (!open) {
            fetchRecent()
        }
    }

    async function markAsRead(id: string) {
        try {
            const csrfMeta = document.querySelector('meta[name="csrf-token"]')
            const csrfToken = csrfMeta ? csrfMeta.getAttribute('content') || '' : ''
            await fetch(`/dashboard/notifications/${id}/read`, {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                    'X-CSRF-TOKEN': csrfToken,
                },
            })
            setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)))
            setCount((prev) => Math.max(0, prev - 1))
        } catch {
            // silently fail
        }
    }

    const typeColorMap: Record<string, string> = {
        emerald: '#34d399',
        amber: '#fbbf24',
        red: '#f87171',
        purple: '#A900FF',
        cyan: '#00E5FF',
        blue: '#60a5fa',
        gray: '#9ca3af',
    }

    return (
        <div ref={ref} className="relative">
            <button
                onClick={handleOpen}
                className="relative p-1.5 rounded transition-colors cursor-pointer"
                style={{ color: 'var(--color-text-muted)' }}
                title="Notifications"
            >
                <Bell className="w-4 h-4" />
                {count > 0 && (
                    <span
                        className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full text-[10px] font-bold notification-badge"
                        style={{ background: '#A900FF', color: 'white' }}
                    >
                        {count > 99 ? '99+' : count}
                    </span>
                )}
            </button>

            {open && (
                <div
                    className="absolute right-0 top-full mt-1.5 w-80 rounded-lg overflow-hidden shadow-xl z-50"
                    style={{
                        background: 'var(--color-bg-default)',
                        border: '1px solid var(--color-border)',
                    }}
                >
                    {/* Header */}
                    <div
                        className="flex items-center justify-between px-3 py-2.5"
                        style={{ borderBottom: '1px solid var(--color-border-muted)' }}
                    >
                        <span className="text-[13px] font-medium" style={{ color: 'var(--color-text-primary)' }}>
                            Notifications
                        </span>
                        {count > 0 && (
                            <span
                                className="text-[11px] px-1.5 py-0.5 rounded-full"
                                style={{ background: 'rgba(169, 0, 255, 0.15)', color: '#c44dff' }}
                            >
                                {count} unread
                            </span>
                        )}
                    </div>

                    {/* Notifications list */}
                    <div className="max-h-80 overflow-y-auto">
                        {loading ? (
                            <div className="px-3 py-6 text-center text-[12px]" style={{ color: 'var(--color-text-muted)' }}>
                                Loading...
                            </div>
                        ) : notifications.length === 0 ? (
                            <div className="px-3 py-6 text-center text-[12px]" style={{ color: 'var(--color-text-muted)' }}>
                                No notifications
                            </div>
                        ) : (
                            notifications.map((n) => (
                                <div
                                    key={n.id}
                                    className="px-3 py-2.5 transition-colors cursor-pointer"
                                    style={{
                                        borderBottom: '1px solid var(--color-border-muted)',
                                        background: n.read ? 'transparent' : 'var(--color-bg-surface-75)',
                                    }}
                                    onClick={() => !n.read && markAsRead(n.id)}
                                    onMouseEnter={(e) => {
                                        ;(e.currentTarget as HTMLElement).style.background = 'var(--color-bg-surface)'
                                    }}
                                    onMouseLeave={(e) => {
                                        ;(e.currentTarget as HTMLElement).style.background = n.read
                                            ? 'transparent'
                                            : 'var(--color-bg-surface-75)'
                                    }}
                                >
                                    <div className="flex items-start gap-2.5">
                                        <div
                                            className="w-2 h-2 rounded-full mt-1.5 shrink-0"
                                            style={{
                                                background: typeColorMap[n.type_color] || '#9ca3af',
                                                opacity: n.read ? 0.3 : 1,
                                            }}
                                        />
                                        <div className="flex-1 min-w-0">
                                            <p
                                                className="text-[13px] truncate"
                                                style={{ color: n.read ? 'var(--color-text-muted)' : 'var(--color-text-primary)' }}
                                            >
                                                {n.title}
                                            </p>
                                            <p className="text-[11px] mt-0.5" style={{ color: 'var(--color-text-faint)' }}>
                                                {n.created_at}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {/* Footer */}
                    <div style={{ borderTop: '1px solid var(--color-border-muted)' }}>
                        <Link
                            href="/dashboard/notifications"
                            onClick={() => setOpen(false)}
                            className="block px-3 py-2 text-center text-[12px] transition-colors"
                            style={{ color: 'var(--color-text-muted)' }}
                            onMouseEnter={(e) => {
                                ;(e.currentTarget as HTMLElement).style.background = 'var(--color-bg-surface)'
                            }}
                            onMouseLeave={(e) => {
                                ;(e.currentTarget as HTMLElement).style.background = ''
                            }}
                        >
                            View all notifications
                        </Link>
                    </div>
                </div>
            )}
        </div>
    )
}
