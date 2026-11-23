import Image from 'next/image'

import { kitText } from '@/components/kit'
import { SectionShell, SectionTitle } from '@/components/landing/landing-shared'
import { APP_NAME } from '@/lib/brand'
import { cn } from '@/lib/utils'

const POZE = [
  { src: '/landing/landing_raspberry_1.webp', alt: 'Andrei în plantația de zmeură de la Văratec', width: 900, height: 1200 },
  { src: '/landing/landing_raspberry_box.webp', alt: 'Lădiță cu zmeură proaspătă, pregătită pentru livrare', width: 1200, height: 900 },
]

/** Povestea lui Andrei, cu două poze de la fermă. */
export function Story() {
  return (
    <SectionShell label="De ce am făcut aplicația">
      <SectionTitle>De ce am făcut-o</SectionTitle>
      <blockquote className={cn(kitText.base, 'mt-3 text-fg')}>
        „Am ~1.900 de plante de zmeură. Țineam totul pe hârtie și în WhatsApp și nu știam niciodată exact cât am câștigat.
        Am făcut {APP_NAME} pentru ferma mea din Văratec, apoi pentru alții ca mine.”
      </blockquote>
      <p className={cn(kitText.secondary, 'mt-2 text-fg-muted')}>— Andrei, Ferma Zmeurel, autorul aplicației</p>
      <div className="mt-4 grid grid-cols-2 gap-2.5">
        {POZE.map((poza) => (
          <div key={poza.src} className="overflow-hidden rounded-box border border-border">
            <Image
              src={poza.src}
              alt={poza.alt}
              width={poza.width}
              height={poza.height}
              loading="lazy"
              quality={75}
              sizes="(max-width: 768px) 50vw, 360px"
              className="aspect-[4/3] h-full w-full object-cover"
            />
          </div>
        ))}
      </div>
    </SectionShell>
  )
}
