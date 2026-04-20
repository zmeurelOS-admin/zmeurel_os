'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { ArrowLeft, Copy, EllipsisVertical, FilePenLine, RotateCcw, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'

import {
  deactivatePlanAction,
  duplicatePlanAction,
  hardDeletePlanAction,
  reactivatePlanAction,
  updatePlanInfoAction,
} from '@/app/(dashboard)/tratamente/planuri/[planId]/actions'
import { PlanDeactivateDialog } from '@/components/tratamente/PlanDeactivateDialog'
import { PlanDeleteDialog } from '@/components/tratamente/PlanDeleteDialog'
import { PlanDuplicateDialog } from '@/components/tratamente/PlanDuplicateDialog'
import { PlanInfoEditDialog } from '@/components/tratamente/PlanInfoEditDialog'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { toast } from '@/lib/ui/toast'

interface PlanDetailHeaderProps {
  countAplicari: number
  descriere?: string | null
  isArchived: boolean
  planId: string
  planName: string
}

export function PlanDetailHeader({
  countAplicari,
  descriere,
  isArchived,
  planId,
  planName,
}: PlanDetailHeaderProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [menuOpen, setMenuOpen] = useState(false)
  const [infoOpen, setInfoOpen] = useState(false)
  const [duplicateOpen, setDuplicateOpen] = useState(false)
  const [deactivateOpen, setDeactivateOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" asChild>
          <Link href="/tratamente/planuri">
            <ArrowLeft className="h-4 w-4" />
            Înapoi la planuri
          </Link>
        </Button>

        <Popover open={menuOpen} onOpenChange={setMenuOpen}>
          <PopoverTrigger asChild>
            <Button type="button" variant="outline" size="icon-sm" aria-label="Acțiuni plan">
              <EllipsisVertical className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-56 p-2">
            <div className="space-y-1">
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-[var(--text-primary)] transition hover:bg-[var(--surface-card-muted)]"
                onClick={() => {
                  setMenuOpen(false)
                  setInfoOpen(true)
                }}
              >
                <FilePenLine className="h-4 w-4" aria-label="Editează planul" />
                Editează info
              </button>
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-[var(--text-primary)] transition hover:bg-[var(--surface-card-muted)]"
                onClick={() => {
                  setMenuOpen(false)
                  setDuplicateOpen(true)
                }}
              >
                <Copy className="h-4 w-4" aria-label="Duplică planul" />
                Duplică
              </button>
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-[var(--text-primary)] transition hover:bg-[var(--surface-card-muted)]"
                onClick={() => {
                  setMenuOpen(false)
                  setDeactivateOpen(true)
                }}
              >
                <RotateCcw className="h-4 w-4" aria-label={isArchived ? 'Reactivează planul' : 'Dezactivează planul'} />
                {isArchived ? 'Reactivează' : 'Dezactivează'}
              </button>
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-[var(--soft-danger-text)] transition hover:bg-[var(--surface-card-muted)]"
                onClick={() => {
                  setMenuOpen(false)
                  setDeleteOpen(true)
                }}
              >
                <Trash2 className="h-4 w-4" aria-label="Șterge planul" />
                Șterge plan
              </button>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      <PlanInfoEditDialog
        open={infoOpen}
        onOpenChange={setInfoOpen}
        initialDescriere={descriere}
        initialNume={planName}
        pending={isPending}
        onSubmit={(data) =>
          startTransition(async () => {
            const result = await updatePlanInfoAction(planId, data)
            if (!result.ok) {
              toast.error(result.error)
              return
            }

            toast.success('Planul a fost actualizat.')
            setInfoOpen(false)
            router.refresh()
          })
        }
      />

      <PlanDuplicateDialog
        initialName={planName}
        open={duplicateOpen}
        onOpenChange={setDuplicateOpen}
        pending={isPending}
        onSubmit={(numeNou) =>
          startTransition(async () => {
            const result = await duplicatePlanAction(planId, numeNou)
            if (!result.ok) {
              toast.error(result.error)
              return
            }

            toast.success('Planul a fost duplicat.')
            setDuplicateOpen(false)
            router.push(`/tratamente/planuri/${result.data.planIdNou}`)
          })
        }
      />

      <PlanDeactivateDialog
        isArchived={isArchived}
        onOpenChange={setDeactivateOpen}
        open={deactivateOpen}
        pending={isPending}
        planName={planName}
        onConfirm={() =>
          startTransition(async () => {
            const result = isArchived
              ? await reactivatePlanAction(planId)
              : await deactivatePlanAction(planId)
            if (!result.ok) {
              toast.error(result.error)
              return
            }

            toast.success(isArchived ? 'Planul a fost reactivat.' : 'Planul a fost dezactivat.')
            setDeactivateOpen(false)
            router.refresh()
          })
        }
      />

      <PlanDeleteDialog
        countAplicari={countAplicari}
        onOpenChange={setDeleteOpen}
        open={deleteOpen}
        pending={isPending}
        planName={planName}
        onConfirm={() =>
          startTransition(async () => {
            const result = await hardDeletePlanAction(planId)
            if (!result.ok) {
              toast.error(result.error)
              return
            }

            toast.success('Planul a fost șters.')
            router.push('/tratamente/planuri')
          })
        }
      />
    </>
  )
}
