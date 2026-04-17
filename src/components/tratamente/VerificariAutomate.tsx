'use client'

import { AlertTriangle, CheckCircle2, MinusCircle, XCircle } from 'lucide-react'

import { AppCard } from '@/components/ui/app-card'

export type VerificareTone = 'success' | 'warning' | 'danger' | 'neutral'

export interface VerificareAutomataState {
  message: string
  tone: VerificareTone
}

interface VerificariAutomateProps {
  phi: VerificareAutomataState
  sezon: VerificareAutomataState
  stoc: VerificareAutomataState
}

function getToneIcon(tone: VerificareTone) {
  if (tone === 'success') {
    return <CheckCircle2 className="h-5 w-5 text-[var(--status-success-text)]" aria-label="Status OK" />
  }

  if (tone === 'warning') {
    return <AlertTriangle className="h-5 w-5 text-[var(--status-warning-text)]" aria-label="Status atenție" />
  }

  if (tone === 'danger') {
    return <XCircle className="h-5 w-5 text-[var(--status-danger-text)]" aria-label="Status critic" />
  }

  return <MinusCircle className="h-5 w-5 text-[var(--text-secondary)]" aria-label="Status neutru" />
}

function getToneSurface(tone: VerificareTone): string {
  if (tone === 'success') return 'bg-[var(--status-success-bg)]'
  if (tone === 'warning') return 'bg-[var(--status-warning-bg)]'
  if (tone === 'danger') return 'bg-[var(--status-danger-bg)]'
  return 'bg-[var(--surface-card-muted)]'
}

function VerificareRow({
  label,
  state,
}: {
  label: string
  state: VerificareAutomataState
}) {
  return (
    <div className={`flex items-start gap-3 rounded-xl px-3 py-3 ${getToneSurface(state.tone)}`}>
      <div className="mt-0.5">{getToneIcon(state.tone)}</div>
      <div className="min-w-0">
        <p className="text-sm text-[var(--text-primary)] [font-weight:650]">{label}</p>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">{state.message}</p>
      </div>
    </div>
  )
}

export function VerificariAutomate({
  phi,
  sezon,
  stoc,
}: VerificariAutomateProps) {
  return (
    <AppCard className="rounded-2xl">
      <div className="space-y-3">
        <div>
          <h3 className="text-base text-[var(--text-primary)] [font-weight:650]">Verificări automate</h3>
        </div>

        <VerificareRow label="PHI vs recoltare" state={phi} />
        <VerificareRow label="Nr aplicări sezon" state={sezon} />
        <VerificareRow label="Stoc magazie" state={stoc} />
      </div>
    </AppCard>
  )
}
