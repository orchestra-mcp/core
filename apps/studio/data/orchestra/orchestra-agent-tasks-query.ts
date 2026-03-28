import { useQuery } from '@tanstack/react-query'
import { executeSql } from 'data/sql/execute-sql-query'
import type { ResponseError, UseCustomQueryOptions } from 'types'

import { orchestraKeys } from './keys'

export interface OrchestraAgentTask {
  id: string
  title: string
  status: string
  priority: string | null
  project_id: string | null
  project_name: string | null
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
      COALESCE(t.status::text, 'backlog') AS status,
      t.priority::text,
      t.project_id,
      p.name AS project_name,
      t.created_at,
      t.completed_at
    FROM tasks t
    LEFT JOIN projects p ON p.id = t.project_id
    WHERE t.assigned_agent_id = '${agentId}'
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
