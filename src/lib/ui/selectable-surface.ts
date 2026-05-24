import { cn } from '@/lib/utils'

/** Fundal + text pentru opțiuni/carduri selectate — lizibil în light și dark. */
export function selectableSurfaceClass(selected: boolean, extra?: string): string {
  return cn(
    'transition active:scale-[0.985]',
    selected
      ? 'border-[var(--status-success-border)] bg-[var(--status-success-bg)] text-[var(--status-success-text)] shadow-[0_10px_24px_rgba(13,155,92,0.10)]'
      : 'border-[var(--border-default)] bg-[var(--surface-card)] text-[var(--text-primary)] shadow-[var(--shadow-soft)]',
    extra
  )
}

export function selectableTitleClass(selected: boolean): string {
  return cn(
    'text-sm [font-weight:700]',
    selected ? 'text-[var(--status-success-text)]' : 'text-[var(--text-primary)]'
  )
}

export function selectableSubtitleClass(selected: boolean): string {
  return cn(
    'mt-1 text-xs',
    selected ? 'text-[color:color-mix(in_srgb,var(--status-success-text)_78%,transparent)]' : 'text-[var(--text-secondary)]'
  )
}
