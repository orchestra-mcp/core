import apiWrapper from 'lib/api/apiWrapper'
import { executeQuery } from 'lib/api/self-hosted/query'
import { type NextApiRequest, type NextApiResponse } from 'next'

export default function handlerWithErrorCatching(req: NextApiRequest, res: NextApiResponse) {
  return apiWrapper(req, res, handler, { withAuth: true })
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { method } = req

  switch (method) {
    case 'GET':
      return handleGetAll(req, res)
    case 'POST':
      return handlePost(req, res)
    case 'DELETE':
      return handleDelete(req, res)
    default:
      res.setHeader('Allow', ['GET', 'POST', 'DELETE'])
      res.status(405).json({ data: null, error: { message: `Method ${method} Not Allowed` } })
  }
}

/**
 * GET /api/v1/projects/[ref]/secrets
 * Lists all edge function secrets. Returns the name, a SHA256 digest of the value, and the updated_at timestamp.
 * The actual secret value is never returned.
 */
const handleGetAll = async (_req: NextApiRequest, res: NextApiResponse) => {
  const { data, error } = await executeQuery<{
    name: string
    digest: string
    updated_at: string
  }>({
    query: `
      SELECT
        ds.name,
        encode(digest(ds.decrypted_secret::bytea, 'sha256'), 'hex') AS digest,
        ds.updated_at::text AS updated_at
      FROM vault.decrypted_secrets ds
      WHERE ds.description = 'edge_function_secret'
      ORDER BY ds.name ASC
    `,
  })

  if (error) {
    return res.status(500).json({ error: { message: error.message } })
  }

  const secrets = (data ?? []).map((row) => ({
    name: row.name,
    value: row.digest,
    updated_at: row.updated_at,
  }))

  return res.status(200).json(secrets)
}

/**
 * POST /api/v1/projects/[ref]/secrets
 * Creates or updates secrets. Body is an array of { name, value }.
 * If a secret with the same name already exists, it is updated (upsert).
 */
const handlePost = async (req: NextApiRequest, res: NextApiResponse) => {
  const secrets: { name: string; value: string }[] = req.body

  if (!Array.isArray(secrets) || secrets.length === 0) {
    return res
      .status(400)
      .json({ error: { message: 'Request body must be a non-empty array of { name, value }' } })
  }

  for (const secret of secrets) {
    if (!secret.name || typeof secret.name !== 'string') {
      return res
        .status(400)
        .json({ error: { message: 'Each secret must have a non-empty "name" string' } })
    }
    if (secret.name.startsWith('SUPABASE_')) {
      return res.status(400).json({
        error: {
          message: `Secret name must not start with the SUPABASE_ prefix: ${secret.name}`,
        },
      })
    }
    if (!secret.value || typeof secret.value !== 'string') {
      return res
        .status(400)
        .json({ error: { message: `Each secret must have a non-empty "value" string` } })
    }
  }

  for (const secret of secrets) {
    // Check if the secret already exists
    const { data: existing, error: lookupError } = await executeQuery<{ id: string }>({
      query: `SELECT id::text FROM vault.secrets WHERE name = $1 AND description = 'edge_function_secret'`,
      parameters: [secret.name],
    })

    if (lookupError) {
      return res.status(500).json({ error: { message: lookupError.message } })
    }

    if (existing && existing.length > 0) {
      // Update the existing secret
      const { error: updateError } = await executeQuery({
        query: `SELECT vault.update_secret($1::uuid, $2, $3)`,
        parameters: [existing[0].id, secret.value, secret.name],
      })

      if (updateError) {
        return res.status(500).json({ error: { message: updateError.message } })
      }
    } else {
      // Create a new secret
      const { error: createError } = await executeQuery({
        query: `SELECT vault.create_secret($1, $2, 'edge_function_secret')`,
        parameters: [secret.value, secret.name],
      })

      if (createError) {
        return res.status(500).json({ error: { message: createError.message } })
      }
    }
  }

  return res.status(201).json({})
}

/**
 * DELETE /api/v1/projects/[ref]/secrets
 * Deletes secrets by name. Body is an array of secret name strings.
 */
const handleDelete = async (req: NextApiRequest, res: NextApiResponse) => {
  const secretNames: string[] = req.body

  if (!Array.isArray(secretNames) || secretNames.length === 0) {
    return res
      .status(400)
      .json({ error: { message: 'Request body must be a non-empty array of secret name strings' } })
  }

  for (const name of secretNames) {
    if (typeof name !== 'string' || !name) {
      return res.status(400).json({ error: { message: 'Each element must be a non-empty string' } })
    }
  }

  // Build parameterized query for deleting multiple secrets
  const placeholders = secretNames.map((_, i) => `$${i + 1}`).join(', ')
  const { error } = await executeQuery({
    query: `DELETE FROM vault.secrets WHERE name IN (${placeholders}) AND description = 'edge_function_secret'`,
    parameters: secretNames,
  })

  if (error) {
    return res.status(500).json({ error: { message: error.message } })
  }

  return res.status(200).json({})
}
