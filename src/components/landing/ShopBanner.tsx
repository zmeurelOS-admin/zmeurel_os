import Link from 'next/link'

export function ShopBanner() {
  return (
    <div className="mx-auto mb-8 max-w-2xl rounded-2xl bg-[#F16B6B] px-5 py-5 text-left text-white shadow-md sm:px-6 sm:py-6">
      <div className="flex items-center gap-2">
        <span
          className="relative inline-flex h-2.5 w-2.5 shrink-0 rounded-full bg-[#25D366]"
          aria-hidden
        >
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#25D366] opacity-75" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#25D366]" />
        </span>
        <span className="text-[11px] font-bold uppercase tracking-wider text-white/95">Acum disponibil</span>
      </div>

      <p className="mt-3 text-lg font-bold leading-snug sm:text-xl">🍓 Afine siberiene proaspete</p>
      <p className="mt-1.5 text-sm text-white/90">Culese azi · Livrare în aceeași zi · Văratec</p>

      <Link
        href="/comanda"
        className="mt-4 inline-flex items-center justify-center rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-[#E15453] transition hover:bg-white/95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#F16B6B]"
      >
        Comandă acum →
      </Link>
    </div>
  )
}
