import { EntityListSkeleton } from '@/components/app/ListSkeleton'

export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-3 sm:px-3 sm:py-4 lg:max-w-7xl">
      <EntityListSkeleton />
    </div>
  )
}
