'use client'

import { ListCard } from '@/components/ui/app-card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

interface ListSkeletonProps {
  className?: string
}

function SkeletonContent() {
  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-2.5">
          <Skeleton className="h-4 w-3/5 rounded-md" />
          <Skeleton className="h-3 w-2/5 rounded-md" />
        </div>
        <Skeleton className="h-9 w-9 flex-shrink-0 rounded-xl" />
      </div>
      <Skeleton className="mt-2.5 h-3 w-4/5 rounded-md" />
    </>
  )
}

export function ListSkeletonCard({ className }: ListSkeletonProps) {
  return (
    <ListCard className={cn('bg-[var(--surface-card)]', className)}>
      <SkeletonContent />
    </ListCard>
  )
}

export function ListSkeletonRow({ className }: ListSkeletonProps) {
  return (
    <div className={cn('rounded-[var(--agri-radius)] border border-[var(--divider)] bg-[var(--surface-card)] px-4 py-3.5', className)}>
      <SkeletonContent />
    </div>
  )
}

/** Loading listă entități (module dashboard) — același ritm ca MobileEntityCard. */
export function EntityListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, index) => (
        <ListSkeletonCard key={index} className="min-h-[88px]" />
      ))}
    </div>
  )
}
