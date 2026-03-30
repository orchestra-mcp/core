import { useState, type FC, type FormEvent } from 'react'

import { useAuth } from './AuthProvider'

const LoginScreen: FC = () => {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const { error: authError } = await signIn(email, password)

    if (authError) {
      setError(authError.message)
      setLoading(false)
    }
    // On success, AuthProvider will update state and App will show the main UI
  }

  return (
    <div
      className="flex h-full items-center justify-center"
      style={{ background: 'var(--background-default)' }}
    >
      <div className="w-full max-w-sm space-y-8 px-6">
        {/* Logo + branding */}
        <div className="flex flex-col items-center gap-4">
          <img
            src="/assets/logo.svg"
            alt="Orchestra"
            className="h-14 w-14"
            onError={(e) => {
              ;(e.target as HTMLImageElement).style.display = 'none'
            }}
          />
          <div className="text-center">
            <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground-default)' }}>
              Orchestra Desktop
            </h1>
            <p className="mt-1 text-sm" style={{ color: 'var(--foreground-lighter)' }}>
              Sign in to your Orchestra account
            </p>
          </div>
        </div>

        {/* Login form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Error message */}
          {error && (
            <div
              className="rounded-md px-4 py-3"
              style={{
                background: 'var(--destructive-200)',
                border: '1px solid hsla(10.2, 77.9%, 53.9%, 0.3)',
              }}
            >
              <p className="text-sm" style={{ color: 'var(--destructive-600)' }}>
                {error}
              </p>
            </div>
          )}

          {/* Email */}
          <div className="space-y-1.5">
            <label
              htmlFor="email"
              className="block text-xs font-medium"
              style={{ color: 'var(--foreground-lighter)' }}
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              required
              autoFocus
              disabled={loading}
              className="w-full rounded-md px-3.5 py-2.5 text-sm outline-none transition-colors disabled:opacity-50"
              style={{
                background: 'var(--background-control)',
                border: '1px solid var(--border-control)',
                color: 'var(--foreground-default)',
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = 'var(--brand-default)'
                e.currentTarget.style.boxShadow = '0 0 0 1px hsla(277, 100%, 50%, 0.3)'
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-control)'
                e.currentTarget.style.boxShadow = 'none'
              }}
            />
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <label
              htmlFor="password"
              className="block text-xs font-medium"
              style={{ color: 'var(--foreground-lighter)' }}
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
              disabled={loading}
              className="w-full rounded-md px-3.5 py-2.5 text-sm outline-none transition-colors disabled:opacity-50"
              style={{
                background: 'var(--background-control)',
                border: '1px solid var(--border-control)',
                color: 'var(--foreground-default)',
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = 'var(--brand-default)'
                e.currentTarget.style.boxShadow = '0 0 0 1px hsla(277, 100%, 50%, 0.3)'
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-control)'
                e.currentTarget.style.boxShadow = 'none'
              }}
            />
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-medium transition-all disabled:cursor-not-allowed disabled:opacity-50"
            style={{
              background: 'var(--brand-default)',
              color: 'var(--foreground-contrast)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--brand-600)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--brand-default)'
            }}
          >
            {loading ? (
              <>
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    className="opacity-25"
                  />
                  <path
                    d="M4 12a8 8 0 018-8"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                </svg>
                Signing in...
              </>
            ) : (
              'Sign in'
            )}
          </button>
        </form>

        {/* Footer */}
        <p className="text-center text-xs" style={{ color: 'var(--foreground-muted)' }}>
          Connecting to local Supabase at localhost:8000
        </p>
      </div>
    </div>
  )
}

export default LoginScreen
