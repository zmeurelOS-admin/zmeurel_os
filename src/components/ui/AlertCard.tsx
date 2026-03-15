'use client'

import { colors, radius, shadows, spacing } from '@/lib/design-tokens'
import { cn } from '@/lib/utils'

type AlertVariant = 'success' | 'warning' | 'danger'

type AlertCardProps = {
  icon: string
  label: string
  value: string
  sub: string
  variant: AlertVariant
  onClick?: () => void
  className?: string
}

const variantMap: Record<AlertVariant, { bg: string; border: string }> = {
  success: { bg: colors.greenLight, border: colors.green },
  warning: { bg: colors.yellowLight, border: colors.yellow },
  danger: { bg: colors.coralLight, border: colors.coral },
}

export default function AlertCard({
  icon,
  label,
  value,
  sub,
  variant,
  onClick,
  className,
}: AlertCardProps) {
  const theme = variantMap[variant]
  const isClickable = Boolean(onClick)

  return (
    <button
      className={cn(
        'flex h-full flex-col justify-between text-left transition-transform duration-120 active:scale-[0.98]',
        className
      )}
      type="button"
      onClick={onClick}
      style={{
        width: '100%',
        background: theme.bg,
        border: `1px solid ${theme.border}`,
        borderRadius: radius.lg,
        boxShadow: shadows.card,
        padding: 14,
        cursor: onClick ? 'pointer' : 'default',
        gap: 6,
        minHeight: 96,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.sm }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 7, minWidth: 0 }}>
          <span
            aria-hidden="true"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 20,
              height: 20,
              fontSize: 20,
              lineHeight: 1,
              flexShrink: 0,
            }}
          >
            {icon}
          </span>
          <span style={{ fontSize: 13, fontWeight: 700, color: colors.dark, lineHeight: 1.25 }}>{label}</span>
        </div>
        {isClickable ? (
          <span aria-hidden="true" style={{ fontSize: 14, opacity: 0.35, color: colors.gray, lineHeight: 1 }}>
            {'\u203A'}
          </span>
        ) : null}
      </div>
      <div style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.02em', color: colors.dark, lineHeight: 1.02 }}>
        {value}
      </div>
      <div style={{ fontSize: 11, color: colors.gray, lineHeight: 1.25 }}>{sub}</div>
    </button>
  )
}
