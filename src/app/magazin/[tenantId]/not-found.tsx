import Link from 'next/link'

export default function MagazinNotFound() {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-gradient-to-b from-[#f6faf7] to-[#e8f0ec] px-6 text-center dark:from-zinc-950 dark:to-zinc-900">
      <h1 className="text-xl font-bold text-emerald-950 dark:text-zinc-100">Magazin indisponibil</h1>
      <p className="mt-2 max-w-sm text-sm text-emerald-900/70 dark:text-zinc-400">
        Nu am găsit acest catalog. Verifică linkul sau contactează fermierul pentru un link actualizat.
      </p>
      <Link
        href="/magazin"
        className="mt-6 text-sm font-semibold text-emerald-700 underline-offset-4 hover:underline dark:text-emerald-400"
      >
        Despre magazinul fermier
      </Link>
    </div>
  )
}
