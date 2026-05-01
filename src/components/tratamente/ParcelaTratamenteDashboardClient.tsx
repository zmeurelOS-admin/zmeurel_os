'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState, useTransition } from 'react'
import { Plus, Sparkles } from 'lucide-react'
import { useRouter } from 'next/navigation'

import {
  assignPlanAction,
  createManualInterventieAction,
  generateAplicariAction,
  planificaInterventieRelevantaAction,
  recordStadiuAction,
} from '@/app/(dashboard)/parcele/[id]/tratamente/actions'
import { EmptyStateTratamente } from '@/components/tratamente/EmptyStateTratamente'
import { AplicareListItem } from '@/components/tratamente/AplicareListItem'
import { AssignPlanSheet } from '@/components/tratamente/AssignPlanSheet'
import { ConfigurareSezonBanner } from '@/components/tratamente/ConfigurareSezonBanner'
import { ConfigurareSezonDialog } from '@/components/tratamente/ConfigurareSezonDialog'
import { MarkAplicataSheet, type MarkAplicataFormValues } from '@/components/tratamente/MarkAplicataSheet'
import {
  getInterventieKey,
  InterventiiRelevanteCard,
} from '@/components/tratamente/InterventiiRelevanteCard'
import { GenereazaAplicariDialog } from '@/components/tratamente/GenereazaAplicariDialog'
import {
  RecordStadiuSheet,
  type RecordStadiuFormValues,
} from '@/components/tratamente/RecordStadiuSheet'
import { PlanActivCard } from '@/components/tratamente/PlanActivCard'
import { StadiuCurentCard, type StageState } from '@/components/tratamente/StadiuCurentCard'
import { AppCard } from '@/components/ui/app-card'
import { Button } from '@/components/ui/button'
import { upsertConfigurareSezonAction } from '@/app/(dashboard)/parcele/[id]/tratamente/actions'
import type {
  AplicareTratamentDetaliu,
  InterventieRelevantaV2,
  ParcelaTratamenteContext,
  PlanActivParcela,
  PlanTratament,
  ProdusFitosanitar,
  StadiuFenologicParcela,
} from '@/lib/supabase/queries/tratamente'
import type { Cohorta, ConfigurareSezon } from '@/lib/tratamente/configurare-sezon'
import {
  listStadiiPentruGrup,
  normalizeStadiu,
  type GrupBiologic,
} from '@/lib/tratamente/stadii-canonic'
import { useAddAction } from '@/contexts/AddActionContext'
import { toast } from '@/lib/ui/toast'

interface ParcelaTratamenteDashboardClientProps {
  an: number
  aplicariCount: number
  createPlanHref: string
  importPlanHref: string
  detailsHref: string | null
  editPlanHref: string | null
  generationPreview: { creatableCount: number; skippedCount: number } | null
  configurareSezon: ConfigurareSezon | null
  grupBiologic?: GrupBiologic | null
  isGlobalEmpty: boolean
  parcela: ParcelaTratamenteContext
  parcelaId: string
  planActiv: PlanActivParcela | null
  planuriDisponibile: PlanTratament[]
  produseFitosanitare: ProdusFitosanitar[]
  interventiiRelevante: InterventieRelevantaV2[]
  stadii: StadiuFenologicParcela[]
  isRubusMixt: boolean
  singleStageState: StageState | null
  dualStageState: { floricane: StageState; primocane: StageState } | null
  urmatoareleAplicari: AplicareTratamentDetaliu[]
}

export function ParcelaTratamenteDashboardClient({
  an,
  aplicariCount,
  createPlanHref,
  importPlanHref,
  detailsHref,
  editPlanHref,
  generationPreview,
  configurareSezon,
  grupBiologic,
  isGlobalEmpty,
  parcela,
  parcelaId,
  planActiv,
  planuriDisponibile,
  produseFitosanitare,
  interventiiRelevante,
  isRubusMixt,
  singleStageState,
  dualStageState,
  urmatoareleAplicari,
}: ParcelaTratamenteDashboardClientProps) {
  const router = useRouter()
  const { registerAddAction } = useAddAction()
  const [recordOpen, setRecordOpen] = useState(false)
  const [recordCohort, setRecordCohort] = useState<Cohorta | undefined>(undefined)
  const [assignOpen, setAssignOpen] = useState(false)
  const [generateOpen, setGenerateOpen] = useState(false)
  const [seasonOpen, setSeasonOpen] = useState(false)
  const [manualOpen, setManualOpen] = useState(false)
  const [pendingInterventieId, setPendingInterventieId] = useState<string | null>(null)
  const [isRecording, startRecordTransition] = useTransition()
  const [isAssigning, startAssignTransition] = useTransition()
  const [isGenerating, startGenerateTransition] = useTransition()
  const [isConfiguring, startConfiguringTransition] = useTransition()
  const [isManualSaving, startManualTransition] = useTransition()
  const [isPlanificaPending, startPlanificaTransition] = useTransition()

  useEffect(() => {
    const unregister = registerAddAction(() => setManualOpen(true), '+ Intervenție manuală')
    return unregister
  }, [registerAddAction])
  const firstStadiu = listStadiiPentruGrup(grupBiologic)[0] ?? 'repaus_vegetativ'
  const primarySuggestedSource =
    singleStageState?.stadiuUrmator ??
    singleStageState?.stadiuCurent?.stadiu ??
    dualStageState?.floricane.stadiuUrmator ??
    dualStageState?.floricane.stadiuCurent?.stadiu ??
    dualStageState?.primocane.stadiuUrmator ??
    dualStageState?.primocane.stadiuCurent?.stadiu ??
    ''

  const suggestedStadiu = useMemo(() => {
    return normalizeStadiu(primarySuggestedSource) ?? firstStadiu
  }, [firstStadiu, primarySuggestedSource])

  const handleRecordStadiu = async (values: RecordStadiuFormValues) => {
    startRecordTransition(async () => {
      const formData = new FormData()
      formData.set('parcelaId', parcelaId)
      formData.set('an', String(an))
      formData.set('stadiu', values.stadiu)
      if (values.cohort) {
        formData.set('cohort', values.cohort)
      }
      formData.set('data_observata', values.data_observata)
      formData.set('sursa', values.sursa)
      formData.set('observatii', values.observatii ?? '')

      const result = await recordStadiuAction(formData)
      if (!result.ok) {
        toast.error(result.error)
        return
      }

      toast.success('Stadiul a fost înregistrat.')
      setRecordOpen(false)
      router.refresh()
    })
  }

  const handleAssignPlan = async (planId: string) => {
    startAssignTransition(async () => {
      const formData = new FormData()
      formData.set('parcelaId', parcelaId)
      formData.set('planId', planId)
      formData.set('an', String(an))

      const result = await assignPlanAction(formData)
      if (!result.ok) {
        toast.error(result.error)
        return
      }

      toast.success('Planul a fost atribuit parcelei.')
      setAssignOpen(false)
      router.refresh()
    })
  }

  const handleGenerateAplicari = async () => {
    startGenerateTransition(async () => {
      const result = await generateAplicariAction(parcelaId, an)
      if (!result.ok) {
        toast.error(result.error)
        return
      }

      toast.success(`${result.createdCount} aplicări create, ${result.skippedCount} deja existau`)
      setGenerateOpen(false)
      router.refresh()
    })
  }

  const handlePlanificaInterventie = (interventie: InterventieRelevantaV2) => {
    const key = getInterventieKey(interventie)
    setPendingInterventieId(key)
    startPlanificaTransition(async () => {
      const formData = new FormData()
      formData.set('parcelaId', interventie.parcela_id)
      formData.set('planLinieId', interventie.interventie.id)
      formData.set('dataPlanificata', interventie.urmatoarea_data_estimata ?? new Date().toISOString().slice(0, 10))
      if (interventie.fenofaza_curenta?.cohort) {
        formData.set('cohortLaAplicare', interventie.fenofaza_curenta.cohort)
      }

      const result = await planificaInterventieRelevantaAction(formData)
      if (!result.ok) {
        toast.error(result.error)
        setPendingInterventieId(null)
        return
      }

      toast.success('Aplicarea din plan a fost pregătită.')
      setPendingInterventieId(null)
      router.refresh()
    })
  }

  const handleManualInterventie = async (values: MarkAplicataFormValues) => {
    startManualTransition(async () => {
      const formData = new FormData()
      formData.set('parcelaId', values.manual_parcela_id ?? parcelaId)
      formData.set('status', values.manual_status ?? 'aplicata')
      formData.set('data', values.manual_data ?? '')
      formData.set('tip_interventie', values.tip_interventie ?? '')
      formData.set('scop', values.scop ?? '')
      formData.set('stadiu_la_aplicare', values.stadiu_la_aplicare ?? '')
      if (values.cohort_la_aplicare) {
        formData.set('cohort_la_aplicare', values.cohort_la_aplicare)
      }
      formData.set('operator', values.operator ?? '')
      formData.set('observatii', values.observatii ?? '')
      formData.set('cantitate_totala_ml', values.cantitate_totala_ml ?? '')
      formData.set('produse', JSON.stringify(values.produse))
      if (values.diferenteFataDePlan) {
        formData.set('diferente_fata_de_plan', JSON.stringify(values.diferenteFataDePlan))
      }

      const result = await createManualInterventieAction(formData)
      if (!result.ok) {
        toast.error(result.error)
        return
      }

      toast.success('Intervenția manuală a fost salvată.')
      setManualOpen(false)
      router.refresh()
    })
  }

  const handleSaveConfigurareSezon = async (values: {
    sistem_conducere: string | null
    tip_ciclu_soi: string | null
  }) => {
    startConfiguringTransition(async () => {
      const formData = new FormData()
      formData.set('parcelaId', parcelaId)
      formData.set('an', String(an))
      if (values.sistem_conducere) {
        formData.set('sistem_conducere', values.sistem_conducere)
      }
      if (values.tip_ciclu_soi) {
        formData.set('tip_ciclu_soi', values.tip_ciclu_soi)
      }

      const result = await upsertConfigurareSezonAction(formData)
      if (!result.ok) {
        toast.error(result.error)
        return
      }

      toast.success('Configurarea sezonieră a fost salvată.')
      setSeasonOpen(false)
      router.refresh()
    })
  }

  return (
    <>
      <div className="mx-auto w-full max-w-[min(96vw,94rem)] space-y-4 px-3 py-3 md:px-4 md:py-4">
        {isGlobalEmpty ? (
          <EmptyStateTratamente
            createPlanHref={createPlanHref}
            importPlanHref={importPlanHref}
          />
        ) : null}

        <ConfigurareSezonBanner
          an={an}
          configurareSezon={configurareSezon}
          grupBiologic={grupBiologic ?? null}
          onConfigure={() => setSeasonOpen(true)}
        />

        <AppCard className="space-y-3 rounded-2xl bg-[var(--surface-card)]">
          <div className="space-y-1">
            <h2 className="text-base text-[var(--text-primary)] [font-weight:650]">Acțiuni rapide</h2>
            <p className="text-sm text-[var(--text-secondary)]">
              Actualizează stadiul, asociază un plan sau adaugă o intervenție ad-hoc.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setRecordOpen(true)}>
              Actualizează fenofaza
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setAssignOpen(true)}>
              Asociază plan
            </Button>
            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={() => setManualOpen(true)}
            >
              <Plus className="h-4 w-4" />
              Intervenție manuală
            </Button>
          </div>
        </AppCard>

        <StadiuCurentCard
          grupBiologic={grupBiologic}
          configurareSezon={configurareSezon}
          singleStageState={singleStageState}
          dualStageState={dualStageState}
          onRecord={(cohort) => {
            setRecordCohort(cohort)
            setRecordOpen(true)
          }}
        />

        <InterventiiRelevanteCard
          configurareSezon={configurareSezon}
          interventii={interventiiRelevante}
          onPlanifica={handlePlanificaInterventie}
          pendingInterventieId={isPlanificaPending ? pendingInterventieId : null}
          showFilters
          title="Intervenții relevante"
        />

        <PlanActivCard
          createHref={createPlanHref}
          detailsHref={detailsHref}
          editHref={editPlanHref}
          onAssign={() => setAssignOpen(true)}
          planActiv={planActiv}
        />

        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <h2 className="text-base text-[var(--text-primary)] [font-weight:650]">Următoarele aplicări</h2>
              <span className="inline-flex items-center rounded-full border border-[var(--border-default)] bg-[var(--surface-card)] px-2.5 py-0.5 text-xs font-semibold text-[var(--text-secondary)]">
                {aplicariCount}
              </span>
            </div>
          </div>

          {urmatoareleAplicari.length === 0 ? (
            <AppCard className="rounded-2xl border-dashed bg-[var(--surface-card-muted)]">
              <p className="text-sm text-[var(--text-secondary)]">
                Nu există încă aplicări planificate pentru această parcelă în anul curent.
              </p>
            </AppCard>
          ) : (
            <>
              <div className="space-y-3">
                {urmatoareleAplicari.map((aplicare) => (
                  <AplicareListItem
                    key={aplicare.id}
                    aplicare={aplicare}
                    configurareSezon={configurareSezon}
                    parcelaId={parcelaId}
                  />
                ))}
              </div>
              <div className="pt-1">
                <Button type="button" variant="outline" size="sm" asChild>
                  <Link href={`/parcele/${parcelaId}/tratamente/toate`}>Vezi toate ({aplicariCount})</Link>
                </Button>
              </div>
            </>
          )}
        </section>
      </div>

      {recordOpen ? (
        <RecordStadiuSheet
          an={an}
          cohortPreselectat={recordCohort}
          configurareSezon={configurareSezon}
          grupBiologic={grupBiologic}
          isRubusMixt={isRubusMixt}
          open={recordOpen}
          onOpenChange={(nextOpen) => {
            setRecordOpen(nextOpen)
            if (!nextOpen) {
              setRecordCohort(undefined)
            }
          }}
          onSubmit={handleRecordStadiu}
          pending={isRecording}
          suggestedStadiu={suggestedStadiu}
        />
      ) : null}

      {assignOpen ? (
        <AssignPlanSheet
          an={an}
          currentPlanId={planActiv?.plan_id ?? planuriDisponibile[0]?.id ?? null}
          open={assignOpen}
          onOpenChange={setAssignOpen}
          onSubmit={handleAssignPlan}
          pending={isAssigning}
          plans={planuriDisponibile}
        />
      ) : null}

      <GenereazaAplicariDialog
        creatableCount={generationPreview?.creatableCount ?? 0}
        open={generateOpen}
        onConfirm={handleGenerateAplicari}
        onOpenChange={setGenerateOpen}
        pending={isGenerating}
        skippedCount={generationPreview?.skippedCount ?? 0}
      />

      <ConfigurareSezonDialog
        an={an}
        configurareSezon={configurareSezon}
        grupBiologic={grupBiologic ?? null}
        open={seasonOpen}
        onOpenChange={setSeasonOpen}
        onSubmit={handleSaveConfigurareSezon}
        pending={isConfiguring}
      />

      <MarkAplicataSheet
        mode="manual"
        defaultCantitateMl={null}
        defaultOperator=""
        defaultStadiu={singleStageState?.stadiuCurent?.stadiu ?? null}
        defaultManualParcelaId={parcelaId}
        defaultManualParcelaLabel={parcela.nume_parcela ?? 'Parcelă'}
        defaultManualStatus="aplicata"
        configurareSezon={configurareSezon}
        grupBiologic={grupBiologic}
        isRubusMixt={isRubusMixt}
        manualParcele={[]}
        meteoSnapshot={null}
        onOpenChange={setManualOpen}
        onSubmit={handleManualInterventie}
        open={manualOpen}
        pending={isManualSaving}
        produseFitosanitare={produseFitosanitare}
      />

      {planActiv?.plan &&
      (singleStageState?.stadiuCurent ||
        dualStageState?.floricane.stadiuCurent ||
        dualStageState?.primocane.stadiuCurent) ? (
        <Button
          type="button"
          size="icon-lg"
          className="fixed bottom-[calc(var(--app-nav-clearance)+1rem)] right-4 z-40 h-14 w-14 rounded-full bg-[var(--agri-primary)] text-white shadow-[0_4px_20px_rgba(13,155,92,0.2),0_1px_3px_rgba(13,155,92,0.15)] md:bottom-6 md:right-6"
          onClick={() => setGenerateOpen(true)}
          aria-label="Generează aplicări"
        >
          <Sparkles className="h-5 w-5" />
        </Button>
      ) : null}
    </>
  )
}
