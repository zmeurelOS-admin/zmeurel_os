import { OrderCardsSkeleton } from '@/components/app/ModuleSkeletons'

export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-[980px] p-4 sm:px-3 lg:max-w-[1320px]">
      <OrderCardsSkeleton />
    </div>
  )
}
