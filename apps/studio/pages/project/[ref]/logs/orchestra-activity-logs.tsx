import { OrchestraLogs } from 'components/interfaces/Orchestra/OrchestraLogs'
import DefaultLayout from 'components/layouts/DefaultLayout'
import LogsLayout from 'components/layouts/LogsLayout/LogsLayout'
import type { NextPageWithLayout } from 'types'

const OrchestraActivityLogsPage: NextPageWithLayout = () => {
  return (
    <div className="flex flex-col flex-1 h-full px-5 py-6">
      <OrchestraLogs serviceFilter="activity_log" />
    </div>
  )
}

OrchestraActivityLogsPage.getLayout = (page) => (
  <DefaultLayout>
    <LogsLayout title="Orchestra Activity">{page}</LogsLayout>
  </DefaultLayout>
)

export default OrchestraActivityLogsPage
