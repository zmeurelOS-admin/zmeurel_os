import { describe, expect, it } from 'vitest'

import { getBadgeColor, getCustomerLabel } from '@/lib/shop/customer-labels'

describe('shop customer labels', () => {
  it('marcheaza VIP pentru 5+ comenzi', () => {
    expect(getCustomerLabel({ order_count: 5, total_value_lei: 120 })).toBe('VIP')
  })

  it('marcheaza VIP pentru valoare totala de cel putin 500 lei', () => {
    expect(getCustomerLabel({ order_count: 2, total_value_lei: 500 })).toBe('VIP')
  })

  it('marcheaza Fidel pentru 2-4 comenzi sub pragul VIP', () => {
    expect(getCustomerLabel({ order_count: 3, total_value_lei: 220 })).toBe('Fidel')
  })

  it('marcheaza Nou pentru prima comanda', () => {
    expect(getCustomerLabel({ order_count: 1, total_value_lei: 40 })).toBe('Nou')
  })

  it('returneaza clase Tailwind pentru badge', () => {
    expect(getBadgeColor('VIP')).toContain('amber')
    expect(getBadgeColor('Fidel')).toContain('emerald')
    expect(getBadgeColor('Nou')).toContain('slate')
  })
})
