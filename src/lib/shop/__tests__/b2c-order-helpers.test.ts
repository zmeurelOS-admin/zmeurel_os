import { describe, expect, it } from 'vitest'

import {
  buildLivrareWaMessage,
  getBucharestDayUtcRange,
  type ShopOrderRow,
} from '@/lib/shop/b2c-order-helpers'

function makeOrder(overrides: Partial<ShopOrderRow> = {}): ShopOrderRow {
  return {
    id: 'order-1',
    created_at: '2026-06-04T10:00:00.000Z',
    customer_name: 'Maria Pop',
    customer_phone: '0752123456',
    delivery_mode: 'livrare',
    delivery_address: 'Str. Florilor 12, Suceava',
    delivery_date: null,
    delivery_position: null,
    items: [{ label: 'Afine 500g', qty: 2, price_lei: 40 }],
    total_lei: 80,
    notes: null,
    status: 'in_livrare',
    notified_wa: false,
    ...overrides,
  }
}

describe('buildLivrareWaMessage', () => {
  it('cazul cu adresă — mesaj standard formal', () => {
    const message = buildLivrareWaMessage(makeOrder())

    expect(message).toContain('Bună ziua, Maria Pop! 🍓')
    expect(message).toContain('Comanda dvs. este programată pentru livrare astăzi.')
    expect(message).toContain('• Afine 500g × 2 — 80 lei')
    expect(message).toContain('Total: 80 lei (numerar)')
    expect(message).toContain(
      'Dacă aveți modificări (cantitate, adresă, oră), vă rugăm să ne scrieți la acest mesaj.',
    )
    expect(message).toContain('— Ferma Zmeurel, Văratec 📍')
    expect(message).not.toContain('Vă rugăm să ne comunicați adresa de livrare')
    expect(message).not.toMatch(/Revolut|în drum spre tine|vă contactăm înainte de sosire/i)
  })

  it('cazul fără adresă — cere adresa de livrare', () => {
    const message = buildLivrareWaMessage(makeOrder({ delivery_address: null }))

    expect(message).toContain('Vă rugăm să ne comunicați adresa de livrare răspunzând la acest mesaj.')
    expect(message).toContain(
      'Dacă aveți și alte modificări (cantitate, oră), ne puteți scrie tot aici.',
    )
    expect(message).not.toContain(
      'Dacă aveți modificări (cantitate, adresă, oră), vă rugăm să ne scrieți la acest mesaj.',
    )
  })

  it.each([
    { label: 'string gol', delivery_address: '' as string | null },
    { label: 'doar spații', delivery_address: '   ' },
    { label: 'null', delivery_address: null },
    {
      label: 'undefined',
      delivery_address: undefined as unknown as string | null,
    },
  ])('hasAddress fals pentru $label', ({ delivery_address }) => {
    const message = buildLivrareWaMessage(makeOrder({ delivery_address }))

    expect(message).toContain('Vă rugăm să ne comunicați adresa de livrare')
    expect(message).not.toContain(
      'Dacă aveți modificări (cantitate, adresă, oră), vă rugăm să ne scrieți la acest mesaj.',
    )
  })
})

describe('getBucharestDayUtcRange', () => {
  it.each([
    ['2026-01-07', '2026-01-06T22:00:00.000Z', '2026-01-07T22:00:00.000Z'],
    ['2026-06-07', '2026-06-06T21:00:00.000Z', '2026-06-07T21:00:00.000Z'],
    ['2026-03-29', '2026-03-28T22:00:00.000Z', '2026-03-29T21:00:00.000Z'],
    ['2026-10-25', '2026-10-24T21:00:00.000Z', '2026-10-25T22:00:00.000Z'],
  ])('calculează corect intervalul UTC pentru %s', (dateKey, startIso, endIso) => {
    expect(getBucharestDayUtcRange(dateKey)).toEqual({ startIso, endIso })
  })
})
