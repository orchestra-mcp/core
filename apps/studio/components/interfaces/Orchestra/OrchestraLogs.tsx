import { useParams } from 'common'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import { ChevronDown, ChevronRight, FileText, Pause, Play, RefreshCw } from 'lucide-react'
import { useCallback, useState } from 'react'
import {
  Badge,
  Button,
  cn,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tabs_Shadcn_,
  TabsList_Shadcn_,
  TabsTrigger_Shadcn_,
  Select_Shadcn_,
  SelectContent_Shadcn_,
  SelectItem_Shadcn_,
  SelectTrigger_Shadcn_,
  SelectValue_Shadcn_,
} from 'ui'

import {
  type ServiceFilter,
  type ServiceLogEntry,
  useOrchestraServiceLogsQuery,
} from '@/data/orchestra/orchestra-service-logs-query'

dayjs.extend(relativeTime)

const SERVICE_STYLES: Record<
  string,
  { variant: 'default' | 'success' | 'warning' | 'destructive'; label: string }
> = {
  go_mcp: { variant: 'success', label: 'Go MCP' },
  laravel: { variant: 'default', label: 'Laravel' },
  orchestra: { variant: 'warning', label: 'Orchestra' },
  studio: { variant: 'default', label: 'Studio' },
}

const LEVEL_STYLES: Record<
  string,
  { variant: 'default' | 'success' | 'warning' | 'destructive'; label: string }
> = {
  fatal: { variant: 'destructive', label: 'Fatal' },
  error: { variant: 'destructive', label: 'Error' },
  warning: { variant: 'warning', label: 'Warning' },
  info: { variant: 'success', label: 'Info' },
  debug: { variant: 'default', label: 'Debug' },
}

const TIME_RANGES = [
  { label: 'Last 1h', hours: 1 },
  { label: 'Last 6h', hours: 6 },
  { label: 'Last 24h', hours: 24 },
  { label: 'Last 7d', hours: 168 },
]

function getServiceConfig(service: string) {
  return SERVICE_STYLES[service] ?? { variant: 'default' as const, label: service }
}

function getLevelConfig(level: string) {
  return LEVEL_STYLES[level] ?? { variant: 'default' as const, label: level }
}

function tryParseJson(value: string | null): Record<string, unknown> | null {
  if (!value) return null
  try {
    const parsed = JSON.parse(value)
    if (typeof parsed === 'object' && parsed !== null) return parsed
    return null
  } catch {
    return null
  }
}

function ExpandableContext({ context }: { context: string | null }) {
  const [expanded, setExpanded] = useState(false)
  const parsed = tryParseJson(context)

  if (!parsed || Object.keys(parsed).length === 0) {
    return <span className="text-foreground-lighter">--</span>
  }

  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1 text-xs text-foreground-lighter hover:text-foreground transition-colors"
      >
        {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        <span>{Object.keys(parsed).length} fields</span>
      </button>
      {expanded && (
        <pre className="mt-2 p-2 rounded bg-surface-200 text-xs text-foreground-light overflow-x-auto max-w-[400px]">
          {JSON.stringify(parsed, null, 2)}
        </pre>
      )}
    </div>
  )
}

export const OrchestraLogs = () => {
  const { ref } = useParams()

  const [service, setService] = useState<ServiceFilter>('all')
  const [level, setLevel] = useState<string | undefined>(undefined)
  const [hours, setHours] = useState(24)
  const [autoRefresh, setAutoRefresh] = useState(true)

  const {
    data: logs,
    isPending: isLoading,
    refetch,
  } = useOrchestraServiceLogsQuery(
    {
      projectRef: ref,
      service,
      level,
      hours,
    },
    {
      enabled: !!ref,
      refetchInterval: autoRefresh ? 10_000 : false,
    }
  )

  const handleRefresh = useCallback(() => {
    refetch()
  }, [refetch])

  return (
    <div className="flex flex-col gap-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        {/* Service tabs */}
        <Tabs_Shadcn_
          value={service}
          onValueChange={(v) => setService(v as ServiceFilter)}
        >
          <TabsList_Shadcn_ className="bg-transparent border-b border-default gap-2">
            <TabsTrigger_Shadcn_ value="all">All</TabsTrigger_Shadcn_>
            <TabsTrigger_Shadcn_ value="go_mcp">Go MCP</TabsTrigger_Shadcn_>
            <TabsTrigger_Shadcn_ value="laravel">Laravel</TabsTrigger_Shadcn_>
            <TabsTrigger_Shadcn_ value="orchestra">Orchestra</TabsTrigger_Shadcn_>
          </TabsList_Shadcn_>
        </Tabs_Shadcn_>

        <div className="flex items-center gap-2 ml-auto">
          {/* Level filter */}
          <Select_Shadcn_
            value={level ?? '__all__'}
            onValueChange={(v) => setLevel(v === '__all__' ? undefined : v)}
          >
            <SelectTrigger_Shadcn_ className="w-[120px]">
              <SelectValue_Shadcn_ placeholder="Level" />
            </SelectTrigger_Shadcn_>
            <SelectContent_Shadcn_>
              <SelectItem_Shadcn_ value="__all__">All Levels</SelectItem_Shadcn_>
              <SelectItem_Shadcn_ value="fatal">Fatal</SelectItem_Shadcn_>
              <SelectItem_Shadcn_ value="error">Error</SelectItem_Shadcn_>
              <SelectItem_Shadcn_ value="warning">Warning</SelectItem_Shadcn_>
              <SelectItem_Shadcn_ value="info">Info</SelectItem_Shadcn_>
              <SelectItem_Shadcn_ value="debug">Debug</SelectItem_Shadcn_>
            </SelectContent_Shadcn_>
          </Select_Shadcn_>

          {/* Time range */}
          <Select_Shadcn_
            value={String(hours)}
            onValueChange={(v) => setHours(Number(v))}
          >
            <SelectTrigger_Shadcn_ className="w-[130px]">
              <SelectValue_Shadcn_ />
            </SelectTrigger_Shadcn_>
            <SelectContent_Shadcn_>
              {TIME_RANGES.map((range) => (
                <SelectItem_Shadcn_ key={range.hours} value={String(range.hours)}>
                  {range.label}
                </SelectItem_Shadcn_>
              ))}
            </SelectContent_Shadcn_>
          </Select_Shadcn_>

          {/* Auto-refresh toggle */}
          <Button
            type="default"
            size="tiny"
            icon={autoRefresh ? <Pause size={14} /> : <Play size={14} />}
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            {autoRefresh ? 'Pause' : 'Live'}
          </Button>

          {/* Manual refresh */}
          <Button
            type="default"
            size="tiny"
            icon={<RefreshCw size={14} />}
            onClick={handleRefresh}
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* Log table */}
      {isLoading ? (
        <div className="flex flex-col gap-3 p-4">
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : !logs || logs.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 gap-3">
          <FileText size={32} className="text-foreground-lighter" strokeWidth={1.5} />
          <div className="flex flex-col items-center gap-1">
            <p className="text-sm text-foreground">No logs found</p>
            <p className="text-xs text-foreground-lighter">
              No log entries match the selected filters
            </p>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[160px]">Time</TableHead>
                <TableHead className="w-[100px]">Service</TableHead>
                <TableHead className="w-[80px]">Level</TableHead>
                <TableHead>Message</TableHead>
                <TableHead className="w-[140px]">Context</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((entry: ServiceLogEntry) => {
                const serviceConfig = getServiceConfig(entry.service)
                const levelConfig = getLevelConfig(entry.level)
                return (
                  <TableRow
                    key={entry.id}
                    className={cn(
                      entry.level === 'error' || entry.level === 'fatal'
                        ? 'bg-destructive-200/10'
                        : undefined
                    )}
                  >
                    <TableCell className="text-foreground-lighter text-xs font-mono whitespace-nowrap">
                      {dayjs(entry.created_at).format('HH:mm:ss.SSS')}
                      <span className="block text-foreground-muted">
                        {dayjs(entry.created_at).fromNow()}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={serviceConfig.variant}>{serviceConfig.label}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={levelConfig.variant}>{levelConfig.label}</Badge>
                    </TableCell>
                    <TableCell className="text-sm max-w-[500px]">
                      <span className="line-clamp-2">{entry.message}</span>
                      {entry.request_id && (
                        <span className="block text-xs text-foreground-muted font-mono mt-0.5">
                          req:{entry.request_id}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <ExpandableContext context={entry.context} />
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Footer info */}
      {logs && logs.length > 0 && (
        <div className="flex items-center justify-between text-xs text-foreground-lighter px-1">
          <span>Showing {logs.length} log entries</span>
          {autoRefresh && <span>Auto-refreshing every 10s</span>}
        </div>
      )}
    </div>
  )
}
