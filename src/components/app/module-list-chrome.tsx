'use client'

import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

/** Suprafață comună pentru scoreboard-uri de listă (module mobile). */
export function ModuleScoreboard({
  tone = 'surface',
  className,
  children,
}: {
  tone?: 'surface' | 'tinted'
  className?: string
  children: ReactNode
}) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-baseline gap-3 rounded-[var(--agri-radius-lg)] border px-3.5 py-2.5 shadow-[var(--agri-shadow)]',
        tone === 'surface' && 'border-[var(--agri-border-card)] bg-[var(--agri-surface)]',
        tone === 'tinted' && 'border-[var(--pill-active-border)] bg-[var(--pill-active-bg)]',
        className,
      )}
    >
      {children}
    </div>
  )
}

export function ModulePillRow({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('flex flex-wrap gap-1.5', className)}>{children}</div>
}

/** Filtre tip pastilă (ex. timp, categorie) — același limbaj ca restul listelor. */
export function ModulePillFilterButton({
  active,
  onClick,
  children,
  activeTone = 'primary',
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
  /** `danger` = stil accent pentru filtre „critice” (ex. neîncasat). */
  activeTone?: 'primary' | 'danger'
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'cursor-pointer rounded-full px-3.5 py-1.5 text-[11px] font-semibold transition-colors',
        active && activeTone === 'danger'
          ? 'border border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] text-[var(--status-danger-text)]'
          : active
            ? 'border border-[var(--pill-active-border)] bg-[var(--pill-active-bg)] text-[var(--pill-active-text)]'
            : 'border border-[var(--pill-inactive-border)] bg-[var(--pill-inactive-bg)] text-[var(--pill-inactive-text)]',
      )}
    >
      {children}
    </button>
  )
}

/** Empty state centrat pentru liste filtrate / goale (nu înlocuiește EmptyState cu icon mare). */
export function ModuleEmptyCard({
  emoji,
  title,
  hint,
}: {
  emoji: ReactNode
  title: string
  hint: string
}) {
  return (
    <div className="rounded-[var(--agri-radius-lg)] border border-[var(--agri-border-card)] bg-[var(--agri-surface)] px-4 py-5 text-center shadow-[var(--agri-shadow)]">
      <div className="mb-2 text-4xl leading-none">{emoji}</div>
      <div className="mb-1 text-sm font-bold text-[var(--agri-text)]">{title}</div>
      <div className="text-xs text-[var(--agri-text-muted)]">{hint}</div>
    </div>
  )
}
