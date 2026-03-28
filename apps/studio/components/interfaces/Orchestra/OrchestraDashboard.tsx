import { useParams } from 'common'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import { Activity, Bot, BrainCircuit, Plug } from 'lucide-react'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from 'ui'
import {
  MetricCard,
  MetricCardContent,
  MetricCardHeader,
  MetricCardIcon,
  MetricCardLabel,
  MetricCardValue,
} from 'ui-patterns/MetricCard'

import { useOrchestraActiveSessionsQuery } from '@/data/orchestra/orchestra-active-sessions-query'
import { useOrchestraActivityLogQuery } from '@/data/orchestra/orchestra-activity-log-query'
import { useOrchestraDashboardQuery } from '@/data/orchestra/orchestra-dashboard-query'

dayjs.extend(relativeTime)

export const OrchestraDashboard = () => {
  const { ref } = useParams()

  const { data: metrics, isPending: isMetricsLoading } = useOrchestraDashboardQuery(
    { projectRef: ref },
    { enabled: !!ref }
  )

  const { data: activityLog, isPending: isActivityLoading } = useOrchestraActivityLogQuery(
    { projectRef: ref },
    { enabled: !!ref }
  )

  const { data: activeSessions, isPending: isSessionsLoading } = useOrchestraActiveSessionsQuery(
    { projectRef: ref },
    { enabled: !!ref }
  )

  return (
    <div className="flex flex-col gap-6">
      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard isLoading={isMetricsLoading}>
          <MetricCardHeader>
            <MetricCardIcon>
              <Plug size={16} />
            </MetricCardIcon>
            <MetricCardLabel>Active Connections</MetricCardLabel>
          </MetricCardHeader>
          <MetricCardContent>
            <MetricCardValue>{metrics?.active_connections ?? 0}</MetricCardValue>
          </MetricCardContent>
        </MetricCard>

        <MetricCard isLoading={isMetricsLoading}>
          <MetricCardHeader>
            <MetricCardIcon>
              <Activity size={16} />
            </MetricCardIcon>
            <MetricCardLabel>Tasks Today</MetricCardLabel>
          </MetricCardHeader>
          <MetricCardContent>
            <MetricCardValue>{metrics?.tasks_today ?? 0}</MetricCardValue>
          </MetricCardContent>
        </MetricCard>

        <MetricCard isLoading={isMetricsLoading}>
          <MetricCardHeader>
            <MetricCardIcon>
              <Bot size={16} />
            </MetricCardIcon>
            <MetricCardLabel>Total Agents</MetricCardLabel>
          </MetricCardHeader>
          <MetricCardContent>
            <MetricCardValue>{metrics?.total_agents ?? 0}</MetricCardValue>
          </MetricCardContent>
        </MetricCard>

        <MetricCard isLoading={isMetricsLoading}>
          <MetricCardHeader>
            <MetricCardIcon>
              <BrainCircuit size={16} />
            </MetricCardIcon>
            <MetricCardLabel>Total Memories</MetricCardLabel>
          </MetricCardHeader>
          <MetricCardContent>
            <MetricCardValue>{metrics?.total_memories ?? 0}</MetricCardValue>
          </MetricCardContent>
        </MetricCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity Feed */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isActivityLoading ? (
              <div className="p-4 flex flex-col gap-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : activityLog && activityLog.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Action</TableHead>
                    <TableHead>Entity</TableHead>
                    <TableHead className="text-right">Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activityLog.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="text-sm text-foreground">
                        {formatAction(entry.action)}
                      </TableCell>
                      <TableCell className="text-xs text-foreground-lighter">
                        {entry.entity_type}:{entry.entity_id}
                      </TableCell>
                      <TableCell className="text-xs text-foreground-lighter text-right whitespace-nowrap">
                        {dayjs(entry.created_at).fromNow()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="p-6 text-center text-sm text-foreground-lighter">
                No recent activity
              </div>
            )}
          </CardContent>
        </Card>

        {/* Active Sessions */}
        <Card>
          <CardHeader>
            <CardTitle>Active Sessions</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isSessionsLoading ? (
              <div className="p-4 flex flex-col gap-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : activeSessions && activeSessions.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Agent</TableHead>
                    <TableHead>Started</TableHead>
                    <TableHead className="text-right">Last Ping</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeSessions.map((session) => (
                    <TableRow key={session.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-2 rounded-full bg-brand shrink-0" />
                          <span className="text-sm text-foreground">{session.agent_name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-foreground-lighter">
                        {dayjs(session.started_at).fromNow()}
                      </TableCell>
                      <TableCell className="text-xs text-foreground-lighter text-right whitespace-nowrap">
                        {session.last_heartbeat
                          ? dayjs(session.last_heartbeat).fromNow()
                          : '--'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="p-6 text-center text-sm text-foreground-lighter">
                No active sessions
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function formatAction(action: string): string {
  return action
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (l) => l.toUpperCase())
}
