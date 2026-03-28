/**
 * API Route: POST /api/orch-auth/verify-admin
 *
 * Verifies that a Supabase user is an admin by checking profiles.is_admin.
 * Uses service key server-side to bypass RLS.
 *
 * Accepts either:
 * - Authorization: Bearer <access_token> header
 * - { access_token } in request body
 * - { userId } in request body (with Authorization header)
 *
 * Response: { isAdmin: boolean } or { error: string }
 */

import { createClient } from '@supabase/supabase-js'
import type { NextApiRequest, NextApiResponse } from 'next'

const SUPABASE_URL = process.env.SUPABASE_URL || ''
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || ''

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Extract token from header or body
  const authHeader = req.headers.authorization
  const accessToken =
    (authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null) ||
    req.body?.access_token

  if (!accessToken) {
    return res.status(400).json({ error: 'Missing access token' })
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(500).json({ error: 'Supabase not configured' })
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // Verify JWT and get user
    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken)

    if (authError || !user) {
      return res.status(401).json({ error: 'Invalid or expired token' })
    }

    // Check admin status (service key bypasses RLS)
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single()

    if (profileError) {
      console.error('[Orchestra Auth] Profile query error:', profileError.message)
      // If profile not found, user is not admin
      return res.status(200).json({ isAdmin: false })
    }

    return res.status(200).json({ isAdmin: profile?.is_admin === true })
  } catch (err: any) {
    console.error('[Orchestra Auth] Verify admin error:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
