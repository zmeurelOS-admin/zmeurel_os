'use client'

import { ChevronDown, ChevronUp, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

import { AppShell } from '@/components/app/AppShell'
import { PageHeader } from '@/components/app/PageHeader'
import { useDashboardAuth } from '@/components/app/DashboardAuthContext'
import { formatRelativeRo } from '@/lib/notifications/format'
import { getNotificationHref } from '@/lib/notifications/navigation'
import { cn } from '@/lib/utils'
import type { Database } from '@/types/supabase'

type Row = Database['public']['Tables']['notifications']['Row']

const PAGE = 50

export function NotificariPageClient() {
  const [filter, setFilter] = useState<'all' | 'unread'>('all')
  const [items, setItems] = useState<Row[]>([])
  const [nextOffset, setNextOffset] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const { associationRole } = useDashboardAuth()
  const router = useRouter()

  const loadPage = useCallback(
    async (offset: number, append: boolean) => {
      const params = new URLSearchParams({
        limit: String(PAGE),
        offset: String(offset),
        unread_only: filter === 'unread' ? 'true' : 'false',
      })
      const r = await fetch(`/api/notifications?${params}`, { credentials: 'include' })
      const j = (await r.json()) as { ok?: boolean; notifications?: Row[] }
      if (!j.ok || !j.notifications) return
      const batch = j.notifications
      if (append) setItems((p) => [...p, ...batch])
      else setItems(batch)
      setHasMore(batch.length === PAGE)
      setNextOffset(offset + batch.length)
    },
    [filter],
  )

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setNextOffset(0)
      await loadPage(0, false)
      if (!cancelled) setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [loadPage])

  const loadMore = async () => {
    if (!hasMore || loadingMore) return
    setLoadingMore(true)
    await loadPage(nextOffset, true)
    setLoadingMore(false)
  }

  const markAll = async () => {
    await fetch('/api/notifications', {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', Origin: window.location.origin },
      body: JSON.stringify({ markAll: true }),
    })
    setItems((p) => p.map((x) => ({ ...x, read: true })))
  }

  const markRead = async (id: string) => {
    await fetch('/api/notifications', {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', Origin: window.location.origin },
      body: JSON.stringify({ notificationId: id }),
    })
    setItems((p) => p.map((x) => (x.id === id ? { ...x, read: true } : x)))
  }

  const remove = async (id: string) => {
    await fetch('/api/notifications', {
      method: 'DELETE',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', Origin: window.location.origin },
      body: JSON.stringify({ notificationId: id }),
    })
    setItems((p) => p.filter((x) => x.id !== id))
  }

  const openRow = (n: Row) => {
    void markRead(n.id)
    router.push(getNotificationHref(n, associationRole ?? null))
  }

  return (
    <AppShell
      header={
        <PageHeader
          title="Notificări"
          subtitle="Toate mesajele importante pentru contul tău"
        />
      }
    >
      <div className="mx-auto max-w-3xl px-4 py-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex rounded-xl border border-[var(--border-default)] p-0.5">
            <button
              type="button"
              onClick={() => setFilter('all')}
              className={cn(
                'rounded-lg px-3 py-1.5 text-sm font-semibold',
                filter === 'all'
                  ? 'bg-[var(--primary)] text-[var(--primary-foreground)]'
                  : 'text-[var(--text-secondary)]',
              )}
            >
              Toate
            </button>
            <button
              type="button"
              onClick={() => setFilter('unread')}
              className={cn(
                'rounded-lg px-3 py-1.5 text-sm font-semibold',
                filter === 'unread'
                  ? 'bg-[var(--primary)] text-[var(--primary-foreground)]'
                  : 'text-[var(--text-secondary)]',
              )}
            >
              Necitite
            </button>
          </div>
          <button
            type="button"
            onClick={() => void markAll()}
            className="text-sm font-semibold text-[var(--primary)] hover:underline"
          >
            Marchează toate ca citite
          </button>
        </div>

        {loading ? (
          <p className="text-sm text-[var(--text-secondary)]">Se încarcă…</p>
        ) : (
          <ul className="space-y-2">
            {items.map((n) => {
              const exp = expanded.has(n.id)
              const longBody = Boolean(n.body && n.body.length > 120)
              return (
                <li
                  key={n.id}
                  className={cn(
                    'rounded-2xl border border-[var(--border-default)] bg-[var(--surface-card)] p-4 shadow-sm',
                    !n.read && 'bg-[color:color-mix(in_srgb,var(--primary)_6%,transparent)]',
                  )}
                >
                  <div className="flex gap-3">
                    <div className="min-w-0 flex-1">
                      <button type="button" onClick={() => openRow(n)} className="w-full text-left">
                        <p className="font-bold text-[var(--text-primary)]">{n.title}</p>
                        {n.body ? (
                          <p
                            className={cn(
                              'mt-1 text-sm text-[var(--text-secondary)]',
                              !exp && longBody && 'line-clamp-2',
                            )}
                          >
                            {n.body}
                          </p>
                        ) : null}
                        <p className="mt-1 text-xs text-[var(--text-tertiary)]">
                          {formatRelativeRo(n.created_at)}
                        </p>
                      </button>
                      {longBody ? (
                        <button
                          type="button"
                          className="mt-1 flex items-center gap-1 text-xs font-semibold text-[var(--primary)]"
                          onClick={() =>
                            setExpanded((s) => {
                              const next = new Set(s)
                              if (next.has(n.id)) next.delete(n.id)
                              else next.add(n.id)
                              return next
                            })
                          }
                        >
                          {exp ? (
                            <>
                              <ChevronUp className="h-3 w-3" /> Mai puțin
                            </>
                          ) : (
                            <>
                              <ChevronDown className="h-3 w-3" /> Mai mult
                            </>
                          )}
                        </button>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      aria-label="Șterge notificarea"
                      onClick={() => void remove(n.id)}
                      className="shrink-0 text-[var(--text-tertiary)] hover:text-[var(--danger-text)]"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}

        {!loading && hasMore ? (
          <button
            type="button"
            onClick={() => void loadMore()}
            disabled={loadingMore}
            className="mt-6 w-full rounded-xl border border-[var(--border-default)] py-2 text-sm font-semibold text-[var(--primary)]"
          >
            {loadingMore ? 'Se încarcă…' : 'Încarcă mai multe'}
          </button>
        ) : null}

        {!loading && items.length === 0 ? (
          <p className="py-10 text-center text-sm text-[var(--text-secondary)]">Nicio notificare.</p>
        ) : null}
      </div>
    </AppShell>
  )
}
