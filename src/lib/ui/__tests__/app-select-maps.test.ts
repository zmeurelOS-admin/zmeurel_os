import { describe, expect, it } from 'vitest'

import {
  COHORTA_APP_SELECT_OPTIONS,
  formatStadiuOptionLabel,
  PRODUS_FITOSANITAR_TIP_APP_SELECT_OPTIONS,
} from '@/lib/ui/app-select-maps'

// Categoriile de cheltuieli și investiții nu mai trec prin `AppSelect`: formularul pe pași le arată ca plăci
// (vezi `lib/financial/categories.ts` și testele lui).
describe('app-select-maps', () => {
  it('formatează fenofaza cu emoji în label', () => {
    expect(
      formatStadiuOptionLabel({ value: 'inflorit', label: 'Înflorit', emoji: '🌼' })
    ).toBe('🌼 Înflorit')
  })

  it('păstrează codurile cohortei floricane/primocane', () => {
    expect(COHORTA_APP_SELECT_OPTIONS.find((o) => o.value === 'floricane')?.label).toBe('Floricane')
    expect(COHORTA_APP_SELECT_OPTIONS.find((o) => o.value === 'primocane')?.label).toBe('Primocane')
  })

  it('tip produs fitosanitar păstrează codurile DB', () => {
    expect(PRODUS_FITOSANITAR_TIP_APP_SELECT_OPTIONS.map((o) => o.value)).toEqual([
      'fungicid',
      'insecticid',
      'erbicid',
      'acaricid',
      'foliar',
      'ingrasamant',
      'bioregulator',
      'altul',
    ])
  })
})
