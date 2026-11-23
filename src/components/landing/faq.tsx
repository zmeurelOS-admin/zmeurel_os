import { ChevronDown } from 'lucide-react'

import { kitFocus, kitText } from '@/components/kit'
import { SectionShell, SectionTitle } from '@/components/landing/landing-shared'
import { cn } from '@/lib/utils'

const INTREBARI = [
  { q: 'Cât costă?', a: 'Nimic, cât e în beta: toate modulele, fără limită de date. Când ies abonamentele, afli cu cel puțin o lună înainte.' },
  { q: 'Trebuie instalată?', a: 'Nu. Merge din browser, pe orice telefon sau calculator. O poți pune pe ecranul telefonului ca pe o aplicație.' },
  { q: 'Trebuie internet?', a: 'Da, ca să salvezi. Dacă pică semnalul, formularul păstrează ce ai scris și apeși din nou „Salvează” când revine.' },
  { q: 'Cine vede datele?', a: 'Doar tu și oamenii pe care îi inviți. Datele sunt ale tale: le exporți oricând în Excel sau le ștergi.' },
  { q: 'Pot invita oameni?', a: 'Da. Trimiți pe WhatsApp un link și alegi ce poate vedea sau scrie fiecare.' },
  { q: 'Merge și pentru solarii sau livezi?', a: 'Da. Cultura o alegi la fiecare parcelă: zmeură, afine, roșii, mere sau ce cultivi tu.' },
]

/** Întrebările frecvente, cu `details` (fără JavaScript). */
export function Faq() {
  return (
    <SectionShell label="Întrebări frecvente">
      <SectionTitle>Întrebări</SectionTitle>
      <div className="mt-4 space-y-2">
        {INTREBARI.map((item) => (
          <details key={item.q} className="group rounded-box border border-border bg-surface">
            <summary
              className={cn(
                kitText.base,
                'flex min-h-touch cursor-pointer list-none items-center justify-between gap-3 rounded-box px-4 py-3 font-bold text-fg [&::-webkit-details-marker]:hidden',
                kitFocus,
              )}
            >
              {item.q}
              <ChevronDown aria-hidden className="size-5 shrink-0 text-fg-muted transition-transform group-open:rotate-180" />
            </summary>
            <p className={cn(kitText.secondary, 'px-4 pb-4 text-fg-muted')}>{item.a}</p>
          </details>
        ))}
      </div>
    </SectionShell>
  )
}
