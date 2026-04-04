'use client'

import { Bell } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

import { AppDrawer } from '@/components/app/AppDrawer'
import { useDashboardAuth } from '@/components/app/DashboardAuthContext'
import { NotificationPanel } from '@/components/notifications/NotificationPanel'
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

export function NotificationBell() {
  const { userId } = useDashboardAuth()
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

  const markRead = async (id: string) => {
    const j = await patchNotifications({ notificationId: id })
    if (typeof j.unreadCount === 'number') setUnreadCount(j.unreadCount)
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)))
  }

  const markAll = async () => {
    const j = await patchNotifications({ markAll: true })
    if (typeof j.unreadCount === 'number') setUnreadCount(j.unreadCount)
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
            'relative flex h-9 w-9 items-center justify-center rounded-xl border transition',
            'border-[var(--border-default)] bg-[var(--surface-card-muted)] text-[var(--text-primary)]',
            'hover:bg-[var(--surface-card)]',
            'lg:border-[color:color-mix(in_srgb,var(--text-on-accent)_35%,transparent)] lg:bg-[color:color-mix(in_srgb,var(--text-on-accent)_16%,transparent)] lg:text-[var(--text-on-accent)] lg:hover:bg-[color:color-mix(in_srgb,var(--text-on-accent)_24%,transparent)]',
            unreadCount > 0 && 'animate-pulse ring-2 ring-[color:color-mix(in_srgb,var(--danger-text)_35%,transparent)]',
          )}
          aria-label="Notificări"
          aria-expanded={open}
        >
          <Bell className="h-5 w-5" strokeWidth={2} />
          {unreadCount > 0 ? (
            <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full border border-[var(--danger-border)] bg-[var(--danger-bg)] px-1 text-[10px] font-bold text-[var(--danger-text)]">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          ) : null}
        </button>

        {open && isMd ? (
          <div
            ref={panelRef}
            className="absolute right-0 top-full z-[80] mt-2 w-[380px] max-h-[min(480px,80vh)] overflow-hidden rounded-2xl border border-[var(--border-default)] bg-[var(--surface-card)] shadow-[var(--shadow-elevated)]"
          >
            <NotificationPanel
              notifications={notifications}
              loading={loading}
              onMarkAllRead={markAll}
              onMarkRead={markRead}
              onClose={() => setOpen(false)}
            />
          </div>
        ) : null}
      </div>

      {!isMd ? (
        <AppDrawer
          open={open && !isMd}
          onOpenChange={setOpen}
          title="Notificări"
          showHandle
          contentClassName="!max-h-[85dvh] !w-full max-w-full p-0 sm:!max-w-lg"
        >
          <NotificationPanel
            notifications={notifications}
            loading={loading}
            onMarkAllRead={markAll}
            onMarkRead={markRead}
            onClose={() => setOpen(false)}
            onItemNavigate={() => setOpen(false)}
          />
        </AppDrawer>
      ) : null}
    </>
  )
}
