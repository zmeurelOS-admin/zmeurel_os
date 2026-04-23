import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { addDays, format } from 'date-fns'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { HubTratamenteClient } from '@/components/tratamente/HubTratamenteClient'
import type {
  AplicareCrossParcelItem,
  InterventieRelevantaV2,
  StatisticiAplicariCrossParcel,
} from '@/lib/supabase/queries/tratamente'

const { planificaInterventieRelevantaActionMock, registerAddActionMock } = vi.hoisted(() => ({
  planificaInterventieRelevantaActionMock: vi.fn(),
  registerAddActionMock: vi.fn(() => vi.fn()),
}))
const pushMock = vi.fn()
const replaceMock = vi.fn()
const refreshMock = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: pushMock,
    replace: replaceMock,
    refresh: refreshMock,
  }),
}))

vi.mock('@/app/(dashboard)/parcele/[id]/tratamente/aplicare/[aplicareId]/actions', () => ({
  markAplicataAction: vi.fn(),
  reprogrameazaAction: vi.fn(),
}))

vi.mock('@/app/(dashboard)/tratamente/actions', () => ({
  createManualInterventieAction: vi.fn(),
  loadHubMeteoParcelaAction: vi.fn(),
  planificaInterventieRelevantaAction: (...args: unknown[]) => planificaInterventieRelevantaActionMock(...args),
}))

vi.mock('@/components/app/PageHeader', () => ({
  PageHeader: ({ title, subtitle, rightSlot, summary }: { title: string; subtitle?: string; rightSlot?: ReactNode; summary?: ReactNode }) => (
    <div>
      <h1>{title}</h1>
      {subtitle ? <p>{subtitle}</p> : null}
      {summary}
      {rightSlot}
    </div>
  ),
}))

vi.mock('@/contexts/AddActionContext', () => ({
  useAddAction: () => ({
    registerAddAction: registerAddActionMock,
    triggerAddAction: vi.fn(),
    currentLabel: '+ Intervenție manuală',
    hasAction: true,
  }),
}))

vi.mock('@/components/app/AppShell', () => ({
  AppShell: ({ header, children }: { header: ReactNode; children: ReactNode }) => (
    <div>
      {header}
      {children}
    </div>
  ),
}))

function createAplicare(
  overrides: Partial<AplicareCrossParcelItem> = {}
): AplicareCrossParcelItem {
  return {
    id: overrides.id ?? 'aplicare-1',
    tenant_id: 'tenant-1',
    parcela_id: overrides.parcela_id ?? 'parcela-1',
    cultura_id: null,
    plan_linie_id: 'linie-1',
    sursa: overrides.sursa ?? 'din_plan',
    produs_id: 'produs-1',
    produs_nume_manual: null,
    data_programata: overrides.data_programata ?? '2026-04-17',
    data_planificata: overrides.data_planificata ?? overrides.data_programata ?? '2026-04-17',
    data_aplicata: overrides.data_aplicata ?? null,
    status: overrides.status ?? 'planificata',
    parcela_nume: overrides.parcela_nume ?? 'Parcela Nord',
    parcela_cod: 'P-1',
    parcela_suprafata_m2: 1200,
    parcela_lat: 47.65,
    parcela_lng: 26.25,
    plan_id: 'plan-1',
    plan_nume: overrides.plan_nume ?? 'Plan zmeur 2026',
    plan_arhivat: false,
    linie_id: 'linie-1',
    stadiu_trigger: 'inflorit',
    tip_interventie: overrides.tip_interventie ?? 'fungicid',
    scop: overrides.scop ?? 'Protecție fitosanitară',
    produs_nume: overrides.produs_nume ?? 'Switch 62.5 WG',
    produs_tip: 'fungicid',
    produs_frac: '9+12',
    produs_phi_zile: 7,
    doza_ml_per_hl: 80,
    doza_l_per_ha: null,
    observatii: null,
    operator: null,
    meteo_snapshot: null,
    produse_aplicare: [],
    produse_planificate: [],
    phi_warning: overrides.phi_warning ?? false,
    urmatoarea_recoltare: null,
  }
}

function createInterventieRelevanta(overrides: Partial<InterventieRelevantaV2> = {}): InterventieRelevantaV2 {
  const produs = {
    id: 'produs-1',
    tenant_id: 'tenant-1',
    nume_comercial: 'Switch 62.5 WG',
    substanta_activa: 'ciprodinil + fludioxonil',
    tip: 'fungicid',
    frac_irac: '9+12',
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

  const produse = [
    {
      id: 'linie-produs-1',
      tenant_id: 'tenant-1',
      plan_linie_id: 'linie-relevanta-1',
      ordine: 1,
      produs_id: 'produs-1',
      produs_nume_manual: null,
      produs_nume_snapshot: 'Switch 62.5 WG',
      substanta_activa_snapshot: 'ciprodinil + fludioxonil',
      tip_snapshot: 'fungicid',
      frac_irac_snapshot: '9+12',
      phi_zile_snapshot: 7,
      doza_ml_per_hl: 80,
      doza_l_per_ha: null,
      observatii: null,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
      produs,
    },
  ]

  return {
    parcela_id: 'parcela-1',
    parcela_nume: 'Parcela Nord',
    parcela_cod: 'P-1',
    plan: {
      id: 'plan-1',
      nume: 'Plan zmeur 2026',
      cultura_tip: 'zmeur',
      activ: true,
      arhivat: false,
    },
    interventie: {
      id: 'linie-relevanta-1',
      tenant_id: 'tenant-1',
      plan_id: 'plan-1',
      ordine: 1,
      stadiu_trigger: 'inflorit',
      cohort_trigger: null,
      tip_interventie: 'protectie',
      scop: 'Protecție înflorit',
      regula_repetare: 'interval',
      interval_repetare_zile: 7,
      numar_repetari_max: 2,
      fereastra_start_offset_zile: null,
      fereastra_end_offset_zile: null,
      produs_id: 'produs-1',
      produs_nume_manual: null,
      doza_ml_per_hl: 80,
      doza_l_per_ha: null,
      observatii: null,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
      produs,
      produse,
    },
    produse_planificate: produse,
    fenofaza_curenta: {
      parcela_id: 'parcela-1',
      an: 2026,
      cohort: null,
      stadiu_id: 'stadiu-1',
      stadiu: 'inflorit',
      data_observata: '2026-04-23',
      sursa: 'manual',
      observatii: null,
    },
    ultima_aplicare: {
      id: 'aplicare-aplicata-1',
      status: 'aplicata',
      data_planificata: '2026-04-16',
      data_aplicata: '2026-04-16',
      cohort_la_aplicare: null,
    },
    aplicare_planificata: null,
    aplicari_efectuate_count: 1,
    regula_repetare: 'interval',
    interval_repetare_zile: 7,
    numar_repetari_max: 2,
    urmatoarea_data_estimata: format(new Date(), 'yyyy-MM-dd'),
    zile_ramase: 0,
    status_operational: 'de_facut_azi',
    motiv: 'Fenofaza curentă se potrivește cu intervenția din plan.',
    ...overrides,
  }
}

function renderHub(
  aplicari: AplicareCrossParcelItem[],
  stats: StatisticiAplicariCrossParcel = {
    total: aplicari.length,
    programate: aplicari.filter((item) => item.status === 'planificata' || item.status === 'reprogramata').length,
    aplicate: aplicari.filter((item) => item.status === 'aplicata').length,
    anulate: aplicari.filter((item) => item.status === 'anulata').length,
    in_phi_warning: aplicari.filter((item) => item.phi_warning).length,
    cu_meteo_favorabila: 0,
  },
  interventiiRelevante: InterventieRelevantaV2[] = []
) {
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })

  return render(
    <QueryClientProvider client={client}>
      <HubTratamenteClient
        initialAplicari={aplicari}
        initialStatistici={stats}
        interventiiRelevante={interventiiRelevante}
        loadMeteoForParcela={vi.fn().mockResolvedValue(null)}
      />
    </QueryClientProvider>
  )
}

describe('HubTratamenteClient', () => {
  const todayIso = format(new Date(), 'yyyy-MM-dd')
  const inTwoDaysIso = format(addDays(new Date(), 2), 'yyyy-MM-dd')
  const inFourDaysIso = format(addDays(new Date(), 4), 'yyyy-MM-dd')

  beforeEach(() => {
    vi.clearAllMocks()
    planificaInterventieRelevantaActionMock.mockResolvedValue({ ok: true, data: { id: 'aplicare-noua' } })
  })

  it('afișează empty state când nu există aplicări', () => {
    renderHub([])

    expect(screen.getByText('Nicio aplicare programată')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Creează plan nou' })).toBeInTheDocument()
    expect(registerAddActionMock).toHaveBeenCalledWith(expect.any(Function), '+ Intervenție manuală')
  })

  it('afișează aplicările din tabul Astăzi și KPI-urile de bază', () => {
    renderHub([
      createAplicare({ id: 'a1', data_programata: todayIso, parcela_nume: 'Parcela Nord' }),
      createAplicare({ id: 'a2', data_programata: inFourDaysIso, parcela_nume: 'Parcela Sud' }),
    ])

    expect(screen.getByText('Parcela Nord')).toBeInTheDocument()
    expect(screen.queryByText('Parcela Sud')).not.toBeInTheDocument()
    expect(screen.getByText('Programate azi')).toBeInTheDocument()
  })

  it('filtrează după parcelă și status', async () => {
    const user = userEvent.setup()
    renderHub([
      createAplicare({ id: 'a1', parcela_id: 'p1', parcela_nume: 'Parcela Nord', status: 'planificata', data_programata: inTwoDaysIso }),
      createAplicare({ id: 'a2', parcela_id: 'p2', parcela_nume: 'Parcela Sud', status: 'omisa', data_programata: inTwoDaysIso }),
    ])

    await user.click(screen.getByRole('button', { name: 'Săptămâna asta' }))
    await user.click(screen.getByRole('button', { name: 'Parcela Sud' }))
    await user.selectOptions(screen.getByLabelText('Filtru status'), 'omisa')

    expect(screen.queryByRole('link', { name: 'Parcela Nord' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Parcela Sud' })).toBeInTheDocument()
    expect(screen.getByText('Omisă')).toBeInTheDocument()
  })

  it('păstrează filtrele când schimbi tabul', async () => {
    const user = userEvent.setup()
    renderHub([
      createAplicare({ id: 'a1', parcela_id: 'p1', parcela_nume: 'Parcela Nord', status: 'omisa', data_programata: todayIso }),
      createAplicare({ id: 'a2', parcela_id: 'p1', parcela_nume: 'Parcela Nord', status: 'omisa', data_programata: inTwoDaysIso }),
      createAplicare({ id: 'a3', parcela_id: 'p2', parcela_nume: 'Parcela Sud', status: 'planificata', data_programata: inTwoDaysIso }),
    ])

    await user.click(screen.getByRole('button', { name: 'Toate' }))
    await user.selectOptions(screen.getByLabelText('Filtru status'), 'omisa')

    await waitFor(() => {
      expect(screen.getAllByText('Omisă')).toHaveLength(2)
    })
    expect(screen.queryByText('Planificată')).not.toBeInTheDocument()
  })

  it('afișează intervențiile relevante și pregătește aplicarea din plan', async () => {
    const user = userEvent.setup()
    renderHub([], undefined, [createInterventieRelevanta()])

    await user.click(screen.getByRole('button', { name: 'Relevante acum' }))

    expect(screen.getByText('Relevante operațional')).toBeInTheDocument()
    expect(screen.getAllByText('De făcut acum').length).toBeGreaterThan(0)
    expect(screen.getByText(/Interval: 7 zile/i)).toBeInTheDocument()
    expect(screen.getByText(/Aplicări efectuate: 1/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Pregătește aplicare' }))

    await waitFor(() => {
      expect(planificaInterventieRelevantaActionMock).toHaveBeenCalledTimes(1)
    })
    const formData = planificaInterventieRelevantaActionMock.mock.calls[0]?.[0] as FormData
    expect(formData.get('parcelaId')).toBe('parcela-1')
    expect(formData.get('planLinieId')).toBe('linie-relevanta-1')
    expect(refreshMock).toHaveBeenCalled()
  })
})
