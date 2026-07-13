import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { EditOrderSheet } from '@/components/comenzi/EditOrderSheet'
import { mapB2bToUnified, mapShopToUnified } from '@/lib/comenzi/unified-orders'
import type { ShopOrderRow } from '@/lib/shop/b2c-order-helpers'
import type { Comanda } from '@/lib/supabase/queries/comenzi'

const { updateComandaMock, toastSuccessMock } = vi.hoisted(() => ({
  updateComandaMock: vi.fn(),
  toastSuccessMock: vi.fn(),
}))

vi.mock('@/hooks/useMediaQuery', () => ({
  useMediaQuery: () => false,
}))

vi.mock('@/lib/supabase/queries/comenzi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/supabase/queries/comenzi')>()
  return {
    ...actual,
    updateComanda: updateComandaMock,
  }
})

vi.mock('@/lib/ui/toast', () => ({
  toast: {
    error: vi.fn(),
    success: toastSuccessMock,
  },
}))

const manualOrder: Comanda = {
  id: 'manual-order',
  tenant_id: 'tenant',
  client_id: null,
  client_nume_manual: 'Ion Popescu',
  telefon: '0712 345 678',
  locatie_livrare: 'Suceava, Str. Florilor 10',
  data_comanda: '2026-06-10',
  data_livrare: '2026-06-15',
  cantitate_kg: 5,
  pret_per_kg: 40,
  total: 200,
  status: 'confirmata',
  observatii: 'Sună înainte',
  linked_vanzare_id: null,
  parent_comanda_id: null,
  created_at: '2026-06-10T08:00:00.000Z',
  updated_at: '2026-06-10T08:00:00.000Z',
  data_origin: null,
}

const shopOrder: ShopOrderRow = {
  id: '00000000-0000-4000-8000-000000000101',
  created_at: '2026-06-10T08:00:00.000Z',
  customer_name: 'Maria Popescu',
  customer_phone: '0740 123 456',
  delivery_mode: 'livrare',
  delivery_city: 'Suceava',
  delivery_address: 'Str. Unirii 12',
  delivery_date: '2026-06-15',
  delivery_position: 1,
  order_kind: 'preorder',
  items: [{ vid: 'zmeura', label: 'Caserolă', qty: 2, price_lei: 20 }],
  total_lei: 40,
  notes: 'Sună înainte',
  status: 'confirmata',
  notified_wa: false,
}

describe('EditOrderSheet', () => {
  it('precompletează și salvează toate câmpurile editabile pentru comanda manuală', async () => {
    const user = userEvent.setup()
    const onSaved = vi.fn()
    updateComandaMock.mockResolvedValue(manualOrder)

    render(
      <EditOrderSheet
        open
        order={mapB2bToUnified(manualOrder, {})}
        clienti={[]}
        onOpenChange={() => undefined}
        onSaved={onSaved}
      />,
    )

    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByRole('textbox', { name: 'Client' })).toHaveValue('Ion Popescu')
    expect(within(dialog).getByRole('textbox', { name: 'Telefon' })).toHaveValue('0712 345 678')
    expect(within(dialog).getByRole('textbox', { name: 'Adresă livrare' })).toHaveValue(
      'Suceava, Str. Florilor 10',
    )
    expect(within(dialog).queryByRole('button', { name: 'Suceava' })).not.toBeInTheDocument()

    const quantity = within(dialog).getByRole('spinbutton', { name: 'Cantitate (kg)' })
    const price = within(dialog).getByRole('spinbutton', { name: 'Preț (lei/kg)' })
    await user.click(quantity)
    fireEvent.change(quantity, { target: { value: '6.5' } })
    fireEvent.change(price, { target: { value: '42' } })
    await waitFor(() =>
      expect(within(dialog).getByText('Total calculat').parentElement).toHaveTextContent('273 lei'),
    )

    await user.click(within(dialog).getByRole('button', { name: 'Salvează' }))

    await waitFor(() =>
      expect(updateComandaMock).toHaveBeenCalledWith(
        manualOrder.id,
        expect.objectContaining({
          client_nume_manual: 'Ion Popescu',
          telefon: '0712345678',
          locatie_livrare: 'Suceava, Str. Florilor 10',
          data_livrare: '2026-06-15',
          cantitate_kg: 6.5,
          pret_per_kg: 42,
          status: 'confirmata',
          observatii: 'Sună înainte',
        }),
      ),
    )
    expect(toastSuccessMock).toHaveBeenCalledWith('Comanda a fost actualizată.')
    expect(onSaved).toHaveBeenCalled()
  })

  it('folosește același câmp liber de adresă pentru comenzile Shop', () => {
    render(
      <EditOrderSheet
        open
        order={mapShopToUnified(shopOrder)}
        clienti={[]}
        onOpenChange={() => undefined}
        onSaved={() => undefined}
      />,
    )

    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByRole('textbox', { name: 'Client' })).toHaveValue('Maria Popescu')
    expect(within(dialog).getByRole('textbox', { name: 'Telefon' })).toHaveValue('0740 123 456')
    expect(within(dialog).getByRole('textbox', { name: 'Adresă livrare' })).toHaveValue(
      'Suceava, Str. Unirii 12',
    )
    expect(within(dialog).queryByRole('button', { name: 'Suceava' })).not.toBeInTheDocument()
    expect(within(dialog).getByLabelText('Observații')).toHaveValue('Sună înainte')
  })
})
