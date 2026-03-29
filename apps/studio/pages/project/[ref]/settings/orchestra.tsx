import DefaultLayout from 'components/layouts/DefaultLayout'
import SettingsLayout from 'components/layouts/ProjectSettingsLayout/SettingsLayout'
import { OrchestraSettings } from 'components/interfaces/Settings/Orchestra/OrchestraSettings'
import type { NextPageWithLayout } from 'types'
import { PageContainer } from 'ui-patterns/PageContainer'
import {
  PageHeader,
  PageHeaderDescription,
  PageHeaderMeta,
  PageHeaderSummary,
  PageHeaderTitle,
} from 'ui-patterns/PageHeader'

const OrchestraSettingsPage: NextPageWithLayout = () => {
  return (
    <>
      <PageHeader size="small">
        <PageHeaderMeta>
          <PageHeaderSummary>
            <PageHeaderTitle>Orchestra Settings</PageHeaderTitle>
            <PageHeaderDescription>
              Configure MCP server, authentication, OAuth providers, email, storage, and infrastructure
            </PageHeaderDescription>
          </PageHeaderSummary>
        </PageHeaderMeta>
      </PageHeader>
      <PageContainer size="small">
        <OrchestraSettings />
      </PageContainer>
    </>
  )
}

OrchestraSettingsPage.getLayout = (page) => (
  <DefaultLayout>
    <SettingsLayout title="Orchestra">{page}</SettingsLayout>
  </DefaultLayout>
)

export default OrchestraSettingsPage
