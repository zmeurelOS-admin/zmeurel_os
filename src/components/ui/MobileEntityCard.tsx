'use client'

import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

export type MobileEntityCardProps = {
  title: string
  subtitle?: string
  icon?: ReactNode
  mainValue?: string
  secondaryValue?: string
  meta?: string
  statusLabel?: string
  statusTone?: 'neutral' | 'success' | 'warning' | 'danger'
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

/** Badge status — aliniat la design system (border + fundal discret + text) */
const statusPillClass: Record<NonNullable<MobileEntityCardProps['statusTone']>, string> = {
  success:
    'border-[var(--status-success-border)] bg-[var(--status-success-bg)] text-[var(--status-success-text)] dark:border-emerald-500/35 dark:bg-emerald-950/40 dark:text-[var(--soft-success-text)]',
  warning:
    'border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] text-[var(--status-warning-text)] dark:border-amber-500/35 dark:bg-amber-950/35 dark:text-[var(--soft-warning-text)]',
  danger:
    'border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] text-[var(--status-danger-text)] dark:border-red-500/35 dark:bg-red-950/35 dark:text-[var(--soft-danger-text)]',
  neutral:
    'border-[var(--status-neutral-border)] bg-[var(--status-neutral-bg)] text-[var(--status-neutral-text)] dark:border-slate-600 dark:bg-slate-800/80 dark:text-slate-300',
}

const variantSurface: Record<NonNullable<MobileEntityCardProps['variant']>, string> = {
  default: 'bg-[var(--agri-surface)]',
  highlight: 'bg-[color:color-mix(in_srgb,var(--status-success-bg)_88%,var(--agri-surface))] dark:bg-emerald-950/25',
  muted: 'bg-[color:color-mix(in_srgb,var(--agri-surface-muted)_92%,var(--agri-surface))]',
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
  const padding = density === 'compact' ? 'p-3.5' : 'p-[18px]'
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
        'w-full rounded-[var(--agri-radius-lg)] border border-[var(--agri-border-card)] text-left shadow-[var(--agri-shadow)] transition-[transform,box-shadow] duration-150 ease-out',
        variantSurface[variant],
        padding,
        isInteractive &&
          'cursor-pointer touch-manipulation select-none hover:shadow-[var(--agri-elevated-shadow-hover)] active:scale-[0.99] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[color-mix(in_srgb,var(--agri-primary)_32%,transparent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--agri-bg)]'
      )}
    >
      <div className={cn('flex min-h-[48px] items-center gap-3', density === 'compact' && 'min-h-[44px]')}>
        {hasIcon ? (
          <div
            className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-xl text-[20px] shadow-[inset_0_1px_2px_rgba(0,0,0,0.05)] dark:shadow-[inset_0_1px_2px_rgba(255,255,255,0.06)]"
            style={{
              background: 'linear-gradient(135deg, var(--agri-surface-muted) 0%, color-mix(in srgb, var(--agri-surface-muted) 88%, var(--agri-border)) 100%)',
            }}
          >
            {icon}
          </div>
        ) : null}

        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px] font-semibold leading-tight tracking-[-0.015em] text-[var(--agri-text)] [font-weight:650]">
            {title}
          </div>
          {subtitle ? (
            <div className="mt-0.5 truncate text-[13px] leading-snug text-[var(--agri-text-muted)]">
              {subtitle}
            </div>
          ) : null}
        </div>

        <div className="flex min-w-0 shrink-0 items-center gap-2">
          {mainValue || statusLabel || secondaryValue ? (
            <div className="flex max-w-[min(52vw,12.5rem)] flex-col items-end gap-1 text-right">
              {mainValue ? (
                <div className="break-words text-[clamp(1.05rem,4.2vw,1.2rem)] font-bold leading-tight tracking-[-0.03em] text-[var(--agri-text)] tabular-nums [font-weight:750]">
                  {mainValue}
                </div>
              ) : null}
              {secondaryValue ? (
                <div className="max-w-full break-words text-[12px] leading-snug text-[var(--agri-text-muted)]">
                  {secondaryValue}
                </div>
              ) : null}
              {statusLabel ? (
                <span
                  className={cn(
                    'inline-flex max-w-full items-center truncate rounded-full border px-2 py-0.5 text-[11px] font-semibold leading-tight tracking-wide',
                    statusPillClass[statusTone]
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
              className="shrink-0 text-[var(--agri-text-muted)]"
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
            'mt-2 text-[12px] font-medium leading-snug text-[var(--agri-text-muted)]',
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
