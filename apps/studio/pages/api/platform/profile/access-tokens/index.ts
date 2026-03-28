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
    case 'DELETE':
      return handleDelete(req, res)
    default:
      return res.status(405).json({ error: { message: `Method ${req.method} not allowed` } })
  }
}

async function handleGet(_req: NextApiRequest, res: NextApiResponse) {
  const { data, error } = await executeQuery<{
    id: string
    name: string
    token_hash: string
    created_at: string
  }>({
    query: `SELECT id, name, token_prefix as token_hash, created_at
            FROM public.mcp_tokens
            WHERE revoked_at IS NULL
            ORDER BY created_at DESC`,
  })

  if (error) {
    // If the table doesn't exist yet, return empty array gracefully
    console.warn('access-tokens query error (table may not exist):', error.message)
    return res.status(200).json([])
  }

  return res.status(200).json(data || [])
}

async function handlePost(req: NextApiRequest, res: NextApiResponse) {
  const name = req.body?.name || 'default'
  const tokenId = crypto.randomUUID()
  const tokenPrefix = tokenId.slice(0, 8)

  const { data, error } = await executeQuery<{
    id: string
    name: string
    token_hash: string
    created_at: string
  }>({
    query: `INSERT INTO public.mcp_tokens (id, name, token_prefix, created_at)
            VALUES ($1, $2, $3, NOW())
            RETURNING id, name, token_prefix as token_hash, created_at`,
    parameters: [tokenId, name, tokenPrefix],
  })

  if (error) {
    // Fallback if table doesn't exist
    return res.status(200).json({
      id: tokenId,
      name,
      token_hash: tokenPrefix,
      created_at: new Date().toISOString(),
    })
  }

  return res.status(200).json(data?.[0] || { id: tokenId, name, token_hash: tokenPrefix, created_at: new Date().toISOString() })
}

async function handleDelete(req: NextApiRequest, res: NextApiResponse) {
  const tokenId = req.query.id || req.body?.id

  if (tokenId) {
    await executeQuery({
      query: `UPDATE public.mcp_tokens SET revoked_at = NOW() WHERE id = $1`,
      parameters: [tokenId],
    })
  }

  return res.status(200).json({})
}
