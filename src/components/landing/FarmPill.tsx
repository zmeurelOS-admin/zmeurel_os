import Link from 'next/link'

export function FarmPill() {
  return (
    <div className="mb-3 flex justify-center">
      <Link href="/comanda" className="mx-auto w-fit">
        <span className="inline-flex w-fit cursor-pointer select-none items-center gap-1.5 rounded-full border border-[#F16B6B]/30 bg-[#F16B6B]/[0.06] px-3 py-[5px] text-[11px] font-semibold leading-none text-[#E15453] transition-colors duration-150 hover:bg-[#F16B6B]/[0.12]">
          🍓 Din ferma noastră →
        </span>
      </Link>
    </div>
  )
}
