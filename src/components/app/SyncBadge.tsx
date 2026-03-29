'use client'

import { AlertTriangle, CheckCircle2, Clock3, RefreshCw } from 'lucide-react'

export type SyncBadgeStatus = 'synced' | 'pending' | 'syncing' | 'failed'

interface SyncBadgeProps {
  status?: string | null
  className?: string
}

function normalizeStatus(status?: string | null): SyncBadgeStatus {
  if (status === 'pending') return 'pending'
  if (status === 'syncing') return 'syncing'
  if (status === 'failed') return 'failed'
  return 'synced'
}

export function SyncBadge({ status, className }: SyncBadgeProps) {
  const normalized = normalizeStatus(status)

  const config = {
    synced: {
      label: 'Sincronizat',
      icon: CheckCircle2,
      classes: 'border-emerald-300 bg-emerald-100 text-emerald-900 dark:border-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
    },
    pending: {
      label: 'Salvat local',
      icon: Clock3,
      classes: 'border-amber-300 bg-amber-100 text-amber-900 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
    },
    syncing: {
      label: 'Sincronizare',
      icon: RefreshCw,
      classes: 'border-blue-300 bg-blue-100 text-blue-900 dark:border-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    },
    failed: {
      label: 'Eroare sync',
      icon: AlertTriangle,
      classes: 'border-red-300 bg-red-100 text-red-900 dark:border-red-700 dark:bg-red-900/30 dark:text-red-300',
    },
  }[normalized]

  const Icon = config.icon

  return (
    <span
      className={`inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[11px] font-semibold ${config.classes} ${className ?? ''}`}
      aria-live="polite"
    >
      <Icon className={`h-3.5 w-3.5 ${normalized === 'syncing' ? 'animate-spin' : ''}`} />
      <span>{config.label}</span>
    </span>
  )
}

