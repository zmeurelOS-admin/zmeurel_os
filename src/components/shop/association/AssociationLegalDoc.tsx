import type { ReactNode } from 'react'

import { gustaBrandColors } from '@/lib/shop/association/brand-tokens'

type Props = {
  title: string
  children: ReactNode
}

/* DRAFT_LEGAL_REVIEW — structură comună pagini legale magazin asociație */
export function AssociationLegalDoc({ title, children }: Props) {
  return (
    <article
      className="assoc-body mx-auto max-w-[720px] px-6 py-10 md:px-12 md:py-12"
      style={{ color: '#3D4543' }}
    >
      <h1
        className="assoc-heading text-2xl font-extrabold tracking-tight md:text-[26px]"
        style={{ color: 'var(--assoc-ink, #0c0f13)' }}
      >
        {title}
      </h1>
      <div className="mt-8 space-y-8 text-[14px] leading-[1.7] [&_a]:font-semibold [&_a]:underline [&_a]:underline-offset-2 [&_a]:hover:opacity-90 [&_section>h2]:mb-3 [&_section>p+p]:mt-3 [&_section>ul]:mt-2 [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5">
        {children}
      </div>
      <p
        className="assoc-body mt-12 border-t border-black/10 pt-6 text-[12px] leading-relaxed text-[#6B7A72]"
        style={{ borderColor: 'rgba(61,69,67,0.15)' }}
      >
        Ultima actualizare: aprilie 2026 · Acest document este draft și necesită revizuire juridică.
      </p>
    </article>
  )
}

export function AssociationLegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="assoc-heading text-[18px] font-bold" style={{ color: gustaBrandColors.primary }}>
        {title}
      </h2>
      {children}
    </section>
  )
}
