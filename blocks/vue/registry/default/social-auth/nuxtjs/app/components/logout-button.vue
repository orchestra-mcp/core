<script setup lang="ts">
import { useRouter } from 'vue-router'

import { Button } from '@/components/ui/button.vue'
import { createClient } from '@/lib/supabase/client'

const router = useRouter()

const logout = async () => {
  const supabase = createClient()
  await supabase.auth.signOut()
  router.push('/auth/login')
}
</script>

<template>
  <Button @click="logout">Logout</Button>
</template>
