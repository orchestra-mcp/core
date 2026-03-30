'use client'

import type {
  CommandMenuClosedEvent,
  CommandMenuCommandClickedEvent,
  CommandMenuOpenedEvent,
  CommandMenuSearchSubmittedEvent,
} from 'common/telemetry-constants'
import { useCallback } from 'react'

import { useSendTelemetryEvent } from '@/lib/telemetry'

export function useDocsCommandMenuTelemetry() {
  const sendTelemetryEvent = useSendTelemetryEvent()
  const onTelemetry = useCallback(
    (
      event:
        | CommandMenuOpenedEvent
        | CommandMenuClosedEvent
        | CommandMenuCommandClickedEvent
        | CommandMenuSearchSubmittedEvent
    ) => {
      sendTelemetryEvent(event)
    },
    [sendTelemetryEvent]
  )

  return { onTelemetry }
}
