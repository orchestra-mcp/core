import { useQuery } from '@tanstack/react-query'
import { executeSql } from 'data/sql/execute-sql-query'
import type { ResponseError, UseCustomQueryOptions } from 'types'

import { orchestraKeys } from './keys'

export interface OrchestraAgentDetail {
  id: string
  name: string
  slug: string
  role: string
  type: string
  status: string
  persona: string | null
  system_prompt: string | null
  avatar_url: string | null
  team_id: string | null
  team_name: string | null
  created_at: string
  updated_at: string | null
  tasks_completed: number
  active_sessions: number
  memories_stored: number
  decisions_made: number
  skills: string[]
}

export async function getOrchestraAgentDetail(
  { projectRef, agentId }: { projectRef: string; agentId: string },
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
      a.persona,
      a.system_prompt,
      a.avatar_url,
      a.team_id,
      t.name AS team_name,
      a.created_at,
      a.updated_at,
      COALESCE((SELECT count(*)::int FROM tasks WHERE assignee_id = a.id AND status = 'completed'), 0) AS tasks_completed,
      COALESCE((SELECT count(*)::int FROM agent_sessions WHERE agent_id = a.id AND ended_at IS NULL), 0) AS active_sessions,
      COALESCE((SELECT count(*)::int FROM memories WHERE agent_id = a.id), 0) AS memories_stored,
      COALESCE((SELECT count(*)::int FROM activity_log WHERE entity_type = 'agent' AND entity_id = a.id::text AND action = 'decision_made'), 0) AS decisions_made,
      COALESCE(
        (SELECT array_agg(s.name) FROM agent_skills ags JOIN skills s ON s.id = ags.skill_id WHERE ags.agent_id = a.id),
        ARRAY[]::text[]
      ) AS skills
    FROM public.agents a
    LEFT JOIN public.teams t ON t.id = a.team_id
    WHERE a.id = '${agentId}'
    LIMIT 1
  `

  const { result } = await executeSql<OrchestraAgentDetail[]>(
    { projectRef, sql, queryKey: orchestraKeys.agentDetail(projectRef, agentId) },
    signal
  )

  return result?.[0] ?? null
}

export type OrchestraAgentDetailData = Awaited<ReturnType<typeof getOrchestraAgentDetail>>
export type OrchestraAgentDetailError = ResponseError

export const useOrchestraAgentDetailQuery = <TData = OrchestraAgentDetailData>(
  { projectRef, agentId }: { projectRef: string | undefined; agentId: string | undefined },
  options?: UseCustomQueryOptions<OrchestraAgentDetailData, OrchestraAgentDetailError, TData>
) => {
  return useQuery<OrchestraAgentDetailData, OrchestraAgentDetailError, TData>({
    queryKey: orchestraKeys.agentDetail(projectRef, agentId),
    queryFn: ({ signal }) =>
      getOrchestraAgentDetail({ projectRef: projectRef!, agentId: agentId! }, signal),
    enabled: !!projectRef && !!agentId,
    ...options,
  })
}
