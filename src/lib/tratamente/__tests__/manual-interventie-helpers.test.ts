import { describe, expect, it } from 'vitest'

import { parseManualInterventieFormData } from '@/lib/tratamente/manual-interventie-helpers'

describe('parseManualInterventieFormData', () => {
  it('normalizează stadiu gol la null pentru intervenții manuale', () => {
    const formData = new FormData()
    formData.set('parcelaId', '00000000-0000-4000-8000-000000000101')
    formData.set('status', 'aplicata')
    formData.set('data', '2026-05-10T10:00:00.000Z')
    formData.set('tip_interventie', 'protectie')
    formData.set('scop', 'protectie_fungica')
    formData.set('metoda_aplicare', 'foliar')
    formData.set('stadiu_la_aplicare', '')
    formData.set(
      'produse',
      JSON.stringify([
        {
          ordine: 1,
          produs_nume_manual: 'Cupru Standard',
          tip_snapshot: 'fungicid',
          cantitate_text: '200 ml/hl',
        },
      ])
    )

    const parsed = parseManualInterventieFormData(formData)

    expect(parsed.stadiu_la_aplicare).toBeNull()
  })
})
