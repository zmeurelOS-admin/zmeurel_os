import { TableCardsSkeleton } from '@/components/app/ModuleSkeletons'

export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-4xl p-4 sm:px-3 lg:max-w-7xl">
      <TableCardsSkeleton />
    </div>
  )
}
