import { SectionIntro, SectionShell } from '@/components/landing/landing-shared'

const farmTypes = [
  {
    emoji: '🍓',
    title: 'Fructe de pădure',
    description: 'zmeură, mur, afin',
  },
  {
    emoji: '🍅',
    title: 'Solarii',
    description: 'roșii, castraveți, ardei',
  },
  {
    emoji: '🍎',
    title: 'Livezi',
    description: 'meri, peri, pruni',
  },
]

export function FarmTypes() {
  return (
    <SectionShell label="Tipuri de ferme" className="bg-[#FAFAF6] py-16 md:py-24">
      <SectionIntro badge="Tipuri de ferme" title="Potrivit pentru mai multe tipuri de ferme" />

      <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {farmTypes.map((farmType) => (
          <article key={farmType.title} className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
            <div className="text-4xl">{farmType.emoji}</div>
            <h3 className="mt-4 text-lg font-bold text-slate-800">{farmType.title}</h3>
            <p className="mt-2 text-sm leading-7 text-slate-500">{farmType.description}</p>
          </article>
        ))}
      </div>
    </SectionShell>
  )
}
