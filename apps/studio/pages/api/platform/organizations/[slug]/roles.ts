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

const handleGet = async (_req: NextApiRequest, res: NextApiResponse) => {
  // Return the standard OrganizationRoleResponse shape with the four
  // built-in Supabase roles. The frontend sorts these by the fixed order:
  // Owner, Administrator, Developer, Read-only.
  return res.status(200).json({
    org_scoped_roles: [
      {
        id: 1,
        name: 'Owner',
        description: 'Full access to all resources',
        base_role_id: 1,
        projects: [],
      },
      {
        id: 2,
        name: 'Administrator',
        description: 'Can manage projects and members',
        base_role_id: 2,
        projects: [],
      },
      {
        id: 3,
        name: 'Developer',
        description: 'Can manage projects',
        base_role_id: 3,
        projects: [],
      },
      {
        id: 4,
        name: 'Read-only',
        description: 'Can view projects',
        base_role_id: 4,
        projects: [],
      },
    ],
    project_scoped_roles: [],
  })
}
