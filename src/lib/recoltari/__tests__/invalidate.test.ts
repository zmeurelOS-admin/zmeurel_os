import { describe, expect, it } from 'vitest'

import { COMENZI_INVALIDATED, invalidateDupaComanda } from '@/components/comenzi/useComandaActions'
import { invalidateStock, queryKeys, STOCK_QUERY_KEYS } from '@/lib/query-keys'
import { invalidateDupaRecoltare, RECOLTARE_INVALIDATED } from '@/lib/recoltari/invalidate'

type Cheie = readonly unknown[]

/** TanStack potrivește cheile pe prefix, element cu element. */
function acopera(invalidate: readonly Cheie[], cheieCitita: Cheie) {
  return invalidate.some((cheie) => cheie.every((element, index) => cheieCitita[index] === element))
}

/** Un `queryClient` care doar ține minte ce i s-a cerut să invalideze. */
function clientFals() {
  const invalidate: Cheie[] = []
  return {
    invalidate,
    client: {
      invalidateQueries: async (filters?: { queryKey?: Cheie }) => {
        if (filters?.queryKey) invalidate.push(filters.queryKey)
      },
    },
  }
}

/** Toate cheile din care citește cineva stocul. */
const CHEI_STOC = [
  queryKeys.stocGlobal,
  queryKeys.stocGlobalCal1,
  queryKeys.ajustariStoc,
  queryKeys.stocuriLocatiiRoot,
  queryKeys.stocuriLocatii({ produs: 'zmeura' }),
  queryKeys.miscariStoc,
  queryKeys.comenziStockSummaryAzi,
  queryKeys.dashboard,
] as const

describe('invalidateStock', () => {
  it('invalidează lista completă a cheilor de stoc', () => {
    const { client, invalidate } = clientFals()
    invalidateStock(client)
    expect(invalidate).toEqual([...STOCK_QUERY_KEYS])
    for (const cheie of CHEI_STOC) {
      expect(acopera(invalidate, cheie)).toBe(true)
    }
  })

  it('cheile citite de Stocuri (cifra mare și istoricul ajustărilor) sunt pe listă', () => {
    expect(STOCK_QUERY_KEYS).toContain(queryKeys.stocGlobalCal1)
    expect(STOCK_QUERY_KEYS).toContain(queryKeys.ajustariStoc)
    expect(STOCK_QUERY_KEYS).toContain(queryKeys.comenziStockSummaryAzi)
  })
})

describe('invalidările după recoltare și comandă', () => {
  it('o recoltare reîmprospătează stocul citit de Stoc, Acasă, Comenzi și vânzarea rapidă', () => {
    for (const cheie of [queryKeys.stocGlobalCal1, queryKeys.comenziStockSummaryAzi, queryKeys.recoltari, queryKeys.cheltuieli]) {
      expect(acopera(RECOLTARE_INVALIDATED, cheie)).toBe(true)
    }
  })

  it('o comandă reîmprospătează stocul cal. 1 și vânzările', () => {
    for (const cheie of [queryKeys.stocGlobalCal1, queryKeys.comenziStockSummaryAzi, queryKeys.vanzari, queryKeys.comenzi]) {
      expect(acopera(COMENZI_INVALIDATED, cheie)).toBe(true)
    }
  })

  it('după o recoltare (formular, ștergere, chatul AI): tot stocul, plus recoltările și manopera', () => {
    const { client, invalidate } = clientFals()
    invalidateDupaRecoltare(client)
    for (const cheie of [...CHEI_STOC, queryKeys.recoltari, queryKeys.cheltuieli]) {
      expect(acopera(invalidate, cheie)).toBe(true)
    }
  })

  it('după o comandă (creată, livrată, anulată, vânzare rapidă, chatul AI): tot stocul, plus comenzile și vânzările', () => {
    const { client, invalidate } = clientFals()
    invalidateDupaComanda(client)
    for (const cheie of [...CHEI_STOC, queryKeys.comenzi, queryKeys.comenziManualInLivrare, queryKeys.vanzari]) {
      expect(acopera(invalidate, cheie)).toBe(true)
    }
  })
})
