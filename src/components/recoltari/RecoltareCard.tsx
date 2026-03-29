'use client'

import { useState } from 'react'

import { colors } from '@/lib/design-tokens'
import { Recoltare } from '@/lib/supabase/queries/recoltari'

interface RecoltareCardProps {
  recoltare: Recoltare
  culegatorNume?: string
  culegatorTarif?: number
  parcelaNume?: string
  parcelaTip?: string
  parcelaSoi?: string
  iconBackground?: string
  onView: (recoltare: Recoltare) => void
  onEdit: (recoltare: Recoltare) => void
  onDelete: (recoltare: Recoltare) => void
}

export function RecoltareCard({
  recoltare,
  culegatorNume,
  culegatorTarif,
  parcelaNume,
  parcelaTip,
  parcelaSoi,
  iconBackground,
  onView,
  onEdit,
  onDelete,
}: RecoltareCardProps) {
  const [expanded, setExpanded] = useState(false)
  const kgCal1 = Number(recoltare.kg_cal1 ?? 0)
  const kgCal2 = Number(recoltare.kg_cal2 ?? 0)
  const totalKg = kgCal1 + kgCal2
  const costMuncaSnapshot = Number(recoltare.valoare_munca_lei ?? 0)
  const costMunca = costMuncaSnapshot > 0 ? costMuncaSnapshot : culegatorTarif ? totalKg * culegatorTarif : 0
  const createdAt = new Date(recoltare.created_at || recoltare.data)
  const formattedTime = Number.isNaN(createdAt.getTime())
    ? '-'
    : createdAt.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })
  const formattedDate = new Date(recoltare.data).toLocaleDateString('ro-RO')

  const pretSnapshot = Number(recoltare.pret_lei_pe_kg_snapshot || 0)
  const pretCal2 = pretSnapshot
  const valoareCal1 = kgCal1 * pretSnapshot
  const valoareCal2 = kgCal2 * pretCal2
  const valoareTotala = valoareCal1 + valoareCal2

  const parcelaTitle = parcelaNume || 'Parcelă'
  const soiTitle = parcelaSoi || 'Soi nedefinit'
  const workerTitle = culegatorNume || 'Nespecificat'

  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--agri-border)] bg-[var(--agri-surface)] shadow-sm">
      <button
        type="button"
        onClick={() => setExpanded((previous) => !previous)}
        className="w-full p-5 text-left"
      >
        <div className="flex items-start gap-4">
          <div
            aria-hidden="true"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg"
            style={{ background: iconBackground || colors.greenLight }}
          >
            🫐
          </div>

          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex items-center gap-2">
              <div className="truncate text-sm font-semibold text-[var(--agri-text)]">
                {parcelaTitle} - {soiTitle}
              </div>
              {parcelaTip ? (
                <span className="shrink-0 rounded-full bg-[var(--agri-surface-muted)] px-2 py-1 text-[10px] font-bold text-[var(--agri-text-muted)]">
                  {parcelaTip}
                </span>
              ) : null}
            </div>
            <div className="truncate text-sm text-[var(--agri-text-muted)]">
              👤 {workerTitle} · 🕐 {formattedTime}
            </div>
          </div>

          <div className="shrink-0 text-right">
            <div className="text-lg font-bold text-[var(--agri-text)]">{totalKg.toFixed(2)} kg</div>
            <div className="mt-1.5 flex justify-end gap-1">
              <span className="rounded-md border border-[var(--status-success-border)] bg-[var(--status-success-bg)] px-2 py-1 text-[10px] font-bold text-[var(--status-success-text)]">
                C1: {kgCal1.toFixed(2)}
              </span>
              <span className="rounded-md border border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] px-2 py-1 text-[10px] font-bold text-[var(--status-danger-text)]">
                C2: {kgCal2.toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      </button>

      {expanded ? (
        <div className="grid gap-4 border-t border-[var(--surface-divider)] bg-[var(--agri-surface)] px-5 py-5">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <div className="rounded-xl border border-[var(--status-success-border)] bg-[var(--status-success-bg)] p-3">
              <div className="text-[10px] text-[var(--agri-text-muted)]">Valoare Cal. I</div>
              <div className="text-sm font-semibold text-[var(--status-success-text)]">{valoareCal1.toFixed(2)} lei</div>
            </div>
            <div className="rounded-xl border border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] p-3">
              <div className="text-[10px] text-[var(--agri-text-muted)]">Valoare Cal. II</div>
              <div className="text-sm font-semibold text-[var(--status-danger-text)]">{valoareCal2.toFixed(2)} lei</div>
            </div>
            <div className="rounded-xl bg-[var(--agri-surface-muted)] p-3">
              <div className="text-[10px] text-[var(--agri-text-muted)]">Total</div>
              <div className="text-sm font-semibold text-[var(--agri-text)]">{valoareTotala.toFixed(2)} lei</div>
            </div>
          </div>

          <div className="text-sm text-[var(--agri-text-muted)]">
            Data: {formattedDate}
            {costMunca > 0 ? ` · Manoperă: ${costMunca.toFixed(2)} lei` : ''}
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                onView(recoltare)
              }}
              className="min-h-11 rounded-xl border border-[var(--status-info-border)] bg-[var(--status-info-bg)] px-3 text-sm font-semibold text-[var(--status-info-text)]"
            >
              Vezi
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                onEdit(recoltare)
              }}
              className="min-h-11 rounded-xl border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] px-3 text-sm font-semibold text-[var(--status-warning-text)]"
            >
              Editează
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                onDelete(recoltare)
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
