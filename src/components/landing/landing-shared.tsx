import type { ReactNode } from 'react'

import { kitText } from '@/components/kit'
import { cn } from '@/lib/utils'

/** O secțiune a primei pagini: lățime de citit, gutter de 16 px pe telefon. */
export function SectionShell({
  id,
  label,
  className,
  children,
}: {
  id?: string
  label?: string
  className?: string
  children: ReactNode
}) {
  return (
    <section id={id} aria-label={label} className={cn('px-4 py-10 md:py-14', className)}>
      <div className="mx-auto w-full max-w-3xl">{children}</div>
    </section>
  )
}

export function SectionTitle({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <h2 id={id} className={cn(kitText.section, 'font-extrabold text-fg')}>
      {children}
    </h2>
  )
}
