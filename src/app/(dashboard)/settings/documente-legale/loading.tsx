import { FormPageSkeleton } from '@/components/app/FormSkeleton'

export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-2xl p-4 sm:px-3">
      <FormPageSkeleton fieldCount={2} />
    </div>
  )
}
