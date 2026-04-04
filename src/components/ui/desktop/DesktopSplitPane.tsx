'use client'

import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

/**
 * Layout master–detail pentru ecrane md+ (lista stânga, inspector dreapta).
 * Sub `md` nu se folosește — modulele păstrează layout mobil separat.
 */
export function DesktopSplitPane({
  master,
  detail,
  className,
  masterClassName,
  detailClassName,
}: {
  master: ReactNode
  detail: ReactNode
  className?: string
  masterClassName?: string
  detailClassName?: string
}) {
  return (
    <div
      className={cn(
        'md:grid md:grid-cols-[minmax(0,1.65fr)_minmax(300px,1fr)] md:gap-4 lg:grid-cols-[minmax(0,1.75fr)_minmax(320px,0.95fr)] xl:grid-cols-[minmax(0,1.8fr)_minmax(340px,1fr)]',
        className,
      )}
    >
      <div className={cn('min-w-0', masterClassName)}>{master}</div>
      <div className={cn('min-w-0 hidden md:block', detailClassName)}>{detail}</div>
    </div>
  )
}
