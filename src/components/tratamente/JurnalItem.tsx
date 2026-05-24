'use client'

import { CheckCircle2, FilePenLine } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { ro } from 'date-fns/locale'

import type { JurnalAplicareItem } from '@/lib/supabase/queries/tratamente'
import { cn } from '@/lib/utils'

export type JurnalItemProps = {
  item: JurnalAplicareItem
  onClick: () => void
}

function formatJurnalDate(value: string): string {
  try {
    return format(parseISO(value), 'd MMM', { locale: ro })
  } catch {
    return value.slice(0, 10)
  }
}

function produseTitle(item: JurnalAplicareItem): string {
  if (item.produse.length === 0) return 'Fără produse'
  const [first, ...rest] = item.produse
  return rest.length > 0 ? `${first?.nume ?? 'Produs'} +${rest.length}` : first?.nume ?? 'Produs'
}

function dozeSummary(item: JurnalAplicareItem): string {
  return item.produse
    .map((produs) => produs.dozaText)
    .filter(Boolean)
    .join(' + ')
}

export function JurnalItem({ item, onClick }: JurnalItemProps) {
  const isDraft = item.status === 'ciorna'

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-2xl bg-[var(--surface-card)] p-3 text-left shadow-[var(--shadow-soft)] transition hover:bg-[var(--surface-card-elevated)] active:scale-[0.985]"
    >
      <div className="w-14 shrink-0 text-xs font-semibold uppercase text-[var(--text-secondary)]">
        {formatJurnalDate(item.dataAplicata)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-[var(--text-primary)]">{item.parcelaNume}</div>
        <div className="mt-0.5 truncate text-sm text-[var(--text-primary)]">{produseTitle(item)}</div>
        {dozeSummary(item) ? (
          <div className="mt-0.5 truncate text-xs text-[var(--text-secondary)]">{dozeSummary(item)}</div>
        ) : null}
      </div>
      <div
        className={cn(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
          isDraft ? 'bg-[var(--status-warning-bg)] text-[var(--status-warning-text)]' : 'bg-[var(--status-success-bg)] text-[var(--status-success-text)]'
        )}
      >
        {isDraft ? <FilePenLine className="h-4 w-4" aria-hidden /> : <CheckCircle2 className="h-4 w-4" aria-hidden />}
      </div>
    </button>
  )
}
