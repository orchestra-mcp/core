import { useQuery } from '@tanstack/react-query'
import { executeSql } from 'data/sql/execute-sql-query'
import type { ResponseError, UseCustomQueryOptions } from 'types'

import { orchestraKeys } from './keys'

export interface OrchestraToken {
  id: string
  name: string
  prefix: string
  user_id: string | null
  user_email: string | null
  last_used_at: string | null
  usage_count: number
  created_at: string
  revoked_at: string | null
}

export async function getOrchestraTokens(
  { projectRef }: { projectRef: string },
  signal?: AbortSignal
) {
  const sql = `
    SELECT
      t.id,
      t.name,
      t.prefix,
      t.user_id,
      t.user_email,
      t.last_used_at,
      COALESCE(t.usage_count, 0)::int AS usage_count,
      t.created_at,
      t.revoked_at
    FROM mcp_tokens t
    ORDER BY t.created_at DESC
  `

  const { result } = await executeSql<OrchestraToken[]>(
    { projectRef, sql, queryKey: orchestraKeys.tokens(projectRef) },
    signal
  )

  return result ?? []
}

export type OrchestraTokensData = Awaited<ReturnType<typeof getOrchestraTokens>>
export type OrchestraTokensError = ResponseError

export const useOrchestraTokensQuery = <TData = OrchestraTokensData>(
  { projectRef }: { projectRef: string | undefined },
  options?: UseCustomQueryOptions<OrchestraTokensData, OrchestraTokensError, TData>
) => {
  return useQuery<OrchestraTokensData, OrchestraTokensError, TData>({
    queryKey: orchestraKeys.tokens(projectRef),
    queryFn: ({ signal }) => getOrchestraTokens({ projectRef: projectRef! }, signal),
    enabled: !!projectRef,
    ...options,
  })
}
