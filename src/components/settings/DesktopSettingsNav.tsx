'use client'

import { cn } from '@/lib/utils'

export type SettingsNavItem = { id: string; label: string }

/**
 * Navigație laterală doar pentru desktop (md+); pe mobil ramane ascunsă.
 */
export function DesktopSettingsNav({
  items,
  activeId,
  onSelect,
  className,
}: {
  items: SettingsNavItem[]
  activeId: string
  onSelect: (id: string) => void
  className?: string
}) {
  return (
    <nav
      aria-label="Secțiuni setări"
      className={cn(
        'hidden w-full shrink-0 flex-col gap-0.5 md:flex',
        'sticky top-20 z-10 max-h-[min(calc(100dvh-5.5rem),48rem)] overflow-y-auto rounded-2xl border border-[var(--border-default)] bg-[var(--surface-card)] p-2 shadow-[var(--shadow-soft)]',
        className,
      )}
    >
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onSelect(item.id)}
          className={cn(
            'w-full rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors',
            activeId === item.id
              ? 'bg-[var(--surface-card-muted)] text-[var(--text-primary)] ring-1 ring-inset ring-[var(--focus-ring)]'
              : 'text-[var(--text-secondary)] hover:bg-[color:color-mix(in_srgb,var(--surface-card-muted)_85%,transparent)] hover:text-[var(--text-primary)]',
          )}
        >
          {item.label}
        </button>
      ))}
    </nav>
  )
}
