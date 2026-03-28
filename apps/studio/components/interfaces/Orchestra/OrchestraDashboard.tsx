import { useParams } from 'common'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import { Activity, Bot, BrainCircuit, Plug } from 'lucide-react'
import { Badge, Card, CardContent, cn, Skeleton } from 'ui'
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
          <div className="p-card border-b">
            <h3 className="text-sm font-medium text-foreground">Recent Activity</h3>
          </div>
          <CardContent className="p-0">
            {isActivityLoading ? (
              <div className="p-4 flex flex-col gap-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : activityLog && activityLog.length > 0 ? (
              <div className="divide-y divide-border">
                {activityLog.map((entry) => (
                  <div
                    key={entry.id}
                    className="px-4 py-3 flex items-center justify-between gap-3"
                  >
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <span className="text-sm text-foreground truncate">
                        {formatAction(entry.action)}
                      </span>
                      <span className="text-xs text-foreground-lighter truncate">
                        {entry.entity_type}:{entry.entity_id}
                      </span>
                    </div>
                    <span className="text-xs text-foreground-lighter whitespace-nowrap">
                      {dayjs(entry.created_at).fromNow()}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-6 text-center text-sm text-foreground-lighter">
                No recent activity
              </div>
            )}
          </CardContent>
        </Card>

        {/* Active Sessions */}
        <Card>
          <div className="p-card border-b">
            <h3 className="text-sm font-medium text-foreground">Active Sessions</h3>
          </div>
          <CardContent className="p-0">
            {isSessionsLoading ? (
              <div className="p-4 flex flex-col gap-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : activeSessions && activeSessions.length > 0 ? (
              <div className="divide-y divide-border">
                {activeSessions.map((session) => (
                  <div
                    key={session.id}
                    className="px-4 py-3 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="h-2 w-2 rounded-full bg-brand shrink-0" />
                      <div className="flex flex-col gap-0.5 min-w-0">
                        <span className="text-sm text-foreground truncate">
                          {session.agent_name}
                        </span>
                        <span className="text-xs text-foreground-lighter truncate">
                          Started {dayjs(session.started_at).fromNow()}
                        </span>
                      </div>
                    </div>
                    {session.last_heartbeat && (
                      <span className="text-xs text-foreground-lighter whitespace-nowrap">
                        Last ping {dayjs(session.last_heartbeat).fromNow()}
                      </span>
                    )}
                  </div>
                ))}
              </div>
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
