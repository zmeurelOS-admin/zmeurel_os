'use client'

import TrendBadge from '@/components/ui/TrendBadge'
import { colors, radius, shadows, spacing } from '@/lib/design-tokens'
import { cn } from '@/lib/utils'

type MiniCardProps = {
  icon: string
  value: string
  sub: string
  label: string
  onClick?: () => void
  className?: string
  trend?: {
    value: number
    positive: boolean
  }
}

export default function MiniCard({
  icon,
  value,
  sub,
  label,
  onClick,
  className,
  trend,
}: MiniCardProps) {
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
        background: colors.white,
        border: `1px solid ${colors.grayLight}`,
        borderRadius: radius.xl,
        boxShadow: shadows.card,
        padding: '14px',
        cursor: onClick ? 'pointer' : 'default',
        gap: 6,
        minHeight: 96,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: spacing.sm,
        }}
      >
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
          {label ? (
            <span style={{ fontSize: 11, fontWeight: 700, color: colors.gray, lineHeight: 1.25 }}>
              {label}
            </span>
          ) : null}
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
          {trend ? <TrendBadge value={trend.value} positive={trend.positive} /> : null}
          {isClickable ? (
            <span aria-hidden="true" style={{ fontSize: 14, opacity: 0.35, color: colors.gray, lineHeight: 1 }}>
              {'\u203A'}
            </span>
          ) : null}
        </div>
      </div>

      <div style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.02em', color: colors.dark, lineHeight: 1.02 }}>
        {value}
      </div>

      <div style={{ fontSize: 11, color: colors.gray, lineHeight: 1.25 }}>{sub}</div>
    </button>
  )
}
