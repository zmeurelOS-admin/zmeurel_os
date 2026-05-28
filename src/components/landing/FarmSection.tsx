import Link from 'next/link'

export function FarmSection() {
  return (
    <section
      aria-labelledby="farm-section-title"
      className="border-y border-[#F3DAD4] bg-[#FFFAF8] px-5 py-10 md:px-10 md:py-12"
    >
      <div className="mx-auto max-w-[640px]">
        <div className="flex gap-3 md:gap-4">
          <span className="shrink-0 text-base leading-none md:hidden" aria-hidden>
            🍓
          </span>
          <div
            className="hidden w-[3px] shrink-0 self-stretch rounded-sm bg-[#F16B6B] md:block"
            aria-hidden
          />
          <div className="min-w-0 flex-1">
            <h3
              id="farm-section-title"
              className="font-serif text-[19px] font-semibold text-[#312E3F]"
            >
              Din ferma Zmeurel
            </h3>
            <p className="mt-2.5 text-sm leading-[1.7] text-[#666]">
              Produse cultivate cu grijă și respect pentru natură, în propria noastră fermă din Bucovina.
              Zmeurel OS a apărut din nevoia reală de a gestiona o fermă proprie — nu din teorie.
            </p>
            <Link
              href="/comanda"
              className="mt-4 block text-[13px] font-semibold text-[#E15453] underline decoration-[#F3DAD4] underline-offset-[3px] transition-colors hover:decoration-[#F16B6B]"
            >
              Vezi magazinul fermei →
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
