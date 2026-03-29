import { Skeleton } from '@/components/ui/skeleton'

export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-4 p-4">
      <div className="space-y-2">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-4 w-56" />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Skeleton className="h-24 rounded-2xl" />
        <Skeleton className="h-24 rounded-2xl" />
        <Skeleton className="h-24 rounded-2xl" />
      </div>

      <Skeleton className="h-96 rounded-2xl" />
    </div>
  )
}
