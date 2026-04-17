'use client'

import { Sprout } from 'lucide-react'

import { AppCard } from '@/components/ui/app-card'
import { Button } from '@/components/ui/button'

interface EmptyStateTratamenteProps {
  onAssignPlan: () => void
  onRecordStadiu: () => void
}

export function EmptyStateTratamente({
  onAssignPlan,
  onRecordStadiu,
}: EmptyStateTratamenteProps) {
  return (
    <AppCard className="overflow-hidden rounded-2xl bg-[color:color-mix(in_srgb,var(--agri-primary)_5%,var(--surface-card))] p-5 shadow-[var(--shadow-soft)]">
      <div className="flex flex-col items-center text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[color:color-mix(in_srgb,var(--agri-primary)_14%,var(--surface-card))] text-[var(--agri-primary)] shadow-[var(--shadow-soft)]">
          <Sprout className="h-7 w-7" />
        </div>
        <h2 className="mt-4 text-lg text-[var(--text-primary)] [font-weight:750]">
          Începe modulul de tratamente pentru această parcelă
        </h2>
        <p className="mt-2 max-w-xl text-sm text-[var(--text-secondary)]">
          Adaugă un plan de tratament și primul stadiu fenologic ca să vezi aplicările recomandate pentru acest an.
        </p>
      </div>

      <div className="mt-5 grid gap-3 sm:max-w-sm">
        <Button type="button" className="w-full bg-[var(--agri-primary)] text-white" onClick={onAssignPlan}>
          Atribuie un plan
        </Button>
        <Button type="button" variant="outline" className="w-full" onClick={onRecordStadiu}>
          Înregistrează primul stadiu
        </Button>
      </div>
    </AppCard>
  )
}
