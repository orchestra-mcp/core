'use client'

import { QueryClientProvider as QueryClientProviderPrimitive } from '@tanstack/react-query'
import { useRootQueryClient } from '~/lib/fetch/queryClient'
import { type PropsWithChildren } from 'react'

const QueryClientProvider = ({ children }: PropsWithChildren) => {
  const queryClient = useRootQueryClient()

  return (
    <QueryClientProviderPrimitive client={queryClient}>{children}</QueryClientProviderPrimitive>
  )
}

export { QueryClientProvider }
