import { Link, usePage } from '@inertiajs/react'
import { useState, useEffect, type ReactNode } from 'react'
import type { PageProps } from '@/types'
import { UserDropdown } from '@/Components/UserDropdown'
import { NotificationBell } from '@/Components/NotificationBell'
import { CommandPalette } from '@/Components/CommandPalette'
import {
    Home,
    Users,
    Key,
    Monitor,
    BarChart3,
    Link2,
    Bell,
    CreditCard,
    Settings,
    Search,
    HelpCircle,
    Menu,
    X,
} from 'lucide-react'

interface Props {
    children: ReactNode
    title?: string
}

interface NavItem {
    href: string
    label: string
    icon: typeof Home
    match: string
}

const topItems: NavItem[] = [
    { href: '/dashboard', label: 'Project Overview', icon: Home, match: '/dashboard' },
    { href: '/dashboard/tokens', label: 'MCP Tokens', icon: Key, match: '/dashboard/tokens' },
]

const orchestraItems: NavItem[] = [
    { href: '/dashboard/agents', label: 'Agents', icon: Monitor, match: '/dashboard/agents' },
    { href: '/dashboard/connections', label: 'Connections', icon: Link2, match: '/dashboard/connections' },
]

const bottomItems: NavItem[] = [
    { href: '/dashboard/notifications', label: 'Notifications', icon: Bell, match: '/dashboard/notifications' },
    { href: '/dashboard/billing', label: 'Billing', icon: CreditCard, match: '/dashboard/billing' },
]

export default function DashboardLayout({ children, title }: Props) {
    const { auth } = usePage<PageProps>().props
    const [sidebarOpen, setSidebarOpen] = useState(false)
    const [cmdkOpen, setCmdkOpen] = useState(false)

    // Current path for active state
    const currentPath = typeof window !== 'undefined' ? window.location.pathname : ''

    function isActive(match: string): boolean {
        if (match === '/dashboard') {
            return currentPath === '/dashboard'
        }
        return currentPath.startsWith(match)
    }

    // Cmd+K keyboard shortcut
    useEffect(() => {
        function handleKeyDown(e: KeyboardEvent) {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault()
                setCmdkOpen((prev) => !prev)
            }
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [])

    // Update page title
    useEffect(() => {
        if (title) {
            document.title = `${title} - Orchestra MCP`
        }
    }, [title])

    return (
        <div className="min-h-screen" style={{ background: 'var(--color-bg-default)', color: 'var(--color-text-primary)' }}>
            {/* ================================================================
                TOP HEADER BAR — 48px, Studio style
                ================================================================ */}
            <header
                className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between h-12 px-3"
                style={{ background: 'var(--color-bg-alt)', borderBottom: '1px solid var(--color-border-muted)' }}
            >
                {/* Left: hamburger (mobile) + logo + name + connect pill */}
                <div className="flex items-center gap-2.5">
                    {/* Hamburger (mobile only) */}
                    <button
                        onClick={() => setSidebarOpen(!sidebarOpen)}
                        className="md:hidden p-1 rounded transition-colors cursor-pointer"
                        style={{ color: 'var(--color-text-muted)' }}
                    >
                        {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                    </button>

                    {/* Logo + Name */}
                    <Link href="/dashboard" className="flex items-center gap-2">
                        <img src="/img/logo.svg" alt="Orchestra MCP" className="h-5 w-5" />
                        <span className="text-[13px] font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                            Orchestra MCP
                        </span>
                    </Link>

                    {/* Connect pill (green) */}
                    <span
                        className="ml-0.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium"
                        style={{ background: 'hsl(153.1 60.2% 52.7% / 0.15)', color: 'hsl(153.1 60.2% 52.7%)' }}
                    >
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'hsl(153.1 60.2% 52.7%)' }} />
                        Connected
                    </span>
                </div>

                {/* Right: search, help, notification bell, settings, user avatar */}
                <div className="flex items-center gap-1">
                    {/* Search (Cmd+K trigger) */}
                    <button
                        onClick={() => setCmdkOpen(true)}
                        className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded text-[12px] transition-colors cursor-pointer"
                        style={{
                            background: 'var(--color-bg-surface)',
                            border: '1px solid var(--color-border)',
                            color: 'var(--color-text-muted)',
                        }}
                    >
                        <Search className="w-3.5 h-3.5" />
                        <span className="hidden lg:inline">Search</span>
                        <kbd
                            className="hidden lg:inline text-[10px] px-1 py-0.5 rounded"
                            style={{ background: 'var(--color-bg-input)', color: 'var(--color-text-faint)' }}
                        >
                            &#8984;K
                        </kbd>
                    </button>

                    {/* Help */}
                    <a
                        href="/docs"
                        className="p-1.5 rounded transition-colors"
                        style={{ color: 'var(--color-text-muted)' }}
                        title="Documentation"
                    >
                        <HelpCircle className="w-4 h-4" />
                    </a>

                    {/* Notification Bell */}
                    <NotificationBell />

                    {/* Settings gear */}
                    <Link
                        href="/dashboard/settings"
                        className="p-1.5 rounded transition-colors"
                        style={{ color: 'var(--color-text-muted)' }}
                        title="Settings"
                    >
                        <Settings className="w-4 h-4" />
                    </Link>

                    {/* User avatar dropdown */}
                    <UserDropdown user={auth.user} />
                </div>
            </header>

            {/* ================================================================
                LAYOUT: Sidebar (240px) + Content
                ================================================================ */}
            <div className="flex" style={{ paddingTop: '48px', minHeight: '100vh' }}>
                {/* Mobile sidebar overlay */}
                {sidebarOpen && (
                    <div
                        className="fixed inset-0 z-30 bg-black/60 md:hidden"
                        style={{ top: '48px' }}
                        onClick={() => setSidebarOpen(false)}
                    />
                )}

                {/* LEFT SIDEBAR — 240px, Studio style */}
                <aside
                    className={`fixed bottom-0 left-0 w-[240px] flex flex-col z-40 transition-transform duration-200 ease-in-out md:translate-x-0 overflow-y-auto ${
                        sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
                    }`}
                    style={{
                        top: '48px',
                        background: 'var(--color-bg-sidebar)',
                        borderRight: '1px solid var(--color-border-muted)',
                    }}
                >
                    <nav className="flex-1 py-2">
                        {/* Top section */}
                        {topItems.map((item) => (
                            <SidebarLink
                                key={item.href}
                                item={item}
                                active={isActive(item.match)}
                                onClick={() => setSidebarOpen(false)}
                            />
                        ))}

                        {/* Divider */}
                        <div className="my-2 mx-4" style={{ borderTop: '1px solid var(--color-border-muted)' }} />

                        {/* Orchestra section label */}
                        <div className="px-4 pt-1 pb-1.5">
                            <span
                                className="text-[11px] font-medium uppercase tracking-wider"
                                style={{ color: 'var(--color-text-faint)' }}
                            >
                                Orchestra
                            </span>
                        </div>

                        {orchestraItems.map((item) => (
                            <SidebarLink
                                key={item.href}
                                item={item}
                                active={isActive(item.match)}
                                onClick={() => setSidebarOpen(false)}
                            />
                        ))}

                        {/* Divider */}
                        <div className="my-2 mx-4" style={{ borderTop: '1px solid var(--color-border-muted)' }} />

                        {/* Bottom section */}
                        {bottomItems.map((item) => (
                            <SidebarLink
                                key={item.href}
                                item={item}
                                active={isActive(item.match)}
                                onClick={() => setSidebarOpen(false)}
                            />
                        ))}
                    </nav>

                    {/* Project Settings at very bottom (like Studio) */}
                    <div style={{ borderTop: '1px solid var(--color-border-muted)' }} className="py-2">
                        <SidebarLink
                            item={{ href: '/dashboard/settings', label: 'Project Settings', icon: Settings, match: '/dashboard/settings' }}
                            active={isActive('/dashboard/settings')}
                            onClick={() => setSidebarOpen(false)}
                        />
                    </div>
                </aside>

                {/* MAIN CONTENT AREA */}
                <div className="flex-1 md:ml-[240px] flex flex-col" style={{ minHeight: 'calc(100vh - 48px)' }}>
                    <main className="flex-1 p-6 md:p-8" style={{ background: 'var(--color-bg-default)' }}>
                        {children}
                    </main>
                </div>
            </div>

            {/* Cmd+K Search Modal */}
            <CommandPalette open={cmdkOpen} onClose={() => setCmdkOpen(false)} />
        </div>
    )
}

/* Sidebar link component */
function SidebarLink({
    item,
    active,
    onClick,
}: {
    item: NavItem
    active: boolean
    onClick: () => void
}) {
    const Icon = item.icon
    return (
        <Link
            href={item.href}
            onClick={onClick}
            className={`flex items-center gap-2.5 mx-2 px-2.5 py-[6px] rounded text-[13px] transition-colors ${
                active
                    ? 'text-[var(--color-text-primary)]'
                    : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
            }`}
            style={{
                background: active ? 'var(--color-bg-surface-300)' : undefined,
            }}
            onMouseEnter={(e) => {
                if (!active) {
                    ;(e.currentTarget as HTMLElement).style.background = 'var(--color-bg-surface-200)'
                }
            }}
            onMouseLeave={(e) => {
                if (!active) {
                    ;(e.currentTarget as HTMLElement).style.background = ''
                }
            }}
        >
            <Icon
                className="w-4 h-4 shrink-0"
                style={{ color: active ? 'var(--color-text-primary)' : 'var(--color-text-muted)' }}
            />
            {item.label}
        </Link>
    )
}
