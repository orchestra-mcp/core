import { NextApiRequest, NextApiResponse } from 'next'

import apiWrapper from 'lib/api/apiWrapper'
import { constructHeaders } from 'lib/api/apiHelpers'
import { executeQuery } from 'lib/api/self-hosted/query'
import { PgMetaDatabaseError } from 'lib/api/self-hosted/types'

export default (req: NextApiRequest, res: NextApiResponse) =>
  apiWrapper(req, res, handler, { withAuth: true })

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { method } = req

  switch (method) {
    case 'GET':
      return handleGet(req, res)
    case 'PATCH':
      return handlePatch(req, res)
    default:
      res.setHeader('Allow', ['GET', 'PATCH'])
      res.status(405).json({ error: { message: `Method ${method} Not Allowed` } })
  }
}

const handleGet = async (req: NextApiRequest, res: NextApiResponse) => {
  const headers = constructHeaders(req.headers)
  const { data, error } = await executeQuery({
    query: `SELECT COALESCE(settings->'integrations', '{}') as integrations FROM public.organizations LIMIT 1`,
    headers,
  })

  if (error) {
    if (error instanceof PgMetaDatabaseError) {
      const { statusCode, message, formattedError } = error
      return res.status(statusCode).json({ message, formattedError })
    }
    return res.status(500).json({ message: error.message })
  }

  const row = Array.isArray(data) && data.length > 0 ? data[0] : null
  return res.status(200).json(row?.integrations ?? {})
}

const handlePatch = async (req: NextApiRequest, res: NextApiResponse) => {
  const headers = constructHeaders(req.headers)
  const integrations = req.body

  if (!integrations || typeof integrations !== 'object') {
    return res.status(400).json({ error: { message: 'Request body must be a JSON object' } })
  }

  const { data, error } = await executeQuery({
    query: `UPDATE public.organizations SET settings = jsonb_set(
      COALESCE(settings, '{}'),
      '{integrations}',
      $1::jsonb
    ) WHERE id = (SELECT id FROM public.organizations LIMIT 1)
    RETURNING settings->'integrations' as integrations`,
    parameters: [JSON.stringify(integrations)],
    headers,
  })

  if (error) {
    if (error instanceof PgMetaDatabaseError) {
      const { statusCode, message, formattedError } = error
      return res.status(statusCode).json({ message, formattedError })
    }
    return res.status(500).json({ message: error.message })
  }

  const row = Array.isArray(data) && data.length > 0 ? data[0] : null
  return res.status(200).json(row?.integrations ?? {})
}
