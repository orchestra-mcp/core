/**
 * Access Denied Page
 *
 * Shown when a user authenticates via GoTrue but does not have
 * profiles.is_admin = true in the database.
 */

import { AuthenticationLayout } from 'components/layouts/AuthenticationLayout'
import SignInLayout from 'components/layouts/SignInLayout/SignInLayout'
import { ORCH_AUTH_ENABLED, useOrchAuth } from 'lib/orch-auth'
import { ShieldOff } from 'lucide-react'
import { useRouter } from 'next/router'
import { useEffect } from 'react'
import type { NextPageWithLayout } from 'types'
import { Button } from 'ui'

const AccessDeniedPage: NextPageWithLayout = () => {
  const router = useRouter()
  const { signOut, isAuthenticated, isAdmin, isLoading, user } = useOrchAuth()

  // If Orchestra auth isn't enabled, redirect to default project
  useEffect(() => {
    if (!ORCH_AUTH_ENABLED) {
      router.replace('/project/default')
    }
  }, [router])

  // If user is actually an admin, redirect to the project
  useEffect(() => {
    if (!isLoading && isAuthenticated && isAdmin) {
      router.replace('/project/default')
    }
    // If not authenticated at all, redirect to sign-in
    if (!isLoading && !isAuthenticated) {
      router.replace('/orch-sign-in')
    }
  }, [isLoading, isAuthenticated, isAdmin, router])

  const handleSignOut = async () => {
    await signOut()
  }

  const handleTryAgain = async () => {
    await signOut()
    router.push('/orch-sign-in')
  }

  if (!ORCH_AUTH_ENABLED) {
    return null
  }

  return (
    <div className="flex flex-col items-center gap-6 text-center">
      <div className="flex items-center justify-center w-16 h-16 rounded-full bg-destructive-200">
        <ShieldOff className="w-8 h-8 text-destructive-600" />
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="text-xl font-semibold text-foreground">Access Denied</h2>
        <p className="text-sm text-foreground-light max-w-sm">
          Your account{user?.email ? ` (${user.email})` : ''} does not have administrator
          privileges. Only users with{' '}
          <code className="text-xs bg-surface-200 px-1 py-0.5 rounded">is_admin = true</code> in the{' '}
          <code className="text-xs bg-surface-200 px-1 py-0.5 rounded">profiles</code> table can
          access Orchestra Studio.
        </p>
      </div>

      <div className="flex flex-col gap-3 w-full">
        <Button block size="large" type="default" onClick={handleTryAgain}>
          Sign in with a different account
        </Button>
        <Button block size="large" type="outline" onClick={handleSignOut}>
          Sign out
        </Button>
      </div>

      <p className="text-xs text-foreground-lighter mt-4">
        Contact your system administrator to request access.
      </p>
    </div>
  )
}

AccessDeniedPage.getLayout = (page) => (
  <AuthenticationLayout>
    <SignInLayout
      heading="Restricted Area"
      subheading="Administrator access required"
      showDisclaimer={false}
      logoLinkToMarketingSite={false}
    >
      {page}
    </SignInLayout>
  </AuthenticationLayout>
)

export default AccessDeniedPage
