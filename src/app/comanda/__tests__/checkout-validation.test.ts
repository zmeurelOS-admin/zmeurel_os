import { describe, expect, it } from 'vitest'

import { validateCheckoutForm } from '@/app/comanda/ShopClient'

describe('validateCheckoutForm', () => {
  const base = {
    orderName: 'Ion Popescu',
    orderPhone: '0722 123 456',
    orderCity: 'Suceava',
    orderAddress: 'Str. Principala 10',
    deliveryMode: 'livrare' as const,
    cartLineCount: 2,
  }

  it('accepta un formular complet valid', () => {
    expect(validateCheckoutForm(base)).toEqual({})
  })

  it('raporteaza erori pentru nume, telefon, localitate, adresa si cos gol', () => {
    const errors = validateCheckoutForm({
      orderName: 'A',
      orderPhone: '123',
      orderCity: '',
      orderAddress: 'abc',
      deliveryMode: 'livrare',
      cartLineCount: 0,
    })

    expect(errors.name).toBeTruthy()
    expect(errors.phone).toBeTruthy()
    expect(errors.city).toBeTruthy()
    expect(errors.address).toBeTruthy()
    expect(errors.cart).toBeTruthy()
  })

  it('nu cere localitate sau adresa pentru ridicare', () => {
    expect(
      validateCheckoutForm({
        ...base,
        deliveryMode: 'ridicare',
        orderCity: '',
        orderAddress: '',
      }),
    ).toEqual({})
  })
})
