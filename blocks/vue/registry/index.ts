import { clients } from './clients'
import { currentUserAvatar } from './current-user-avatar'
import { dropzone } from './dropzone'
import { passwordBasedAuth } from './password-based-auth'
import { realtimeAvatarStack } from './realtime-avatar-stack'
import { realtimeCursor } from './realtime-cursor'
import { socialAuth } from './social-auth'

const blocks = [
  ...clients,
  ...passwordBasedAuth,
  ...socialAuth,
  ...dropzone,
  ...realtimeCursor,
  ...currentUserAvatar,
  ...realtimeAvatarStack,
]

export { blocks }
