import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

interface DialogInitialDataSkeletonProps {
  className?: string
  compact?: boolean
}

export function DialogInitialDataSkeleton({
  className,
  compact = false,
}: DialogInitialDataSkeletonProps) {
  return (
    <div className={cn('space-y-4', className)}>
      <div className="space-y-2">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-12 w-full rounded-xl" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-12 w-full rounded-xl" />
      </div>
      {!compact ? (
        <>
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-24 w-full rounded-2xl" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Skeleton className="h-11 w-full rounded-xl" />
            <Skeleton className="h-11 w-full rounded-xl" />
          </div>
        </>
      ) : null}
    </div>
  )
}
