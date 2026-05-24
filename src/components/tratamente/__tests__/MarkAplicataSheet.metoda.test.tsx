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
  return {
    mode: 'manual' as const,
    defaultCantitateMl: null,
    defaultOperator: 'Ion',
    defaultStadiu: null,
    defaultManualParcelaId: 'parcela-1',
    defaultManualParcelaLabel: 'Parcela test',
    defaultManualStatus: 'aplicata' as const,
    configurareSezon: null,
    grupBiologic: 'solanacee' as const,
    isRubusMixt: false,
    manualParcele: [{ value: 'parcela-1', label: 'Parcela test' }],
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
  it("afișează badge-ul și valorile foliare implicite în mode='manual'", async () => {
    seedRecomandariFixtures()

    renderSheet(<MarkAplicataSheet {...baseManualProps({ defaultMetoda: 'foliar' })} />)

    expect(
      screen.getAllByText('Foliar').some((element) => element.tagName.toLowerCase() !== 'option')
    ).toBe(true)
    expect(screen.getByRole('combobox', { name: 'Unitate doză' })).toHaveTextContent('ml/10L apă')
    expect(screen.getByText('Cantitate apă')).toBeInTheDocument()
    expect(screen.getByText(/Opțional\./i)).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'Înflorit' })).toBeInTheDocument()
  }, 10_000)

  it("ascunde câmpul de apă pentru fertirigare și setează unitatea default corectă", () => {
    seedRecomandariFixtures()

    renderSheet(<MarkAplicataSheet {...baseManualProps({ defaultMetoda: 'fertirigare' })} />)

    expect(screen.getByRole('combobox', { name: 'Unitate doză' })).toHaveTextContent('kg/parcelă')
    expect(screen.queryByText('Cantitate apă')).not.toBeInTheDocument()
  })

  it('setează unitatea de bază și ascunde warning-ul PHI pentru fertilizare_baza', () => {
    seedRecomandariFixtures()

    renderSheet(<MarkAplicataSheet {...baseManualProps({ defaultMetoda: 'fertilizare_baza' })} />)

    expect(screen.getByRole('combobox', { name: 'Unitate doză' })).toHaveTextContent('saci 50 kg')
    expect(screen.queryByText('Atenție PHI')).not.toBeInTheDocument()
  })

  it('afișează recomandările și adaugă produsul sugerat în listă', async () => {
    seedRecomandariFixtures()
    const user = userEvent.setup()

    renderSheet(<MarkAplicataSheet {...baseManualProps({ defaultMetoda: 'foliar' })} />)

    expect(
      await screen.findByText((content) => content.includes('Recomandate pentru Înflorit'))
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Cupru Standard/i }))

    await waitFor(() => {
      expect(screen.getAllByText('Cupru Standard').length).toBeGreaterThan(1)
    })
  })

  it('ascunde cardul de recomandări când nu există sugestii', async () => {
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
    supabaseFixtures.parcele_planuri = { single: null }
    supabaseFixtures.planuri_tratament = { single: null }
    supabaseFixtures.planuri_tratament_linii = { rows: [] }
    supabaseFixtures.planuri_tratament_linie_produse = { rows: [] }

    renderSheet(<MarkAplicataSheet {...baseManualProps({ defaultMetoda: 'foliar' })} />)

    await waitFor(() => {
      expect(screen.queryByText(/Recomandate pentru/i)).not.toBeInTheDocument()
    })
  })

  it('afișează chip-ul fenofazei curente când stadiul este cunoscut', async () => {
    seedRecomandariFixtures()

    renderSheet(<MarkAplicataSheet {...baseManualProps({ defaultMetoda: 'foliar' })} />)

    expect(await screen.findByRole('button', { name: 'Înflorit' })).toBeInTheDocument()
  })

  it('nu activează UI-ul Sprint 4 când defaultMetoda lipsește', async () => {
    seedRecomandariFixtures()

    renderSheet(<MarkAplicataSheet {...baseManualProps()} />)

    expect(screen.queryByRole('combobox', { name: 'Unitate doză' })).not.toBeInTheDocument()
    expect(screen.queryByText(/Recomandate pentru/i)).not.toBeInTheDocument()
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Înflorit' })).not.toBeInTheDocument()
    })
  })

  it("trimite metoda_aplicare la submit în mode='din_plan' și ascunde assist-urile manuale", async () => {
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
    expect(screen.queryByText(/Recomandate pentru/i)).not.toBeInTheDocument()
  })
})
