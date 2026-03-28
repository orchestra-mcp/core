/**
 * Orchestra Auth Integration
 *
 * Provides Supabase GoTrue JWT authentication with admin role checking
 * for self-hosted Orchestra MCP Studio instances.
 *
 * When NEXT_PUBLIC_ORCH_AUTH_ENABLED=true:
 * - Users must authenticate via Supabase GoTrue (email/password)
 * - After auth, profiles.is_admin is checked
 * - Non-admin users see "Access Denied"
 * - Admin users get full Studio access
 *
 * When disabled (default), self-hosted mode uses alwaysLoggedIn (no auth).
 */

import { createClient, type SupabaseClient, type Session, type User } from '@supabase/supabase-js'
import { useRouter } from 'next/router'
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
  type PropsWithChildren,
} from 'react'

// ─── Constants ──────────────────────────────────────────────────────────────

export const ORCH_AUTH_ENABLED = process.env.NEXT_PUBLIC_ORCH_AUTH_ENABLED === 'true'

// These must use NEXT_PUBLIC_ prefix to be available on the client side.
// The Supabase client uses the project URL and automatically handles auth endpoints.
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

// Storage key for the Orchestra auth session (separate from platform auth)
const ORCH_STORAGE_KEY = 'orchestra.studio.auth.token'
const ORCH_ADMIN_KEY = 'orchestra.studio.auth.is_admin'

// Pages that don't require auth
const PUBLIC_PAGES = ['/orch-sign-in', '/access-denied']

// ─── Supabase Client (singleton for Orchestra auth) ─────────────────────────

let orchSupabaseClient: SupabaseClient | null = null

export function getOrchSupabaseClient(): SupabaseClient {
  if (!orchSupabaseClient) {
    orchSupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        storageKey: ORCH_STORAGE_KEY,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    })
  }
  return orchSupabaseClient
}

// ─── Admin Check ────────────────────────────────────────────────────────────

export async function checkIsAdmin(
  supabase: SupabaseClient,
  userId: string
): Promise<boolean> {
  try {
    // Use server-side API endpoint which has service key (bypasses RLS)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) return false

    const res = await fetch('/api/orch-auth/verify-admin', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ userId }),
    })

    if (!res.ok) {
      console.error('[Orchestra Auth] Admin check failed:', res.status)
      return false
    }

    const result = await res.json()
    return result.isAdmin === true
  } catch (err) {
    console.error('[Orchestra Auth] Exception checking admin status:', err)
    return false
  }
}

// ─── Context ────────────────────────────────────────────────────────────────

export type OrchAuthState = {
  /** Whether Orchestra auth is enabled via env var */
  isEnabled: boolean
  /** Whether the auth state is still loading */
  isLoading: boolean
  /** The current session (null if not authenticated) */
  session: Session | null
  /** The current user (null if not authenticated) */
  user: User | null
  /** Whether the user has admin privileges */
  isAdmin: boolean
  /** Whether the user is authenticated (has session) */
  isAuthenticated: boolean
  /** Sign in with email and password */
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  /** Sign out */
  signOut: () => Promise<void>
}

const OrchAuthContext = createContext<OrchAuthState>({
  isEnabled: false,
  isLoading: true,
  session: null,
  user: null,
  isAdmin: false,
  isAuthenticated: false,
  signIn: async () => ({ error: 'Not initialized' }),
  signOut: async () => {},
})

// ─── Provider ───────────────────────────────────────────────────────────────

export function OrchAuthProvider({ children }: PropsWithChildren) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [session, setSession] = useState<Session | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)

  // Initialize auth state
  useEffect(() => {
    if (!ORCH_AUTH_ENABLED) {
      setIsLoading(false)
      return
    }

    const supabase = getOrchSupabaseClient()

    // Check existing session
    supabase.auth.getSession().then(async ({ data: { session: existingSession } }) => {
      if (existingSession?.user) {
        setSession(existingSession)
        // Check admin from cache first for faster load
        const cachedAdmin = safeGetLocalStorage(ORCH_ADMIN_KEY)
        if (cachedAdmin === 'true') {
          setIsAdmin(true)
        }
        // Always verify admin status from DB
        const adminStatus = await checkIsAdmin(supabase, existingSession.user.id)
        setIsAdmin(adminStatus)
        safeSetLocalStorage(ORCH_ADMIN_KEY, String(adminStatus))
      }
      setIsLoading(false)
    })

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      setSession(newSession)
      if (newSession?.user) {
        const adminStatus = await checkIsAdmin(supabase, newSession.user.id)
        setIsAdmin(adminStatus)
        safeSetLocalStorage(ORCH_ADMIN_KEY, String(adminStatus))
      } else {
        setIsAdmin(false)
        safeRemoveLocalStorage(ORCH_ADMIN_KEY)
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  // Redirect logic
  useEffect(() => {
    if (!ORCH_AUTH_ENABLED || isLoading) return

    const currentPath = router.pathname
    const isPublicPage = PUBLIC_PAGES.some((p) => currentPath.startsWith(p))

    if (!session && !isPublicPage) {
      // Not authenticated, redirect to sign-in
      router.replace(`/orch-sign-in?returnTo=${encodeURIComponent(router.asPath)}`)
    } else if (session && !isAdmin && !isPublicPage) {
      // Authenticated but not admin
      router.replace('/access-denied')
    }
  }, [session, isAdmin, isLoading, router.pathname])

  const signIn = useCallback(async (email: string, password: string) => {
    const supabase = getOrchSupabaseClient()

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      return { error: error.message }
    }

    if (!data.user) {
      return { error: 'Authentication failed. No user returned.' }
    }

    // Check admin status immediately
    const adminStatus = await checkIsAdmin(supabase, data.user.id)
    setIsAdmin(adminStatus)
    safeSetLocalStorage(ORCH_ADMIN_KEY, String(adminStatus))

    if (!adminStatus) {
      return { error: null } // Auth succeeded, but redirect will happen to access-denied
    }

    return { error: null }
  }, [])

  const signOut = useCallback(async () => {
    const supabase = getOrchSupabaseClient()
    await supabase.auth.signOut()
    setSession(null)
    setIsAdmin(false)
    safeRemoveLocalStorage(ORCH_ADMIN_KEY)
    router.push('/orch-sign-in')
  }, [router])

  const value = useMemo<OrchAuthState>(
    () => ({
      isEnabled: ORCH_AUTH_ENABLED,
      isLoading,
      session,
      user: session?.user ?? null,
      isAdmin,
      isAuthenticated: session !== null,
      signIn,
      signOut,
    }),
    [isLoading, session, isAdmin, signIn, signOut]
  )

  return <OrchAuthContext.Provider value={value}>{children}</OrchAuthContext.Provider>
}

// ─── Hooks ──────────────────────────────────────────────────────────────────

export function useOrchAuth() {
  return useContext(OrchAuthContext)
}

/**
 * Returns true if the current user is authenticated and is an admin.
 * Returns false if Orchestra auth is disabled (which means no auth required).
 */
export function useOrchAuthRequired(): {
  isReady: boolean
  isAllowed: boolean
} {
  const { isEnabled, isLoading, isAuthenticated, isAdmin } = useOrchAuth()

  if (!isEnabled) {
    return { isReady: true, isAllowed: true }
  }

  if (isLoading) {
    return { isReady: false, isAllowed: false }
  }

  return { isReady: true, isAllowed: isAuthenticated && isAdmin }
}

// ─── Utility ────────────────────────────────────────────────────────────────

function safeGetLocalStorage(key: string): string | null {
  try {
    return globalThis?.localStorage?.getItem(key) ?? null
  } catch {
    return null
  }
}

function safeSetLocalStorage(key: string, value: string): void {
  try {
    globalThis?.localStorage?.setItem(key, value)
  } catch {
    // Silently fail
  }
}

function safeRemoveLocalStorage(key: string): void {
  try {
    globalThis?.localStorage?.removeItem(key)
  } catch {
    // Silently fail
  }
}
