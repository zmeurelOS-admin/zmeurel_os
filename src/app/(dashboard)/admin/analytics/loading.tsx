import { Skeleton } from '@/components/ui/skeleton'

export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-7xl space-y-4 p-4">
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Skeleton className="h-28 rounded-2xl" />
        <Skeleton className="h-28 rounded-2xl" />
        <Skeleton className="h-28 rounded-2xl" />
        <Skeleton className="h-28 rounded-2xl" />
      </div>

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Skeleton className="h-80 rounded-2xl" />
        <Skeleton className="h-80 rounded-2xl" />
      </div>

      <Skeleton className="h-96 rounded-2xl" />
    </div>
  )
}
