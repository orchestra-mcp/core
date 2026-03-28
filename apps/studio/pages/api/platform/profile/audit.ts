import { NextApiRequest, NextApiResponse } from 'next'

import apiWrapper from 'lib/api/apiWrapper'
import { executeQuery } from 'lib/api/self-hosted/query'

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
  const limit = Math.min(Math.max(parseInt(req.query.limit as string, 10) || 50, 1), 500)
  const offset = Math.max(parseInt(req.query.offset as string, 10) || 0, 0)
  const action = req.query.action as string | undefined

  // Resolve authenticated user ID from admin profile
  const { data: profileData } = await executeQuery<{ id: string }>({
    query: `SELECT id FROM public.profiles WHERE is_admin = true LIMIT 1`,
  })
  const userId = profileData?.[0]?.id

  let query = `
    SELECT id, action, summary, details::text,
           user_id, agent_id, project_id, task_id,
           session_id, machine_id, created_at
    FROM public.activity_log
    WHERE 1=1
  `
  const parameters: unknown[] = []

  if (userId) {
    parameters.push(userId)
    query += ` AND user_id = $${parameters.length}`
  }

  if (action) {
    parameters.push(action)
    query += ` AND action = $${parameters.length}`
  }

  parameters.push(limit, offset)
  query += ` ORDER BY created_at DESC LIMIT $${parameters.length - 1} OFFSET $${parameters.length}`

  const { data, error } = await executeQuery({
    query,
    parameters,
  })

  if (error) {
    console.warn('profile audit logs query error (table may not exist):', error.message)
    return res.status(200).json({ result: [], retention_period: 90 })
  }

  return res.status(200).json({ result: data || [], retention_period: 90 })
}
