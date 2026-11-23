import Image from 'next/image'

import { kitText } from '@/components/kit'
import { CAPTURI } from '@/components/landing/capturi-date'
import { SectionTitle } from '@/components/landing/landing-shared'
import { cn } from '@/lib/utils'

/** Restul capturilor, într-un rând care se derulează pe orizontală (pe telefon) și în grilă pe ecran mare. */
export function Capturi() {
  return (
    <section aria-labelledby="capturi-titlu" className="py-8">
      <div className="mx-auto w-full max-w-3xl px-4">
        <SectionTitle id="capturi-titlu">Cum arată</SectionTitle>
        <p className={cn(kitText.secondary, 'mt-1 text-fg-muted')}>Capturi din aplicație, dintr-o fermă demo.</p>
      </div>
      <ul className="mx-auto mt-4 flex w-full max-w-3xl snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-2 md:grid md:grid-cols-5 md:overflow-visible">
        {CAPTURI.slice(1).map((captura) => (
          <li key={captura.src} className="w-[62%] shrink-0 snap-start md:w-auto">
            <figure>
              <div className="overflow-hidden rounded-box border border-border bg-surface shadow-1">
                <Image
                  src={captura.src}
                  alt={captura.alt}
                  width={captura.width}
                  height={captura.height}
                  loading="lazy"
                  sizes="(max-width: 768px) 62vw, 150px"
                  className="h-auto w-full"
                />
              </div>
              <figcaption className={cn(kitText.secondary, 'mt-2 font-bold text-fg')}>{captura.titlu}</figcaption>
            </figure>
          </li>
        ))}
      </ul>
    </section>
  )
}
