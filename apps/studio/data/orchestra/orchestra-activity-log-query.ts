import { useQuery } from '@tanstack/react-query'
import { executeSql } from 'data/sql/execute-sql-query'
import type { ResponseError, UseCustomQueryOptions } from 'types'

import { orchestraKeys } from './keys'

export interface OrchestraActivityLogEntry {
  id: string
  action: string
  entity_type: string
  entity_id: string
  metadata: Record<string, unknown> | null
  created_at: string
}

export async function getOrchestraActivityLog(
  { projectRef }: { projectRef: string },
  signal?: AbortSignal
) {
  const sql = `
    SELECT id, action, entity_type, entity_id, metadata, created_at
    FROM activity_log
    ORDER BY created_at DESC
    LIMIT 20
  `

  const { result } = await executeSql<OrchestraActivityLogEntry[]>(
    { projectRef, sql, queryKey: orchestraKeys.activityLog(projectRef) },
    signal
  )

  return result ?? []
}

export type OrchestraActivityLogData = Awaited<ReturnType<typeof getOrchestraActivityLog>>
export type OrchestraActivityLogError = ResponseError

export const useOrchestraActivityLogQuery = <TData = OrchestraActivityLogData>(
  { projectRef }: { projectRef: string | undefined },
  options?: UseCustomQueryOptions<OrchestraActivityLogData, OrchestraActivityLogError, TData>
) => {
  return useQuery<OrchestraActivityLogData, OrchestraActivityLogError, TData>({
    queryKey: orchestraKeys.activityLog(projectRef),
    queryFn: ({ signal }) => getOrchestraActivityLog({ projectRef: projectRef! }, signal),
    enabled: !!projectRef,
    ...options,
  })
}
