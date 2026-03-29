import { OrchestraAgents } from 'components/interfaces/Orchestra/OrchestraAgents'
import DefaultLayout from 'components/layouts/DefaultLayout'
import OrchestraLayout from 'components/layouts/OrchestraLayout/OrchestraLayout'
import type { NextPageWithLayout } from 'types'
import { PageContainer } from 'ui-patterns/PageContainer'
import {
  PageHeader,
  PageHeaderDescription,
  PageHeaderMeta,
  PageHeaderSummary,
  PageHeaderTitle,
} from 'ui-patterns/PageHeader'
import { PageSection, PageSectionContent } from 'ui-patterns/PageSection'

const OrchestraAgentsPage: NextPageWithLayout = () => {
  return (
    <>
      <PageHeader size="large">
        <PageHeaderMeta>
          <PageHeaderSummary>
            <PageHeaderTitle>Agents</PageHeaderTitle>
            <PageHeaderDescription>
              Monitor and manage all Orchestra agents across your project
            </PageHeaderDescription>
          </PageHeaderSummary>
        </PageHeaderMeta>
      </PageHeader>
      <PageContainer size="large">
        <PageSection>
          <PageSectionContent className="gap-y-4">
            <OrchestraAgents />
          </PageSectionContent>
        </PageSection>
      </PageContainer>
    </>
  )
}

OrchestraAgentsPage.getLayout = (page) => (
  <DefaultLayout>
    <OrchestraLayout title="Agents">{page}</OrchestraLayout>
  </DefaultLayout>
)

export default OrchestraAgentsPage
