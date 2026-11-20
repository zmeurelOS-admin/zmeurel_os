'use client'

import { useSyncExternalStore } from 'react'

const noopSubscribe = () => () => {}

/** `false` pe server și la hidratare, `true` după (ex. tema din next-themes e știută abia în browser). */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  )
}
