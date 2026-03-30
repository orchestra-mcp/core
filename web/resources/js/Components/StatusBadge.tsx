interface Props {
    status: 'active' | 'inactive' | 'archived' | 'valid' | 'revoked' | 'expired'
}

const statusConfig: Record<string, { bg: string; text: string; label: string }> = {
    active: { bg: 'rgba(52, 211, 153, 0.1)', text: '#34d399', label: 'Active' },
    inactive: { bg: 'rgba(251, 191, 36, 0.1)', text: '#fbbf24', label: 'Inactive' },
    archived: { bg: 'rgba(248, 113, 113, 0.1)', text: '#f87171', label: 'Archived' },
    valid: { bg: 'rgba(52, 211, 153, 0.1)', text: '#34d399', label: 'Valid' },
    revoked: { bg: 'rgba(248, 113, 113, 0.1)', text: '#f87171', label: 'Revoked' },
    expired: { bg: 'rgba(251, 191, 36, 0.1)', text: '#fbbf24', label: 'Expired' },
}

export function StatusBadge({ status }: Props) {
    const config = statusConfig[status] || statusConfig.inactive

    return (
        <span
            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium"
            style={{ background: config.bg, color: config.text }}
        >
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: config.text }} />
            {config.label}
        </span>
    )
}
