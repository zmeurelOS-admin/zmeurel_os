import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { LivrariPageClient } from '@/app/(dashboard)/livrari/LivrariPageClient'
import type { ShopOrderRow } from '@/lib/shop/b2c-order-helpers'
import type { Comanda } from '@/lib/supabase/queries/comenzi'

const {
  fetchManualOrdersMock,
  fetchOrdersMock,
  fetchScheduledMock,
  toastErrorMock,
  toastSuccessMock,
} = vi.hoisted(() => ({
  fetchManualOrdersMock: vi.fn<() => Promise<Comanda[]>>(),
  fetchOrdersMock: vi.fn<() => Promise<ShopOrderRow[]>>(),
  fetchScheduledMock: vi.fn<() => Promise<ShopOrderRow[]>>(),
  toastErrorMock: vi.fn(),
  toastSuccessMock: vi.fn(),
}))

vi.mock('@/components/app/AppShell', () => ({
  AppShell: ({ header, children }: { header: ReactNode; children: ReactNode }) => (
    <div>
      <header>{header}</header>
      <main>{children}</main>
    </div>
  ),
}))

vi.mock('@/components/app/DashboardAuthContext', () => ({
  useDashboardAuth: () => ({ tenantId: '00000000-0000-4000-8000-000000000301' }),
}))

vi.mock('@/lib/shop/shop-orders-queries', () => ({
  fetchShopOrdersInLivrare: fetchOrdersMock,
  fetchShopOrdersScheduledToday: fetchScheduledMock,
}))

vi.mock('@/lib/supabase/queries/clienti', () => ({
  getClienți: vi.fn().mockResolvedValue([]),
}))

vi.mock('@/lib/supabase/queries/comenzi', () => ({
  fetchComenziManualInLivrare: fetchManualOrdersMock,
}))

vi.mock('@/lib/ui/toast', () => ({
  toast: {
    error: toastErrorMock,
    info: vi.fn(),
    success: toastSuccessMock,
  },
}))

const order: ShopOrderRow = {
  id: '00000000-0000-4000-8000-000000000101',
  created_at: '2026-06-07T08:00:00.000Z',
  customer_name: 'Maria Popescu',
  customer_phone: '0740 123 456',
  delivery_mode: 'livrare',
  delivery_address: 'Strada Florilor 10, Suceava',
  delivery_date: '2026-06-07',
  delivery_position: 1,
  items: [
    {
      vid: 'afine-300',
      label: 'Caserolă 300 g',
      qty: 2,
      price_lei: 10,
    },
  ],
  total_lei: 20,
  notes: null,
  status: 'in_livrare',
  notified_wa: true,
  milestone_reward: {
    reward_label: 'O caserolă bonus',
    status: 'pending',
  },
}

const secondOrder: ShopOrderRow = {
  ...order,
  id: '00000000-0000-4000-8000-000000000102',
  customer_name: 'Ion Ionescu',
  customer_phone: '0740 654 321',
  delivery_address: 'Strada Livezilor 2, Suceava',
  delivery_position: 2,
}

const scheduledOrder: ShopOrderRow = {
  ...order,
  id: '00000000-0000-4000-8000-000000000103',
  customer_name: 'Ana Programată',
  status: 'confirmata',
  delivery_position: null,
}

const manualOrder: Comanda = {
  id: '00000000-0000-4000-8000-000000000201',
  tenant_id: '00000000-0000-4000-8000-000000000301',
  client_id: null,
  client_nume_manual: 'Client Manual',
  telefon: '0722 000 111',
  locatie_livrare: 'Sat Demo 1',
  data_comanda: '2026-06-07',
  data_livrare: '2026-06-07',
  cantitate_kg: 3,
  pret_per_kg: 12,
  total: 36,
  status: 'in_livrare',
  observatii: '3 kg afine',
  linked_vanzare_id: null,
  parent_comanda_id: null,
  created_at: '2026-06-07T07:00:00.000Z',
  updated_at: '2026-06-07T07:00:00.000Z',
  data_origin: null,
  client_nume: null,
}

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <LivrariPageClient />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  fetchManualOrdersMock.mockReset()
  fetchManualOrdersMock.mockResolvedValue([])
  fetchOrdersMock.mockReset()
  fetchOrdersMock.mockResolvedValue([order])
  fetchScheduledMock.mockReset()
  fetchScheduledMock.mockResolvedValue([])
  toastErrorMock.mockReset()
  toastSuccessMock.mockReset()
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: true,
      json: async () => ({ success: true }),
    })),
  )
})

describe('LivrariPageClient', () => {
  it('afișează adresa, reorder-ul mare și acțiunile de teren', async () => {
    const user = userEvent.setup()
    renderPage()

    expect(await screen.findByText('Strada Florilor 10, Suceava')).toBeInTheDocument()
    expect(screen.getByText('⚠️ Include bonus: O caserolă bonus')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Reordonează livrarea 1' }))
    expect(screen.getByRole('button', { name: /Sus/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Jos/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Gata/ })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Gata/ }))
    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/shop/b2c/orders/reorder',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ order_ids: [order.id] }),
        }),
      ),
    )
    await waitFor(() =>
      expect(toastSuccessMock).toHaveBeenCalledWith('Ordinea livrărilor a fost salvată'),
    )
    await user.click(screen.getByRole('button', { name: /Maria Popescu/ }))

    expect(screen.getByRole('link', { name: 'Apel' })).toHaveAttribute('href', 'tel:0740123456')
    expect(screen.getByRole('link', { name: 'WhatsApp' })).toHaveAttribute(
      'href',
      expect.stringContaining('https://wa.me/40740123456?text='),
    )
    expect(screen.getByRole('link', { name: 'Navigare' })).toHaveAttribute(
      'href',
      'https://www.google.com/maps/dir/?api=1&destination=Strada%20Florilor%2010%2C%20Suceava',
    )
  })

  it('confirmă statusul livrat și mută cardul în secțiunea Livrate', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('button', { name: /Maria Popescu/ }))
    await user.click(screen.getByRole('button', { name: /Marchează livrat/ }))

    expect(screen.getByRole('heading', { name: 'Marchezi comanda ca livrată?' })).toBeInTheDocument()
    expect(
      screen.getByText(/creează venitul în Vânzări și scade din stoc/),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Da, marchează livrat' }))

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1))
    expect(JSON.parse(String(vi.mocked(global.fetch).mock.calls[0]?.[1]?.body))).toEqual({
      status: 'livrata',
      status_plata: 'platit',
    })
    expect(await screen.findByText('Livrate (1)')).toBeInTheDocument()
    expect(toastSuccessMock).toHaveBeenCalledWith('Comandă livrată')
  })

  it('trimite plata neîncasată la livrarea din shop', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(
      await screen.findByRole('button', {
        name: 'Arată detaliile comenzii pentru Maria Popescu',
      }),
    )
    await user.click(screen.getByRole('button', { name: 'Schimbă statusul comenzii' }))
    await user.click(screen.getByRole('button', { name: 'Livrată' }))
    await user.click(screen.getByRole('radio', { name: 'Neplătit' }))
    await user.click(screen.getByRole('button', { name: 'Da, marchează livrat' }))

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1))
    expect(JSON.parse(String(vi.mocked(global.fetch).mock.calls[0]?.[1]?.body))).toEqual({
      status: 'livrata',
      status_plata: 'neplatit',
    })
  })

  it('restaurează comanda și totalul când livrarea atomică eșuează', async () => {
    const user = userEvent.setup()
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ success: false, error: 'Stoc insuficient pentru livrare.' }),
    } as Response)
    renderPage()

    await user.click(await screen.findByRole('button', { name: /Maria Popescu/ }))
    await user.click(screen.getByRole('button', { name: /Marchează livrat/ }))
    await user.click(screen.getByRole('button', { name: 'Da, marchează livrat' }))

    await waitFor(() =>
      expect(toastErrorMock).toHaveBeenCalledWith('Stoc insuficient pentru livrare.'),
    )
    expect(screen.getByText('Maria Popescu')).toBeInTheDocument()
    expect(screen.getByText('1.0 kg shop · 20 lei')).toBeInTheDocument()
    expect(screen.queryByText('Livrate (1)')).not.toBeInTheDocument()
  })

  it('recalculează totalul și persistă editarea comenzii', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('button', { name: /Maria Popescu/ }))
    await user.click(screen.getByRole('button', { name: 'Editează' }))

    expect(screen.getByRole('heading', { name: 'Editează comanda' })).toBeInTheDocument()
    const editDialog = screen.getByRole('dialog')
    expect(within(editDialog).getByText('20 lei')).toBeInTheDocument()

    const quantityInput = within(editDialog).getByRole('spinbutton', {
      name: 'Cantitate (caserole)',
    })
    await user.clear(quantityInput)
    await user.type(quantityInput, '3')

    expect(within(editDialog).getByText('30 lei')).toBeInTheDocument()
    await user.click(within(editDialog).getByRole('button', { name: 'Salvează' }))

    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith(
        `/api/shop/b2c/orders/${order.id}`,
        expect.objectContaining({
          method: 'PATCH',
        }),
      ),
    )
    const patchOptions = vi.mocked(global.fetch).mock.calls.find(
      ([url]) => url === `/api/shop/b2c/orders/${order.id}`,
    )?.[1]
    expect(JSON.parse(String(patchOptions?.body))).toEqual({
      items: [{ vid: 'afine-300', label: 'Caserolă 300 g', qty: 3, price_lei: 10 }],
    })
    expect(toastSuccessMock).toHaveBeenCalledWith('Comanda a fost actualizată.')
  })

  it('revine la ordinea anterioară când persistarea reorder-ului eșuează', async () => {
    const user = userEvent.setup()
    fetchOrdersMock.mockResolvedValue([order, secondOrder])
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ success: false, error: 'Ordinea nu a putut fi salvată.' }),
    } as Response)
    renderPage()

    await user.click(await screen.findByRole('button', { name: 'Reordonează livrarea 2' }))
    await user.click(screen.getByRole('button', { name: /Sus/ }))
    expect(screen.getByText('Ion Ionescu').closest('article')).toHaveTextContent('1')

    await user.click(screen.getByRole('button', { name: /Gata/ }))

    await waitFor(() =>
      expect(toastErrorMock).toHaveBeenCalledWith('Ordinea nu a putut fi salvată.'),
    )
    expect(screen.getByText('Ion Ionescu').closest('article')).toHaveTextContent('2')
  })

  it('afișează și extinde comenzile programate azi care nu sunt încă în livrare', async () => {
    const user = userEvent.setup()
    fetchScheduledMock.mockResolvedValue([scheduledOrder])
    renderPage()

    const banner = await screen.findByRole('button', {
      name: /1 comandă programată pentru azi — nu este încă în livrare/i,
    })
    expect(screen.queryByText('Ana Programată')).not.toBeInTheDocument()

    await user.click(banner)

    expect(screen.getByText('Ana Programată')).toBeInTheDocument()
    expect(screen.getAllByText('Caserolă 300 g × 2')).toHaveLength(2)
  })

  it('afișează comenzile manuale în listă fără acțiunile rezervate shop-ului', async () => {
    const user = userEvent.setup()
    fetchOrdersMock.mockResolvedValue([])
    fetchManualOrdersMock.mockResolvedValue([manualOrder])
    renderPage()

    expect(await screen.findByText('Client Manual')).toBeInTheDocument()
    expect(screen.getByText('3.0 kg clienți · 36 lei')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Reordonează livrarea 1' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Client Manual/ }))

    expect(screen.getByText('3 kg afine')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Apel' })).toHaveAttribute('href', 'tel:0722000111')
    expect(screen.getByRole('button', { name: 'Editează' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Marchează livrat/ })).toBeInTheDocument()
  })
})
