import Reveal from '@/components/landing/reveal'

export default function Install() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
      <Reveal className="rounded-[32px] border border-[color:rgba(49,46,63,0.08)] bg-white p-8 shadow-[0_18px_44px_rgba(49,46,63,0.08)] sm:p-10">
        <div className="mx-auto max-w-4xl">
          <p className="text-sm font-semibold tracking-[0.18em] text-[var(--landing-leaf)] uppercase">
            Instalare pe telefon
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-[var(--landing-dark)] sm:text-4xl">
            Folosește aplicația pe telefon
          </h2>
          <p className="mt-4 max-w-2xl text-base leading-7 text-[color:var(--agri-text-muted)]">
            Aplicația merge pe Android și iPhone. Poate fi instalată pe telefon ca o aplicație.
          </p>

          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <div className="rounded-3xl bg-[rgba(241,107,107,0.08)] p-6">
              <h3 className="text-lg font-semibold text-[var(--landing-dark)]">Android</h3>
              <p className="mt-3 text-sm leading-6 text-[color:var(--agri-text-muted)]">
                Deschizi aplicația și alegi „Adaugă pe ecranul principal”.
              </p>
            </div>
            <div className="rounded-3xl bg-[rgba(47,111,78,0.08)] p-6">
              <h3 className="text-lg font-semibold text-[var(--landing-dark)]">iPhone</h3>
              <p className="mt-3 text-sm leading-6 text-[color:var(--agri-text-muted)]">
                Deschizi aplicația în Safari și alegi „Add to Home Screen”.
              </p>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  )
}
