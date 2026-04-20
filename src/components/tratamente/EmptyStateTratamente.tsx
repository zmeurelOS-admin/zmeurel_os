'use client'

import Link from 'next/link'
import { FileSpreadsheet, Sprout, CheckCircle2, Circle } from 'lucide-react'

import { AppCard } from '@/components/ui/app-card'
import { Button } from '@/components/ui/button'

interface EmptyStateTratamenteProps {
  createPlanHref: string
  importPlanHref: string
}

const steps = [
  'Creează primul plan de tratament',
  'Asignează planul la parcela curentă',
  'Înregistrează primul stadiu fenologic',
] as const

export function EmptyStateTratamente({
  createPlanHref,
  importPlanHref,
}: EmptyStateTratamenteProps) {
  return (
    <AppCard className="overflow-hidden rounded-[22px] bg-[color:color-mix(in_srgb,var(--agri-primary)_5%,var(--surface-card))] p-5 shadow-[var(--shadow-soft)]">
      <div className="flex flex-col items-center text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[color:color-mix(in_srgb,var(--agri-primary)_14%,var(--surface-card))] text-[var(--agri-primary)] shadow-[var(--shadow-soft)]">
          <Sprout className="h-7 w-7" aria-hidden="true" />
        </div>
        <h2 className="mt-4 text-lg text-[var(--text-primary)] [font-weight:750]">
          Începe modulul de tratamente pentru această parcelă
        </h2>
        <p className="mt-2 max-w-xl text-sm text-[var(--text-secondary)]">
          Urmează pașii de mai jos ca să vezi aplicările recomandate și controalele de conformitate pentru anul curent.
        </p>
      </div>

      <div className="mt-5 grid gap-3">
        {steps.map((step, index) => {
          const Icon = index === 0 ? CheckCircle2 : Circle
          const tone =
            index === 0
              ? 'border-[color:color-mix(in_srgb,var(--agri-primary)_20%,transparent)] bg-[color:color-mix(in_srgb,var(--agri-primary)_7%,transparent)] text-[var(--agri-primary)]'
              : 'border-[var(--border-default)] bg-[var(--surface-card)] text-[var(--text-secondary)]'

          return (
            <div
              key={step}
              className={`flex items-center gap-3 rounded-2xl border px-4 py-3 shadow-[var(--shadow-soft)] ${tone}`}
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[color:color-mix(in_srgb,currentColor_10%,transparent)] text-sm [font-weight:750]">
                {index + 1}
              </div>
              <div className="flex min-w-0 items-center gap-2">
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="text-sm [font-weight:650]">{step}</span>
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-5 grid gap-3 sm:max-w-sm">
        <Button asChild className="w-full bg-[var(--agri-primary)] text-white">
          <Link href={createPlanHref}>Creează primul plan</Link>
        </Button>
        <Button asChild variant="outline" className="w-full">
          <Link href={importPlanHref}>
            <FileSpreadsheet className="h-4 w-4" aria-hidden="true" />
            Importă din Excel
          </Link>
        </Button>
      </div>
    </AppCard>
  )
}
