import apiWrapper from 'lib/api/apiWrapper'
import { executeQuery } from 'lib/api/self-hosted/query'
import type { NextApiRequest, NextApiResponse } from 'next'

export default (req: NextApiRequest, res: NextApiResponse) =>
  apiWrapper(req, res, handler, { withAuth: true })

async function handler(req: NextApiRequest, res: NextApiResponse) {
  switch (req.method) {
    case 'DELETE':
      return handleDelete(req, res)
    default:
      return res.status(405).json({ error: { message: `Method ${req.method} not allowed` } })
  }
}

async function handleDelete(req: NextApiRequest, res: NextApiResponse) {
  const tokenId = req.query.id as string

  if (!tokenId) {
    return res.status(400).json({ error: { message: 'Token ID is required' } })
  }

  await executeQuery({
    query: `UPDATE public.mcp_tokens SET revoked_at = NOW() WHERE id = $1`,
    parameters: [tokenId],
  })

  return res.status(200).json({})
}
