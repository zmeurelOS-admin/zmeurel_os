import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { addDays, format } from 'date-fns'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { HubTratamenteClient } from '@/components/tratamente/HubTratamenteClient'
import type {
  AplicareCrossParcelItem,
  StatisticiAplicariCrossParcel,
} from '@/lib/supabase/queries/tratamente'

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
    registerAddAction: vi.fn(() => vi.fn()),
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

function renderHub(
  aplicari: AplicareCrossParcelItem[],
  stats: StatisticiAplicariCrossParcel = {
    total: aplicari.length,
    programate: aplicari.filter((item) => item.status === 'planificata' || item.status === 'reprogramata').length,
    aplicate: aplicari.filter((item) => item.status === 'aplicata').length,
    anulate: aplicari.filter((item) => item.status === 'anulata').length,
    in_phi_warning: aplicari.filter((item) => item.phi_warning).length,
    cu_meteo_favorabila: 0,
  }
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
        loadMeteoForParcela={vi.fn().mockResolvedValue(null)}
      />
    </QueryClientProvider>
  )
}

describe('HubTratamenteClient', () => {
  const todayIso = format(new Date(), 'yyyy-MM-dd')
  const inTwoDaysIso = format(addDays(new Date(), 2), 'yyyy-MM-dd')
  const inFourDaysIso = format(addDays(new Date(), 4), 'yyyy-MM-dd')

  it('afișează empty state când nu există aplicări', () => {
    renderHub([])

    expect(screen.getByText('Nicio aplicare programată')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Creează plan nou' })).toBeInTheDocument()
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
})
