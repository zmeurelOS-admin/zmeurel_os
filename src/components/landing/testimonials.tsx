import Reveal from '@/components/landing/reveal'

const testimonials = [
  {
    quote: 'Am redus timpul de evidență de la 2 ore pe săptămână la 10 minute.',
    name: 'Andrei',
    role: 'fermier de zmeură, Suceava',
  },
  {
    quote: 'În sfârșit văd clar cât produce fiecare parcelă.',
    name: 'Ion M.',
    role: 'fermier, Bacău',
  },
  {
    quote: 'Simplu, rapid, exact ce aveam nevoie.',
    name: 'Maria D.',
    role: 'fermier, Iași',
  },
]

export default function Testimonials() {
  return (
    <section className="bg-[linear-gradient(180deg,transparent_0%,rgba(47,111,78,0.04)_100%)]">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
        <Reveal className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--landing-leaf)]">
            Experiențe reale
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-[var(--landing-dark)] sm:text-4xl">
            Ce spun fermierii
          </h2>
        </Reveal>

        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {testimonials.map((t, index) => (
            <Reveal
              key={index}
              delayMs={index * 80}
              className="flex flex-col rounded-[28px] border border-[color:rgba(47,111,78,0.12)] bg-white p-6 shadow-[0_12px_34px_rgba(49,46,63,0.06)] transition-transform duration-300 hover:-translate-y-1 hover:scale-[1.02] hover:shadow-[0_24px_54px_rgba(49,46,63,0.12)]"
            >
              <p className="text-3xl leading-none text-[var(--landing-leaf)]">&ldquo;</p>
              <p className="mt-3 flex-1 text-base leading-7 text-[var(--landing-dark)]">{t.quote}</p>
              <div className="mt-5 border-t border-[color:rgba(49,46,63,0.06)] pt-4">
                <p className="text-sm font-semibold text-[var(--landing-dark)]">— {t.name}</p>
                <p className="text-sm text-[color:var(--agri-text-muted)]">{t.role}</p>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal className="mt-6 text-center">
          <p className="text-xs italic text-[color:var(--agri-text-muted)]">
            Experiențe din perioada de testare
          </p>
        </Reveal>
      </div>
    </section>
  )
}
