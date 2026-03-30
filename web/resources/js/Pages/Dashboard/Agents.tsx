import { Head } from '@inertiajs/react'
import { useState } from 'react'
import DashboardLayout from '@/Layouts/DashboardLayout'
import { DataTable, type Column } from '@/Components/DataTable'
import { SlidePanel } from '@/Components/SlidePanel'
import { StatusBadge } from '@/Components/StatusBadge'
import { Modal } from '@/Components/Modal'
import type { AgentItem } from '@/types'
import { Monitor, Plus } from 'lucide-react'

interface Props {
    agents: AgentItem[]
}

export default function Agents({ agents }: Props) {
    const [selectedAgent, setSelectedAgent] = useState<AgentItem | null>(null)
    const [panelTab, setPanelTab] = useState('overview')
    const [createModalOpen, setCreateModalOpen] = useState(false)

    const columns: Column<AgentItem>[] = [
        {
            key: 'name',
            label: 'Agent',
            sortable: true,
            render: (agent) => (
                <div className="flex items-center gap-3">
                    <div
                        className="flex items-center justify-center w-8 h-8 rounded-full text-[12px] font-bold"
                        style={{
                            background: agent.avatar_color || 'linear-gradient(135deg, #00E5FF, #A900FF)',
                            color: 'white',
                        }}
                    >
                        {agent.name?.charAt(0)?.toUpperCase() || 'A'}
                    </div>
                    <div>
                        <p className="text-[13px] font-medium" style={{ color: 'var(--color-text-primary)' }}>
                            {agent.name}
                        </p>
                        <p className="text-[11px]" style={{ color: 'var(--color-text-faint)' }}>
                            {agent.slug}
                        </p>
                    </div>
                </div>
            ),
        },
        {
            key: 'role',
            label: 'Role',
            sortable: true,
            render: (agent) => (
                <span className="text-[13px]" style={{ color: 'var(--color-text-secondary)' }}>
                    {agent.role || '--'}
                </span>
            ),
        },
        {
            key: 'type',
            label: 'Type',
            sortable: true,
            render: (agent) => (
                <span
                    className="inline-flex px-2 py-0.5 rounded text-[11px] font-medium"
                    style={{ background: 'var(--color-bg-surface-200)', color: 'var(--color-text-secondary)' }}
                >
                    {agent.type || 'general'}
                </span>
            ),
        },
        {
            key: 'status',
            label: 'Status',
            sortable: true,
            render: (agent) => <StatusBadge status={agent.status} />,
        },
    ]

    return (
        <DashboardLayout title="Agents">
            <Head title="Agents" />

            {/* Page heading */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-[14px] font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                        AI Agents
                    </h1>
                    <p className="mt-1 text-[13px]" style={{ color: 'var(--color-text-muted)' }}>
                        Manage your AI agents and their configurations.
                    </p>
                </div>
                <button onClick={() => setCreateModalOpen(true)} className="btn-primary inline-flex items-center gap-1.5">
                    <Plus className="w-3.5 h-3.5" />
                    New Agent
                </button>
            </div>

            {/* Data table */}
            <DataTable
                columns={columns}
                data={agents}
                searchPlaceholder="Search agents..."
                searchKeys={['name', 'role', 'slug', 'type']}
                onRowClick={(agent) => {
                    setSelectedAgent(agent)
                    setPanelTab('overview')
                }}
                emptyMessage="No agents found. Create your first agent to get started."
                emptyIcon={<Monitor className="w-8 h-8" />}
            />

            {/* Slide panel for agent details */}
            <SlidePanel
                open={!!selectedAgent}
                onClose={() => setSelectedAgent(null)}
                title={selectedAgent?.name || 'Agent Details'}
                tabs={[
                    {
                        key: 'overview',
                        label: 'Overview',
                        content: selectedAgent && <AgentOverview agent={selectedAgent} />,
                    },
                    {
                        key: 'config',
                        label: 'Configuration',
                        content: selectedAgent && <AgentConfig agent={selectedAgent} />,
                    },
                    {
                        key: 'raw',
                        label: 'Raw JSON',
                        content: selectedAgent && (
                            <pre
                                className="text-[12px] font-mono p-3 rounded overflow-auto"
                                style={{ background: 'var(--color-bg-input)', color: 'var(--color-text-secondary)' }}
                            >
                                {JSON.stringify(selectedAgent, null, 2)}
                            </pre>
                        ),
                    },
                ]}
                activeTab={panelTab}
                onTabChange={setPanelTab}
            />

            {/* Create Agent Modal */}
            <Modal open={createModalOpen} onClose={() => setCreateModalOpen(false)} title="Create Agent">
                <div className="p-4 space-y-4">
                    <div>
                        <label className="block text-[12px] font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                            Agent Name
                        </label>
                        <input
                            type="text"
                            placeholder="e.g., Research Assistant"
                            className="studio-field w-full"
                        />
                    </div>
                    <div>
                        <label className="block text-[12px] font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                            Role
                        </label>
                        <input
                            type="text"
                            placeholder="e.g., Backend Developer"
                            className="studio-field w-full"
                        />
                    </div>
                    <div>
                        <label className="block text-[12px] font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                            Type
                        </label>
                        <select className="studio-field w-full">
                            <option value="general">General Purpose</option>
                            <option value="coding">Coding</option>
                            <option value="research">Research</option>
                            <option value="writing">Writing</option>
                        </select>
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                        <button onClick={() => setCreateModalOpen(false)} className="btn-secondary">
                            Cancel
                        </button>
                        <button className="btn-primary">Create Agent</button>
                    </div>
                </div>
            </Modal>
        </DashboardLayout>
    )
}

function AgentOverview({ agent }: { agent: AgentItem }) {
    return (
        <div className="space-y-4">
            {/* Agent avatar and status */}
            <div className="flex items-center gap-3">
                <div
                    className="flex items-center justify-center w-12 h-12 rounded-full text-[18px] font-bold"
                    style={{
                        background: agent.avatar_color || 'linear-gradient(135deg, #00E5FF, #A900FF)',
                        color: 'white',
                    }}
                >
                    {agent.name?.charAt(0)?.toUpperCase() || 'A'}
                </div>
                <div>
                    <p className="text-[14px] font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                        {agent.name}
                    </p>
                    <StatusBadge status={agent.status} />
                </div>
            </div>

            {/* Details */}
            <div className="space-y-3">
                <DetailRow label="Slug" value={agent.slug} />
                <DetailRow label="Role" value={agent.role || '--'} />
                <DetailRow label="Type" value={agent.type || 'general'} />
                <DetailRow label="Created" value={agent.created_at ? new Date(agent.created_at).toLocaleDateString() : '--'} />
            </div>

            {/* Skills */}
            {agent.skills && agent.skills.length > 0 && (
                <div>
                    <p className="text-[12px] font-medium mb-2" style={{ color: 'var(--color-text-muted)' }}>
                        Skills
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                        {agent.skills.map((skill) => (
                            <span
                                key={skill}
                                className="inline-flex px-2 py-0.5 rounded text-[11px]"
                                style={{ background: 'var(--color-bg-surface-200)', color: 'var(--color-text-secondary)' }}
                            >
                                {skill}
                            </span>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}

function AgentConfig({ agent }: { agent: AgentItem }) {
    return (
        <div className="space-y-4">
            <p className="text-[13px]" style={{ color: 'var(--color-text-muted)' }}>
                Agent configuration for <strong>{agent.name}</strong>.
            </p>
            <div className="space-y-3">
                <DetailRow label="Agent ID" value={agent.id} mono />
                <DetailRow label="Status" value={agent.status} />
                <DetailRow label="Type" value={agent.type || 'general'} />
            </div>
        </div>
    )
}

function DetailRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
    return (
        <div className="flex items-start justify-between py-1.5" style={{ borderBottom: '1px solid var(--color-border-muted)' }}>
            <span className="text-[12px]" style={{ color: 'var(--color-text-muted)' }}>
                {label}
            </span>
            <span
                className={`text-[12px] text-right ${mono ? 'font-mono' : ''}`}
                style={{ color: 'var(--color-text-primary)' }}
            >
                {value}
            </span>
        </div>
    )
}
