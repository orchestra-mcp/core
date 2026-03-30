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

const handleGet = async (req: NextApiRequest, res: NextApiResponse) => {
  const slug = req.query.slug as string

  return res.status(200).json({
    id: 1,
    name: 'Orchestra',
    slug: slug || 'default-org-slug',
    billing_email: 'admin@orchestra-mcp.dev',
    plan: { id: 'enterprise', name: 'Enterprise' },
    usage_billing_enabled: true,
    restriction_status: 'none',
  })
}
