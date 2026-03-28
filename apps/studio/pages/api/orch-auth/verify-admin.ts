/**
 * API Route: POST /api/orch-auth/verify-admin
 *
 * Verifies that a Supabase user is an admin by checking profiles.is_admin.
 * Used server-side to validate admin status without exposing service key to client.
 *
 * Request body: { access_token: string }
 * Response: { is_admin: boolean } or { error: string }
 */

import { createClient } from '@supabase/supabase-js'
import type { NextApiRequest, NextApiResponse } from 'next'

const SUPABASE_URL = process.env.SUPABASE_URL || ''
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || ''

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { access_token } = req.body

  if (!access_token || typeof access_token !== 'string') {
    return res.status(400).json({ error: 'Missing access_token' })
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(500).json({ error: 'Supabase not configured' })
  }

  try {
    // Use service key to verify the token and get user
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    // Verify the JWT and get user info
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(access_token)

    if (authError || !user) {
      return res.status(401).json({ error: 'Invalid or expired token' })
    }

    // Check admin status
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single()

    if (profileError) {
      console.error('[Orchestra Auth] Profile query error:', profileError.message)
      return res.status(500).json({ error: 'Failed to check admin status' })
    }

    return res.status(200).json({ is_admin: profile?.is_admin === true })
  } catch (err: any) {
    console.error('[Orchestra Auth] Verify admin error:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
