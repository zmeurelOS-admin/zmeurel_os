import { describe, expect, it } from 'vitest'

import { COMENZI_INVALIDATED } from '@/components/comenzi/useComandaActions'
import { queryKeys } from '@/lib/query-keys'
import { RECOLTARE_INVALIDATED } from '@/lib/recoltari/invalidate'

/** TanStack potrivește cheile pe prefix, element cu element. */
function acopera(invalidate: readonly (readonly unknown[])[], cheieCitita: readonly unknown[]) {
  return invalidate.some((cheie) => cheie.every((element, index) => cheieCitita[index] === element))
}

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
})
