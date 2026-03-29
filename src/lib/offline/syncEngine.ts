import { getSupabase } from '@/lib/supabase/client'
import {
  enqueue,
  getFailed,
  getPending,
  markConflict,
  markFailed,
  markSynced,
  markSyncing,
  type SyncQueueRecord,
} from '@/lib/offline/db'
import { trackEvent } from '@/lib/analytics/trackEvent'
import type { Json } from '@/types/supabase'

export interface SyncEngineConfig {
  intervalMs?: number
  maxRetries?: number
  backoffBaseMs?: number
  maxBackoffMs?: number
}

const DEFAULT_CONFIG: Required<SyncEngineConfig> = {
  intervalMs: 30_000,
  maxRetries: 5,
  backoffBaseMs: 1_000,
  maxBackoffMs: 30_000,
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms)
  })
}

function isOnline(): boolean {
  return typeof window !== 'undefined' && window.navigator.onLine
}

function getBackoffDelayMs(attempt: number, baseMs: number, maxMs: number): number {
  const exp = Math.max(0, attempt - 1)
  return Math.min(baseMs * 2 ** exp, maxMs)
}

function isConflictError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const maybe = error as { status?: number; code?: string }
  return maybe.status === 409 || maybe.code === '23505'
}

function isNetworkError(error: unknown): boolean {
  if (!error) return false

  if (error instanceof TypeError) {
    return true
  }

  if (typeof error === 'object') {
    const maybe = error as { message?: string; status?: number }
    if (maybe.status === 0) return true
    const msg = (maybe.message ?? '').toLowerCase()
    return (
      msg.includes('network') ||
      msg.includes('fetch') ||
      msg.includes('offline') ||
      msg.includes('failed to fetch')
    )
  }

  return false
}

function hasConflictFlag(data: unknown): boolean {
  if (!data || typeof data !== 'object') return false
  const obj = data as { conflict_flag?: unknown }
  return obj.conflict_flag === true
}

export class SyncEngine {
  private readonly config: Required<SyncEngineConfig>
  private readonly supabase = getSupabase()
  private intervalId: number | null = null
  private started = false
  private syncing = false
  private onlineHandler: (() => void) | null = null

  constructor(config?: SyncEngineConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  start(): void {
    if (typeof window === 'undefined' || this.started) return

    this.started = true
    this.onlineHandler = () => {
      this.syncInBackground()
    }

    window.addEventListener('online', this.onlineHandler)
    this.intervalId = window.setInterval(() => {
      this.syncInBackground()
    }, this.config.intervalMs)

    this.syncInBackground()
  }

  stop(): void {
    if (!this.started || typeof window === 'undefined') return

    this.started = false
    if (this.onlineHandler) {
      window.removeEventListener('online', this.onlineHandler)
      this.onlineHandler = null
    }

    if (this.intervalId !== null) {
      window.clearInterval(this.intervalId)
      this.intervalId = null
    }
  }

  forceSync(): Promise<void> {
    return this.syncQueue(true)
  }

  private syncInBackground(): void {
    void this.syncQueue()
  }

  private async syncQueue(manual = false): Promise<void> {
    if ((!this.started && !manual) || this.syncing || !isOnline()) return
    this.syncing = true

    try {
      const [pending, failed] = await Promise.all([getPending(), getFailed()])
      const candidates = [...pending, ...failed]
        .filter((item) => item.retries < this.config.maxRetries)
        .sort((a, b) => a.created_at.localeCompare(b.created_at))

      for (const item of candidates) {
        if ((!this.started && !manual) || !isOnline()) break
        await this.syncOne(item)
      }
    } finally {
      this.syncing = false
    }
  }

  private async syncOne(item: SyncQueueRecord): Promise<void> {
    await markSyncing(item.id)

    try {
      const { data, error } = await this.supabase.rpc('upsert_with_idempotency', {
        table_name: item.table,
        payload: item.payload as Json,
      })

      if (!error) {
        if (hasConflictFlag(data)) {
          await markConflict(item.id, data as Json)
          trackEvent('sync_failed', {
            reason: 'conflict',
            table: item.table,
            id: item.id,
          })
          return
        }
        await markSynced(item.id)
        trackEvent('sync_success', { table: item.table, id: item.id })
        return
      }

      if (isConflictError(error)) {
        await markSynced(item.id)
        trackEvent('sync_success', { table: item.table, id: item.id, conflictResolved: true })
        return
      }

      if (isNetworkError(error)) {
        await this.handleNetworkFailure(item)
        return
      }

      await markFailed(item.id)
      trackEvent('sync_failed', { reason: 'server', table: item.table, id: item.id })
    } catch (error) {
      if (isConflictError(error)) {
        await markSynced(item.id)
        trackEvent('sync_success', { table: item.table, id: item.id, conflictResolved: true })
        return
      }

      if (isNetworkError(error)) {
        await this.handleNetworkFailure(item)
        return
      }

      await markFailed(item.id)
      trackEvent('sync_failed', { reason: 'exception', table: item.table, id: item.id })
    }
  }

  private async handleNetworkFailure(item: SyncQueueRecord): Promise<void> {
    const attempt = item.retries + 1
    await markFailed(item.id)
    trackEvent('sync_failed', {
      reason: 'network',
      table: item.table,
      id: item.id,
      attempt,
    })

    if (attempt >= this.config.maxRetries) {
      return
    }

    const waitMs = getBackoffDelayMs(
      attempt,
      this.config.backoffBaseMs,
      this.config.maxBackoffMs
    )

    await sleep(waitMs)

    if (!this.started || !isOnline()) {
      return
    }

    await enqueue({
      id: item.id,
      table: item.table,
      payload: item.payload,
    })
  }
}

let syncEngineInstance: SyncEngine | null = null

export function getSyncEngine(config?: SyncEngineConfig): SyncEngine {
  if (!syncEngineInstance) {
    syncEngineInstance = new SyncEngine(config)
  }

  return syncEngineInstance
}


