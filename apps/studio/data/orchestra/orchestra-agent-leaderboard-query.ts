import { useQuery } from '@tanstack/react-query'
import { executeSql } from 'data/sql/execute-sql-query'
import type { ResponseError, UseCustomQueryOptions } from 'types'

import { orchestraKeys } from './keys'

export interface OrchestraAgentLeaderboardEntry {
  agent_id: string
  agent_name: string
  completed_tasks: number
}

export async function getOrchestraAgentLeaderboard(
  { projectRef }: { projectRef: string },
  signal?: AbortSignal
) {
  const sql = `
    SELECT
      a.id AS agent_id,
      a.name AS agent_name,
      count(t.id)::int AS completed_tasks
    FROM agents a
    LEFT JOIN tasks t ON t.assigned_to = a.id AND t.status = 'done'
    GROUP BY a.id, a.name
    ORDER BY completed_tasks DESC
    LIMIT 10
  `

  const { result } = await executeSql<OrchestraAgentLeaderboardEntry[]>(
    { projectRef, sql, queryKey: orchestraKeys.agentLeaderboard(projectRef) },
    signal
  )

  return result ?? []
}

export type OrchestraAgentLeaderboardData = Awaited<
  ReturnType<typeof getOrchestraAgentLeaderboard>
>
export type OrchestraAgentLeaderboardError = ResponseError

export const useOrchestraAgentLeaderboardQuery = <TData = OrchestraAgentLeaderboardData>(
  { projectRef }: { projectRef: string | undefined },
  options?: UseCustomQueryOptions<
    OrchestraAgentLeaderboardData,
    OrchestraAgentLeaderboardError,
    TData
  >
) => {
  return useQuery<OrchestraAgentLeaderboardData, OrchestraAgentLeaderboardError, TData>({
    queryKey: orchestraKeys.agentLeaderboard(projectRef),
    queryFn: ({ signal }) => getOrchestraAgentLeaderboard({ projectRef: projectRef! }, signal),
    enabled: !!projectRef,
    ...options,
  })
}
