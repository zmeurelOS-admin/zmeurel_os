'use client'

import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

/**
 * Panou dreapta pentru detalii entitate (pattern master–detail desktop).
 */
export function DesktopInspectorPanel({
  title,
  description,
  children,
  footer,
  className,
}: {
  title: string
  description?: string
  children: ReactNode
  footer?: ReactNode
  className?: string
}) {
  return (
    <aside
      className={cn(
        'flex max-h-[min(92vh,56rem)] flex-col overflow-hidden rounded-2xl border border-[var(--border-default)] bg-[var(--surface-card)] shadow-[var(--shadow-soft)]',
        className,
      )}
    >
      <div className="shrink-0 border-b border-[var(--divider)] px-4 py-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--text-secondary)]">{title}</h3>
        {description ? <p className="mt-1 text-xs leading-snug text-[var(--text-tertiary)]">{description}</p> : null}
      </div>
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-4">{children}</div>
      {footer ? (
        <div className="shrink-0 border-t border-[var(--divider)] px-4 py-3">{footer}</div>
      ) : null}
    </aside>
  )
}

export function DesktopInspectorSection({
  label,
  children,
  className,
}: {
  label: string
  children: ReactNode
  className?: string
}) {
  return (
    <section className={cn('space-y-2', className)}>
      <h4 className="text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--text-secondary)]">{label}</h4>
      <div className="space-y-1.5 text-sm text-[var(--text-secondary)]">{children}</div>
    </section>
  )
}
