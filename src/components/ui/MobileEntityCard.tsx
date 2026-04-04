'use client'

import type { ReactNode } from 'react'

import { getStatusToneTokens, type StatusTone } from '@/lib/ui/theme'
import { cn } from '@/lib/utils'

export type MobileEntityCardProps = {
  title: string
  subtitle?: string
  icon?: ReactNode
  mainValue?: string
  secondaryValue?: string
  meta?: string
  statusLabel?: string
  statusTone?: StatusTone
  variant?: 'default' | 'highlight' | 'muted'
  density?: 'compact' | 'normal'
  interactive?: boolean
  showChevron?: boolean
  /** `full` = conținut expandat lățime completă (ex. acțiuni pe terenuri). */
  bottomSlotAlign?: 'indented' | 'full'
  bottomSlot?: ReactNode
  onClick?: () => void
  ariaLabel?: string
}

// Contract standard pentru liste mobile: campuri predictibile, scanabile rapid.
// Modulele ar trebui sa mapeze datele in acest pattern, nu sa schimbe layout-ul local.
function getStatusPillClass(tone: StatusTone): string {
  const tokens = getStatusToneTokens(tone)
  return `border-[var(${tokens.border})] bg-[var(${tokens.bg})] text-[var(${tokens.text})]`
}

const variantSurface: Record<NonNullable<MobileEntityCardProps['variant']>, string> = {
  default: 'bg-[var(--surface-card)]',
  highlight: 'bg-[color:color-mix(in_srgb,var(--success-bg)_84%,var(--surface-card))]',
  muted: 'bg-[color:color-mix(in_srgb,var(--surface-card-muted)_92%,var(--surface-card))]',
}

export function MobileEntityCard({
  title,
  subtitle,
  icon,
  mainValue,
  secondaryValue,
  meta,
  statusLabel,
  statusTone = 'neutral',
  variant = 'default',
  density = 'normal',
  interactive,
  showChevron,
  bottomSlotAlign = 'indented',
  bottomSlot,
  onClick,
  ariaLabel,
}: MobileEntityCardProps) {
  const isInteractive = interactive ?? !!onClick
  const padding = density === 'compact' ? 'p-3.5' : 'p-4 sm:p-[18px]'
  const hasIcon = icon !== undefined && icon !== null

  return (
    <div
      data-slot="mobile-entity-card"
      role={isInteractive ? 'button' : undefined}
      tabIndex={isInteractive ? 0 : undefined}
      aria-label={ariaLabel}
      onClick={onClick}
      onKeyDown={
        isInteractive && onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onClick()
              }
            }
          : undefined
      }
      className={cn(
        'w-full rounded-[var(--agri-radius-lg)] border border-[var(--border-default)] text-left text-[var(--text-primary)] shadow-[var(--shadow-soft)] transition-[transform,box-shadow] duration-150 ease-out',
        variantSurface[variant],
        padding,
        isInteractive &&
          'cursor-pointer touch-manipulation select-none hover:shadow-[var(--shadow-elevated)] active:scale-[0.995] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[color-mix(in_srgb,var(--focus-ring)_28%,transparent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-page)]'
      )}
    >
      <div className={cn('flex min-h-[48px] items-center gap-3', density === 'compact' && 'min-h-[44px]')}>
        {hasIcon ? (
          <div
            className="flex h-[40px] w-[40px] shrink-0 items-center justify-center rounded-xl border border-[var(--border-default)] bg-[var(--surface-card-muted)] text-[18px] text-[var(--text-secondary)]"
          >
            {icon}
          </div>
        ) : null}

        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px] leading-tight tracking-[-0.015em] text-[var(--text-primary)] [font-weight:650]">
            {title}
          </div>
          {subtitle ? (
            <div className="mt-0.5 truncate text-[13px] leading-snug text-[var(--text-secondary)]">
              {subtitle}
            </div>
          ) : null}
        </div>

        <div className="flex min-w-0 shrink-0 items-center gap-2">
          {mainValue || statusLabel || secondaryValue ? (
            <div className="flex max-w-[min(52vw,12.5rem)] flex-col items-end gap-1 text-right">
              {mainValue ? (
                <div className="break-words text-[clamp(1.05rem,4.2vw,1.2rem)] font-bold leading-tight tracking-[-0.03em] text-[var(--text-primary)] tabular-nums [font-weight:750]">
                  {mainValue}
                </div>
              ) : null}
              {secondaryValue ? (
                <div className="max-w-full break-words text-[12px] leading-snug text-[var(--text-secondary)]">
                  {secondaryValue}
                </div>
              ) : null}
              {statusLabel ? (
                <span
                  className={cn(
                    'inline-flex max-w-full items-center truncate rounded-md border px-2 py-0.5 text-[10px] font-semibold leading-tight tracking-wide',
                    getStatusPillClass(statusTone)
                  )}
                >
                  {statusLabel}
                </span>
              ) : null}
            </div>
          ) : null}

          {showChevron ? (
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              className="shrink-0 text-[color:color-mix(in_srgb,var(--text-secondary)_85%,var(--text-primary))]"
              aria-hidden
            >
              <path
                d="M5 3l4 4-4 4"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          ) : null}
        </div>
      </div>

      {meta ? (
        <div
          className={cn(
            'mt-2 text-[12px] leading-snug text-[var(--text-secondary)]',
            hasIcon && 'pl-[54px]'
          )}
        >
          {meta}
        </div>
      ) : null}

      {bottomSlot ? (
        <div
          className={cn(
            'mt-3',
            bottomSlotAlign === 'indented' && hasIcon && 'pl-[54px]',
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {bottomSlot}
        </div>
      ) : null}
    </div>
  )
}
