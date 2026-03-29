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
    <div className="agri-card space-y-3 border-[var(--soft-danger-border)] bg-[var(--soft-danger-bg)] p-6 text-center">
      <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-[var(--soft-danger-border)] bg-[var(--agri-surface)] text-[var(--soft-danger-text)]">
        <AlertTriangle className="h-5 w-5" />
      </div>
      <p className="text-lg font-bold text-[var(--soft-danger-text)]">{title}</p>
      {readableMessage ? <p className="text-sm font-medium text-[var(--soft-danger-text)]">{readableMessage}</p> : null}
      {onRetry ? (
        <Button
          type="button"
          onClick={onRetry}
          className="agri-cta w-full border border-[var(--soft-danger-text)] bg-[var(--soft-danger-text)] text-white hover:opacity-95"
        >
          {retryLabel}
        </Button>
      ) : null}
    </div>
  )
}
