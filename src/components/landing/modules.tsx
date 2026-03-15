import { CloudSun, Droplets, Pickaxe, Sprout, Users } from 'lucide-react'

import CountUp from '@/components/landing/count-up'
import Reveal from '@/components/landing/reveal'

const berryStats = [
  { label: 'Recoltare astăzi', value: 120, suffix: ' kg', icon: Pickaxe },
  { label: 'Culegători activi', value: 4, suffix: '', icon: Users },
  { label: 'Parcelă în lucru', value: 'ZME-03', icon: Sprout },
]

const greenhouseStats = [
  { label: 'Plantare tomate', value: '350 plante', icon: Sprout },
  { label: 'Irigare', value: 'Activă', icon: Droplets },
  { label: 'Microclimat', value: '24°C', icon: CloudSun },
]

function ScenarioCard({
  eyebrow,
  title,
  description,
  stats,
  accent,
}: {
  eyebrow: string
  title: string
  description: string
  stats: { label: string; value: number | string; suffix?: string; icon: React.ComponentType<{ className?: string }> }[]
  accent: string
}) {
  return (
    <div className="flex h-full flex-col rounded-[30px] bg-[linear-gradient(135deg,rgba(255,255,255,0.7),rgba(241,107,107,0.14),rgba(47,111,78,0.14))] p-px shadow-[0_20px_56px_rgba(49,46,63,0.08)] transition-transform duration-300 hover:-translate-y-1 hover:scale-[1.02] hover:shadow-[0_28px_68px_rgba(49,46,63,0.14)]">
      <div className="flex h-full flex-1 flex-col rounded-[29px] border border-white/70 bg-white p-6">
        <div className="inline-flex rounded-full px-3 py-1 text-xs font-semibold tracking-[0.16em] uppercase" style={{ backgroundColor: accent, color: '#fff' }}>
          {eyebrow}
        </div>
        <h3 className="mt-5 text-2xl font-semibold text-[var(--landing-dark)]">{title}</h3>
        <p className="mt-3 max-w-xl text-sm leading-6 text-[color:var(--agri-text-muted)]">{description}</p>
        <div className="mt-6 grid items-stretch gap-3 sm:grid-cols-3">
          {stats.map((stat) => {
            const Icon = stat.icon
            return (
              <div
                key={stat.label}
                className="flex flex-col rounded-2xl border border-[color:rgba(49,46,63,0.08)] bg-[rgba(247,248,250,0.86)] p-4 transition-transform duration-300 hover:-translate-y-1 hover:scale-[1.02] hover:shadow-[0_18px_42px_rgba(49,46,63,0.08)]"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold text-[var(--landing-dark)]">
                    {typeof stat.value === 'number' ? <CountUp to={stat.value} suffix={stat.suffix} /> : stat.value}
                  </span>
                  <span className="inline-flex size-10 items-center justify-center rounded-full bg-[linear-gradient(135deg,rgba(255,255,255,1),rgba(47,111,78,0.06))] text-[var(--landing-dark)] shadow-sm">
                    <Icon className="size-4" />
                  </span>
                </div>
                <p className="mt-3 text-xs uppercase tracking-[0.12em] text-[color:var(--agri-text-muted)]">{stat.label}</p>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default function Modules() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
      <Reveal className="mx-auto max-w-2xl text-center">
        <p className="text-sm font-semibold tracking-[0.18em] text-[var(--landing-leaf)] uppercase">
          Exemple din fermă
        </p>
        <h2 className="mt-3 text-3xl font-bold tracking-tight text-[var(--landing-dark)] sm:text-4xl">
          Vezi ușor ce se întâmplă în fiecare zi
        </h2>
      </Reveal>
      <div className="mt-10 grid items-stretch gap-5 xl:grid-cols-2">
        <Reveal className="h-full">
          <ScenarioCard
            eyebrow="Fructe de pădure"
            title="Ferma de zmeură"
            description="Vezi repede cât s-a cules, câți oameni au lucrat și ce parcelă produce mai bine."
            stats={berryStats}
            accent="var(--landing-raspberry)"
          />
        </Reveal>
        <Reveal delayMs={120} className="h-full">
          <ScenarioCard
            eyebrow="Solar"
            title="Solar de tomate"
            description="Urmărești plantarea, irigarea și lucrările din solar fără să pierzi datele pe drum."
            stats={greenhouseStats}
            accent="var(--landing-leaf)"
          />
        </Reveal>
      </div>
    </section>
  )
}
