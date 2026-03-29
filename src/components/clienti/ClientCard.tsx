'use client'

import { memo, useEffect, useRef, useState, type MouseEvent } from 'react'
import { Trash2 } from 'lucide-react'

import { colors } from '@/lib/design-tokens'
import type { Client } from '@/lib/supabase/queries/clienti'
import { downloadVCard } from '@/lib/utils/downloadVCard'
import { toWhatsAppLink } from '@/lib/utils/phone'

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
  return toWhatsAppLink(phone)
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
    <div ref={rootRef} className="relative overflow-hidden rounded-2xl border border-[var(--agri-border)] bg-[var(--agri-surface)] shadow-sm">
      <button type="button" onClick={() => setExpanded((current) => !current)} className="w-full p-4 pr-10 text-left">
        <div className="flex items-start gap-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg"
            style={{ background: hasRecentSales ? colors.greenLight : colors.grayLight }}
          >
            👤
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
            <div className="line-clamp-2 text-sm text-[var(--agri-text-muted)]">{client.adresa || 'Fără adresă'}</div>
          </div>

          <div className="shrink-0 text-right">
            <div className="text-lg font-bold text-[var(--agri-text)]">{totalRon.toFixed(0)} RON</div>
            <div className="text-[10px] text-[var(--agri-text-muted)]">
              {comenziCount} comenzi · {vanzariCount} vânzări
            </div>
            {unpaidRon > 0 ? (
              <span className="mt-1 inline-flex rounded-md border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] px-2 py-1 text-[10px] font-bold text-[var(--status-warning-text)]">
                💸 {unpaidRon.toFixed(0)} RON
              </span>
            ) : null}
          </div>
        </div>
      </button>

      <button
        type="button"
        aria-label={`Șterge ${client.nume_client}`}
        className="absolute right-2.5 top-2.5 rounded-lg p-1.5 text-[var(--text-hint)] transition-colors hover:bg-[var(--status-danger-bg)] hover:text-[var(--status-danger-text)]"
        onClick={(e: MouseEvent<HTMLButtonElement>) => {
          e.stopPropagation()
          onDelete(client.id)
        }}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>

      {expanded ? (
        <div className="grid gap-4 border-t border-[var(--surface-divider)] bg-[var(--agri-surface)] px-4 py-4">
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-[var(--agri-surface-muted)] px-3 py-2">
              <div className="text-[10px] text-[var(--agri-text-muted)]">Total cumpărat</div>
              <div className="text-xs font-semibold text-[var(--agri-text)]">{totalRon.toFixed(0)} RON</div>
            </div>
            <div className="rounded-xl bg-[var(--agri-surface-muted)] px-3 py-2">
              <div className="text-[10px] text-[var(--agri-text-muted)]">Cantitate totală</div>
              <div className="text-xs font-semibold text-[var(--agri-text)]">{totalKg.toFixed(1)} kg</div>
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
              {lastComanda
                ? `${formatDate(lastComanda.data)} · ${lastComanda.kg.toFixed(1)} kg · ${lastComanda.status}`
                : '-'}
            </div>
            <div>
              <strong className="text-[var(--agri-text)]">Ultima vânzare:</strong>{' '}
              {lastVanzare
                ? `${formatDate(lastVanzare.data)} · ${lastVanzare.kg.toFixed(1)} kg · ${lastVanzare.totalRon.toFixed(0)} RON`
                : '-'}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <a
              href={phoneHref}
              onClick={(event) => event.stopPropagation()}
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[var(--status-info-border)] bg-[var(--status-info-bg)] px-3 text-sm font-semibold text-[var(--status-info-text)]"
            >
              Sună
            </a>
            <a
              href={waHref || undefined}
              target="_blank"
              rel="noreferrer"
              onClick={(event) => event.stopPropagation()}
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[var(--status-success-border)] bg-[var(--status-success-bg)] px-3 text-sm font-semibold text-[var(--status-success-text)]"
            >
              Mesaj
            </a>
            <button
              type="button"
              onClick={(event: MouseEvent<HTMLButtonElement>) => {
                event.stopPropagation()
                if (!client.telefon) return
                downloadVCard(client.nume_client, client.telefon)
              }}
              className="min-h-11 rounded-xl border border-[var(--button-muted-border)] bg-[var(--button-muted-bg)] px-3 text-sm font-semibold text-[var(--button-muted-text)]"
            >
              Contact
            </button>
            <button
              type="button"
              onClick={(event: MouseEvent<HTMLButtonElement>) => {
                event.stopPropagation()
                onOpenDetails?.(client)
              }}
              className="min-h-11 rounded-xl border border-[var(--button-muted-border)] bg-[var(--button-muted-bg)] px-3 text-sm font-semibold text-[var(--button-muted-text)]"
            >
              Detalii
            </button>
            <button
              type="button"
              onClick={(event: MouseEvent<HTMLButtonElement>) => {
                event.stopPropagation()
                onEdit(client)
              }}
              className="min-h-11 rounded-xl border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] px-3 text-sm font-semibold text-[var(--status-warning-text)]"
            >
              Editează
            </button>
            <button
              type="button"
              onClick={(event: MouseEvent<HTMLButtonElement>) => {
                event.stopPropagation()
                onDelete(client.id)
              }}
              className="min-h-11 rounded-xl border border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] px-3 text-sm font-semibold text-[var(--status-danger-text)]"
            >
              Șterge
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default memo(ClientCard)
