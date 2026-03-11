'use client'

import { useState } from 'react'

import { colors, radius, shadows, spacing } from '@/lib/design-tokens'
import { Investitie } from '@/lib/supabase/queries/investitii'

interface InvestitieCardProps {
  investitie: Investitie
  parcelaNume?: string
  onEdit: (investitie: Investitie) => void
  onDelete: (investitie: Investitie) => void
}

function normalizeText(value: string | null | undefined): string {
  return (value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function categoryEmoji(category: string | null | undefined): string {
  const value = normalizeText(category)
  if (value.includes('echip') || value.includes('utilaj')) return '🔧'
  if (value.includes('infra') || value.includes('solar') || value.includes('tunel') || value.includes('depoz')) return '🏗️'
  if (value.includes('saditor') || value.includes('butas')) return '🌿'
  return '📦'
}

export function InvestitieCard({ investitie, parcelaNume, onEdit, onDelete }: InvestitieCardProps) {
  const [expanded, setExpanded] = useState(false)
  const categorie = investitie.categorie || 'Altele'
  const emoji = categoryEmoji(categorie)
  const dataLabel = investitie.data ? new Date(investitie.data).toLocaleDateString('ro-RO') : '-'

  return (
    <div
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
              width: 36,
              height: 36,
              borderRadius: radius.md,
              background: colors.grayLight,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 16,
              flexShrink: 0,
            }}
          >
            {emoji}
          </div>

          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: colors.dark, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {investitie.descriere || 'Investitie'}
            </div>
            <div style={{ fontSize: 11, color: colors.gray }}>
              {[categorie, investitie.furnizor].filter(Boolean).join(' · ') || '-'}
            </div>
          </div>

          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: colors.dark }}>{Number(investitie.suma_lei || 0).toFixed(0)} RON</div>
            <div style={{ fontSize: 10, color: colors.gray }}>{dataLabel}</div>
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
          <div style={{ display: 'grid', gap: 4 }}>
            <div style={{ fontSize: 11, color: colors.gray }}>
              <strong style={{ color: colors.dark }}>Parcelă:</strong> {parcelaNume || '-'}
            </div>
            <div style={{ fontSize: 11, color: colors.gray }}>
              <strong style={{ color: colors.dark }}>Furnizor:</strong> {investitie.furnizor || '-'}
            </div>
            <div style={{ fontSize: 11, color: colors.gray }}>
              <strong style={{ color: colors.dark }}>Categorie:</strong> {categorie}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: spacing.sm }}>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                onEdit(investitie)
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
              ✏️ Edit
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                onDelete(investitie)
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
              🗑️ Delete
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
