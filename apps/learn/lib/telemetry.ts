'use client'

import { sendTelemetryEvent } from 'common'
import { TelemetryEvent } from 'common/telemetry-constants'
import { API_URL } from 'lib/constants'
import { usePathname } from 'next/navigation'
import { useCallback } from 'react'

export function useSendTelemetryEvent() {
  const pathname = usePathname()

  return useCallback(
    (event: TelemetryEvent) => {
      return sendTelemetryEvent(API_URL, event, pathname)
    },
    [pathname]
  )
}
