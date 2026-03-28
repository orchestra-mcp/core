import { useParams } from 'common'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import { Bot } from 'lucide-react'
import {
  Badge,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from 'ui'

import { useOrchestraAgentsQuery } from '@/data/orchestra/orchestra-agents-query'

dayjs.extend(relativeTime)

const STATUS_STYLES: Record<
  string,
  { variant: 'default' | 'success' | 'warning' | 'destructive'; label: string }
> = {
  active: { variant: 'default', label: 'Active' },
  inactive: { variant: 'warning', label: 'Inactive' },
  archived: { variant: 'destructive', label: 'Archived' },
}

function getStatusConfig(status: string) {
  return STATUS_STYLES[status] ?? { variant: 'default' as const, label: status }
}

export const OrchestraAgents = () => {
  const { ref } = useParams()

  const { data: agents, isPending: isLoading } = useOrchestraAgentsQuery(
    { projectRef: ref },
    { enabled: !!ref }
  )

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3 p-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    )
  }

  if (!agents || agents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <Bot size={32} className="text-foreground-lighter" strokeWidth={1.5} />
        <div className="flex flex-col items-center gap-1">
          <p className="text-sm text-foreground">No agents registered</p>
          <p className="text-xs text-foreground-lighter">
            Agents will appear here once they connect to your project
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Team</TableHead>
            <TableHead>Last Active</TableHead>
            <TableHead>Created</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {agents.map((agent) => {
            const statusConfig = getStatusConfig(agent.status)
            return (
              <TableRow key={agent.id}>
                <TableCell className="font-medium text-foreground">{agent.name}</TableCell>
                <TableCell className="text-foreground-light">{agent.role}</TableCell>
                <TableCell>
                  <Badge variant={statusConfig.variant}>{statusConfig.label}</Badge>
                </TableCell>
                <TableCell className="text-foreground-light">
                  {agent.team ?? '--'}
                </TableCell>
                <TableCell className="text-foreground-light">
                  {agent.last_active_at ? dayjs(agent.last_active_at).fromNow() : '--'}
                </TableCell>
                <TableCell className="text-foreground-light">
                  {dayjs(agent.created_at).format('MMM D, YYYY')}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
