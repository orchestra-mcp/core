import { useState } from 'react'
import { useParams } from 'common'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import { Activity, Bot, BrainCircuit, ChevronDown, Plug } from 'lucide-react'
import { Button, Skeleton } from 'ui'
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

const INITIAL_ACTIVITY_COUNT = 5

export const OrchestraDashboard = () => {
  const { ref } = useParams()
  const [activityLimit, setActivityLimit] = useState(INITIAL_ACTIVITY_COUNT)

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

  const visibleActivity = activityLog?.slice(0, activityLimit) ?? []
  const hasMoreActivity = (activityLog?.length ?? 0) > activityLimit

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

      {/* Recent Activity */}
      <div>
        <h3 className="text-sm text-foreground-lighter uppercase tracking-wider font-mono mb-3">
          Recent Activity
        </h3>
        <div className="rounded-md border border-default bg-surface-100">
          <div className="grid grid-cols-[140px_1fr_120px] gap-2 px-4 py-2 border-b border-default">
            <span className="text-xs text-foreground-lighter uppercase tracking-wider font-mono">Action</span>
            <span className="text-xs text-foreground-lighter uppercase tracking-wider font-mono">Summary</span>
            <span className="text-xs text-foreground-lighter uppercase tracking-wider font-mono text-right">Time</span>
          </div>
          {isActivityLoading ? (
            <div className="p-4 flex flex-col gap-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : visibleActivity.length > 0 ? (
            <>
              {visibleActivity.map((entry) => (
                <div
                  key={entry.id}
                  className="grid grid-cols-[140px_1fr_120px] gap-2 px-4 py-3 border-b border-default last:border-b-0 hover:bg-surface-200 transition-colors"
                >
                  <span className="text-sm text-foreground truncate">
                    {formatAction(entry.action)}
                  </span>
                  <span className="text-sm text-foreground-lighter line-clamp-2">
                    {entry.summary}
                  </span>
                  <span className="text-xs text-foreground-muted text-right whitespace-nowrap self-center">
                    {dayjs(entry.created_at).fromNow()}
                  </span>
                </div>
              ))}
              {hasMoreActivity && (
                <div className="px-4 py-3 border-t border-default">
                  <Button
                    type="default"
                    size="tiny"
                    icon={<ChevronDown size={14} />}
                    onClick={() => setActivityLimit((prev) => prev + 5)}
                  >
                    Load more ({(activityLog?.length ?? 0) - activityLimit} remaining)
                  </Button>
                </div>
              )}
            </>
          ) : (
            <div className="px-4 py-8 text-center text-sm text-foreground-lighter">
              No recent activity
            </div>
          )}
        </div>
      </div>

      {/* Active Sessions */}
      <div>
        <h3 className="text-sm text-foreground-lighter uppercase tracking-wider font-mono mb-3">
          Active Sessions
        </h3>
        <div className="rounded-md border border-default bg-surface-100">
          <div className="grid grid-cols-3 gap-2 px-4 py-2 border-b border-default">
            <span className="text-xs text-foreground-lighter uppercase tracking-wider font-mono">Agent</span>
            <span className="text-xs text-foreground-lighter uppercase tracking-wider font-mono">Started</span>
            <span className="text-xs text-foreground-lighter uppercase tracking-wider font-mono text-right">Last Ping</span>
          </div>
          {isSessionsLoading ? (
            <div className="p-4 flex flex-col gap-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : activeSessions && activeSessions.length > 0 ? (
            activeSessions.map((session) => (
              <div
                key={session.id}
                className="grid grid-cols-3 gap-2 px-4 py-3 border-b border-default last:border-b-0 hover:bg-surface-200 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-brand-500 shrink-0" />
                  <span className="text-sm text-foreground truncate">{session.agent_name}</span>
                </div>
                <span className="text-sm text-foreground-lighter self-center">
                  {dayjs(session.started_at).fromNow()}
                </span>
                <span className="text-xs text-foreground-muted text-right self-center whitespace-nowrap">
                  {session.last_heartbeat ? dayjs(session.last_heartbeat).fromNow() : '--'}
                </span>
              </div>
            ))
          ) : (
            <div className="px-4 py-8 text-center text-sm text-foreground-lighter">
              No active sessions
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function formatAction(action: string): string {
  return action
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (l) => l.toUpperCase())
}
