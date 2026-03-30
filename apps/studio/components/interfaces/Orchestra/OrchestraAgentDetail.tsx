import { useParams } from 'common'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import {
  Activity,
  ArrowLeft,
  Bot,
  BrainCircuit,
  CheckCircle2,
  Clock,
  Lightbulb,
  Plug,
  User,
} from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'
import {
  Badge,
  Button,
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
  Tabs_Shadcn_,
  TabsContent_Shadcn_,
  TabsList_Shadcn_,
  TabsTrigger_Shadcn_,
} from 'ui'
import {
  MetricCard,
  MetricCardContent,
  MetricCardHeader,
  MetricCardIcon,
  MetricCardLabel,
  MetricCardValue,
} from 'ui-patterns/MetricCard'

import { useOrchestraAgentActivityQuery } from '@/data/orchestra/orchestra-agent-activity-query'
import { useOrchestraAgentDetailQuery } from '@/data/orchestra/orchestra-agent-detail-query'
import { useOrchestraAgentSessionsQuery } from '@/data/orchestra/orchestra-agent-sessions-query'
import { useOrchestraAgentTasksQuery } from '@/data/orchestra/orchestra-agent-tasks-query'

dayjs.extend(relativeTime)

const STATUS_STYLES: Record<
  string,
  { variant: 'default' | 'success' | 'warning' | 'destructive'; label: string }
> = {
  active: { variant: 'success', label: 'Active' },
  inactive: { variant: 'warning', label: 'Inactive' },
  archived: { variant: 'destructive', label: 'Archived' },
}

const TASK_STATUS_STYLES: Record<
  string,
  { variant: 'default' | 'success' | 'warning' | 'destructive'; label: string }
> = {
  backlog: { variant: 'default', label: 'Backlog' },
  todo: { variant: 'default', label: 'To Do' },
  in_progress: { variant: 'warning', label: 'In Progress' },
  in_review: { variant: 'warning', label: 'In Review' },
  blocked: { variant: 'destructive', label: 'Blocked' },
  done: { variant: 'success', label: 'Done' },
  cancelled: { variant: 'destructive', label: 'Cancelled' },
}

function getStatusConfig(status: string) {
  return STATUS_STYLES[status] ?? { variant: 'default' as const, label: status }
}

function getTaskStatusConfig(status: string) {
  return TASK_STATUS_STYLES[status] ?? { variant: 'default' as const, label: status }
}

function formatAction(action: string): string {
  return action.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())
}

function AgentAvatar({
  name,
  avatarUrl,
  type,
  size = 'lg',
}: {
  name: string
  avatarUrl: string | null
  type: string
  size?: 'lg' | 'sm'
}) {
  const initials = name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  const sizeClass = size === 'lg' ? 'h-16 w-16' : 'h-10 w-10'
  const textSize = size === 'lg' ? 'text-xl' : 'text-sm'
  const iconSize = size === 'lg' ? 28 : 18

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        className={`${sizeClass} rounded-full object-cover ring-2 ring-border-strong`}
      />
    )
  }

  return (
    <div
      className={`${sizeClass} rounded-full bg-surface-300 ring-2 ring-border-strong flex items-center justify-center`}
    >
      {type === 'person' ? (
        <User size={iconSize} className="text-foreground-light" />
      ) : initials ? (
        <span className={`${textSize} font-semibold text-foreground`}>{initials}</span>
      ) : (
        <Bot size={iconSize} className="text-foreground-light" />
      )}
    </div>
  )
}

function OverviewTab({
  agent,
  isLoading,
}: {
  agent: NonNullable<ReturnType<typeof useOrchestraAgentDetailQuery>['data']>
  isLoading: boolean
}) {
  return (
    <div className="flex flex-col gap-6">
      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard isLoading={isLoading}>
          <MetricCardHeader>
            <MetricCardIcon>
              <CheckCircle2 size={16} />
            </MetricCardIcon>
            <MetricCardLabel>Tasks Completed</MetricCardLabel>
          </MetricCardHeader>
          <MetricCardContent>
            <MetricCardValue>{agent.tasks_completed}</MetricCardValue>
          </MetricCardContent>
        </MetricCard>

        <MetricCard isLoading={isLoading}>
          <MetricCardHeader>
            <MetricCardIcon>
              <Plug size={16} />
            </MetricCardIcon>
            <MetricCardLabel>Active Sessions</MetricCardLabel>
          </MetricCardHeader>
          <MetricCardContent>
            <MetricCardValue>{agent.active_sessions}</MetricCardValue>
          </MetricCardContent>
        </MetricCard>

        <MetricCard isLoading={isLoading}>
          <MetricCardHeader>
            <MetricCardIcon>
              <BrainCircuit size={16} />
            </MetricCardIcon>
            <MetricCardLabel>Memories Stored</MetricCardLabel>
          </MetricCardHeader>
          <MetricCardContent>
            <MetricCardValue>{agent.memories_stored}</MetricCardValue>
          </MetricCardContent>
        </MetricCard>

        <MetricCard isLoading={isLoading}>
          <MetricCardHeader>
            <MetricCardIcon>
              <Lightbulb size={16} />
            </MetricCardIcon>
            <MetricCardLabel>Decisions Made</MetricCardLabel>
          </MetricCardHeader>
          <MetricCardContent>
            <MetricCardValue>{agent.decisions_made}</MetricCardValue>
          </MetricCardContent>
        </MetricCard>
      </div>

      {/* Agent details */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {agent.persona && (
          <Card>
            <CardHeader>
              <CardTitle>Persona</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-foreground-light whitespace-pre-wrap">{agent.persona}</p>
            </CardContent>
          </Card>
        )}

        {agent.system_prompt && (
          <Card>
            <CardHeader>
              <CardTitle>System Prompt</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="text-xs text-foreground-light whitespace-pre-wrap font-mono bg-surface-200 p-3 rounded-md overflow-x-auto max-h-[300px]">
                {agent.system_prompt}
              </pre>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

function ActivityTab({ agentId }: { agentId: string }) {
  const { ref } = useParams()
  const { data: activity, isPending: isLoading } = useOrchestraAgentActivityQuery(
    { projectRef: ref, agentId },
    { enabled: !!ref && !!agentId }
  )

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3 p-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    )
  }

  if (!activity || activity.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 gap-2">
        <Activity size={24} className="text-foreground-lighter" />
        <p className="text-sm text-foreground-lighter">No activity recorded</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Action</TableHead>
            <TableHead>Summary</TableHead>
            <TableHead className="text-right">Time</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {activity.map((entry) => (
            <TableRow key={entry.id}>
              <TableCell className="text-sm text-foreground">
                {formatAction(entry.action)}
              </TableCell>
              <TableCell className="text-xs text-foreground-lighter">{entry.summary}</TableCell>
              <TableCell className="text-xs text-foreground-lighter text-right whitespace-nowrap">
                {dayjs(entry.created_at).fromNow()}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function TasksTab({ agentId }: { agentId: string }) {
  const { ref } = useParams()
  const { data: tasks, isPending: isLoading } = useOrchestraAgentTasksQuery(
    { projectRef: ref, agentId },
    { enabled: !!ref && !!agentId }
  )

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3 p-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    )
  }

  if (!tasks || tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 gap-2">
        <CheckCircle2 size={24} className="text-foreground-lighter" />
        <p className="text-sm text-foreground-lighter">No tasks assigned</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Title</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Priority</TableHead>
            <TableHead>Project</TableHead>
            <TableHead className="text-right">Created</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tasks.map((task) => {
            const taskStatus = getTaskStatusConfig(task.status)
            return (
              <TableRow key={task.id}>
                <TableCell className="text-sm text-foreground font-medium">{task.title}</TableCell>
                <TableCell>
                  <Badge variant={taskStatus.variant}>{taskStatus.label}</Badge>
                </TableCell>
                <TableCell className="text-xs text-foreground-lighter">
                  {task.priority ?? '--'}
                </TableCell>
                <TableCell className="text-xs text-foreground-lighter">
                  {task.project_name ?? '--'}
                </TableCell>
                <TableCell className="text-xs text-foreground-lighter text-right whitespace-nowrap">
                  {dayjs(task.created_at).fromNow()}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}

function SkillsTab({ skills }: { skills: string[] }) {
  if (!skills || skills.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 gap-2">
        <Lightbulb size={24} className="text-foreground-lighter" />
        <p className="text-sm text-foreground-lighter">No skills assigned</p>
      </div>
    )
  }

  return (
    <div className="flex flex-wrap gap-2 p-4">
      {skills.map((skill) => (
        <span
          key={skill}
          className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium bg-surface-300 text-foreground-light"
        >
          {skill}
        </span>
      ))}
    </div>
  )
}

function SessionsTab({ agentId }: { agentId: string }) {
  const { ref } = useParams()
  const { data: sessions, isPending: isLoading } = useOrchestraAgentSessionsQuery(
    { projectRef: ref, agentId },
    { enabled: !!ref && !!agentId }
  )

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3 p-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    )
  }

  if (!sessions || sessions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 gap-2">
        <Clock size={24} className="text-foreground-lighter" />
        <p className="text-sm text-foreground-lighter">No session history</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Status</TableHead>
            <TableHead>Started</TableHead>
            <TableHead>Ended</TableHead>
            <TableHead className="text-right">Last Heartbeat</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sessions.map((session) => {
            const isActive = !session.ended_at
            return (
              <TableRow key={session.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div
                      className={`h-2 w-2 rounded-full shrink-0 ${isActive ? 'bg-brand' : 'bg-foreground-muted'}`}
                    />
                    <span className="text-sm text-foreground">{isActive ? 'Active' : 'Ended'}</span>
                  </div>
                </TableCell>
                <TableCell className="text-xs text-foreground-lighter">
                  {dayjs(session.started_at).format('MMM D, YYYY HH:mm')}
                </TableCell>
                <TableCell className="text-xs text-foreground-lighter">
                  {session.ended_at ? dayjs(session.ended_at).format('MMM D, YYYY HH:mm') : '--'}
                </TableCell>
                <TableCell className="text-xs text-foreground-lighter text-right whitespace-nowrap">
                  {session.last_heartbeat ? dayjs(session.last_heartbeat).fromNow() : '--'}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}

export const OrchestraAgentDetail = () => {
  const { ref, agentId } = useParams()
  const [activeTab, setActiveTab] = useState('overview')

  const { data: agent, isPending: isLoading } = useOrchestraAgentDetailQuery(
    { projectRef: ref, agentId: agentId as string },
    { enabled: !!ref && !!agentId }
  )

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-16 w-16 rounded-full" />
          <div className="flex flex-col gap-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[100px] w-full rounded-lg" />
          ))}
        </div>
      </div>
    )
  }

  if (!agent) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <Bot size={32} className="text-foreground-lighter" strokeWidth={1.5} />
        <div className="flex flex-col items-center gap-1">
          <p className="text-sm text-foreground">Agent not found</p>
          <p className="text-xs text-foreground-lighter">
            The requested agent does not exist or has been removed
          </p>
        </div>
        <Link href={`/project/${ref}/orchestra/agents`}>
          <Button type="default" size="small" icon={<ArrowLeft size={14} />}>
            Back to Agents
          </Button>
        </Link>
      </div>
    )
  }

  const statusConfig = getStatusConfig(agent.status)

  return (
    <div className="flex flex-col gap-6">
      {/* Back link */}
      <div>
        <Link
          href={`/project/${ref}/orchestra/agents`}
          className="text-xs text-foreground-lighter hover:text-foreground transition-colors flex items-center gap-1"
        >
          <ArrowLeft size={12} />
          Back to Agents
        </Link>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <AgentAvatar name={agent.name} avatarUrl={agent.avatar_url} type={agent.type} />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold text-foreground">{agent.name}</h1>
              <Badge variant={statusConfig.variant}>{statusConfig.label}</Badge>
              <Badge variant="default" className="capitalize">
                {agent.type}
              </Badge>
            </div>
            <p className="text-sm text-foreground-lighter mt-0.5">{agent.role}</p>
            {agent.team_name && (
              <p className="text-xs text-foreground-muted mt-0.5">Team: {agent.team_name}</p>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs_Shadcn_ value={activeTab} onValueChange={setActiveTab}>
        <TabsList_Shadcn_ className="bg-transparent border-b border-default w-full justify-start rounded-none h-auto p-0 gap-0">
          {[
            { value: 'overview', label: 'Overview' },
            { value: 'activity', label: 'Activity' },
            { value: 'tasks', label: 'Tasks' },
            {
              value: 'skills',
              label: `Skills${agent.skills.length > 0 ? ` (${agent.skills.length})` : ''}`,
            },
            { value: 'sessions', label: 'Sessions' },
          ].map((tab) => (
            <TabsTrigger_Shadcn_
              key={tab.value}
              value={tab.value}
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 pb-3 pt-2 text-sm text-foreground-lighter data-[state=active]:text-foreground"
            >
              {tab.label}
            </TabsTrigger_Shadcn_>
          ))}
        </TabsList_Shadcn_>

        <TabsContent_Shadcn_ value="overview" className="mt-6">
          <OverviewTab agent={agent} isLoading={isLoading} />
        </TabsContent_Shadcn_>

        <TabsContent_Shadcn_ value="activity" className="mt-6">
          <ActivityTab agentId={agent.id} />
        </TabsContent_Shadcn_>

        <TabsContent_Shadcn_ value="tasks" className="mt-6">
          <TasksTab agentId={agent.id} />
        </TabsContent_Shadcn_>

        <TabsContent_Shadcn_ value="skills" className="mt-6">
          <SkillsTab skills={agent.skills} />
        </TabsContent_Shadcn_>

        <TabsContent_Shadcn_ value="sessions" className="mt-6">
          <SessionsTab agentId={agent.id} />
        </TabsContent_Shadcn_>
      </Tabs_Shadcn_>
    </div>
  )
}
