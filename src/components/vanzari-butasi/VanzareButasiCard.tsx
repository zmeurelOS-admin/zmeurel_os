'use client'

import { useMemo, useState } from 'react'

import { colors, radius, shadows, spacing } from '@/lib/design-tokens'
import { type VanzareButasi } from '@/lib/supabase/queries/vanzari-butasi'

interface VanzareButasiCardProps {
  vanzare: VanzareButasi
  clientNume?: string
  clientTelefon?: string | null
  parcelaNume?: string
  onView: (vanzare: VanzareButasi) => void
  onEdit: (vanzare: VanzareButasi) => void
  onDelete: (vanzare: VanzareButasi) => void
}

const currencyFormatter = new Intl.NumberFormat('ro-RO', { maximumFractionDigits: 0 })

function formatLei(value: number): string {
  return `${currencyFormatter.format(Math.round(value))} lei`
}

function formatDate(value: string | null | undefined): string {
  if (!value) return 'Nespecificata'
  return new Date(value).toLocaleDateString('ro-RO')
}

function toTelHref(phone: string | null | undefined): string | null {
  if (!phone) return null
  const cleaned = phone.replace(/\s+/g, '')
  return cleaned ? `tel:${cleaned}` : null
}

function toWhatsappHref(phone: string | null | undefined): string | null {
  if (!phone) return null

  const digits = phone.replace(/\s+/g, '').replace(/[^\d]/g, '')
  if (!digits) return null

  const localWithoutLeadingZero = digits.replace(/^0+/, '')
  if (!localWithoutLeadingZero) return null

  return `https://wa.me/4${localWithoutLeadingZero}`
}

export function VanzareButasiCard({
  vanzare,
  clientNume,
  clientTelefon,
  parcelaNume,
  onView,
  onEdit,
  onDelete,
}: VanzareButasiCardProps) {
  const [expanded, setExpanded] = useState(false)

  const totalLei = Number(vanzare.total_lei || 0)
  const avans = Number(vanzare.avans_suma || 0)
  const restDePlata = Math.max(0, totalLei - avans)

  const items = useMemo(() => {
    if (vanzare.items?.length) return vanzare.items

    if (vanzare.soi_butasi && Number(vanzare.cantitate_butasi || 0) > 0) {
      const cantitate = Number(vanzare.cantitate_butasi || 0)
      const pretUnitar = Number(vanzare.pret_unitar_lei || 0)
      return [
        {
          id: `${vanzare.id}-legacy-item`,
          tenant_id: vanzare.tenant_id || '',
          comanda_id: vanzare.id,
          soi: vanzare.soi_butasi,
          cantitate,
          pret_unitar: pretUnitar,
          subtotal: cantitate * pretUnitar,
          created_at: vanzare.created_at,
        },
      ]
    }

    return []
  }, [vanzare])

  const totalBucati = useMemo(
    () => items.reduce((sum, item) => sum + Number(item.cantitate || 0), 0),
    [items]
  )

  const soiSummary = useMemo(
    () => items.map((item) => `${item.soi} ×${Number(item.cantitate || 0)}`).join(', '),
    [items]
  )

  const telHref = toTelHref(clientTelefon)
  const whatsappHref = toWhatsappHref(clientTelefon)

  const borderLeftColor =
    vanzare.status === 'noua'
      ? colors.gray
      : restDePlata > 0
      ? colors.yellow
      : colors.green

  return (
    <div
      style={{
        background: colors.white,
        borderRadius: radius.lg,
        boxShadow: shadows.card,
        borderLeft: `4px solid ${borderLeftColor}`,
        overflow: 'hidden',
      }}
      onDoubleClick={() => onView(vanzare)}
    >
      <div
        role="button"
        tabIndex={0}
        onClick={() => setExpanded((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            setExpanded((current) => !current)
          }
        }}
        style={{
          cursor: 'pointer',
          padding: spacing.md,
          outline: 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: spacing.sm }}>
          <div
            aria-hidden="true"
            style={{
              width: 40,
              height: 40,
              borderRadius: radius.md,
              background: colors.greenLight,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              fontSize: 18,
            }}
          >
            {'\u{1F33F}'}
          </div>

          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.sm }}>
              <div style={{ minWidth: 0 }}>
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
                  {clientNume || 'Client necunoscut'}
                </div>
                {telHref ? (
                  <a
                    href={telHref}
                    onClick={(event) => event.stopPropagation()}
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: colors.primary,
                      textDecoration: 'none',
                    }}
                  >
                    {clientTelefon}
                  </a>
                ) : (
                  <span style={{ fontSize: 12, color: colors.gray }}>Telefon lipsă</span>
                )}
              </div>

              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: colors.dark }}>{currencyFormatter.format(Math.round(totalLei))} RON</div>
                <div style={{ fontSize: 10, color: colors.gray }}>{currencyFormatter.format(totalBucati)} bucati</div>
              </div>
            </div>

            <div
              style={{
                marginTop: spacing.xs,
                fontSize: 11,
                color: colors.gray,
                lineHeight: 1.35,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {soiSummary || 'Fără soiuri înregistrate'}
            </div>

            <div style={{ marginTop: spacing.sm, display: 'flex', flexWrap: 'wrap', gap: spacing.xs }}>
              {avans > 0 ? (
                <span
                  style={{
                    borderRadius: radius.full,
                    background: colors.greenLight,
                    color: colors.green,
                    fontSize: 10,
                    fontWeight: 700,
                    padding: '4px 8px',
                  }}
                >
                  Avans: {currencyFormatter.format(Math.round(avans))} lei
                </span>
              ) : null}
              {restDePlata > 0 ? (
                <span
                  style={{
                    borderRadius: radius.full,
                    background: colors.yellowLight,
                    color: '#9A6A00',
                    fontSize: 10,
                    fontWeight: 700,
                    padding: '4px 8px',
                  }}
                >
                  Rest: {currencyFormatter.format(Math.round(restDePlata))} lei
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {expanded ? (
        <div
          style={{
            borderTop: `1px solid ${colors.grayLight}`,
            padding: spacing.md,
            background: '#FCFDFC',
          }}
        >
          <div
            style={{
              overflowX: 'auto',
              borderRadius: radius.md,
              border: `1px solid ${colors.grayLight}`,
              background: colors.white,
            }}
          >
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ fontSize: 11, color: colors.gray, textAlign: 'left', padding: '8px 10px' }}>Soi</th>
                  <th style={{ fontSize: 11, color: colors.gray, textAlign: 'right', padding: '8px 10px' }}>Cantitate</th>
                  <th style={{ fontSize: 11, color: colors.gray, textAlign: 'right', padding: '8px 10px' }}>Pret</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} style={{ borderTop: `1px solid ${colors.grayLight}` }}>
                    <td style={{ fontSize: 12, fontWeight: 600, color: colors.dark, padding: '8px 10px' }}>{item.soi}</td>
                    <td style={{ fontSize: 12, fontWeight: 600, color: colors.dark, textAlign: 'right', padding: '8px 10px' }}>
                      {currencyFormatter.format(Number(item.cantitate || 0))}
                    </td>
                    <td style={{ fontSize: 12, fontWeight: 600, color: colors.dark, textAlign: 'right', padding: '8px 10px' }}>
                      {currencyFormatter.format(Math.round(Number(item.pret_unitar || 0)))} lei
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: spacing.sm, display: 'flex', flexWrap: 'wrap', gap: spacing.xs }}>
            <span
              style={{
                borderRadius: radius.md,
                background: colors.greenLight,
                color: colors.green,
                fontSize: 11,
                fontWeight: 700,
                padding: '5px 8px',
              }}
            >
              Avans: {formatLei(avans)}
            </span>
            <span
              style={{
                borderRadius: radius.md,
                background: restDePlata > 0 ? colors.yellowLight : colors.greenLight,
                color: restDePlata > 0 ? '#9A6A00' : colors.green,
                fontSize: 11,
                fontWeight: 700,
                padding: '5px 8px',
              }}
            >
              Rest: {formatLei(restDePlata)}
            </span>
            <span
              style={{
                borderRadius: radius.md,
                background: colors.grayLight,
                color: colors.dark,
                fontSize: 11,
                fontWeight: 700,
                padding: '5px 8px',
              }}
            >
              Livrare: {formatDate(vanzare.data_livrare_estimata)}
            </span>
            {parcelaNume ? (
              <span
                style={{
                  borderRadius: radius.md,
                  background: colors.blueLight,
                  color: colors.dark,
                  fontSize: 11,
                  fontWeight: 700,
                  padding: '5px 8px',
                }}
              >
                Teren: {parcelaNume}
              </span>
            ) : null}
          </div>

          <div style={{ marginTop: spacing.md, display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: spacing.xs }}>
            {telHref ? (
              <a
                href={telHref}
                style={{
                  borderRadius: radius.md,
                  background: colors.white,
                  border: `1px solid ${colors.grayLight}`,
                  color: colors.dark,
                  fontSize: 12,
                  fontWeight: 700,
                  textAlign: 'center',
                  padding: '8px 6px',
                  textDecoration: 'none',
                }}
              >
                {'\u{1F4DE}'} Sună
              </a>
            ) : (
              <span
                style={{
                  borderRadius: radius.md,
                  background: colors.grayLight,
                  color: colors.gray,
                  fontSize: 12,
                  fontWeight: 700,
                  textAlign: 'center',
                  padding: '8px 6px',
                }}
              >
                {'\u{1F4DE}'} Sună
              </span>
            )}

            {whatsappHref ? (
              <a
                href={whatsappHref}
                target="_blank"
                rel="noreferrer"
                style={{
                  borderRadius: radius.md,
                  background: colors.white,
                  border: `1px solid ${colors.grayLight}`,
                  color: colors.dark,
                  fontSize: 12,
                  fontWeight: 700,
                  textAlign: 'center',
                  padding: '8px 6px',
                  textDecoration: 'none',
                }}
              >
                {'\u{1F4AC}'} WhatsApp
              </a>
            ) : (
              <span
                style={{
                  borderRadius: radius.md,
                  background: colors.grayLight,
                  color: colors.gray,
                  fontSize: 12,
                  fontWeight: 700,
                  textAlign: 'center',
                  padding: '8px 6px',
                }}
              >
                {'\u{1F4AC}'} WhatsApp
              </span>
            )}

            <button
              type="button"
              onClick={() => onEdit(vanzare)}
              style={{
                borderRadius: radius.md,
                background: colors.white,
                border: `1px solid ${colors.grayLight}`,
                color: colors.dark,
                fontSize: 12,
                fontWeight: 700,
                padding: '8px 6px',
                cursor: 'pointer',
              }}
            >
              {'\u{270F}\u{FE0F}'} Edit
            </button>

            <button
              type="button"
              onClick={() => onDelete(vanzare)}
              style={{
                borderRadius: radius.md,
                background: colors.white,
                border: `1px solid #F4C6C6`,
                color: '#B42318',
                fontSize: 12,
                fontWeight: 700,
                padding: '8px 6px',
                cursor: 'pointer',
              }}
            >
              {'\u{1F5D1}\u{FE0F}'} Delete
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
