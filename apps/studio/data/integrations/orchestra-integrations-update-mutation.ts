import { useMutation, useQueryClient } from '@tanstack/react-query'
import { constructHeaders, fetchHandler } from 'data/fetchers'
import { BASE_PATH } from 'lib/constants'
import type { ResponseError } from 'types'

import {
  orchestraIntegrationKeys,
  OrchestraIntegrationsSettings,
} from './orchestra-integrations-query'

type UpdateOrchestraIntegrationsVariables = {
  ref: string
  integrations: OrchestraIntegrationsSettings
}

export async function updateOrchestraIntegrations({
  ref,
  integrations,
}: UpdateOrchestraIntegrationsVariables): Promise<OrchestraIntegrationsSettings> {
  const headers = await constructHeaders()
  headers.set('Content-Type', 'application/json')
  const response = await fetchHandler(
    `${BASE_PATH}/api/platform/projects/${ref}/settings/integrations`,
    {
      method: 'PATCH',
      headers,
      credentials: 'include',
      body: JSON.stringify(integrations),
    }
  )

  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(body.message ?? 'Failed to update integration settings')
  }

  return response.json()
}

type UseUpdateOrchestraIntegrationsMutationOptions = {
  onSuccess?: (data: OrchestraIntegrationsSettings) => void
  onError?: (error: ResponseError) => void
}

export const useUpdateOrchestraIntegrationsMutation = ({
  onSuccess,
  onError,
}: UseUpdateOrchestraIntegrationsMutationOptions = {}) => {
  const queryClient = useQueryClient()

  return useMutation<
    OrchestraIntegrationsSettings,
    ResponseError,
    UpdateOrchestraIntegrationsVariables
  >({
    mutationFn: updateOrchestraIntegrations,
    onSuccess: (data, variables) => {
      queryClient.setQueryData(orchestraIntegrationKeys.settings(variables.ref), data)
      onSuccess?.(data)
    },
    onError,
  })
}
