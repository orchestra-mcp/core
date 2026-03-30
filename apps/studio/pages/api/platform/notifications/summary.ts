import apiWrapper from 'lib/api/apiWrapper'
import { NextApiRequest, NextApiResponse } from 'next'

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

/**
 * GET /api/platform/notifications/summary
 *
 * Returns a notifications summary for self-hosted Studio.
 * Always reports zero unread and no critical/warning notifications.
 */
const handleGet = async (_req: NextApiRequest, res: NextApiResponse) => {
  return res.status(200).json({
    unread_count: 0,
    has_critical: false,
    has_warning: false,
  })
}
