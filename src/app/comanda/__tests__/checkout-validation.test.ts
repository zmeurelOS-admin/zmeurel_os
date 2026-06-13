import { describe, expect, it } from 'vitest'

import { getDeliveryMinimumMessage, validateCheckoutForm } from '@/app/comanda/ShopClient'

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

  it.each(['+40 722 123 456', '40722123456'])('acceptă formatul românesc %s', (orderPhone) => {
    expect(validateCheckoutForm({ ...base, orderPhone })).toEqual({})
  })

  it.each(['0622123456', '722123456', '072212345', '07221234567', '+44 722 123 456'])(
    'respinge telefonul invalid %s',
    (orderPhone) => {
      expect(validateCheckoutForm({ ...base, orderPhone }).phone).toBe(
        'Introdu un număr de telefon valid (07xxxxxxxx)',
      )
    },
  )

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

describe('getDeliveryMinimumMessage', () => {
  it('nu impune minim suplimentar pentru ridicare', () => {
    expect(getDeliveryMinimumMessage('ridicare', null, 1)).toBeNull()
  })

  it('cere selectarea zonei pentru livrare', () => {
    expect(getDeliveryMinimumMessage('livrare', null, 4)).toBe('Selectează zona de livrare.')
  })

  it('aplică minimul de 2 caserole în Suceava', () => {
    expect(getDeliveryMinimumMessage('livrare', true, 1)).toBe(
      'Comanda minimă pentru livrare în Suceava este de 2 caserole (1 kg).',
    )
    expect(getDeliveryMinimumMessage('livrare', true, 2)).toBeNull()
  })

  it('aplică minimul de 4 caserole în afara Sucevei', () => {
    expect(getDeliveryMinimumMessage('livrare', false, 3)).toBe(
      'Comanda minimă pentru livrare în afara Sucevei este de 4 caserole (2 kg).',
    )
    expect(getDeliveryMinimumMessage('livrare', false, 4)).toBeNull()
  })
})
