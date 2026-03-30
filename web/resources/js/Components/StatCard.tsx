import type { ReactNode } from 'react'

interface Props {
    label: string
    value: string | number
    color: 'cyan' | 'purple'
    icon: ReactNode
}

const colorMap = {
    cyan: {
        bg: 'rgba(0, 229, 255, 0.08)',
        text: '#00E5FF',
        glow: '0 0 0 1px rgba(0, 229, 255, 0.08)',
    },
    purple: {
        bg: 'rgba(169, 0, 255, 0.08)',
        text: '#A900FF',
        glow: '0 0 0 1px rgba(169, 0, 255, 0.08)',
    },
}

export function StatCard({ label, value, color, icon }: Props) {
    const colors = colorMap[color]

    return (
        <div
            className="rounded-lg p-4"
            style={{
                background: 'var(--color-bg-sidebar)',
                border: '1px solid var(--color-border)',
                boxShadow: colors.glow,
            }}
        >
            <div className="flex items-center justify-between mb-3">
                <span className="text-[12px] font-medium" style={{ color: 'var(--color-text-muted)' }}>
                    {label}
                </span>
                <div
                    className="flex items-center justify-center w-8 h-8 rounded-md"
                    style={{ background: colors.bg }}
                >
                    <span style={{ color: colors.text }}>{icon}</span>
                </div>
            </div>
            <div className="text-[24px] font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                {value}
            </div>
        </div>
    )
}
