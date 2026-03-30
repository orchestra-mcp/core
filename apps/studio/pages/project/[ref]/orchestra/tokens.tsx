import { OrchestraTokens } from 'components/interfaces/Orchestra/OrchestraTokens'
import DefaultLayout from 'components/layouts/DefaultLayout'
import OrchestraLayout from 'components/layouts/OrchestraLayout/OrchestraLayout'
import { DOCS_URL } from 'lib/constants'
import { ExternalLink, Plus, Search } from 'lucide-react'
import { useState } from 'react'
import type { NextPageWithLayout } from 'types'
import { Button } from 'ui'
import { Input } from 'ui-patterns/DataInputs/Input'
import { PageContainer } from 'ui-patterns/PageContainer'
import {
  PageHeader,
  PageHeaderDescription,
  PageHeaderMeta,
  PageHeaderSummary,
  PageHeaderTitle,
} from 'ui-patterns/PageHeader'
import { PageSection, PageSectionContent } from 'ui-patterns/PageSection'

const OrchestraTokensPage: NextPageWithLayout = () => {
  const [searchString, setSearchString] = useState('')

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
        <PageSection>
          <PageSectionContent className="gap-y-4">
            <div className="flex items-center justify-between gap-x-2 mb-2">
              <Input
                size="tiny"
                autoComplete="off"
                icon={<Search size={12} />}
                value={searchString}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setSearchString(e.target.value)
                }
                name="search"
                id="search"
                placeholder="Filter tokens"
                className="w-64"
              />
              <div className="flex items-center gap-x-2">
                <Button asChild type="default" icon={<ExternalLink />}>
                  <a href={`${DOCS_URL}/guides/orchestra/api`} target="_blank" rel="noreferrer">
                    API Docs
                  </a>
                </Button>
                <Button asChild type="default" icon={<ExternalLink />}>
                  <a href={`${DOCS_URL}/guides/orchestra/cli`} target="_blank" rel="noreferrer">
                    CLI Docs
                  </a>
                </Button>
                <Button type="primary" icon={<Plus size={14} />}>
                  Generate new token
                </Button>
              </div>
            </div>
            <OrchestraTokens searchString={searchString} />
          </PageSectionContent>
        </PageSection>
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
