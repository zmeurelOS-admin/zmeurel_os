'use client'

import { useState } from 'react'

import { colors, radius, shadows, spacing } from '@/lib/design-tokens'
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
      style={{
        borderRadius: radius.lg,
        border: `1px solid ${colors.grayLight}`,
        borderLeft: `4px solid ${incasata ? colors.green : colors.yellow}`,
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
        {isNewFromComandaToday ? (
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: spacing.xs,
              borderRadius: radius.sm,
              padding: '3px 8px',
              fontSize: 10,
              fontWeight: 700,
              color: colors.green,
              background: colors.greenLight,
              marginBottom: spacing.xs,
            }}
          >
            {'\u{1F195}'} Din comanda livrată azi
          </div>
        ) : null}

        <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
          <div
            aria-hidden="true"
            style={{
              width: 36,
              height: 36,
              borderRadius: radius.md,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: incasata ? colors.greenLight : colors.yellowLight,
              fontSize: 16,
              flexShrink: 0,
            }}
          >
            {incasata ? '\u2705' : '\u23F3'}
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
              {clientNume}
            </div>
            <div style={{ fontSize: 11, color: colors.gray }}>{dataVanzare}</div>
          </div>

          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: colors.dark }}>{formatCurrency(totalRon)}</div>
            <div style={{ fontSize: 10, color: colors.gray }}>
              {formatKg(vanzare.cantitate_kg)} kg × {formatKg(vanzare.pret_lei_kg)} lei
            </div>
          </div>
        </div>

        <div
          style={{
            marginTop: spacing.sm,
            paddingTop: spacing.sm,
            borderTop: `1px solid ${colors.grayLight}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: spacing.sm, flex: 1 }}>
            <div>
              <div style={{ fontSize: 10, color: colors.gray }}>CANTITATE</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: colors.dark }}>{formatKg(vanzare.cantitate_kg)} kg</div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: colors.gray }}>PRET</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: colors.dark }}>{formatKg(vanzare.pret_lei_kg)} lei/kg</div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: colors.gray }}>TOTAL</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: colors.green }}>{formatCurrency(totalRon)}</div>
            </div>
          </div>

          <div
            style={{
              fontSize: 16,
              color: colors.gray,
              marginLeft: spacing.sm,
              transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 180ms ease',
            }}
          >
            ▾
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
            <div style={{ borderRadius: radius.md, background: colors.grayLight, padding: spacing.sm }}>
              <div style={{ fontSize: 10, color: colors.gray }}>Cantitate</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: colors.dark }}>{formatKg(vanzare.cantitate_kg)} kg</div>
            </div>
            <div style={{ borderRadius: radius.md, background: colors.grayLight, padding: spacing.sm }}>
              <div style={{ fontSize: 10, color: colors.gray }}>Pret</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: colors.dark }}>{formatKg(vanzare.pret_lei_kg)} lei/kg</div>
            </div>
            <div style={{ borderRadius: radius.md, background: incasata ? colors.greenLight : colors.yellowLight, padding: spacing.sm }}>
              <div style={{ fontSize: 10, color: colors.gray }}>Status</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: incasata ? colors.green : colors.dark }}>{incasata ? 'Incasata' : 'Neincasata'}</div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: spacing.sm }}>
            {!incasata ? (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation()
                  onMarkPaid?.(vanzare)
                }}
                style={{
                  gridColumn: 'span 2',
                  minHeight: 48,
                  border: 'none',
                  borderRadius: radius.md,
                  background: colors.green,
                  color: colors.white,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {'\u2705'} Marcheaza incasata
              </button>
            ) : null}

            <a
              href={telefon ? `tel:${telefon}` : undefined}
              onClick={(event) => event.stopPropagation()}
              style={{
                minHeight: 48,
                borderRadius: radius.md,
                background: colors.blueLight,
                color: colors.blue,
                textDecoration: 'none',
                fontSize: 12,
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {'\u{1F4DE}'}
            </a>

            {vanzare.comanda_id ? (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation()
                  onOpenComanda?.()
                }}
                style={{
                  minHeight: 48,
                  border: 'none',
                  borderRadius: radius.md,
                  background: colors.grayLight,
                  color: colors.dark,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {'\u{1F4CB}'} Comanda
              </button>
            ) : null}

            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                onEdit(vanzare)
              }}
              style={{
                minHeight: 48,
                border: 'none',
                borderRadius: radius.md,
                background: colors.yellowLight,
                color: colors.dark,
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {'\u270F\uFE0F'} Edit
            </button>

            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                onDelete(vanzare)
              }}
              style={{
                minHeight: 48,
                border: 'none',
                borderRadius: radius.md,
                background: colors.coralLight,
                color: colors.coral,
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {'\u{1F5D1}\uFE0F'}
            </button>
          </div>

          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              onView(vanzare)
            }}
            style={{
              border: 'none',
              background: colors.white,
              color: colors.primary,
              fontSize: 12,
              fontWeight: 700,
              textAlign: 'left',
              padding: 0,
              cursor: 'pointer',
            }}
          >
            Vezi detalii complete
          </button>
        </div>
      ) : null}
    </div>
  )
}
