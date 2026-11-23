import Link from 'next/link'

import { LogoCuNume } from '@/components/brand/LogoCuNume'

import { kitFocus, kitText } from '@/components/kit'
import { cn } from '@/lib/utils'

/** Antetul primei pagini: sigla și „Intră”. Fără meniu: pagina e scurtă. */
export function LandingHeader() {
  return (
    <header className="border-b border-border-subtle bg-page px-4" aria-label="Antet">
      <div className="mx-auto flex h-16 w-full max-w-3xl items-center justify-between gap-3">
        <Link href="/" className={cn('flex min-w-0 items-center rounded-control', kitFocus)}>
          <LogoCuNume className="h-10" />
        </Link>
        <Link
          href="/login"
          className={cn(
            kitText.secondary,
            'inline-flex h-touch items-center rounded-box px-4 font-bold text-primary hover:bg-primary-soft',
            kitFocus,
          )}
        >
          Intră
        </Link>
      </div>
    </header>
  )
}
