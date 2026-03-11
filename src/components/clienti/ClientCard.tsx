'use client'

import { useEffect, useRef, useState, type MouseEvent } from 'react'

import { colors, radius, shadows, spacing } from '@/lib/design-tokens'
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
      style={{
        borderRadius: radius.lg,
        border: `1px solid ${colors.grayLight}`,
        boxShadow: shadows.card,
        background: colors.white,
        overflow: 'hidden',
      }}
    >
      <button
        type="button"
        onClick={() => setExpanded((current) => !current)}
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
              background: hasRecentSales ? colors.greenLight : colors.grayLight,
              fontSize: 18,
              flexShrink: 0,
            }}
          >
            🤝
          </div>

          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: colors.dark, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {client.nume_client}
            </div>
            <a
              href={phoneHref}
              onClick={(event) => event.stopPropagation()}
              style={{ fontSize: 12, fontWeight: 600, color: colors.primary, textDecoration: 'none' }}
            >
              {client.telefon || '-'}
            </a>
            <div style={{ fontSize: 10, color: colors.gray, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{client.adresa || '-'}</div>
          </div>

          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: colors.dark }}>{totalRon.toFixed(0)} RON</div>
            <div style={{ fontSize: 10, color: colors.gray }}>
              {comenziCount} comenzi · {vanzariCount} vânzări
            </div>
            {unpaidRon > 0 ? (
              <span
                style={{
                  display: 'inline-flex',
                  marginTop: 4,
                  borderRadius: radius.sm,
                  background: colors.yellowLight,
                  color: colors.dark,
                  padding: '2px 6px',
                  fontSize: 10,
                  fontWeight: 700,
                }}
              >
                💸 {unpaidRon.toFixed(0)} RON
              </span>
            ) : null}
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: spacing.xs }}>
            <div style={{ borderRadius: radius.md, background: colors.grayLight, padding: `${spacing.xs + 2}px ${spacing.xs}` }}>
              <div style={{ fontSize: 9, color: colors.gray }}>Total cumparat</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: colors.dark }}>{totalRon.toFixed(0)} RON</div>
            </div>
            <div style={{ borderRadius: radius.md, background: colors.grayLight, padding: `${spacing.xs + 2}px ${spacing.xs}` }}>
              <div style={{ fontSize: 9, color: colors.gray }}>Nr comenzi</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: colors.dark }}>{comenziCount}</div>
            </div>
            <div style={{ borderRadius: radius.md, background: colors.grayLight, padding: `${spacing.xs + 2}px ${spacing.xs}` }}>
              <div style={{ fontSize: 9, color: colors.gray }}>Nr vânzări</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: colors.dark }}>{vanzariCount}</div>
            </div>
          </div>

          <div style={{ display: 'grid', gap: 4 }}>
            <div style={{ fontSize: 11, color: colors.gray }}>
              <strong style={{ color: colors.dark }}>Ultima comanda:</strong>{' '}
              {lastComanda ? `${formatDate(lastComanda.data)} · ${lastComanda.kg.toFixed(1)} kg · ${lastComanda.status}` : '-'}
            </div>
            <div style={{ fontSize: 11, color: colors.gray }}>
              <strong style={{ color: colors.dark }}>Ultima vânzare:</strong>{' '}
              {lastVanzare ? `${formatDate(lastVanzare.data)} · ${lastVanzare.kg.toFixed(1)} kg · ${lastVanzare.totalRon.toFixed(0)} RON` : '-'}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: spacing.xs }}>
            <a
              href={phoneHref}
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
              📞
            </a>
            <a
              href={waHref || undefined}
              target="_blank"
              rel="noreferrer"
              onClick={(event) => event.stopPropagation()}
              style={{
                minHeight: 48,
                borderRadius: radius.md,
                background: colors.greenLight,
                color: colors.green,
                textDecoration: 'none',
                fontSize: 12,
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              💬
            </a>
            <button
              type="button"
              onClick={(event: MouseEvent<HTMLButtonElement>) => {
                event.stopPropagation()
                onEdit(client)
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
              ✏️
            </button>
            <button
              type="button"
              onClick={(event: MouseEvent<HTMLButtonElement>) => {
                event.stopPropagation()
                onDelete(client.id)
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
              🗑️
            </button>
            <button
              type="button"
              onClick={(event: MouseEvent<HTMLButtonElement>) => {
                event.stopPropagation()
                onOpenDetails?.(client)
              }}
              style={{
                minHeight: 48,
                border: 'none',
                borderRadius: radius.md,
                background: colors.grayLight,
                color: colors.dark,
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Detalii
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
