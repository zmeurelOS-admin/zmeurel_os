import { describe, expect, it } from 'vitest'

import {
  getParcelMobileSheetTabs,
  isParcelMobileSheetTabVisible,
  isParcelSolar,
  shouldShowRezumatMicroclimatBlock,
} from '@/lib/parcele/mobile-sheet-tabs'

describe('getParcelMobileSheetTabs', () => {
  it('câmp și livadă: doar Rezumat + Activitate', () => {
    expect(getParcelMobileSheetTabs('camp')).toEqual(['rezumat', 'activitate'])
    expect(getParcelMobileSheetTabs('livada')).toEqual(['rezumat', 'activitate'])
    expect(getParcelMobileSheetTabs('cultura_mare')).toEqual(['rezumat', 'activitate'])
  })

  it('solar: toate cele 4 taburi', () => {
    expect(getParcelMobileSheetTabs('solar')).toEqual([
      'rezumat',
      'activitate',
      'microclimat',
      'cultura',
    ])
  })

  it('ascunde Microclimat/Cultură pe non-solar', () => {
    expect(isParcelMobileSheetTabVisible('microclimat', 'camp')).toBe(false)
    expect(isParcelMobileSheetTabVisible('cultura', 'livada')).toBe(false)
    expect(isParcelMobileSheetTabVisible('microclimat', 'solar')).toBe(true)
    expect(isParcelMobileSheetTabVisible('cultura', 'solar')).toBe(true)
  })
})

describe('shouldShowRezumatMicroclimatBlock', () => {
  it('Rezumat câmp/livadă/cultură mare: fără bloc MICROCLIMAT', () => {
    expect(shouldShowRezumatMicroclimatBlock('camp')).toBe(false)
    expect(shouldShowRezumatMicroclimatBlock('livada')).toBe(false)
    expect(shouldShowRezumatMicroclimatBlock('cultura_mare')).toBe(false)
    expect(isParcelSolar('camp')).toBe(false)
  })

  it('Rezumat solar: cu bloc MICROCLIMAT', () => {
    expect(shouldShowRezumatMicroclimatBlock('solar')).toBe(true)
    expect(isParcelSolar('solar')).toBe(true)
  })
})
