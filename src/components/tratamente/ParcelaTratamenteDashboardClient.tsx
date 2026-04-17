'use client'

import Link from 'next/link'
import { useMemo, useState, useTransition } from 'react'
import { Sparkles } from 'lucide-react'
import { useRouter } from 'next/navigation'

import {
  assignPlanAction,
  generateAplicariAction,
  recordStadiuAction,
} from '@/app/(dashboard)/parcele/[id]/tratamente/actions'
import { EmptyStateTratamente } from '@/components/tratamente/EmptyStateTratamente'
import { AplicareListItem } from '@/components/tratamente/AplicareListItem'
import { AssignPlanSheet } from '@/components/tratamente/AssignPlanSheet'
import { GenereazaAplicariDialog } from '@/components/tratamente/GenereazaAplicariDialog'
import {
  RecordStadiuSheet,
  type RecordStadiuFormValues,
} from '@/components/tratamente/RecordStadiuSheet'
import { PlanActivCard } from '@/components/tratamente/PlanActivCard'
import { StadiuCurentCard } from '@/components/tratamente/StadiuCurentCard'
import { AppCard } from '@/components/ui/app-card'
import { Button } from '@/components/ui/button'
import type {
  AplicareTratamentDetaliu,
  ParcelaTratamenteContext,
  PlanActivParcela,
  PlanTratament,
  StadiuFenologicParcela,
} from '@/lib/supabase/queries/tratamente'
import { toast } from '@/lib/ui/toast'

interface ParcelaTratamenteDashboardClientProps {
  an: number
  aplicariCount: number
  createPlanHref: string
  detailsHref: string | null
  editPlanHref: string | null
  generationPreview: { creatableCount: number; skippedCount: number } | null
  isGlobalEmpty: boolean
  parcela: ParcelaTratamenteContext
  parcelaId: string
  planActiv: PlanActivParcela | null
  planuriDisponibile: PlanTratament[]
  stadii: StadiuFenologicParcela[]
  stadiuCurent: StadiuFenologicParcela | null
  stadiuProgress: number
  stadiuUrmator: string | null
  urmatoareleAplicari: AplicareTratamentDetaliu[]
}

export function ParcelaTratamenteDashboardClient({
  an,
  aplicariCount,
  createPlanHref,
  detailsHref,
  editPlanHref,
  generationPreview,
  isGlobalEmpty,
  parcelaId,
  planActiv,
  planuriDisponibile,
  stadiuCurent,
  stadiuProgress,
  stadiuUrmator,
  urmatoareleAplicari,
}: ParcelaTratamenteDashboardClientProps) {
  const router = useRouter()
  const [recordOpen, setRecordOpen] = useState(false)
  const [assignOpen, setAssignOpen] = useState(false)
  const [generateOpen, setGenerateOpen] = useState(false)
  const [isRecording, startRecordTransition] = useTransition()
  const [isAssigning, startAssignTransition] = useTransition()
  const [isGenerating, startGenerateTransition] = useTransition()

  const suggestedStadiu = useMemo(() => {
    return stadiuUrmator ?? stadiuCurent?.stadiu ?? 'repaus'
  }, [stadiuCurent?.stadiu, stadiuUrmator])

  const handleRecordStadiu = async (values: RecordStadiuFormValues) => {
    startRecordTransition(async () => {
      const formData = new FormData()
      formData.set('parcelaId', parcelaId)
      formData.set('an', String(an))
      formData.set('stadiu', values.stadiu)
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

      toast.success(`${result.createdCount} aplicări create, ${result.skippedCount} skip-uri (deja existente)`)
      setGenerateOpen(false)
      router.refresh()
    })
  }

  return (
    <>
      <div className="mx-auto w-full max-w-5xl space-y-4 py-3 md:py-4">
        {isGlobalEmpty ? (
          <EmptyStateTratamente
            onAssignPlan={() => setAssignOpen(true)}
            onRecordStadiu={() => setRecordOpen(true)}
          />
        ) : null}

        <StadiuCurentCard
          stadiuCurent={stadiuCurent}
          stadiuProgress={stadiuProgress}
          stadiuUrmator={stadiuUrmator}
          onRecord={() => setRecordOpen(true)}
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
                  <AplicareListItem key={aplicare.id} aplicare={aplicare} parcelaId={parcelaId} />
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
          open={recordOpen}
          onOpenChange={setRecordOpen}
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

      {planActiv?.plan && stadiuCurent ? (
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
