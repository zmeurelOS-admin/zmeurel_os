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
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-4 w-2/3 rounded-lg" />
          <Skeleton className="h-3 w-1/2 rounded-lg" />
        </div>
        <Skeleton className="h-8 w-8 flex-shrink-0 rounded-lg" />
      </div>
      <Skeleton className="mt-3 h-3 w-5/6 rounded-lg" />
    </>
  )
}

export function ListSkeletonCard({ className }: ListSkeletonProps) {
  return (
    <ListCard className={cn('border-[var(--agri-border)] bg-[var(--agri-surface)]', className)}>
      <SkeletonContent />
    </ListCard>
  )
}

export function ListSkeletonRow({ className }: ListSkeletonProps) {
  return (
    <div className={cn('px-4 py-3', className)}>
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
