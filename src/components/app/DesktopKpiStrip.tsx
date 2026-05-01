'use client'

import type { LucideIcon } from 'lucide-react'

import { cn } from '@/lib/utils'

export type DesktopKpiItem = {
  icon: LucideIcon
  label: string
  value: string
}

/** Rând KPI desktop: card alb, 4 coloane egale, icon discret, fără fundal verde pal. */
export function DesktopKpiStrip({ items, className }: { items: DesktopKpiItem[]; className?: string }) {
  if (items.length === 0) return null

  return (
    <div
      className={cn(
        'hidden overflow-hidden rounded-2xl border border-[var(--border-default)] bg-[var(--surface-card)] shadow-[var(--shadow-soft)] md:grid',
        items.length === 4 && 'md:grid-cols-4',
        items.length === 3 && 'md:grid-cols-3',
        items.length === 2 && 'md:grid-cols-2',
        items.length > 4 && 'md:grid-cols-4',
        className,
      )}
    >
      {items.map((item, index) => {
        const Icon = item.icon
        return (
          <div
            key={`${item.label}-${index}`}
            className={cn(
              'flex min-w-0 items-center gap-3 px-4 py-4',
              index > 0 && 'border-t border-[var(--divider)] md:border-l md:border-t-0',
            )}
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[var(--border-default)] bg-[var(--surface-page)] text-[var(--agri-primary)] dark:bg-[var(--surface-card-muted)]">
              <Icon className="h-5 w-5" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-tertiary)]">
                {item.label}
              </div>
              <div className="truncate text-lg font-bold tracking-tight text-[var(--text-primary)]">{item.value}</div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
