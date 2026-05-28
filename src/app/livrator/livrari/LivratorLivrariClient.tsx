'use client'

import { useMemo, useState } from 'react'
import { ChevronDown, MessageCircle, RefreshCw } from 'lucide-react'

import {
  buildDeliverySummary,
  buildLivrareWaUrl,
  formatItemsHuman,
  formatLei,
  waUrlForPhone,
  type ShopOrderRow,
} from '@/lib/shop/b2c-order-helpers'

type Props = {
  livratorName: string
  token: string
  initialOrders: ShopOrderRow[]
}

function formatSummaryBullets(lines: { label: string; qty: number }[]): string {
  return lines.map((line) => `${line.label} × ${line.qty}`).join(' · ')
}

function telHref(phone: string) {
  const digits = phone.replace(/\s/g, '')
  return digits.startsWith('+') ? `tel:${digits}` : `tel:${digits.replace(/^0/, '+40')}`
}

export function LivratorLivrariClient({ livratorName, token, initialOrders }: Props) {
  const [orders, setOrders] = useState(initialOrders)
  const [expandedId, setExpandedId] = useState<string | null>(initialOrders[0]?.id ?? null)
  const [markingId, setMarkingId] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const summary = useMemo(() => buildDeliverySummary(orders), [orders])
  const summaryBullets = useMemo(() => formatSummaryBullets(summary.lines), [summary.lines])

  const markDelivered = async (orderId: string) => {
    setMarkingId(orderId)
    setMessage(null)
    try {
      const res = await fetch('/api/livrator/deliver', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: orderId, token }),
      })
      const json = (await res.json().catch(() => null)) as { success?: boolean; error?: string } | null
      if (!res.ok || !json?.success) {
        throw new Error(json?.error ?? 'Nu am putut marca livrarea.')
      }
      setOrders((current) => current.filter((order) => order.id !== orderId))
      setExpandedId((current) => (current === orderId ? null : current))
      setMessage('Comanda a fost marcată livrată.')
    } catch (error) {
      setMessage((error as { message?: string })?.message ?? 'Nu am putut marca livrarea.')
    } finally {
      setMarkingId(null)
    }
  }

  return (
    <main className="min-h-screen bg-[#FFF6F3] px-3 pb-8 pt-3 text-[#312E3F]">
      <div className="mx-auto flex w-full max-w-[540px] flex-col gap-4">
        <header className="sticky top-0 z-10 -mx-3 border-b border-[#F3DAD4]/80 bg-[#FFF6F3]/95 px-4 py-3 backdrop-blur">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <img src="/icons/icon.svg" alt="Zmeurel" className="h-10 w-10 rounded-xl" />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-[#F16B6B]">Zmeurel livrări</p>
                <h1 className="truncate text-lg font-extrabold leading-tight">Salut, {livratorName}</h1>
              </div>
            </div>
            <button
              type="button"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#F3DAD4] bg-white text-[#312E3F]"
              aria-label="Reîncarcă pagina"
              onClick={() => window.location.reload()}
            >
              <RefreshCw className="h-5 w-5" aria-hidden />
            </button>
          </div>
        </header>

        <section className="rounded-3xl bg-white p-4 shadow-[0_8px_28px_rgba(120,100,70,0.09)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold">🚚 Livrări active</p>
              <p className="mt-1 text-xs text-[#5F5E5A]">
                {orders.length === 0
                  ? 'Nu ai comenzi în livrare acum.'
                  : `${orders.length} ${orders.length === 1 ? 'comandă' : 'comenzi'} în traseu`}
              </p>
            </div>
            <p className="shrink-0 text-base font-extrabold tabular-nums text-[#F16B6B]">
              {formatLei(summary.totalLei)} lei
            </p>
          </div>
          {summaryBullets ? (
            <p className="mt-3 text-xs leading-relaxed text-[#5F5E5A]">{summaryBullets}</p>
          ) : null}
        </section>

        {message ? (
          <p className="rounded-2xl border border-[#F3DAD4] bg-white px-4 py-3 text-sm font-medium text-[#312E3F]">
            {message}
          </p>
        ) : null}

        {orders.length === 0 ? (
          <section className="rounded-3xl bg-white px-6 py-12 text-center shadow-[0_8px_28px_rgba(120,100,70,0.09)]">
            <span className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#FCE3DF] text-3xl">
              🚚
            </span>
            <h2 className="text-lg font-bold">Nicio livrare activă acum.</h2>
            <p className="mt-2 text-sm leading-relaxed text-[#5F5E5A]">
              Când fermierul marchează o comandă „În livrare”, apare aici.
            </p>
          </section>
        ) : (
          <div className="space-y-2">
            {orders.map((order, index) => (
              <DeliveryCard
                key={order.id}
                order={order}
                position={index + 1}
                expanded={expandedId === order.id}
                marking={markingId === order.id}
                onToggle={() => setExpandedId((current) => (current === order.id ? null : order.id))}
                onMarkDelivered={() => void markDelivered(order.id)}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  )
}

function DeliveryCard({
  order,
  position,
  expanded,
  marking,
  onToggle,
  onMarkDelivered,
}: {
  order: ShopOrderRow
  position: number
  expanded: boolean
  marking: boolean
  onToggle: () => void
  onMarkDelivered: () => void
}) {
  const chatWaUrl = waUrlForPhone(order.customer_phone)
  const messageWaUrl = buildLivrareWaUrl(order)
  const productsLabel = formatItemsHuman(order.items)
  const addressFull = (order.delivery_address ?? '').trim() || '—'

  return (
    <article className="overflow-hidden rounded-2xl border border-[#F3DAD4] bg-white shadow-[0_8px_24px_rgba(120,100,70,0.08)]">
      <div className="px-3 py-2.5">
        <div className="flex min-h-[44px] items-center gap-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#FCE3DF] text-xs font-extrabold tabular-nums text-[#E15453]">
            {position}
          </span>
          <button
            type="button"
            className="min-w-0 flex-1 truncate text-left text-base font-bold leading-tight"
            onClick={onToggle}
          >
            {order.customer_name}
          </button>
          <span className="shrink-0 text-base font-extrabold tabular-nums text-[#F16B6B]">
            {formatLei(order.total_lei)}
          </span>
          <a
            href={chatWaUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#25D366] text-white"
            aria-label="Deschide WhatsApp"
            onClick={(e) => e.stopPropagation()}
          >
            <MessageCircle className="h-4 w-4" aria-hidden />
          </a>
          <button
            type="button"
            className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center text-[#5F5E5A]"
            aria-expanded={expanded}
            aria-label={expanded ? 'Restrânge detaliile' : 'Arată detaliile'}
            onClick={onToggle}
          >
            <ChevronDown
              className={`h-5 w-5 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
              aria-hidden
            />
          </button>
        </div>
        <p className="mt-1 line-clamp-2 pl-[34px] text-[11px] leading-[1.4] text-[#5F5E5A]">
          📍 {addressFull}
        </p>
      </div>

      <div className={`grid transition-[grid-template-rows] duration-200 ${expanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
        <div className="overflow-hidden">
          <div className="border-t border-dashed border-[#F3DAD4] px-3.5 py-3">
            <p className="text-[13px] leading-relaxed text-[#5F5E5A]">
              <span className="font-semibold text-[#312E3F]">Produse: </span>
              {productsLabel}
            </p>
            <p className="mt-2 text-[13px]">
              <span className="font-semibold text-[#312E3F]">Telefon: </span>
              <a href={telHref(order.customer_phone)} className="font-medium text-[#1868DB] underline-offset-2">
                {order.customer_phone}
              </a>
            </p>
            <div className="mt-3 flex gap-2">
              <a
                href={messageWaUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 flex-[2] items-center justify-center gap-1.5 rounded-xl bg-[#25D366] px-3 text-sm font-bold text-white"
              >
                <MessageCircle className="h-4 w-4 shrink-0" aria-hidden />
                Trimite mesaj WA
              </a>
              <button
                type="button"
                className="min-h-11 flex-1 rounded-xl border border-[#F3DAD4] bg-[#FFF6F3] px-3 text-sm font-semibold text-[#312E3F] disabled:opacity-60"
                disabled={marking}
                onClick={onMarkDelivered}
              >
                {marking ? 'Se marchează…' : 'Marchează livrat'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </article>
  )
}
