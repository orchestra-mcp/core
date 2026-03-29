import { useParams } from 'common'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import { Copy, Key, MoreVertical, ShieldOff } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  Button,
  Card,
  CardContent,
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Skeleton,
} from 'ui'
import ConfirmationModal from 'ui-patterns/Dialogs/ConfirmationModal'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from 'ui/src/components/shadcn/ui/table'

import { useRevokeOrchestraTokenMutation } from '@/data/orchestra/orchestra-token-revoke-mutation'
import {
  OrchestraToken,
  useOrchestraTokensQuery,
} from '@/data/orchestra/orchestra-tokens-query'

dayjs.extend(relativeTime)

const tableHeaderClass = 'text-left font-mono uppercase text-xs text-foreground-lighter py-2'

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

const RowLoading = () => (
  <TableRow>
    <TableCell>
      <div className="space-y-1.5">
        <Skeleton className="w-40 h-4 rounded-full" />
        <Skeleton className="w-28 h-3 rounded-full" />
      </div>
    </TableCell>
    <TableCell>
      <Skeleton className="w-24 h-4 rounded-full" />
    </TableCell>
    <TableCell>
      <Skeleton className="w-20 h-4 rounded-full" />
    </TableCell>
    <TableCell>
      <Skeleton className="w-4 h-4 rounded-md" />
    </TableCell>
  </TableRow>
)

interface TokenNameCellProps {
  name: string
  prefix: string
  isRevoked: boolean
}

const TokenNameCell = ({ name, prefix, isRevoked }: TokenNameCellProps) => (
  <TableCell className="w-auto max-w-96">
    <p className={cn('truncate', isRevoked ? 'text-foreground-lighter line-through' : 'text-foreground')} title={name}>
      {name}
    </p>
    <p
      className="font-mono text-foreground-lighter truncate text-xs mt-1 max-w-32 sm:max-w-48 lg:max-w-full"
      title={`orch_${prefix}...`}
    >
      orch_{prefix}...
    </p>
  </TableCell>
)

interface LastUsedCellProps {
  lastUsedAt: string | null
}

const LastUsedCell = ({ lastUsedAt }: LastUsedCellProps) => (
  <TableCell className="text-foreground-light min-w-28">
    {lastUsedAt ? (
      <p className="text-sm" title={dayjs(lastUsedAt).format('DD MMM YYYY, HH:mm')}>
        {dayjs(lastUsedAt).fromNow()}
      </p>
    ) : (
      <p className="text-foreground-lighter text-sm">Never used</p>
    )}
  </TableCell>
)

interface CreatedCellProps {
  createdAt: string
  revokedAt: string | null
}

const CreatedCell = ({ createdAt, revokedAt }: CreatedCellProps) => (
  <TableCell className="min-w-28 text-foreground-light">
    {revokedAt ? (
      <p className="text-sm text-destructive-600" title={`Revoked ${dayjs(revokedAt).format('DD MMM YYYY, HH:mm')}`}>
        Revoked
      </p>
    ) : (
      <p className="text-sm" title={dayjs(createdAt).format('DD MMM YYYY, HH:mm')}>
        {dayjs(createdAt).format('DD MMM YYYY')}
      </p>
    )}
  </TableCell>
)

// ---------------------------------------------------------------------------
// Table container (card wrapper matching Supabase style)
// ---------------------------------------------------------------------------

const TokenTableContainer = ({ children }: { children: React.ReactNode }) => (
  <Card className="w-full overflow-hidden">
    <CardContent className="p-0">
      <Table className="p-5 table-auto">
        <TableHeader>
          <TableRow className="bg-200">
            <TableHead className={tableHeaderClass}>Token</TableHead>
            <TableHead className={tableHeaderClass}>Last used</TableHead>
            <TableHead className={tableHeaderClass}>Created</TableHead>
            <TableHead className={cn(tableHeaderClass, '!text-right')} />
          </TableRow>
        </TableHeader>
        <TableBody>{children}</TableBody>
      </Table>
    </CardContent>
  </Card>
)

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export interface OrchestraTokensProps {
  searchString?: string
}

export const OrchestraTokens = ({ searchString = '' }: OrchestraTokensProps) => {
  const { ref } = useParams()
  const [isConfirmOpen, setIsConfirmOpen] = useState(false)
  const [selectedToken, setSelectedToken] = useState<OrchestraToken | undefined>(undefined)

  const { data: tokens, isPending: isLoading } = useOrchestraTokensQuery(
    { projectRef: ref },
    { enabled: !!ref }
  )

  const { mutate: revokeToken } = useRevokeOrchestraTokenMutation()

  // Filter: hide revoked tokens by default unless search matches, then sort
  const filteredTokens = useMemo(() => {
    if (!tokens) return undefined

    const filtered = tokens.filter((token) => {
      const matchesSearch =
        !searchString ||
        token.name.toLowerCase().includes(searchString.toLowerCase()) ||
        token.prefix.toLowerCase().includes(searchString.toLowerCase())

      // Always show active tokens that match search; show revoked only if explicitly searched
      if (token.revoked_at && !searchString) return false
      return matchesSearch
    })

    // Sort: active tokens first, then by created_at desc
    return [...filtered].sort((a, b) => {
      if (a.revoked_at && !b.revoked_at) return 1
      if (!a.revoked_at && b.revoked_at) return -1
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })
  }, [tokens, searchString])

  const handleCopyPrefix = (prefix: string) => {
    navigator.clipboard.writeText(`orch_${prefix}`)
    toast.success('Token prefix copied to clipboard')
  }

  const handleConfirmRevoke = () => {
    if (!ref || !selectedToken) return
    revokeToken(
      { projectRef: ref, tokenId: selectedToken.id },
      {
        onSettled: () => {
          setIsConfirmOpen(false)
          setSelectedToken(undefined)
        },
      }
    )
  }

  // -- Loading state --
  if (isLoading) {
    return (
      <TokenTableContainer>
        <RowLoading />
        <RowLoading />
        <RowLoading />
      </TokenTableContainer>
    )
  }

  // -- Empty state --
  if (!filteredTokens || filteredTokens.length === 0) {
    return (
      <TokenTableContainer>
        <TableRow>
          <TableCell colSpan={4} className="py-12">
            <div className="flex flex-col items-center gap-1">
              <Key size={24} className="text-foreground-lighter mb-2" strokeWidth={1.5} />
              <p className="text-sm text-center text-foreground">No MCP tokens found</p>
              <p className="text-sm text-center text-foreground-light">
                {searchString
                  ? 'No tokens match your search'
                  : 'Generate a token to authenticate MCP connections'}
              </p>
            </div>
          </TableCell>
        </TableRow>
      </TokenTableContainer>
    )
  }

  // -- Token list --
  return (
    <>
      <TokenTableContainer>
        {filteredTokens.map((token) => {
          const isRevoked = !!token.revoked_at
          return (
            <TableRow key={token.id} className={cn(isRevoked && 'opacity-50')}>
              <TokenNameCell name={token.name} prefix={token.prefix} isRevoked={isRevoked} />
              <LastUsedCell lastUsedAt={token.last_used_at} />
              <CreatedCell createdAt={token.created_at} revokedAt={token.revoked_at} />
              <TableCell>
                <div className="flex items-center justify-end gap-x-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="default"
                        title="More options"
                        className="w-7"
                        icon={<MoreVertical />}
                      />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent side="bottom" align="end" className="w-48">
                      <DropdownMenuItem
                        className="gap-x-2"
                        onClick={() => handleCopyPrefix(token.prefix)}
                      >
                        <Copy size={12} />
                        <p>Copy token prefix</p>
                      </DropdownMenuItem>
                      {!isRevoked && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="gap-x-2"
                            onClick={() => {
                              setSelectedToken(token)
                              setIsConfirmOpen(true)
                            }}
                          >
                            <ShieldOff size={12} />
                            <p>Revoke token</p>
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </TableCell>
            </TableRow>
          )
        })}
      </TokenTableContainer>

      <ConfirmationModal
        visible={isConfirmOpen}
        variant="destructive"
        title="Revoke token"
        confirmLabel="Revoke"
        confirmLabelLoading="Revoking"
        onCancel={() => {
          setIsConfirmOpen(false)
          setSelectedToken(undefined)
        }}
        onConfirm={handleConfirmRevoke}
      >
        <p className="py-4 text-sm text-foreground-light">
          This action cannot be undone. Are you sure you want to revoke the token{' '}
          <span className="font-medium text-foreground">"{selectedToken?.name}"</span>? Any
          applications using this token will lose access immediately.
        </p>
      </ConfirmationModal>
    </>
  )
}
