import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import type { ReactNode } from 'react'

import { LogoCuNume } from '@/components/brand/LogoCuNume'
import { kitFocus, kitText } from '@/components/kit'
import { cn } from '@/lib/utils'

/**
 * Cadrul comun pentru /start, Login și paginile de parolă (promptul 31): sigla, titlul, conținutul și, opțional,
 * butonul principal jos. Pe tokenii canonici, deci merge zi și noapte.
 */
export function AuthFrame({
  title,
  intro,
  backHref,
  onBack,
  footer,
  children,
}: {
  title?: ReactNode
  intro?: ReactNode
  /** Săgeata „Înapoi” din colț: o legătură sau o acțiune. */
  backHref?: string
  onBack?: () => void
  /** Butonul principal, sub conținut. */
  footer?: ReactNode
  children?: ReactNode
}) {
  const backClass = cn('inline-flex size-touch items-center justify-center rounded-full bg-surface-muted text-fg', kitFocus)
  return (
    <main className="min-h-dvh bg-page px-4 py-4 text-fg">
      <div className="mx-auto flex w-full max-w-md flex-col gap-4">
        <div className="flex min-h-touch items-center gap-3">
          {backHref ? (
            <Link href={backHref} aria-label="Înapoi" className={backClass}>
              <ChevronLeft aria-hidden className="size-6" />
            </Link>
          ) : onBack ? (
            <button type="button" aria-label="Înapoi" onClick={onBack} className={backClass}>
              <ChevronLeft aria-hidden className="size-6" />
            </button>
          ) : null}
          <Link href="/" className={cn('flex items-center rounded-control', kitFocus)}>
            <LogoCuNume className="h-9" />
          </Link>
        </div>
        {title ? <h1 className={cn(kitText.section, 'font-extrabold text-fg')}>{title}</h1> : null}
        {intro ? <p className={cn(kitText.secondary, '-mt-2 text-fg-muted')}>{intro}</p> : null}
        <div className="flex flex-col gap-3">{children}</div>
        {footer ? <div className="flex flex-col gap-2.5 pt-1">{footer}</div> : null}
      </div>
    </main>
  )
}

/** Linia „SAU” dintre opțiuni. */
export function AuthSeparator() {
  return (
    <div className={cn(kitText.helper, 'flex items-center gap-3 font-bold uppercase tracking-wide text-fg-muted')} aria-hidden>
      <span className="h-px flex-1 bg-border" />
      sau
      <span className="h-px flex-1 bg-border" />
    </div>
  )
}
