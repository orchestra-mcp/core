import { useQuery } from '@tanstack/react-query'
import { executeSql } from 'data/sql/execute-sql-query'
import type { ResponseError, UseCustomQueryOptions } from 'types'

import { orchestraKeys } from './keys'

export interface OrchestraDashboardMetrics {
  active_connections: number
  tasks_today: number
  total_agents: number
  total_memories: number
}

export async function getOrchestraDashboardMetrics(
  { projectRef }: { projectRef: string },
  signal?: AbortSignal
) {
  const sql = `
    SELECT
      (SELECT count(*)::int FROM agent_sessions WHERE status = 'active') AS active_connections,
      (SELECT count(*)::int FROM tasks WHERE created_at >= CURRENT_DATE) AS tasks_today,
      (SELECT count(*)::int FROM agents) AS total_agents,
      (SELECT count(*)::int FROM memories) AS total_memories
  `

  const { result } = await executeSql<OrchestraDashboardMetrics[]>(
    { projectRef, sql, queryKey: orchestraKeys.dashboard(projectRef) },
    signal
  )

  return (
    result?.[0] ?? { active_connections: 0, tasks_today: 0, total_agents: 0, total_memories: 0 }
  )
}

export type OrchestraDashboardData = Awaited<ReturnType<typeof getOrchestraDashboardMetrics>>
export type OrchestraDashboardError = ResponseError

export const useOrchestraDashboardQuery = <TData = OrchestraDashboardData>(
  { projectRef }: { projectRef: string | undefined },
  options?: UseCustomQueryOptions<OrchestraDashboardData, OrchestraDashboardError, TData>
) => {
  return useQuery<OrchestraDashboardData, OrchestraDashboardError, TData>({
    queryKey: orchestraKeys.dashboard(projectRef),
    queryFn: ({ signal }) => getOrchestraDashboardMetrics({ projectRef: projectRef! }, signal),
    enabled: !!projectRef,
    ...options,
  })
}
