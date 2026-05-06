import { BarChart3, CircleDollarSign, NotebookPen } from 'lucide-react'

import { SectionShell } from '@/components/landing/landing-shared'

const items = [
  {
    icon: NotebookPen,
    title: 'Notezi repede',
    description: 'Înregistrezi recolte, lucrări și vânzări în câteva secunde, direct de pe telefon.',
  },
  {
    icon: BarChart3,
    title: 'Vezi clar',
    description: 'Ai toate datele fermei într-un singur loc, fără foi pierdute și fără Excel-uri separate.',
  },
  {
    icon: CircleDollarSign,
    title: 'Câștigi mai mult',
    description: 'Înțelegi ce produce bine, unde pierzi bani și ce merită repetat în sezonul următor.',
  },
]

export function ValueProps() {
  return (
    <SectionShell label="Avantaje principale" className="border-y border-slate-200 bg-white py-12 md:py-16">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {items.map(({ icon: Icon, title, description }) => (
          <article key={title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[#E8F5EE] text-[#3D7A5F]">
              <Icon className="h-5 w-5" />
            </div>
            <h3 className="mt-4 text-lg font-bold text-slate-800">{title}</h3>
            <p className="mt-2 text-sm leading-7 text-slate-500">{description}</p>
          </article>
        ))}
      </div>
    </SectionShell>
  )
}
