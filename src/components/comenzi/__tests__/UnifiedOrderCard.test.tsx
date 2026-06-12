import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { UnifiedOrderCard } from '@/components/comenzi/UnifiedOrderCard'
import { mapB2bToUnified, mapShopToUnified } from '@/lib/comenzi/unified-orders'
import type { ShopOrderRow } from '@/lib/shop/b2c-order-helpers'
import type { Comanda } from '@/lib/supabase/queries/comenzi'

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

  it('grupează controalele shop distincte sub blocul Status', () => {
    render(<UnifiedOrderCard item={mapShopToUnified(order)} />)

    expect(screen.getByText('Status')).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Schimbă statusul comenzii' })).toHaveValue('in_livrare')
    expect(screen.getByRole('checkbox', { name: 'Confirmat' })).toBeChecked()
  })

  it('afișează fallback-ul manual din cantitate, preț/kg și total', () => {
    const manualOrder: Comanda = {
      id: '00000000-0000-4000-8000-000000000102',
      tenant_id: '00000000-0000-4000-8000-000000000103',
      client_id: null,
      client_nume_manual: 'Ion Popescu',
      telefon: '0712 345 678',
      locatie_livrare: 'Suceava',
      data_comanda: '2026-06-10',
      data_livrare: '2026-06-12',
      cantitate_kg: 35,
      pret_per_kg: 3.5,
      total: 122.5,
      status: 'confirmata',
      observatii: null,
      linked_vanzare_id: null,
      parent_comanda_id: null,
      created_at: '2026-06-10T08:00:00.000Z',
      updated_at: '2026-06-10T08:00:00.000Z',
      data_origin: null,
    }

    render(<UnifiedOrderCard item={mapB2bToUnified(manualOrder, {})} />)

    expect(screen.getByText('35 kg · 3,50 lei/kg · Total 122,50 lei')).toBeInTheDocument()
    expect(screen.getByText('✏️ Manual')).toBeInTheDocument()
    expect(screen.queryByRole('checkbox', { name: 'Confirmat' })).not.toBeInTheDocument()
  })
})
