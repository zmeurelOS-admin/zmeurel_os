'use client'

import { AlertTriangle } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { toUserFacingErrorMessage } from '@/lib/ui/error-messages'

interface ErrorStateProps {
  title: string
  message?: string
  onRetry?: () => void
  retryLabel?: string
}

export function ErrorState({ title, message, onRetry, retryLabel = 'Reîncearcă' }: ErrorStateProps) {
  const readableMessage = message ? toUserFacingErrorMessage({ message }, 'Nu am putut încărca datele.') : null

  return (
    <div className="agri-card space-y-3 border-red-300 bg-red-50 p-6 text-center">
      <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-red-300 bg-white text-red-700">
        <AlertTriangle className="h-5 w-5" />
      </div>
      <p className="text-lg font-bold text-red-800">{title}</p>
      {readableMessage ? <p className="text-sm font-medium text-red-700">{readableMessage}</p> : null}
      {onRetry ? (
        <Button
          type="button"
          onClick={onRetry}
          className="agri-cta w-full border border-red-700 bg-red-700 text-white hover:bg-red-800"
        >
          {retryLabel}
        </Button>
      ) : null}
    </div>
  )
}
