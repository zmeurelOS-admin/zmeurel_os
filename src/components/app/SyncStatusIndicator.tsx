'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CloudOff, RefreshCw, Wifi } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  enqueue,
  getFailed,
  getPending,
  markSynced,
  type SyncQueueRecord,
} from '@/lib/offline/db'
import { getSyncEngine } from '@/lib/offline/syncEngine'

interface QueueCounts {
  pending: number
  failed: number
}

export function SyncStatusIndicator() {
  const [isOnline, setIsOnline] = useState(true)
  const [counts, setCounts] = useState<QueueCounts>({ pending: 0, failed: 0 })
  const [failedItems, setFailedItems] = useState<SyncQueueRecord[]>([])
  const [retrying, setRetrying] = useState(false)
  const [forcing, setForcing] = useState(false)

  const refreshCounts = useCallback(async () => {
    try {
      const [pending, failed] = await Promise.all([getPending(), getFailed()])
      setCounts({
        pending: pending.length,
        failed: failed.length,
      })
      setFailedItems(failed.slice(0, 3))
    } catch {
      setCounts({ pending: 0, failed: 0 })
      setFailedItems([])
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const engine = getSyncEngine()
    engine.start()

    setIsOnline(window.navigator.onLine)

    const onOnline = () => setIsOnline(true)
    const onOffline = () => setIsOnline(false)

    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)

    void refreshCounts()
    const id = window.setInterval(() => {
      void refreshCounts()
    }, 4000)

    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
      window.clearInterval(id)
    }
  }, [refreshCounts])

  const state = useMemo(() => {
    if (!isOnline) return 'offline'
    if (counts.failed > 0) return 'failed'
    if (counts.pending > 0) return 'syncing'
    return 'synced'
  }, [counts.failed, counts.pending, isOnline])

  const view = {
    synced: {
      label: 'Sincronizate',
      className: 'border-emerald-300 bg-emerald-100 text-emerald-900',
      icon: Wifi,
    },
    offline: {
      label: 'Offline',
      className: 'border-slate-400 bg-slate-200 text-slate-900',
      icon: CloudOff,
    },
    syncing: {
      label: 'In curs',
      className: 'border-blue-300 bg-blue-100 text-blue-900',
      icon: RefreshCw,
    },
    failed: {
      label: 'Eroare sync',
      className: 'border-red-300 bg-red-100 text-red-900',
      icon: AlertTriangle,
    },
  }[state]

  const Icon = view.icon

  const handleRetryAll = async () => {
    if (retrying) return
    setRetrying(true)
    try {
      await getSyncEngine().forceSync()
      await refreshCounts()
    } finally {
      setRetrying(false)
    }
  }

  const handleForceSyncNow = async () => {
    if (forcing) return
    setForcing(true)
    try {
      await getSyncEngine().forceSync()
      await refreshCounts()
    } finally {
      setForcing(false)
    }
  }

  const handleRetryOne = async (item: SyncQueueRecord) => {
    if (retrying) return
    setRetrying(true)
    try {
      await enqueue({
        id: item.id,
        table: item.table,
        payload: item.payload,
      })
      await getSyncEngine().forceSync()
      await refreshCounts()
    } finally {
      setRetrying(false)
    }
  }

  const handleResolveKeepLocal = async (item: SyncQueueRecord) => {
    if (retrying || forcing) return
    setRetrying(true)
    try {
      const payload =
        item.payload && typeof item.payload === 'object'
          ? {
              ...(item.payload as Record<string, unknown>),
              updated_at: new Date().toISOString(),
              conflict_flag: false,
            }
          : item.payload

      await enqueue({
        id: item.id,
        table: item.table,
        payload,
      })
      await getSyncEngine().forceSync()
      await refreshCounts()
    } finally {
      setRetrying(false)
    }
  }

  const handleResolveKeepServer = async (item: SyncQueueRecord) => {
    if (retrying || forcing) return
    setRetrying(true)
    try {
      await markSynced(item.id)
      await refreshCounts()
    } finally {
      setRetrying(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex items-center gap-2">
        <span
          className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-2.5 text-xs font-semibold ${view.className}`}
          aria-live="polite"
        >
          <Icon className={`h-3.5 w-3.5 ${state === 'syncing' ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">{view.label}</span>
          <span className="hidden sm:inline opacity-80">P:{counts.pending}</span>
          <span className="hidden sm:inline opacity-80">F:{counts.failed}</span>
        </span>

        <Button
          type="button"
          size="sm"
          variant="outline"
          className="hidden h-8 border-emerald-400 bg-white text-emerald-700 hover:bg-emerald-50 sm:inline-flex"
          onClick={handleForceSyncNow}
          disabled={forcing || retrying}
        >
          {forcing ? 'Sincronizare...' : 'Sincronizeaza acum'}
        </Button>
        <Button
          type="button"
          size="icon"
          variant="outline"
          className="h-8 w-8 border-emerald-400 bg-white text-emerald-700 hover:bg-emerald-50 sm:hidden"
          onClick={handleForceSyncNow}
          disabled={forcing || retrying}
          aria-label="Sincronizeaza acum"
          title="Sincronizeaza acum"
        >
          <RefreshCw className={`h-4 w-4 ${forcing ? 'animate-spin' : ''}`} />
        </Button>

        {counts.failed > 0 ? (
          <>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="hidden h-8 border-red-400 bg-white text-red-700 hover:bg-red-50 sm:inline-flex"
              onClick={handleRetryAll}
              disabled={retrying || forcing}
            >
              {retrying ? 'Retry...' : 'Retry Sync'}
            </Button>
            <Button
              type="button"
              size="icon"
              variant="outline"
              className="h-8 w-8 border-red-400 bg-white text-red-700 hover:bg-red-50 sm:hidden"
              onClick={handleRetryAll}
              disabled={retrying || forcing}
              aria-label="Retry sync"
              title="Retry sync"
            >
              <AlertTriangle className="h-4 w-4" />
            </Button>
          </>
        ) : null}
      </div>

      {failedItems.length > 0 ? (
        <div className="w-full max-w-sm rounded-xl border border-red-300 bg-white/95 p-2">
          <p className="mb-1 text-xs font-semibold text-red-800">Esuate recent</p>
          <ul className="space-y-1">
            {failedItems.map((item) => (
              <li key={item.id} className="rounded-md bg-red-50 px-2 py-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-[11px] font-medium text-red-900">
                    {item.table} · incercari {item.retries}
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2 text-[11px] font-semibold text-red-800 hover:bg-red-100"
                    onClick={() => {
                      void handleRetryOne(item)
                    }}
                    disabled={retrying || forcing}
                  >
                    Retry
                  </Button>
                </div>

                {item.conflict_flag ? (
                  <div className="mt-1 rounded-md border border-red-300 bg-white px-2 py-1">
                    <p className="text-[11px] font-semibold text-red-800">Conflict detectat</p>
                    <div className="mt-1 flex gap-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-6 border-amber-300 px-2 text-[11px] text-amber-800 hover:bg-amber-50"
                        onClick={() => {
                          void handleResolveKeepLocal(item)
                        }}
                        disabled={retrying || forcing}
                      >
                        Pastreaza local
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-6 border-emerald-300 px-2 text-[11px] text-emerald-800 hover:bg-emerald-50"
                        onClick={() => {
                          void handleResolveKeepServer(item)
                        }}
                        disabled={retrying || forcing}
                      >
                        Pastreaza server
                      </Button>
                    </div>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
