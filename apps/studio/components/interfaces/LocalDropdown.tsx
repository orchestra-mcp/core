import { ProfileImage } from 'components/ui/ProfileImage'
import { ORCH_AUTH_ENABLED, useOrchAuth } from 'lib/orch-auth'
import { Command, FlaskConical, LogOut, Settings } from 'lucide-react'
import { useTheme } from 'next-themes'
import Link from 'next/link'
import {
  Button,
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  singleThemes,
  Theme,
} from 'ui'
import { useSetCommandMenuOpen } from 'ui-patterns'

import { useFeaturePreviewModal } from './App/FeaturePreview/FeaturePreviewContext'

export const LocalDropdown = ({
  triggerClassName,
  contentClassName,
}: {
  triggerClassName?: string
  contentClassName?: string
}) => {
  const { theme, setTheme } = useTheme()
  const setCommandMenuOpen = useSetCommandMenuOpen()
  const { toggleFeaturePreviewModal } = useFeaturePreviewModal()
  const { user, isAuthenticated, signOut } = useOrchAuth()

  const avatarUrl = user?.user_metadata?.avatar_url as string | undefined
  const displayName =
    (user?.user_metadata?.full_name as string | undefined) ||
    (user?.user_metadata?.name as string | undefined) ||
    user?.email
  const email = user?.email

  const handleLogout = () => {
    // Use server-side logout that clears all storage and redirects
    window.location.href = '/api/orch-auth/logout'
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={cn('border flex-shrink-0 px-3', triggerClassName)} asChild>
        <Button
          type="default"
          className="[&>span]:flex px-0 py-0 rounded-full overflow-hidden h-8 w-8"
        >
          <ProfileImage
            alt={displayName}
            src={avatarUrl}
            className="w-8 h-8 rounded-md"
          />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="bottom" align="end" className={cn('w-52', contentClassName)}>
        {ORCH_AUTH_ENABLED && isAuthenticated && (
          <>
            <div className="px-2 py-1 flex flex-col gap-0 text-sm">
              {displayName && (
                <span
                  title={displayName}
                  className="w-full text-left text-foreground truncate"
                >
                  {displayName}
                </span>
              )}
              {email && email !== displayName && (
                <span
                  title={email}
                  className="w-full text-left text-foreground-light text-xs truncate"
                >
                  {email}
                </span>
              )}
            </div>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuGroup>
          {ORCH_AUTH_ENABLED && isAuthenticated && (
            <DropdownMenuItem className="flex gap-2 cursor-pointer" asChild>
              <Link href="/account/me">
                <Settings size={14} strokeWidth={1.5} className="text-foreground-lighter" />
                Profile
              </Link>
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            className="flex gap-2 cursor-pointer"
            onClick={() => toggleFeaturePreviewModal(true)}
            onSelect={() => toggleFeaturePreviewModal(true)}
          >
            <FlaskConical size={14} strokeWidth={1.5} className="text-foreground-lighter" />
            Feature previews
          </DropdownMenuItem>
          <DropdownMenuItem
            className="flex gap-2 cursor-pointer"
            onClick={() => setCommandMenuOpen(true)}
          >
            <Command size={14} strokeWidth={1.5} className="text-foreground-lighter" />
            Command menu
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel>Theme</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={theme}
            onValueChange={(value) => {
              setTheme(value)
            }}
          >
            {singleThemes.map((theme: Theme) => (
              <DropdownMenuRadioItem
                key={theme.value}
                value={theme.value}
                className="cursor-pointer"
              >
                {theme.name}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
        {ORCH_AUTH_ENABLED && isAuthenticated && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem
                className="flex gap-2 cursor-pointer text-destructive-600"
                onSelect={handleLogout}
              >
                <LogOut size={14} strokeWidth={1.5} />
                Log out
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
