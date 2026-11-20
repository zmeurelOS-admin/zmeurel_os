'use client'

import { useQuery } from '@tanstack/react-query'

export const unreadNotificationsQueryKey = ['notifications', 'unread-count'] as const

/** Numărul de necitite, din aceeași sursă ca clopoțelul (`GET /api/notifications` → `unreadCount`). */
export async function fetchUnreadNotificationsCount(): Promise<number> {
  const response = await fetch('/api/notifications?limit=1&offset=0', { credentials: 'include' })
  const json = (await response.json().catch(() => null)) as { ok?: boolean; unreadCount?: number } | null
  if (!response.ok || !json?.ok) throw new Error('Nu am putut citi notificările.')
  return typeof json.unreadCount === 'number' ? json.unreadCount : 0
}

export function useUnreadNotificationsCount(enabled = true) {
  return useQuery({
    queryKey: unreadNotificationsQueryKey,
    queryFn: fetchUnreadNotificationsCount,
    enabled,
    staleTime: 30_000,
    refetchOnMount: 'always',
    refetchOnWindowFocus: false,
    retry: 1,
  })
}
