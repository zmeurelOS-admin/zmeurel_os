'use client'

import { useState } from 'react'

import { colors } from '@/lib/design-tokens'
import { Vanzare } from '@/lib/supabase/queries/vanzari'

interface VanzareCardProps {
  vanzare: Vanzare
  clientNume: string
  telefon?: string | null
  incasata: boolean
  isNewFromComandaToday: boolean
  onMarkPaid?: (vanzare: Vanzare) => void
  onView: (vanzare: Vanzare) => void
  onEdit: (vanzare: Vanzare) => void
  onDelete: (vanzare: Vanzare) => void
  onOpenComanda?: () => void
}

function formatKg(value: number) {
  return new Intl.NumberFormat('ro-RO', { maximumFractionDigits: 2 }).format(value)
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('ro-RO', { style: 'currency', currency: 'RON', maximumFractionDigits: 0 }).format(value)
}

export function VanzareCard({
  vanzare,
  clientNume,
  telefon,
  incasata,
  isNewFromComandaToday,
  onMarkPaid,
  onView,
  onEdit,
  onDelete,
  onOpenComanda,
}: VanzareCardProps) {
  const [expanded, setExpanded] = useState(false)
  const totalRon = Number(vanzare.cantitate_kg || 0) * Number(vanzare.pret_lei_kg || 0)
  const dataVanzare = new Date(vanzare.data).toLocaleDateString('ro-RO')

  return (
    <div
      className="overflow-hidden rounded-2xl border bg-[var(--agri-surface)] shadow-sm"
      style={{ borderColor: 'var(--agri-border)', borderLeft: `4px solid ${incasata ? colors.green : colors.yellow}` }}
    >
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="w-full p-5 text-left"
      >
        {isNewFromComandaToday ? (
          <div className="mb-2 inline-flex items-center gap-1 rounded-full border border-[var(--status-success-border)] bg-[var(--status-success-bg)] px-2.5 py-1 text-[10px] font-bold text-[var(--status-success-text)]">
            🆕 Din comandă livrată azi
          </div>
        ) : null}

        <div className="flex items-start gap-4">
          <div
            aria-hidden="true"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg"
            style={{ background: incasata ? colors.greenLight : colors.yellowLight }}
          >
            {incasata ? '✅' : '⏳'}
          </div>

          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="truncate text-sm font-semibold text-[var(--agri-text)]">{clientNume}</div>
            <div className="text-sm text-[var(--agri-text-muted)]">{dataVanzare}</div>
          </div>

          <div className="shrink-0 text-right">
            <div className="text-lg font-bold text-[var(--agri-text)]">{formatCurrency(totalRon)}</div>
            <div className="text-[10px] text-[var(--agri-text-muted)]">
              {formatKg(vanzare.cantitate_kg)} kg × {formatKg(vanzare.pret_lei_kg)} lei
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-3 border-t border-[var(--agri-border)] pt-4">
          <div>
            <div className="text-[10px] uppercase tracking-wide text-[var(--agri-text-muted)]">Cantitate</div>
            <div className="text-sm font-semibold text-[var(--agri-text)]">{formatKg(vanzare.cantitate_kg)} kg</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wide text-[var(--agri-text-muted)]">Preț</div>
            <div className="text-sm font-semibold text-[var(--agri-text)]">{formatKg(vanzare.pret_lei_kg)} lei/kg</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wide text-[var(--agri-text-muted)]">Total</div>
            <div className="text-sm font-semibold text-[var(--value-positive)]">{formatCurrency(totalRon)}</div>
          </div>
        </div>
      </button>

      {expanded ? (
        <div className="grid gap-4 border-t border-[var(--surface-divider)] bg-[var(--agri-surface)] px-5 py-5">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <div className="rounded-xl bg-[var(--agri-surface-muted)] p-3">
              <div className="text-[10px] text-[var(--agri-text-muted)]">Cantitate</div>
              <div className="text-sm font-semibold text-[var(--agri-text)]">{formatKg(vanzare.cantitate_kg)} kg</div>
            </div>
            <div className="rounded-xl bg-[var(--agri-surface-muted)] p-3">
              <div className="text-[10px] text-[var(--agri-text-muted)]">Preț</div>
              <div className="text-sm font-semibold text-[var(--agri-text)]">{formatKg(vanzare.pret_lei_kg)} lei/kg</div>
            </div>
            <div
              className="rounded-xl p-3"
              style={{ background: incasata ? colors.greenLight : colors.yellowLight }}
            >
              <div className="text-[10px] text-[var(--agri-text-muted)]">Status</div>
              <div className="text-sm font-semibold text-[var(--agri-text)]">{incasata ? 'Încasată' : 'Neîncasată'}</div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
            {!incasata ? (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation()
                  onMarkPaid?.(vanzare)
                }}
                className="col-span-2 min-h-11 rounded-xl bg-emerald-600 px-3 text-sm font-semibold text-white"
              >
                Marchează încasată
              </button>
            ) : null}

            <a
              href={telefon ? `tel:${telefon}` : undefined}
              onClick={(event) => event.stopPropagation()}
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[var(--status-info-border)] bg-[var(--status-info-bg)] px-3 text-sm font-semibold text-[var(--status-info-text)]"
            >
              📞
            </a>

            {vanzare.comanda_id ? (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation()
                  onOpenComanda?.()
                }}
                className="min-h-11 rounded-xl border border-[var(--status-neutral-border)] bg-[var(--status-neutral-bg)] px-3 text-sm font-semibold text-[var(--status-neutral-text)]"
              >
                Comandă
              </button>
            ) : null}

            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                onEdit(vanzare)
              }}
              className="min-h-11 rounded-xl border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] px-3 text-sm font-semibold text-[var(--status-warning-text)]"
            >
              Editează
            </button>

            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                onDelete(vanzare)
              }}
              className="min-h-11 rounded-xl border border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] px-3 text-sm font-semibold text-[var(--status-danger-text)]"
            >
              Șterge
            </button>
          </div>

          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              onView(vanzare)
            }}
            className="mt-1 text-left text-sm font-semibold text-[var(--agri-primary)]"
          >
            Vezi detalii complete
          </button>
        </div>
      ) : null}
    </div>
  )
}
