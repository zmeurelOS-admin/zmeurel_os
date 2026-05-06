'use client'

import Link from 'next/link'
import { useMemo, useState, useTransition } from 'react'
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
  an: number | null
  aplicate: number
  countAplicari: number
  culturaTip: string
  descriere?: string | null
  isArchived: boolean
  parcelaCod: string | null
  planId: string
  planName: string
  totalLinii: number
}

function ProgressRing({ percent }: { percent: number }) {
  const clamped = Math.max(0, Math.min(100, percent))
  const radius = 20
  const strokeWidth = 4
  const normalizedRadius = radius - strokeWidth / 2
  const circumference = 2 * Math.PI * normalizedRadius
  const strokeDashoffset = circumference - (clamped / 100) * circumference

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-white/15 bg-white/10 px-3 py-2">
      <svg aria-hidden className="h-12 w-12 shrink-0" viewBox="0 0 44 44">
        <circle
          cx="22"
          cy="22"
          r={normalizedRadius}
          fill="none"
          stroke="rgba(255,255,255,0.2)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx="22"
          cy="22"
          r={normalizedRadius}
          fill="none"
          stroke="#7ECBA9"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={strokeDashoffset}
          transform="rotate(-90 22 22)"
        />
      </svg>
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-white/70">Completare</p>
        <p className="text-lg font-bold text-white">{clamped}%</p>
      </div>
    </div>
  )
}

export function PlanDetailHeader({
  an,
  aplicate,
  countAplicari,
  descriere,
  culturaTip,
  isArchived,
  parcelaCod,
  planId,
  planName,
  totalLinii,
}: PlanDetailHeaderProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [menuOpen, setMenuOpen] = useState(false)
  const [infoOpen, setInfoOpen] = useState(false)
  const [duplicateOpen, setDuplicateOpen] = useState(false)
  const [deactivateOpen, setDeactivateOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  // --- FIX 1: stats complete din props server-side ---
  const ramase = Math.max(0, totalLinii - aplicate)
  const completionPercent = useMemo(
    () => (totalLinii > 0 ? Math.round((aplicate / totalLinii) * 100) : 0),
    [aplicate, totalLinii]
  )

  return (
    <>
      {/* --- SECTION: header --- */}
      <div className="rounded-[24px] bg-[#3D7A5F] px-[18px] pt-[18px] pb-0 text-white shadow-[0_16px_40px_rgba(61,122,95,0.18)]">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-2">
              <Link href="/tratamente/planuri" className="inline-flex items-center gap-1.5 text-xs text-white/65 transition hover:text-white">
                <ArrowLeft className="h-3.5 w-3.5" />
                Planuri · {parcelaCod ?? 'Plan'}
              </Link>
              <div className="space-y-1">
                <h2 className="text-2xl font-extrabold tracking-tight text-white">{planName}</h2>
                <p className="text-sm text-white/70">
                  {culturaTip}
                  {an ? ` · ${an}` : ''}
                </p>
                {descriere?.trim() ? (
                  <p className="text-xs text-white/60">{descriere.trim()}</p>
                ) : null}
              </div>
            </div>

            {/* --- SECTION: actions --- */}
            <div className="flex flex-wrap items-center gap-2">
              <Popover open={menuOpen} onOpenChange={setMenuOpen}>
                <PopoverTrigger asChild>
                  <Button type="button" variant="outline" size="icon-sm" aria-label="Acțiuni plan" className="border-white/30 bg-transparent text-white hover:bg-white/10">
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
          </div>

          {/* --- SECTION: stats --- */}
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-2xl border border-white/10 bg-white/10 px-3 py-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/65">Total</p>
                <p className="mt-1 text-2xl font-bold text-white">{totalLinii}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/10 px-3 py-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/65">Aplicate</p>
                <p className="mt-1 text-2xl font-bold text-white">{aplicate}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/10 px-3 py-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/65">Rămase</p>
                <p className="mt-1 text-2xl font-bold text-white">{ramase}</p>
              </div>
            </div>

            <div className="pb-2 sm:justify-self-end">
              <ProgressRing percent={completionPercent} />
            </div>
          </div>
        </div>
      </div>
      <div className="flex items-center px-5 py-3">
        <span className="rounded-full bg-[#E8F3EE] px-3 py-1 text-sm font-semibold text-[#3D7A5F]">
          {isArchived ? 'Arhivat' : 'Activ'}
        </span>
        <span className="mx-2 text-gray-300">·</span>
        <span className="text-sm text-gray-500">{countAplicari} aplicări asociate</span>
      </div>

      {/* --- SECTION: dialogs --- */}
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
