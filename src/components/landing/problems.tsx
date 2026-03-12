import { BarChart3, FileSpreadsheet, NotebookPen, SearchSlash } from 'lucide-react'

import Reveal from '@/components/landing/reveal'

const problems = [
  {
    icon: FileSpreadsheet,
    title: 'Cât ai cules',
    text: 'După câteva zile devine greu să aduni tot ce ai notat în mai multe locuri.',
  },
  {
    icon: SearchSlash,
    title: 'Cât ai vândut',
    text: 'Nu mai vezi ușor ce ai dat la client și ce marfă mai ai disponibilă.',
  },
  {
    icon: NotebookPen,
    title: 'Cât ai cheltuit',
    text: 'Cheltuielile rămân în bonuri, caiete sau foi separate și se pierd repede.',
  },
  {
    icon: BarChart3,
    title: 'Cât ai câștigat',
    text: 'Fără toate datele la un loc, e greu să știi profitul real al fermei.',
  },
]

export default function Problems() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
      <Reveal className="mx-auto max-w-3xl text-center">
        <p className="text-sm font-semibold tracking-[0.18em] text-[var(--landing-raspberry)] uppercase">
          Probleme reale
        </p>
        <h2 className="mt-3 text-3xl font-bold tracking-tight text-[var(--landing-dark)] sm:text-4xl">
          Îți ții evidența în caiet sau în Excel?
        </h2>
        <p className="mt-4 text-base leading-7 text-[color:var(--agri-text-muted)]">
          Mulți fermieri notează producția și cheltuielile în caiet sau Excel. După o vreme devine greu să știi cât ai cules, cât ai vândut, cât ai cheltuit și cât ai câștigat. Datele sunt împrăștiate și greu de urmărit.
        </p>
      </Reveal>
      <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {problems.map((problem, index) => {
          const Icon = problem.icon
          return (
            <Reveal
              key={problem.title}
              delayMs={index * 80}
              className="rounded-[28px] border border-[color:rgba(49,46,63,0.08)] bg-white p-6 shadow-[0_12px_34px_rgba(49,46,63,0.06)] transition-transform duration-300 hover:-translate-y-1 hover:scale-[1.02] hover:shadow-[0_24px_54px_rgba(49,46,63,0.12)]"
            >
              <div className="inline-flex size-12 items-center justify-center rounded-full bg-[linear-gradient(135deg,rgba(241,107,107,0.18),rgba(241,107,107,0.06))] text-[var(--landing-raspberry)]">
                <Icon className="size-5" />
              </div>
              <h3 className="mt-5 text-lg font-semibold text-[var(--landing-dark)]">{problem.title}</h3>
              <p className="mt-3 text-sm leading-6 text-[color:var(--agri-text-muted)]">{problem.text}</p>
            </Reveal>
          )
        })}
      </div>
    </section>
  )
}
