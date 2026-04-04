"use client"

import { useSyncExternalStore } from "react"

function subscribe(query: string, onStoreChange: () => void) {
  if (typeof window === "undefined") {
    return () => {}
  }

  const media = window.matchMedia(query)
  media.addEventListener("change", onStoreChange)

  return () => media.removeEventListener("change", onStoreChange)
}

function getSnapshot(query: string) {
  if (typeof window === "undefined") return false
  return window.matchMedia(query).matches
}

function getServerSnapshot() {
  return false
}

export function useMediaQuery(query: string) {
  return useSyncExternalStore(
    (onStoreChange) => subscribe(query, onStoreChange),
    () => getSnapshot(query),
    getServerSnapshot,
  )
}
