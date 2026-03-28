import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import * as z from 'zod'

import type { OrchestraIntegrationsSettings } from 'data/integrations/orchestra-integrations-query'
import { IntegrationSection } from '../IntegrationSection'

const DiscordIcon = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
    <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189z" />
  </svg>
)

const schema = z.object({
  enabled: z.boolean(),
  bot_token: z.string().default(''),
  webhook_url: z.string().default(''),
  default_channel_id: z.string().default(''),
})

type DiscordFormValues = z.infer<typeof schema>

interface DiscordIntegrationSectionProps {
  settings: OrchestraIntegrationsSettings['discord'] | undefined
  isLoading: boolean
  isSaving: boolean
  onSave: (values: DiscordFormValues) => void
}

export const DiscordIntegrationSection = ({
  settings,
  isLoading,
  isSaving,
  onSave,
}: DiscordIntegrationSectionProps) => {
  const defaultValues: DiscordFormValues = {
    enabled: settings?.enabled ?? false,
    bot_token: settings?.bot_token ?? '',
    webhook_url: settings?.webhook_url ?? '',
    default_channel_id: settings?.default_channel_id ?? '',
  }

  const form = useForm<DiscordFormValues>({
    resolver: zodResolver(schema),
    defaultValues,
    values: defaultValues,
  })

  return (
    <IntegrationSection
      title="Discord"
      description="Send notifications to Discord channels via bot or webhook"
      icon={<DiscordIcon />}
      form={form}
      enabledFieldName="enabled"
      isLoading={isLoading}
      isSaving={isSaving}
      onSubmit={onSave}
      fields={[
        {
          name: 'bot_token',
          label: 'Bot Token',
          type: 'password',
          placeholder: 'Enter Discord bot token',
          description: 'Discord bot token from the Developer Portal.',
        },
        {
          name: 'webhook_url',
          label: 'Webhook URL',
          type: 'text',
          placeholder: 'https://discord.com/api/webhooks/...',
          description: 'Channel webhook URL for sending messages.',
        },
        {
          name: 'default_channel_id',
          label: 'Default Channel ID',
          type: 'text',
          placeholder: '123456789012345678',
          description: 'The default channel ID for bot messages.',
        },
      ]}
    />
  )
}
