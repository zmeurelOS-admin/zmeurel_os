import Image from 'next/image'

import Reveal from '@/components/landing/reveal'

export default function Story() {
  return (
    <section id="poveste" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
      <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:gap-16">
        <Reveal className="relative">
          <div className="overflow-hidden rounded-[30px] border border-[color:rgba(47,111,78,0.12)] bg-white p-3 shadow-[0_20px_60px_rgba(49,46,63,0.08)] transition-transform duration-300 hover:-translate-y-1 hover:scale-[1.02] hover:shadow-[0_26px_64px_rgba(49,46,63,0.14)]">
            <Image
              src="/landing/story-farm.svg"
              alt="Fructe de pădure, solar și livadă."
              width={1200}
              height={900}
              className="h-auto w-full rounded-[24px]"
            />
          </div>
        </Reveal>
        <Reveal delayMs={120} className="space-y-6">
          <div className="space-y-3">
            <p className="text-sm font-semibold tracking-[0.18em] text-[var(--landing-leaf)] uppercase">
              De la fermă la aplicație
            </p>
            <h2 className="text-3xl font-bold tracking-tight text-[var(--landing-dark)] sm:text-4xl">
              A pornit dintr-o nevoie reală din fermă.
            </h2>
          </div>
          <div className="space-y-4 text-base leading-7 text-[color:var(--agri-text-muted)]">
            <p>
              În fermă notam recoltele, lucrările, vânzările și cheltuielile în mai multe locuri. Unele date erau în Excel, altele în telefon sau pe hârtie.
            </p>
            <p>
              Când voiam să văd cât produce o parcelă sau cât rămâne după cheltuieli, trebuia să adun totul manual.
            </p>
            <p>
              De aici a apărut Zmeurel OS: o aplicație simplă, făcută pentru fermieri care vor să aibă datele fermei la îndemână, direct pe telefon.
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
