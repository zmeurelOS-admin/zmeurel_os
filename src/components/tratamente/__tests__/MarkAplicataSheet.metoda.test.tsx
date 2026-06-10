import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactElement } from 'react'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { MarkAplicataSheet } from '@/components/tratamente/MarkAplicataSheet'
import type { InterventieProdusV2, ProdusFitosanitar } from '@/lib/supabase/queries/tratamente'

type TableFixture = {
  rows?: unknown[]
  single?: unknown | null
}

const { supabaseFixtures, getSupabaseMock } = vi.hoisted(() => ({
  supabaseFixtures: {} as Record<string, TableFixture>,
  getSupabaseMock: vi.fn(() => ({
    from: vi.fn((table: string) => createBuilder(table)),
  })),
}))

function createBuilder(table: string) {
  const fixture = supabaseFixtures[table] ?? {}
  const response = { data: fixture.rows ?? [], error: null }
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    order: vi.fn(() => builder),
    in: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    maybeSingle: vi.fn(() => Promise.resolve({ data: fixture.single ?? null, error: null })),
    then: (onFulfilled: (value: typeof response) => unknown) => Promise.resolve(response).then(onFulfilled),
    catch: (onRejected: (reason: unknown) => unknown) => Promise.resolve(response).catch(onRejected),
    finally: (onFinally: () => void) => Promise.resolve(response).finally(onFinally),
  }

  return builder
}

vi.mock('@/hooks/useMediaQuery', () => ({
  useMediaQuery: () => false,
}))

vi.mock('@/components/app/DashboardAuthContext', () => ({
  useDashboardAuth: () => ({
    userId: 'user-1',
    email: 'user@example.test',
    isSuperAdmin: false,
    tenantId: 'tenant-1',
    associationShopApproved: false,
    associationRole: null,
    farmName: 'Ferma test',
  }),
}))

vi.mock('@/app/(dashboard)/tratamente/actions', () => ({
  loadHubMeteoParcelaAction: vi.fn(async () => null),
}))

vi.mock('@/app/(dashboard)/tratamente/produse-fitosanitare/actions', () => ({
  saveProdusFitosanitarInLibraryAction: vi.fn(),
}))

vi.mock('@/lib/supabase/client', () => ({
  getSupabase: getSupabaseMock,
}))

vi.mock('@/lib/supabase/queries/parcela-stadii', async () => {
  const actual = await vi.importActual<typeof import('@/lib/supabase/queries/parcela-stadii')>(
    '@/lib/supabase/queries/parcela-stadii'
  )
  return {
    ...actual,
    getStadiiCanoniceParcela: vi.fn(async () => {
      const fixture = supabaseFixtures.stadii_fenologice_parcela
      return (fixture?.rows ?? []) as Awaited<ReturnType<typeof actual.getStadiiCanoniceParcela>>
    }),
  }
})

const originalHasPointerCapture = HTMLElement.prototype.hasPointerCapture
const originalSetPointerCapture = HTMLElement.prototype.setPointerCapture
const originalReleasePointerCapture = HTMLElement.prototype.releasePointerCapture

beforeAll(() => {
  HTMLElement.prototype.hasPointerCapture = () => false
  HTMLElement.prototype.setPointerCapture = () => undefined
  HTMLElement.prototype.releasePointerCapture = () => undefined
})

afterAll(() => {
  HTMLElement.prototype.hasPointerCapture = originalHasPointerCapture
  HTMLElement.prototype.setPointerCapture = originalSetPointerCapture
  HTMLElement.prototype.releasePointerCapture = originalReleasePointerCapture
})

beforeEach(() => {
  Object.keys(supabaseFixtures).forEach((key) => delete supabaseFixtures[key])
  getSupabaseMock.mockClear()
})

function renderSheet(component: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  return render(<QueryClientProvider client={queryClient}>{component}</QueryClientProvider>)
}

function makeProdus(id: string, nume: string, substanta = 'substanță'): ProdusFitosanitar {
  return {
    id,
    tenant_id: 'tenant-1',
    nume_comercial: nume,
    substanta_activa: substanta,
    tip: 'fungicid',
    frac_irac: 'FRAC M01',
    doza_min_ml_per_hl: null,
    doza_max_ml_per_hl: null,
    doza_min_l_per_ha: null,
    doza_max_l_per_ha: null,
    phi_zile: 7,
    nr_max_aplicari_per_sezon: null,
    interval_min_aplicari_zile: null,
    omologat_culturi: ['zmeur'],
    activ: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    created_by: null,
  }
}

function makePlanProdus(
  id: string,
  produs: ProdusFitosanitar,
  ordine: number,
  doza: number
): InterventieProdusV2 {
  return {
    id,
    tenant_id: 'tenant-1',
    plan_linie_id: 'linie-1',
    ordine,
    produs_id: produs.id,
    produs_nume_manual: null,
    produs_nume_snapshot: produs.nume_comercial,
    substanta_activa_snapshot: produs.substanta_activa,
    tip_snapshot: produs.tip,
    frac_irac_snapshot: produs.frac_irac,
    phi_zile_snapshot: produs.phi_zile,
    doza_ml_per_hl: doza,
    doza_l_per_ha: null,
    cantitate_text: null,
    observatii: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    produs,
  }
}

function baseManualProps(overrides?: Partial<React.ComponentProps<typeof MarkAplicataSheet>>) {
  const parcelaId = '00000000-0000-4000-8000-000000000101'
  return {
    mode: 'manual' as const,
    defaultCantitateMl: null,
    defaultOperator: 'Ion',
    defaultStadiu: null,
    defaultManualParcelaId: parcelaId,
    defaultManualParcelaLabel: 'Parcela test',
    defaultManualStatus: 'aplicata' as const,
    configurareSezon: null,
    grupBiologic: 'solanacee' as const,
    isRubusMixt: false,
    manualParcele: [{ value: parcelaId, label: 'Parcela test' }],
    meteoSnapshot: null,
    onOpenChange: vi.fn(),
    onSubmit: vi.fn(),
    open: true,
    pending: false,
    produseFitosanitare: [],
    ...overrides,
  }
}

function seedRecomandariFixtures() {
  supabaseFixtures.stadii_fenologice_parcela = {
    rows: [
      {
        id: 'stadiu-1',
        tenant_id: 'tenant-1',
        parcela_id: 'parcela-1',
        an: 2026,
        stadiu: 'inflorit',
        cohort: null,
        data_observata: '2026-05-10',
        sursa: 'manual',
        observatii: null,
        created_at: '2026-05-10T08:00:00Z',
        updated_at: '2026-05-10T08:00:00Z',
        created_by: null,
      },
    ],
  }
  supabaseFixtures.parcele_planuri = {
    single: {
      id: 'pp-1',
      tenant_id: 'tenant-1',
      parcela_id: 'parcela-1',
      plan_id: 'plan-1',
      an: 2026,
      activ: true,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-05-01T00:00:00Z',
    },
  }
  supabaseFixtures.planuri_tratament = {
    single: {
      id: 'plan-1',
      tenant_id: 'tenant-1',
      nume: 'Plan activ',
      descriere: null,
      cultura_tip: 'zmeur',
      activ: true,
      arhivat: false,
      created_at: '2026-01-01T00:00:00Z',
      created_by: null,
      updated_at: '2026-01-01T00:00:00Z',
      updated_by: null,
    },
  }
  supabaseFixtures.planuri_tratament_linii = {
    rows: [
      {
        id: 'linie-1',
        tenant_id: 'tenant-1',
        plan_id: 'plan-1',
        ordine: 1,
        stadiu_trigger: 'inflorit',
        tip_interventie: 'protectie',
        scop: 'Protecție fungică',
        metoda_aplicare: 'foliar',
        cohort_trigger: null,
        regula_repetare: 'fara_repetare',
        interval_repetare_zile: null,
        numar_repetari_max: null,
        observatii: null,
        motiv_adaugare: null,
        doza_ml_per_hl: null,
        doza_l_per_ha: null,
        fereastra_start_offset_zile: null,
        fereastra_end_offset_zile: null,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
        produs_id: null,
        produs_nume_manual: null,
        sursa_linie: 'manuala',
      },
      {
        id: 'linie-2',
        tenant_id: 'tenant-1',
        plan_id: 'plan-1',
        ordine: 2,
        stadiu_trigger: 'inflorit',
        tip_interventie: 'biostimulare',
        scop: 'Biostimulare',
        metoda_aplicare: null,
        cohort_trigger: null,
        regula_repetare: 'fara_repetare',
        interval_repetare_zile: null,
        numar_repetari_max: null,
        observatii: null,
        motiv_adaugare: null,
        doza_ml_per_hl: null,
        doza_l_per_ha: null,
        fereastra_start_offset_zile: null,
        fereastra_end_offset_zile: null,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
        produs_id: null,
        produs_nume_manual: null,
        sursa_linie: 'manuala',
      },
    ],
  }
  supabaseFixtures.planuri_tratament_linie_produse = {
    rows: [
      {
        id: 'prod-plan-1',
        tenant_id: 'tenant-1',
        plan_linie_id: 'linie-1',
        ordine: 1,
        produs_id: 'prod-1',
        produs_nume_manual: null,
        produs_nume_snapshot: 'Cupru Standard',
        substanta_activa_snapshot: 'hidroxid de cupru',
        tip_snapshot: 'fungicid',
        frac_irac_snapshot: 'FRAC M01',
        phi_zile_snapshot: 7,
        doza_ml_per_hl: 220,
        doza_l_per_ha: null,
        cantitate_text: '220 ml/hl',
        observatii: null,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
      {
        id: 'prod-plan-2',
        tenant_id: 'tenant-1',
        plan_linie_id: 'linie-2',
        ordine: 1,
        produs_id: 'prod-2',
        produs_nume_manual: null,
        produs_nume_snapshot: 'Amino Foliar',
        substanta_activa_snapshot: 'aminoacizi',
        tip_snapshot: 'bioregulator',
        frac_irac_snapshot: '',
        phi_zile_snapshot: null,
        doza_ml_per_hl: 150,
        doza_l_per_ha: null,
        cantitate_text: '150 ml/hl',
        observatii: null,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
    ],
  }
}

describe('MarkAplicataSheet.defaultMetoda', () => {
  it("preselectează butonul vizual pentru defaultMetoda în mode='manual'", () => {
    renderSheet(<MarkAplicataSheet {...baseManualProps({ defaultMetoda: 'foliar' })} />)

    expect(screen.getByRole('button', { name: 'Foliar' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByLabelText('Pasul 1 din 3')).toBeInTheDocument()
    expect(screen.queryByText('Produs fără nume')).not.toBeInTheDocument()
  })

  it('afișează cele trei metode ca butoane mari', () => {
    renderSheet(<MarkAplicataSheet {...baseManualProps({ defaultMetoda: 'fertirigare' })} />)

    expect(screen.getByRole('button', { name: 'Fertirigare' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Foliar' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sol' })).toBeInTheDocument()
  })

  it('nu injectează recomandările planului în fluxul manual', async () => {
    seedRecomandariFixtures()

    renderSheet(<MarkAplicataSheet {...baseManualProps({ defaultMetoda: 'foliar' })} />)

    await waitFor(() => {
      expect(screen.queryByText(/Recomandate pentru/i)).not.toBeInTheDocument()
    })
  })

  it('caută produsul și salvează fără scop, apoi închide modalul', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    const onOpenChange = vi.fn()
    const cupru = makeProdus('prod-1', 'Cupru Standard', 'hidroxid de cupru')
    const sulf = makeProdus('prod-2', 'Sulf Rapid', 'sulf')

    renderSheet(
      <MarkAplicataSheet
        {...baseManualProps({
          defaultMetoda: 'foliar',
          onOpenChange,
          onSubmit,
          produseFitosanitare: [cupru, sulf],
        })}
      />
    )

    await user.click(screen.getByRole('button', { name: 'Continuă' }))
    const searchInput = screen.getByPlaceholderText('Nume, substanță, tip sau FRAC/IRAC')
    await user.type(searchInput, 'hidroxid')

    expect(screen.getByRole('button', { name: /Cupru Standard/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Sulf Rapid/i })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Cupru Standard/i }))
    await user.type(screen.getByLabelText('Cantitate aplicată'), '250')

    expect(screen.getByText(/Scop/)).toHaveTextContent('opțional')
    await user.click(screen.getByRole('button', { name: 'Salvează intervenția' }))

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({
      metoda_aplicare: 'foliar',
      scop: undefined,
      produse: [
        expect.objectContaining({
          produs_id: 'prod-1',
          cantitate_text: '250 ml',
        }),
      ],
    })
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('păstrează fluxul existent pentru aplicările din plan', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    const cupru = makeProdus('prod-1', 'Cupru Standard', 'hidroxid de cupru')

    renderSheet(
      <MarkAplicataSheet
        defaultMetoda="foliar"
        defaultCantitateMl={null}
        defaultOperator="Ion"
        defaultStadiu="inflorit"
        meteoSnapshot={null}
        onOpenChange={() => undefined}
        onSubmit={onSubmit}
        open
        produseFitosanitare={[cupru]}
        produsePlanificate={[makePlanProdus('linie-prod-1', cupru, 1, 200)]}
      />
    )

    await user.type(screen.getByLabelText('Cantitate aplicată'), '220 ml/hl')
    await user.click(screen.getByRole('button', { name: 'Marchează aplicarea' }))

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({
      metoda_aplicare: 'foliar',
    })
  })
})
