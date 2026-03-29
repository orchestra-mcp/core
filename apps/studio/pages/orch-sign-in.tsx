/**
 * Orchestra Studio Sign-In Page
 *
 * Custom dark login screen matching the Laravel app design.
 * Uses Supabase GoTrue for email/password + GitHub OAuth.
 *
 * When NEXT_PUBLIC_ORCH_AUTH_ENABLED=true for self-hosted instances.
 */

import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import { useOrchAuth, getOrchSupabaseClient, ORCH_AUTH_ENABLED } from 'lib/orch-auth'
import type { NextPageWithLayout } from 'types'

// ─── Orchestra Logo (inline SVG from arts/logo.svg) ─────────────────────────

const OrchestraLogo = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 725.06 724.82"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <defs>
      <linearGradient
        id="orch-grad"
        x1="671.57"
        y1="599.9"
        x2="188.27"
        y2="219.43"
        gradientUnits="userSpaceOnUse"
      >
        <stop offset="0" stopColor="#a900ff" />
        <stop offset="1" stopColor="#00e5ff" />
      </linearGradient>
      <linearGradient
        id="orch-grad1"
        x1="669.35"
        y1="602.72"
        x2="186.05"
        y2="222.25"
        xlinkHref="#orch-grad"
      />
      <linearGradient
        id="orch-grad2"
        x1="669.64"
        y1="602.35"
        x2="186.34"
        y2="221.88"
        xlinkHref="#orch-grad"
      />
    </defs>
    <path
      fill="url(#orch-grad)"
      d="M670.75,54.19c-8.34-8.34-21.81-8.54-30.39-.45L61.86,599.32c-6.59,6.22-11.12,14.18-13.08,23.03-3.36,15.13,1.17,30.71,12.14,41.68,8.58,8.58,19.99,13.22,31.8,13.22,3.28,0,6.59-.36,9.87-1.09,8.84-1.96,16.81-6.49,23.03-13.08L671.19,84.58c8.09-8.58,7.9-22.05-.45-30.39Z"
    />
    <path
      fill="url(#orch-grad1)"
      d="M661.8,158.12l-54.6,57.88c25.67,42.78,40.44,92.88,40.44,146.41,0,157.51-127.72,285.23-285.23,285.23-47.55,0-92.41-11.64-131.84-32.28l-54.56,57.88c54.46,32.75,118.25,51.58,186.41,51.58,200.16,0,362.41-162.25,362.41-362.41,0-75.77-23.25-146.11-63.02-204.29ZM362.41,77.18c53.59,0,103.72,14.8,146.54,40.54l57.88-54.6C508.65,23.29,438.25,0,362.41,0,162.25,0,0,162.25,0,362.41c0,68.22,18.86,132.04,51.68,186.54l57.85-54.56c-20.67-39.46-32.35-84.36-32.35-131.98,0-157.51,127.72-285.23,285.23-285.23Z"
    />
    <path
      fill="url(#orch-grad2)"
      d="M362.41,130.87c-127.88,0-231.54,103.66-231.54,231.54,0,33.22,6.98,64.8,19.6,93.35l58.82-55.47c-3.02-12.15-4.6-24.83-4.6-37.89,0-87.11,70.6-157.72,157.72-157.72,16.31,0,32.01,2.48,46.81,7.05l58.79-55.44c-31.64-16.27-67.55-25.44-105.6-25.44ZM568.58,256.94l-55.47,58.82c4.56,14.73,7.01,30.4,7.01,46.64,0,87.11-70.6,157.72-157.72,157.72-12.99,0-25.64-1.58-37.72-4.53l-55.5,58.82c28.52,12.55,60.03,19.53,93.22,19.53,127.88,0,231.54-103.66,231.54-231.54,0-37.99-9.16-73.86-25.37-105.47Z"
    />
  </svg>
)

// ─── GitHub Icon ─────────────────────────────────────────────────────────────

const GitHubIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
  </svg>
)

// ─── Loading Spinner ─────────────────────────────────────────────────────────

const Spinner = () => (
  <svg
    className="animate-spin h-5 w-5"
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
  >
    <circle
      className="opacity-25"
      cx="12"
      cy="12"
      r="10"
      stroke="currentColor"
      strokeWidth="4"
    />
    <path
      className="opacity-75"
      fill="currentColor"
      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
    />
  </svg>
)

// ─── Page Component ──────────────────────────────────────────────────────────

const OrchSignInPage: NextPageWithLayout = () => {
  const router = useRouter()
  const { signIn, isAuthenticated, isAdmin, isLoading } = useOrchAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isGithubLoading, setIsGithubLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
    setError(null)

    if (!email || !password) {
      setError('Please enter your email and password')
      return
    }

    setIsSubmitting(true)

    try {
      const { error: signInError } = await signIn(email, password)

      if (signInError) {
        setError(signInError)
        return
      }

      toast.success('Signed in successfully')
    } catch (err: any) {
      setError(err?.message || 'An unexpected error occurred')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleGitHubSignIn = async () => {
    setError(null)
    setIsGithubLoading(true)

    try {
      const supabase = getOrchSupabaseClient()
      const redirectTo = `${window.location.origin}/orch-sign-in`

      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'github',
        options: { redirectTo },
      })

      if (oauthError) {
        setError(oauthError.message)
        setIsGithubLoading(false)
      }
      // If no error, the page will redirect to GitHub
    } catch (err: any) {
      setError(err?.message || 'Failed to sign in with GitHub')
      setIsGithubLoading(false)
    }
  }

  if (!ORCH_AUTH_ENABLED) {
    return null
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ backgroundColor: '#121212' }}
    >
      <div className="w-full max-w-[400px]">
        {/* Logo + Title */}
        <div className="flex flex-col items-center mb-8">
          <OrchestraLogo className="w-16 h-16 mb-4" />
          <h1 className="text-2xl font-semibold text-white">Orchestra Studio</h1>
          <p className="text-sm mt-1" style={{ color: '#888' }}>
            Sign in to your admin account
          </p>
        </div>

        {/* Card */}
        <div
          className="rounded-xl p-8"
          style={{
            backgroundColor: '#1a1a1a',
            border: '1px solid #2a2a2a',
          }}
        >
          {/* Error Display */}
          {error && (
            <div
              className="mb-4 px-4 py-3 rounded-lg text-sm"
              style={{
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#f87171',
              }}
            >
              {error}
            </div>
          )}

          {/* Email/Password Form */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="orch-email"
                className="text-sm font-medium"
                style={{ color: '#ccc' }}
              >
                Email
              </label>
              <input
                id="orch-email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isSubmitting}
                autoComplete="email"
                autoFocus
                className="w-full px-3.5 py-2.5 rounded-lg text-sm text-white placeholder-gray-500 outline-none transition-all duration-200"
                style={{
                  backgroundColor: '#252525',
                  border: '1px solid #333',
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#a900ff'
                  e.target.style.boxShadow = '0 0 0 3px rgba(169, 0, 255, 0.15)'
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#333'
                  e.target.style.boxShadow = 'none'
                }}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="orch-password"
                  className="text-sm font-medium"
                  style={{ color: '#ccc' }}
                >
                  Password
                </label>
                <a
                  href="/forgot-password"
                  className="text-xs transition-colors duration-200"
                  style={{ color: '#a900ff' }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = '#c44dff')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = '#a900ff')}
                >
                  Forgot password?
                </a>
              </div>
              <input
                id="orch-password"
                type="password"
                placeholder="&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isSubmitting}
                autoComplete="current-password"
                className="w-full px-3.5 py-2.5 rounded-lg text-sm text-white placeholder-gray-500 outline-none transition-all duration-200"
                style={{
                  backgroundColor: '#252525',
                  border: '1px solid #333',
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#a900ff'
                  e.target.style.boxShadow = '0 0 0 3px rgba(169, 0, 255, 0.15)'
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#333'
                  e.target.style.boxShadow = 'none'
                }}
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !email || !password}
              className="w-full py-2.5 rounded-lg text-sm font-medium text-white transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: '#a900ff' }}
              onMouseEnter={(e) => {
                if (!e.currentTarget.disabled)
                  e.currentTarget.style.backgroundColor = '#9500e0'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#a900ff'
              }}
            >
              {isSubmitting ? (
                <>
                  <Spinner />
                  Signing in...
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full" style={{ borderTop: '1px solid #333' }} />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="px-3" style={{ backgroundColor: '#1a1a1a', color: '#666' }}>
                or
              </span>
            </div>
          </div>

          {/* GitHub OAuth */}
          <button
            type="button"
            onClick={handleGitHubSignIn}
            disabled={isGithubLoading}
            className="w-full py-2.5 rounded-lg text-sm font-medium text-white transition-all duration-200 flex items-center justify-center gap-2.5 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              backgroundColor: '#252525',
              border: '1px solid #333',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#2a2a2a'
              e.currentTarget.style.borderColor = '#444'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#252525'
              e.currentTarget.style.borderColor = '#333'
            }}
          >
            {isGithubLoading ? <Spinner /> : <GitHubIcon />}
            {isGithubLoading ? 'Redirecting...' : 'Continue with GitHub'}
          </button>
        </div>

        {/* Register Link */}
        <p className="text-center text-sm mt-6" style={{ color: '#888' }}>
          Don't have an account?{' '}
          <a
            href={process.env.NEXT_PUBLIC_LARAVEL_URL ? `${process.env.NEXT_PUBLIC_LARAVEL_URL}/register` : '/register'}
            className="transition-colors duration-200"
            style={{ color: '#a900ff' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#c44dff')}
            onMouseLeave={(e) => (e.currentTarget.style.color = '#a900ff')}
          >
            Register
          </a>
        </p>

        {/* Admin Notice */}
        <p className="text-center text-xs mt-3" style={{ color: '#555' }}>
          Only administrators can access Orchestra Studio.
        </p>
      </div>
    </div>
  )
}

// No layout wrapper -- this page renders its own full-screen dark design
OrchSignInPage.getLayout = (page) => page

export default OrchSignInPage
