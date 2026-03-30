import { OrchestraLogs } from 'components/interfaces/Orchestra/OrchestraLogs'
import DefaultLayout from 'components/layouts/DefaultLayout'
import LogsLayout from 'components/layouts/LogsLayout/LogsLayout'
import type { NextPageWithLayout } from 'types'

const GoMcpLogsPage: NextPageWithLayout = () => {
  return (
    <div className="flex flex-col flex-1 h-full px-5 py-6">
      <OrchestraLogs serviceFilter="go_mcp" />
    </div>
  )
}

GoMcpLogsPage.getLayout = (page) => (
  <DefaultLayout>
    <LogsLayout title="Go MCP Logs">{page}</LogsLayout>
  </DefaultLayout>
)

export default GoMcpLogsPage
