'use client'

import { useState } from 'react'

import { colors, radius, shadows, spacing } from '@/lib/design-tokens'
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
  // TODO: when cal2 has dedicated price in DB, replace this fallback.
  const pretCal2 = pretSnapshot
  const valoareCal1 = kgCal1 * pretSnapshot
  const valoareCal2 = kgCal2 * pretCal2
  const valoareTotala = valoareCal1 + valoareCal2

  const parcelaTitle = parcelaNume || 'Parcelă'
  const soiTitle = parcelaSoi || 'Soi nedefinit'
  const workerTitle = culegatorNume || 'Nespecificat'

  return (
    <div
      style={{
        borderRadius: radius.lg,
        background: colors.white,
        boxShadow: shadows.card,
        border: `1px solid ${colors.grayLight}`,
        overflow: 'hidden',
      }}
    >
      <button
        type="button"
        onClick={() => setExpanded((previous) => !previous)}
        style={{
          width: '100%',
          textAlign: 'left',
          border: 'none',
          background: 'transparent',
          padding: `${spacing.md}px`,
          display: 'flex',
          alignItems: 'center',
          gap: spacing.sm,
          cursor: 'pointer',
        }}
      >
        <div
          aria-hidden="true"
          style={{
            width: 38,
            height: 38,
            borderRadius: radius.md,
            background: iconBackground || colors.greenLight,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 18,
            flexShrink: 0,
          }}
        >
          {'\u{1FAD0}'}
        </div>

        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: colors.dark,
                lineHeight: 1.25,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {parcelaTitle} - {soiTitle}
            </div>
            {parcelaTip ? (
              <span
                style={{
                  borderRadius: radius.full,
                  background: colors.grayLight,
                  color: colors.gray,
                  fontSize: 10,
                  fontWeight: 700,
                  lineHeight: 1,
                  padding: '4px 7px',
                  flexShrink: 0,
                }}
              >
                {parcelaTip}
              </span>
            ) : null}
          </div>
          <div
            style={{
              fontSize: 11,
              color: colors.gray,
              marginTop: 3,
              lineHeight: 1.2,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {'\u{1F464}'} {workerTitle} {'\u{1F550}'} {formattedTime}
          </div>
        </div>

        <div style={{ flexShrink: 0, textAlign: 'right' }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: colors.dark }}>{totalKg.toFixed(2)} kg</div>
          <div style={{ display: 'flex', gap: spacing.xs, marginTop: spacing.xs, justifyContent: 'flex-end' }}>
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: colors.green,
                background: colors.greenLight,
                padding: '2px 6px',
                borderRadius: radius.sm,
              }}
            >
              C1:{kgCal1.toFixed(2)}
            </span>
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: colors.coral,
                background: colors.coralLight,
                padding: '2px 6px',
                borderRadius: radius.sm,
              }}
            >
              C2:{kgCal2.toFixed(2)}
            </span>
          </div>
        </div>
      </button>

      {expanded ? (
        <div
          style={{
            borderTop: `1px solid ${colors.grayLight}`,
            padding: `${spacing.sm}px ${spacing.md}px ${spacing.md}px`,
            display: 'grid',
            gap: spacing.sm,
          }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: spacing.sm }}>
            <div
              style={{
                borderRadius: radius.md,
                padding: spacing.sm,
                background: colors.greenLight,
              }}
            >
              <div style={{ fontSize: 10, color: colors.gray }}>Valoare Cal I</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: colors.green }}>{valoareCal1.toFixed(2)} lei</div>
            </div>
            <div
              style={{
                borderRadius: radius.md,
                padding: spacing.sm,
                background: colors.coralLight,
              }}
            >
              <div style={{ fontSize: 10, color: colors.gray }}>Valoare Cal II</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: colors.coral }}>{valoareCal2.toFixed(2)} lei</div>
            </div>
            <div
              style={{
                borderRadius: radius.md,
                padding: spacing.sm,
                background: colors.grayLight,
              }}
            >
              <div style={{ fontSize: 10, color: colors.gray }}>Total</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: colors.dark }}>{valoareTotala.toFixed(2)} lei</div>
            </div>
          </div>

          <div style={{ fontSize: 11, color: colors.gray }}>
            Data: {formattedDate} {costMunca > 0 ? `- Munca: ${costMunca.toFixed(2)} lei` : ''}
          </div>

          <div style={{ display: 'flex', gap: spacing.sm }}>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                onView(recoltare)
              }}
              style={{
                flex: 1,
                border: 'none',
                background: colors.blueLight,
                color: colors.blue,
                borderRadius: radius.md,
                padding: '8px 10px',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {'\u{1F441}\uFE0F'} Vezi
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                onEdit(recoltare)
              }}
              style={{
                flex: 1,
                border: 'none',
                background: colors.yellowLight,
                color: colors.dark,
                borderRadius: radius.md,
                padding: '8px 10px',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {'\u270F\uFE0F'} Editează
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                onDelete(recoltare)
              }}
              style={{
                flex: 1,
                border: 'none',
                background: colors.coralLight,
                color: colors.coral,
                borderRadius: radius.md,
                padding: '8px 10px',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {'\u{1F5D1}\uFE0F'} Șterge
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
