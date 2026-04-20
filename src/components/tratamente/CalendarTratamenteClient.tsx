'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'

import { CupruCumulatCard } from '@/components/tratamente/CupruCumulatCard'
import { FracRotationCard } from '@/components/tratamente/FracRotationCard'
import { GanttTimeline } from '@/components/tratamente/GanttTimeline'
import { PhiActiveCard } from '@/components/tratamente/PhiActiveCard'
import { SumarStatisticiCard } from '@/components/tratamente/SumarStatisticiCard'
import { Button } from '@/components/ui/button'
import type { GanttRow, ConformitateMetrici } from '@/lib/tratamente/conformitate'

interface CalendarTratamenteClientProps {
  an: number
  aplicariCuCupru: Array<{ data: string; id: string; produs: string }>
  exportHref: string
  fracTimeline: Array<{ aplicareId: string; cod: string | null }>
  ganttLabelsById: Record<string, { produs: string; data: string }>
  ganttRows: GanttRow[]
  metrici: ConformitateMetrici
  parcelaId: string
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
  parcelaId,
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
    <>
      <div className="mx-auto w-full max-w-7xl space-y-4 py-3 pb-32 md:py-4 md:pb-12">
        <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--surface-card)] p-4 shadow-[var(--shadow-soft)]">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm text-[var(--text-secondary)]">An calendaristic</p>
              <label className="mt-2 inline-flex items-center gap-2 text-sm text-[var(--text-primary)]">
                <span className="sr-only">Selectează anul calendarului</span>
                <select
                  aria-label="Selectează anul calendarului"
                  className="min-h-11 rounded-xl border border-[var(--border-default)] bg-[var(--surface-page)] px-3 text-sm text-[var(--text-primary)]"
                  value={String(an)}
                  onChange={(event) => {
                    const nextYear = Number(event.target.value)
                    startTransition(() => {
                      router.push(`/parcele/${parcelaId}/tratamente/calendar?an=${nextYear}`)
                    })
                  }}
                >
                  {yearOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <Button type="button" className="bg-[var(--agri-primary)] text-white md:w-auto" asChild>
              <a href={exportHref}>{isPending ? 'Se actualizează...' : 'Exportă fișă ANSVSA (PDF)'}</a>
            </Button>
          </div>
        </div>

        <GanttTimeline
          labelsById={ganttLabelsById}
          rows={ganttRows}
          onSelect={(aplicareId) => router.push(`/parcele/${parcelaId}/tratamente/aplicare/${aplicareId}`)}
        />

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
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--divider)] bg-[color:color-mix(in_srgb,var(--surface-page)_92%,transparent)] px-4 py-3 backdrop-blur-sm md:static md:mx-auto md:mt-2 md:max-w-7xl md:border-0 md:bg-transparent md:px-0 md:py-0 md:backdrop-blur-none">
        <Button type="button" className="w-full bg-[var(--agri-primary)] text-white md:w-auto" asChild>
          <a href={exportHref}>Exportă fișă ANSVSA (PDF)</a>
        </Button>
      </div>
    </>
  )
}

