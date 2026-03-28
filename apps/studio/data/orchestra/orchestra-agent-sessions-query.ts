import { useQuery } from '@tanstack/react-query'
import { executeSql } from 'data/sql/execute-sql-query'
import type { ResponseError, UseCustomQueryOptions } from 'types'

import { orchestraKeys } from './keys'

export interface OrchestraAgentSession {
  id: string
  started_at: string
  ended_at: string | null
  last_heartbeat: string | null
  metadata: Record<string, unknown> | null
}

export async function getOrchestraAgentSessions(
  { projectRef, agentId }: { projectRef: string; agentId: string },
  signal?: AbortSignal
) {
  const sql = `
    SELECT
      s.id,
      s.started_at,
      s.ended_at,
      s.last_heartbeat,
      s.metadata
    FROM agent_sessions s
    WHERE s.agent_id = '${agentId}'
    ORDER BY s.started_at DESC
    LIMIT 50
  `

  const { result } = await executeSql<OrchestraAgentSession[]>(
    { projectRef, sql, queryKey: orchestraKeys.agentSessions(projectRef, agentId) },
    signal
  )

  return result ?? []
}

export type OrchestraAgentSessionsData = Awaited<ReturnType<typeof getOrchestraAgentSessions>>
export type OrchestraAgentSessionsError = ResponseError

export const useOrchestraAgentSessionsQuery = <TData = OrchestraAgentSessionsData>(
  { projectRef, agentId }: { projectRef: string | undefined; agentId: string | undefined },
  options?: UseCustomQueryOptions<OrchestraAgentSessionsData, OrchestraAgentSessionsError, TData>
) => {
  return useQuery<OrchestraAgentSessionsData, OrchestraAgentSessionsError, TData>({
    queryKey: orchestraKeys.agentSessions(projectRef, agentId),
    queryFn: ({ signal }) =>
      getOrchestraAgentSessions({ projectRef: projectRef!, agentId: agentId! }, signal),
    enabled: !!projectRef && !!agentId,
    ...options,
  })
}
