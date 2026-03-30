import { Head } from '@inertiajs/react'
import { useState } from 'react'
import DashboardLayout from '@/Layouts/DashboardLayout'
import { DataTable, type Column } from '@/Components/DataTable'
import { SlidePanel } from '@/Components/SlidePanel'
import { StatusBadge } from '@/Components/StatusBadge'
import { Modal } from '@/Components/Modal'
import type { TokenItem } from '@/types'
import { Key, Plus, Copy, Check } from 'lucide-react'

interface Props {
    tokens: TokenItem[]
}

export default function Tokens({ tokens }: Props) {
    const [selectedToken, setSelectedToken] = useState<TokenItem | null>(null)
    const [panelTab, setPanelTab] = useState('overview')
    const [createModalOpen, setCreateModalOpen] = useState(false)
    const [copiedId, setCopiedId] = useState<string | null>(null)

    function copyToClipboard(text: string, id: string) {
        navigator.clipboard.writeText(text)
        setCopiedId(id)
        setTimeout(() => setCopiedId(null), 2000)
    }

    function getTokenStatus(token: TokenItem): 'valid' | 'revoked' | 'expired' {
        if (token.revoked_at) return 'revoked'
        if (token.expires_at && new Date(token.expires_at) < new Date()) return 'expired'
        return 'valid'
    }

    const columns: Column<TokenItem>[] = [
        {
            key: 'name',
            label: 'Token',
            sortable: true,
            render: (token) => (
                <div className="flex items-center gap-3">
                    <div
                        className="flex items-center justify-center w-8 h-8 rounded-md"
                        style={{ background: 'rgba(0, 229, 255, 0.08)' }}
                    >
                        <Key className="w-3.5 h-3.5" style={{ color: '#00E5FF' }} />
                    </div>
                    <div>
                        <p className="text-[13px] font-medium" style={{ color: 'var(--color-text-primary)' }}>
                            {token.name}
                        </p>
                        <p className="text-[11px] font-mono" style={{ color: 'var(--color-text-faint)' }}>
                            {token.token_prefix}...
                        </p>
                    </div>
                </div>
            ),
        },
        {
            key: 'scopes',
            label: 'Scopes',
            render: (token) => (
                <span className="text-[12px] font-mono" style={{ color: 'var(--color-text-secondary)' }}>
                    {token.scopes || '--'}
                </span>
            ),
        },
        {
            key: 'last_used_at',
            label: 'Last Used',
            sortable: true,
            render: (token) => (
                <span className="text-[13px]" style={{ color: 'var(--color-text-secondary)' }}>
                    {token.last_used_at || 'Never'}
                </span>
            ),
        },
        {
            key: 'status',
            label: 'Status',
            render: (token) => <StatusBadge status={getTokenStatus(token)} />,
        },
        {
            key: 'actions',
            label: '',
            width: '40px',
            render: (token) => (
                <button
                    onClick={(e) => {
                        e.stopPropagation()
                        copyToClipboard(token.token_prefix, token.id)
                    }}
                    className="p-1 rounded transition-colors cursor-pointer"
                    style={{ color: 'var(--color-text-muted)' }}
                    title="Copy token prefix"
                >
                    {copiedId === token.id ? (
                        <Check className="w-3.5 h-3.5" style={{ color: '#34d399' }} />
                    ) : (
                        <Copy className="w-3.5 h-3.5" />
                    )}
                </button>
            ),
        },
    ]

    return (
        <DashboardLayout title="MCP Tokens">
            <Head title="MCP Tokens" />

            {/* Page heading */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-[14px] font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                        MCP Tokens
                    </h1>
                    <p className="mt-1 text-[13px]" style={{ color: 'var(--color-text-muted)' }}>
                        Manage your MCP authentication tokens.
                    </p>
                </div>
                <button onClick={() => setCreateModalOpen(true)} className="btn-primary inline-flex items-center gap-1.5">
                    <Plus className="w-3.5 h-3.5" />
                    New Token
                </button>
            </div>

            {/* Data table */}
            <DataTable
                columns={columns}
                data={tokens}
                searchPlaceholder="Search tokens..."
                searchKeys={['name', 'token_prefix']}
                onRowClick={(token) => {
                    setSelectedToken(token)
                    setPanelTab('overview')
                }}
                emptyMessage="No tokens found. Create your first MCP token to connect."
                emptyIcon={<Key className="w-8 h-8" />}
            />

            {/* Slide panel for token details */}
            <SlidePanel
                open={!!selectedToken}
                onClose={() => setSelectedToken(null)}
                title={selectedToken?.name || 'Token Details'}
                tabs={[
                    {
                        key: 'overview',
                        label: 'Overview',
                        content: selectedToken && <TokenOverview token={selectedToken} />,
                    },
                    {
                        key: 'raw',
                        label: 'Raw JSON',
                        content: selectedToken && (
                            <pre
                                className="text-[12px] font-mono p-3 rounded overflow-auto"
                                style={{ background: 'var(--color-bg-input)', color: 'var(--color-text-secondary)' }}
                            >
                                {JSON.stringify(selectedToken, null, 2)}
                            </pre>
                        ),
                    },
                ]}
                activeTab={panelTab}
                onTabChange={setPanelTab}
            />

            {/* Create Token Modal */}
            <Modal open={createModalOpen} onClose={() => setCreateModalOpen(false)} title="Create MCP Token">
                <div className="p-4 space-y-4">
                    <div>
                        <label className="block text-[12px] font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                            Token Name
                        </label>
                        <input
                            type="text"
                            placeholder="e.g., Claude Desktop"
                            className="studio-field w-full"
                        />
                    </div>
                    <div>
                        <label className="block text-[12px] font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                            Scopes
                        </label>
                        <div className="space-y-2">
                            {['read', 'write', 'admin'].map((scope) => (
                                <label key={scope} className="flex items-center gap-2 cursor-pointer">
                                    <input type="checkbox" className="rounded" />
                                    <span className="text-[13px]" style={{ color: 'var(--color-text-secondary)' }}>
                                        {scope}
                                    </span>
                                </label>
                            ))}
                        </div>
                    </div>
                    <div>
                        <label className="block text-[12px] font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                            Expires
                        </label>
                        <select className="studio-field w-full">
                            <option value="30">30 days</option>
                            <option value="90">90 days</option>
                            <option value="365">1 year</option>
                            <option value="">Never</option>
                        </select>
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                        <button onClick={() => setCreateModalOpen(false)} className="btn-secondary">
                            Cancel
                        </button>
                        <button className="btn-primary">Create Token</button>
                    </div>
                </div>
            </Modal>
        </DashboardLayout>
    )
}

function TokenOverview({ token }: { token: TokenItem }) {
    return (
        <div className="space-y-4">
            <div className="flex items-center gap-3">
                <div
                    className="flex items-center justify-center w-12 h-12 rounded-md"
                    style={{ background: 'rgba(0, 229, 255, 0.08)' }}
                >
                    <Key className="w-5 h-5" style={{ color: '#00E5FF' }} />
                </div>
                <div>
                    <p className="text-[14px] font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                        {token.name}
                    </p>
                    <StatusBadge status={token.revoked_at ? 'revoked' : token.is_valid ? 'valid' : 'expired'} />
                </div>
            </div>

            <div className="space-y-3">
                <DetailRow label="Token ID" value={token.id} mono />
                <DetailRow label="Prefix" value={token.token_prefix} mono />
                <DetailRow label="Scopes" value={token.scopes || '--'} />
                <DetailRow label="Last Used" value={token.last_used_at || 'Never'} />
                <DetailRow label="Expires" value={token.expires_at ? new Date(token.expires_at).toLocaleDateString() : 'Never'} />
                <DetailRow label="Created" value={token.created_at ? new Date(token.created_at).toLocaleDateString() : '--'} />
            </div>

            {/* Actions */}
            <div className="pt-2">
                {!token.revoked_at && (
                    <button className="btn-danger text-[12px]">Revoke Token</button>
                )}
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
