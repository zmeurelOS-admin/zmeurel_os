import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

const mocks = vi.hoisted(() => ({
  getParcelaTratamenteContext: vi.fn(),
  getParcelaPentruConfigurareSezon: vi.fn(),
  getPlanActivPentruParcela: vi.fn(),
  listStadiiPentruParcela: vi.fn(),
  listAplicariParcela: vi.fn(),
  listPlanuriTratament: vi.fn(),
  getGrupBiologicParcela: vi.fn(),
  getOrCreateConfigurareSezon: vi.fn(),
  genereazaAplicariPentruParcela: vi.fn(),
}))

vi.mock('@/lib/supabase/queries/tratamente', () => ({
  getParcelaTratamenteContext: (...args: unknown[]) => mocks.getParcelaTratamenteContext(...args),
  getPlanActivPentruParcela: (...args: unknown[]) => mocks.getPlanActivPentruParcela(...args),
  listStadiiPentruParcela: (...args: unknown[]) => mocks.listStadiiPentruParcela(...args),
  listAplicariParcela: (...args: unknown[]) => mocks.listAplicariParcela(...args),
  listPlanuriTratament: (...args: unknown[]) => mocks.listPlanuriTratament(...args),
  getGrupBiologicParcela: (...args: unknown[]) => mocks.getGrupBiologicParcela(...args),
}))

vi.mock('@/lib/supabase/queries/configurari-sezon', () => ({
  getParcelaPentruConfigurareSezon: (...args: unknown[]) => mocks.getParcelaPentruConfigurareSezon(...args),
  getOrCreateConfigurareSezon: (...args: unknown[]) => mocks.getOrCreateConfigurareSezon(...args),
}))

vi.mock('@/lib/tratamente/generator/generator', () => ({
  genereazaAplicariPentruParcela: (...args: unknown[]) => mocks.genereazaAplicariPentruParcela(...args),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh: vi.fn(),
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
  }),
  notFound: vi.fn(),
}))

import Page from '@/app/(dashboard)/parcele/[id]/tratamente/page'

const parcela = {
  id: '660e8400-e29b-41d4-a716-446655440001',
  id_parcela: 'P-1',
  nume_parcela: 'Parcela Nord',
  cultura: 'zmeur',
  tip_fruct: 'zmeur',
  soi: 'Delniwa',
  soi_plantat: 'Delniwa',
  tip_unitate: 'camp',
  suprafata_m2: 1000,
  tenant_id: 't1',
  an_plantare: 2024,
  status: 'Activ',
  observatii: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  created_by: null,
  updated_by: null,
  rol: 'comercial',
  apare_in_dashboard: true,
  contribuie_la_productie: true,
  status_operational: 'activ',
}

const plan = {
  id: 'plan-1',
  tenant_id: 't1',
  nume: 'Plan zmeur primăvară 2026',
  cultura_tip: 'zmeur',
  descriere: null,
  activ: true,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  created_by: null,
  updated_by: null,
}

const stadiu = {
  id: 's1',
  tenant_id: 't1',
  parcela_id: parcela.id,
  an: 2026,
  stadiu: 'buton_verde',
  data_observata: '2026-04-12',
  sursa: 'manual',
  observatii: null,
  created_at: '2026-04-12T08:00:00Z',
  updated_at: '2026-04-12T08:00:00Z',
  created_by: null,
}

const buildAplicare = (id: string, tip: string) => ({
  id,
  tenant_id: 't1',
  parcela_id: parcela.id,
  cultura_id: null,
  plan_linie_id: `lin-${id}`,
  produs_id: `prod-${id}`,
  produs_nume_manual: null,
  data_planificata: '2026-04-20',
  data_aplicata: null,
  doza_ml_per_hl: 80,
  doza_l_per_ha: null,
  cantitate_totala_ml: null,
  stoc_mutatie_id: null,
  status: 'planificata',
  meteo_snapshot: null,
  stadiu_la_aplicare: 'inflorit',
  observatii: null,
  operator: null,
  created_at: '2026-04-18T08:00:00Z',
  updated_at: '2026-04-18T08:00:00Z',
  created_by: null,
  updated_by: null,
  produs: {
    id: `prod-${id}`,
    tenant_id: 't1',
    nume_comercial: `Produs ${id}`,
    substanta_activa: 'sa',
    tip,
    frac_irac: '9+12',
    phi_zile: null,
    nr_max_aplicari_per_sezon: null,
    activ: true,
  },
  linie: {
    id: `lin-${id}`,
    tenant_id: 't1',
    plan_id: 'plan-1',
    ordine: 1,
    stadiu_trigger: 'inflorit',
    produs_id: `prod-${id}`,
    produs_nume_manual: null,
    doza_ml_per_hl: 80,
    doza_l_per_ha: null,
    observatii: null,
    created_at: '2026-04-01T00:00:00Z',
    updated_at: '2026-04-01T00:00:00Z',
  },
  parcela: {
    id: parcela.id,
    id_parcela: 'P-1',
    nume_parcela: 'Parcela Nord',
    suprafata_m2: 1000,
  },
})

describe('parcela tratamente page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getParcelaTratamenteContext.mockResolvedValue(parcela)
    mocks.getPlanActivPentruParcela.mockResolvedValue(null)
    mocks.listStadiiPentruParcela.mockResolvedValue([])
    mocks.listAplicariParcela.mockResolvedValue([])
    mocks.listPlanuriTratament.mockResolvedValue([])
    mocks.getGrupBiologicParcela.mockResolvedValue('rubus')
    mocks.getParcelaPentruConfigurareSezon.mockResolvedValue(parcela)
    mocks.getOrCreateConfigurareSezon.mockResolvedValue({
      id: 'cfg-1',
      tenant_id: 't1',
      parcela_id: parcela.id,
      an: 2026,
      sistem_conducere: 'primocane_only',
      tip_ciclu_soi: null,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    })
    mocks.genereazaAplicariPentruParcela.mockResolvedValue({ propuneri: [], createdCount: 0, skippedCount: 0 })
  })

  it('afișează empty state global și nu arată FAB când nu există nimic', async () => {
    const element = await Page({ params: Promise.resolve({ id: parcela.id }) })
    render(element)

    expect(screen.getAllByText('Protecție & Nutriție').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Începe modulul de tratamente pentru această parcelă')).toBeInTheDocument()
    expect(screen.getByText('Creează primul plan de tratament')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Creează primul plan' })).toHaveAttribute(
      'href',
      `/tratamente/planuri/nou?parcela_id=${parcela.id}`
    )
    expect(screen.getByRole('link', { name: /Importă din Excel/i })).toHaveAttribute(
      'href',
      '/tratamente/planuri/import'
    )
    expect(screen.getByText('Nu ai înregistrat niciun stadiu anul acesta.')).toBeInTheDocument()
    expect(screen.getByText('Nicio parcelă asignată pentru 2026')).toBeInTheDocument()
    expect(screen.getByText('Nu există încă aplicări planificate pentru această parcelă în anul curent.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Generează aplicări' })).not.toBeInTheDocument()
  })

  it('afișează stadiul și empty state de plan/aplicări fără FAB când lipsește planul', async () => {
    mocks.listStadiiPentruParcela.mockResolvedValue([stadiu])

    const element = await Page({ params: Promise.resolve({ id: parcela.id }) })
    render(element)

    expect(screen.getByText('Buton verde')).toBeInTheDocument()
    expect(screen.getByText('Nicio parcelă asignată pentru 2026')).toBeInTheDocument()
    expect(screen.getByText('Nu există încă aplicări planificate pentru această parcelă în anul curent.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Generează aplicări' })).not.toBeInTheDocument()
  })

  it('afișează planul, cele 3 aplicări și FAB-ul în happy path', async () => {
    mocks.getPlanActivPentruParcela.mockResolvedValue({
      id: 'pp1',
      tenant_id: 't1',
      parcela_id: parcela.id,
      plan_id: plan.id,
      an: 2026,
      activ: true,
      created_at: '2026-04-12T08:00:00Z',
      updated_at: '2026-04-12T08:00:00Z',
      plan,
    })
    mocks.listStadiiPentruParcela.mockResolvedValue([stadiu])
    mocks.listAplicariParcela.mockResolvedValue([
      buildAplicare('a1', 'fungicid'),
      buildAplicare('a2', 'insecticid'),
      buildAplicare('a3', 'ingrasamant_foliar'),
    ])
    mocks.listPlanuriTratament.mockResolvedValue([plan])

    const element = await Page({ params: Promise.resolve({ id: parcela.id }) })
    render(element)

    expect(screen.getByText('Plan zmeur primăvară 2026')).toBeInTheDocument()
    expect(screen.getByText('zmeur')).toBeInTheDocument()
    expect(screen.getByText('Produs a1')).toBeInTheDocument()
    expect(screen.getByText('Produs a2')).toBeInTheDocument()
    expect(screen.getByText('Produs a3')).toBeInTheDocument()
    expect(screen.getByText('Plan activ pentru anul 2026')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Generează aplicări' })).toBeInTheDocument()
  })

  it('afișează bannerul de configurare când rubus nu are sistem de conducere definit', async () => {
    mocks.getParcelaPentruConfigurareSezon.mockResolvedValue({
      ...parcela,
      soi: 'Soi necunoscut',
      soi_plantat: 'Soi necunoscut',
    })
    mocks.getOrCreateConfigurareSezon.mockResolvedValue({
      id: 'cfg-2',
      tenant_id: 't1',
      parcela_id: parcela.id,
      an: 2026,
      sistem_conducere: null,
      tip_ciclu_soi: null,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    })

    const element = await Page({ params: Promise.resolve({ id: parcela.id }) })
    render(element)

    expect(screen.getByText(/Configurează sistemul de conducere pentru 2026/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Configurează' })).toBeInTheDocument()
  })
})
