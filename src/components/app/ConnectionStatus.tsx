'use client'

import { useEffect, useMemo, useState } from 'react'
import { useIsFetching, useIsMutating, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, CloudOff, RefreshCw, Wifi } from 'lucide-react'

type ConnectionState = 'online' | 'offline' | 'syncing' | 'sync-error'

export function ConnectionStatus() {
  const queryClient = useQueryClient()
  const isFetching = useIsFetching()
  const isMutating = useIsMutating()
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof window === 'undefined' ? true : window.navigator.onLine
  )
  const [hasSyncError, setHasSyncError] = useState(false)

  useEffect(() => {
    const onOnline = () => setIsOnline(true)
    const onOffline = () => setIsOnline(false)

    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)

    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])

  useEffect(() => {
    const computeSyncError = () => {
      const queryHasError = queryClient
        .getQueryCache()
        .getAll()
        .some((q) => q.state.status === 'error')

      const mutationHasError = queryClient
        .getMutationCache()
        .getAll()
        .some((m) => m.state.status === 'error')

      setHasSyncError(queryHasError || mutationHasError)
    }

    computeSyncError()
    const unsubQuery = queryClient.getQueryCache().subscribe(computeSyncError)
    const unsubMutation = queryClient.getMutationCache().subscribe(computeSyncError)

    return () => {
      unsubQuery()
      unsubMutation()
    }
  }, [queryClient])

  const state: ConnectionState = useMemo(() => {
    if (!isOnline) return 'offline'
    if (hasSyncError) return 'sync-error'
    if (isFetching > 0 || isMutating > 0) return 'syncing'
    return 'online'
  }, [hasSyncError, isFetching, isMutating, isOnline])

  const config = {
    online: {
      label: 'Online',
      className: 'border-emerald-300 bg-emerald-100 text-emerald-900 dark:border-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400',
      icon: Wifi,
    },
    offline: {
      label: 'Offline',
      className: 'border-slate-400 bg-slate-200 text-slate-900 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300',
      icon: CloudOff,
    },
    syncing: {
      label: 'Sincronizare',
      className: 'border-blue-300 bg-blue-100 text-blue-900 dark:border-blue-700 dark:bg-blue-900/50 dark:text-blue-400',
      icon: RefreshCw,
    },
    'sync-error': {
      label: 'Eroare sync',
      className: 'border-red-300 bg-red-100 text-red-900 dark:border-red-700 dark:bg-red-900/50 dark:text-red-400',
      icon: AlertTriangle,
    },
  }[state]

  const Icon = config.icon

  return (
    <span
      className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-2.5 text-xs font-semibold ${config.className}`}
      aria-live="polite"
    >
      <Icon className={`h-3.5 w-3.5 ${state === 'syncing' ? 'animate-spin' : ''}`} />
      <span>{config.label}</span>
    </span>
  )
}
