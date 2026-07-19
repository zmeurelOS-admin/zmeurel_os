'use client'

import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

interface FormFieldSkeletonProps {
  labelWidth?: string
  inputHeight?: string
}

function FormFieldSkeleton({ labelWidth = 'w-28', inputHeight = 'h-12' }: FormFieldSkeletonProps) {
  return (
    <div className="space-y-2">
      <Skeleton className={cn('h-4 rounded-md', labelWidth)} />
      <Skeleton className={cn('w-full rounded-xl', inputHeight)} />
    </div>
  )
}

/**
 * Skeleton pentru pagini de formular/editare simplă (nu listă, nu wizard).
 * Reia limbajul vizual al DialogInitialDataSkeleton, extins cu un titlu de
 * pagină, pentru rute unde loading.tsx randează întreg ecranul.
 */
export function FormPageSkeleton({ fieldCount = 3 }: { fieldCount?: number }) {
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Skeleton className="h-6 w-1/2 rounded-lg" />
        <Skeleton className="h-4 w-1/3 rounded-md" />
      </div>

      <div className="space-y-4 rounded-2xl border border-[var(--border-default)] bg-[var(--surface-card)] p-4">
        {Array.from({ length: fieldCount }).map((_, index) => (
          <FormFieldSkeleton key={index} />
        ))}
      </div>

      <div className="flex justify-end gap-3">
        <Skeleton className="h-11 w-24 rounded-xl" />
        <Skeleton className="h-11 w-32 rounded-xl" />
      </div>
    </div>
  )
}

/**
 * Skeleton pentru wizard-uri cu pași (ex. import Excel, plan nou), cu un
 * stepper static deasupra corpului de formular — oglindește structura
 * vizuală reală a stepper-ului din ImportFlowClient/PlanWizardScreen.
 */
export function FormWizardSkeleton({ steps = 3 }: { steps?: number }) {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--surface-card)] px-4 py-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          {Array.from({ length: steps }).map((_, index) => (
            <div key={index} className="flex items-center gap-3 md:flex-1">
              <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
              <Skeleton className="h-3 w-16 rounded-md" />
              {index < steps - 1 ? (
                <Skeleton className="hidden h-px flex-1 rounded-full md:block" />
              ) : null}
            </div>
          ))}
        </div>
      </div>

      <FormPageSkeleton fieldCount={3} />
    </div>
  )
}
