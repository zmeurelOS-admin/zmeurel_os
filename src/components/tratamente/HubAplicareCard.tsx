'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition, type KeyboardEvent, type MouseEvent } from 'react'
import { CheckCircle2, CloudSun, Droplets, FlaskConical, MapPin, Wind } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { ro } from 'date-fns/locale'

import {
  markAplicataAction,
  reprogrameazaAction,
} from '@/app/(dashboard)/parcele/[id]/tratamente/aplicare/[aplicareId]/actions'
import { getAplicareStatusLabel, getAplicareStatusTone, isAplicareProgramata } from '@/components/tratamente/aplicare-status'
import { MarkAplicataSheet, type MarkAplicataFormValues } from '@/components/tratamente/MarkAplicataSheet'
import { MeteoWindowBar } from '@/components/tratamente/MeteoWindowBar'
import { ReprogrameazaSheet, type ReprogrameazaFormValues } from '@/components/tratamente/ReprogrameazaSheet'
import { Button } from '@/components/ui/button'
import StatusBadge from '@/components/ui/StatusBadge'
import { cn } from '@/lib/utils'
import type { AplicareCrossParcelItem } from '@/lib/supabase/queries/tratamente'
import type { MeteoZi } from '@/lib/tratamente/meteo'
import { toast } from '@/lib/ui/toast'

interface HubAplicareCardProps {
  aplicare: AplicareCrossParcelItem
  meteoLoading?: boolean
  meteoZi: MeteoZi | null
  showMeteoBar: boolean
}

function formatHubDate(value: string | null): string {
  if (!value) return 'Fără dată'

  try {
    return format(parseISO(value), 'EEEE d MMM', { locale: ro })
  } catch {
    return value
  }
}

function formatDoza(aplicare: AplicareCrossParcelItem): string | null {
  if (typeof aplicare.doza_ml_per_hl === 'number') return `${aplicare.doza_ml_per_hl} ml/hl`
  if (typeof aplicare.doza_l_per_ha === 'number') return `${aplicare.doza_l_per_ha} l/ha`
  return null
}

function formatStadiuLabel(value: string | null): string | null {
  if (!value) return null
  return value.replaceAll('_', ' ')
}

function getMeteoStats(meteoZi: MeteoZi | null) {
  if (!meteoZi) {
    return {
      areSafeWindow: false,
      maxWind: null as number | null,
      precip24h: null as number | null,
      minHour: null as string | null,
    }
  }

  const safeSlots = meteoZi.ferestre_24h.filter((slot) => slot.safe)
  const winds = meteoZi.ferestre_24h
    .map((slot) => slot.vant_kmh)
    .filter((value): value is number => typeof value === 'number')
  const precip24h = meteoZi.ferestre_24h.reduce((sum, slot) => sum + (slot.precipitatii_mm ?? 0), 0)

  return {
    areSafeWindow: safeSlots.length > 0,
    maxWind: winds.length > 0 ? Math.max(...winds) : null,
    precip24h: precip24h > 0 ? Math.round(precip24h * 10) / 10 : 0,
    minHour: safeSlots[0]?.ora_start ?? null,
  }
}

function stopCardNavigation(event: MouseEvent<HTMLElement>) {
  event.stopPropagation()
}

export function HubAplicareCard({
  aplicare,
  meteoLoading = false,
  meteoZi,
  showMeteoBar,
}: HubAplicareCardProps) {
  const router = useRouter()
  const [markOpen, setMarkOpen] = useState(false)
  const [reprogrameazaOpen, setReprogrameazaOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const detailHref = `/parcele/${aplicare.parcela_id}/tratamente/aplicare/${aplicare.id}`
  const parcelaHref = `/parcele/${aplicare.parcela_id}/tratamente`
  const dateLabel = formatHubDate(aplicare.data_programata ?? aplicare.data_aplicata)
  const doza = formatDoza(aplicare)
  const stadiu = formatStadiuLabel(aplicare.stadiu_trigger)
  const meteoStats = getMeteoStats(meteoZi)
  const canEdit = isAplicareProgramata(aplicare.status)

  const handleOpenDetail = () => {
    router.push(detailHref)
  }

  const handleCardKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      handleOpenDetail()
    }
  }

  const handleMarkAplicata = async (values: MarkAplicataFormValues) => {
    startTransition(async () => {
      const formData = new FormData()
      formData.set('parcelaId', aplicare.parcela_id)
      formData.set('aplicareId', aplicare.id)
      formData.set('data_aplicata', values.data_aplicata)
      formData.set('cantitate_totala_ml', values.cantitate_totala_ml ?? '')
      formData.set('operator', values.operator ?? '')
      formData.set('stadiu_la_aplicare', values.stadiu_la_aplicare ?? '')
      formData.set('observatii', values.observatii ?? '')
      if (values.meteoSnapshot) {
        formData.set('meteo_snapshot', JSON.stringify(values.meteoSnapshot))
      }

      const result = await markAplicataAction(formData)
      if (!result.ok) {
        toast.error(result.error)
        return
      }

      toast.success('Aplicarea a fost marcată ca efectuată.')
      setMarkOpen(false)
      router.refresh()
    })
  }

  const handleReprogrameaza = async (values: ReprogrameazaFormValues) => {
    startTransition(async () => {
      const formData = new FormData()
      formData.set('parcelaId', aplicare.parcela_id)
      formData.set('aplicareId', aplicare.id)
      formData.set('data_planificata', values.data_planificata)
      formData.set('motiv', values.motiv ?? '')

      const result = await reprogrameazaAction(formData)
      if (!result.ok) {
        toast.error(result.error)
        return
      }

      toast.success('Aplicarea a fost reprogramată.')
      setReprogrameazaOpen(false)
      router.refresh()
    })
  }

  return (
    <>
      <article
        role="link"
        tabIndex={0}
        onClick={handleOpenDetail}
        onKeyDown={handleCardKeyDown}
        className="rounded-[22px] border border-[var(--border-default)] bg-[var(--surface-card)] p-4 text-left shadow-[var(--shadow-soft)] outline-none transition hover:bg-[var(--surface-card-elevated)] focus-visible:ring-[3px] focus-visible:ring-[color:color-mix(in_srgb,var(--agri-primary)_24%,transparent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-page)] active:scale-[0.985]"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm capitalize text-[var(--text-primary)] [font-weight:650]">{dateLabel}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-[var(--text-secondary)]">
              <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <Link
                href={parcelaHref}
                onClick={stopCardNavigation}
                className="font-medium text-[var(--text-primary)] underline-offset-4 hover:underline"
              >
                {aplicare.parcela_nume ?? 'Parcelă'}
              </Link>
            </div>
          </div>
          <StatusBadge
            text={getAplicareStatusLabel(aplicare.status)}
            variant={getAplicareStatusTone(aplicare.status)}
          />
        </div>

        <div className="mt-3 space-y-1">
          <h3 className="text-lg leading-tight text-[var(--text-primary)] [font-weight:650]">{aplicare.produs_nume}</h3>
          <p className="text-sm text-[var(--text-secondary)]">
            {aplicare.plan_nume ?? 'Plan fără nume'}
            {stadiu ? ` · ${stadiu}` : ''}
          </p>
          {doza ? <p className="text-sm text-[var(--text-secondary)]">{doza}</p> : null}
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {aplicare.produs_frac ? (
            <span className="inline-flex items-center rounded-full border border-[var(--border-default)] bg-[var(--surface-card-muted)] px-2.5 py-1 text-xs font-medium text-[var(--text-secondary)]">
              FRAC {aplicare.produs_frac}
            </span>
          ) : null}
          {aplicare.phi_warning ? (
            <span className="inline-flex items-center rounded-full border border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] px-2.5 py-1 text-xs font-medium text-[var(--status-danger-text)]">
              PHI warning
            </span>
          ) : null}
          {meteoZi ? (
            <span
              className={cn(
                'inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium',
                meteoStats.areSafeWindow
                  ? 'border-[var(--status-success-border)] bg-[var(--status-success-bg)] text-[var(--status-success-text)]'
                  : 'border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] text-[var(--status-warning-text)]'
              )}
            >
              <CloudSun className="mr-1 h-3.5 w-3.5" aria-hidden />
              {meteoStats.areSafeWindow ? 'Fereastră meteo OK' : 'Meteo nefavorabilă'}
            </span>
          ) : null}
        </div>

        {meteoLoading ? (
          <div className="mt-3 rounded-2xl bg-[var(--surface-card-muted)] p-3 text-xs text-[var(--text-secondary)]">
            Se încarcă datele meteo pentru această parcelă...
          </div>
        ) : meteoZi ? (
          <div className="mt-3 rounded-2xl bg-[var(--surface-card-muted)] p-3">
            <div className="grid gap-2 text-xs text-[var(--text-secondary)] sm:grid-cols-3">
              <p className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                {meteoStats.minHour
                  ? `Primă fereastră sigură: ${format(parseISO(meteoStats.minHour), 'HH:mm', { locale: ro })}`
                  : 'Nu există fereastră sigură'}
              </p>
              <p className="flex items-center gap-1.5">
                <Wind className="h-3.5 w-3.5" aria-hidden />
                Vânt max: {typeof meteoStats.maxWind === 'number' ? `${meteoStats.maxWind} km/h` : '—'}
              </p>
              <p className="flex items-center gap-1.5">
                <Droplets className="h-3.5 w-3.5" aria-hidden />
                Ploaie 24h: {typeof meteoStats.precip24h === 'number' ? `${meteoStats.precip24h} mm` : '—'}
              </p>
            </div>
          </div>
        ) : null}

        {showMeteoBar && meteoZi ? (
          <div className="mt-3" onClick={stopCardNavigation}>
            <MeteoWindowBar dateLabel="Ferestre 24h" ferestre={meteoZi.ferestre_24h} />
          </div>
        ) : null}

        {aplicare.observatii ? (
          <div className="mt-3 rounded-2xl bg-[var(--surface-card-muted)] p-3 text-sm text-[var(--text-secondary)]">
            {aplicare.observatii}
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-2" onClick={stopCardNavigation}>
          {canEdit ? (
            <>
              <Button
                type="button"
                size="sm"
                className="bg-[var(--agri-primary)] text-white"
                onClick={() => setMarkOpen(true)}
                disabled={isPending}
              >
                Marchează aplicată
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setReprogrameazaOpen(true)}
                disabled={isPending}
              >
                Reprogramează
              </Button>
            </>
          ) : null}
          <Button type="button" size="sm" variant="ghost" asChild>
            <Link href={detailHref}>Vezi detalii</Link>
          </Button>
        </div>
      </article>

      <MarkAplicataSheet
        defaultCantitateMl={null}
        defaultOperator={aplicare.operator ?? ''}
        defaultStadiu={aplicare.stadiu_trigger}
        meteoSnapshot={meteoZi?.snapshot_curent ?? null}
        onOpenChange={setMarkOpen}
        onSubmit={handleMarkAplicata}
        open={markOpen}
        pending={isPending}
      />

      <ReprogrameazaSheet
        defaultDate={aplicare.data_programata ?? new Date().toISOString().slice(0, 10)}
        onOpenChange={setReprogrameazaOpen}
        onSubmit={handleReprogrameaza}
        open={reprogrameazaOpen}
        pending={isPending}
      />
    </>
  )
}
