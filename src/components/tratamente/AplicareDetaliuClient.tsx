'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  anuleazaAction,
  markAplicataAction,
  reprogrameazaAction,
} from '@/app/(dashboard)/parcele/[id]/tratamente/aplicare/[aplicareId]/actions'
import { AplicareHero } from '@/components/tratamente/AplicareHero'
import { MarkAplicataSheet, type MarkAplicataFormValues } from '@/components/tratamente/MarkAplicataSheet'
import { MeteoWindowBar } from '@/components/tratamente/MeteoWindowBar'
import { ReprogrameazaSheet, type ReprogrameazaFormValues } from '@/components/tratamente/ReprogrameazaSheet'
import { VerificariAutomate, type VerificareAutomataState } from '@/components/tratamente/VerificariAutomate'
import { AppCard } from '@/components/ui/app-card'
import type { AplicareTratamentDetaliu } from '@/lib/supabase/queries/tratamente'
import type { MeteoSnapshot, MeteoZi } from '@/lib/tratamente/meteo'
import { toast } from '@/lib/ui/toast'

interface AplicareDetaliuClientProps {
  aplicare: AplicareTratamentDetaliu
  currentOperator: string
  defaultCantitateMl: number | null
  meteoDateLabel: string
  meteoZi: MeteoZi | null
  parcelaId: string
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

function SnapshotCard({ snapshot }: { snapshot: MeteoSnapshot }) {
  return (
    <AppCard className="rounded-2xl">
      <h3 className="text-base text-[var(--text-primary)] [font-weight:650]">Snapshot meteo salvat</h3>
      <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-[var(--text-secondary)]">
        <p>{`Temp: ${snapshot.temperatura_c ?? '—'}°C`}</p>
        <p>{`Umiditate: ${snapshot.umiditate_pct ?? '—'}%`}</p>
        <p>{`Vânt: ${snapshot.vant_kmh ?? '—'} km/h`}</p>
        <p>{`Ploaie 24h: ${snapshot.precipitatii_mm_24h ?? '—'} mm`}</p>
        <p className="col-span-2">{snapshot.descriere ?? 'Fără descriere meteo disponibilă.'}</p>
      </div>
    </AppCard>
  )
}

export function AplicareDetaliuClient({
  aplicare,
  currentOperator,
  defaultCantitateMl,
  meteoDateLabel,
  meteoZi,
  parcelaId,
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

  const handleMarkAplicata = async (values: MarkAplicataFormValues) => {
    startTransition(async () => {
      const formData = new FormData()
      formData.set('parcelaId', parcelaId)
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
        <AplicareHero aplicare={aplicare} />

        {aplicare.status === 'aplicata' && snapshotSalvat ? (
          <SnapshotCard snapshot={snapshotSalvat} />
        ) : meteoZi ? (
          <MeteoWindowBar dateLabel={meteoDateLabel} ferestre={meteoZi.ferestre_24h} />
        ) : (
          <AppCard className="rounded-2xl">
            <h3 className="text-base text-[var(--text-primary)] [font-weight:650]">Ferestre meteo pentru aplicare</h3>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">
              Meteo nu este disponibil acum. Poți continua și fără snapshot automat.
            </p>
          </AppCard>
        )}

        <VerificariAutomate phi={verificari.phi} sezon={verificari.sezon} stoc={verificari.stoc} />
      </div>

      {aplicare.status === 'aplicata' ? (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--divider)] bg-[color:color-mix(in_srgb,var(--surface-page)_92%,transparent)] px-4 py-3 backdrop-blur-sm md:static md:mx-auto md:mt-2 md:max-w-5xl md:border-0 md:bg-transparent md:px-0 md:py-0 md:backdrop-blur-none">
          <Button type="button" variant="outline" className="w-full md:w-auto" asChild>
            <Link href={`/parcele/${parcelaId}/tratamente/toate`}>Vezi istoric</Link>
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
        defaultCantitateMl={defaultCantitateMl}
        defaultOperator={currentOperator}
        defaultStadiu={stadiuImplicit}
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

      <AlertDialog open={anulareOpen} onOpenChange={setAnulareOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Anulezi aplicarea?</AlertDialogTitle>
            <AlertDialogDescription>
              Poți lăsa un motiv scurt pentru istoric. Aplicarea va rămâne înregistrată cu status anulat.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            rows={4}
            value={motivAnulare}
            onChange={(event) => setMotivAnulare(event.target.value)}
            placeholder="Ex: Fereastră meteo nefavorabilă."
          />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Înapoi</AlertDialogCancel>
            <Button type="button" className="bg-[var(--status-danger-text)] text-white" onClick={handleAnuleaza} disabled={isPending}>
              {isPending ? 'Se salvează...' : 'Confirmă anularea'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
