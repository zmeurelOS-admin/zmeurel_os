'use client'

import { useEffect } from 'react'
import { captureReactError } from '@/lib/monitoring/sentry'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    captureReactError(error, { component: 'GlobalErrorBoundary' })
  }, [error])

  return (
    <html lang="ro" data-scroll-behavior="smooth">
      <body>
        <h2>A apărut o eroare neașteptată.</h2>
        <button type="button" onClick={() => reset()}>
          Reîncearcă
        </button>
      </body>
    </html>
  )
}
