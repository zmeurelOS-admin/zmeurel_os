'use client'

import { useState } from 'react'

import { colors, radius, shadows, spacing } from '@/lib/design-tokens'
import type { Culegator } from '@/lib/supabase/queries/culegatori'

type CulegatorCardStats = {
  totalKgSeason: number
  totalRecoltari: number
  medieKgPerRecoltare: number
  lastRecoltare: {
    date: string
    parcela: string
    kg: number
  } | null
}

interface CulegatorCardProps {
  culegator: Culegator
  stats: CulegatorCardStats
  highlighted?: boolean
  onEdit: (culegator: Culegator) => void
  onDelete: (id: string, name: string) => void
}

function formatKg(value: number, maximumFractionDigits = 1) {
  return new Intl.NumberFormat('ro-RO', { maximumFractionDigits }).format(value)
}

export function CulegatorCard({
  culegator,
  stats,
  highlighted = false,
  onEdit,
  onDelete,
}: CulegatorCardProps) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div
      style={{
        borderRadius: radius.lg,
        border: `1px solid ${highlighted ? colors.primary : colors.grayLight}`,
        boxShadow: shadows.card,
        background: colors.white,
        overflow: 'hidden',
      }}
    >
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
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
            aria-hidden="true"
            style={{
              width: 40,
              height: 40,
              borderRadius: radius.md,
              background: colors.grayLight,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              fontSize: 18,
            }}
          >
            {'\u{1F464}'}
          </div>

          <div style={{ minWidth: 0, flex: 1 }}>
            <div
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: colors.dark,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {culegator.nume_prenume}
            </div>
            <a
              href={culegator.telefon ? `tel:${culegator.telefon}` : undefined}
              onClick={(event) => event.stopPropagation()}
              style={{
                marginTop: 2,
                display: 'inline-block',
                fontSize: 12,
                fontWeight: 600,
                color: colors.primary,
                textDecoration: 'none',
              }}
            >
              {culegator.telefon || '-'}
            </a>
          </div>

          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: colors.dark }}>{formatKg(stats.totalKgSeason, 1)} kg</div>
            <div style={{ fontSize: 10, color: colors.gray }}>kg sezon</div>
          </div>
        </div>

        <div style={{ marginTop: spacing.xs, fontSize: 11, color: colors.gray }}>
          {stats.totalRecoltari} recoltări total
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
            <div style={{ borderRadius: radius.md, background: colors.blueLight, padding: spacing.sm }}>
              <div style={{ fontSize: 10, color: colors.gray }}>Total sezon</div>
              <div style={{ marginTop: 2, fontSize: 13, fontWeight: 700, color: colors.dark }}>{formatKg(stats.totalKgSeason, 1)} kg</div>
            </div>
            <div style={{ borderRadius: radius.md, background: colors.grayLight, padding: spacing.sm }}>
              <div style={{ fontSize: 10, color: colors.gray }}>Nr recoltări</div>
              <div style={{ marginTop: 2, fontSize: 13, fontWeight: 700, color: colors.dark }}>{stats.totalRecoltari}</div>
            </div>
            <div style={{ borderRadius: radius.md, background: colors.greenLight, padding: spacing.sm }}>
              <div style={{ fontSize: 10, color: colors.gray }}>Medie kg/recoltare</div>
              <div style={{ marginTop: 2, fontSize: 13, fontWeight: 700, color: colors.green }}>{formatKg(stats.medieKgPerRecoltare, 1)} kg</div>
            </div>
          </div>

          <div
            style={{
              borderRadius: radius.md,
              border: `1px solid ${colors.grayLight}`,
              background: colors.white,
              padding: spacing.sm,
            }}
          >
            <div style={{ fontSize: 10, color: colors.gray }}>Ultima recoltare</div>
            {stats.lastRecoltare ? (
              <div style={{ marginTop: 2, fontSize: 12, fontWeight: 600, color: colors.dark }}>
                {stats.lastRecoltare.date} - {stats.lastRecoltare.parcela} - {formatKg(stats.lastRecoltare.kg, 1)} kg
              </div>
            ) : (
              <div style={{ marginTop: 2, fontSize: 12, color: colors.gray }}>Fără recoltări înregistrate</div>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: spacing.sm }}>
            <a
              href={culegator.telefon ? `tel:${culegator.telefon}` : undefined}
              onClick={(event) => event.stopPropagation()}
              style={{
                borderRadius: radius.md,
                border: 'none',
                background: colors.blueLight,
                color: colors.blue,
                fontSize: 12,
                fontWeight: 700,
                textDecoration: 'none',
                minHeight: 40,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {'\u{1F4DE}'} Sună
            </a>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                onEdit(culegator)
              }}
              style={{
                borderRadius: radius.md,
                border: 'none',
                background: colors.yellowLight,
                color: colors.dark,
                fontSize: 12,
                fontWeight: 700,
                minHeight: 40,
                cursor: 'pointer',
              }}
            >
              {'\u270F\uFE0F'} Edit
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                onDelete(culegator.id, culegator.nume_prenume)
              }}
              style={{
                borderRadius: radius.md,
                border: 'none',
                background: colors.coralLight,
                color: colors.coral,
                fontSize: 12,
                fontWeight: 700,
                minHeight: 40,
                cursor: 'pointer',
              }}
            >
              {'\u{1F5D1}\uFE0F'} Delete
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
