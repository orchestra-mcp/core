import {
  DndContext,
  type DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { arrayMove, SortableContext, useSortable } from '@dnd-kit/sortable'
import { useParams } from 'common'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import {
  Activity,
  Bot,
  BrainCircuit,
  ChevronDown,
  ChevronUp,
  GripVertical,
  ListChecks,
  Lock,
  Plug,
  Trophy,
  Unlock,
  FolderKanban,
} from 'lucide-react'
import { type CSSProperties, type ReactNode, useCallback, useMemo, useState } from 'react'
import { Button, cn, Skeleton } from 'ui'
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
import { useOrchestraAgentLeaderboardQuery } from '@/data/orchestra/orchestra-agent-leaderboard-query'
import { useOrchestraDashboardQuery } from '@/data/orchestra/orchestra-dashboard-query'
import { useOrchestraProjectProgressQuery } from '@/data/orchestra/orchestra-project-progress-query'
import { useOrchestraTaskDistributionQuery } from '@/data/orchestra/orchestra-task-distribution-query'
import { useLocalStorage } from 'hooks/misc/useLocalStorage'

dayjs.extend(relativeTime)

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const INITIAL_ACTIVITY_COUNT = 5

const STORAGE_KEY_LAYOUT = 'orchestra-dashboard-layout'
const STORAGE_KEY_COLLAPSED = 'orchestra-dashboard-collapsed'

/** Default widget order. Stat cards are grouped as one widget. */
const DEFAULT_WIDGET_ORDER = [
  'stat-cards',
  'task-distribution',
  'project-progress',
  'agent-leaderboard',
  'recent-activity',
  'active-sessions',
]

// ---------------------------------------------------------------------------
// DashboardWidget — sortable wrapper with drag handle & collapse
// ---------------------------------------------------------------------------

interface DashboardWidgetProps {
  id: string
  title: string
  icon?: ReactNode
  isLocked: boolean
  isCollapsed: boolean
  onToggleCollapse: (id: string) => void
  /** If true, the widget takes 2 grid columns on large screens */
  wide?: boolean
  children: ReactNode
}

function DashboardWidget({
  id,
  title,
  icon,
  isLocked,
  isCollapsed,
  onToggleCollapse,
  wide,
  children,
}: DashboardWidgetProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled: isLocked,
  })

  const style: CSSProperties = {
    transform: transform
      ? `translate3d(${Math.round(transform.x)}px, ${Math.round(transform.y)}px, 0)`
      : undefined,
    transition,
    zIndex: isDragging ? 50 : undefined,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'rounded-md border border-default bg-surface-100 will-change-transform',
        wide && 'lg:col-span-2',
        isDragging && 'opacity-70 shadow-lg'
      )}
    >
      {/* Title bar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-default select-none">
        {!isLocked && (
          <button
            aria-label="Drag to reorder widget"
            className="text-foreground-muted hover:text-foreground cursor-grab active:cursor-grabbing shrink-0"
            {...attributes}
            {...listeners}
          >
            <GripVertical size={14} />
          </button>
        )}
        {icon && <span className="text-foreground-light shrink-0">{icon}</span>}
        <span className="text-xs text-foreground-lighter uppercase tracking-wider font-mono flex-1">
          {title}
        </span>
        <button
          aria-label={isCollapsed ? 'Expand widget' : 'Collapse widget'}
          className="text-foreground-muted hover:text-foreground transition-colors shrink-0"
          onClick={() => onToggleCollapse(id)}
        >
          {isCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
        </button>
      </div>
      {/* Content */}
      {!isCollapsed && <div className="p-4">{children}</div>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Individual widget content components
// ---------------------------------------------------------------------------

function StatCardsContent({
  metrics,
  isLoading,
}: {
  metrics: {
    active_connections: number
    tasks_today: number
    total_agents: number
    total_memories: number
  } | null
  isLoading: boolean
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <MetricCard isLoading={isLoading}>
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

      <MetricCard isLoading={isLoading}>
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

      <MetricCard isLoading={isLoading}>
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

      <MetricCard isLoading={isLoading}>
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
  )
}

// ---------------------------------------------------------------------------

const STATUS_COLORS: Record<string, string> = {
  blocked: 'bg-destructive-500',
  todo: 'bg-foreground-muted',
  in_progress: 'bg-warning-500',
  done: 'bg-brand-500',
}

const STATUS_LABELS: Record<string, string> = {
  blocked: 'Blocked',
  todo: 'Todo',
  in_progress: 'In Progress',
  done: 'Done',
}

function TaskDistributionContent({
  projectRef,
}: {
  projectRef: string | undefined
}) {
  const { data, isPending } = useOrchestraTaskDistributionQuery(
    { projectRef },
    { enabled: !!projectRef }
  )

  if (isPending) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-6 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    )
  }

  const total = data?.reduce((s, d) => s + d.count, 0) ?? 0

  if (total === 0) {
    return (
      <p className="text-sm text-foreground-lighter text-center py-4">No tasks found</p>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Bar */}
      <div className="flex h-6 w-full rounded overflow-hidden">
        {data?.map((d) => {
          const pct = (d.count / total) * 100
          if (pct === 0) return null
          return (
            <div
              key={d.status}
              className={cn(STATUS_COLORS[d.status] ?? 'bg-foreground-muted', 'transition-all')}
              style={{ width: `${pct}%` }}
              title={`${STATUS_LABELS[d.status] ?? d.status}: ${d.count}`}
            />
          )
        })}
      </div>
      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {data?.map((d) => (
          <div key={d.status} className="flex items-center gap-1.5">
            <div
              className={cn(
                'h-2.5 w-2.5 rounded-full shrink-0',
                STATUS_COLORS[d.status] ?? 'bg-foreground-muted'
              )}
            />
            <span className="text-xs text-foreground-lighter">
              {STATUS_LABELS[d.status] ?? d.status}
            </span>
            <span className="text-xs text-foreground font-mono">{d.count}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------

function ProjectProgressContent({
  projectRef,
}: {
  projectRef: string | undefined
}) {
  const { data, isPending } = useOrchestraProjectProgressQuery(
    { projectRef },
    { enabled: !!projectRef }
  )

  if (isPending) {
    return (
      <div className="flex flex-col gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-5 w-full" />
        ))}
      </div>
    )
  }

  if (!data || data.length === 0) {
    return (
      <p className="text-sm text-foreground-lighter text-center py-4">No project data</p>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {data.map((p) => {
        const pct = p.total_tasks > 0 ? Math.round((p.completed_tasks / p.total_tasks) * 100) : 0
        return (
          <div key={p.project_id} className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <span className="text-sm text-foreground truncate">{p.project_name}</span>
              <span className="text-xs text-foreground-muted font-mono shrink-0 ml-2">
                {p.completed_tasks}/{p.total_tasks} ({pct}%)
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-surface-300 overflow-hidden">
              <div
                className="h-full rounded-full bg-brand-500 transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------

function AgentLeaderboardContent({
  projectRef,
}: {
  projectRef: string | undefined
}) {
  const { data, isPending } = useOrchestraAgentLeaderboardQuery(
    { projectRef },
    { enabled: !!projectRef }
  )

  if (isPending) {
    return (
      <div className="flex flex-col gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-6 w-full" />
        ))}
      </div>
    )
  }

  if (!data || data.length === 0) {
    return (
      <p className="text-sm text-foreground-lighter text-center py-4">No agent data</p>
    )
  }

  const maxCount = data[0]?.completed_tasks ?? 1

  return (
    <div className="flex flex-col gap-2">
      {data.map((agent, idx) => {
        const barPct = maxCount > 0 ? Math.round((agent.completed_tasks / maxCount) * 100) : 0
        return (
          <div key={agent.agent_id} className="flex items-center gap-3">
            <span className="text-xs text-foreground-muted font-mono w-5 text-right shrink-0">
              {idx + 1}
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-sm text-foreground truncate">{agent.agent_name}</span>
                <span className="text-xs text-foreground-muted font-mono shrink-0 ml-2">
                  {agent.completed_tasks}
                </span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-surface-300 overflow-hidden">
                <div
                  className="h-full rounded-full bg-brand-500 transition-all"
                  style={{ width: `${barPct}%` }}
                />
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------

function RecentActivityContent({
  activityLog,
  isLoading,
}: {
  activityLog: Array<{ id: string; action: string; summary: string; created_at: string }> | undefined
  isLoading: boolean
}) {
  const [limit, setLimit] = useState(INITIAL_ACTIVITY_COUNT)
  const visible = activityLog?.slice(0, limit) ?? []
  const hasMore = (activityLog?.length ?? 0) > limit

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-full" />
        ))}
      </div>
    )
  }

  if (visible.length === 0) {
    return (
      <p className="text-sm text-foreground-lighter text-center py-4">No recent activity</p>
    )
  }

  return (
    <div className="-m-4">
      <div className="grid grid-cols-[140px_1fr_120px] gap-2 px-4 py-2 border-b border-default">
        <span className="text-xs text-foreground-lighter uppercase tracking-wider font-mono">
          Action
        </span>
        <span className="text-xs text-foreground-lighter uppercase tracking-wider font-mono">
          Summary
        </span>
        <span className="text-xs text-foreground-lighter uppercase tracking-wider font-mono text-right">
          Time
        </span>
      </div>
      {visible.map((entry) => (
        <div
          key={entry.id}
          className="grid grid-cols-[140px_1fr_120px] gap-2 px-4 py-3 border-b border-default last:border-b-0 hover:bg-surface-200 transition-colors"
        >
          <span className="text-sm text-foreground truncate">{formatAction(entry.action)}</span>
          <span className="text-sm text-foreground-lighter line-clamp-2">{entry.summary}</span>
          <span className="text-xs text-foreground-muted text-right whitespace-nowrap self-center">
            {dayjs(entry.created_at).fromNow()}
          </span>
        </div>
      ))}
      {hasMore && (
        <div className="px-4 py-3 border-t border-default">
          <Button
            type="default"
            size="tiny"
            icon={<ChevronDown size={14} />}
            onClick={() => setLimit((prev) => prev + 5)}
          >
            Load more ({(activityLog?.length ?? 0) - limit} remaining)
          </Button>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------

function ActiveSessionsContent({
  sessions,
  isLoading,
}: {
  sessions:
    | Array<{
        id: string
        agent_name: string
        started_at: string
        last_heartbeat: string | null
      }>
    | undefined
  isLoading: boolean
}) {
  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-full" />
        ))}
      </div>
    )
  }

  if (!sessions || sessions.length === 0) {
    return (
      <p className="text-sm text-foreground-lighter text-center py-4">No active sessions</p>
    )
  }

  return (
    <div className="-m-4">
      <div className="grid grid-cols-3 gap-2 px-4 py-2 border-b border-default">
        <span className="text-xs text-foreground-lighter uppercase tracking-wider font-mono">
          Agent
        </span>
        <span className="text-xs text-foreground-lighter uppercase tracking-wider font-mono">
          Started
        </span>
        <span className="text-xs text-foreground-lighter uppercase tracking-wider font-mono text-right">
          Last Ping
        </span>
      </div>
      {sessions.map((session) => (
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
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Widget metadata
// ---------------------------------------------------------------------------

interface WidgetMeta {
  title: string
  icon: ReactNode
  wide: boolean
}

const WIDGET_META: Record<string, WidgetMeta> = {
  'stat-cards': { title: 'Overview', icon: <Activity size={14} />, wide: true },
  'task-distribution': { title: 'Task Distribution', icon: <ListChecks size={14} />, wide: false },
  'project-progress': { title: 'Project Progress', icon: <FolderKanban size={14} />, wide: false },
  'agent-leaderboard': { title: 'Agent Leaderboard', icon: <Trophy size={14} />, wide: false },
  'recent-activity': { title: 'Recent Activity', icon: <Activity size={14} />, wide: true },
  'active-sessions': { title: 'Active Sessions', icon: <Bot size={14} />, wide: true },
}

// ---------------------------------------------------------------------------
// Main dashboard component
// ---------------------------------------------------------------------------

export const OrchestraDashboard = () => {
  const { ref } = useParams()

  // Layout state persisted in localStorage
  const [widgetOrder, setWidgetOrder] = useLocalStorage<string[]>(
    STORAGE_KEY_LAYOUT,
    DEFAULT_WIDGET_ORDER
  )
  const [collapsedWidgets, setCollapsedWidgets] = useLocalStorage<string[]>(
    STORAGE_KEY_COLLAPSED,
    []
  )
  const [isLocked, setIsLocked] = useState(true)

  // Ensure new widgets that might not exist in stored order are appended
  const resolvedOrder = useMemo(() => {
    const existing = new Set(widgetOrder)
    const merged = [...widgetOrder]
    for (const id of DEFAULT_WIDGET_ORDER) {
      if (!existing.has(id)) merged.push(id)
    }
    return merged
  }, [widgetOrder])

  // Data queries
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

  // Drag handling — same pattern as ProjectHome
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      if (!over || active.id === over.id) return
      setWidgetOrder((items) => {
        const oldIndex = items.indexOf(String(active.id))
        const newIndex = items.indexOf(String(over.id))
        if (oldIndex === -1 || newIndex === -1) return items
        return arrayMove(items, oldIndex, newIndex)
      })
    },
    [setWidgetOrder]
  )

  const handleToggleCollapse = useCallback(
    (id: string) => {
      setCollapsedWidgets((prev) =>
        prev.includes(id) ? prev.filter((w) => w !== id) : [...prev, id]
      )
    },
    [setCollapsedWidgets]
  )

  // Render widget content by id
  const renderWidgetContent = (id: string) => {
    switch (id) {
      case 'stat-cards':
        return <StatCardsContent metrics={metrics ?? null} isLoading={isMetricsLoading} />
      case 'task-distribution':
        return <TaskDistributionContent projectRef={ref} />
      case 'project-progress':
        return <ProjectProgressContent projectRef={ref} />
      case 'agent-leaderboard':
        return <AgentLeaderboardContent projectRef={ref} />
      case 'recent-activity':
        return (
          <RecentActivityContent activityLog={activityLog} isLoading={isActivityLoading} />
        )
      case 'active-sessions':
        return (
          <ActiveSessionsContent sessions={activeSessions} isLoading={isSessionsLoading} />
        )
      default:
        return null
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex items-center justify-end">
        <Button
          type="default"
          size="tiny"
          icon={isLocked ? <Lock size={14} /> : <Unlock size={14} />}
          onClick={() => setIsLocked((prev) => !prev)}
        >
          {isLocked ? 'Unlock Layout' : 'Lock Layout'}
        </Button>
      </div>

      {/* Widget grid */}
      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <SortableContext items={resolvedOrder}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {resolvedOrder.map((id) => {
              const meta = WIDGET_META[id]
              if (!meta) return null
              return (
                <DashboardWidget
                  key={id}
                  id={id}
                  title={meta.title}
                  icon={meta.icon}
                  wide={meta.wide}
                  isLocked={isLocked}
                  isCollapsed={collapsedWidgets.includes(id)}
                  onToggleCollapse={handleToggleCollapse}
                >
                  {renderWidgetContent(id)}
                </DashboardWidget>
              )
            })}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatAction(action: string): string {
  return action.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())
}
