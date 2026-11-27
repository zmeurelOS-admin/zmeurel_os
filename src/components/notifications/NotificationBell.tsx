'use client'

import { Bell } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

import { useQueryClient } from '@tanstack/react-query'

import { useDashboardAuth } from '@/components/app/DashboardAuthContext'
import { BottomSheet, kitFocus } from '@/components/kit'
import { NotificationPanel } from '@/components/notifications/NotificationPanel'
import { unreadNotificationsQueryKey } from '@/lib/notifications/useUnreadCount'
import { getSupabase } from '@/lib/supabase/client'
import type { Database } from '@/types/supabase'
import { cn } from '@/lib/utils'

type NotificationRow = Database['public']['Tables']['notifications']['Row']

async function patchNotifications(body: { notificationId: string } | { markAll: true }) {
  const res = await fetch('/api/notifications', {
    method: 'PATCH',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(typeof window !== 'undefined' ? { Origin: window.location.origin } : {}),
    },
    body: JSON.stringify(body),
  })
  const j = (await res.json()) as { ok?: boolean; unreadCount?: number }
  return j
}

/**
 * Clopoțelul din antet (promptul 33, pe kit). Pe telefon deschide o foaie de jos (`BottomSheet`, titlul „Notificări” o
 * singură dată, în antetul foii); pe desktop, o fereastră mică sub clopoțel. Corpul e `NotificationPanel`.
 */
/**
 * `deschidere`: încotro se deschide fereastra pe desktop. Implicit spre stânga (clopoțelul din antet, la dreapta);
 * în bara laterală (promptul 34, §10), spre dreapta.
 */
export function NotificationBell({ deschidere = 'stanga' }: { deschidere?: 'stanga' | 'dreapta' } = {}) {
  const { userId } = useDashboardAuth()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [isMd, setIsMd] = useState(true)
  const [unreadCount, setUnreadCount] = useState(0)
  const [notifications, setNotifications] = useState<NotificationRow[]>([])
  const [loading, setLoading] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)

  const refresh = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    try {
      const r = await fetch('/api/notifications?limit=20&offset=0', { credentials: 'include' })
      const j = (await r.json()) as {
        ok?: boolean
        notifications?: NotificationRow[]
        unreadCount?: number
      }
      if (j.ok && j.notifications) {
        setNotifications(j.notifications)
        if (typeof j.unreadCount === 'number') setUnreadCount(j.unreadCount)
      }
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)')
    setIsMd(mq.matches)
    const fn = () => setIsMd(mq.matches)
    mq.addEventListener('change', fn)
    return () => mq.removeEventListener('change', fn)
  }, [])

  useEffect(() => {
    if (!userId) return
    const supabase = getSupabase()
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload: { new: Record<string, unknown> }) => {
          const row = payload.new as NotificationRow
          if (!row?.id) return
          setUnreadCount((c) => c + 1)
          setNotifications((prev) => {
            if (prev.some((p) => p.id === row.id)) return prev
            return [row, ...prev].slice(0, 20)
          })
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [userId])

  useEffect(() => {
    if (!open || !isMd) return
    const onDown = (e: MouseEvent) => {
      if (panelRef.current?.contains(e.target as Node)) return
      if (btnRef.current?.contains(e.target as Node)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open, isMd])

  // Numărul de necitite e și în bara de jos / Mai mult (`useUnreadCount`): îl ținem la fel.
  const syncUnread = (count: number | undefined) => {
    if (typeof count !== 'number') return
    setUnreadCount(count)
    queryClient.setQueryData(unreadNotificationsQueryKey, count)
  }

  const markRead = async (id: string) => {
    const j = await patchNotifications({ notificationId: id })
    syncUnread(j.unreadCount)
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)))
  }

  const markAll = async () => {
    const j = await patchNotifications({ markAll: true })
    syncUnread(j.unreadCount ?? 0)
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
  }

  const toggle = () => {
    setOpen((o) => !o)
    void refresh()
  }

  if (!userId) return null

  return (
    <>
      <div className="relative">
        <button
          ref={btnRef}
          type="button"
          onClick={toggle}
          className={cn(
            'relative flex size-touch items-center justify-center rounded-box border transition',
            'border-border bg-surface-muted text-fg hover:bg-surface',
            kitFocus,
          )}
          aria-label={unreadCount > 0 ? `Notificări, ${unreadCount} necitite` : 'Notificări'}
          aria-expanded={open}
        >
          <Bell className="size-5" strokeWidth={2} aria-hidden />
          {unreadCount > 0 ? (
            <span
              aria-hidden
              className="absolute -right-1.5 -top-1.5 flex h-6 min-w-6 items-center justify-center rounded-full border border-danger-border bg-danger-bg px-1 text-[13px] font-bold leading-none text-danger-text"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          ) : null}
        </button>

        {open && isMd ? (
          <div
            ref={panelRef}
            className={cn(
              'absolute top-full z-popover mt-2 flex max-h-[min(560px,80vh)] w-[400px] flex-col overflow-hidden rounded-card border border-border bg-surface p-3 shadow-2',
              deschidere === 'dreapta' ? 'left-0' : 'right-0',
            )}
          >
            <NotificationPanel
              notifications={notifications}
              loading={loading}
              onMarkAllRead={markAll}
              onMarkRead={markRead}
              onClose={() => setOpen(false)}
              cuTitlu
            />
          </div>
        ) : null}
      </div>

      {!isMd ? (
        <BottomSheet open={open} onOpenChange={setOpen} title="Notificări">
          <NotificationPanel
            notifications={notifications}
            loading={loading}
            onMarkAllRead={markAll}
            onMarkRead={markRead}
            onClose={() => setOpen(false)}
            onItemNavigate={() => setOpen(false)}
          />
        </BottomSheet>
      ) : null}
    </>
  )
}
