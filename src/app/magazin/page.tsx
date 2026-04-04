import Link from 'next/link'

export default function MagazinLandingPage() {
  return (
    <div className="min-h-[100dvh] bg-gradient-to-b from-[#f6faf7] via-[#f2f7f4] to-[#e8f0ec] px-4 py-12 text-[#0f1411] dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950 dark:text-zinc-100">
      <div className="mx-auto max-w-lg text-center">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-700/80 dark:text-emerald-400/90">
          Zmeurel
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-emerald-950 dark:text-emerald-50">
          Magazin fermier
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-emerald-900/70 dark:text-zinc-400">
          Fiecare fermă are propriul link public. Deschide linkul primit de la producător sau scanează codul QR —
          vei vedea catalogul cu prețuri și vei putea pregăti comanda (fără cont).
        </p>
        <p className="mt-6 text-xs text-emerald-900/55 dark:text-zinc-500">
          Exemplu adresă:{' '}
          <code className="rounded bg-white/80 px-1.5 py-0.5 text-[11px] text-emerald-900 dark:bg-zinc-800 dark:text-zinc-300">
            /magazin/[id-fermă]
          </code>
        </p>
        <p className="mt-8 text-sm text-emerald-900/60 dark:text-zinc-500">
          Ești fermier? Găsești ID-ul fermei în aplicație (tenant) și poți partaja linkul către clienți.
        </p>
        <p className="mt-8">
          <Link
            href="/magazin/asociatie"
            className="inline-flex rounded-2xl bg-emerald-700 px-5 py-3 text-sm font-bold text-white shadow-md shadow-emerald-900/20 transition hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500"
          >
            Gustă din Bucovina — magazin asociație
          </Link>
        </p>
        <p className="mt-6">
          <Link
            href="/login"
            className="text-sm font-semibold text-emerald-700 underline-offset-4 hover:underline dark:text-emerald-400"
          >
            Autentificare Zmeurel (pentru fermieri)
          </Link>
        </p>
      </div>
    </div>
  )
}
