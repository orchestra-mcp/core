import { OrchestraDocs } from 'components/interfaces/Orchestra/OrchestraDocs'
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

const OrchestraDocsPage: NextPageWithLayout = () => {
  return (
    <>
      <PageHeader size="large">
        <PageHeaderMeta>
          <PageHeaderSummary>
            <PageHeaderTitle>Documentation</PageHeaderTitle>
            <PageHeaderDescription>
              Platform docs, API reference, and developer guides
            </PageHeaderDescription>
          </PageHeaderSummary>
        </PageHeaderMeta>
      </PageHeader>
      <PageContainer size="large">
        <PageSection>
          <PageSectionContent className="gap-y-4">
            <OrchestraDocs />
          </PageSectionContent>
        </PageSection>
      </PageContainer>
    </>
  )
}

OrchestraDocsPage.getLayout = (page) => (
  <DefaultLayout>
    <OrchestraLayout title="Docs">{page}</OrchestraLayout>
  </DefaultLayout>
)

export default OrchestraDocsPage
