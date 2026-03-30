'use client'

import { API_URL } from '~/lib/constants'
import { IS_PLATFORM, PageTelemetry } from 'common'
import { useConsentToast } from 'ui-patterns/consent'

interface ConsentWrapperProps {
  children: React.ReactNode
}

export function ConsentWrapper({ children }: ConsentWrapperProps) {
  const { hasAcceptedConsent } = useConsentToast()

  return (
    <>
      {children}
      <PageTelemetry
        API_URL={API_URL}
        hasAcceptedConsent={hasAcceptedConsent}
        enabled={IS_PLATFORM}
      />
    </>
  )
}
