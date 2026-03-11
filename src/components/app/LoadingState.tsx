'use client'

import { Database } from 'lucide-react'

interface LoadingStateProps {
  label?: string
  rows?: number
}

export function LoadingState({ label = 'Se încarcă...', rows = 3 }: LoadingStateProps) {
  return (
    <div className="agri-card p-4 sm:p-5" aria-live="polite" aria-busy="true">
      <div className="mb-4 flex items-center gap-2">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--agri-border)] bg-[var(--agri-surface-muted)] text-[var(--agri-text)]">
          <Database className="h-4 w-4" />
        </span>
        <p className="text-sm font-semibold text-[var(--agri-text-muted)]">{label}</p>
      </div>

      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, index) => (
          <div key={index} className="animate-pulse rounded-2xl border border-[var(--agri-border)] bg-white p-4">
            <div className="h-3 w-32 rounded bg-slate-200" />
            <div className="mt-3 h-7 w-48 rounded bg-slate-300" />
            <div className="mt-3 h-3 w-40 rounded bg-slate-200" />
          </div>
        ))}
      </div>
    </div>
  )
}
