import Link from 'next/link'
import { differenceInCalendarDays, endOfDay, format, parseISO } from 'date-fns'
import { ro } from 'date-fns/locale'
import { ArrowLeft } from 'lucide-react'
import { notFound } from 'next/navigation'

import { AppShell } from '@/components/app/AppShell'
import { CalendarTratamenteClient } from '@/components/tratamente/CalendarTratamenteClient'
import { Button } from '@/components/ui/button'
import { CompactPageHeader } from '@/components/layout/CompactPageHeader'
import {
  getAplicariAnualAgregate,
  getConformitateMetrici,
  getParcelaTratamenteContext,
  getPlanActivPentruParcela,
  getStadiuCurentParcela,
  listProduseFitosanitare,
} from '@/lib/supabase/queries/tratamente'
import { buildGanttLayout } from '@/lib/tratamente/conformitate'
import { calculatePhiDeadline, extractFracHistory } from '@/lib/tratamente'

type PageProps = {
  params: Promise<{ id: string }>
  searchParams: Promise<{ an?: string }>
}

function resolveYear(raw: string | undefined): number {
  const currentYear = new Date().getUTCFullYear()
  const parsed = Number(raw)
  if (!Number.isInteger(parsed) || parsed < 2020 || parsed > 2100) return currentYear
  return parsed
}

function formatDateRo(value: string): string {
  return format(parseISO(value), 'd MMM yyyy', { locale: ro })
}

function formatAplicareDoza(aplicare: Awaited<ReturnType<typeof getAplicariAnualAgregate>>[number]): string | null {
  if (typeof aplicare.doza_ml_per_hl === 'number') {
    return `${aplicare.doza_ml_per_hl} ml/hl`
  }
  if (typeof aplicare.doza_l_per_ha === 'number') {
    return `${aplicare.doza_l_per_ha} l/ha`
  }
  return null
}

function isCopperAplicare(substantaActiva: string | null): boolean {
  const value = substantaActiva?.trim().toLowerCase() ?? ''
  return ['cupru', 'copper', 'hidroxid de cupru', 'sulfat de cupru'].some((keyword) => value.includes(keyword))
}

export default async function CalendarTratamentePage({ params, searchParams }: PageProps) {
  const [{ id: parcelaId }, { an: anParam }] = await Promise.all([params, searchParams])
  const an = resolveYear(anParam)

  const [parcela, planActiv, stadiuCurent, aplicari, metrici, produse] = await Promise.all([
    getParcelaTratamenteContext(parcelaId),
    getPlanActivPentruParcela(parcelaId, an),
    getStadiuCurentParcela(parcelaId, an),
    getAplicariAnualAgregate(parcelaId, an),
    getConformitateMetrici(parcelaId, an),
    listProduseFitosanitare(),
  ])

  if (!parcela) {
    notFound()
  }

  const yearOptions = Array.from({ length: 5 }, (_, index) => an - 2 + index)
  const ganttRows = buildGanttLayout(aplicari, an)
  const ganttLabelsById = Object.fromEntries(
    aplicari.map((aplicare) => [
      aplicare.id,
      {
        produs: aplicare.produs_nume,
        data: formatDateRo(aplicare.data_aplicata ?? aplicare.data_planificata ?? `${an}-01-01`),
        // --- FIX 3: detalii reale pentru sheet-ul GanttTimeline, fără schimbarea interfeței lui ---
        doza: formatAplicareDoza(aplicare) ?? undefined,
        stadiu: aplicare.stadiu_la_aplicare ?? aplicare.stadiu_trigger ?? undefined,
      },
    ])
  )

  const aplicariCuCupru = aplicari
    .filter((aplicare) => aplicare.status === 'aplicata' && isCopperAplicare(aplicare.substanta_activa))
    .slice(0, 10)
    .map((aplicare) => ({
      id: aplicare.id,
      produs: aplicare.produs_nume,
      data: formatDateRo(aplicare.data_aplicata ?? aplicare.data_planificata ?? `${an}-01-01`),
    }))

  const fracTimeline = extractFracHistory(
    aplicari
      .filter((aplicare) => aplicare.status === 'aplicata' && Boolean(aplicare.data_aplicata))
      .map((aplicare) => ({
        aplicareId: aplicare.id,
        produsId: aplicare.produs_id,
        produsNume: aplicare.produs_nume,
        dataAplicata: aplicare.data_aplicata ?? '',
      })),
    produse
  ).map((item) => ({
    aplicareId: item.aplicareId,
    cod: item.codPrincipal,
  }))

  const today = endOfDay(new Date())
  const phiActiveItems = aplicari
    .filter(
      (aplicare) =>
        aplicare.status === 'aplicata' &&
        Boolean(aplicare.data_aplicata) &&
        typeof aplicare.produs_phi_zile === 'number' &&
        aplicare.produs_phi_zile > 0
    )
    .map((aplicare) => {
      const appliedAt = parseISO(aplicare.data_aplicata ?? '')
      const phiEnd = calculatePhiDeadline(appliedAt, aplicare.produs_phi_zile ?? 0)
      return {
        aplicareId: aplicare.id,
        produs: aplicare.produs_nume,
        dataAplicata: formatDateRo(aplicare.data_aplicata ?? ''),
        dataSigura: format(phiEnd, 'd MMM yyyy', { locale: ro }),
        phiZile: aplicare.produs_phi_zile ?? 0,
        zileTrecute: differenceInCalendarDays(today, appliedAt),
        active: differenceInCalendarDays(phiEnd, today) >= 0,
      }
    })
    .filter((item) => item.active && item.zileTrecute <= 30)
    .slice(0, 6)
    .map(({ active: _active, ...item }) => item)

  const stats = {
    total: aplicari.length,
    aplicate: aplicari.filter((aplicare) => aplicare.status === 'aplicata').length,
    planificate: aplicari.filter((aplicare) => aplicare.status === 'planificata' || aplicare.status === 'reprogramata').length,
    anulate: aplicari.filter((aplicare) => aplicare.status === 'anulata').length,
  }

  return (
    <AppShell
      header={
        <CompactPageHeader
          title="Calendar tratamente"
          subtitle={parcela.nume_parcela ?? 'Parcelă'}
          showMobileRightSlot
          rightSlot={
            <span className="inline-flex h-8 items-center rounded-full border border-[var(--border-default)] bg-[var(--surface-card)] px-3 text-xs font-semibold text-[var(--text-primary)] lg:border-white/20 lg:bg-white/12 lg:text-[var(--text-on-accent)]">
              {an}
            </span>
          }
          summary={
            <div className="flex items-center justify-start">
              <Button type="button" variant="outline" size="sm" asChild>
                <Link href={`/parcele/${parcelaId}/tratamente`}>
                  <ArrowLeft className="h-4 w-4" />
                  Înapoi la tratamente
                </Link>
              </Button>
            </div>
          }
        />
      }
      bottomInset="calc(var(--app-nav-clearance) + 1rem)"
    >
      <CalendarTratamenteClient
        an={an}
        aplicariCuCupru={aplicariCuCupru}
        exportHref={`/parcele/${parcelaId}/tratamente/calendar/export?an=${an}`}
        fracTimeline={fracTimeline}
        ganttLabelsById={ganttLabelsById}
        ganttRows={ganttRows}
        metrici={metrici}
        parcelaCod={parcela.id_parcela}
        parcelaId={parcelaId}
        parcelaNume={parcela.nume_parcela}
        phiActiveItems={phiActiveItems}
        planActiv={planActiv?.plan?.nume ?? null}
        stats={stats}
        stadiuCurent={stadiuCurent?.stadiu ?? null}
        violatiiFrac={metrici.fracDetalii}
        yearOptions={yearOptions}
      />
    </AppShell>
  )
}

