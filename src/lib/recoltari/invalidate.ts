import type { QueryClient } from '@tanstack/react-query'

import { invalidateStock, queryKeys, STOCK_QUERY_KEYS } from '@/lib/query-keys'

/**
 * Tot ce se schimbă după ce o recoltare e adăugată, modificată sau ștearsă: lista, stocul cal. 1 derivat
 * (pagina Stoc, Acasă, stocul din Comenzi și verificarea din vânzarea rapidă), Acasă și manopera din cheltuieli.
 * (Culegătorii își iau plata din `recoltari`.)
 */
const RECOLTARE_PROPRII = [queryKeys.recoltari, queryKeys.cheltuieli] as const

export const RECOLTARE_INVALIDATED = [...RECOLTARE_PROPRII, ...STOCK_QUERY_KEYS] as const

/** După o recoltare adăugată, modificată sau ștearsă (formular, ștergere, chatul AI). */
export function invalidateDupaRecoltare(queryClient: Pick<QueryClient, 'invalidateQueries'>): void {
  for (const queryKey of RECOLTARE_PROPRII) void queryClient.invalidateQueries({ queryKey })
  invalidateStock(queryClient)
}
