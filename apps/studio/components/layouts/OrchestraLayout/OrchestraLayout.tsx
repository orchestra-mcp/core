import { useParams } from 'common'
import { ProductMenu } from 'components/ui/ProductMenu'
import { withAuth } from 'hooks/misc/withAuth'
import { useRouter } from 'next/router'
import type { PropsWithChildren } from 'react'

import { ProjectLayout } from '../ProjectLayout'
import { useGenerateOrchestraMenu } from './OrchestraLayout.utils'

export const OrchestraProductMenu = () => {
  const router = useRouter()
  const { ref: projectRef = 'default' } = useParams()

  const pathSegments = router.pathname.split('/')
  // The page key is the segment after /orchestra/, or 'orchestra' for the index
  const page = pathSegments[4] ?? 'orchestra'
  const menu = useGenerateOrchestraMenu()

  return <ProductMenu page={page} menu={menu} />
}

const OrchestraLayout = ({ title, children }: PropsWithChildren<{ title: string }>) => {
  return (
    <ProjectLayout
      product="Orchestra"
      browserTitle={{ section: title }}
      productMenu={<OrchestraProductMenu />}
      isBlocking={false}
    >
      {children}
    </ProjectLayout>
  )
}

export default withAuth(OrchestraLayout)
