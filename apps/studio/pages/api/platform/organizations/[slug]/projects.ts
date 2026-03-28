import { NextApiRequest, NextApiResponse } from 'next'

import apiWrapper from 'lib/api/apiWrapper'
import { DEFAULT_PROJECT } from 'lib/constants/api'

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
  const { limit = '96', offset = '0' } = req.query

  const limitNum = parseInt(limit as string, 10)
  const offsetNum = parseInt(offset as string, 10)

  // In self-hosted mode, return the single default project wrapped in
  // the OrganizationProjectsResponse shape the frontend expects.
  const project = {
    ...DEFAULT_PROJECT,
    ref: DEFAULT_PROJECT.ref,
    is_branch: false,
    databases: [
      {
        identifier: DEFAULT_PROJECT.ref,
        cloud_provider: DEFAULT_PROJECT.cloud_provider,
        region: DEFAULT_PROJECT.region,
        status: DEFAULT_PROJECT.status,
        type: 'PRIMARY' as const,
      },
    ],
  }

  const projects = [project]

  return res.status(200).json({
    pagination: {
      count: projects.length,
      limit: limitNum,
      offset: offsetNum,
    },
    projects,
  })
}
