'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ClipboardList, Plus, Sprout } from 'lucide-react'

import {
  createManualInterventieAction,
  fetchAplicareEditAction,
} from '@/app/(dashboard)/tratamente/actions'
import { AppShell } from '@/components/app/AppShell'
import { AddInterventieFAB } from '@/components/tratamente/AddInterventieFAB'
import { CardAstazi } from '@/components/tratamente/CardAstazi'
import { IntervenitiePickerSheet } from '@/components/tratamente/IntervenitiePickerSheet'
import { JurnalItem } from '@/components/tratamente/JurnalItem'
import { MarkAplicataSheet, type MarkAplicataFormValues } from '@/components/tratamente/MarkAplicataSheet'
import { AppCard } from '@/components/ui/app-card'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/EmptyState'
import { useAddAction } from '@/contexts/AddActionContext'
import { toast } from '@/lib/ui/toast'
import type {
  AplicareCrossParcelItem,
  InterventieRelevantaV2,
  JurnalAplicareItem,
  ParcelaTratamenteSelectOption,
  PlanTratament,
  ProdusFitosanitar,
  StatisticiAplicariCrossParcel,
  SugestieAstazi,
} from '@/lib/supabase/queries/tratamente'
import type { AplicareEditData } from '@/app/(dashboard)/tratamente/actions'
import type { MetodaAplicare } from '@/types/tratamente-metode'

interface HubTratamenteClientProps {
  initialAplicari?: AplicareCrossParcelItem[]
  initialStatistici?: StatisticiAplicariCrossParcel
  loadMeteoForParcela?: unknown
  produseFitosanitare?: ProdusFitosanitar[]
  parceleSelector?: ParcelaTratamenteSelectOption[]
  interventiiRelevante?: InterventieRelevantaV2[]
  jurnalAplicari?: JurnalAplicareItem[]
  sugestieAstazi?: SugestieAstazi | null
  planuriActive?: PlanTratament[]
}

function fallbackJurnalFromAplicari(aplicari: AplicareCrossParcelItem[]): JurnalAplicareItem[] {
  return aplicari
    .filter((aplicare) => aplicare.status === 'aplicata' || aplicare.status === 'ciorna')
    .sort((first, second) =>
      (second.data_aplicata ?? second.data_planificata ?? '').localeCompare(first.data_aplicata ?? first.data_planificata ?? '')
    )
    .slice(0, 10)
    .map((aplicare) => ({
      aplicareId: aplicare.id,
      dataAplicata: aplicare.data_aplicata ?? aplicare.data_planificata ?? '',
      parcelaId: aplicare.parcela_id,
      parcelaNume: aplicare.parcela_nume ?? aplicare.parcela_cod ?? 'Parcelă',
      metodaAplicare: aplicare.metoda_aplicare ?? null,
      produse: aplicare.produse_aplicare.length > 0
        ? aplicare.produse_aplicare.map((produs) => ({
            nume: produs.produs?.nume_comercial ?? produs.produs_nume_snapshot ?? produs.produs_nume_manual ?? 'Produs',
            dozaText: produs.cantitate_text ?? '',
          }))
        : [{ nume: aplicare.produs_nume, dozaText: '' }],
      status: aplicare.status as 'aplicata' | 'ciorna',
    }))
}

export function HubTratamenteClient({
  initialAplicari = [],
  produseFitosanitare = [],
  parceleSelector = [],
  jurnalAplicari,
  sugestieAstazi = null,
  planuriActive = [],
}: HubTratamenteClientProps) {
  const router = useRouter()
  const { registerAddAction } = useAddAction()
  const [pickerOpen, setPickerOpen] = useState(false)
  const [selectedMetoda, setSelectedMetoda] = useState<MetodaAplicare | null>(null)
  const [manualOpen, setManualOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editAplicare, setEditAplicare] = useState<AplicareEditData | null>(null)
  const [isManualSaving, startManualTransition] = useTransition()
  const [isEditLoading, startEditTransition] = useTransition()

  useEffect(() => registerAddAction(() => setPickerOpen(true), '+ Stropit acum'), [registerAddAction])

  const jurnal = jurnalAplicari ?? fallbackJurnalFromAplicari(initialAplicari)
  const jurnalPreview = jurnal.slice(0, 10)
  const defaultParcelaId = sugestieAstazi?.parcela.id ?? parceleSelector[0]?.id ?? null
  const defaultParcelaLabel =
    sugestieAstazi?.parcela.nume ??
    parceleSelector[0]?.nume_parcela ??
    parceleSelector[0]?.id_parcela ??
    null

  const manualParcelaOptions = useMemo(
    () =>
      parceleSelector
        .map((parcela) => ({
          value: parcela.id,
          label: parcela.nume_parcela ?? parcela.id_parcela ?? 'Parcelă',
        }))
        .sort((first, second) => first.label.localeCompare(second.label, 'ro')),
    [parceleSelector]
  )

  const capcanaParcele = useMemo(
    () =>
      parceleSelector.map((parcela) => ({
        id: parcela.id,
        nume_parcela: parcela.nume_parcela ?? parcela.id_parcela ?? 'Parcelă',
        suprafata_ha:
          typeof parcela.suprafata_m2 === 'number' && parcela.suprafata_m2 > 0
            ? Math.round((parcela.suprafata_m2 / 10000) * 100) / 100
            : null,
      })),
    [parceleSelector]
  )

  const handlePickMetoda = (metoda: MetodaAplicare) => {
    setSelectedMetoda(metoda)
    setPickerOpen(false)
    setManualOpen(true)
  }

  const handleManualInterventie = async (values: MarkAplicataFormValues) => {
    startManualTransition(async () => {
      const formData = new FormData()
      formData.set('parcelaId', values.manual_parcela_id ?? defaultParcelaId ?? '')
      formData.set('status', values.manual_status ?? 'aplicata')
      formData.set('data', values.manual_data ?? '')
      formData.set('tip_interventie', values.tip_interventie ?? '')
      formData.set('metoda_aplicare', values.metoda_aplicare ?? '')
      formData.set('scop', values.scop ?? '')
      formData.set('stadiu_la_aplicare', values.stadiu_la_aplicare ?? '')
      formData.set('operator', values.operator ?? '')
      formData.set('observatii', values.observatii ?? '')
      formData.set('cantitate_totala_ml', values.cantitate_totala_ml ?? '')
      formData.set('produse', JSON.stringify(values.produse))
      if (values.meteoSnapshot) {
        formData.set('meteo_snapshot', JSON.stringify(values.meteoSnapshot))
      }
      if (values.diferenteFataDePlan) {
        formData.set('diferente_fata_de_plan', JSON.stringify(values.diferenteFataDePlan))
      }

      const result = await createManualInterventieAction(formData)
      if (!result.ok) {
        toast.error(result.error)
        return
      }

      toast.success('Intervenția a fost salvată.')
      setManualOpen(false)
      router.refresh()
    })
  }

  const handleEditAplicare = (aplicareId: string) => {
    startEditTransition(async () => {
      const result = await fetchAplicareEditAction(aplicareId)
      if (!result.ok) {
        toast.error(result.error)
        return
      }

      setEditAplicare(result.data)
      setEditOpen(true)
    })
  }

  return (
    <AppShell
      header={
        <div className="space-y-1 px-1">
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Tratamente</h1>
          <p className="text-sm text-[var(--text-secondary)]">Jurnal, recomandări și planuri active.</p>
        </div>
      }
    >
      <div className="mx-auto w-full max-w-3xl space-y-6 py-3 md:py-5">
        <CardAstazi sugestie={sugestieAstazi} onStropitAcum={() => setPickerOpen(true)} />

        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wide text-[var(--text-primary)]">Jurnal stropit</h2>
              <p className="text-xs text-[var(--text-secondary)]">Ultimele aplicări și ciorne din ultimele 30 de zile.</p>
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={() => router.push('/tratamente?view=jurnal')}>
              Vezi tot
            </Button>
          </div>

          {jurnalPreview.length > 0 ? (
            <div className="space-y-2">
              {jurnalPreview.map((item) => (
                <JurnalItem
                  key={item.aplicareId}
                  item={item}
                  onClick={() => handleEditAplicare(item.aplicareId)}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<ClipboardList className="h-6 w-6" />}
              title="Jurnalul este gol"
              description="Aplicările salvate vor apărea aici cronologic."
              actionLabel="Stropit acum"
              onAction={() => setPickerOpen(true)}
            />
          )}
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wide text-[var(--text-primary)]">Planurile tale</h2>
              <p className="text-xs text-[var(--text-secondary)]">Planurile active rămân sursa principală de recomandări.</p>
            </div>
            <Button asChild size="sm" className="gap-1.5">
              <Link href="/tratamente/planuri/nou">
                <Plus className="h-4 w-4" aria-hidden />
                Plan nou
              </Link>
            </Button>
          </div>

          {planuriActive.length > 0 ? (
            <div className="space-y-2">
              {planuriActive.map((plan) => (
                <Link key={plan.id} href={`/tratamente/planuri/${plan.id}/editor`} className="block">
                  <AppCard className="flex items-center gap-3 rounded-2xl p-4 transition hover:bg-[var(--surface-card-elevated)] active:scale-[0.985]">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--surface-card-muted)] text-[var(--agri-primary)]">
                      <Sprout className="h-5 w-5" aria-hidden />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-[var(--text-primary)]">{plan.nume}</div>
                      <div className="mt-0.5 text-xs text-[var(--text-secondary)]">
                        {plan.cultura_tip} · activ
                      </div>
                    </div>
                    <span className="text-lg text-[var(--text-secondary)]">→</span>
                  </AppCard>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<Sprout className="h-6 w-6" />}
              title="Nu ai planuri active"
              description="Pornește dintr-un template zmeur sau construiește un plan gol."
              actionLabel="Creează plan"
              onAction={() => router.push('/tratamente/planuri/nou')}
            />
          )}
        </section>

        <IntervenitiePickerSheet open={pickerOpen} onOpenChange={setPickerOpen} onPick={handlePickMetoda} />

        {selectedMetoda ? (
          <MarkAplicataSheet
            mode="manual"
            defaultMetoda={selectedMetoda}
            defaultCantitateMl={null}
            defaultOperator=""
            defaultStadiu={sugestieAstazi?.fenofazaCurenta ?? null}
            defaultManualParcelaId={defaultParcelaId}
            defaultManualParcelaLabel={defaultParcelaLabel}
            defaultManualStatus="aplicata"
            configurareSezon={null}
            isRubusMixt={false}
            manualParcele={manualParcelaOptions}
            meteoSnapshot={null}
            onOpenChange={setManualOpen}
            onSubmit={handleManualInterventie}
            open={manualOpen}
            pending={isManualSaving}
            produseFitosanitare={produseFitosanitare}
          />
        ) : null}

        {editAplicare ? (
          <MarkAplicataSheet
            mode="edit"
            aplicareExistenta={editAplicare}
            defaultCantitateMl={null}
            defaultOperator={editAplicare.operator ?? ''}
            defaultStadiu={editAplicare.stadiuLaAplicare}
            meteoSnapshot={null}
            onOpenChange={setEditOpen}
            onSubmit={async () => {}}
            open={editOpen}
            pending={isEditLoading}
            produseFitosanitare={produseFitosanitare}
          />
        ) : null}

        <AddInterventieFAB
          parcele={capcanaParcele}
          fenofazaCurenta={sugestieAstazi?.fenofazaCurenta ?? null}
          markAplicataProps={{
            defaultCantitateMl: null,
            defaultOperator: '',
            defaultStadiu: sugestieAstazi?.fenofazaCurenta ?? null,
            defaultManualParcelaId: defaultParcelaId,
            defaultManualParcelaLabel: defaultParcelaLabel,
            defaultManualStatus: 'aplicata',
            configurareSezon: null,
            isRubusMixt: false,
            manualParcele: manualParcelaOptions,
            meteoSnapshot: null,
            onSubmit: handleManualInterventie,
            pending: isManualSaving,
            produseFitosanitare,
          }}
        />
      </div>
    </AppShell>
  )
}
