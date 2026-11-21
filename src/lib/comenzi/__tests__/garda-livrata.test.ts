import { describe, expect, it } from 'vitest'

import { COMANDA_LIVRATA_MESAJ, mesajEroareComanda } from '@/lib/comenzi/day-view'

describe('comenzi — erorile gărzii din baza de date', () => {
  it('comanda livrată blocată: mesaj clar, după detail', () => {
    const cause = Object.assign(new Error('Comanda e livrată: …'), {
      code: 'P0001',
      details: 'COMANDA_LIVRATA_BLOCATA',
    })
    expect(mesajEroareComanda(cause)).toBe(COMANDA_LIVRATA_MESAJ)
  })

  it('recunoaște și forma brută a erorii Supabase', () => {
    expect(mesajEroareComanda({ message: 'x', details: 'COMANDA_LIVRATA_BLOCATA', code: 'P0001' })).toBe(
      COMANDA_LIVRATA_MESAJ,
    )
  })

  it('stocul nu ajunge la editarea unei comenzi în livrare: câte kg lipsesc', () => {
    expect(mesajEroareComanda({ message: 'STOC_INSUFICIENT', details: 'necesar=3.00;disponibil=1.50', code: 'P0001' })).toBe(
      'Nu ajunge stocul: lipsesc 1,5 kg.',
    )
  })

  it('altă eroare: null (se afișează mesajul obișnuit)', () => {
    expect(mesajEroareComanda(new Error('Failed to fetch'))).toBeNull()
    expect(mesajEroareComanda(null)).toBeNull()
  })

  it('mesajul tehnic al bazei nu ajunge la fermier', () => {
    expect(COMANDA_LIVRATA_MESAJ).not.toMatch(/COMANDA_LIVRATA_BLOCATA|P0001|exception/)
  })
})
