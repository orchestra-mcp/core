import { zodResolver } from '@hookform/resolvers/zod'
import type { OrchestraIntegrationsSettings } from 'data/integrations/orchestra-integrations-query'
import { useForm } from 'react-hook-form'
import * as z from 'zod'

import { IntegrationSection } from '../IntegrationSection'

const SlackIcon = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
    <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zm1.271 0a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zm0 1.271a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zm10.122 2.521a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zm-1.268 0a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zm-2.523 10.122a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zm0-1.268a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z" />
  </svg>
)

const schema = z.object({
  enabled: z.boolean(),
  bot_token: z.string().default(''),
  default_channel: z.string().default(''),
})

type SlackFormValues = z.infer<typeof schema>

interface SlackIntegrationSectionProps {
  settings: OrchestraIntegrationsSettings['slack'] | undefined
  isLoading: boolean
  isSaving: boolean
  onSave: (values: SlackFormValues) => void
}

export const SlackIntegrationSection = ({
  settings,
  isLoading,
  isSaving,
  onSave,
}: SlackIntegrationSectionProps) => {
  const defaultValues: SlackFormValues = {
    enabled: settings?.enabled ?? false,
    bot_token: settings?.bot_token ?? '',
    default_channel: settings?.default_channel ?? '',
  }

  const form = useForm<SlackFormValues>({
    resolver: zodResolver(schema),
    defaultValues,
    values: defaultValues,
  })

  return (
    <IntegrationSection
      title="Slack"
      description="Send notifications and alerts to Slack channels"
      icon={<SlackIcon />}
      form={form}
      enabledFieldName="enabled"
      isLoading={isLoading}
      isSaving={isSaving}
      onSubmit={onSave}
      onTest={() => {
        // Test functionality can be wired to an API endpoint later
      }}
      fields={[
        {
          name: 'bot_token',
          label: 'Bot Token',
          type: 'password',
          placeholder: 'xoxb-...',
          description: 'Slack Bot User OAuth Token from your app settings.',
        },
        {
          name: 'default_channel',
          label: 'Default Channel',
          type: 'text',
          placeholder: '#general',
          description: 'The default channel for notifications.',
        },
      ]}
    />
  )
}
