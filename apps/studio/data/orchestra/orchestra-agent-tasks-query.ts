import { useQuery } from '@tanstack/react-query'
import { executeSql } from 'data/sql/execute-sql-query'
import type { ResponseError, UseCustomQueryOptions } from 'types'

import { orchestraKeys } from './keys'

export interface OrchestraAgentTask {
  id: string
  title: string
  status: string
  priority: string | null
  feature_id: string | null
  feature_name: string | null
  created_at: string
  completed_at: string | null
}

export async function getOrchestraAgentTasks(
  { projectRef, agentId }: { projectRef: string; agentId: string },
  signal?: AbortSignal
) {
  const sql = `
    SELECT
      t.id,
      t.title,
      COALESCE(t.status, 'pending') AS status,
      t.priority,
      t.feature_id,
      f.name AS feature_name,
      t.created_at,
      t.completed_at
    FROM tasks t
    LEFT JOIN features f ON f.id = t.feature_id
    WHERE t.assignee_id = '${agentId}'
    ORDER BY t.created_at DESC
    LIMIT 50
  `

  const { result } = await executeSql<OrchestraAgentTask[]>(
    { projectRef, sql, queryKey: orchestraKeys.agentTasks(projectRef, agentId) },
    signal
  )

  return result ?? []
}

export type OrchestraAgentTasksData = Awaited<ReturnType<typeof getOrchestraAgentTasks>>
export type OrchestraAgentTasksError = ResponseError

export const useOrchestraAgentTasksQuery = <TData = OrchestraAgentTasksData>(
  { projectRef, agentId }: { projectRef: string | undefined; agentId: string | undefined },
  options?: UseCustomQueryOptions<OrchestraAgentTasksData, OrchestraAgentTasksError, TData>
) => {
  return useQuery<OrchestraAgentTasksData, OrchestraAgentTasksError, TData>({
    queryKey: orchestraKeys.agentTasks(projectRef, agentId),
    queryFn: ({ signal }) =>
      getOrchestraAgentTasks({ projectRef: projectRef!, agentId: agentId! }, signal),
    enabled: !!projectRef && !!agentId,
    ...options,
  })
}
