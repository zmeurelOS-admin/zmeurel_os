'use client'

import { colors, radius, shadows, spacing } from '@/lib/design-tokens'

interface WelcomeCardProps {
  onAddTerrain: () => void
  onDismiss: () => void
}

export function WelcomeCard({ onAddTerrain, onDismiss }: WelcomeCardProps) {
  return (
    <div
      style={{
        position: 'relative',
        background: colors.coralLight,
        borderRadius: radius.xl,
        boxShadow: shadows.card,
        border: `1px solid ${colors.coral}`,
        padding: spacing.xxl,
        textAlign: 'center',
      }}
    >
      <button
        type="button"
        aria-label="Închide ghidul"
        onClick={onDismiss}
        style={{
          position: 'absolute',
          top: 12,
          right: 12,
          border: 'none',
          background: 'transparent',
          color: colors.gray,
          fontSize: 18,
          lineHeight: 1,
          cursor: 'pointer',
          padding: '4px 8px',
          borderRadius: radius.sm,
        }}
      >
        ✕
      </button>

      <div style={{ fontSize: 40, lineHeight: 1, marginBottom: spacing.md }}>🌱</div>
      <h2 style={{ fontSize: 20, fontWeight: 700, lineHeight: 1.2, margin: 0, color: colors.dark }}>
        Bine ai venit! Începe prin a adăuga primul teren.
      </h2>
      <button
        type="button"
        onClick={onAddTerrain}
        style={{
          display: 'block',
          width: '100%',
          marginTop: spacing.lg,
          border: 'none',
          borderRadius: radius.lg,
          background: colors.primary,
          color: colors.white,
          fontWeight: 700,
          fontSize: 14,
          padding: '14px',
          minHeight: 48,
          cursor: 'pointer',
        }}
      >
        Adaugă teren
      </button>
      <p style={{ marginTop: spacing.sm, color: colors.gray, fontSize: 12 }}>
        După ce adaugi terenul, poți nota activități agricole, cheltuieli, recoltări, comenzi și vânzări din meniul aplicației.
      </p>
      <button
        type="button"
        onClick={onDismiss}
        style={{
          display: 'inline-block',
          marginTop: spacing.xs,
          border: 'none',
          background: 'transparent',
          color: colors.gray,
          fontSize: 11,
          cursor: 'pointer',
          textDecoration: 'underline',
          padding: 0,
        }}
      >
        Nu am nevoie de ghid
      </button>
    </div>
  )
}
