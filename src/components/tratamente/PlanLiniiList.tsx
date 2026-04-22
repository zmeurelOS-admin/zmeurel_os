'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { Plus } from 'lucide-react'
import { useRouter } from 'next/navigation'

import {
  addLinieAction,
  deleteLinieAction,
  reorderLiniiAction,
  updateLinieAction,
  type LinieInput,
} from '@/app/(dashboard)/tratamente/planuri/[planId]/actions'
import { LinieDeleteDialog } from '@/components/tratamente/LinieDeleteDialog'
import { LinieEditDialog, type LinieEditValue } from '@/components/tratamente/LinieEditDialog'
import { LinieRow } from '@/components/tratamente/LinieRow'
import { AppCard } from '@/components/ui/app-card'
import { Button } from '@/components/ui/button'
import type { PlanTratamentLinieCuProdus, ProdusFitosanitar } from '@/lib/supabase/queries/tratamente'
import { toast } from '@/lib/ui/toast'

import {
  getGrupBiologicDinCultura,
  getStadiuMeta,
} from '@/components/tratamente/plan-wizard/helpers'

function normalizeCohorta(value: string | null | undefined): 'floricane' | 'primocane' | null {
  return value === 'floricane' || value === 'primocane' ? value : null
}

interface PlanLiniiListProps {
  allowCohortTrigger?: boolean
  culturaTip: string
  linii: PlanTratamentLinieCuProdus[]
  planId: string
  produse: ProdusFitosanitar[]
}

function sortLinii(linii: PlanTratamentLinieCuProdus[]) {
  return [...linii].sort((first, second) => first.ordine - second.ordine)
}

function arrayMove<T>(items: T[], from: number, to: number): T[] {
  const next = [...items]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}

function withConsecutiveOrder(linii: PlanTratamentLinieCuProdus[]): PlanTratamentLinieCuProdus[] {
  return linii.map((linie, index) => ({ ...linie, ordine: index + 1 }))
}

function toEditValue(linie?: PlanTratamentLinieCuProdus | null): LinieEditValue {
  if (!linie) {
    return {
      stadiu_trigger: '',
      cohort_trigger: null,
      produs_id: null,
      produs_nume_manual: null,
      doza_ml_per_hl: null,
      doza_l_per_ha: null,
      observatii: null,
    }
  }

  return {
    stadiu_trigger: linie.stadiu_trigger,
    cohort_trigger: normalizeCohorta(linie.cohort_trigger),
    produs_id: linie.produs_id,
    produs_nume_manual: linie.produs_nume_manual,
    doza_ml_per_hl: linie.doza_ml_per_hl,
    doza_l_per_ha: linie.doza_l_per_ha,
    observatii: linie.observatii,
  }
}

export function PlanLiniiList({
  allowCohortTrigger = false,
  culturaTip,
  linii,
  planId,
  produse,
}: PlanLiniiListProps) {
  const router = useRouter()
  const [localLinii, setLocalLinii] = useState<PlanTratamentLinieCuProdus[]>(sortLinii(linii))
  const [editorOpen, setEditorOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [editingLinie, setEditingLinie] = useState<PlanTratamentLinieCuProdus | null>(null)
  const [pendingDeleteLinie, setPendingDeleteLinie] = useState<PlanTratamentLinieCuProdus | null>(null)
  const [isPending, startTransition] = useTransition()
  const grupBiologic = useMemo(() => getGrupBiologicDinCultura(culturaTip), [culturaTip])

  useEffect(() => {
    setLocalLinii(sortLinii(linii))
  }, [linii])

  const orderedLinii = useMemo(() => sortLinii(localLinii), [localLinii])

  function openAddDialog() {
    setEditingLinie(null)
    setEditorOpen(true)
  }

  function handleReorder(from: number, to: number) {
    if (to < 0 || to >= orderedLinii.length) return

    const previous = orderedLinii
    const reordered = withConsecutiveOrder(arrayMove(previous, from, to))
    setLocalLinii(reordered)

    startTransition(async () => {
      const result = await reorderLiniiAction(planId, reordered.map((linie) => linie.id))
      if (!result.ok) {
        setLocalLinii(previous)
        toast.error(result.error)
        return
      }

      toast.success('Ordinea liniilor a fost actualizată.')
    })
  }

  async function handleSaveLinie(data: LinieEditValue) {
    const payload: LinieInput = {
      stadiu_trigger: data.stadiu_trigger,
      cohort_trigger: data.cohort_trigger,
      produs_id: data.produs_id,
      produs_nume_manual: data.produs_nume_manual,
      doza_ml_per_hl: data.doza_ml_per_hl,
      doza_l_per_ha: data.doza_l_per_ha,
      observatii: data.observatii,
    }

    const result = editingLinie
      ? await updateLinieAction(editingLinie.id, payload)
      : await addLinieAction(planId, payload)

    if (!result.ok) {
      toast.error(result.error)
      return
    }

    toast.success(editingLinie ? 'Linia a fost actualizată.' : 'Linia a fost adăugată.')
    setEditorOpen(false)
    setEditingLinie(null)
    router.refresh()
  }

  async function handleDeleteLinie() {
    if (!pendingDeleteLinie) return

    const result = await deleteLinieAction(pendingDeleteLinie.id)
    if (!result.ok) {
      toast.error(result.error)
      return
    }

    toast.success('Linia a fost ștearsă.')
    setDeleteOpen(false)
    setPendingDeleteLinie(null)
    router.refresh()
  }

  return (
    <section className="space-y-4">
      <AppCard className="rounded-[22px] p-4 sm:p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-lg tracking-[-0.02em] text-[var(--text-primary)] [font-weight:650]">
              Linii tratament ({orderedLinii.length})
            </h2>
            <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
              Editează, reordonează sau adaugă linii noi direct din detaliul planului.
            </p>
          </div>
          <Button type="button" className="bg-[var(--agri-primary)] text-white" onClick={openAddDialog}>
            <Plus className="h-4 w-4" aria-label="Adaugă linie" />
            <span className="hidden sm:inline">Adaugă linie</span>
          </Button>
        </div>
      </AppCard>

      {orderedLinii.length === 0 ? (
        <AppCard className="rounded-[22px] border-dashed p-6 text-center">
          <p className="text-sm text-[var(--text-secondary)]">
            Nu există încă linii în acest plan.
          </p>
          <Button type="button" variant="outline" className="mt-4" onClick={openAddDialog}>
            + Adaugă linie tratament
          </Button>
        </AppCard>
      ) : (
        <div className="space-y-3">
          {orderedLinii.map((linie, index) => (
            <LinieRow
              key={linie.id}
              grupBiologic={grupBiologic}
              index={index}
              linie={linie}
              total={orderedLinii.length}
              onMoveUp={() => handleReorder(index, index - 1)}
              onMoveDown={() => handleReorder(index, index + 1)}
              onEdit={() => {
                setEditingLinie(linie)
                setEditorOpen(true)
              }}
              onDelete={() => {
                setPendingDeleteLinie(linie)
                setDeleteOpen(true)
              }}
            />
          ))}
        </div>
      )}

      <LinieEditDialog
        allowCohortTrigger={allowCohortTrigger}
        culturaTip={culturaTip}
        grupBiologic={grupBiologic}
        initialValue={toEditValue(editingLinie)}
        onOpenChange={(nextOpen) => {
          setEditorOpen(nextOpen)
          if (!nextOpen) {
            setEditingLinie(null)
          }
        }}
        onSubmit={handleSaveLinie}
        open={editorOpen}
        pending={isPending}
        produse={produse}
        title={editingLinie ? 'Editează linia' : 'Adaugă linie tratament'}
      />

      <LinieDeleteDialog
        open={deleteOpen}
        onOpenChange={(nextOpen) => {
          setDeleteOpen(nextOpen)
          if (!nextOpen) {
            setPendingDeleteLinie(null)
          }
        }}
        onConfirm={handleDeleteLinie}
        pending={isPending}
        stadiuLabel={pendingDeleteLinie ? getStadiuMeta(pendingDeleteLinie.stadiu_trigger, grupBiologic, pendingDeleteLinie.cohort_trigger).label : 'selectat'}
      />
    </section>
  )
}
