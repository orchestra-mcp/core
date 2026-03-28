import { OrchestraTokens } from 'components/interfaces/Orchestra/OrchestraTokens'
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

const OrchestraTokensPage: NextPageWithLayout = () => {
  return (
    <>
      <PageHeader size="large">
        <PageHeaderMeta>
          <PageHeaderSummary>
            <PageHeaderTitle>MCP Tokens</PageHeaderTitle>
            <PageHeaderDescription>
              Manage MCP authentication tokens across your organization
            </PageHeaderDescription>
          </PageHeaderSummary>
        </PageHeaderMeta>
      </PageHeader>
      <PageContainer size="large">
        <OrchestraTokens />
      </PageContainer>
    </>
  )
}

OrchestraTokensPage.getLayout = (page) => (
  <DefaultLayout>
    <OrchestraLayout title="Tokens">{page}</OrchestraLayout>
  </DefaultLayout>
)

export default OrchestraTokensPage
