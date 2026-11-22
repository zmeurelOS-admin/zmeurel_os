'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  Banknote,
  BarChart3,
  CalendarClock,
  Check,
  ClipboardList,
  CloudLightning,
  FileText,
  FlaskConical,
  Info,
  Mail,
  RefreshCw,
  SlidersHorizontal,
  Snowflake,
  Tag,
  Timer,
  Truck,
  Users,
} from 'lucide-react'

import { AppShell } from '@/components/app/AppShell'
import { useDashboardAuth } from '@/components/app/DashboardAuthContext'
import { Button, Notice, Segments, kitFocus, kitText } from '@/components/kit'
import { IconBadge, ScreenBody, ScreenHeader, type IconTone } from '@/components/setari/SetariUi'
import { getNotificationHref } from '@/lib/notifications/navigation'
import { unreadNotificationsQueryKey } from '@/lib/notifications/useUnreadCount'
import { cn } from '@/lib/utils'
import type { Database } from '@/types/supabase'

import { groupNotificationsByDay, notificationTimeLabel } from './group'

type Row = Database['public']['Tables']['notifications']['Row']
type Filter = 'toate' | 'necitite'

const PAGE = 50

function iconForType(type: string): { icon: ReactNode; tone: IconTone } {
  if (type === 'meteo_grindina') return { icon: <CloudLightning />, tone: 'warning' }
  if (type.startsWith('meteo_')) return { icon: <Snowflake />, tone: 'warning' }
  switch (type) {
    case 'comenzi_maine':
      return { icon: <CalendarClock />, tone: 'info' }
    case 'incasari_restante':
      return { icon: <Banknote />, tone: 'warning' }
    case 'order_new':
      return { icon: <ClipboardList />, tone: 'primary' }
    case 'order_status_changed':
      return { icon: <RefreshCw />, tone: 'primary' }
    case 'butasi_delivery_reminder':
      return { icon: <Truck />, tone: 'info' }
    case 'weekly_sales_summary':
      return { icon: <BarChart3 />, tone: 'neutral' }
    case 'tratament_reminder':
      return { icon: <Timer />, tone: 'warning' }
    case 'analize_memento':
      return { icon: <FlaskConical />, tone: 'warning' }
    case 'legal_docs_expiring':
    case 'legal_docs_expired':
      return { icon: <FileText />, tone: 'warning' }
    case 'product_listed':
    case 'product_unlisted':
      return { icon: <Tag />, tone: 'neutral' }
    case 'producer_approved':
    case 'producer_suspended':
      return { icon: <Users />, tone: 'neutral' }
    case 'offer_new':
    case 'offer_approved':
    case 'offer_rejected':
      return { icon: <Mail />, tone: 'neutral' }
    default:
      return { icon: <Info />, tone: 'neutral' }
  }
}

async function patchNotifications(body: { notificationId: string } | { markAll: true }) {
  const response = await fetch('/api/notifications', {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', Origin: window.location.origin },
    body: JSON.stringify(body),
  })
  return (await response.json().catch(() => ({}))) as { ok?: boolean; unreadCount?: number }
}

function NotificationRow({ notification, onOpen }: { notification: Row; onOpen: (row: Row) => void }) {
  const unread = !notification.read
  const { icon, tone } = iconForType(notification.type)
  return (
    <button
      type="button"
      onClick={() => onOpen(notification)}
      className={cn(
        'flex min-h-[72px] w-full items-start gap-3 rounded-box border px-3 py-2.5 text-left active:bg-surface-muted',
        kitFocus,
        unread ? 'border-border-strong bg-primary-soft/40' : 'border-border bg-surface',
      )}
    >
      <IconBadge tone={tone} size="lg">
        {icon}
      </IconBadge>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex items-baseline gap-2">
          <span className={cn('min-w-0 flex-1 text-fg', kitText.base, unread ? 'font-extrabold' : 'font-semibold')}>
            {notification.title}
          </span>
          <span className={cn('shrink-0 text-fg-subtle', kitText.helper)}>{notificationTimeLabel(notification.created_at)}</span>
        </span>
        {notification.body ? (
          <span className={cn('line-clamp-3 text-fg-muted', kitText.secondary)}>{notification.body}</span>
        ) : null}
      </span>
      {unread ? (
        <span className="mt-2 size-2.5 shrink-0 rounded-full bg-primary">
          <span className="sr-only">Necitită</span>
        </span>
      ) : null}
    </button>
  )
}

export function NotificariPageClient() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { associationRole } = useDashboardAuth()
  const [filter, setFilter] = useState<Filter>('toate')
  const [items, setItems] = useState<Row[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [nextOffset, setNextOffset] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [markingAll, setMarkingAll] = useState(false)

  const loadPage = useCallback(
    async (offset: number, append: boolean) => {
      const params = new URLSearchParams({
        limit: String(PAGE),
        offset: String(offset),
        unread_only: filter === 'necitite' ? 'true' : 'false',
      })
      const response = await fetch(`/api/notifications?${params}`, { credentials: 'include' })
      const json = (await response.json().catch(() => null)) as { ok?: boolean; notifications?: Row[]; unreadCount?: number } | null
      if (!response.ok || !json?.ok || !json.notifications) {
        throw new Error('Nu am putut încărca notificările. Verifică internetul și încearcă din nou.')
      }
      const batch = json.notifications
      setItems((previous) => (append ? [...previous, ...batch] : batch))
      if (typeof json.unreadCount === 'number') setUnreadCount(json.unreadCount)
      setHasMore(batch.length === PAGE)
      setNextOffset(offset + batch.length)
    },
    [filter],
  )

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    loadPage(0, false)
      .catch((cause: unknown) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : 'Nu am putut încărca notificările.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [loadPage])

  const syncUnread = (count: number | undefined) => {
    if (typeof count === 'number') {
      setUnreadCount(count)
      queryClient.setQueryData(unreadNotificationsQueryKey, count)
    } else {
      void queryClient.invalidateQueries({ queryKey: unreadNotificationsQueryKey })
    }
  }

  const loadMore = async () => {
    if (!hasMore || loadingMore) return
    setLoadingMore(true)
    try {
      await loadPage(nextOffset, true)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Nu am putut încărca notificările.')
    } finally {
      setLoadingMore(false)
    }
  }

  // Atingerea: marchează citit și duce unde ducea și înainte (aceeași destinație ca în clopoțel).
  const openRow = (row: Row) => {
    if (!row.read) {
      setItems((previous) => previous.map((item) => (item.id === row.id ? { ...item, read: true } : item)))
      setUnreadCount((count) => Math.max(0, count - 1))
      void patchNotifications({ notificationId: row.id }).then((json) => syncUnread(json.unreadCount))
    }
    const href = getNotificationHref(row, associationRole ?? null)
    if (href !== '/notificari') router.push(href)
  }

  const markAll = async () => {
    setMarkingAll(true)
    try {
      const json = await patchNotifications({ markAll: true })
      setItems((previous) =>
        filter === 'necitite' ? [] : previous.map((item) => ({ ...item, read: true })),
      )
      setHasMore(false)
      syncUnread(json.unreadCount ?? 0)
    } finally {
      setMarkingAll(false)
    }
  }

  const sections = useMemo(() => groupNotificationsByDay(items), [items])
  const empty = !loading && !error && items.length === 0

  const settingsButton = (
    <Link
      href="/notificari/setari"
      aria-label="Ce notificări primești"
      className={cn(
        'flex size-touch items-center justify-center rounded-box border border-border-strong bg-surface text-fg active:bg-surface-muted',
        kitFocus,
      )}
    >
      <SlidersHorizontal className="size-[22px]" aria-hidden />
    </Link>
  )

  return (
    <AppShell header={<ScreenHeader title="Notificări" backHref="/mai-mult" right={settingsButton} />}>
      <ScreenBody className="space-y-2">
        <Segments<Filter>
          aria-label="Ce notificări arăt"
          value={filter}
          onValueChange={setFilter}
          panelId="lista-notificari"
          options={[
            { value: 'toate', label: 'Toate' },
            { value: 'necitite', label: 'Necitite', count: unreadCount > 0 ? unreadCount : undefined },
          ]}
        />

        <div id="lista-notificari" role="tabpanel" className="space-y-1.5 pt-1">
          {error ? <Notice tone="danger" title={error} /> : null}

          {loading ? (
            <div className="space-y-1.5" aria-busy="true" aria-label="Se încarcă notificările">
              {[0, 1, 2].map((index) => (
                <div key={index} className="h-[72px] animate-pulse rounded-box bg-surface-muted" />
              ))}
            </div>
          ) : null}

          {empty ? (
            <div className="flex flex-col items-center gap-2.5 px-6 pt-14 text-center">
              <IconBadge tone="primary" className="size-16 rounded-card [&_svg]:size-8">
                <Check strokeWidth={2.4} />
              </IconBadge>
              <p className={cn('font-bold text-fg', kitText.card)}>Le-ai citit pe toate</p>
              <p className={cn('text-fg-muted', kitText.secondary)}>Când apare ceva nou, îl vezi aici și pe telefon.</p>
            </div>
          ) : null}

          {!loading
            ? sections.map((section) => (
                <section key={section.title} className="space-y-1.5">
                  <h2 className={cn('pb-0.5 pt-2 font-bold text-fg-muted', kitText.secondary)}>{section.title}</h2>
                  {section.items.map((row) => (
                    <NotificationRow key={row.id} notification={row} onOpen={openRow} />
                  ))}
                </section>
              ))
            : null}

          {!loading && hasMore ? (
            <Button type="button" variant="quiet" size="touch" className="w-full" loading={loadingMore} onClick={() => void loadMore()}>
              Arată mai vechi
            </Button>
          ) : null}
        </div>

        {unreadCount > 0 && !loading ? (
          <div className="sticky bottom-[calc(var(--app-nav-clearance)+12px)] bg-page pt-2 md:bottom-4">
            <Button type="button" variant="neutral" size="touch" className="w-full" loading={markingAll} onClick={() => void markAll()}>
              Marchează toate ca citite
            </Button>
          </div>
        ) : null}
      </ScreenBody>
    </AppShell>
  )
}
