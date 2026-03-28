/**
 * Orchestra Studio Sign-In Page
 *
 * Used when NEXT_PUBLIC_ORCH_AUTH_ENABLED=true for self-hosted instances.
 * Authenticates via Supabase GoTrue and checks admin status.
 */

import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import { AuthenticationLayout } from 'components/layouts/AuthenticationLayout'
import SignInLayout from 'components/layouts/SignInLayout/SignInLayout'
import { useOrchAuth, ORCH_AUTH_ENABLED } from 'lib/orch-auth'
import type { NextPageWithLayout } from 'types'
import { Button, Input_Shadcn_ } from 'ui'

const OrchSignInPage: NextPageWithLayout = () => {
  const router = useRouter()
  const { signIn, isAuthenticated, isAdmin, isLoading } = useOrchAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [passwordVisible, setPasswordVisible] = useState(false)

  // If not using Orchestra auth, redirect to default project
  useEffect(() => {
    if (!ORCH_AUTH_ENABLED) {
      router.replace('/project/default')
    }
  }, [router])

  // If already authenticated and admin, redirect
  useEffect(() => {
    if (!isLoading && isAuthenticated && isAdmin) {
      const returnTo = (router.query.returnTo as string) || '/project/default'
      router.replace(returnTo)
    }
    if (!isLoading && isAuthenticated && !isAdmin) {
      router.replace('/access-denied')
    }
  }, [isLoading, isAuthenticated, isAdmin, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!email || !password) {
      toast.error('Please enter your email and password')
      return
    }

    setIsSubmitting(true)

    try {
      const { error } = await signIn(email, password)

      if (error) {
        toast.error(error)
        return
      }

      // signIn succeeded. The useEffect above will handle redirect
      // based on admin status.
      toast.success('Signed in successfully')
    } catch (err: any) {
      toast.error(err?.message || 'An unexpected error occurred')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!ORCH_AUTH_ENABLED) {
    return null
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <label htmlFor="orch-email" className="text-sm text-foreground-light">
          Email
        </label>
        <Input_Shadcn_
          id="orch-email"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={isSubmitting}
          autoComplete="email"
          autoFocus
        />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="orch-password" className="text-sm text-foreground-light">
          Password
        </label>
        <div className="relative">
          <Input_Shadcn_
            id="orch-password"
            type={passwordVisible ? 'text' : 'password'}
            placeholder="&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isSubmitting}
            autoComplete="current-password"
            className="pr-10"
          />
          <button
            type="button"
            className="absolute right-2 top-1/2 -translate-y-1/2 text-foreground-lighter hover:text-foreground text-xs"
            onClick={() => setPasswordVisible((v) => !v)}
            tabIndex={-1}
          >
            {passwordVisible ? 'Hide' : 'Show'}
          </button>
        </div>
      </div>

      <Button
        block
        htmlType="submit"
        size="large"
        loading={isSubmitting}
        disabled={isSubmitting || !email || !password}
      >
        Sign In
      </Button>

      <p className="text-xs text-foreground-lighter text-center mt-2">
        Only administrators can access Orchestra Studio.
      </p>
    </form>
  )
}

OrchSignInPage.getLayout = (page) => (
  <AuthenticationLayout>
    <SignInLayout
      heading="Orchestra Studio"
      subheading="Sign in with your admin account"
      showDisclaimer={false}
      logoLinkToMarketingSite={false}
    >
      {page}
    </SignInLayout>
  </AuthenticationLayout>
)

export default OrchSignInPage
