import { describe, expect, it } from 'vitest'

import { plataLaLivrare } from '@/lib/livrari/plata'

describe('livrări — plata la livrare (și la „Livrează și copiază”)', () => {
  it('încasat tot: platit, fără avans', () => {
    expect(plataLaLivrare({ expectedLei: 350, payment: 'cash', parsedSuma: 350, zeroPrice: false })).toEqual({
      sumaValid: true,
      receivedLei: 350,
      paidInFull: true,
      statusPlata: 'platit',
      avansLei: 0,
    })
  })

  it('avans: neplatit, cu suma primită', () => {
    expect(plataLaLivrare({ expectedLei: 350, payment: 'transfer', parsedSuma: 100, zeroPrice: false })).toEqual({
      sumaValid: true,
      receivedLei: 100,
      paidInFull: false,
      statusPlata: 'neplatit',
      avansLei: 100,
    })
  })

  it('nu a plătit: neplatit, fără avans, oricare ar fi suma scrisă', () => {
    const plata = plataLaLivrare({ expectedLei: 350, payment: 'neplatit', parsedSuma: 350, zeroPrice: false })
    expect(plata.statusPlata).toBe('neplatit')
    expect(plata.avansLei).toBe(0)
    expect(plata.sumaValid).toBe(true)
  })

  it('suma peste total sau scrisă greșit nu e validă', () => {
    expect(plataLaLivrare({ expectedLei: 350, payment: 'cash', parsedSuma: 400, zeroPrice: false }).sumaValid).toBe(false)
    expect(plataLaLivrare({ expectedLei: 350, payment: 'cash', parsedSuma: null, zeroPrice: false }).sumaValid).toBe(false)
  })

  it('fără bani de încasat (cadou): platit', () => {
    expect(plataLaLivrare({ expectedLei: 0, payment: 'neplatit', parsedSuma: null, zeroPrice: true }).statusPlata).toBe('platit')
  })
})
