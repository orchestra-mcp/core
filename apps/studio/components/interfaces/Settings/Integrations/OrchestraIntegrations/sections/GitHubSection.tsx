import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import * as z from 'zod'

import type { OrchestraIntegrationsSettings } from 'data/integrations/orchestra-integrations-query'
import { IntegrationSection } from '../IntegrationSection'

const GitHubIcon = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
  </svg>
)

const schema = z.object({
  enabled: z.boolean(),
  app_id: z.string().default(''),
  app_private_key: z.string().default(''),
  oauth_client_id: z.string().default(''),
  oauth_client_secret: z.string().default(''),
  callback_url: z.string().default(''),
})

type GitHubFormValues = z.infer<typeof schema>

interface GitHubIntegrationSectionProps {
  settings: OrchestraIntegrationsSettings['github'] | undefined
  isLoading: boolean
  isSaving: boolean
  projectRef: string | undefined
  onSave: (values: GitHubFormValues) => void
}

export const GitHubIntegrationSection = ({
  settings,
  isLoading,
  isSaving,
  projectRef,
  onSave,
}: GitHubIntegrationSectionProps) => {
  const callbackUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/api/auth/callback/github`
      : ''

  const defaultValues: GitHubFormValues = {
    enabled: settings?.enabled ?? false,
    app_id: settings?.app_id ?? '',
    app_private_key: settings?.app_private_key ?? '',
    oauth_client_id: settings?.oauth_client_id ?? '',
    oauth_client_secret: settings?.oauth_client_secret ?? '',
    callback_url: settings?.callback_url ?? callbackUrl,
  }

  const form = useForm<GitHubFormValues>({
    resolver: zodResolver(schema),
    defaultValues,
    values: defaultValues,
  })

  return (
    <IntegrationSection
      title="GitHub"
      description="Connect GitHub for source control and CI/CD"
      icon={<GitHubIcon />}
      form={form}
      enabledFieldName="enabled"
      isLoading={isLoading}
      isSaving={isSaving}
      onSubmit={onSave}
      fields={[
        {
          name: 'app_id',
          label: 'GitHub App ID',
          type: 'text',
          placeholder: '123456',
        },
        {
          name: 'app_private_key',
          label: 'GitHub App Private Key',
          type: 'textarea',
          placeholder: '-----BEGIN RSA PRIVATE KEY-----',
          description: 'The PEM-encoded private key for the GitHub App.',
        },
        {
          name: 'oauth_client_id',
          label: 'OAuth Client ID',
          type: 'text',
          placeholder: 'Iv1.abc123...',
        },
        {
          name: 'oauth_client_secret',
          label: 'OAuth Client Secret',
          type: 'password',
          placeholder: 'Enter client secret',
        },
        {
          name: 'callback_url',
          label: 'Callback URL',
          type: 'readonly',
          description: 'Use this URL when configuring your GitHub App.',
        },
      ]}
    />
  )
}
