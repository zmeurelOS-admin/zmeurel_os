import { describe, expect, it } from 'vitest'

import {
  buildHarvestObservatii,
  getHarvestCropSelection,
  getHarvestPauseReason,
  stripHiddenAgricultureMetadata,
} from '@/lib/parcele/crop-config'

describe('motivul recoltării din parcela în pauză (în observatii)', () => {
  it('se salvează ascuns, lângă cultura aleasă, fără să strice nota vizibilă', () => {
    const text = buildHarvestObservatii(
      'fructe ude',
      { cropId: 'zmeura', culture: 'Zmeură', variety: 'Maravilla' },
      { motiv: 'consum_propriu', panaLa: '2026-07-18', produs: 'Scala' },
    )
    expect(text).toContain('[zmeurel:harvest-crop]')
    expect(text).toContain('[zmeurel:recoltare-pauza]')
    expect(getHarvestPauseReason(text)).toEqual({ motiv: 'consum_propriu', panaLa: '2026-07-18', produs: 'Scala' })
    expect(getHarvestCropSelection(text)?.cropId).toBe('zmeura')
    expect(stripHiddenAgricultureMetadata(text)).toBe('fructe ude')
  })

  it('fără cultură și fără notă', () => {
    const text = buildHarvestObservatii('', null, { motiv: 'fructe_aruncate', panaLa: null, produs: null })
    expect(getHarvestPauseReason(text)?.motiv).toBe('fructe_aruncate')
    expect(stripHiddenAgricultureMetadata(text)).toBe('')
  })

  it('fără motiv: observatii ca înainte', () => {
    expect(buildHarvestObservatii('notă', null)).toBe('notă')
    expect(getHarvestPauseReason('notă')).toBeNull()
    expect(getHarvestPauseReason('[zmeurel:recoltare-pauza]{"motiv":"inventat"}[/zmeurel:recoltare-pauza]')).toBeNull()
  })
})
