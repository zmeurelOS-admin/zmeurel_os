import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ComenziPageClient } from '@/app/(dashboard)/comenzi/ComenziPageClient'
import type { Comanda } from '@/lib/supabase/queries/comenzi'

const {
  deliverComandaMock,
  getCliențiMock,
  getComenziMock,
  getSellableCal1StockSummaryMock,
  getVanzariMock,
  toastErrorMock,
  toastInfoMock,
  toastMock,
  toastSuccessMock,
} = vi.hoisted(() => ({
  deliverComandaMock: vi.fn(),
  getCliențiMock: vi.fn().mockResolvedValue([]),
  getComenziMock: vi.fn<() => Promise<Comanda[]>>(),
  getSellableCal1StockSummaryMock: vi.fn(),
  getVanzariMock: vi.fn().mockResolvedValue([]),
  toastErrorMock: vi.fn(),
  toastInfoMock: vi.fn(),
  toastSuccessMock: vi.fn(),
  toastMock: Object.assign(vi.fn(), {}),
}))

vi.mock('next/navigation', () => ({
  usePathname: () => '/comenzi',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock('@/components/app/AppShell', () => ({
  AppShell: ({ header, children }: { header: ReactNode; children: ReactNode }) => (
    <div>
      <header>{header}</header>
      <main>{children}</main>
    </div>
  ),
}))

vi.mock('@/components/app/PageHeader', () => ({
  PageHeader: ({ title, rightSlot }: { title: string; rightSlot?: ReactNode }) => (
    <div>
      <h1>{title}</h1>
      {rightSlot}
    </div>
  ),
}))

vi.mock('@/components/app/DashboardContentShell', () => ({
  DashboardContentShell: ({ children, className }: { children: ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
}))

vi.mock('@/components/app/module-list-chrome', () => ({
  ModuleEmptyCard: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  ModulePillFilterButton: ({
    children,
    onClick,
    className,
  }: {
    children: ReactNode
    onClick?: () => void
    className?: string
  }) => (
    <button type="button" onClick={onClick} className={className}>
      {children}
    </button>
  ),
  ModulePillRow: ({ children, className }: { children: ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
  ModuleScoreboard: ({ children, className }: { children: ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
}))

vi.mock('@/components/app/ConfirmDeleteDialog', () => ({
  ConfirmDeleteDialog: () => null,
}))

vi.mock('@/components/app/ErrorState', () => ({
  ErrorState: ({ title, message }: { title: string; message: string }) => (
    <div>
      {title}
      {message}
    </div>
  ),
}))

vi.mock('@/components/app/ListSkeleton', () => ({
  EntityListSkeleton: () => <div>loading</div>,
}))

vi.mock('@/components/app/useMobileScrollRestore', () => ({
  useMobileScrollRestore: () => undefined,
}))

vi.mock('@/components/app/DashboardAuthContext', () => ({
  useDashboardAuth: () => ({
    tenantId: 'tenant-1',
    memberRole: 'owner',
    accessLevel: 'write',
  }),
}))

vi.mock('@/contexts/AddActionContext', () => ({
  useAddAction: () => ({ registerAddAction: vi.fn() }),
}))

vi.mock('@/hooks/useMediaQuery', () => ({
  useMediaQuery: () => false,
}))

vi.mock('@/components/comenzi/UnifiedOrderCard', () => ({
  UnifiedOrderCard: ({
    item,
    onB2bStatusChange,
    onEdit,
  }: {
    item: { id: string; customerName: string }
    onB2bStatusChange?: (id: string, status: 'livrata') => void
    onEdit?: () => void
  }) => (
    <div data-testid="order-card">
      <span>{item.customerName}</span>
      <button type="button" onClick={() => onB2bStatusChange?.(item.id, 'livrata')}>
        Livrat
      </button>
      <button type="button" onClick={() => onEdit?.()}>
        Editează
      </button>
    </div>
  ),
}))

vi.mock('@/app/(dashboard)/comenzi/ComenziSpeedDial', () => ({
  ComenziSpeedDial: () => null,
}))

vi.mock('@/app/(dashboard)/comenzi/ComenziDinMesajSheet', () => ({
  ComenziDinMesajSheet: () => null,
}))

vi.mock('@/components/comenzi/EditOrderSheet', () => ({
  EditOrderSheet: ({ open }: { open: boolean }) =>
    open ? <div data-testid="edit-order-sheet">EditOrderSheet</div> : null,
}))

vi.mock('@/components/comenzi/PaymentStatusToggle', () => ({
  PaymentStatusToggle: () => null,
}))

vi.mock('@/components/comenzi/ViewComandaDialog', () => ({
  ViewComandaDialog: () => null,
}))

vi.mock('@/components/clienti/AddClientDialog', () => ({
  AddClientDialog: () => null,
}))

vi.mock('@/lib/supabase/queries/clienti', () => ({
  createClienți: vi.fn(),
  getClienți: getCliențiMock,
}))

vi.mock('@/lib/supabase/queries/comenzi', async () => {
  const actual = await vi.importActual<typeof import('@/lib/supabase/queries/comenzi')>(
    '@/lib/supabase/queries/comenzi',
  )
  return {
    ...actual,
    createComanda: vi.fn(),
    deleteComanda: vi.fn(),
    deliverComanda: deliverComandaMock,
    getComenzi: getComenziMock,
    getComenziStockSummaryAzi: vi.fn().mockResolvedValue({
      totalStocDisponibilKg: 12,
      totalStocCal1Kg: 18,
      rezervatActivKg: 2,
      legacyInLivrareKg: 1,
    }),
    markComandaIncasata: vi.fn(),
    reopenComanda: vi.fn(),
    updateComanda: vi.fn(),
  }
})

vi.mock('@/lib/supabase/queries/miscari-stoc', () => ({
  getSellableCal1StockSummary: getSellableCal1StockSummaryMock,
}))

vi.mock('@/lib/supabase/queries/vanzari', () => ({
  getVanzari: getVanzariMock,
}))

vi.mock('@/lib/supabase/client', () => ({
  getSupabase: vi.fn(),
}))

vi.mock('@/lib/tenant/get-tenant', () => ({
  getTenantId: vi.fn(),
}))

vi.mock('@/lib/analytics/track', () => ({
  track: vi.fn(),
}))

vi.mock('@/lib/ui/toast', () => ({
  toast: Object.assign(toastMock, {
    error: toastErrorMock,
    info: toastInfoMock,
    success: toastSuccessMock,
  }),
}))

vi.mock('@/lib/utils/haptic', () => ({
  hapticError: vi.fn(),
  hapticSuccess: vi.fn(),
}))

const manualOrder: Comanda = {
  id: '00000000-0000-4000-8000-000000000901',
  tenant_id: '00000000-0000-4000-8000-000000000301',
  client_id: null,
  client_nume_manual: 'Client Demo',
  telefon: '0740 123 456',
  locatie_livrare: 'Suceava',
  data_comanda: '2026-07-13',
  data_livrare: '2026-07-14',
  cantitate_kg: 2,
  pret_per_kg: 35,
  total: 70,
  status: 'confirmata',
  observatii: null,
  linked_vanzare_id: null,
  parent_comanda_id: null,
  created_at: '2026-07-13T08:00:00.000Z',
  updated_at: '2026-07-13T08:00:00.000Z',
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
      <ComenziPageClient />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  deliverComandaMock.mockReset()
  getCliențiMock.mockResolvedValue([])
  getComenziMock.mockReset()
  getComenziMock.mockResolvedValue([manualOrder])
  getSellableCal1StockSummaryMock.mockReset()
  getSellableCal1StockSummaryMock.mockResolvedValue({
    recoltatCal1Kg: 20,
    consumatDefinitivCal1Kg: 4,
    rezervatActivCal1Kg: 3,
    legacyInLivrareFaraRezervareKg: 1,
    stocCal1LedgerKg: 16,
    disponibilCal1Kg: 12,
  })
  getVanzariMock.mockResolvedValue([])
  toastMock.mockReset()
  toastErrorMock.mockReset()
  toastInfoMock.mockReset()
  toastSuccessMock.mockReset()
})

describe('ComenziPageClient', () => {
  it('nu mai afișează Detalii stoc și păstrează search-ul mobil în blocul de sortare', async () => {
    const user = userEvent.setup()
    renderPage()

    expect(await screen.findByText('Comenzi')).toBeInTheDocument()
    expect(screen.queryByText('Detalii stoc')).not.toBeInTheDocument()

    const mobileControls = screen.getByTestId('comenzi-mobile-controls')
    expect(within(mobileControls).getByText('Sortează:')).toBeInTheDocument()
    expect(within(mobileControls).queryByLabelText('Caută comenzi')).not.toBeInTheDocument()

    await user.click(within(mobileControls).getByRole('button', { name: 'Deschide căutarea' }))

    expect(within(mobileControls).getByLabelText('Caută comenzi')).toBeInTheDocument()
  })

  it('livrează direct din card prin deliverComanda și rămâne în modulul curent', async () => {
    const user = userEvent.setup()
    deliverComandaMock.mockImplementation(async () => {
      const deliveredOrder = {
        ...manualOrder,
        status: 'livrata' as const,
        linked_vanzare_id: 'vanzare-1',
        linked_vanzare: { status_plata: 'platit', data_incasare: null },
      }
      getComenziMock.mockResolvedValue([deliveredOrder])
      return {
        deliveredOrder,
        vanzare: { id: 'vanzare-1' },
        remainingOrder: null,
        deductedStockKg: 2,
      }
    })

    renderPage()

    expect((await screen.findAllByText('Client Demo')).length).toBeGreaterThan(0)
    await user.click(screen.getAllByRole('button', { name: 'Livrat' })[0])
    await user.click(screen.getByRole('button', { name: 'Marchează livrată' }))

    await waitFor(() =>
      expect(deliverComandaMock).toHaveBeenCalledWith({
        comandaId: manualOrder.id,
        cantitateLivrataKg: 2,
        statusPlata: 'platit',
        dataLivrareRamasa: null,
      }),
    )
    await waitFor(() =>
      expect(toastSuccessMock).toHaveBeenCalledWith('Client Demo livrată direct ✓'),
    )
    expect(screen.getByTestId('comenzi-mobile-controls')).toBeInTheDocument()
    await waitFor(() =>
      expect(screen.queryByText('Client Demo')).not.toBeInTheDocument(),
    )
  })

  it('deschide EditOrderSheet existent din acțiunea de editare a cardului', async () => {
    const user = userEvent.setup()
    renderPage()

    expect((await screen.findAllByText('Client Demo')).length).toBeGreaterThan(0)
    await user.click(screen.getAllByRole('button', { name: 'Editează' })[0])

    expect(await screen.findByTestId('edit-order-sheet')).toBeInTheDocument()
  })
})
