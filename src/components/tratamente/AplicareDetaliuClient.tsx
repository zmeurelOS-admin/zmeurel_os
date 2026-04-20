'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

import { Button } from '@/components/ui/button'
import {
  anuleazaAction,
  markAplicataAction,
  reprogrameazaAction,
} from '@/app/(dashboard)/parcele/[id]/tratamente/aplicare/[aplicareId]/actions'
import { AplicareHero } from '@/components/tratamente/AplicareHero'
import { AnuleazaDialog } from '@/components/tratamente/AnuleazaDialog'
import { MarkAplicataSheet, type MarkAplicataFormValues } from '@/components/tratamente/MarkAplicataSheet'
import { MeteoSnapshotCard } from '@/components/tratamente/MeteoSnapshotCard'
import { MeteoWindowBar } from '@/components/tratamente/MeteoWindowBar'
import { ReprogrameazaSheet, type ReprogrameazaFormValues } from '@/components/tratamente/ReprogrameazaSheet'
import { VerificariAutomate, type VerificareAutomataState } from '@/components/tratamente/VerificariAutomate'
import { AppCard } from '@/components/ui/app-card'
import type { AplicareTratamentDetaliu } from '@/lib/supabase/queries/tratamente'
import { isRubusMixt, type ConfigurareSezon } from '@/lib/tratamente/configurare-sezon'
import type { MeteoSnapshot, MeteoZi } from '@/lib/tratamente/meteo'
import type { GrupBiologic } from '@/lib/tratamente/stadii-canonic'
import { toast } from '@/lib/ui/toast'

interface AplicareDetaliuClientProps {
  aplicare: AplicareTratamentDetaliu
  currentOperator: string
  defaultCantitateMl: number | null
  meteoDateLabel: string
  meteoZi: MeteoZi | null
  parcelaId: string
  configurareSezon?: ConfigurareSezon | null
  grupBiologic?: GrupBiologic | null
  stadiuImplicit: string | null
  verificari: {
    phi: VerificareAutomataState
    sezon: VerificareAutomataState
    stoc: VerificareAutomataState
  }
}

function isMeteoSnapshot(value: unknown): value is MeteoSnapshot {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Record<string, unknown>
  return typeof candidate.timestamp === 'string'
}

function normalizeCohorta(value: string | null | undefined) {
  return value === 'floricane' || value === 'primocane' ? value : null
}

export function AplicareDetaliuClient({
  aplicare,
  currentOperator,
  defaultCantitateMl,
  meteoDateLabel,
  meteoZi,
  parcelaId,
  configurareSezon,
  grupBiologic,
  stadiuImplicit,
  verificari,
}: AplicareDetaliuClientProps) {
  const router = useRouter()
  const [markOpen, setMarkOpen] = useState(false)
  const [reprogrameazaOpen, setReprogrameazaOpen] = useState(false)
  const [anulareOpen, setAnulareOpen] = useState(false)
  const [motivAnulare, setMotivAnulare] = useState('')
  const [isPending, startTransition] = useTransition()

  const snapshotSalvat = isMeteoSnapshot(aplicare.meteo_snapshot) ? aplicare.meteo_snapshot : null
  const isPlanificata = aplicare.status === 'planificata'
  const rubusMixt = isRubusMixt(configurareSezon)
  const cohortBlocata = normalizeCohorta(aplicare.linie?.cohort_trigger)
  const cohortImplicita = normalizeCohorta(aplicare.cohort_la_aplicare) ?? cohortBlocata ?? null

  const handleMarkAplicata = async (values: MarkAplicataFormValues) => {
    startTransition(async () => {
      const formData = new FormData()
      formData.set('parcelaId', parcelaId)
      formData.set('aplicareId', aplicare.id)
      formData.set('data_aplicata', values.data_aplicata)
      formData.set('cantitate_totala_ml', values.cantitate_totala_ml ?? '')
      formData.set('operator', values.operator ?? '')
      formData.set('stadiu_la_aplicare', values.stadiu_la_aplicare ?? '')
      if (values.cohort_la_aplicare) {
        formData.set('cohort_la_aplicare', values.cohort_la_aplicare)
      }
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
      formData.set('parcelaId', parcelaId)
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

  const handleAnuleaza = async () => {
    startTransition(async () => {
      const result = await anuleazaAction(aplicare.id, motivAnulare)
      if (!result.ok) {
        toast.error(result.error)
        return
      }

      toast.success('Aplicarea a fost anulată.')
      setAnulareOpen(false)
      router.refresh()
    })
  }

  return (
    <>
      <div className="mx-auto w-full max-w-5xl space-y-4 py-3 pb-32 md:py-4 md:pb-10">
        <AplicareHero aplicare={aplicare} configurareSezon={configurareSezon} />

        {aplicare.status === 'aplicata' ? (
          <MeteoSnapshotCard snapshot={snapshotSalvat} />
        ) : isPlanificata && meteoZi ? (
          <MeteoWindowBar dateLabel={meteoDateLabel} ferestre={meteoZi.ferestre_24h} />
        ) : isPlanificata ? (
          <AppCard className="rounded-2xl">
            <h3 className="text-base text-[var(--text-primary)] [font-weight:650]">Ferestre meteo</h3>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">
              Meteo indisponibil acum. Poți continua și fără snapshot automat.
            </p>
          </AppCard>
        ) : null}

        <VerificariAutomate phi={verificari.phi} sezon={verificari.sezon} stoc={verificari.stoc} />
      </div>

      {!isPlanificata ? (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--divider)] bg-[color:color-mix(in_srgb,var(--surface-page)_92%,transparent)] px-4 py-3 backdrop-blur-sm md:static md:mx-auto md:mt-2 md:max-w-5xl md:border-0 md:bg-transparent md:px-0 md:py-0 md:backdrop-blur-none">
          <Button type="button" variant="outline" className="w-full md:w-auto" asChild>
            <Link href={`/parcele/${parcelaId}/tratamente`}>Înapoi la listă</Link>
          </Button>
        </div>
      ) : (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--divider)] bg-[color:color-mix(in_srgb,var(--surface-page)_92%,transparent)] px-4 py-3 backdrop-blur-sm md:static md:mx-auto md:mt-2 md:max-w-5xl md:border-0 md:bg-transparent md:px-0 md:py-0 md:backdrop-blur-none">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-end">
            <Button type="button" className="w-full bg-[var(--agri-primary)] text-white md:w-auto" onClick={() => setMarkOpen(true)}>
              Marchează ca aplicat
            </Button>
            <Button type="button" variant="outline" className="w-full md:w-auto" onClick={() => setReprogrameazaOpen(true)}>
              Reprogramează
            </Button>
            <Button type="button" variant="ghost" className="w-full text-[var(--status-danger-text)] md:w-auto" onClick={() => setAnulareOpen(true)}>
              Anulează
            </Button>
          </div>
        </div>
      )}

      <MarkAplicataSheet
        cohortLaAplicareBlocata={cohortBlocata}
        defaultCantitateMl={defaultCantitateMl}
        defaultCohortLaAplicare={cohortImplicita}
        defaultOperator={currentOperator}
        defaultStadiu={stadiuImplicit}
        configurareSezon={configurareSezon}
        grupBiologic={grupBiologic}
        isRubusMixt={rubusMixt}
        meteoSnapshot={meteoZi?.snapshot_curent ?? null}
        onOpenChange={setMarkOpen}
        onSubmit={handleMarkAplicata}
        open={markOpen}
        pending={isPending}
      />

      <ReprogrameazaSheet
        defaultDate={aplicare.data_planificata ?? new Date().toISOString().slice(0, 10)}
        onOpenChange={setReprogrameazaOpen}
        onSubmit={handleReprogrameaza}
        open={reprogrameazaOpen}
        pending={isPending}
      />

      <AnuleazaDialog
        motiv={motivAnulare}
        onConfirm={handleAnuleaza}
        onMotivChange={setMotivAnulare}
        onOpenChange={setAnulareOpen}
        open={anulareOpen}
        pending={isPending}
      />
    </>
  )
}
