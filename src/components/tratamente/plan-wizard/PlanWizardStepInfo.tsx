'use client'

import { Sprout } from 'lucide-react'

import { AppCard } from '@/components/ui/app-card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

import type { PlanWizardInfoData } from '@/components/tratamente/plan-wizard/types'

interface PlanWizardStepInfoProps {
  culturi: string[]
  errors: Partial<Record<keyof PlanWizardInfoData, string>>
  value: PlanWizardInfoData
  onChange: (nextValue: PlanWizardInfoData) => void
}

export function PlanWizardStepInfo({
  culturi,
  errors,
  value,
  onChange,
}: PlanWizardStepInfoProps) {
  return (
    <div className="space-y-4">
      <AppCard className="rounded-[22px] p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--surface-card-muted)] text-[var(--agri-primary)]">
            <Sprout className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg tracking-[-0.02em] text-[var(--text-primary)] [font-weight:650]">
              Informații plan
            </h2>
            <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
              Dă-i un nume clar și alege cultura pentru care construim schema sezonieră.
            </p>
          </div>
        </div>
      </AppCard>

      <AppCard className="rounded-[22px] p-4 sm:p-5">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="plan-nume">Denumire plan *</Label>
            <Input
              id="plan-nume"
              value={value.nume}
              maxLength={120}
              placeholder="Ex: Plan zmeur primăvară"
              onChange={(event) => onChange({ ...value, nume: event.target.value })}
            />
            {errors.nume ? <p className="text-sm text-[var(--soft-danger-text)]">{errors.nume}</p> : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="plan-cultura">Cultura țintă *</Label>
            <select
              id="plan-cultura"
              value={value.cultura_tip}
              onChange={(event) => onChange({ ...value, cultura_tip: event.target.value })}
              className="agri-control h-11 w-full rounded-xl px-3 text-sm"
            >
              <option value="">Alege cultura</option>
              {culturi.map((cultura) => (
                <option key={cultura} value={cultura}>
                  {cultura}
                </option>
              ))}
            </select>
            {errors.cultura_tip ? <p className="text-sm text-[var(--soft-danger-text)]">{errors.cultura_tip}</p> : null}
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="plan-descriere">Descriere</Label>
            <Textarea
              id="plan-descriere"
              value={value.descriere}
              maxLength={500}
              rows={5}
              placeholder="Note despre obiectivul planului, observații de sezon, preferințe tehnologice."
              onChange={(event) => onChange({ ...value, descriere: event.target.value })}
            />
            <div className="flex items-center justify-between gap-3">
              {errors.descriere ? <p className="text-sm text-[var(--soft-danger-text)]">{errors.descriere}</p> : <span />}
              <span className="text-xs text-[var(--text-tertiary)]">
                {(value.descriere ?? '').length}/500
              </span>
            </div>
          </div>
        </div>
      </AppCard>
    </div>
  )
}
