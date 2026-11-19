'use client'

import { useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'

import { track } from '@/lib/analytics/track'
import { queryKeys } from '@/lib/query-keys'
import { createClienți, type CreateClientInput } from '@/lib/supabase/queries/clienti'
import { getSupabase } from '@/lib/supabase/client'
import {
  deleteComanda,
  deliverComanda,
  markComandaIncasata,
  reopenComanda,
  updateComanda,
  type Comanda,
  type ComandaPaymentStatus,
  type UpdateComandaInput,
} from '@/lib/supabase/queries/comenzi'
import { getTenantId } from '@/lib/tenant/get-tenant'

/** Tot ce depinde de o comandă: liste, stoc, vânzări, Acasă. */
export const COMENZI_INVALIDATED = [
  queryKeys.comenzi,
  queryKeys.comenziManualInLivrare,
  queryKeys.comenziStockSummaryAzi,
  queryKeys.dashboard,
  queryKeys.vanzari,
  queryKeys.stocGlobal,
  queryKeys.stocGlobalCal1,
  queryKeys.stocuriLocatiiRoot,
  queryKeys.miscariStoc,
] as const

/**
 * Operațiile pe o comandă, cu actualizarea listelor. Aruncă eroarea mai departe: ecranul hotărăște cum o arată
 * (în foaie, sus, nu într-o notificare care dispare).
 */
export function useComandaActions() {
  const queryClient = useQueryClient()

  const refresh = useCallback(() => {
    for (const queryKey of COMENZI_INVALIDATED) {
      void queryClient.invalidateQueries({ queryKey })
    }
  }, [queryClient])

  const replaceInCache = useCallback(
    (row: Comanda) => {
      queryClient.setQueryData<Comanda[]>(queryKeys.comenzi, (previous) =>
        previous ? previous.map((item) => (item.id === row.id ? { ...item, ...row } : item)) : previous,
      )
    },
    [queryClient],
  )

  const update = useCallback(
    async (id: string, payload: UpdateComandaInput) => {
      try {
        const row = await updateComanda(id, payload)
        replaceInCache(row)
        track('comanda_edit', { id })
        return row
      } finally {
        // Și la eroare: stocul sau statusul s-au putut schimba între timp.
        refresh()
      }
    },
    [refresh, replaceInCache],
  )

  const deliver = useCallback(
    async (input: { comandaId: string; cantitateLivrataKg: number; statusPlata: ComandaPaymentStatus }) => {
      try {
        const result = await deliverComanda({ ...input, dataLivrareRamasa: null })
        queryClient.setQueryData<Comanda[]>(queryKeys.comenzi, (previous) => {
          if (!previous) return previous
          const next = previous.map((item) => (item.id === result.deliveredOrder.id ? result.deliveredOrder : item))
          const remaining = result.remainingOrder
          return remaining && !next.some((item) => item.id === remaining.id) ? [remaining, ...next] : next
        })
        return result
      } finally {
        refresh()
      }
    },
    [queryClient, refresh],
  )

  const markPaid = useCallback(
    async (comandaId: string) => {
      try {
        return await markComandaIncasata(comandaId)
      } finally {
        refresh()
      }
    },
    [refresh],
  )

  const reopen = useCallback(
    async (comandaId: string) => {
      try {
        const row = await reopenComanda(comandaId)
        replaceInCache(row)
        return row
      } finally {
        refresh()
      }
    },
    [refresh, replaceInCache],
  )

  const remove = useCallback(
    async (comandaId: string) => {
      try {
        await deleteComanda(comandaId)
        queryClient.setQueryData<Comanda[]>(queryKeys.comenzi, (previous) =>
          previous ? previous.filter((item) => item.id !== comandaId) : previous,
        )
        track('comanda_delete', { id: comandaId })
      } finally {
        refresh()
      }
    },
    [queryClient, refresh],
  )

  /** Creează clientul și îl leagă de o comandă care avea doar nume și telefon scrise de mână. */
  const saveClientForComanda = useCallback(
    async (comandaId: string, input: CreateClientInput) => {
      const client = await createClienți(input)
      const supabase = getSupabase()
      const tenantId = await getTenantId(supabase)
      const { error } = await supabase
        .from('comenzi')
        .update({ client_id: client.id })
        .eq('id', comandaId)
        .eq('tenant_id', tenantId)
      void queryClient.invalidateQueries({ queryKey: queryKeys.clienti })
      refresh()
      if (error) throw new Error(error.message || 'Clientul a fost creat, dar nu s-a legat de comandă.')
      return client
    },
    [queryClient, refresh],
  )

  return { update, deliver, markPaid, reopen, remove, saveClientForComanda, refresh }
}

export type ComandaActions = ReturnType<typeof useComandaActions>
