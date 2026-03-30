<script setup lang="ts">
import { computed } from 'vue'

import { useRealtimePresenceRoom } from '../composables/useRealtimePresenceRoom'
// @ts-ignore
import AvatarStack from '@/components/avatar-stack.vue'

const props = defineProps<{
  roomName: string
}>()

const { users: usersMap } = useRealtimePresenceRoom(props.roomName)

const avatars = computed(() =>
  Object.values(usersMap.value).map((user) => ({
    name: user.name,
    image: user.image,
  }))
)
</script>

<template>
  <AvatarStack :avatars="avatars" />
</template>
