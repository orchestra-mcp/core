import { useQuery } from '@tanstack/react-query'
import { executeSql } from 'data/sql/execute-sql-query'
import type { ResponseError, UseCustomQueryOptions } from 'types'

import { orchestraKeys } from './keys'

export interface OrchestraTaskDistribution {
  status: string
  count: number
}

export async function getOrchestraTaskDistribution(
  { projectRef }: { projectRef: string },
  signal?: AbortSignal
) {
  const sql = `
    SELECT status, count(*)::int AS count
    FROM tasks
    GROUP BY status
    ORDER BY
      CASE status
        WHEN 'blocked' THEN 1
        WHEN 'todo' THEN 2
        WHEN 'in_progress' THEN 3
        WHEN 'done' THEN 4
        ELSE 5
      END
  `

  const { result } = await executeSql<OrchestraTaskDistribution[]>(
    { projectRef, sql, queryKey: orchestraKeys.taskDistribution(projectRef) },
    signal
  )

  return result ?? []
}

export type OrchestraTaskDistributionData = Awaited<
  ReturnType<typeof getOrchestraTaskDistribution>
>
export type OrchestraTaskDistributionError = ResponseError

export const useOrchestraTaskDistributionQuery = <TData = OrchestraTaskDistributionData>(
  { projectRef }: { projectRef: string | undefined },
  options?: UseCustomQueryOptions<
    OrchestraTaskDistributionData,
    OrchestraTaskDistributionError,
    TData
  >
) => {
  return useQuery<OrchestraTaskDistributionData, OrchestraTaskDistributionError, TData>({
    queryKey: orchestraKeys.taskDistribution(projectRef),
    queryFn: ({ signal }) => getOrchestraTaskDistribution({ projectRef: projectRef! }, signal),
    enabled: !!projectRef,
    ...options,
  })
}
