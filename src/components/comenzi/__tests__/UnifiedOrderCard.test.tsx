import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { UnifiedOrderCard } from '@/components/comenzi/UnifiedOrderCard'
import {
  groupAllOrdersByDeliveryDate,
  groupShopOrdersByDeliveryDate,
  formatOrderDateTime,
  mapB2bToUnified,
  mapShopToUnified,
} from '@/lib/comenzi/unified-orders'
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
  order_kind: 'preorder',
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
  it('afișează reward-ul shop ca badge read-only', async () => {
    const user = userEvent.setup()
    render(<UnifiedOrderCard item={mapShopToUnified(order)} compact />)

    await user.click(
      screen.getByRole('button', {
        name: 'Arată detaliile comenzii pentru Maria Popescu',
      }),
    )

    expect(screen.getByText('0,5 kg bonus')).toBeInTheDocument()
    expect(screen.getByText('Bonus la livrare')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /bonus/i })).not.toBeInTheDocument()
  })

  it('afișează cardul shop collapsed implicit și deschide body-ul la tap pe header', async () => {
    const user = userEvent.setup()
    render(
      <UnifiedOrderCard
        item={mapShopToUnified(order)}
        onShopDeliveryDateChange={() => undefined}
      />,
    )

    const header = screen.getByRole('button', {
      name: 'Arată detaliile comenzii pentru Maria Popescu',
    })
    expect(header).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByText('0740 123 456').closest('[aria-hidden]')).toHaveAttribute(
      'aria-hidden',
      'true',
    )

    await user.click(header)

    expect(
      screen.getByRole('button', { name: 'Ascunde detaliile comenzii pentru Maria Popescu' }),
    ).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('0740 123 456').closest('[aria-hidden]')).toHaveAttribute(
      'aria-hidden',
      'false',
    )
  })

  it('expune acțiunea de editare pentru comenzile shop', async () => {
    const user = userEvent.setup()
    const onEdit = vi.fn()
    render(<UnifiedOrderCard item={mapShopToUnified(order)} onEdit={onEdit} />)

    await user.click(screen.getByRole('button', { name: /Arată detaliile/ }))
    await user.click(screen.getByRole('button', { name: '✏ Editează' }))

    expect(onEdit).toHaveBeenCalledWith(order.id, 'shop')
  })

  it.each([
    ['noua', ['Confirmată', 'Anulată'], ['În livrare', 'Livrată']],
    ['confirmata', ['În livrare', 'Anulată'], ['Confirmată', 'Livrată']],
    ['in_livrare', ['Confirmată', 'Livrată'], ['Anulată']],
  ] as const)(
    'afișează doar tranzițiile valide pentru statusul %s',
    async (status, expected, absent) => {
      const user = userEvent.setup()
      render(
        <UnifiedOrderCard
          item={mapShopToUnified({ ...order, status })}
          onShopStatusChange={() => undefined}
          onShopDeliveryDateChange={() => undefined}
        />,
      )

      await user.click(
        screen.getByRole('button', {
          name: `Arată detaliile comenzii pentru ${order.customer_name}`,
        }),
      )
      await user.click(screen.getByRole('button', { name: 'Schimbă statusul comenzii' }))

      for (const label of expected) {
        expect(screen.getByRole('button', { name: label })).toBeInTheDocument()
      }
      for (const label of absent) {
        expect(screen.queryByRole('button', { name: label })).not.toBeInTheDocument()
      }
    },
  )

  it.each(['livrata', 'anulata'] as const)(
    'nu afișează actions pentru status terminal %s',
    (status) => {
      render(
        <UnifiedOrderCard
          item={mapShopToUnified({ ...order, status })}
          onShopStatusChange={() => undefined}
          onShopDeliveryDateChange={() => undefined}
        />,
      )

      expect(
        screen.queryByRole('button', { name: 'Schimbă statusul comenzii' }),
      ).not.toBeInTheDocument()
    },
  )

  it('afișează indicator anunțat WA doar după expandare când notified_wa=true', async () => {
    const user = userEvent.setup()
    render(
      <UnifiedOrderCard
        item={mapShopToUnified(order)}
        onShopConfirmedChange={() => undefined}
      />,
    )

    expect(screen.getByText('✓ Anunțat WA').closest('[aria-hidden]')).toHaveAttribute(
      'aria-hidden',
      'true',
    )
    await user.click(
      screen.getByRole('button', {
        name: 'Arată detaliile comenzii pentru Maria Popescu',
      }),
    )
    expect(screen.getByText('✓ Anunțat WA').closest('[aria-hidden]')).toHaveAttribute(
      'aria-hidden',
      'false',
    )
    expect(screen.queryByRole('link', { name: 'WhatsApp' })).not.toBeInTheDocument()
    expect(screen.queryByRole('checkbox', { name: 'Confirmat' })).not.toBeInTheDocument()
  })

  it('afișează checkbox WhatsApp trimis doar după expandare când notified_wa=false', async () => {
    const user = userEvent.setup()
    render(
      <UnifiedOrderCard
        item={mapShopToUnified({ ...order, notified_wa: false })}
        onShopConfirmedChange={() => undefined}
      />,
    )

    expect(
      screen.queryByRole('checkbox', { name: 'WhatsApp trimis' }),
    ).not.toBeInTheDocument()
    await user.click(
      screen.getByRole('button', {
        name: 'Arată detaliile comenzii pentru Maria Popescu',
      }),
    )
    expect(screen.getByRole('checkbox', { name: 'WhatsApp trimis' })).not.toBeChecked()
    expect(screen.queryByText('✓ Anunțat WA')).not.toBeInTheDocument()
  })

  it('deschide WhatsApp înainte de schimbarea statusului în livrare', async () => {
    const user = userEvent.setup()
    const calls: string[] = []
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => {
      calls.push('whatsapp')
      return null
    })
    const onShopStatusChange = vi.fn(() => calls.push('status'))

    render(
      <UnifiedOrderCard
        item={mapShopToUnified({ ...order, status: 'confirmata' })}
        onShopStatusChange={onShopStatusChange}
      />,
    )

    await user.click(
      screen.getByRole('button', {
        name: `Arată detaliile comenzii pentru ${order.customer_name}`,
      }),
    )
    await user.click(screen.getByRole('button', { name: 'Schimbă statusul comenzii' }))
    await user.click(screen.getByRole('button', { name: 'În livrare' }))

    expect(calls).toEqual(['whatsapp', 'status'])
    expect(openSpy).toHaveBeenCalledWith(
      expect.stringContaining('https://wa.me/40740123456?text='),
      '_blank',
      'noopener,noreferrer',
    )
    expect(decodeURIComponent(String(openSpy.mock.calls[0][0]))).toContain(
      'Bună ziua, Maria! 🍓',
    )
    expect(onShopStatusChange).toHaveBeenCalledWith(order.id, 'in_livrare')
    openSpy.mockRestore()
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

    expect(screen.getByText('35 kg · 123 lei · Suceava')).toBeInTheDocument()
    expect(screen.getByText('Manual')).toBeInTheDocument()
    expect(screen.queryByRole('checkbox', { name: 'Confirmat' })).not.toBeInTheDocument()
  })

  it('folosește aceleași tranziții și WhatsApp pentru comanda manuală', async () => {
    const user = userEvent.setup()
    const onB2bStatusChange = vi.fn()
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null)
    const manualOrder: Comanda = {
      id: 'manual-wa',
      tenant_id: 'tenant',
      client_id: null,
      client_nume_manual: 'Ion Popescu',
      telefon: '0712 345 678',
      locatie_livrare: 'Suceava, Str. Florilor 10',
      data_comanda: '2026-06-10',
      data_livrare: '2026-06-12',
      cantitate_kg: 5,
      pret_per_kg: 40,
      total: 200,
      status: 'confirmata',
      observatii: null,
      linked_vanzare_id: null,
      parent_comanda_id: null,
      created_at: '2026-06-10T08:00:00.000Z',
      updated_at: '2026-06-10T08:00:00.000Z',
      data_origin: null,
    }

    render(
      <UnifiedOrderCard
        item={mapB2bToUnified(manualOrder, {})}
        onB2bStatusChange={onB2bStatusChange}
        onB2bDeliveryDateChange={() => undefined}
      />,
    )

    await user.click(
      screen.getByRole('button', {
        name: `Arată detaliile comenzii pentru ${manualOrder.client_nume_manual}`,
      }),
    )
    await user.click(screen.getByRole('button', { name: 'Schimbă statusul comenzii' }))
    await user.click(screen.getByRole('button', { name: 'În livrare' }))

    expect(openSpy).toHaveBeenCalledWith(
      expect.stringContaining('https://wa.me/40712345678?text='),
      '_blank',
      'noopener,noreferrer',
    )
    expect(decodeURIComponent(String(openSpy.mock.calls[0][0]))).toContain('5 kg')
    expect(onB2bStatusChange).toHaveBeenCalledWith('manual-wa', 'in_livrare')
    openSpy.mockRestore()
  })

  it('grupează precomenzile cu neprogramatele primele și zilele cronologic', () => {
    const groups = groupShopOrdersByDeliveryDate([
      { ...order, id: 'scheduled-late', delivery_date: '2026-06-20', created_at: '2026-06-11T08:00:00Z' },
      { ...order, id: 'unscheduled', delivery_date: null, created_at: '2026-06-12T08:00:00Z' },
      { ...order, id: 'scheduled-early-new', delivery_date: '2026-06-15', created_at: '2026-06-11T08:00:00Z' },
      { ...order, id: 'scheduled-early-old', delivery_date: '2026-06-15', created_at: '2026-06-10T08:00:00Z' },
      { ...order, id: 'cancelled', status: 'anulata' },
      { ...order, id: 'standard', order_kind: 'standard' },
    ])

    expect(groups.map((group) => group.date)).toEqual([null, '2026-06-15', '2026-06-20'])
    expect(groups[1].orders.map((entry) => entry.id)).toEqual([
      'scheduled-early-old',
      'scheduled-early-new',
    ])
    expect(groups[1].totalQty).toBe(4)
  })

  it('grupează împreună shop și manual și sortează localitățile pe zone', () => {
    const manualOrder: Comanda = {
      id: 'manual-order',
      tenant_id: 'tenant',
      client_id: null,
      client_nume_manual: 'Ion Popescu',
      telefon: '0712 345 678',
      locatie_livrare: 'Bosanci, Str. Mare 1',
      data_comanda: '2026-06-10',
      data_livrare: '2026-06-15',
      cantitate_kg: 5,
      pret_per_kg: 40,
      total: 200,
      status: 'confirmata',
      observatii: null,
      linked_vanzare_id: null,
      parent_comanda_id: null,
      created_at: '2026-06-10T07:00:00.000Z',
      updated_at: '2026-06-10T07:00:00.000Z',
      data_origin: null,
    }
    const groups = groupAllOrdersByDeliveryDate(
      [
        mapB2bToUnified(manualOrder, {}),
        mapShopToUnified({
          ...order,
          id: 'shop-suceava',
          delivery_city: 'Suceava',
          delivery_zone: 'zona1',
          delivery_date: '2026-06-15',
        }),
      ],
      'locality',
    )

    expect(groups.map((group) => group.date)).toEqual(['zone:zona1', 'zone:zona3'])
    expect(groups.flatMap((group) => group.orders.map((entry) => entry.id))).toEqual([
      'shop-suceava',
      'manual-order',
    ])
  })

  it('pune comenzile neprogramate la final când sortarea este după data livrării', () => {
    const groups = groupAllOrdersByDeliveryDate(
      [
        mapShopToUnified({ ...order, id: 'unscheduled', delivery_date: null }),
        mapShopToUnified({ ...order, id: 'scheduled', delivery_date: '2026-06-15' }),
      ],
      'delivery_date',
    )

    expect(groups.map((group) => group.date)).toEqual(['2026-06-15', null])
  })

  it('formatează data completă din header în fusul Europe/Bucharest', () => {
    expect(formatOrderDateTime('2026-06-14T09:22:00.000Z')).toBe('14 iun · 12:22')
  })
})
