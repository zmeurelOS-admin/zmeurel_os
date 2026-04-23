'use client'

import { useEffect, useState } from 'react'

import { AppDialog } from '@/components/app/AppDialog'
import { AppDrawer } from '@/components/app/AppDrawer'
import { DialogFormActions } from '@/components/ui/dialog-form-actions'
import { Input } from '@/components/ui/input'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import type { PlanWizardParcelaOption } from '@/lib/supabase/queries/tratamente'
import { cn } from '@/lib/utils'

interface AssignParcelaSheetProps {
  anInitial: number
  onOpenChange: (open: boolean) => void
  onSubmit: (payload: { an: number; parcelaId: string }) => Promise<void> | void
  open: boolean
  parcele: PlanWizardParcelaOption[]
  pending?: boolean
}

export function AssignParcelaSheet({
  anInitial,
  onOpenChange,
  onSubmit,
  open,
  parcele,
  pending = false,
}: AssignParcelaSheetProps) {
  const isMobile = useMediaQuery('(max-width: 767px)')
  const [selectedParcelaId, setSelectedParcelaId] = useState('')
  const [an, setAn] = useState(String(anInitial))

  useEffect(() => {
    if (!open) return
    setSelectedParcelaId('')
    setAn(String(anInitial))
  }, [anInitial, open])

  const saveDisabled = pending || !selectedParcelaId || !Number.isInteger(Number(an))

  const content = (
    <div className="space-y-4">
      <div className="space-y-2">
        <label htmlFor="assign-parcela-an" className="text-sm text-[var(--text-primary)] [font-weight:650]">
          An
        </label>
        <Input
          id="assign-parcela-an"
          type="number"
          inputMode="numeric"
          min="2020"
          max="2100"
          value={an}
          onChange={(event) => setAn(event.target.value)}
        />
      </div>

      <div className="space-y-3">
        {parcele.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[var(--border-default)] bg-[var(--surface-card-muted)] px-4 py-5 text-sm text-[var(--text-secondary)]">
            Nu există parcele eligibile pentru cultura acestui plan.
          </div>
        ) : (
          parcele.map((parcela) => {
            const selected = selectedParcelaId === parcela.id
            return (
              <button
                key={parcela.id}
                type="button"
                onClick={() => setSelectedParcelaId(parcela.id)}
                className={cn(
                  'w-full rounded-2xl border px-4 py-3 text-left transition-colors',
                  selected
                    ? 'border-[var(--agri-primary)] bg-[color:color-mix(in_srgb,var(--agri-primary)_8%,var(--surface-card))]'
                    : 'border-[var(--border-default)] bg-[var(--surface-card)] hover:bg-[var(--surface-card-muted)]'
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm text-[var(--text-primary)] [font-weight:650]">
                      {parcela.nume_parcela ?? 'Parcelă'}
                    </p>
                    <p className="mt-1 text-xs text-[var(--text-secondary)]">
                      {parcela.id_parcela ?? 'Fără cod'} ·{' '}
                      {typeof parcela.suprafata_m2 === 'number'
                        ? `${(parcela.suprafata_m2 / 10000).toLocaleString('ro-RO', { maximumFractionDigits: 2 })} ha`
                        : 'Suprafață nedefinită'}
                    </p>
                  </div>
                  <span
                    className={cn(
                      'mt-1 inline-flex h-4 w-4 shrink-0 rounded-full border',
                      selected
                        ? 'border-[var(--agri-primary)] bg-[var(--agri-primary)]'
                        : 'border-[var(--border-default)] bg-[var(--surface-card)]'
                    )}
                  />
                </div>
              </button>
            )
          })
        )}
      </div>
    </div>
  )

  const footer = (
    <DialogFormActions
      onCancel={() => onOpenChange(false)}
      onSave={async () => {
        await onSubmit({ an: Number(an), parcelaId: selectedParcelaId })
      }}
      saving={pending}
      disabled={saveDisabled}
      saveLabel="Asociază"
    />
  )

  if (isMobile) {
    return (
      <AppDrawer
        open={open}
        onOpenChange={onOpenChange}
        title="Asociază la parcelă"
        description="Selectează parcela și anul pentru această asociere."
        footer={footer}
      >
        {content}
      </AppDrawer>
    )
  }

  return (
    <AppDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Asociază la parcelă"
      description="Selectează parcela și anul pentru această asociere."
      footer={footer}
    >
      {content}
    </AppDialog>
  )
}
