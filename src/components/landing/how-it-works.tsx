import Reveal from '@/components/landing/reveal'

const steps = [
  {
    step: '1',
    title: 'Creezi ferma',
    text: 'Introduci parcelele, solariile sau livezile.',
  },
  {
    step: '2',
    title: 'Introduci ce faci în fermă',
    text: 'Notezi lucrări, recolte, vânzări și cheltuieli.',
  },
  {
    step: '3',
    title: 'Vezi producția și vânzările',
    text: 'Aplicația îți arată cât produce fiecare parcelă și cât ai câștigat.',
  },
]

export default function HowItWorks() {
  return (
    <section id="cum-functioneaza" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
      <Reveal className="mx-auto max-w-3xl text-center">
        <p className="text-sm font-semibold tracking-[0.18em] text-[var(--landing-raspberry)] uppercase">
          Pași simpli
        </p>
        <h2 className="mt-3 text-3xl font-bold tracking-tight text-[var(--landing-dark)] sm:text-4xl">
          Cum funcționează
        </h2>
      </Reveal>

      <div className="mt-10 grid gap-4 md:grid-cols-3">
        {steps.map((item, index) => (
          <Reveal
            key={item.step}
            delayMs={index * 80}
            className="rounded-[28px] border border-[color:rgba(49,46,63,0.08)] bg-white p-6 shadow-[0_12px_34px_rgba(49,46,63,0.06)] transition-transform duration-300 hover:-translate-y-1 hover:scale-[1.02] hover:shadow-[0_24px_54px_rgba(49,46,63,0.12)]"
          >
            <div className="inline-flex size-12 items-center justify-center rounded-full bg-[linear-gradient(135deg,#f16b6b_0%,#d84b62_100%)] text-lg font-bold text-white">
              {item.step}
            </div>
            <h3 className="mt-5 text-xl font-semibold text-[var(--landing-dark)]">{item.title}</h3>
            <p className="mt-3 text-sm leading-6 text-[color:var(--agri-text-muted)]">{item.text}</p>
          </Reveal>
        ))}
      </div>
    </section>
  )
}
