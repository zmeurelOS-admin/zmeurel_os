import { Skeleton } from '@/components/ui/skeleton'

export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-4 p-4 sm:px-3">
      <Skeleton className="h-8 w-1/2 rounded-lg" />
      <Skeleton className="h-4 w-1/3 rounded-md" />
      <Skeleton className="h-[420px] w-full rounded-2xl" />
    </div>
  )
}
