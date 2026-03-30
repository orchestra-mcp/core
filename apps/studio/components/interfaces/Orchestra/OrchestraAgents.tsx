import { useParams } from 'common'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import {
  Bot,
  BrainCircuit,
  CheckCircle2,
  Plus,
  Search,
  SortAsc,
  SortDesc,
  User,
} from 'lucide-react'
import Link from 'next/link'
import { useMemo, useState } from 'react'
import { Badge, Button, Card, CardContent, Input_Shadcn_, Skeleton } from 'ui'

import { CreateAgentModal } from './CreateAgentModal'
import { useOrchestraAgentsQuery } from '@/data/orchestra/orchestra-agents-query'

dayjs.extend(relativeTime)

const STATUS_STYLES: Record<
  string,
  { variant: 'default' | 'success' | 'warning' | 'destructive'; label: string }
> = {
  active: { variant: 'success', label: 'Active' },
  inactive: { variant: 'warning', label: 'Inactive' },
  archived: { variant: 'destructive', label: 'Archived' },
}

function getStatusConfig(status: string) {
  return STATUS_STYLES[status] ?? { variant: 'default' as const, label: status }
}

function AgentAvatar({
  name,
  avatarUrl,
  type,
}: {
  name: string
  avatarUrl: string | null
  type: string
}) {
  const initials = name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        className="h-12 w-12 rounded-full object-cover ring-2 ring-border-strong"
      />
    )
  }

  return (
    <div className="h-12 w-12 rounded-full bg-surface-300 ring-2 ring-border-strong flex items-center justify-center">
      {type === 'person' ? (
        <User size={20} className="text-foreground-light" />
      ) : initials ? (
        <span className="text-sm font-semibold text-foreground">{initials}</span>
      ) : (
        <Bot size={20} className="text-foreground-light" />
      )}
    </div>
  )
}

type SortOrder = 'latest' | 'oldest'

export const OrchestraAgents = () => {
  const { ref } = useParams()
  const [searchQuery, setSearchQuery] = useState('')
  const [sortOrder, setSortOrder] = useState<SortOrder>('latest')
  const [showCreateModal, setShowCreateModal] = useState(false)

  const { data: agents, isPending: isLoading } = useOrchestraAgentsQuery(
    { projectRef: ref },
    { enabled: !!ref }
  )

  const filteredAgents = useMemo(() => {
    if (!agents) return []

    let result = agents

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          a.role.toLowerCase().includes(q) ||
          (a.team_name && a.team_name.toLowerCase().includes(q)) ||
          a.skills.some((s) => s.toLowerCase().includes(q))
      )
    }

    // Sort
    result = [...result].sort((a, b) => {
      const dateA = new Date(a.created_at).getTime()
      const dateB = new Date(b.created_at).getTime()
      return sortOrder === 'latest' ? dateB - dateA : dateA - dateB
    })

    return result
  }, [agents, searchQuery, sortOrder])

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 flex-1" />
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-32" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-[220px] w-full rounded-lg" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <>
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-6">
        <div className="relative flex-1 w-full sm:max-w-sm">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground-lighter"
          />
          <Input_Shadcn_
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search agents by name, role, or skill..."
            className="pl-9"
          />
        </div>

        <div className="flex items-center gap-2 sm:ml-auto">
          <Button
            type="default"
            size="tiny"
            icon={sortOrder === 'latest' ? <SortDesc size={14} /> : <SortAsc size={14} />}
            onClick={() => setSortOrder(sortOrder === 'latest' ? 'oldest' : 'latest')}
          >
            {sortOrder === 'latest' ? 'Latest' : 'Oldest'}
          </Button>

          <Button
            type="primary"
            size="small"
            icon={<Plus size={14} />}
            onClick={() => setShowCreateModal(true)}
          >
            Create Agent
          </Button>
        </div>
      </div>

      {/* Agent Grid */}
      {filteredAgents.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 gap-3">
          <Bot size={32} className="text-foreground-lighter" strokeWidth={1.5} />
          <div className="flex flex-col items-center gap-1">
            <p className="text-sm text-foreground">
              {searchQuery ? 'No agents match your search' : 'No agents registered'}
            </p>
            <p className="text-xs text-foreground-lighter">
              {searchQuery
                ? 'Try a different search term'
                : 'Create your first agent to get started'}
            </p>
          </div>
          {!searchQuery && (
            <Button
              type="primary"
              size="small"
              icon={<Plus size={14} />}
              onClick={() => setShowCreateModal(true)}
            >
              Create Agent
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredAgents.map((agent) => {
            const statusConfig = getStatusConfig(agent.status)
            return (
              <Link
                key={agent.id}
                href={`/project/${ref}/orchestra/agents/${agent.id}`}
                className="block group"
              >
                <Card className="h-full transition-colors hover:border-foreground-muted group-hover:bg-surface-100">
                  <CardContent className="p-5 flex flex-col gap-4">
                    {/* Header: Avatar + Name + Status */}
                    <div className="flex items-start gap-3">
                      <AgentAvatar
                        name={agent.name}
                        avatarUrl={agent.avatar_url}
                        type={agent.type}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-medium text-foreground truncate">
                            {agent.name}
                          </h3>
                          <Badge variant={statusConfig.variant} className="shrink-0">
                            {statusConfig.label}
                          </Badge>
                        </div>
                        <p className="text-xs text-foreground-lighter mt-0.5">{agent.role}</p>
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="flex items-center gap-4 text-xs text-foreground-lighter">
                      <span className="flex items-center gap-1">
                        <CheckCircle2 size={12} />
                        {agent.tasks_completed} tasks
                      </span>
                      <span className="flex items-center gap-1">
                        <BrainCircuit size={12} />
                        {agent.memories_stored} memories
                      </span>
                    </div>

                    {/* Skills */}
                    {agent.skills && agent.skills.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {agent.skills.slice(0, 4).map((skill) => (
                          <span
                            key={skill}
                            className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-surface-300 text-foreground-light"
                          >
                            {skill}
                          </span>
                        ))}
                        {agent.skills.length > 4 && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-surface-200 text-foreground-lighter">
                            +{agent.skills.length - 4} more
                          </span>
                        )}
                      </div>
                    )}

                    {/* Footer */}
                    <div className="flex items-center justify-between text-[11px] text-foreground-muted pt-1 border-t border-border-overlay">
                      <span>Created {dayjs(agent.created_at).format('MMM D, YYYY')}</span>
                      {agent.team_name && <span>{agent.team_name}</span>}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      )}

      {/* Footer count */}
      {filteredAgents.length > 0 && (
        <div className="text-xs text-foreground-lighter mt-4">
          Showing {filteredAgents.length} of {agents?.length ?? 0} agents
        </div>
      )}

      <CreateAgentModal visible={showCreateModal} onClose={() => setShowCreateModal(false)} />
    </>
  )
}
