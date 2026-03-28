import { useQuery } from '@tanstack/react-query'
import { executeSql } from 'data/sql/execute-sql-query'
import type { ResponseError, UseCustomQueryOptions } from 'types'

import { orchestraKeys } from './keys'

export interface OrchestraAgentActivityEntry {
  id: string
  action: string
  summary: string
  details: Record<string, unknown> | null
  created_at: string
}

export async function getOrchestraAgentActivity(
  { projectRef, agentId }: { projectRef: string; agentId: string },
  signal?: AbortSignal
) {
  const sql = `
    SELECT id, action, summary, details, created_at
    FROM activity_log
    WHERE agent_id = '${agentId}'
    ORDER BY created_at DESC
    LIMIT 50
  `

  const { result } = await executeSql<OrchestraAgentActivityEntry[]>(
    { projectRef, sql, queryKey: orchestraKeys.agentActivity(projectRef, agentId) },
    signal
  )

  return result ?? []
}

export type OrchestraAgentActivityData = Awaited<ReturnType<typeof getOrchestraAgentActivity>>
export type OrchestraAgentActivityError = ResponseError

export const useOrchestraAgentActivityQuery = <TData = OrchestraAgentActivityData>(
  { projectRef, agentId }: { projectRef: string | undefined; agentId: string | undefined },
  options?: UseCustomQueryOptions<OrchestraAgentActivityData, OrchestraAgentActivityError, TData>
) => {
  return useQuery<OrchestraAgentActivityData, OrchestraAgentActivityError, TData>({
    queryKey: orchestraKeys.agentActivity(projectRef, agentId),
    queryFn: ({ signal }) =>
      getOrchestraAgentActivity({ projectRef: projectRef!, agentId: agentId! }, signal),
    enabled: !!projectRef && !!agentId,
    ...options,
  })
}
