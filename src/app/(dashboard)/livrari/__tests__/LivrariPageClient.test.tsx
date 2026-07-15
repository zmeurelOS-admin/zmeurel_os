import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { LivrariPageClient } from '@/app/(dashboard)/livrari/LivrariPageClient'
import { todayBucharestDate } from '@/lib/shop/b2c-order-helpers'
import type { Comanda } from '@/lib/supabase/queries/comenzi'

const {
  deliverComandaMock,
  getComenziMock,
  toastErrorMock,
  toastSuccessMock,
  updateComandaMock,
} = vi.hoisted(() => ({
  deliverComandaMock: vi.fn(),
  getComenziMock: vi.fn<() => Promise<Comanda[]>>(),
  toastErrorMock: vi.fn(),
  toastSuccessMock: vi.fn(),
  updateComandaMock: vi.fn(),
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

vi.mock('@/lib/supabase/queries/clienti', () => ({
  getClienți: vi.fn().mockResolvedValue([]),
}))

vi.mock('@/lib/supabase/queries/comenzi', () => ({
  deliverComanda: deliverComandaMock,
  getComenzi: getComenziMock,
  updateComanda: updateComandaMock,
}))

vi.mock('@/lib/ui/toast', () => ({
  toast: {
    error: toastErrorMock,
    info: vi.fn(),
    success: toastSuccessMock,
  },
}))

const shopBridgeOrder: Comanda = {
  id: '00000000-0000-4000-8000-000000000101',
  tenant_id: '00000000-0000-4000-8000-000000000301',
  client_id: null,
  client_nume_manual: 'Maria Popescu',
  telefon: '0740 123 456',
  locatie_livrare: 'Strada Florilor 10, Suceava',
  data_comanda: '2026-06-07',
  data_livrare: '2026-06-07',
  cantitate_kg: 1,
  pret_per_kg: 20,
  total: 20,
  status: 'in_livrare',
  observatii: 'Caserolă 300 g × 2',
  linked_vanzare_id: null,
  parent_comanda_id: null,
  created_at: '2026-06-07T08:00:00.000Z',
  updated_at: '2026-06-07T08:00:00.000Z',
  data_origin: 'shop_order_bridge',
  shop_order_id: '00000000-0000-4000-8000-000000000501',
}

const manualOrder: Comanda = {
  ...shopBridgeOrder,
  id: '00000000-0000-4000-8000-000000000201',
  client_nume_manual: 'Client Manual',
  telefon: '0722 000 111',
  locatie_livrare: 'Sat Demo 1',
  cantitate_kg: 3,
  pret_per_kg: 12,
  total: 36,
  observatii: '3 kg afine',
  data_origin: null,
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
  deliverComandaMock.mockReset()
  deliverComandaMock.mockResolvedValue({
    deliveredOrder: { ...shopBridgeOrder, status: 'livrata' },
    vanzare: { id: 'vanzare-1' },
    remainingOrder: null,
    deductedStockKg: 1,
  })
  getComenziMock.mockReset()
  getComenziMock.mockResolvedValue([shopBridgeOrder])
  toastErrorMock.mockReset()
  toastSuccessMock.mockReset()
  updateComandaMock.mockReset()
  updateComandaMock.mockResolvedValue(shopBridgeOrder)
})

describe('LivrariPageClient', () => {
  it('afișează în header contorul canonic al comenzilor livrate', async () => {
    getComenziMock.mockResolvedValue([
      { ...shopBridgeOrder, status: 'livrata' },
      { ...manualOrder, status: 'livrata' },
      shopBridgeOrder,
    ])
    renderPage()

    expect(await screen.findByText('✅ Livrate 2')).toBeInTheDocument()
  })

  it('afișează un bridge Shop din comenzi cu badge-ul de origine și acțiunile canonice', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('button', { name: /Maria Popescu/ }))

    expect(screen.getByText('Shop')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '0740 123 456' })).toHaveAttribute('href', 'tel:0740123456')
    expect(screen.getByRole('button', { name: /Editează/ })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Livrat' })).toHaveLength(2)
    expect(screen.getByRole('button', { name: 'Reprogramat' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Anulat' })).toHaveClass('bg-[var(--alert)]')
    expect(screen.queryByRole('button', { name: 'Schimbă statusul comenzii' })).not.toBeInTheDocument()
  })

  it('livrează bridge-ul Shop prin RPC-ul canonic pentru comenzi', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('button', { name: /Maria Popescu/ }))
    await user.click(screen.getAllByRole('button', { name: 'Livrat' })[1])
    await user.click(screen.getByRole('button', { name: 'Da, marchează livrat' }))

    await waitFor(() =>
      expect(deliverComandaMock).toHaveBeenCalledWith({
        comandaId: shopBridgeOrder.id,
        cantitateLivrataKg: 1,
        statusPlata: 'platit',
        dataLivrareRamasa: null,
      }),
    )
    expect(await screen.findByText('Livrate (1)')).toBeInTheDocument()
    expect(toastSuccessMock).toHaveBeenCalledWith('Livrare parțială înregistrată')
  })

  it('transmite plata neîncasată către livrarea canonică', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('button', { name: /Maria Popescu/ }))
    await user.click(screen.getAllByRole('button', { name: 'Livrat' })[1])
    await user.click(screen.getByRole('radio', { name: 'Neplătit' }))
    await user.click(screen.getByRole('button', { name: 'Da, marchează livrat' }))

    await waitFor(() =>
      expect(deliverComandaMock).toHaveBeenCalledWith(
        expect.objectContaining({ statusPlata: 'neplatit' }),
      ),
    )
  })

  it('restaurează comanda și totalul când livrarea canonică eșuează', async () => {
    const user = userEvent.setup()
    deliverComandaMock.mockRejectedValueOnce(new Error('Stoc insuficient pentru livrare.'))
    renderPage()

    await user.click(await screen.findByRole('button', { name: /Maria Popescu/ }))
    await user.click(screen.getAllByRole('button', { name: 'Livrat' })[1])
    await user.click(screen.getByRole('button', { name: 'Da, marchează livrat' }))

    await waitFor(() =>
      expect(toastErrorMock).toHaveBeenCalledWith('Stoc insuficient pentru livrare.'),
    )
    expect(screen.getByText('Maria Popescu')).toBeInTheDocument()
    expect(screen.getByText('1.0 kg shop · 20 lei')).toBeInTheDocument()
    expect(screen.queryByText('Livrate (1)')).not.toBeInTheDocument()
  })

  it('reprogramează pentru o dată viitoare și mută comanda în Programate', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('button', { name: /Maria Popescu/ }))
    await user.click(screen.getByRole('button', { name: 'Reprogramat' }))
    await user.click(screen.getByRole('button', { name: 'Mâine' }))
    await user.click(screen.getByRole('button', { name: 'Confirmă data' }))

    const tomorrow = new Date(`${todayBucharestDate()}T12:00:00.000Z`)
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)
    await waitFor(() =>
      expect(updateComandaMock).toHaveBeenCalledWith(shopBridgeOrder.id, {
        data_livrare: tomorrow.toISOString().slice(0, 10),
        status: 'programata',
      }),
    )
  })

  it('salvează editarea bridge-ului prin updateComanda', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('button', { name: /Maria Popescu/ }))
    await user.click(screen.getByRole('button', { name: /Editează/ }))

    const dialog = screen.getByRole('dialog')
    const quantity = within(dialog).getByRole('spinbutton', { name: 'Cantitate (kg)' })
    await user.clear(quantity)
    await user.type(quantity, '1.5')
    await user.click(within(dialog).getByRole('button', { name: 'Salvează' }))

    await waitFor(() =>
      expect(updateComandaMock).toHaveBeenCalledWith(
        shopBridgeOrder.id,
        expect.objectContaining({ cantitate_kg: 1.5 }),
      ),
    )
    expect(toastSuccessMock).toHaveBeenCalledWith('Comanda a fost actualizată.')
  })

  it('ordonează FIFO comenzile canonice și arată programările de azi', async () => {
    getComenziMock.mockResolvedValue([
      { ...shopBridgeOrder, id: 'fallback-early', client_nume_manual: 'Ion Ionescu', data_comanda: '2026-06-06', data_livrare: null, created_at: '2026-06-06T08:00:00.000Z' },
      { ...shopBridgeOrder, id: 'scheduled-later', client_nume_manual: 'Maria Popescu', data_livrare: '2026-06-07', created_at: '2026-06-05T08:00:00.000Z' },
      { ...shopBridgeOrder, id: 'scheduled-today', client_nume_manual: 'Ana Programată', status: 'programata', data_livrare: todayBucharestDate() },
    ])
    renderPage()

    const cards = await screen.findAllByRole('button', {
      name: /Arată detaliile comenzii pentru|Ascunde detaliile comenzii pentru/,
    })
    expect(cards[0]).toHaveAccessibleName('Arată detaliile comenzii pentru Ion Ionescu')
    expect(cards[1]).toHaveAccessibleName('Arată detaliile comenzii pentru Maria Popescu')
    expect(await screen.findByRole('button', { name: /1 comandă programată pentru azi/i })).toBeInTheDocument()
  })

  it('afișează comenzile manuale prin aceeași sursă canonică', async () => {
    const user = userEvent.setup()
    getComenziMock.mockResolvedValue([manualOrder])
    renderPage()

    expect(await screen.findByText('Client Manual')).toBeInTheDocument()
    expect(screen.getByText('3.0 kg clienți · 36 lei')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Client Manual/ }))
    expect(screen.getByRole('link', { name: '0722 000 111' })).toHaveAttribute('href', 'tel:0722000111')
    expect(screen.getByRole('button', { name: /Editează/ })).toBeInTheDocument()
    expect(screen.queryByText('Magazin')).not.toBeInTheDocument()
  })
})
