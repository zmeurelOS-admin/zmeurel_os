import Reveal from '@/components/landing/reveal'

const farmTypes = [
  {
    emoji: '🍓',
    title: 'Fructe de pădure',
    text: 'zmeură, mur, afin',
  },
  {
    emoji: '🍅',
    title: 'Solarii',
    text: 'roșii, castraveți, ardei',
  },
  {
    emoji: '🍎',
    title: 'Livezi',
    text: 'meri, peri, pruni',
  },
]

export default function FarmTypes() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
      <Reveal className="mx-auto max-w-3xl text-center">
        <p className="text-sm font-semibold tracking-[0.18em] text-[var(--landing-leaf)] uppercase">
          Tipuri de ferme
        </p>
        <h2 className="mt-3 text-3xl font-bold tracking-tight text-[var(--landing-dark)] sm:text-4xl">
          Potrivit pentru mai multe tipuri de ferme
        </h2>
      </Reveal>

      <div className="mt-10 grid items-stretch gap-4 md:grid-cols-3">
        {farmTypes.map((farmType, index) => (
          <Reveal
            key={farmType.title}
            delayMs={index * 80}
            className="flex h-full flex-col rounded-[28px] border border-[color:rgba(49,46,63,0.08)] bg-white p-6 text-center shadow-[0_12px_34px_rgba(49,46,63,0.06)] transition-transform duration-300 hover:-translate-y-1 hover:scale-[1.02] hover:shadow-[0_24px_54px_rgba(49,46,63,0.12)]"
          >
            <div className="text-4xl">{farmType.emoji}</div>
            <h3 className="mt-4 text-xl font-semibold text-[var(--landing-dark)]">{farmType.title}</h3>
            <p className="mt-2 text-sm text-[color:var(--agri-text-muted)]">{farmType.text}</p>
          </Reveal>
        ))}
      </div>
    </section>
  )
}
