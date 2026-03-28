import { useMutation, useQueryClient } from '@tanstack/react-query'
import { executeSql } from 'data/sql/execute-sql-query'
import { toast } from 'sonner'
import type { ResponseError } from 'types'

import { orchestraKeys } from './keys'

export interface CreateOrchestraAgentVariables {
  projectRef: string
  name: string
  slug: string
  role: string
  type: 'ai' | 'person'
  persona?: string
  system_prompt?: string
  avatar_url?: string
  team_id?: string
}

export async function createOrchestraAgent({
  projectRef,
  name,
  slug,
  role,
  type,
  persona,
  system_prompt,
  avatar_url,
  team_id,
}: CreateOrchestraAgentVariables) {
  const escapeSql = (val: string) => val.replace(/'/g, "''")

  const columns = ['name', 'slug', 'role', 'type']
  const values = [
    `'${escapeSql(name)}'`,
    `'${escapeSql(slug)}'`,
    `'${escapeSql(role)}'`,
    `'${escapeSql(type)}'`,
  ]

  if (persona) {
    columns.push('persona')
    values.push(`'${escapeSql(persona)}'`)
  }
  if (system_prompt) {
    columns.push('system_prompt')
    values.push(`'${escapeSql(system_prompt)}'`)
  }
  if (avatar_url) {
    columns.push('avatar_url')
    values.push(`'${escapeSql(avatar_url)}'`)
  }
  if (team_id) {
    columns.push('team_id')
    values.push(`'${escapeSql(team_id)}'`)
  }

  const sql = `
    INSERT INTO public.agents (${columns.join(', ')})
    VALUES (${values.join(', ')})
    RETURNING id, name, slug, role, type, status, created_at
  `

  const { result } = await executeSql<{ id: string; name: string }[]>({
    projectRef,
    sql,
    queryKey: ['orchestra', 'create-agent'],
  })

  return result
}

export type CreateOrchestraAgentData = Awaited<ReturnType<typeof createOrchestraAgent>>
export type CreateOrchestraAgentError = ResponseError

export const useCreateOrchestraAgentMutation = () => {
  const queryClient = useQueryClient()

  return useMutation<
    CreateOrchestraAgentData,
    CreateOrchestraAgentError,
    CreateOrchestraAgentVariables
  >({
    mutationFn: createOrchestraAgent,
    onSuccess: (_data, variables) => {
      toast.success(`Agent "${variables.name}" created successfully`)
      queryClient.invalidateQueries({ queryKey: orchestraKeys.agents(variables.projectRef) })
    },
    onError: (error) => {
      toast.error(`Failed to create agent: ${error.message}`)
    },
  })
}
