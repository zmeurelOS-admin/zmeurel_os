import { OrderCardsSkeleton } from '@/components/app/ModuleSkeletons'

export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-5xl p-4 sm:px-3">
      <OrderCardsSkeleton />
    </div>
  )
}
