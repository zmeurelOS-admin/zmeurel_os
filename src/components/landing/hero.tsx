import Image from 'next/image'
import Link from 'next/link'

import { buttonVariants, kitText } from '@/components/kit'
import { CAPTURI } from '@/components/landing/capturi-date'
import { cn } from '@/lib/utils'

/** Titlul, cele două butoane și prima captură (singura imagine încărcată imediat). */
export function Hero() {
  const prima = CAPTURI[0]
  return (
    <section aria-labelledby="titlu-pagina" className="px-4 pb-6 pt-8 md:pt-14">
      <div className="mx-auto grid w-full max-w-3xl gap-8 md:grid-cols-[1.1fr_0.9fr] md:items-center">
        <div className="space-y-4">
          <h1 id="titlu-pagina" className="text-[34px] font-extrabold leading-[1.08] tracking-[-0.03em] text-fg md:text-[44px]">
            Ferma ta, pe telefon. Fără hârtii.
          </h1>
          <p className={cn(kitText.base, 'text-fg-muted')}>
            Notezi recoltele, comenzile, livrările și tratamentele în câteva secunde. Vezi cât produci, cât vinzi și cât câștigi.
          </p>
          <div className="flex flex-col gap-2.5 pt-1 sm:flex-row">
            <Link href="/start?demo=1" className={cn(buttonVariants({ variant: 'primary', size: 'touch-lg' }), 'w-full sm:w-auto sm:px-8')}>
              Încearcă fără cont
            </Link>
            <Link href="/login" className={cn(buttonVariants({ variant: 'neutral', size: 'touch-lg' }), 'w-full sm:w-auto sm:px-8')}>
              Am deja cont
            </Link>
          </div>
          <p className={cn(kitText.helper, 'text-fg-muted')}>Gratuit cât e în beta · făcut de un fermier din Văratec, Suceava</p>
        </div>
        <figure className="mx-auto w-full max-w-[280px]">
          <div className="overflow-hidden rounded-card border border-border bg-surface shadow-2">
            <Image
              src={prima.src}
              alt={prima.alt}
              width={prima.width}
              height={prima.height}
              priority
              sizes="280px"
              className="h-auto w-full"
            />
          </div>
          <figcaption className={cn(kitText.helper, 'mt-2 text-center text-fg-muted')}>{prima.titlu}</figcaption>
        </figure>
      </div>
    </section>
  )
}
