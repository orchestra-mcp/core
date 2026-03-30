import { useCallback, useEffect, useLayoutEffect, useRef } from 'react'

const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect

export const useStaticEffectEvent = <Callback extends Function>(callback: Callback) => {
  const callbackRef = useRef(callback)

  useIsomorphicLayoutEffect(() => {
    callbackRef.current = callback
  })

  const eventFn = useCallback((...args: any) => {
    return callbackRef.current(...args)
  }, [])

  return eventFn as unknown as Callback
}
