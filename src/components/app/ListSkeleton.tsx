'use client'

import { ListCard } from '@/components/ui/app-card'
import { cn } from '@/lib/utils'

interface ListSkeletonProps {
  className?: string
}

function SkeletonContent() {
  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="h-4 w-2/3 rounded-lg bg-gray-200 animate-pulse" />
          <div className="h-3 w-1/2 rounded-lg bg-gray-200 animate-pulse" />
        </div>
        <div className="h-8 w-8 flex-shrink-0 rounded-lg bg-gray-200 animate-pulse" />
      </div>
      <div className="mt-3 h-3 w-5/6 rounded-lg bg-gray-200 animate-pulse" />
    </>
  )
}

export function ListSkeletonCard({ className }: ListSkeletonProps) {
  return (
    <ListCard className={cn('border-[var(--agri-border)] bg-white hover:shadow-sm', className)}>
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
