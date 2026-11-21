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
