import { Head } from '@inertiajs/react'
import { useState } from 'react'
import DashboardLayout from '@/Layouts/DashboardLayout'
import type { NotificationItem } from '@/types'
import { Bell, CheckCheck, Trash2 } from 'lucide-react'

interface Props {
    notifications: NotificationItem[]
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

export default function Notifications({ notifications: initialNotifications }: Props) {
    const [notifications, setNotifications] = useState(initialNotifications)
    const [filter, setFilter] = useState<'all' | 'unread' | 'read'>('all')

    const filtered = notifications.filter((n) => {
        if (filter === 'unread') return !n.read
        if (filter === 'read') return n.read
        return true
    })

    const unreadCount = notifications.filter((n) => !n.read).length

    async function markAsRead(id: string) {
        const csrfMeta = document.querySelector('meta[name="csrf-token"]')
        const csrfToken = csrfMeta ? csrfMeta.getAttribute('content') || '' : ''
        try {
            await fetch(`/dashboard/notifications/${id}/read`, {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                    'X-CSRF-TOKEN': csrfToken,
                },
            })
            setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)))
        } catch {
            // silently fail
        }
    }

    async function markAllRead() {
        const csrfMeta = document.querySelector('meta[name="csrf-token"]')
        const csrfToken = csrfMeta ? csrfMeta.getAttribute('content') || '' : ''
        try {
            await fetch('/dashboard/notifications/mark-all-read', {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                    'X-CSRF-TOKEN': csrfToken,
                },
            })
            setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
        } catch {
            // silently fail
        }
    }

    async function deleteNotification(id: string) {
        const csrfMeta = document.querySelector('meta[name="csrf-token"]')
        const csrfToken = csrfMeta ? csrfMeta.getAttribute('content') || '' : ''
        try {
            await fetch(`/dashboard/notifications/${id}`, {
                method: 'DELETE',
                headers: {
                    'Accept': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                    'X-CSRF-TOKEN': csrfToken,
                },
            })
            setNotifications((prev) => prev.filter((n) => n.id !== id))
        } catch {
            // silently fail
        }
    }

    return (
        <DashboardLayout title="Notifications">
            <Head title="Notifications" />

            {/* Page heading */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-[14px] font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                        Notifications
                    </h1>
                    <p className="mt-1 text-[13px]" style={{ color: 'var(--color-text-muted)' }}>
                        {unreadCount > 0 ? `${unreadCount} unread notification${unreadCount !== 1 ? 's' : ''}` : 'All caught up'}
                    </p>
                </div>
                {unreadCount > 0 && (
                    <button onClick={markAllRead} className="btn-secondary inline-flex items-center gap-1.5 text-[12px]">
                        <CheckCheck className="w-3.5 h-3.5" />
                        Mark all read
                    </button>
                )}
            </div>

            {/* Filter tabs */}
            <div
                className="flex gap-4 mb-4 px-1"
                style={{ borderBottom: '1px solid var(--color-border-muted)' }}
            >
                {(['all', 'unread', 'read'] as const).map((f) => (
                    <button
                        key={f}
                        onClick={() => setFilter(f)}
                        className="pb-2.5 text-[13px] transition-colors cursor-pointer relative"
                        style={{ color: filter === f ? 'var(--color-text-primary)' : 'var(--color-text-muted)' }}
                    >
                        {f.charAt(0).toUpperCase() + f.slice(1)}
                        {filter === f && (
                            <div
                                className="absolute bottom-0 left-0 right-0 h-0.5"
                                style={{ background: 'var(--color-brand-default)' }}
                            />
                        )}
                    </button>
                ))}
            </div>

            {/* Notifications list */}
            <div
                className="rounded-lg overflow-hidden"
                style={{ border: '1px solid var(--color-border)', background: 'var(--color-bg-sidebar)' }}
            >
                {filtered.length === 0 ? (
                    <div className="px-4 py-12 text-center">
                        <Bell className="w-8 h-8 mx-auto mb-2" style={{ color: 'var(--color-text-faint)' }} />
                        <p className="text-[13px]" style={{ color: 'var(--color-text-muted)' }}>
                            {filter === 'unread' ? 'No unread notifications' : 'No notifications'}
                        </p>
                    </div>
                ) : (
                    filtered.map((n, i) => (
                        <div
                            key={n.id}
                            className="flex items-start gap-3 px-4 py-3 transition-colors data-table-row"
                            style={{
                                borderBottom: i < filtered.length - 1 ? '1px solid var(--color-border-muted)' : 'none',
                                background: n.read ? 'transparent' : 'var(--color-bg-surface-75)',
                            }}
                        >
                            {/* Color dot */}
                            <div
                                className="w-2.5 h-2.5 rounded-full mt-1 shrink-0"
                                style={{
                                    background: typeColorMap[n.type_color] || '#9ca3af',
                                    opacity: n.read ? 0.3 : 1,
                                }}
                            />

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                                <p
                                    className="text-[13px]"
                                    style={{ color: n.read ? 'var(--color-text-muted)' : 'var(--color-text-primary)' }}
                                >
                                    {n.title}
                                </p>
                                {n.body && (
                                    <p className="text-[12px] mt-0.5" style={{ color: 'var(--color-text-faint)' }}>
                                        {n.body}
                                    </p>
                                )}
                                <p className="text-[11px] mt-1" style={{ color: 'var(--color-text-faint)' }}>
                                    {n.created_at}
                                </p>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-1 shrink-0">
                                {!n.read && (
                                    <button
                                        onClick={() => markAsRead(n.id)}
                                        className="p-1 rounded transition-colors cursor-pointer"
                                        style={{ color: 'var(--color-text-muted)' }}
                                        title="Mark as read"
                                    >
                                        <CheckCheck className="w-3.5 h-3.5" />
                                    </button>
                                )}
                                <button
                                    onClick={() => deleteNotification(n.id)}
                                    className="p-1 rounded transition-colors cursor-pointer"
                                    style={{ color: 'var(--color-text-muted)' }}
                                    title="Delete"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Footer count */}
            {filtered.length > 0 && (
                <div className="mt-2 text-[12px]" style={{ color: 'var(--color-text-faint)' }}>
                    {filtered.length} notification{filtered.length !== 1 ? 's' : ''}
                </div>
            )}
        </DashboardLayout>
    )
}
