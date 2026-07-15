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
  it('afișează numele lung pe maximum două rânduri în Comenzi', () => {
    const longNameOrder = {
      ...order,
      customer_name: 'Mariana Savin-Giosan cu un nume foarte lung',
    }
    render(<UnifiedOrderCard item={mapShopToUnified(longNameOrder)} variant="comenzi" />)

    expect(screen.getByText(longNameOrder.customer_name)).toHaveClass('line-clamp-2')
  })

  it('afișează fallback-ul de locație și expune editarea după expand', async () => {
    const user = userEvent.setup()
    const onEdit = vi.fn()
    const withoutAddress = mapShopToUnified({
      ...order,
      delivery_address: null,
      delivery_city: null,
      delivery_zone: null,
    })

    render(
      <UnifiedOrderCard item={withoutAddress} variant="comenzi" onEdit={onEdit} />,
    )

    expect(screen.getByText('Necunoscută')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Arată detaliile comenzii pentru Maria Popescu' }))
    await user.click(screen.getByRole('button', { name: 'Editează comanda pentru Maria Popescu' }))
    expect(onEdit).toHaveBeenCalledWith(order.id, 'shop')
  })

  it('nu afișează badge-ul de status în varianta Comenzi', () => {
    const { container } = render(
      <UnifiedOrderCard item={mapShopToUnified(order)} variant="comenzi" />,
    )

    expect(container.querySelector('[data-testid="order-status-pill"]')).not.toBeInTheDocument()
  })

  it('afișează detaliile și acțiunile Comenzi doar după expand', async () => {
    const user = userEvent.setup()
    const onStatusChange = vi.fn()
    const onEdit = vi.fn()
    const manualOrder: Comanda = {
      id: 'manual-duplicate-phone',
      tenant_id: 'tenant',
      client_id: null,
      client_nume_manual: 'Ana Ionescu',
      telefon: '0740 123 456',
      locatie_livrare: 'Suceava',
      data_comanda: '2026-07-13',
      data_livrare: '2026-07-14',
      cantitate_kg: 2.5,
      pret_per_kg: 40,
      total: 100,
      status: 'confirmata',
      observatii: 'Sună înainte cu 15 minute',
      linked_vanzare_id: null,
      parent_comanda_id: null,
      created_at: '2026-07-13T08:00:00.000Z',
      updated_at: '2026-07-13T08:00:00.000Z',
      data_origin: 'magazin_public',
      dup_phone_warning: 'Maria Popescu',
      last_call_status: null,
    }

    render(
      <UnifiedOrderCard
        item={mapB2bToUnified(manualOrder, {})}
        variant="comenzi"
        comenziMode="active"
        onB2bStatusChange={onStatusChange}
        onB2bDeliveryDateChange={() => undefined}
        onEdit={onEdit}
      />,
    )

    expect(screen.getByRole('button', { name: 'Arată detaliile comenzii pentru Ana Ionescu' })).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByText('Programat pt 14 iul.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Programează' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Arată detaliile comenzii pentru Ana Ionescu' }))

    expect(screen.getByText('Același telefon ca „Maria Popescu” — verifică dacă e duplicat')).toBeInTheDocument()
    expect(screen.getByText('Cantitate')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Programează' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'În livrare' })).toBeInTheDocument()
    const livratButton = screen.getByRole('button', { name: 'Livrat' })
    expect(livratButton).toHaveClass('bg-[var(--success-solid)]')
    expect(screen.getByRole('button', { name: 'Anulează' })).toBeInTheDocument()
    expect(screen.getByText('Observații')).toBeInTheDocument()
    expect(screen.getByText('Sună înainte cu 15 minute')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Editează comanda pentru Ana Ionescu' }))
    expect(onEdit).toHaveBeenCalledWith(manualOrder.id, 'manual')
    await user.click(screen.getByRole('button', { name: 'În livrare' }))
    expect(onStatusChange).toHaveBeenCalledWith(manualOrder.id, 'in_livrare')
    await user.click(livratButton)
    expect(onStatusChange).toHaveBeenCalledWith(manualOrder.id, 'livrata')
    await user.click(screen.getByRole('button', { name: 'Anulează' }))
    expect(screen.getByRole('button', { name: 'Da, anulează' })).toBeInTheDocument()
  })

  it('păstrează badge-ul de status în varianta Livrări', () => {
    const { container } = render(
      <UnifiedOrderCard item={mapShopToUnified(order)} variant="livrari" />,
    )

    expect(container.querySelector('[data-testid="order-status-pill"]')).toHaveTextContent('În livrare')
  })

  it('reduce cardul la poziție, nume și localitate în modul de reordonare', () => {
    render(
      <UnifiedOrderCard
        item={mapShopToUnified(order)}
        variant="livrari"
        reorderPosition={2}
      />,
    )

    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('Maria Popescu')).toBeInTheDocument()
    expect(screen.getByText('Suceava')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Sună' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Livrat' })).not.toBeInTheDocument()
  })

  it('expune Sună, N-a răspuns și Livrat direct în Livrări', async () => {
    const user = userEvent.setup()
    const onCallStatusChange = vi.fn()
    const onStatusChange = vi.fn()
    const manualOrder: Comanda = {
      id: 'manual-delivery-actions',
      tenant_id: 'tenant',
      client_id: null,
      client_nume_manual: 'Ioana Popescu',
      telefon: '0740 555 555',
      locatie_livrare: 'Suceava',
      data_comanda: '2026-07-13',
      data_livrare: '2026-07-13',
      cantitate_kg: 1,
      pret_per_kg: 40,
      total: 40,
      status: 'in_livrare',
      observatii: null,
      linked_vanzare_id: null,
      parent_comanda_id: null,
      created_at: '2026-07-13T08:00:00.000Z',
      updated_at: '2026-07-13T08:00:00.000Z',
      data_origin: null,
      dup_phone_warning: null,
      last_call_status: null,
    }

    render(
      <UnifiedOrderCard
        item={mapB2bToUnified(manualOrder, {})}
        variant="livrari"
        onB2bStatusChange={onStatusChange}
        onCallStatusChange={onCallStatusChange}
      />,
    )

    expect(screen.getByRole('link', { name: 'Sună' })).toHaveAttribute('href', 'tel:0740555555')
    await user.click(screen.getByRole('button', { name: 'N-a răspuns' }))
    expect(onCallStatusChange).toHaveBeenCalledWith(manualOrder.id, 'no_answer')
    await user.click(screen.getByRole('button', { name: 'Livrat' }))
    expect(onStatusChange).toHaveBeenCalledWith(manualOrder.id, 'livrata')
  })

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

  it('afișează telefonul apelabil direct și deschide body-ul la tap pe header', async () => {
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
    expect(screen.getByRole('link', { name: '0740 123 456' })).toHaveAttribute(
      'href',
      'tel:0740123456',
    )

    await user.click(header)

    expect(
      screen.getByRole('button', { name: 'Ascunde detaliile comenzii pentru Maria Popescu' }),
    ).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('link', { name: '0740 123 456' })).toBeVisible()
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
    ['noua', ['Confirmată', 'Anulată', 'Livrată'], ['În livrare']],
    ['confirmata', ['În livrare', 'Anulată', 'Livrată'], ['Confirmată']],
    ['in_livrare', ['Programată', 'Livrată'], ['Anulată']],
  ] as const)(
    'afișează doar tranzițiile valide pentru statusul %s',
    async (status, expected, absent) => {
      const user = userEvent.setup()
      const manualOrder: Comanda = {
        id: `manual-${status}`,
        tenant_id: 'tenant',
        client_id: null,
        client_nume_manual: 'Ion Popescu',
        telefon: '0712 345 678',
        locatie_livrare: 'Suceava',
        data_comanda: '2026-06-10',
        data_livrare: '2026-06-12',
        cantitate_kg: 5,
        pret_per_kg: 40,
        total: 200,
        status,
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
          onB2bStatusChange={() => undefined}
          onB2bDeliveryDateChange={() => undefined}
        />,
      )

      await user.click(
        screen.getByRole('button', {
          name: `Arată detaliile comenzii pentru ${manualOrder.client_nume_manual}`,
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

  it('deschide WhatsApp numai după schimbarea cu succes a statusului shop', async () => {
    const user = userEvent.setup()
    const calls: string[] = []
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => {
      calls.push('whatsapp')
      return null
    })
    const onShopStatusChange = vi.fn(() => { calls.push('status') })

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

    expect(calls).toEqual(['status', 'whatsapp'])
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

  it('afișează plata neîncasată și permite marcarea ei ca încasată', async () => {
    const user = userEvent.setup()
    const onMarkPaid = vi.fn().mockResolvedValue(undefined)
    const manualOrder: Comanda = {
      id: 'manual-unpaid',
      tenant_id: 'tenant',
      client_id: null,
      client_nume_manual: 'Client neîncasat',
      telefon: '0712 345 678',
      locatie_livrare: 'Suceava',
      data_comanda: '2026-06-10',
      data_livrare: '2026-06-12',
      cantitate_kg: 5,
      pret_per_kg: 40,
      total: 200,
      status: 'livrata',
      observatii: null,
      linked_vanzare_id: 'sale-unpaid',
      linked_vanzare: {
        status_plata: 'neplatit',
        data_incasare: null,
      },
      parent_comanda_id: null,
      created_at: '2026-06-10T08:00:00.000Z',
      updated_at: '2026-06-10T08:00:00.000Z',
      data_origin: null,
    }

    render(
      <UnifiedOrderCard
        item={mapB2bToUnified(manualOrder, {})}
        onMarkPaid={onMarkPaid}
      />,
    )

    expect(screen.getByText('Neplătit')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Marchează încasat' }))
    expect(onMarkPaid).toHaveBeenCalledWith(manualOrder.id)
  })

  it('folosește aceleași tranziții și WhatsApp pentru comanda manuală', async () => {
    const user = userEvent.setup()
    const calls: string[] = []
    const onB2bStatusChange = vi.fn(async () => {
      calls.push('status')
    })
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => {
      calls.push('whatsapp')
      return null
    })
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
    expect(calls).toEqual(['status', 'whatsapp'])
    openSpy.mockRestore()
  })

  it('nu deschide WhatsApp când schimbarea statusului manual eșuează', async () => {
    const user = userEvent.setup()
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null)
    const manualOrder: Comanda = {
      id: 'manual-stock-error',
      tenant_id: 'tenant',
      client_id: null,
      client_nume_manual: 'Ion Popescu',
      telefon: '0712 345 678',
      locatie_livrare: 'Suceava',
      data_comanda: '2026-06-10',
      data_livrare: '2026-06-12',
      cantitate_kg: 50,
      pret_per_kg: 40,
      total: 2000,
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
        onB2bStatusChange={vi.fn().mockRejectedValue(new Error('STOC_INSUFICIENT'))}
      />,
    )

    await user.click(
      screen.getByRole('button', {
        name: `Arată detaliile comenzii pentru ${manualOrder.client_nume_manual}`,
      }),
    )
    await user.click(screen.getByRole('button', { name: 'Schimbă statusul comenzii' }))
    await user.click(screen.getByRole('button', { name: 'În livrare' }))

    expect(openSpy).not.toHaveBeenCalled()
    openSpy.mockRestore()
  })

  it('grupează shop orders cronologic folosind delivery_date sau fallback pe created_at', () => {
    const groups = groupShopOrdersByDeliveryDate([
      { ...order, id: 'scheduled-late', delivery_date: '2026-06-20', created_at: '2026-06-11T08:00:00Z' },
      { ...order, id: 'unscheduled', delivery_date: null, created_at: '2026-06-12T08:00:00Z' },
      { ...order, id: 'scheduled-early-new', delivery_date: '2026-06-15', created_at: '2026-06-11T08:00:00Z' },
      { ...order, id: 'scheduled-early-old', delivery_date: '2026-06-15', created_at: '2026-06-10T08:00:00Z' },
      { ...order, id: 'cancelled', status: 'anulata' },
      { ...order, id: 'standard', order_kind: 'standard' },
    ])

    expect(groups.map((group) => group.date)).toEqual([
      '2026-06-10',
      '2026-06-12',
      '2026-06-15',
      '2026-06-20',
    ])
    expect(groups[2].orders.map((entry) => entry.id)).toEqual([
      'scheduled-early-old',
      'scheduled-early-new',
    ])
    expect(groups[2].totalQty).toBe(4)
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

  it('grupează comenzile fără data livrării după fallback-ul de dată efectivă', () => {
    const groups = groupAllOrdersByDeliveryDate(
      [
        mapShopToUnified({ ...order, id: 'unscheduled', delivery_date: null }),
        mapShopToUnified({ ...order, id: 'scheduled', delivery_date: '2026-06-15' }),
      ],
      'delivery_date',
    )

    expect(groups.map((group) => group.date)).toEqual(['2026-06-10', '2026-06-15'])
  })

  it('formatează data completă din header în fusul Europe/Bucharest', () => {
    expect(formatOrderDateTime('2026-06-14T09:22:00.000Z')).toBe('14 iun · 12:22')
  })
})
