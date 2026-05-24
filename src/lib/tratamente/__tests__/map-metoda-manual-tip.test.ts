import { describe, expect, it } from 'vitest'

import { mapMetodaToManualTipSelect } from '@/lib/tratamente/map-metoda-manual-tip'

describe('mapMetodaToManualTipSelect', () => {
  it('mapează metodele din picker pe tip intervenție', () => {
    expect(mapMetodaToManualTipSelect('foliar')).toBe('foliar')
    expect(mapMetodaToManualTipSelect('fertirigare')).toBe('fertirigare')
    expect(mapMetodaToManualTipSelect('fertilizare_baza')).toBe('aplicare_sol')
    expect(mapMetodaToManualTipSelect('granulat_sol')).toBe('aplicare_sol')
    expect(mapMetodaToManualTipSelect('capcana_pus')).toBe('')
  })
})
