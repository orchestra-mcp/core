import { Head } from '@inertiajs/react'
import DashboardLayout from '@/Layouts/DashboardLayout'
import { Link2, GitFork, MessageSquare, ExternalLink, Check } from 'lucide-react'

interface Props {
    connectedAccounts: Record<string, any>
}

interface ConnectionCard {
    key: string
    name: string
    description: string
    icon: typeof GitFork
    color: string
    bgColor: string
}

const connections: ConnectionCard[] = [
    {
        key: 'github',
        name: 'GitHub',
        description: 'Connect your GitHub account for repository access and code management.',
        icon: GitFork,
        color: '#ffffff',
        bgColor: 'rgba(255, 255, 255, 0.08)',
    },
    {
        key: 'discord',
        name: 'Discord',
        description: 'Receive notifications and interact with agents via Discord.',
        icon: MessageSquare,
        color: '#5865F2',
        bgColor: 'rgba(88, 101, 242, 0.08)',
    },
    {
        key: 'slack',
        name: 'Slack',
        description: 'Connect Slack for team notifications and agent interactions.',
        icon: MessageSquare,
        color: '#4A154B',
        bgColor: 'rgba(74, 21, 75, 0.15)',
    },
    {
        key: 'claude',
        name: 'Claude Desktop',
        description: 'Connect Claude Desktop for direct MCP access.',
        icon: Link2,
        color: '#00E5FF',
        bgColor: 'rgba(0, 229, 255, 0.08)',
    },
    {
        key: 'claude_code',
        name: 'Claude Code',
        description: 'Connect Claude Code CLI for developer workflows.',
        icon: Link2,
        color: '#A900FF',
        bgColor: 'rgba(169, 0, 255, 0.08)',
    },
]

export default function Connections({ connectedAccounts }: Props) {
    const connected = connectedAccounts || {}

    return (
        <DashboardLayout title="Connections">
            <Head title="Connections" />

            {/* Page heading */}
            <div className="mb-6">
                <h1 className="text-[14px] font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                    Connections
                </h1>
                <p className="mt-1 text-[13px]" style={{ color: 'var(--color-text-muted)' }}>
                    Connect external services to Orchestra MCP.
                </p>
            </div>

            {/* Connection cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {connections.map((conn) => {
                    const isConnected = !!connected[conn.key]
                    const Icon = conn.icon

                    return (
                        <div
                            key={conn.key}
                            className="rounded-lg p-5"
                            style={{
                                border: isConnected ? '1px solid rgba(52, 211, 153, 0.3)' : '1px solid var(--color-border)',
                                background: 'var(--color-bg-sidebar)',
                            }}
                        >
                            <div className="flex items-start justify-between mb-3">
                                <div className="flex items-center gap-3">
                                    <div
                                        className="flex items-center justify-center w-10 h-10 rounded-lg"
                                        style={{ background: conn.bgColor }}
                                    >
                                        <Icon className="w-5 h-5" style={{ color: conn.color }} />
                                    </div>
                                    <div>
                                        <h3 className="text-[13px] font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                                            {conn.name}
                                        </h3>
                                        {isConnected && (
                                            <span className="inline-flex items-center gap-1 text-[11px]" style={{ color: '#34d399' }}>
                                                <Check className="w-3 h-3" />
                                                Connected
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <p className="text-[12px] mb-4" style={{ color: 'var(--color-text-muted)' }}>
                                {conn.description}
                            </p>

                            {isConnected ? (
                                <div className="flex gap-2">
                                    <button className="btn-secondary text-[12px]">Configure</button>
                                    <button className="btn-danger text-[12px]">Disconnect</button>
                                </div>
                            ) : (
                                <button className="btn-primary inline-flex items-center gap-1.5 text-[12px]">
                                    <ExternalLink className="w-3 h-3" />
                                    Connect
                                </button>
                            )}
                        </div>
                    )
                })}
            </div>

            {/* MCP Token Setup Guide */}
            <div
                className="rounded-lg p-6 mt-6"
                style={{ border: '1px solid var(--color-border)', background: 'var(--color-bg-sidebar)' }}
            >
                <h2 className="text-[13px] font-medium mb-3" style={{ color: 'var(--color-text-primary)' }}>
                    Quick Connect via MCP Token
                </h2>
                <p className="text-[12px] mb-4" style={{ color: 'var(--color-text-muted)' }}>
                    Copy your MCP token and add it to your Claude configuration:
                </p>
                <pre
                    className="text-[12px] font-mono p-3 rounded overflow-x-auto"
                    style={{ background: 'var(--color-bg-input)', color: 'var(--color-text-secondary)' }}
                >
{`{
  "mcpServers": {
    "orchestra": {
      "url": "https://mcp.orchestra.io",
      "headers": {
        "Authorization": "Bearer YOUR_MCP_TOKEN"
      }
    }
  }
}`}
                </pre>
            </div>
        </DashboardLayout>
    )
}
