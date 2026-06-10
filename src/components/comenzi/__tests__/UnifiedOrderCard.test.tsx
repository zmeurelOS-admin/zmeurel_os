import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { UnifiedOrderCard } from '@/components/comenzi/UnifiedOrderCard'
import { mapShopToUnified } from '@/lib/comenzi/unified-orders'
import type { ShopOrderRow } from '@/lib/shop/b2c-order-helpers'

const order: ShopOrderRow = {
  id: '00000000-0000-4000-8000-000000000101',
  created_at: '2026-06-10T08:00:00.000Z',
  customer_name: 'Maria Popescu',
  customer_phone: '0740 123 456',
  delivery_mode: 'livrare',
  delivery_address: 'Suceava',
  delivery_date: '2026-06-10',
  delivery_position: 1,
  items: [{ vid: 'zmeura', label: 'Caserolă', qty: 2 }],
  total_lei: 35,
  notes: null,
  status: 'in_livrare',
  notified_wa: true,
  milestone_reward: {
    reward_label: 'O caserolă bonus',
    status: 'pending',
  },
}

describe('UnifiedOrderCard', () => {
  it('afișează reward-ul shop ca badge read-only', () => {
    render(<UnifiedOrderCard item={mapShopToUnified(order)} />)

    expect(screen.getByText('🎁 O caserolă bonus')).toBeInTheDocument()
    expect(screen.getByText('Bonus la livrare')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /bonus/i })).not.toBeInTheDocument()
  })
})
