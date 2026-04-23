'use client'

import { useState, useTransition } from 'react'
import { EllipsisVertical, Plus } from 'lucide-react'
import { useRouter } from 'next/navigation'

import {
  assignParcelaToPlanAction,
  deactivateParcelaPlanAction,
} from '@/app/(dashboard)/tratamente/planuri/[planId]/actions'
import { AssignParcelaSheet } from '@/components/tratamente/AssignParcelaSheet'
import { AppCard } from '@/components/ui/app-card'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import type { PlanTratamentParcelaAsociata, PlanWizardParcelaOption } from '@/lib/supabase/queries/tratamente'
import { toast } from '@/lib/ui/toast'

interface ParceleAsignateListProps {
  anCurent: number
  parceleAsociate: PlanTratamentParcelaAsociata[]
  parceleDisponibile: PlanWizardParcelaOption[]
  planId: string
}

export function ParceleAsignateList({
  anCurent,
  parceleAsociate,
  parceleDisponibile,
  planId,
}: ParceleAsignateListProps) {
  const router = useRouter()
  const [assignOpen, setAssignOpen] = useState(false)
  const [pendingParcelaPlanId, setPendingParcelaPlanId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  async function handleAssign(payload: { an: number; parcelaId: string }) {
    const result = await assignParcelaToPlanAction(planId, payload.parcelaId, payload.an)
    if (!result.ok) {
      toast.error(result.error)
      return
    }

    toast.success('Planul a fost asociat parcelei.')
    setAssignOpen(false)
    router.refresh()
  }

  async function handleDeactivate(parcelaPlanId: string) {
    const result = await deactivateParcelaPlanAction(parcelaPlanId)
    if (!result.ok) {
      toast.error(result.error)
      return
    }

    toast.success('Asocierea a fost dezactivată.')
    setPendingParcelaPlanId(null)
    router.refresh()
  }

  return (
    <section className="space-y-4">
      <AppCard className="rounded-[22px] p-4 sm:p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-lg tracking-[-0.02em] text-[var(--text-primary)] [font-weight:650]">
              Parcele asociate
            </h2>
            <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
              Asociază planul pe una sau mai multe parcele și gestionează anii activi.
            </p>
          </div>
          <Button type="button" className="bg-[var(--agri-primary)] text-white" onClick={() => setAssignOpen(true)}>
            <Plus className="h-4 w-4" aria-label="Asociază la parcelă" />
            <span className="hidden sm:inline">Asociază la parcelă</span>
          </Button>
        </div>
      </AppCard>

      {parceleAsociate.length === 0 ? (
        <AppCard className="rounded-[22px] border-dashed p-6 text-center">
          <p className="text-sm text-[var(--text-secondary)]">
            Planul nu este asociat încă niciunei parcele active.
          </p>
        </AppCard>
      ) : (
        <div className="space-y-3">
          {parceleAsociate.map((parcela) => (
            <AppCard key={parcela.id} className="rounded-[22px] p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-base text-[var(--text-primary)] [font-weight:650]">
                    {parcela.parcela_nume ?? 'Parcelă'}
                  </p>
                  <p className="mt-1 text-sm text-[var(--text-secondary)]">
                    {parcela.parcela_cod ?? 'Fără cod'} · {parcela.an}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {parcela.activ ? (
                      <span className="rounded-full border border-[rgba(13,155,92,0.1)] bg-[rgba(13,155,92,0.06)] px-2 py-1 text-xs text-[var(--agri-primary)]">
                        Plan activ
                      </span>
                    ) : null}
                  </div>
                </div>

                <Popover
                  open={pendingParcelaPlanId === parcela.id}
                  onOpenChange={(nextOpen) => setPendingParcelaPlanId(nextOpen ? parcela.id : null)}
                >
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Acțiuni pentru parcela ${parcela.parcela_nume ?? 'selectată'}`}
                    >
                      <EllipsisVertical className="h-4 w-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-60 p-2">
                    <button
                      type="button"
                      className="flex w-full items-center rounded-xl px-3 py-2 text-left text-sm text-[var(--soft-danger-text)] transition hover:bg-[var(--surface-card-muted)]"
                      onClick={() =>
                        startTransition(async () => {
                          await handleDeactivate(parcela.id)
                        })
                      }
                    >
                      Dezactivează pe parcela {parcela.parcela_nume ?? 'selectată'} pentru {parcela.an}
                    </button>
                  </PopoverContent>
                </Popover>
              </div>
            </AppCard>
          ))}
        </div>
      )}

      <AssignParcelaSheet
        anInitial={anCurent}
        onOpenChange={setAssignOpen}
        onSubmit={handleAssign}
        open={assignOpen}
        parcele={parceleDisponibile}
        pending={isPending}
      />
    </section>
  )
}
