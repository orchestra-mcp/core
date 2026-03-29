import { useQuery } from '@tanstack/react-query'
import { executeSql } from 'data/sql/execute-sql-query'
import type { ResponseError, UseCustomQueryOptions } from 'types'

import { orchestraKeys } from './keys'

export interface OrchestraAgent {
  id: string
  name: string
  slug: string
  role: string
  type: string
  status: string
  avatar_url: string | null
  team: string | null
  team_name: string | null
  tasks_completed: number
  memories_stored: number
  skills: string[]
  created_by: string | null
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
      COALESCE(a.slug, '') AS slug,
      COALESCE(a.role, 'agent') AS role,
      COALESCE(a.type, 'ai') AS type,
      COALESCE(a.status, 'active') AS status,
      a.avatar_url,
      a.team_id AS team,
      t.name AS team_name,
      COALESCE((SELECT count(*)::int FROM tasks WHERE assigned_agent_id = a.id AND status = 'done'), 0) AS tasks_completed,
      COALESCE((SELECT count(*)::int FROM memories WHERE agent_id = a.id), 0) AS memories_stored,
      COALESCE(
        (SELECT array_agg(s.name) FROM agent_skills ags JOIN skills s ON s.id = ags.skill_id WHERE ags.agent_id = a.id),
        ARRAY[]::text[]
      ) AS skills,
      a.created_by,
      a.updated_at AS last_active_at,
      a.created_at
    FROM public.agents a
    LEFT JOIN public.teams t ON t.id = a.team_id
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
