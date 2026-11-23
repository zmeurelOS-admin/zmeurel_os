import Image from 'next/image'
import Link from 'next/link'

import { kitFocus, kitText } from '@/components/kit'
import { APP_NAME } from '@/lib/brand'
import { cn } from '@/lib/utils'

/** Antetul primei pagini: sigla și „Intră”. Fără meniu: pagina e scurtă. */
export function LandingHeader() {
  return (
    <header className="border-b border-border-subtle bg-page px-4" aria-label="Antet">
      <div className="mx-auto flex h-16 w-full max-w-3xl items-center justify-between gap-3">
        <Link href="/" className={cn('flex min-w-0 items-center gap-2.5 rounded-control', kitFocus)}>
          <Image src="/icons/icon.svg" alt="" width={36} height={36} className="size-9" priority />
          <span className={cn(kitText.card, 'truncate font-extrabold text-fg')}>{APP_NAME}</span>
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
