import { useQuery } from '@tanstack/react-query'
import { executeSql } from 'data/sql/execute-sql-query'
import type { ResponseError, UseCustomQueryOptions } from 'types'

import { orchestraKeys } from './keys'

export interface OrchestraProjectProgress {
  project_id: string
  project_name: string
  total_tasks: number
  completed_tasks: number
}

export async function getOrchestraProjectProgress(
  { projectRef }: { projectRef: string },
  signal?: AbortSignal
) {
  const sql = `
    SELECT
      p.id AS project_id,
      p.name AS project_name,
      count(t.id)::int AS total_tasks,
      count(t.id) FILTER (WHERE t.status = 'done')::int AS completed_tasks
    FROM projects p
    LEFT JOIN tasks t ON t.project_id = p.id
    GROUP BY p.id, p.name
    HAVING count(t.id) > 0
    ORDER BY p.name
    LIMIT 10
  `

  const { result } = await executeSql<OrchestraProjectProgress[]>(
    { projectRef, sql, queryKey: orchestraKeys.projectProgress(projectRef) },
    signal
  )

  return result ?? []
}

export type OrchestraProjectProgressData = Awaited<
  ReturnType<typeof getOrchestraProjectProgress>
>
export type OrchestraProjectProgressError = ResponseError

export const useOrchestraProjectProgressQuery = <TData = OrchestraProjectProgressData>(
  { projectRef }: { projectRef: string | undefined },
  options?: UseCustomQueryOptions<
    OrchestraProjectProgressData,
    OrchestraProjectProgressError,
    TData
  >
) => {
  return useQuery<OrchestraProjectProgressData, OrchestraProjectProgressError, TData>({
    queryKey: orchestraKeys.projectProgress(projectRef),
    queryFn: ({ signal }) => getOrchestraProjectProgress({ projectRef: projectRef! }, signal),
    enabled: !!projectRef,
    ...options,
  })
}
