'use client'

import { AlertTriangle, Info, OctagonAlert, X } from 'lucide-react'

import { BaseCard } from '@/components/app/BaseCard'
import type { SmartAlert } from '@/lib/alerts/engine'

interface AlertCardProps {
  alert: SmartAlert
  onDismiss?: (alert: SmartAlert) => void
  dismissing?: boolean
}

export function AlertCard({ alert, onDismiss, dismissing = false }: AlertCardProps) {
  const config = {
    info: {
      icon: Info,
      className: 'border-blue-300 bg-blue-50 text-blue-900 dark:border-blue-700 dark:bg-blue-900/30 dark:text-blue-200',
      iconWrap: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300',
    },
    warning: {
      icon: AlertTriangle,
      className: 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-200',
      iconWrap: 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300',
    },
    danger: {
      icon: OctagonAlert,
      className: 'border-red-300 bg-red-50 text-red-900 dark:border-red-700 dark:bg-red-900/30 dark:text-red-200',
      iconWrap: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300',
    },
  }[alert.severity]

  const Icon = config.icon

  return (
    <BaseCard className={`h-auto min-h-0 p-4 ${config.className}`}>
      <div className="flex items-start gap-2">
        <span className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${config.iconWrap}`}>
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <h4 className="text-sm font-bold">{alert.title}</h4>
          <p className="mt-1 text-xs font-medium">{alert.message}</p>
        </div>
        {onDismiss ? (
          <button
            type="button"
            aria-label={`Ascunde alerta ${alert.title} pentru azi`}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-black/10 bg-white/60 text-[currentColor] transition hover:bg-white disabled:opacity-60 dark:border-white/15 dark:bg-zinc-900/60 dark:hover:bg-zinc-800"
            onClick={() => onDismiss(alert)}
            disabled={dismissing}
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>
    </BaseCard>
  )
}
