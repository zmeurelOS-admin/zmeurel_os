'use client'

import { useCallback, useEffect, useRef } from 'react'
import { useQueryClient, type QueryClient } from '@tanstack/react-query'

import { track } from '@/lib/analytics/track'
import { trackEvent } from '@/lib/analytics/trackEvent'
import { queryKeys } from '@/lib/query-keys'
import { deleteRecoltare, type Recoltare } from '@/lib/supabase/queries/recoltari'
import { toast } from '@/lib/ui/toast'
import { invalidateDupaRecoltare } from '@/lib/recoltari/invalidate'

/** Cât timp se mai poate anula ștergerea. */
export const RECOLTARE_UNDO_MS = 5000

const SERVER_MESSAGES: Record<string, string> = {
  cannot_delete_harvested_stock:
    'Recoltarea nu mai poate fi ștearsă: kilogramele sunt deja vândute sau promise în comenzi.',
  forbidden_delete: 'Doar proprietarul fermei poate șterge recoltări.',
}

function readableDeleteError(message: string): string {
  const known = Object.keys(SERVER_MESSAGES).find((code) => message.includes(code))
  return known ? SERVER_MESSAGES[known] : message
}

function restoreInCache(queryClient: QueryClient, pending: { item: Recoltare; index: number }) {
  queryClient.setQueryData<Recoltare[]>(queryKeys.recoltari, (current = []) => {
    if (current.some((item) => item.id === pending.item.id)) return current
    const next = [...current]
    next.splice(pending.index >= 0 ? Math.min(pending.index, next.length) : next.length, 0, pending.item)
    return next
  })
}

/**
 * Ștergerea unei recoltări, cu anulare: rândul dispare imediat din listă, ștergerea reală pleacă
 * după 5 secunde, iar „Anulează” din notificare îl pune la loc. Dacă pagina se închide mai devreme,
 * ștergerile aflate în așteptare pleacă pe loc. La eroare, rândul revine în listă.
 */
export function useRecoltareDeleteWithUndo({ canDelete }: { canDelete: boolean }) {
  const queryClient = useQueryClient()
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const pendingItems = useRef<Record<string, { item: Recoltare; index: number }>>({})

  const runDelete = useCallback(
    async (recoltareId: string) => {
      const result = await deleteRecoltare(recoltareId)
      const pending = pendingItems.current[recoltareId]
      delete pendingItems.current[recoltareId]

      if (!result.success) {
        if (pending) restoreInCache(queryClient, pending)
        toast.error(readableDeleteError(result.error))
        return
      }

      invalidateDupaRecoltare(queryClient)
      trackEvent('delete_item', 'recoltari')
      track('recoltare_delete', { id: recoltareId })
      if (result.warning) toast.warning(result.warning)
    },
    [queryClient],
  )

  // Pagina se închide: ce era în așteptare se șterge acum, nu se pierde.
  useEffect(() => {
    const timersRef = timers
    const pendingRef = pendingItems
    return () => {
      for (const id of Object.keys(timersRef.current)) {
        clearTimeout(timersRef.current[id])
        if (pendingRef.current[id]) void runDelete(id)
      }
      timersRef.current = {}
    }
  }, [runDelete])

  return useCallback(
    (recoltare: Recoltare) => {
      if (!canDelete) {
        toast.error('Operatorii nu pot șterge recoltări.')
        return
      }

      const recoltareId = recoltare.id
      if (timers.current[recoltareId]) return

      const current = queryClient.getQueryData<Recoltare[]>(queryKeys.recoltari) ?? []
      pendingItems.current[recoltareId] = {
        item: recoltare,
        index: current.findIndex((item) => item.id === recoltareId),
      }
      queryClient.setQueryData<Recoltare[]>(queryKeys.recoltari, (items = []) =>
        items.filter((item) => item.id !== recoltareId),
      )

      timers.current[recoltareId] = setTimeout(() => {
        delete timers.current[recoltareId]
        void runDelete(recoltareId)
      }, RECOLTARE_UNDO_MS)

      toast('Recoltare ștearsă', {
        duration: RECOLTARE_UNDO_MS,
        action: {
          label: 'Anulează',
          onClick: () => {
            const timer = timers.current[recoltareId]
            if (!timer) return
            clearTimeout(timer)
            delete timers.current[recoltareId]

            const pending = pendingItems.current[recoltareId]
            delete pendingItems.current[recoltareId]
            if (pending) restoreInCache(queryClient, pending)
          },
        },
      })
    },
    [canDelete, queryClient, runDelete],
  )
}
