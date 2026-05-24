import { describe, expect, it } from 'vitest'

import {
  APLICARE_LEGACY_PRODUS_FARA_PRODUS,
  aplicareLegacyProdusFieldsFaraProdus,
  satisfiesAplicariTratamentProdusXorCheck,
} from '@/lib/tratamente/aplicare-legacy-produs'

describe('aplicare legacy produs XOR', () => {
  it('respinge ambele câmpuri goale (cauza erorii montare capcană)', () => {
    expect(
      satisfiesAplicariTratamentProdusXorCheck({
        produs_id: null,
        produs_nume_manual: null,
      })
    ).toBe(false)
  })

  it('acceptă sentinelul fără produs pentru capcane', () => {
    const fields = aplicareLegacyProdusFieldsFaraProdus()
    expect(fields.produs_id).toBeNull()
    expect(fields.produs_nume_manual).toBe(APLICARE_LEGACY_PRODUS_FARA_PRODUS)
    expect(satisfiesAplicariTratamentProdusXorCheck(fields)).toBe(true)
  })

  it('acceptă produs din bibliotecă fără nume manual', () => {
    expect(
      satisfiesAplicariTratamentProdusXorCheck({
        produs_id: '00000000-0000-4000-8000-000000000001',
        produs_nume_manual: null,
      })
    ).toBe(true)
  })
})
