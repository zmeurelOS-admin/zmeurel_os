import type { ReactNode } from 'react'

type SectionIntroProps = {
  badge: string
  title: string
  description?: string
  align?: 'left' | 'center'
  badgeClassName?: string
}

export function SectionIntro({
  badge,
  title,
  description,
  align = 'center',
  badgeClassName,
}: SectionIntroProps) {
  const alignment = align === 'left' ? 'text-left' : 'text-center'
  const width = align === 'left' ? 'max-w-2xl' : 'mx-auto max-w-3xl'

  return (
    <div className={`${width} ${alignment}`}>
      <span
        className={`inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold tracking-wide text-[#2D6A4F] ${badgeClassName ?? ''}`}
      >
        {badge}
      </span>
      <h2 className="mt-4 text-2xl font-extrabold tracking-tight text-slate-800 md:text-4xl">
        {title}
      </h2>
      {description ? <p className="mt-4 text-sm leading-7 text-slate-500 md:text-base">{description}</p> : null}
    </div>
  )
}

type SectionShellProps = {
  id?: string
  label?: string
  className?: string
  children: ReactNode
}

export function SectionShell({ id, label, className = '', children }: SectionShellProps) {
  return (
    <section id={id} aria-label={label} className={className}>
      <div className="mx-auto max-w-6xl px-4">{children}</div>
    </section>
  )
}

type BulletListProps = {
  items: string[]
}

export function BulletList({ items }: BulletListProps) {
  return (
    <ul className="space-y-3 text-sm text-slate-600 md:text-base">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-3">
          <span className="mt-1 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#E8F5EE] text-xs font-bold text-[#2D6A4F]">
            ✓
          </span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  )
}
