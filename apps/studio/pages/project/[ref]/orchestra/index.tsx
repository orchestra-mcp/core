import { OrchestraDashboard } from 'components/interfaces/Orchestra/OrchestraDashboard'
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

const OrchestraDashboardPage: NextPageWithLayout = () => {
  return (
    <>
      <PageHeader size="large">
        <PageHeaderMeta>
          <PageHeaderSummary>
            <PageHeaderTitle>Dashboard</PageHeaderTitle>
            <PageHeaderDescription>
              Orchestra MCP platform overview and real-time metrics
            </PageHeaderDescription>
          </PageHeaderSummary>
        </PageHeaderMeta>
      </PageHeader>
      <PageContainer size="large">
        <PageSection>
          <PageSectionContent className="gap-y-6">
            <OrchestraDashboard />
          </PageSectionContent>
        </PageSection>
      </PageContainer>
    </>
  )
}

OrchestraDashboardPage.getLayout = (page) => (
  <DefaultLayout>
    <OrchestraLayout title="Dashboard">{page}</OrchestraLayout>
  </DefaultLayout>
)

export default OrchestraDashboardPage
