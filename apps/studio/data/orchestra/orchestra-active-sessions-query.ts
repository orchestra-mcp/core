import { useQuery } from '@tanstack/react-query'
import { executeSql } from 'data/sql/execute-sql-query'
import type { ResponseError, UseCustomQueryOptions } from 'types'

import { orchestraKeys } from './keys'

export interface OrchestraActiveSession {
  id: string
  agent_id: string
  agent_name: string
  started_at: string
  last_heartbeat: string | null
  metadata: Record<string, unknown> | null
}

export async function getOrchestraActiveSessions(
  { projectRef }: { projectRef: string },
  signal?: AbortSignal
) {
  const sql = `
    SELECT
      s.id,
      s.agent_id,
      COALESCE(a.name, 'Unknown Agent') AS agent_name,
      s.started_at,
      s.last_heartbeat,
      s.metadata
    FROM agent_sessions s
    LEFT JOIN agents a ON a.id = s.agent_id
    WHERE s.ended_at IS NULL
    ORDER BY s.started_at DESC
  `

  const { result } = await executeSql<OrchestraActiveSession[]>(
    { projectRef, sql, queryKey: orchestraKeys.activeSessions(projectRef) },
    signal
  )

  return result ?? []
}

export type OrchestraActiveSessionsData = Awaited<ReturnType<typeof getOrchestraActiveSessions>>
export type OrchestraActiveSessionsError = ResponseError

export const useOrchestraActiveSessionsQuery = <TData = OrchestraActiveSessionsData>(
  { projectRef }: { projectRef: string | undefined },
  options?: UseCustomQueryOptions<OrchestraActiveSessionsData, OrchestraActiveSessionsError, TData>
) => {
  return useQuery<OrchestraActiveSessionsData, OrchestraActiveSessionsError, TData>({
    queryKey: orchestraKeys.activeSessions(projectRef),
    queryFn: ({ signal }) => getOrchestraActiveSessions({ projectRef: projectRef! }, signal),
    enabled: !!projectRef,
    ...options,
  })
}
