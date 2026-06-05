import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  normalizeCustomerPhone,
  readCustomerSnapshotFromStorage,
  writeCustomerSnapshotToStorage,
} from '@/app/comanda/ShopClient'

describe('comanda customer localStorage cache', () => {
  beforeEach(() => {
    window.localStorage.clear()
    vi.useRealTimers()
  })

  it('normalizeaza telefonul in acelasi format pentru 0 si +40', () => {
    expect(normalizeCustomerPhone('0722 123 456')).toBe('722123456')
    expect(normalizeCustomerPhone('+40 722-123-456')).toBe('722123456')
    expect(normalizeCustomerPhone('0040 722 123 456')).toBe('722123456')
    expect(normalizeCustomerPhone('(0722) 123-456')).toBe('722123456')
  })

  it('salveaza si citeste snapshot-ul local cu cheia zmeurel_c_', () => {
    writeCustomerSnapshotToStorage({
      name: 'Ion Popescu',
      phone: '0722 123 456',
      delivery_address: 'Str. Fermierului 10',
      delivery_city: 'Suceava',
      delivery_mode: 'livrare',
    })

    expect(window.localStorage.getItem('zmeurel_c_722123456')).toBeTruthy()
    expect(readCustomerSnapshotFromStorage('+40 722 123 456')).toMatchObject({
      name: 'Ion Popescu',
      phone: '722123456',
      delivery_address: 'Str. Fermierului 10',
      delivery_city: 'Suceava',
      delivery_mode: 'livrare',
    })
  })

  it('citeste snapshot-ul din cheia legacy zmeurel_customer_', () => {
    window.localStorage.setItem(
      'zmeurel_customer_722123456',
      JSON.stringify({
        name: 'Maria Ionescu',
        phone: '722123456',
        delivery_address: 'Str. Principala 1',
        delivery_city: 'Salcea',
        delivery_mode: 'ridicare',
        savedAt: Date.now(),
      }),
    )

    expect(readCustomerSnapshotFromStorage('0722123456')).toMatchObject({
      name: 'Maria Ionescu',
      delivery_city: 'Salcea',
      delivery_mode: 'ridicare',
    })
  })

  it('ignora snapshot-urile mai vechi de 90 zile', () => {
    const now = new Date('2026-06-03T10:00:00Z')
    vi.useFakeTimers()
    vi.setSystemTime(now)
    window.localStorage.setItem(
      'zmeurel_c_722123456',
      JSON.stringify({
        name: 'Ion Vechi',
        phone: '722123456',
        delivery_address: 'Adresa veche',
        delivery_city: 'Suceava',
        delivery_mode: 'livrare',
        savedAt: now.getTime() - 91 * 24 * 60 * 60 * 1000,
      }),
    )

    expect(readCustomerSnapshotFromStorage('0722123456')).toBeNull()
    expect(window.localStorage.getItem('zmeurel_c_722123456')).toBeNull()
  })
})
