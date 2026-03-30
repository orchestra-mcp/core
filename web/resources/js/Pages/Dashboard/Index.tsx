import { Head, Link } from '@inertiajs/react'
import DashboardLayout from '@/Layouts/DashboardLayout'
import { StatCard } from '@/Components/StatCard'
import type { StatData, ActivityItem } from '@/types'
import { Key, Monitor, ClipboardList, Database, Plus, UserPlus, Zap } from 'lucide-react'

interface Props {
    stats: StatData
    recentActivity: ActivityItem[]
}

export default function DashboardIndex({ stats, recentActivity }: Props) {
    return (
        <DashboardLayout title="Project Overview">
            <Head title="Project Overview" />

            {/* Page heading (Studio style: small text, no large headers) */}
            <div className="mb-6">
                <h1 className="text-[14px] font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                    Project Overview
                </h1>
                <p className="mt-1 text-[13px]" style={{ color: 'var(--color-text-muted)' }}>
                    Welcome to Orchestra MCP. Your AI-powered company OS.
                </p>
            </div>

            {/* Stat cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                    label="Active Tokens"
                    value={stats.totalTokens}
                    color="cyan"
                    icon={<Key className="w-4 h-4" />}
                />
                <StatCard
                    label="Agents"
                    value={stats.totalAgents}
                    color="purple"
                    icon={<Monitor className="w-4 h-4" />}
                />
                <StatCard
                    label="Tasks (this month)"
                    value={stats.totalTasks}
                    color="cyan"
                    icon={<ClipboardList className="w-4 h-4" />}
                />
                <StatCard
                    label="Team Members"
                    value={stats.totalTeamMembers}
                    color="purple"
                    icon={<Database className="w-4 h-4" />}
                />
            </div>

            {/* Quick Actions */}
            <div className="mt-8 mb-6">
                <h2 className="text-[13px] font-medium mb-3" style={{ color: 'var(--color-text-primary)' }}>
                    Quick Actions
                </h2>
                <div className="flex flex-wrap gap-2">
                    <Link
                        href="/dashboard/tokens"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-[12px] font-medium transition-colors cursor-pointer btn-secondary"
                    >
                        <Plus className="w-3.5 h-3.5" />
                        Create Token
                    </Link>
                    <Link
                        href="/dashboard/agents"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-[12px] font-medium transition-colors cursor-pointer btn-secondary"
                    >
                        <Plus className="w-3.5 h-3.5" />
                        Add Agent
                    </Link>
                    <Link
                        href="/dashboard/connections"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-[12px] font-medium transition-colors cursor-pointer btn-secondary"
                    >
                        <UserPlus className="w-3.5 h-3.5" />
                        Connect Service
                    </Link>
                </div>
            </div>

            {/* Recent Activity */}
            <div className="mt-6">
                <h2 className="text-[13px] font-medium mb-3" style={{ color: 'var(--color-text-primary)' }}>
                    Recent Activity
                </h2>

                {recentActivity.length > 0 ? (
                    <div
                        className="rounded-lg overflow-hidden"
                        style={{ border: '1px solid var(--color-border)', background: 'var(--color-bg-sidebar)' }}
                    >
                        {recentActivity.map((activity, i) => (
                            <div
                                key={activity.id}
                                className="flex items-center justify-between px-4 py-3 transition-colors"
                                style={{
                                    borderBottom: i < recentActivity.length - 1 ? '1px solid var(--color-border-muted)' : 'none',
                                }}
                            >
                                <div className="flex items-center gap-3">
                                    <div
                                        className="flex items-center justify-center w-7 h-7 rounded-full"
                                        style={{ background: 'rgba(0, 229, 255, 0.08)' }}
                                    >
                                        <Zap className="w-3.5 h-3.5" style={{ color: '#00E5FF' }} />
                                    </div>
                                    <div>
                                        <p className="text-[13px]" style={{ color: 'var(--color-text-primary)' }}>
                                            {activity.description}
                                        </p>
                                        {activity.prefix && (
                                            <span
                                                className="text-[11px] font-mono"
                                                style={{ color: 'var(--color-text-faint)' }}
                                            >
                                                {activity.prefix}...
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <span className="text-[12px] shrink-0" style={{ color: 'var(--color-text-faint)' }}>
                                    {activity.time}
                                </span>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div
                        className="rounded-lg px-4 py-12 text-center"
                        style={{ border: '1px solid var(--color-border)', background: 'var(--color-bg-sidebar)' }}
                    >
                        <Zap className="w-8 h-8 mx-auto mb-2" style={{ color: 'var(--color-text-faint)' }} />
                        <p className="text-[13px]" style={{ color: 'var(--color-text-muted)' }}>
                            No recent activity. Start by creating an MCP token.
                        </p>
                    </div>
                )}
            </div>
        </DashboardLayout>
    )
}
