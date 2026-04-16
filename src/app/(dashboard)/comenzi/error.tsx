'use client'

import { useEffect } from 'react'

import { ErrorState } from '@/components/app/ErrorState'
import { captureReactError } from '@/lib/monitoring/sentry'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    
    captureReactError(error, { component: 'ComenziErrorBoundary' })
  }, [error])

  return (
    <div className="flex min-h-[50vh] items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <ErrorState
          title="Ceva nu a funcționat corect"
          message="A apărut o eroare la încărcarea modulului Comenzi. Încercați din nou."
          onRetry={reset}
        />
      </div>
    </div>
  )
}
