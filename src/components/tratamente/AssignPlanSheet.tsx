'use client'

import { useState } from 'react'

import { AppDialog } from '@/components/app/AppDialog'
import { DialogFormActions } from '@/components/ui/dialog-form-actions'
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import type { PlanTratament } from '@/lib/supabase/queries/tratamente'
import { cn } from '@/lib/utils'

interface AssignPlanSheetProps {
  an: number
  currentPlanId?: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (planId: string) => Promise<void> | void
  pending?: boolean
  plans: PlanTratament[]
}

export function AssignPlanSheet({
  an,
  currentPlanId,
  open,
  onOpenChange,
  onSubmit,
  pending = false,
  plans,
}: AssignPlanSheetProps) {
  const isMobile = useMediaQuery('(max-width: 767px)')
  const [selectedPlanId, setSelectedPlanId] = useState<string>(currentPlanId ?? '')

  const saveDisabled = pending || !selectedPlanId || plans.length === 0

  const content = plans.length === 0 ? (
    <div className="rounded-xl border border-dashed border-[var(--border-default)] bg-[var(--surface-card-muted)] px-4 py-5 text-sm text-[var(--text-secondary)]">
      Nu există planuri active disponibile pentru această parcelă.
    </div>
  ) : (
    <div className="space-y-3">
      {plans.map((plan) => {
        const selected = selectedPlanId === plan.id
        return (
          <button
            key={plan.id}
            type="button"
            onClick={() => setSelectedPlanId(plan.id)}
            className={cn(
              'w-full rounded-2xl border px-4 py-3 text-left transition-colors',
              selected
                ? 'border-[var(--agri-primary)] bg-[color:color-mix(in_srgb,var(--agri-primary)_8%,var(--surface-card))]'
                : 'border-[var(--border-default)] bg-[var(--surface-card)] hover:bg-[var(--surface-card-muted)]',
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm text-[var(--text-primary)] [font-weight:650]">{plan.nume}</p>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">{plan.cultura_tip}</p>
                {plan.descriere ? (
                  <p className="mt-2 text-xs text-[var(--text-secondary)]">{plan.descriere}</p>
                ) : null}
              </div>
              <span
                className={cn(
                  'mt-1 inline-flex h-4 w-4 shrink-0 rounded-full border',
                  selected
                    ? 'border-[var(--agri-primary)] bg-[var(--agri-primary)]'
                    : 'border-[var(--border-default)] bg-[var(--surface-card)]',
                )}
              />
            </div>
          </button>
        )
      })}
    </div>
  )

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="max-h-[92dvh] rounded-t-2xl">
          <SheetHeader>
            <SheetTitle>Atribuie plan</SheetTitle>
            <p className="text-sm text-[var(--text-secondary)]">Selectează planul activ pentru anul {an}</p>
          </SheetHeader>
          <div className="px-4 pb-4">{content}</div>
          <SheetFooter>
            <button
              type="button"
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[var(--button-muted-border)] bg-[var(--button-muted-bg)] px-4 text-sm font-semibold text-[var(--button-muted-text)]"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              Anulează
            </button>
            <button
              type="button"
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[var(--agri-primary)] px-4 text-sm font-semibold text-white disabled:opacity-60"
              disabled={saveDisabled}
              onClick={async () => {
                await onSubmit(selectedPlanId)
              }}
            >
              {pending ? 'Se salvează...' : 'Atribuie plan'}
            </button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <AppDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Atribuie plan"
      description={`Selectează planul activ pentru anul ${an}`}
      footer={
        <DialogFormActions
          onCancel={() => onOpenChange(false)}
          onSave={async () => {
            await onSubmit(selectedPlanId)
          }}
          saving={pending}
          disabled={saveDisabled}
          saveLabel="Atribuie plan"
        />
      }
    >
      {content}
    </AppDialog>
  )
}
