import { OrchestraLogs } from 'components/interfaces/Orchestra/OrchestraLogs'
import DefaultLayout from 'components/layouts/DefaultLayout'
import LogsLayout from 'components/layouts/LogsLayout/LogsLayout'
import type { NextPageWithLayout } from 'types'

const LaravelLogsPage: NextPageWithLayout = () => {
  return (
    <div className="flex flex-col flex-1 h-full px-5 py-6">
      <OrchestraLogs serviceFilter="laravel" />
    </div>
  )
}

LaravelLogsPage.getLayout = (page) => (
  <DefaultLayout>
    <LogsLayout title="Laravel Logs">{page}</LogsLayout>
  </DefaultLayout>
)

export default LaravelLogsPage
