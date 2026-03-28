import { OrchestraAgentDetail } from 'components/interfaces/Orchestra/OrchestraAgentDetail'
import DefaultLayout from 'components/layouts/DefaultLayout'
import OrchestraLayout from 'components/layouts/OrchestraLayout/OrchestraLayout'
import type { NextPageWithLayout } from 'types'
import { PageContainer } from 'ui-patterns/PageContainer'

const OrchestraAgentDetailPage: NextPageWithLayout = () => {
  return (
    <PageContainer size="large">
      <OrchestraAgentDetail />
    </PageContainer>
  )
}

OrchestraAgentDetailPage.getLayout = (page) => (
  <DefaultLayout>
    <OrchestraLayout title="Agent">{page}</OrchestraLayout>
  </DefaultLayout>
)

export default OrchestraAgentDetailPage
