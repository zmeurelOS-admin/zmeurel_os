import { Download } from 'lucide-react'

import { SectionIntro, SectionShell } from '@/components/landing/landing-shared'

const installItems = [
  {
    title: 'Android',
    description: 'Deschizi aplicația și alegi «Adaugă pe ecranul principal».',
  },
  {
    title: 'iPhone',
    description: 'Deschizi aplicația în Safari și alegi «Add to Home Screen».',
  },
]

export function PwaInstall() {
  return (
    <SectionShell label="Instalare pe telefon" className="border-t border-slate-200 bg-white py-16 md:py-24">
      <SectionIntro
        badge="Instalare pe telefon"
        title="Folosește aplicația pe telefon"
        description="Merge pe Android și iPhone. Poate fi instalată ca o aplicație normală."
      />

      <div className="mx-auto mt-10 grid max-w-3xl grid-cols-1 gap-4 sm:grid-cols-2">
        {installItems.map((item) => (
          <article key={item.title} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[#E8F5EE] text-[#2D6A4F]">
              <Download className="h-5 w-5" />
            </div>
            <h3 className="mt-4 text-lg font-bold text-slate-800">{item.title}</h3>
            <p className="mt-2 text-sm leading-7 text-slate-500">{item.description}</p>
          </article>
        ))}
      </div>
    </SectionShell>
  )
}
