import { useMutation, useQueryClient } from '@tanstack/react-query'
import { executeSql } from 'data/sql/execute-sql-query'
import { toast } from 'sonner'
import type { ResponseError } from 'types'

import { orchestraKeys } from './keys'

export interface RevokeOrchestraTokenVariables {
  projectRef: string
  tokenId: string
}

export async function revokeOrchestraToken({ projectRef, tokenId }: RevokeOrchestraTokenVariables) {
  const sql = `
    UPDATE mcp_tokens
    SET revoked_at = NOW()
    WHERE id = '${tokenId}' AND revoked_at IS NULL
    RETURNING id
  `

  const { result } = await executeSql<{ id: string }[]>({
    projectRef,
    sql,
    queryKey: ['orchestra', 'revoke-token', tokenId],
  })

  return result
}

export type RevokeOrchestraTokenData = Awaited<ReturnType<typeof revokeOrchestraToken>>
export type RevokeOrchestraTokenError = ResponseError

export const useRevokeOrchestraTokenMutation = () => {
  const queryClient = useQueryClient()

  return useMutation<RevokeOrchestraTokenData, RevokeOrchestraTokenError, RevokeOrchestraTokenVariables>({
    mutationFn: revokeOrchestraToken,
    onSuccess: (_data, variables) => {
      toast.success('Token revoked successfully')
      queryClient.invalidateQueries({ queryKey: orchestraKeys.tokens(variables.projectRef) })
    },
    onError: (error) => {
      toast.error(`Failed to revoke token: ${error.message}`)
    },
  })
}
