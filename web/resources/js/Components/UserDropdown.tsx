import { Link, router } from '@inertiajs/react'
import { useState, useRef, useEffect } from 'react'
import type { User } from '@/types'
import {
    LayoutDashboard,
    Link2,
    Bell,
    Settings,
    CreditCard,
    LogOut,
} from 'lucide-react'

interface Props {
    user: User | null
}

export function UserDropdown({ user }: Props) {
    const [open, setOpen] = useState(false)
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

    const initial = user?.name ? user.name.charAt(0).toUpperCase() : '?'

    const menuItems = [
        { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { href: '/dashboard/connections', label: 'Connections', icon: Link2 },
        { href: '/dashboard/notifications', label: 'Notifications', icon: Bell },
        { href: '/dashboard/settings', label: 'Settings', icon: Settings },
        { href: '/dashboard/billing', label: 'Billing', icon: CreditCard },
    ]

    function handleLogout() {
        router.post('/logout')
    }

    return (
        <div ref={ref} className="relative">
            <button
                onClick={() => setOpen(!open)}
                className="flex items-center justify-center w-7 h-7 rounded-full text-[12px] font-semibold cursor-pointer transition-opacity"
                style={{
                    background: 'linear-gradient(135deg, #00E5FF, #A900FF)',
                    color: 'white',
                }}
            >
                {initial}
            </button>

            {open && (
                <div
                    className="absolute right-0 top-full mt-1.5 w-56 rounded-lg overflow-hidden shadow-xl z-50"
                    style={{
                        background: 'var(--color-bg-default)',
                        border: '1px solid var(--color-border)',
                    }}
                >
                    {/* User info header */}
                    <div className="px-3 py-2.5" style={{ borderBottom: '1px solid var(--color-border-muted)' }}>
                        <p className="text-[13px] font-medium" style={{ color: 'var(--color-text-primary)' }}>
                            {user?.name}
                        </p>
                        <p className="text-[12px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                            {user?.email}
                        </p>
                    </div>

                    {/* Menu items */}
                    <div className="py-1">
                        {menuItems.map((item) => {
                            const Icon = item.icon
                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    onClick={() => setOpen(false)}
                                    className="flex items-center gap-2.5 px-3 py-1.5 text-[13px] transition-colors"
                                    style={{ color: 'var(--color-text-secondary)' }}
                                    onMouseEnter={(e) => {
                                        ;(e.currentTarget as HTMLElement).style.background = 'var(--color-bg-surface)'
                                        ;(e.currentTarget as HTMLElement).style.color = 'var(--color-text-primary)'
                                    }}
                                    onMouseLeave={(e) => {
                                        ;(e.currentTarget as HTMLElement).style.background = ''
                                        ;(e.currentTarget as HTMLElement).style.color = 'var(--color-text-secondary)'
                                    }}
                                >
                                    <Icon className="w-3.5 h-3.5" />
                                    {item.label}
                                </Link>
                            )
                        })}
                    </div>

                    {/* Sign out */}
                    <div style={{ borderTop: '1px solid var(--color-border-muted)' }} className="py-1">
                        <button
                            onClick={handleLogout}
                            className="flex items-center gap-2.5 px-3 py-1.5 text-[13px] w-full text-left transition-colors cursor-pointer"
                            style={{ color: 'var(--color-text-secondary)' }}
                            onMouseEnter={(e) => {
                                ;(e.currentTarget as HTMLElement).style.background = 'var(--color-bg-surface)'
                                ;(e.currentTarget as HTMLElement).style.color = 'hsl(9.7 85.2% 62.9%)'
                            }}
                            onMouseLeave={(e) => {
                                ;(e.currentTarget as HTMLElement).style.background = ''
                                ;(e.currentTarget as HTMLElement).style.color = 'var(--color-text-secondary)'
                            }}
                        >
                            <LogOut className="w-3.5 h-3.5" />
                            Sign Out
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}
