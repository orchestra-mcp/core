import { OrchestraLogs } from 'components/interfaces/Orchestra/OrchestraLogs'
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

const OrchestraLogsPage: NextPageWithLayout = () => {
  return (
    <>
      <PageHeader size="large">
        <PageHeaderMeta>
          <PageHeaderSummary>
            <PageHeaderTitle>Service Logs</PageHeaderTitle>
            <PageHeaderDescription>
              View logs from Go MCP server, Laravel, and Orchestra activity
            </PageHeaderDescription>
          </PageHeaderSummary>
        </PageHeaderMeta>
      </PageHeader>
      <PageContainer size="large">
        <OrchestraLogs />
      </PageContainer>
    </>
  )
}

OrchestraLogsPage.getLayout = (page) => (
  <DefaultLayout>
    <OrchestraLayout title="Logs">{page}</OrchestraLayout>
  </DefaultLayout>
)

export default OrchestraLogsPage
