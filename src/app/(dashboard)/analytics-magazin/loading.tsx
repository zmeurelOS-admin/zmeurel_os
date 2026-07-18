import { DashboardCardsRowSkeleton } from '@/components/app/ModuleSkeletons'

export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-5xl p-4 sm:px-3">
      <div className="space-y-4">
        <DashboardCardsRowSkeleton count={3} columns="grid-cols-1 sm:grid-cols-3" />
        <DashboardCardsRowSkeleton count={4} columns="grid-cols-1 sm:grid-cols-2 lg:grid-cols-4" />
      </div>
    </div>
  )
}
