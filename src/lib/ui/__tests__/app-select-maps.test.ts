import { describe, expect, it } from 'vitest'

import {
  buildCategoryCheltuieliOptions,
  buildCategoryInvestitiiOptions,
  COHORTA_APP_SELECT_OPTIONS,
  formatStadiuOptionLabel,
  PRODUS_FITOSANITAR_TIP_APP_SELECT_OPTIONS,
} from '@/lib/ui/app-select-maps'
import { CATEGORII_CHELTUIELI } from '@/lib/financial/categories'

describe('app-select-maps', () => {
  it('expune categorii cheltuieli cu valori canonice și emoji', () => {
    const options = buildCategoryCheltuieliOptions()
    expect(options[0]?.value).toBe('')
    for (const categorie of CATEGORII_CHELTUIELI) {
      const match = options.find((option) => option.value === categorie)
      expect(match, `lipsește ${categorie}`).toBeDefined()
      expect(match?.emoji).toBeTruthy()
    }
  })

  it('formatează fenofaza cu emoji în label', () => {
    expect(
      formatStadiuOptionLabel({ value: 'inflorit', label: 'Înflorit', emoji: '🌼' })
    ).toBe('🌼 Înflorit')
  })

  it('păstrează codurile cohortei floricane/primocane', () => {
    expect(COHORTA_APP_SELECT_OPTIONS.find((o) => o.value === 'floricane')?.label).toBe('Floricane')
    expect(COHORTA_APP_SELECT_OPTIONS.find((o) => o.value === 'primocane')?.label).toBe('Primocane')
  })

  it('investiții folosesc aceleași string-uri ca CATEGORII_INVESTITII', () => {
    const options = buildCategoryInvestitiiOptions()
    const values = options.filter((o) => o.value).map((o) => o.value)
    expect(values).toContain('Material săditor')
    expect(values).toContain('Alte investiții')
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
