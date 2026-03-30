import { useParams } from 'common'
import {
  OrchestraIntegrationsSettings as IntegrationsSettings,
  useOrchestraIntegrationsQuery,
} from 'data/integrations/orchestra-integrations-query'
import { useUpdateOrchestraIntegrationsMutation } from 'data/integrations/orchestra-integrations-update-mutation'
import { toast } from 'sonner'
import { Card, CardContent } from 'ui'
import {
  PageSection,
  PageSectionContent,
  PageSectionDescription,
  PageSectionMeta,
  PageSectionSummary,
  PageSectionTitle,
} from 'ui-patterns/PageSection'
import { GenericSkeletonLoader } from 'ui-patterns/ShimmeringLoader'

import { DiscordIntegrationSection } from './sections/DiscordSection'
import { GitHubIntegrationSection } from './sections/GitHubSection'
import { SlackIntegrationSection } from './sections/SlackSection'
import { TelegramIntegrationSection } from './sections/TelegramSection'
import { WhatsAppIntegrationSection } from './sections/WhatsAppSection'

export const OrchestraIntegrationsSettings = () => {
  const { ref } = useParams()

  const { data: settings, isPending: isLoading } = useOrchestraIntegrationsQuery({ ref })

  const { mutate: updateSettings, isPending: isSaving } = useUpdateOrchestraIntegrationsMutation({
    onSuccess: () => {
      toast.success('Integration settings saved successfully')
    },
    onError: (error) => {
      toast.error(`Failed to save integration settings: ${error.message}`)
    },
  })

  const handleSave = (section: keyof IntegrationsSettings, values: any) => {
    if (!ref) return
    updateSettings({
      ref,
      integrations: {
        ...settings,
        [section]: values,
      },
    })
  }

  return (
    <PageSection id="orchestra-integrations">
      <PageSectionMeta>
        <PageSectionSummary>
          <PageSectionTitle>Service Integrations</PageSectionTitle>
          <PageSectionDescription>
            Configure external service connections for notifications, source control, and messaging.
          </PageSectionDescription>
        </PageSectionSummary>
      </PageSectionMeta>
      <PageSectionContent>
        {isLoading ? (
          <Card>
            <CardContent>
              <GenericSkeletonLoader />
            </CardContent>
          </Card>
        ) : (
          <div className="flex flex-col gap-6">
            <GitHubIntegrationSection
              settings={settings?.github}
              isLoading={isLoading}
              isSaving={isSaving}
              projectRef={ref}
              onSave={(values) => handleSave('github', values)}
            />
            <SlackIntegrationSection
              settings={settings?.slack}
              isLoading={isLoading}
              isSaving={isSaving}
              onSave={(values) => handleSave('slack', values)}
            />
            <DiscordIntegrationSection
              settings={settings?.discord}
              isLoading={isLoading}
              isSaving={isSaving}
              onSave={(values) => handleSave('discord', values)}
            />
            <TelegramIntegrationSection
              settings={settings?.telegram}
              isLoading={isLoading}
              isSaving={isSaving}
              onSave={(values) => handleSave('telegram', values)}
            />
            <WhatsAppIntegrationSection
              settings={settings?.whatsapp}
              isLoading={isLoading}
              isSaving={isSaving}
              onSave={(values) => handleSave('whatsapp', values)}
            />
          </div>
        )}
      </PageSectionContent>
    </PageSection>
  )
}
