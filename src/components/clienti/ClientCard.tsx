'use client'

import { useEffect, useRef, useState, type MouseEvent } from 'react'

import { colors } from '@/lib/design-tokens'
import type { Client } from '@/lib/supabase/queries/clienti'

interface ClientCardProps {
  client: Client
  totalRon: number
  totalKg: number
  comenziCount: number
  vanzariCount: number
  unpaidRon: number
  hasRecentSales: boolean
  lastComanda?: { data: string; kg: number; status: string } | null
  lastVanzare?: { data: string; kg: number; totalRon: number } | null
  focusKey?: number
  onEdit: (client: Client) => void
  onDelete: (id: string) => void
  onOpenDetails?: (client: Client) => void
}

function toWhatsapp(phone: string): string {
  const digits = phone.replace(/\s+/g, '').replace(/[^\d]/g, '')
  if (!digits) return ''
  const noLeadingZero = digits.startsWith('0') ? digits.slice(1) : digits
  return `https://wa.me/4${noLeadingZero}`
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleDateString('ro-RO')
}

export function ClientCard({
  client,
  totalRon,
  totalKg,
  comenziCount,
  vanzariCount,
  unpaidRon,
  hasRecentSales,
  lastComanda,
  lastVanzare,
  focusKey = 0,
  onEdit,
  onDelete,
  onOpenDetails,
}: ClientCardProps) {
  const [expanded, setExpanded] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!focusKey) return
    setExpanded(true)
    rootRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [focusKey])

  const phoneHref = client.telefon ? `tel:${client.telefon}` : undefined
  const waHref = client.telefon ? toWhatsapp(client.telefon) : ''

  return (
    <div
      ref={rootRef}
      className="overflow-hidden rounded-2xl border border-[var(--agri-border)] bg-white shadow-sm"
    >
      <button
        type="button"
        onClick={() => setExpanded((current) => !current)}
        className="w-full p-5 text-left"
      >
        <div className="flex items-start gap-4">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg"
            style={{ background: hasRecentSales ? colors.greenLight : colors.grayLight }}
          >
            🤝
          </div>

          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="truncate text-sm font-semibold text-[var(--agri-text)]">{client.nume_client}</div>
            <a
              href={phoneHref}
              onClick={(event) => event.stopPropagation()}
              className="text-sm font-semibold text-[var(--agri-primary)]"
            >
              {client.telefon || '-'}
            </a>
            <div className="truncate text-sm text-[var(--agri-text-muted)]">{client.adresa || '-'}</div>
          </div>

          <div className="shrink-0 text-right">
            <div className="text-lg font-bold text-[var(--agri-text)]">{totalRon.toFixed(0)} RON</div>
            <div className="text-[10px] text-[var(--agri-text-muted)]">
              {comenziCount} comenzi · {vanzariCount} vânzări
            </div>
            {unpaidRon > 0 ? (
              <span className="mt-1 inline-flex rounded-md bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-800">
                💸 {unpaidRon.toFixed(0)} RON
              </span>
            ) : null}
          </div>
        </div>
      </button>

      {expanded ? (
        <div className="grid gap-4 border-t border-[var(--agri-border)] bg-white px-5 py-5">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <div className="rounded-xl bg-[var(--agri-surface-muted)] px-3 py-2">
              <div className="text-[10px] text-[var(--agri-text-muted)]">Total cumpărat</div>
              <div className="text-xs font-semibold text-[var(--agri-text)]">{totalRon.toFixed(0)} RON</div>
            </div>
            <div className="rounded-xl bg-[var(--agri-surface-muted)] px-3 py-2">
              <div className="text-[10px] text-[var(--agri-text-muted)]">Nr. comenzi</div>
              <div className="text-xs font-semibold text-[var(--agri-text)]">{comenziCount}</div>
            </div>
            <div className="rounded-xl bg-[var(--agri-surface-muted)] px-3 py-2">
              <div className="text-[10px] text-[var(--agri-text-muted)]">Nr. vânzări</div>
              <div className="text-xs font-semibold text-[var(--agri-text)]">{vanzariCount}</div>
            </div>
          </div>

          <div className="space-y-2 text-sm text-[var(--agri-text-muted)]">
            <div>
              <strong className="text-[var(--agri-text)]">Ultima comandă:</strong>{' '}
              {lastComanda ? `${formatDate(lastComanda.data)} · ${lastComanda.kg.toFixed(1)} kg · ${lastComanda.status}` : '-'}
            </div>
            <div>
              <strong className="text-[var(--agri-text)]">Ultima vânzare:</strong>{' '}
              {lastVanzare ? `${formatDate(lastVanzare.data)} · ${lastVanzare.kg.toFixed(1)} kg · ${lastVanzare.totalRon.toFixed(0)} RON` : '-'}
            </div>
            <div>
              <strong className="text-[var(--agri-text)]">Cantitate totală:</strong> {totalKg.toFixed(1)} kg
            </div>
          </div>

          <div className="mt-4 grid grid-cols-5 gap-2">
            <a
              href={phoneHref}
              onClick={(event) => event.stopPropagation()}
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-blue-200 bg-blue-50 px-3 text-sm font-semibold text-blue-700"
            >
              📞
            </a>
            <a
              href={waHref || undefined}
              target="_blank"
              rel="noreferrer"
              onClick={(event) => event.stopPropagation()}
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 px-3 text-sm font-semibold text-emerald-700"
            >
              💬
            </a>
            <button
              type="button"
              onClick={(event: MouseEvent<HTMLButtonElement>) => {
                event.stopPropagation()
                onEdit(client)
              }}
              className="min-h-11 rounded-xl border border-amber-200 bg-amber-50 px-3 text-sm font-semibold text-amber-800"
            >
              Editează
            </button>
            <button
              type="button"
              onClick={(event: MouseEvent<HTMLButtonElement>) => {
                event.stopPropagation()
                onDelete(client.id)
              }}
              className="min-h-11 rounded-xl border border-red-200 bg-red-50 px-3 text-sm font-semibold text-red-700"
            >
              Șterge
            </button>
            <button
              type="button"
              onClick={(event: MouseEvent<HTMLButtonElement>) => {
                event.stopPropagation()
                onOpenDetails?.(client)
              }}
              className="min-h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-700"
            >
              Detalii
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
