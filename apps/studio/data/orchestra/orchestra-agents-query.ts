import { useQuery } from '@tanstack/react-query'
import { executeSql } from 'data/sql/execute-sql-query'
import type { ResponseError, UseCustomQueryOptions } from 'types'

import { orchestraKeys } from './keys'

export interface OrchestraAgent {
  id: string
  name: string
  role: string
  status: string
  team: string | null
  last_active_at: string | null
  created_at: string
}

export async function getOrchestraAgents(
  { projectRef }: { projectRef: string },
  signal?: AbortSignal
) {
  const sql = `
    SELECT
      a.id,
      a.name,
      COALESCE(a.role, 'agent') AS role,
      COALESCE(a.status, 'active') AS status,
      a.team_id AS team,
      a.updated_at AS last_active_at,
      a.created_at
    FROM public.agents a
    ORDER BY a.name ASC
  `

  const { result } = await executeSql<OrchestraAgent[]>(
    { projectRef, sql, queryKey: orchestraKeys.agents(projectRef) },
    signal
  )

  return result ?? []
}

export type OrchestraAgentsData = Awaited<ReturnType<typeof getOrchestraAgents>>
export type OrchestraAgentsError = ResponseError

export const useOrchestraAgentsQuery = <TData = OrchestraAgentsData>(
  { projectRef }: { projectRef: string | undefined },
  options?: UseCustomQueryOptions<OrchestraAgentsData, OrchestraAgentsError, TData>
) => {
  return useQuery<OrchestraAgentsData, OrchestraAgentsError, TData>({
    queryKey: orchestraKeys.agents(projectRef),
    queryFn: ({ signal }) => getOrchestraAgents({ projectRef: projectRef! }, signal),
    enabled: !!projectRef,
    ...options,
  })
}
