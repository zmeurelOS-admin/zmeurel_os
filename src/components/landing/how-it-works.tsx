import { SectionIntro, SectionShell } from '@/components/landing/landing-shared'

const steps = [
  {
    number: '1',
    title: 'Creezi ferma',
    description: 'Introduci parcelele, solariile sau livezile. Durează 2 minute.',
  },
  {
    number: '2',
    title: 'Notezi ce faci',
    description: 'Recolte, lucrări, vânzări, cheltuieli — în câteva secunde.',
  },
  {
    number: '3',
    title: 'Vezi rezultatele',
    description: 'Aplicația îți arată cât produce fiecare parcelă și cât câștigi.',
  },
]

export function HowItWorks() {
  return (
    <SectionShell label="Cum funcționează" className="bg-[#FAFAF6] py-16 md:py-24">
      <SectionIntro badge="Pași simpli" title="Cum funcționează" />

      <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {steps.map((step) => (
          <article key={step.number} className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#2D6A4F] text-lg font-bold text-white">
              {step.number}
            </div>
            <h3 className="mt-5 text-lg font-bold text-slate-800">{step.title}</h3>
            <p className="mt-2 text-sm leading-7 text-slate-500">{step.description}</p>
          </article>
        ))}
      </div>
    </SectionShell>
  )
}
