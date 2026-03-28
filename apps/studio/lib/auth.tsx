import { useQueryClient } from '@tanstack/react-query'
import { PropsWithChildren, useCallback, useEffect } from 'react'
import { toast } from 'sonner'

import {
  AuthProvider as AuthProviderInternal,
  clearLocalStorage,
  gotrueClient,
  posthogClient,
  useAuthError,
} from 'common'
import { useAiAssistantStateSnapshot } from 'state/ai-assistant-state'
import { GOTRUE_ERRORS, IS_PLATFORM } from './constants'
import { OrchAuthProvider, ORCH_AUTH_ENABLED } from './orch-auth'

const AuthErrorToaster = ({ children }: PropsWithChildren) => {
  const error = useAuthError()

  useEffect(() => {
    if (error !== null) {
      // Check for unverified GitHub users after a GitHub sign in
      if (error.message === GOTRUE_ERRORS.UNVERIFIED_GITHUB_USER) {
        toast.error(
          'Please verify your email on GitHub first, then reach out to us at support@supabase.io to log into the dashboard'
        )
        return
      }

      toast.error(error.message)
    }
  }, [error])

  return children
}

/**
 * When Orchestra auth is enabled for self-hosted, we still use alwaysLoggedIn
 * for the platform AuthProvider (since self-hosted doesn't use platform auth),
 * but we wrap everything in OrchAuthProvider which handles the real auth.
 *
 * Flow:
 * - IS_PLATFORM=true  → Platform GoTrue auth (original behavior)
 * - IS_PLATFORM=false, ORCH_AUTH_ENABLED=true  → Orchestra GoTrue + admin check
 * - IS_PLATFORM=false, ORCH_AUTH_ENABLED=false → No auth (original self-hosted behavior)
 */
export const AuthProvider = ({ children }: PropsWithChildren) => {
  const alwaysLoggedIn = !IS_PLATFORM

  return (
    <AuthProviderInternal alwaysLoggedIn={alwaysLoggedIn}>
      <AuthErrorToaster>
        {!IS_PLATFORM && ORCH_AUTH_ENABLED ? (
          <OrchAuthProvider>{children}</OrchAuthProvider>
        ) : (
          children
        )}
      </AuthErrorToaster>
    </AuthProviderInternal>
  )
}

export function useSignOut() {
  const queryClient = useQueryClient()
  const { clearStorage: clearAssistantStorage } = useAiAssistantStateSnapshot()

  return useCallback(async () => {
    const result = await gotrueClient.signOut()
    posthogClient.reset()
    clearLocalStorage()
    // Clear Assistant IndexedDB
    await clearAssistantStorage()
    queryClient.clear()

    return result
  }, [queryClient, clearAssistantStorage])
}
