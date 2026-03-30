import apiWrapper from 'lib/api/apiWrapper'
import { NextApiRequest, NextApiResponse } from 'next'

export default (req: NextApiRequest, res: NextApiResponse) => apiWrapper(req, res, handler)

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { method } = req

  switch (method) {
    case 'GET':
      return handleGet(req, res)
    case 'PATCH':
      return handlePatch(req, res)
    default:
      res.setHeader('Allow', ['GET', 'PATCH'])
      res.status(405).json({ data: null, error: { message: `Method ${method} Not Allowed` } })
  }
}

/**
 * GET /api/platform/notifications
 *
 * Returns an empty notifications array for self-hosted Studio.
 * In the hosted platform this proxies to the notifications service,
 * but self-hosted instances have no notification backend.
 *
 * Query params accepted (all optional, kept for compatibility):
 *   - offset: number
 *   - limit: number
 *   - status: 'new' | 'seen' | 'archived' (comma-separated)
 *   - priority: string (comma-separated)
 *   - org_slug: string (comma-separated)
 *   - project_ref: string (comma-separated)
 */
const handleGet = async (_req: NextApiRequest, res: NextApiResponse) => {
  return res.status(200).json([])
}

/**
 * PATCH /api/platform/notifications
 *
 * Accepts an array of { id, status } objects to update notification status.
 * Self-hosted: returns the same objects back (no-op) since there are no
 * real notifications to update.
 */
const handlePatch = async (req: NextApiRequest, res: NextApiResponse) => {
  const body = req.body
  // Return the body as-is — pretend the status was updated
  if (Array.isArray(body)) {
    return res.status(200).json(
      body.map((item: { id: string; status: string }) => ({
        id: item.id,
        data: null,
        inserted_at: new Date().toISOString(),
        meta: null,
        name: '',
        priority: 'Info' as const,
        status: item.status ?? 'seen',
      }))
    )
  }
  return res.status(200).json([])
}
