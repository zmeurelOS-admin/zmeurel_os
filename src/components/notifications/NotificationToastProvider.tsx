'use client'

import { X } from 'lucide-react'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useRef } from 'react'
import { toast as sonnerToast } from 'sonner'

import { useDashboardAuth } from '@/components/app/DashboardAuthContext'
import { getNotificationUiConfig } from '@/lib/notifications/config'
import { getNotificationHref } from '@/lib/notifications/navigation'
import { playNotificationSound } from '@/lib/notifications/sound'
import { getSupabase } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import type { Database } from '@/types/supabase'

type NotificationRow = Database['public']['Tables']['notifications']['Row']

const MAX_NOTIFICATION_TOASTS = 3

function truncateBody(text: string | null, max = 100): string {
  if (!text) return ''
  const t = text.trim()
  if (t.length <= max) return t
  return `${t.slice(0, Math.max(0, max - 1))}…`
}

function isNotificationsRoute(pathname: string): boolean {
  const p = pathname.replace(/\/$/, '') || '/'
  return p === '/notificari'
}

export function NotificationToastProvider() {
  const { userId, associationRole } = useDashboardAuth()
  const router = useRouter()
  const pathname = usePathname()
  const pathnameRef = useRef(pathname)
  const toastQueueRef = useRef<string[]>([])

  useEffect(() => {
    pathnameRef.current = pathname
  }, [pathname])

  useEffect(() => {
    if (!userId) return

    const supabase = getSupabase()

    const channel = supabase
      .channel(`notifications-toast:${userId}`)
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

          if (typeof document !== 'undefined' && document.hidden) {
            return
          }

          if (isNotificationsRoute(pathnameRef.current)) {
            return
          }

          const cfg = getNotificationUiConfig(row.type)
          if (!cfg.showToast) {
            playNotificationSound({ type: row.type, playSound: cfg.playSound })
            return
          }

          playNotificationSound({ type: row.type, playSound: cfg.playSound })

          const href = getNotificationHref(row, associationRole ?? null)
          const shortBody = truncateBody(row.body)
          const toastId = row.id

          const queue = toastQueueRef.current
          while (queue.length >= MAX_NOTIFICATION_TOASTS) {
            const oldest = queue.shift()
            if (oldest) {
              sonnerToast.dismiss(oldest)
            }
          }
          queue.push(toastId)

          sonnerToast.custom(
            (tid) => (
              <div
                className={cn(
                  'pointer-events-auto flex w-[min(100vw-2rem,380px)] gap-3 rounded-[12px] border border-[var(--border)] bg-white p-3 pl-4 shadow-[0_12px_40px_rgba(0,0,0,0.12)] dark:border-[var(--border)] dark:bg-[var(--popover)]',
                  'animate-in fade-in slide-in-from-right-2 duration-300',
                )}
                style={{
                  borderLeftWidth: 4,
                  borderLeftStyle: 'solid',
                  borderLeftColor: cfg.color,
                }}
              >
                <span className="text-xl leading-none" aria-hidden>
                  {cfg.icon}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-[var(--foreground)]">{row.title}</p>
                  {shortBody ? (
                    <p className="mt-0.5 line-clamp-2 text-sm text-[var(--muted-foreground)]">{shortBody}</p>
                  ) : null}
                  <div className="mt-2">
                    <button
                      type="button"
                      className="text-sm font-semibold text-[var(--primary)] hover:underline"
                      onClick={() => {
                        router.push(href)
                        sonnerToast.dismiss(tid)
                      }}
                    >
                      Vezi
                    </button>
                  </div>
                </div>
                <button
                  type="button"
                  className="shrink-0 rounded-lg p-1 text-[var(--muted-foreground)] transition hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
                  aria-label="Închide"
                  onClick={() => sonnerToast.dismiss(tid)}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ),
            {
              id: toastId,
              duration: cfg.toastDuration,
              unstyled: true,
              onDismiss: () => {
                toastQueueRef.current = toastQueueRef.current.filter((x) => x !== toastId)
              },
            },
          )
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [userId, associationRole, router])

  return null
}
