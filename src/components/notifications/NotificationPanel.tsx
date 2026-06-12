'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback } from 'react'

import { formatRelativeRo } from '@/lib/notifications/format'
import { getNotificationHref } from '@/lib/notifications/navigation'
import type { Database } from '@/types/supabase'
import { cn } from '@/lib/utils'

import { useDashboardAuth } from '@/components/app/DashboardAuthContext'

type NotificationRow = Database['public']['Tables']['notifications']['Row']

function iconForType(type: string): string {
  switch (type) {
    case 'order_new':
      return '📦'
    case 'order_status_changed':
      return '🔄'
    case 'product_listed':
      return '✅'
    case 'product_unlisted':
      return '❌'
    case 'producer_approved':
      return '✅'
    case 'producer_suspended':
      return '⏸️'
    case 'offer_new':
      return '📨'
    case 'offer_approved':
      return '✅'
    case 'offer_rejected':
      return '❌'
    case 'weekly_sales_summary':
      return '🧾'
    case 'tratament_reminder':
      return '🌿'
    case 'system':
      return '🔔'
    default:
      return '📌'
  }
}

export type NotificationPanelProps = {
  notifications: NotificationRow[]
  loading?: boolean
  onMarkAllRead: () => Promise<void>
  onMarkRead: (id: string) => Promise<void>
  onClose: () => void
  onItemNavigate?: () => void
  /** Dacă true, ascunde footer-ul „Vezi toate” (pagina dedicată) */
  hideFooterLink?: boolean
}

export function NotificationPanel({
  notifications,
  loading,
  onMarkAllRead,
  onMarkRead,
  onClose,
  onItemNavigate,
  hideFooterLink,
}: NotificationPanelProps) {
  const { associationRole } = useDashboardAuth()
  const router = useRouter()
  const unreadCount = notifications.filter((notification) => !notification.read).length
  const readCount = notifications.length - unreadCount
  const unreadLabel = unreadCount === 1 ? '1 necitită' : `${unreadCount} necitite`
  const readLabel = readCount === 1 ? '1 citită' : `${readCount} citite`

  const handleRowClick = useCallback(
    async (n: NotificationRow) => {
      await onMarkRead(n.id)
      const href = getNotificationHref(n, associationRole ?? null)
      onItemNavigate?.()
      onClose()
      router.push(href)
    },
    [associationRole, onClose, onItemNavigate, onMarkRead, router],
  )

  return (
    <div className="flex max-h-[min(480px,70dvh)] flex-col">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[var(--border-default)] px-4 py-3">
        <div className="min-w-0">
          <h2 className="text-sm font-bold text-[var(--text-primary)]">Notificări</h2>
          <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">
            {unreadLabel} · {readLabel}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void onMarkAllRead()}
          className="text-xs font-semibold text-[var(--primary)] hover:underline"
        >
          Marchează toate ca citite
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {loading ? (
          <p className="px-4 py-8 text-center text-sm text-[var(--text-secondary)]">Se încarcă…</p>
        ) : notifications.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-[var(--text-secondary)]">Nicio notificare.</p>
        ) : (
          <ul className="divide-y divide-[var(--divider)]">
            {notifications.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => void handleRowClick(n)}
                  className={cn(
                    'flex w-full gap-3 border-l-4 border-l-transparent px-4 py-3 text-left transition hover:bg-[var(--surface-card-muted)]',
                    !n.read &&
                      'border-l-[var(--primary)] bg-[color:color-mix(in_srgb,var(--primary)_6%,transparent)]',
                  )}
                >
                  <span className="shrink-0 text-xl leading-none" aria-hidden>
                    {iconForType(n.type)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p
                        className={cn(
                          'min-w-0 text-sm',
                          n.read
                            ? 'font-medium text-[var(--text-muted)]'
                            : 'font-bold text-[var(--text-primary)]',
                        )}
                      >
                        {n.title}
                      </p>
                      {!n.read ? (
                        <span
                          className="mt-1 size-2 shrink-0 rounded-full bg-[var(--primary)]"
                          data-unread-indicator
                          aria-hidden
                        />
                      ) : null}
                    </div>
                    {n.body ? (
                      <p
                        className={cn(
                          'mt-0.5 line-clamp-2 text-xs',
                          n.read
                            ? 'text-[var(--text-muted)] opacity-70'
                            : 'text-[var(--text-secondary)]',
                        )}
                      >
                        {n.body}
                      </p>
                    ) : null}
                    <p
                      className={cn(
                        'mt-1 text-[11px]',
                        n.read
                          ? 'text-[var(--text-muted)]'
                          : 'font-medium text-[var(--primary)]',
                      )}
                    >
                      {formatRelativeRo(n.created_at)}
                    </p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {!hideFooterLink ? (
        <div className="shrink-0 border-t border-[var(--border-default)] px-4 py-3">
          <Link
            href="/notificari"
            className="block text-center text-sm font-semibold text-[var(--primary)] hover:underline"
            onClick={onClose}
          >
            Vezi toate notificările
          </Link>
        </div>
      ) : null}
    </div>
  )
}
