import { Skeleton } from '@/components/ui/skeleton'

export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-4 p-4">
      <div className="space-y-2">
        <Skeleton className="h-8 w-44" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-48 rounded-2xl" />
        <Skeleton className="h-48 rounded-2xl" />
        <Skeleton className="h-56 rounded-2xl md:col-span-2" />
      </div>
    </div>
  )
}
