import Image from 'next/image'

import { SectionIntro, SectionShell } from '@/components/landing/landing-shared'

const modules = ['parcele', 'solarii', 'livezi', 'lucrări', 'recolte', 'vânzări', 'cheltuieli', 'comenzi']

export function Solution() {
  return (
    <SectionShell
      id="solutie"
      label="Soluția Zmeurel OS"
      className="border-t border-slate-200 bg-white py-16 md:py-24"
    >
      <SectionIntro
        badge="Soluția"
        title="Ai toate datele fermei într-un singur loc."
        description="Vezi rapid ce se întâmplă în fermă și nu mai cauți informații prin caiete, grupuri sau foi separate."
      />

      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        {modules.map((item) => (
          <span
            key={item}
            className="inline-flex rounded-xl border border-slate-200 bg-[#FAFAF6] px-4 py-2 text-sm font-medium text-slate-700"
          >
            {item}
          </span>
        ))}
      </div>

      <div className="mt-10 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <Image
          src="/landing/screenshot-dashboard.jpg"
          alt="Dashboard Zmeurel OS — recoltare și activitate fermă"
          width={1600}
          height={1040}
          priority
          quality={80}
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 90vw, 1100px"
          className="h-auto w-full"
        />
      </div>
    </SectionShell>
  )
}
