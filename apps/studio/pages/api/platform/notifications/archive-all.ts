import apiWrapper from 'lib/api/apiWrapper'
import { NextApiRequest, NextApiResponse } from 'next'

export default (req: NextApiRequest, res: NextApiResponse) => apiWrapper(req, res, handler)

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { method } = req

  switch (method) {
    case 'PATCH':
      return handlePatch(req, res)
    default:
      res.setHeader('Allow', ['PATCH'])
      res.status(405).json({ data: null, error: { message: `Method ${method} Not Allowed` } })
  }
}

/**
 * PATCH /api/platform/notifications/archive-all
 *
 * Archives all notifications for self-hosted Studio.
 * No-op since there are no real notifications — returns 200 OK.
 */
const handlePatch = async (_req: NextApiRequest, res: NextApiResponse) => {
  return res.status(200).json({})
}
