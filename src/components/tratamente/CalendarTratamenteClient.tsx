'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { ArrowLeft } from 'lucide-react'

import { CupruCumulatCard } from '@/components/tratamente/CupruCumulatCard'
import { FracRotationCard } from '@/components/tratamente/FracRotationCard'
import { GanttTimeline } from '@/components/tratamente/GanttTimeline'
import { PhiActiveCard } from '@/components/tratamente/PhiActiveCard'
import { SumarStatisticiCard } from '@/components/tratamente/SumarStatisticiCard'
import { Button } from '@/components/ui/button'
import type { GanttRow, ConformitateMetrici } from '@/lib/tratamente/conformitate'

const MONTH_LABELS = ['Ian', 'Feb', 'Mar', 'Apr', 'Mai', 'Iun', 'Iul', 'Aug', 'Sep', 'Oct', 'Noi', 'Dec']

interface CalendarTratamenteClientProps {
  an: number
  aplicariCuCupru: Array<{ data: string; id: string; produs: string }>
  exportHref: string
  fracTimeline: Array<{ aplicareId: string; cod: string | null }>
  ganttLabelsById: Record<string, { data: string; doza?: string; produs: string; stadiu?: string; tip_interventie?: string }>
  ganttRows: GanttRow[]
  metrici: ConformitateMetrici
  parcelaCod: string | null
  parcelaId: string
  parcelaNume: string | null
  phiActiveItems: Array<{
    aplicareId: string
    dataAplicata: string
    dataSigura: string
    phiZile: number
    produs: string
    zileTrecute: number
  }>
  planActiv: string | null
  stats: {
    anulate: number
    aplicate: number
    planificate: number
    total: number
  }
  stadiuCurent: string | null
  violatiiFrac: Array<{ frac: string; aplicari_consecutive: number }>
  yearOptions: number[]
}

export function CalendarTratamenteClient({
  an,
  aplicariCuCupru,
  exportHref,
  fracTimeline,
  ganttLabelsById,
  ganttRows,
  metrici,
  parcelaCod,
  parcelaId,
  parcelaNume,
  phiActiveItems,
  planActiv,
  stats,
  stadiuCurent,
  violatiiFrac,
  yearOptions,
}: CalendarTratamenteClientProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5 py-3 pb-32 md:py-4 md:pb-12">
      {/* --- SECTION: header --- */}
      <section className="rounded-[24px] bg-[#3D7A5F] px-[18px] py-[18px] text-white shadow-[0_16px_40px_rgba(61,122,95,0.18)]">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="space-y-2">
              <Link
                href={`/parcele/${parcelaId}/tratamente`}
                className="inline-flex items-center gap-1.5 text-xs text-white/65 transition hover:text-white"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Înapoi la tratamente
              </Link>
              <div className="space-y-1">
                <h2 className="text-xl font-extrabold tracking-tight text-white">Calendar tratamente</h2>
                {/* --- FIX 3: subtitle din datele parcelei transmise de Server Component --- */}
                <p className="text-sm text-white/70">
                  {parcelaNume ?? parcelaCod ?? 'Parcelă'}
                  {planActiv ? ` · ${planActiv}` : ''}
                </p>
              </div>
            </div>

            <Button
              type="button"
              className="min-h-11 rounded-xl bg-white px-4 text-[#3D7A5F] hover:bg-white/90 md:w-auto"
              asChild
            >
              <a href={exportHref}>{isPending ? 'Se actualizează...' : 'Exportă fișă ANSVSA (PDF)'}</a>
            </Button>
          </div>

          {/* --- SECTION: year controls --- */}
          <div className="flex flex-wrap gap-2">
            {yearOptions.map((option) => {
              const active = option === an
              return (
                <button
                  key={option}
                  type="button"
                  className={`rounded-full border px-3 py-2 text-sm font-semibold transition ${
                    active
                      ? 'border-white/50 bg-white/30 text-white'
                      : 'border-white/35 bg-transparent text-white hover:bg-white/10'
                  }`}
                  onClick={() => {
                    if (option === an) return
                    startTransition(() => {
                      router.push(`/parcele/${parcelaId}/tratamente/calendar?an=${option}`)
                    })
                  }}
                >
                  {option}
                </button>
              )
            })}
          </div>
        </div>
      </section>

      {/* --- SECTION: month list --- */}
      <section className="space-y-3">
        {ganttRows.map((row) => (
          <article
            key={row.luna}
            className="rounded-[18px] border border-gray-200 bg-white p-4 shadow-[0_8px_24px_rgba(120,100,70,0.08)]"
          >
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-bold text-[var(--text-primary)]">{MONTH_LABELS[row.luna - 1] ?? `Luna ${row.luna}`}</h3>
              <span className="text-xs text-gray-400">{row.aplicari.length} aplicări</span>
            </div>
            <div className="mt-3 h-px w-full bg-gray-200" />

            {row.aplicari.length === 0 ? (
              <p className="pt-3 text-xs italic text-gray-300">Nicio aplicare înregistrată</p>
            ) : (
              <div className="pt-3">
                <GanttTimeline
                  labelsById={ganttLabelsById}
                  rows={[row]}
                  onSelect={(aplicareId) => router.push(`/parcele/${parcelaId}/tratamente/aplicare/${aplicareId}`)}
                />
              </div>
            )}
          </article>
        ))}
      </section>

      {/* --- SECTION: summary cards --- */}
      <div className="grid gap-4 md:grid-cols-2">
        <CupruCumulatCard aplicariCuCupru={aplicariCuCupru} metrici={metrici} />
        <FracRotationCard timeline={fracTimeline} violatii={violatiiFrac} />
        <PhiActiveCard items={phiActiveItems} />
        <SumarStatisticiCard
          anulate={stats.anulate}
          aplicate={stats.aplicate}
          planActiv={planActiv}
          planificate={stats.planificate}
          stadiuCurent={stadiuCurent}
          totalAplicari={stats.total}
        />
      </div>

      {/* --- SECTION: mobile export --- */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--divider)] bg-[color:color-mix(in_srgb,var(--surface-page)_92%,transparent)] px-4 py-3 backdrop-blur-sm md:hidden">
        <Button type="button" className="w-full rounded-xl bg-[#3D7A5F] text-white hover:bg-[#2D5F47]" asChild>
          <a href={exportHref}>Exportă fișă ANSVSA (PDF)</a>
        </Button>
      </div>
    </div>
  )
}
