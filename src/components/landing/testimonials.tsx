import { SectionIntro, SectionShell } from '@/components/landing/landing-shared'

const testimonials = [
  {
    quote: 'Am redus timpul de evidență de la 2 ore pe săptămână la 10 minute.',
    author: 'Andrei, fermier de zmeură, Suceava',
  },
  {
    quote: 'În sfârșit văd clar cât produce fiecare parcelă.',
    author: 'Ion M., fermier, Bacău',
  },
  {
    quote: 'Simplu, rapid, exact ce aveam nevoie.',
    author: 'Maria D., fermier, Iași',
  },
]

export function Testimonials() {
  return (
    <SectionShell label="Testimoniale fermieri" className="border-t border-slate-200 bg-white py-16 md:py-24">
      <SectionIntro badge="Experiențe reale" title="Ce spun fermierii" />

      <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3">
        {testimonials.map((item) => (
          <article key={item.author} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-4xl text-[#B7DFC9]">“</p>
            <p className="mt-2 text-base leading-7 text-slate-700">{item.quote}</p>
            <p className="mt-5 text-sm font-semibold text-slate-800">{item.author}</p>
          </article>
        ))}
      </div>

      <p className="mt-5 text-center text-xs text-slate-400">Experiențe din perioada de testare</p>
    </SectionShell>
  )
}
