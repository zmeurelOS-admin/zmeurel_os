'use client'

import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { MessageCircle, RefreshCw } from 'lucide-react'

import { ErrorState } from '@/components/app/ErrorState'
import { EntityListSkeleton } from '@/components/app/ListSkeleton'
import { ModuleEmptyCard } from '@/components/app/module-list-chrome'
import { Button } from '@/components/ui/button'
import { getSupabase } from '@/lib/supabase/client'
import { waUrlForPhone } from '@/lib/shop/b2c-order-helpers'
import { queryKeys } from '@/lib/query-keys'
import { toast } from '@/lib/ui/toast'

export type ShopNotifyRow = {
  id: string
  created_at: string
  customer_name: string
  customer_phone: string
  product_id: string
  product_name: string
  notified_at: string | null
}

async function fetchShopNotifyRequests(): Promise<ShopNotifyRow[]> {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('shop_notify_requests')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []) as ShopNotifyRow[]
}

function formatNotifyDate(iso: string) {
  return new Intl.DateTimeFormat('ro-RO', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Bucharest',
  }).format(new Date(iso))
}

function NotifyStateBadge({ notifiedAt }: { notifiedAt: string | null }) {
  if (notifiedAt) {
    return (
      <div className="inline-flex flex-col gap-0.5">
        <span className="inline-flex w-fit rounded-full bg-[var(--status-success-bg)] px-2.5 py-0.5 text-xs font-semibold text-[var(--status-success-text)]">
          Notificat
        </span>
        <span className="text-[11px] text-[var(--text-tertiary)]">{formatNotifyDate(notifiedAt)}</span>
      </div>
    )
  }
  return (
    <span className="inline-flex rounded-full bg-[var(--status-warning-bg)] px-2.5 py-0.5 text-xs font-semibold text-[var(--status-warning-text)]">
      Așteaptă
    </span>
  )
}

export function ShopOrdersPanel() {
  const queryClient = useQueryClient()

  const notifyQuery = useQuery({
    queryKey: queryKeys.shopNotifyRequests,
    queryFn: fetchShopNotifyRequests,
  })

  useEffect(() => {
    const interval = setInterval(() => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.shopNotifyRequests })
    }, 30_000)
    return () => clearInterval(interval)
  }, [queryClient])

  const patchNotifyMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/shop/b2c/notify/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notified_at: new Date().toISOString() }),
      })
      const json = (await res.json()) as { success?: boolean; error?: string }
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? 'Actualizare eșuată')
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.shopNotifyRequests })
      toast.success('Marcat ca notificat')
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
  })

  const handleNotifyOnWhatsApp = (row: ShopNotifyRow) => {
    window.open(waUrlForPhone(row.customer_phone), '_blank', 'noopener,noreferrer')
    if (!row.notified_at) {
      patchNotifyMutation.mutate(row.id)
    }
  }

  const isRefreshing = notifyQuery.isFetching

  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="text-[15px] font-bold text-[var(--text-primary)]">Listă așteptare</p>
        <p className="mt-1 text-[14px] leading-snug text-[var(--text-secondary)]">
          Clienți care vor să fie anunțați când zmeura/murele sunt disponibile.
        </p>
      </div>

      <div className="flex justify-end">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="min-h-11 gap-1.5"
          disabled={isRefreshing}
          onClick={() => void queryClient.invalidateQueries({ queryKey: queryKeys.shopNotifyRequests })}
        >
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} aria-hidden />
          Reîncarcă
        </Button>
      </div>

      {notifyQuery.isLoading ? <EntityListSkeleton /> : null}
      {notifyQuery.isError ? (
        <ErrorState
          title="Eroare"
          message={(notifyQuery.error as Error)?.message ?? 'Nu am putut încărca lista de așteptare.'}
        />
      ) : null}

      {!notifyQuery.isLoading && !notifyQuery.isError && (notifyQuery.data ?? []).length === 0 ? (
        <ModuleEmptyCard
          emoji="🔔"
          title="Nicio cerere"
          hint="Cererile de pe /comanda apar aici când clienții solicită notificare."
        />
      ) : null}

      {!notifyQuery.isLoading && !notifyQuery.isError && (notifyQuery.data ?? []).length > 0 ? (
        <>
          <div className="space-y-3 md:hidden">
            {(notifyQuery.data ?? []).map((row) => (
              <article
                key={row.id}
                className="rounded-2xl border border-[var(--border-default)] bg-[var(--surface-card)] p-3 shadow-[var(--shadow-soft)]"
              >
                <p className="text-[15px] font-bold text-[var(--text-primary)]">{row.customer_name}</p>
                <a
                  href={`tel:${row.customer_phone.replace(/\s/g, '')}`}
                  className="mt-1 inline-flex min-h-11 items-center text-[14px] font-medium text-[var(--info-text)]"
                >
                  {row.customer_phone}
                </a>
                <p className="mt-1 text-[14px] text-[var(--text-secondary)]">{row.product_name}</p>
                <p className="mt-1 text-xs text-[var(--text-tertiary)]">{formatNotifyDate(row.created_at)}</p>
                <div className="mt-2">
                  <NotifyStateBadge notifiedAt={row.notified_at} />
                </div>
                {!row.notified_at ? (
                  <Button
                    type="button"
                    className="mt-3 min-h-11 w-full gap-2 bg-[#25D366] text-[14px] font-bold text-white hover:bg-[#20BD5A]"
                    disabled={patchNotifyMutation.isPending}
                    onClick={() => handleNotifyOnWhatsApp(row)}
                  >
                    <MessageCircle className="h-4 w-4" aria-hidden />
                    Anunță pe WhatsApp
                  </Button>
                ) : null}
              </article>
            ))}
          </div>

          <div className="hidden overflow-x-auto rounded-2xl border border-[var(--border-default)] bg-[var(--surface-card)] md:block">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-[var(--border-default)] bg-[var(--surface-card-muted)] text-xs font-semibold text-[var(--text-tertiary)]">
                <tr>
                  <th className="px-3 py-2.5">Nume</th>
                  <th className="px-3 py-2.5">Telefon</th>
                  <th className="px-3 py-2.5">Produs</th>
                  <th className="px-3 py-2.5">Data</th>
                  <th className="px-3 py-2.5">Stare</th>
                  <th className="px-3 py-2.5 text-right">Acțiuni</th>
                </tr>
              </thead>
              <tbody>
                {(notifyQuery.data ?? []).map((row) => (
                  <tr key={row.id} className="border-b border-[var(--border-default)] last:border-0">
                    <td className="px-3 py-3 font-medium">{row.customer_name}</td>
                    <td className="px-3 py-3">
                      <a href={`tel:${row.customer_phone.replace(/\s/g, '')}`} className="text-[var(--info-text)]">
                        {row.customer_phone}
                      </a>
                    </td>
                    <td className="px-3 py-3">{row.product_name}</td>
                    <td className="px-3 py-3 text-xs text-[var(--text-tertiary)]">
                      {formatNotifyDate(row.created_at)}
                    </td>
                    <td className="px-3 py-3">
                      <NotifyStateBadge notifiedAt={row.notified_at} />
                    </td>
                    <td className="px-3 py-3 text-right">
                      {!row.notified_at ? (
                        <Button
                          type="button"
                          size="sm"
                          className="min-h-11 gap-1.5 bg-[#25D366] text-white hover:bg-[#20BD5A]"
                          disabled={patchNotifyMutation.isPending}
                          onClick={() => handleNotifyOnWhatsApp(row)}
                        >
                          <MessageCircle className="h-4 w-4" aria-hidden />
                          Anunță pe WhatsApp
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </div>
  )
}
