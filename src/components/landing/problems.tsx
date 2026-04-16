import { Calculator, Coins, PackageCheck, ShoppingBag } from 'lucide-react'

import { SectionIntro, SectionShell } from '@/components/landing/landing-shared'

const problemCards = [
  {
    icon: PackageCheck,
    title: 'Cât ai cules?',
    description: 'Fără o evidență simplă, nu știi exact ce parcelă produce bine și unde scade randamentul.',
  },
  {
    icon: ShoppingBag,
    title: 'Cât ai vândut?',
    description: 'Comenzile, clienții și livrările se pierd ușor când sunt notate în mai multe locuri.',
  },
  {
    icon: Coins,
    title: 'Cât ai cheltuit?',
    description: 'Motorina, tratamentele, ambalajele și zilierii se adună repede dacă nu le vezi la timp.',
  },
  {
    icon: Calculator,
    title: 'Cât ai câștigat?',
    description: 'Profitul real rămâne neclar când nu legi recolta, vânzările și cheltuielile între ele.',
  },
]

export function Problems() {
  return (
    <SectionShell label="Probleme reale" className="bg-[#FAFAF6] py-16 md:py-24">
      <SectionIntro
        badge="Probleme reale"
        title="Ții evidența fermei în caiet sau Excel?"
        description="Când informațiile sunt împrăștiate, deciziile se iau greu și profitul real rămâne neclar."
      />

      <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {problemCards.map(({ icon: Icon, title, description }) => (
          <article key={title} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FFF0EC] text-[#E76F51]">
              <Icon className="h-5 w-5" />
            </div>
            <h3 className="mt-4 text-lg font-bold text-slate-800">{title}</h3>
            <p className="mt-2 text-sm leading-7 text-slate-500">{description}</p>
          </article>
        ))}
      </div>
    </SectionShell>
  )
}
