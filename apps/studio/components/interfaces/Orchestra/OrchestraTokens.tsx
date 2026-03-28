import { useParams } from 'common'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import { useState } from 'react'
import {
  Badge,
  Button,
  cn,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from 'ui'

import { useRevokeOrchestraTokenMutation } from '@/data/orchestra/orchestra-token-revoke-mutation'
import { useOrchestraTokensQuery } from '@/data/orchestra/orchestra-tokens-query'

dayjs.extend(relativeTime)

export const OrchestraTokens = () => {
  const { ref } = useParams()
  const [revokingId, setRevokingId] = useState<string | null>(null)

  const { data: tokens, isPending: isLoading } = useOrchestraTokensQuery(
    { projectRef: ref },
    { enabled: !!ref }
  )

  const { mutate: revokeToken, isPending: isRevoking } = useRevokeOrchestraTokenMutation()

  const handleRevoke = (tokenId: string) => {
    if (!ref) return
    setRevokingId(tokenId)
    revokeToken(
      { projectRef: ref, tokenId },
      { onSettled: () => setRevokingId(null) }
    )
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3 p-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    )
  }

  if (!tokens || tokens.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-foreground-lighter text-sm">
        No MCP tokens found
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Prefix</TableHead>
            <TableHead>User</TableHead>
            <TableHead>Last Used</TableHead>
            <TableHead>Usage Count</TableHead>
            <TableHead>Created</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tokens.map((token) => {
            const isRevoked = !!token.revoked_at
            return (
              <TableRow key={token.id} className={cn(isRevoked && 'opacity-60')}>
                <TableCell className="font-medium">{token.name}</TableCell>
                <TableCell>
                  <code className="text-xs bg-surface-200 px-1.5 py-0.5 rounded">
                    {token.prefix}...
                  </code>
                </TableCell>
                <TableCell className="text-foreground-lighter">
                  {token.user_email ?? token.user_id ?? '--'}
                </TableCell>
                <TableCell className="text-foreground-lighter">
                  {token.last_used_at ? dayjs(token.last_used_at).fromNow() : 'Never'}
                </TableCell>
                <TableCell className="text-foreground-lighter tabular-nums">
                  {token.usage_count.toLocaleString()}
                </TableCell>
                <TableCell className="text-foreground-lighter">
                  {dayjs(token.created_at).format('MMM D, YYYY')}
                </TableCell>
                <TableCell>
                  {isRevoked ? (
                    <Badge variant="destructive">Revoked</Badge>
                  ) : (
                    <Badge variant="brand">Active</Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {!isRevoked && (
                    <Button
                      type="warning"
                      size="tiny"
                      loading={revokingId === token.id && isRevoking}
                      onClick={() => handleRevoke(token.id)}
                    >
                      Revoke
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
