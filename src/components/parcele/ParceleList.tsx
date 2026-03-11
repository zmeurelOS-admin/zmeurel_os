'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

import { colors, radius, shadows, spacing } from '@/lib/design-tokens'
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
  label: 'Camp' | 'Solar' | 'Livada'
  background: string
  color: string
} {
  const value = (tipUnitate ?? 'camp').toLowerCase()
  if (value === 'solar') {
    return { label: 'Solar', background: colors.yellowLight, color: '#8a4b00' }
  }
  if (value === 'livada') {
    return { label: 'Livada', background: colors.blueLight, color: '#1d4ed8' }
  }
  return { label: 'Camp', background: colors.greenLight, color: colors.primaryDark }
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
    <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2 md:gap-3">
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
            style={{
              borderRadius: radius.lg,
              border: `1px solid ${colors.grayLight}`,
              boxShadow: shadows.card,
              background: hasRecentHarvest ? colors.greenLight : colors.white,
              overflow: 'hidden',
            }}
          >
            <button
              type="button"
              onClick={() => {
                setExpanded((current) => ({ ...current, [parcela.id]: !current[parcela.id] }))
              }}
              style={{
                width: '100%',
                border: 'none',
                background: 'transparent',
                textAlign: 'left',
                padding: spacing.md,
                cursor: 'pointer',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: radius.md,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: colors.white,
                    border: `1px solid ${colors.grayLight}`,
                    fontSize: 12,
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  PAR
                </div>

                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div
                      style={{
                        minWidth: 0,
                        fontSize: 14,
                        fontWeight: 700,
                        color: colors.dark,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {titleId} - {titleName}
                    </div>
                    <span
                      style={{
                        borderRadius: radius.full,
                        background: unitate.background,
                        color: unitate.color,
                        fontSize: 10,
                        fontWeight: 700,
                        lineHeight: 1,
                        padding: '4px 8px',
                        flexShrink: 0,
                      }}
                    >
                      {unitate.label}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: colors.gray }}>
                    {soi} · {area.toFixed(0)} mp · {plants.toFixed(0)} plante
                  </div>
                </div>

                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: colors.green }}>{productionKg.toFixed(1)}</div>
                  <div style={{ fontSize: 10, color: colors.gray }}>kg</div>
                  <div style={{ fontSize: 10, color: colors.gray }}>{density.toFixed(2)} plante/mp</div>
                </div>
              </div>
            </button>

            {isExpanded ? (
              <div
                style={{
                  borderTop: `1px solid ${colors.grayLight}`,
                  padding: `${spacing.sm}px ${spacing.md}px ${spacing.md}px`,
                  display: 'grid',
                  gap: spacing.sm,
                  background: colors.white,
                }}
              >
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: spacing.xs }}>
                  {[
                    ['Suprafata', `${area.toFixed(0)} mp`],
                    ['Nr plante', `${plants.toFixed(0)}`],
                    ['Densitate', `${density.toFixed(2)}/mp`],
                    ['Varsta', `${plantationAge} ani`],
                  ].map(([label, value]) => (
                    <div
                      key={label}
                      style={{ borderRadius: radius.md, background: colors.grayLight, padding: `${spacing.xs + 2}px ${spacing.xs}` }}
                    >
                      <div style={{ fontSize: 9, color: colors.gray }}>{label}</div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: colors.dark }}>{value}</div>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'grid', gap: 4 }}>
                  <div style={{ fontSize: 11, color: colors.gray }}>
                    <strong style={{ color: colors.dark }}>Ultima recoltare:</strong>{' '}
                    {latestHarvest ? `${formatDate(latestHarvest.date)} · ${latestHarvest.kg.toFixed(1)} kg` : 'Nicio recoltare'}
                  </div>
                  <div style={{ fontSize: 11, color: colors.gray }}>
                    <strong style={{ color: colors.dark }}>Ultima activitate:</strong>{' '}
                    {latestActivity ? `${formatDate(latestActivity.date)} · ${latestActivity.type}` : 'Nicio activitate'}
                  </div>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: onOpen ? 'repeat(3, minmax(0, 1fr))' : 'repeat(2, minmax(0, 1fr))',
                    gap: spacing.sm,
                  }}
                >
                  {onOpen ? (
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation()
                        onOpen(parcela)
                      }}
                      style={{
                        minHeight: 46,
                        border: 'none',
                        borderRadius: radius.md,
                        background: colors.blueLight,
                        color: '#1d4ed8',
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
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
                    style={{
                      minHeight: 46,
                      border: 'none',
                      borderRadius: radius.md,
                      background: colors.yellowLight,
                      color: colors.dark,
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation()
                      onDelete(parcela)
                    }}
                    style={{
                      minHeight: 46,
                      border: 'none',
                      borderRadius: radius.md,
                      background: colors.coralLight,
                      color: colors.coral,
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    Delete
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
