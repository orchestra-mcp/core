import { OrchestraLogs } from 'components/interfaces/Orchestra/OrchestraLogs'
import DefaultLayout from 'components/layouts/DefaultLayout'
import LogsLayout from 'components/layouts/LogsLayout/LogsLayout'
import type { NextPageWithLayout } from 'types'

const OrchestraLogsPage: NextPageWithLayout = () => {
  return (
    <div className="flex flex-col flex-1 h-full px-5 py-6">
      <OrchestraLogs />
    </div>
  )
}

OrchestraLogsPage.getLayout = (page) => (
  <DefaultLayout>
    <LogsLayout title="Orchestra Logs">{page}</LogsLayout>
  </DefaultLayout>
)

export default OrchestraLogsPage
