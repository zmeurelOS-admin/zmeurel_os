import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { LivrariPageClient } from '@/app/(dashboard)/livrari/LivrariPageClient'
import type { ShopOrderRow } from '@/lib/shop/b2c-order-helpers'

const { fetchOrdersMock, toastErrorMock, toastSuccessMock } = vi.hoisted(() => ({
  fetchOrdersMock: vi.fn<() => Promise<ShopOrderRow[]>>(),
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

vi.mock('@/lib/shop/shop-orders-queries', () => ({
  fetchShopOrdersInLivrare: fetchOrdersMock,
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
}

const secondOrder: ShopOrderRow = {
  ...order,
  id: '00000000-0000-4000-8000-000000000102',
  customer_name: 'Ion Ionescu',
  customer_phone: '0740 654 321',
  delivery_address: 'Strada Livezilor 2, Suceava',
  delivery_position: 2,
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
  fetchOrdersMock.mockReset()
  fetchOrdersMock.mockResolvedValue([order])
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
    expect(await screen.findByText('Livrate (1)')).toBeInTheDocument()
    expect(toastSuccessMock).toHaveBeenCalledWith('Comandă livrată')
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
    expect(screen.getByText(/1 comandă · Rămân 20 lei/)).toBeInTheDocument()
    expect(screen.queryByText('Livrate (1)')).not.toBeInTheDocument()
  })

  it('recalculează totalul local în editarea rapidă fără a salva în DB', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('button', { name: /Maria Popescu/ }))
    await user.click(screen.getByRole('button', { name: 'Editează' }))

    expect(screen.getByRole('heading', { name: 'Editare rapidă' })).toBeInTheDocument()
    const editDialog = screen.getByRole('dialog')
    expect(within(editDialog).getByText('20 lei')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Crește cantitatea pentru Caserolă 300 g' }))

    expect(within(editDialog).getByText('30 lei')).toBeInTheDocument()
    expect(within(editDialog).getByRole('button', { name: 'Salvează modificările' })).toBeDisabled()
    expect(within(editDialog).getByText(/blocată până la confirmarea Fazei 2/)).toBeInTheDocument()
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
})
