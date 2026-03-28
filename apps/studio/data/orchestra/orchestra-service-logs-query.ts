import { useQuery } from '@tanstack/react-query'
import { executeSql } from 'data/sql/execute-sql-query'
import type { ResponseError, UseCustomQueryOptions } from 'types'

import { orchestraKeys } from './keys'

export interface ServiceLogEntry {
  id: string
  service: string
  level: string
  message: string
  context: string | null
  request_id: string | null
  created_at: string
}

export type ServiceFilter = 'all' | 'go_mcp' | 'laravel' | 'orchestra'

export async function getOrchestraServiceLogs(
  {
    projectRef,
    service = 'all',
    level,
    hours = 24,
  }: {
    projectRef: string
    service?: ServiceFilter
    level?: string
    hours?: number
  },
  signal?: AbortSignal
) {
  // Query service_logs table
  let serviceLogsSql = `
    SELECT id, service, level, message, context::text, request_id, created_at
    FROM public.service_logs
    WHERE created_at > now() - interval '${hours} hours'
  `
  if (service !== 'all') {
    serviceLogsSql += ` AND service = '${service}'`
  }
  if (level) {
    serviceLogsSql += ` AND level = '${level}'`
  }
  serviceLogsSql += ` ORDER BY created_at DESC LIMIT 200`

  // Query activity_log table as secondary source (only when viewing all or orchestra)
  const activityLogSql = `
    SELECT id, 'orchestra' as service, 'info' as level,
           COALESCE(action, '') || ': ' || COALESCE(entity_type, '') || ' ' || COALESCE(entity_id, '') as message,
           metadata::text as context, NULL as request_id, created_at
    FROM public.activity_log
    WHERE created_at > now() - interval '${hours} hours'
    ORDER BY created_at DESC
    LIMIT 50
  `

  const includeActivityLog = service === 'all' || service === 'orchestra'

  // Combine both sources using UNION ALL when applicable
  const combinedSql = includeActivityLog
    ? `(${serviceLogsSql}) UNION ALL (${activityLogSql}) ORDER BY created_at DESC LIMIT 200`
    : serviceLogsSql

  const { result } = await executeSql<ServiceLogEntry[]>(
    {
      projectRef,
      sql: combinedSql,
      queryKey: orchestraKeys.serviceLogs(projectRef, service, level, hours),
    },
    signal
  )

  return result ?? []
}

export type OrchestraServiceLogsData = Awaited<ReturnType<typeof getOrchestraServiceLogs>>
export type OrchestraServiceLogsError = ResponseError

export const useOrchestraServiceLogsQuery = <TData = OrchestraServiceLogsData>(
  {
    projectRef,
    service,
    level,
    hours,
  }: {
    projectRef: string | undefined
    service?: ServiceFilter
    level?: string
    hours?: number
  },
  options?: UseCustomQueryOptions<OrchestraServiceLogsData, OrchestraServiceLogsError, TData>
) => {
  return useQuery<OrchestraServiceLogsData, OrchestraServiceLogsError, TData>({
    queryKey: orchestraKeys.serviceLogs(projectRef, service ?? 'all', level, hours ?? 24),
    queryFn: ({ signal }) =>
      getOrchestraServiceLogs(
        { projectRef: projectRef!, service, level, hours },
        signal
      ),
    enabled: !!projectRef,
    refetchInterval: 10_000, // Auto-refresh every 10 seconds
    ...options,
  })
}
