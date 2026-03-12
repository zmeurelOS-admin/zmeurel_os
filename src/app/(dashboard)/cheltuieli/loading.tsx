import { TableCardsSkeleton } from '@/components/app/ModuleSkeletons'

export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-7xl p-4 sm:px-3">
      <TableCardsSkeleton />
    </div>
  )
}
