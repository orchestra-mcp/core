import { NextApiRequest, NextApiResponse } from 'next'

import apiWrapper from 'lib/api/apiWrapper'
import { DEFAULT_PROJECT } from 'lib/constants/api'
import { executeQuery } from 'lib/api/self-hosted/query'

export default (req: NextApiRequest, res: NextApiResponse) => apiWrapper(req, res, handler)

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { method } = req

  switch (method) {
    case 'GET':
      return handleGetAll(req, res)
    case 'PATCH':
      return handlePatch(req, res)
    default:
      res.setHeader('Allow', ['GET', 'PATCH'])
      res.status(405).json({ data: null, error: { message: `Method ${method} Not Allowed` } })
  }
}

const handleGetAll = async (req: NextApiRequest, res: NextApiResponse) => {
  // Query the profiles table for the admin user via pg-meta
  const { data, error } = await executeQuery<{
    id: string
    full_name: string | null
    username: string | null
    avatar_url: string | null
    email: string | null
  }>({
    query: `SELECT p.id, p.full_name, p.username, p.avatar_url, u.email
            FROM public.profiles p
            JOIN auth.users u ON u.id = p.id
            WHERE p.is_admin = true LIMIT 1`,
  })

  // Parse the admin user or fall back to defaults
  const admin = data?.[0]
  const nameParts = (admin?.full_name || '').split(' ')
  const firstName = nameParts[0] || 'Admin'
  const lastName = nameParts.slice(1).join(' ') || ''

  const response = {
    id: admin?.id || 1,
    primary_email: admin?.email || 'admin@orchestra-mcp.dev',
    username: admin?.username || 'admin',
    first_name: firstName,
    last_name: lastName,
    disabled_features: [] as string[],
    organizations: [
      {
        id: 1,
        name: process.env.DEFAULT_ORGANIZATION_NAME || 'Orchestra',
        slug: 'default-org-slug',
        billing_email: admin?.email || 'admin@orchestra-mcp.dev',
        projects: [{ ...DEFAULT_PROJECT, connectionString: '' }],
      },
    ],
  }
  return res.status(200).json(response)
}

const handlePatch = async (req: NextApiRequest, res: NextApiResponse) => {
  const { first_name, last_name, username, primary_email } = req.body || {}

  const fullName = [first_name, last_name].filter(Boolean).join(' ') || null

  // Update the admin profile in the database
  const { data, error } = await executeQuery<{
    id: string
    full_name: string | null
    username: string | null
    email: string | null
  }>({
    query: `UPDATE public.profiles
            SET full_name = COALESCE($1, full_name),
                username = COALESCE($2, username),
                updated_at = NOW()
            WHERE is_admin = true
            RETURNING id, full_name, username,
              (SELECT email FROM auth.users WHERE id = profiles.id) as email`,
    parameters: [fullName, username || null],
  })

  if (error) {
    console.error('Profile update error:', error.message)
    return res.status(500).json({ error: { message: 'Failed to update profile' } })
  }

  const updated = data?.[0]
  const nameParts = (updated?.full_name || '').split(' ')

  const response = {
    id: updated?.id || 1,
    primary_email: updated?.email || primary_email || 'admin@orchestra-mcp.dev',
    username: updated?.username || username || 'admin',
    first_name: nameParts[0] || first_name || '',
    last_name: nameParts.slice(1).join(' ') || last_name || '',
    disabled_features: [] as string[],
  }

  return res.status(200).json(response)
}
