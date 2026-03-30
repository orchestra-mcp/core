import { OrchestraFeatureFlags } from 'components/interfaces/Orchestra/OrchestraFeatureFlags'
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

const OrchestraFeatureFlagsPage: NextPageWithLayout = () => {
  return (
    <>
      <PageHeader size="large">
        <PageHeaderMeta>
          <PageHeaderSummary>
            <PageHeaderTitle>Feature Flags</PageHeaderTitle>
            <PageHeaderDescription>
              Toggle platform features per client scope (global, desktop, studio, laravel)
            </PageHeaderDescription>
          </PageHeaderSummary>
        </PageHeaderMeta>
      </PageHeader>
      <PageContainer size="large">
        <PageSection>
          <PageSectionContent className="gap-y-4">
            <OrchestraFeatureFlags />
          </PageSectionContent>
        </PageSection>
      </PageContainer>
    </>
  )
}

OrchestraFeatureFlagsPage.getLayout = (page) => (
  <DefaultLayout>
    <OrchestraLayout title="Feature Flags">{page}</OrchestraLayout>
  </DefaultLayout>
)

export default OrchestraFeatureFlagsPage
