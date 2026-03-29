import { useParams } from 'common'
import { useRouter } from 'next/router'
import { useEffect } from 'react'
import type { NextPageWithLayout } from 'types'

/**
 * Orchestra logs now live exclusively in the Logs & Analytics section.
 * This page redirects any old bookmarks/links to the correct location.
 */
const OrchestraLogsRedirect: NextPageWithLayout = () => {
  const router = useRouter()
  const { ref } = useParams()

  useEffect(() => {
    if (ref) {
      router.replace(`/project/${ref}/logs/orchestra-logs`)
    }
  }, [ref, router])

  return null
}

export default OrchestraLogsRedirect
