import { useQuery } from '@tanstack/react-query'
import { constructHeaders, fetchHandler } from 'data/fetchers'
import { BASE_PATH } from 'lib/constants'
import type { ResponseError, UseCustomQueryOptions } from 'types'

export interface OrchestraIntegrationsSettings {
  github?: {
    enabled: boolean
    app_id: string
    app_private_key: string
    oauth_client_id: string
    oauth_client_secret: string
    callback_url: string
  }
  slack?: {
    enabled: boolean
    bot_token: string
    default_channel: string
  }
  discord?: {
    enabled: boolean
    bot_token: string
    webhook_url: string
    default_channel_id: string
  }
  telegram?: {
    enabled: boolean
    bot_token: string
    default_chat_id: string
  }
  whatsapp?: {
    enabled: boolean
    business_api_url: string
    api_token: string
    phone_number_id: string
  }
}

export const orchestraIntegrationKeys = {
  settings: (ref: string | undefined) => ['projects', ref, 'orchestra-integrations'] as const,
}

export async function getOrchestraIntegrations(
  ref: string,
  signal?: AbortSignal
): Promise<OrchestraIntegrationsSettings> {
  const headers = await constructHeaders()
  const response = await fetchHandler(
    `${BASE_PATH}/api/platform/projects/${ref}/settings/integrations`,
    {
      method: 'GET',
      headers,
      credentials: 'include',
      signal,
    }
  )

  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(body.message ?? 'Failed to fetch integration settings')
  }

  return response.json()
}

export type OrchestraIntegrationsData = OrchestraIntegrationsSettings
export type OrchestraIntegrationsError = ResponseError

export const useOrchestraIntegrationsQuery = <TData = OrchestraIntegrationsData>(
  { ref }: { ref: string | undefined },
  options?: UseCustomQueryOptions<OrchestraIntegrationsData, OrchestraIntegrationsError, TData>
) =>
  useQuery<OrchestraIntegrationsData, OrchestraIntegrationsError, TData>({
    queryKey: orchestraIntegrationKeys.settings(ref),
    queryFn: ({ signal }) => getOrchestraIntegrations(ref!, signal),
    enabled: !!ref,
    staleTime: 5 * 60 * 1000,
    ...options,
  })
