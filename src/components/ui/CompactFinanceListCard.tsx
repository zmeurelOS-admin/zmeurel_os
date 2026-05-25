'use client'

import type { ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'

import { cn } from '@/lib/utils'

/** Rând compact pentru liste financiare — același limbaj vizual ca `JurnalItem`. */
export type CompactFinanceListCardProps = {
  dateLabel: string
  title: string
  subtitle?: string
  meta?: string
  trailing?: ReactNode
  showChevron?: boolean
  isExpanded?: boolean
  onClick?: () => void
  bottomSlot?: ReactNode
  ariaLabel?: string
}

export function CompactFinanceListCard({
  dateLabel,
  title,
  subtitle,
  meta,
  trailing,
  showChevron = true,
  isExpanded = false,
  onClick,
  bottomSlot,
  ariaLabel,
}: CompactFinanceListCardProps) {
  return (
    <div className="w-full overflow-hidden rounded-2xl bg-[var(--surface-card)] text-left shadow-[var(--shadow-soft)]">
      <button
        type="button"
        aria-label={ariaLabel}
        aria-expanded={bottomSlot ? isExpanded : undefined}
        onClick={onClick}
        className="flex w-full items-center gap-3 p-3 text-left transition hover:bg-[var(--surface-card-elevated)] active:scale-[0.985]"
      >
        <div className="w-12 shrink-0 text-xs font-semibold uppercase leading-tight text-[var(--text-secondary)] tabular-nums">
          {dateLabel}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-[var(--text-primary)]">{title}</div>
          {subtitle ? (
            <div className="mt-0.5 truncate text-xs text-[var(--text-secondary)]">{subtitle}</div>
          ) : null}
          {meta ? <div className="mt-0.5 truncate text-xs text-[var(--text-secondary)]">{meta}</div> : null}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {trailing ? <div className="text-right">{trailing}</div> : null}
          {showChevron ? (
            <ChevronDown
              className={cn(
                'h-4 w-4 shrink-0 text-[var(--text-secondary)] transition-transform',
                isExpanded && 'rotate-180'
              )}
              aria-hidden
            />
          ) : null}
        </div>
      </button>
      {bottomSlot && isExpanded ? (
        <div className="border-t border-[var(--surface-divider)] px-3 pb-3 pt-2" onClick={(e) => e.stopPropagation()}>
          {bottomSlot}
        </div>
      ) : null}
    </div>
  )
}
