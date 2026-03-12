'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

import { colors } from '@/lib/design-tokens'
import type { Parcela } from '@/lib/supabase/queries/parcele'

type ParcelInsight = {
  productionKg: number
  latestHarvest?: { date: string; kg: number } | null
  latestActivity?: { date: string; type: string } | null
}

interface ParceleListProps {
  parcele: Parcela[]
  onEdit: (parcela: Parcela) => void
  onDelete: (parcela: Parcela) => void
  onOpen?: (parcela: Parcela) => void
  parcelInsights?: Record<string, ParcelInsight>
  focusParcelId?: string | null
}

function formatDate(value: string | undefined): string {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleDateString('ro-RO')
}

function getUnitateMeta(tipUnitate: string | null | undefined): {
  label: 'Câmp' | 'Solar' | 'Livadă'
  background: string
  color: string
} {
  const value = (tipUnitate ?? 'camp').toLowerCase()
  if (value === 'solar') {
    return { label: 'Solar', background: colors.yellowLight, color: '#8a4b00' }
  }
  if (value === 'livada') {
    return { label: 'Livadă', background: colors.blueLight, color: '#1d4ed8' }
  }
  return { label: 'Câmp', background: colors.greenLight, color: colors.primaryDark }
}

export function ParceleList({ parcele, onEdit, onDelete, onOpen, parcelInsights = {}, focusParcelId }: ParceleListProps) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const nowDate = useMemo(() => new Date(), [])

  useEffect(() => {
    if (!focusParcelId) return
    const target = cardRefs.current[focusParcelId]
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [focusParcelId])

  const currentYear = new Date().getFullYear()

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {parcele.map((parcela) => {
        const insight = parcelInsights[parcela.id]
        const productionKg = Number(insight?.productionKg || 0)
        const latestHarvest = insight?.latestHarvest ?? null
        const latestActivity = insight?.latestActivity ?? null
        const hasRecentHarvest = latestHarvest?.date
          ? (nowDate.getTime() - new Date(latestHarvest.date).getTime()) / (1000 * 60 * 60 * 24) <= 14
          : false
        const isExpanded = !!expanded[parcela.id]

        const area = Number(parcela.suprafata_m2 || 0)
        const plants = Number(parcela.nr_plante || 0)
        const density = area > 0 ? plants / area : 0
        const plantationAge = parcela.an_plantare ? Math.max(0, currentYear - Number(parcela.an_plantare)) : 0

        const titleId = parcela.id_parcela || 'PAR'
        const titleName = parcela.nume_parcela || 'Teren'
        const soi = parcela.soi_plantat || parcela.soi || 'Soi necunoscut'
        const unitate = getUnitateMeta(parcela.tip_unitate)

        return (
          <div
            key={parcela.id}
            ref={(node) => {
              cardRefs.current[parcela.id] = node
            }}
            className={`overflow-hidden rounded-2xl border bg-white shadow-sm transition-colors ${
              hasRecentHarvest ? 'border-emerald-200 bg-emerald-50/60' : 'border-[var(--agri-border)]'
            }`}
          >
            <button
              type="button"
              onClick={() => {
                setExpanded((current) => ({ ...current, [parcela.id]: !current[parcela.id] }))
              }}
              className="w-full p-5 text-left"
            >
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--agri-border)] bg-white text-xs font-bold text-[var(--agri-text)]">
                  PAR
                </div>

                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <div className="truncate text-sm font-semibold text-[var(--agri-text)]">
                      {titleId} - {titleName}
                    </div>
                    <span
                      className="shrink-0 rounded-full px-2 py-1 text-[10px] font-bold leading-none"
                      style={{ background: unitate.background, color: unitate.color }}
                    >
                      {unitate.label}
                    </span>
                  </div>
                  <div className="truncate text-sm text-[var(--agri-text-muted)]">
                    {soi} · {area.toFixed(0)} mp · {plants.toFixed(0)} plante
                  </div>
                </div>

                <div className="shrink-0 text-right">
                  <div className="text-lg font-bold text-emerald-700">{productionKg.toFixed(1)}</div>
                  <div className="text-[10px] text-[var(--agri-text-muted)]">kg</div>
                  <div className="text-[10px] text-[var(--agri-text-muted)]">{density.toFixed(2)} plante/mp</div>
                </div>
              </div>
            </button>

            {isExpanded ? (
              <div className="grid gap-4 border-t border-[var(--agri-border)] bg-white px-5 py-5">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {[
                    ['Suprafață', `${area.toFixed(0)} mp`],
                    ['Nr. plante', `${plants.toFixed(0)}`],
                    ['Densitate', `${density.toFixed(2)}/mp`],
                    ['Vârstă', `${plantationAge} ani`],
                  ].map(([label, value]) => (
                    <div
                      key={label}
                      className="rounded-xl bg-[var(--agri-surface-muted)] px-3 py-2"
                    >
                      <div className="text-[10px] text-[var(--agri-text-muted)]">{label}</div>
                      <div className="text-xs font-semibold text-[var(--agri-text)]">{value}</div>
                    </div>
                  ))}
                </div>

                <div className="space-y-2 text-sm text-[var(--agri-text-muted)]">
                  <div>
                    <strong className="text-[var(--agri-text)]">Ultima recoltare:</strong>{' '}
                    {latestHarvest ? `${formatDate(latestHarvest.date)} · ${latestHarvest.kg.toFixed(1)} kg` : 'Nicio recoltare'}
                  </div>
                  <div>
                    <strong className="text-[var(--agri-text)]">Ultima activitate:</strong>{' '}
                    {latestActivity ? `${formatDate(latestActivity.date)} · ${latestActivity.type}` : 'Nicio activitate'}
                  </div>
                </div>

                <div className={`mt-4 grid gap-2 ${onOpen ? 'grid-cols-3' : 'grid-cols-2'}`}>
                  {onOpen ? (
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation()
                        onOpen(parcela)
                      }}
                      className="min-h-11 rounded-xl border border-blue-200 bg-blue-50 px-3 text-sm font-semibold text-blue-700"
                    >
                      Detalii
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation()
                      onEdit(parcela)
                    }}
                    className="min-h-11 rounded-xl border border-amber-200 bg-amber-50 px-3 text-sm font-semibold text-amber-800"
                  >
                    Editează
                  </button>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation()
                      onDelete(parcela)
                    }}
                    className="min-h-11 rounded-xl border border-red-200 bg-red-50 px-3 text-sm font-semibold text-red-700"
                  >
                    Șterge
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
