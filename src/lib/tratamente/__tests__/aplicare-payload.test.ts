import { describe, expect, it } from 'vitest'

import {
  getAplicareProductLabel,
  parseAplicareProduse,
  parseDiferenteFataDePlan,
} from '@/lib/tratamente/aplicare-payload'

describe('aplicare-payload', () => {
  it('returnează mesaje clare pentru JSON invalid', () => {
    expect(() => parseAplicareProduse('{invalid')).toThrow(
      'Produsele aplicării nu sunt într-un format valid.'
    )
    expect(() => parseDiferenteFataDePlan('{invalid')).toThrow(
      'Diferențele față de plan nu sunt într-un format valid.'
    )
  })

  it('afișează fallback-ul snapshot când numele manual este gol', () => {
    expect(
      getAplicareProductLabel({
        ordine: 1,
        produs_id: null,
        produs_nume_manual: '',
        produs_nume_snapshot: 'Produs din snapshot',
        substanta_activa_snapshot: '',
        frac_irac_snapshot: '',
        observatii: '',
      })
    ).toBe('Produs din snapshot')
  })
})
