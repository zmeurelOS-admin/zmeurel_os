'use client'

import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

/**
 * Bară unificată pentru workspace desktop (md+): căutare, filtre, acțiuni.
 * Nu înlocuiește PageHeader; rămâne sub tab-uri / filtre modul.
 */
export function DesktopToolbar({
  children,
  trailing,
  className,
}: {
  children?: ReactNode
  /** Acțiuni dreapta (ex. butoane secundare) */
  trailing?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'mb-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between',
        className,
      )}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">{children}</div>
      {trailing ? <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">{trailing}</div> : null}
    </div>
  )
}
