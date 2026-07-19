import { FormWizardSkeleton } from '@/components/app/FormSkeleton'

export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-4 p-4 sm:px-3">
      <FormWizardSkeleton steps={3} />
    </div>
  )
}
