import Link from 'next/link'

export function FarmPill() {
  return (
    <Link href="/comanda" className="inline-block">
      <span className="inline-flex cursor-pointer select-none items-center gap-1.5 rounded-full border border-[#F16B6B]/30 bg-[#F16B6B]/[0.06] px-3.5 py-1.5 text-[11px] font-semibold text-[#E15453] transition-colors duration-150 hover:bg-[#F16B6B]/[0.12]">
        🍓 Din ferma noastră →
      </span>
    </Link>
  )
}
