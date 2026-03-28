import apiWrapper from 'lib/api/apiWrapper'
import type { NextApiRequest, NextApiResponse } from 'next'

export default (req: NextApiRequest, res: NextApiResponse) =>
  apiWrapper(req, res, handler, { withAuth: true })

async function handler(req: NextApiRequest, res: NextApiResponse) {
  switch (req.method) {
    case 'GET':
      return res.status(200).json([])
    case 'POST':
      return res.status(200).json({
        id: crypto.randomUUID(),
        name: req.body?.name || 'default',
        token_hash: 'self-hosted-token',
        created_at: new Date().toISOString(),
      })
    case 'DELETE':
      return res.status(200).json({})
    default:
      return res.status(405).json({ error: { message: `Method ${req.method} not allowed` } })
  }
}
