import apiWrapper from 'lib/api/apiWrapper'
import { executeQuery } from 'lib/api/self-hosted/query'
import type { NextApiRequest, NextApiResponse } from 'next'

export default (req: NextApiRequest, res: NextApiResponse) =>
  apiWrapper(req, res, handler, { withAuth: true })

async function handler(req: NextApiRequest, res: NextApiResponse) {
  switch (req.method) {
    case 'GET':
      return handleGet(req, res)
    case 'POST':
      return handlePost(req, res)
    default:
      return res.status(405).json({ error: { message: `Method ${req.method} not allowed` } })
  }
}

async function handleGet(_req: NextApiRequest, res: NextApiResponse) {
  const { data, error } = await executeQuery<{
    id: string
    name: string
    token_prefix: string
    created_at: string
  }>({
    query: `SELECT id, name, token_prefix, created_at
            FROM public.mcp_tokens
            WHERE revoked_at IS NULL
            ORDER BY created_at DESC`,
  })

  if (error) {
    // If the table doesn't exist yet, return empty array gracefully
    console.warn('access-tokens query error (table may not exist):', error.message)
    return res.status(200).json([])
  }

  // Map to the AccessToken schema expected by the frontend:
  // { id: number, name: string, token_alias: string, created_at: string, expires_at: string|null, last_used_at: string|null }
  const tokens = (data || []).map((row) => ({
    id: row.id,
    name: row.name,
    token_alias: `orch_...${row.token_prefix}`,
    created_at: row.created_at,
    expires_at: null,
    last_used_at: null,
  }))

  return res.status(200).json(tokens)
}

async function handlePost(req: NextApiRequest, res: NextApiResponse) {
  const name = req.body?.name || 'default'
  const tokenId = crypto.randomUUID()
  const fullToken = `orch_${tokenId.replace(/-/g, '')}`
  const tokenPrefix = tokenId.slice(0, 8)

  const { data, error } = await executeQuery<{
    id: string
    name: string
    token_prefix: string
    created_at: string
  }>({
    query: `INSERT INTO public.mcp_tokens (id, name, token_prefix, created_at)
            VALUES ($1, $2, $3, NOW())
            RETURNING id, name, token_prefix, created_at`,
    parameters: [tokenId, name, tokenPrefix],
  })

  const row = data?.[0]
  const createdAt = row?.created_at || new Date().toISOString()
  const prefix = row?.token_prefix || tokenPrefix

  if (error) {
    console.warn('access-tokens create error (table may not exist):', error.message)
  }

  // Return CreateAccessTokenResponse schema:
  // { id: number, name: string, token: string, token_alias: string, created_at: string, expires_at: string|null, last_used_at: string|null }
  return res.status(200).json({
    id: row?.id || tokenId,
    name,
    token: fullToken,
    token_alias: `orch_...${prefix}`,
    created_at: createdAt,
    expires_at: null,
    last_used_at: null,
  })
}
