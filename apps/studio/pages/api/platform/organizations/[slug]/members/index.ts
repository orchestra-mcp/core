import { NextApiRequest, NextApiResponse } from 'next'

import apiWrapper from 'lib/api/apiWrapper'

export default (req: NextApiRequest, res: NextApiResponse) => apiWrapper(req, res, handler)

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { method } = req

  switch (method) {
    case 'GET':
      return handleGet(req, res)
    default:
      res.setHeader('Allow', ['GET'])
      res.status(405).json({ data: null, error: { message: `Method ${method} Not Allowed` } })
  }
}

const handleGet = async (_req: NextApiRequest, res: NextApiResponse) => {
  // In self-hosted mode, return the instance owner as the sole organization member.
  // The Member schema expects: gotrue_id, is_sso_user, metadata, mfa_enabled,
  // primary_email, role_ids, username.
  const response = [
    {
      gotrue_id: '00000000-0000-0000-0000-000000000000',
      is_sso_user: false,
      metadata: {},
      mfa_enabled: false,
      primary_email: process.env.SUPABASE_ADMIN_EMAIL || 'admin@supabase.io',
      role_ids: [1], // Owner
      username: process.env.SUPABASE_ADMIN_EMAIL?.split('@')[0] || 'admin',
    },
  ]

  return res.status(200).json(response)
}
