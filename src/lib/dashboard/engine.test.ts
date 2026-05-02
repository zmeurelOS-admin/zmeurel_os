import { describe, expect, it } from 'vitest'

import {
  buildDashboardAlerts,
  buildDashboardTasks,
  buildParcelDashboardStates,
  type DashboardRawData,
} from '@/lib/dashboard/engine'
import type { DashboardTreatmentSuggestion } from '@/lib/dashboard/treatment-suggestions'
import type { Parcela } from '@/lib/supabase/queries/parcele'

function makeParcela(overrides: Partial<Parcela> = {}): Parcela {
  return {
    id: overrides.id ?? 'parcela-1',
    id_parcela: 'P-1',
    nume_parcela: overrides.nume_parcela ?? 'Parcela Nord',
    tip_fruct: null,
    soi_plantat: null,
    suprafata_m2: 1500,
    nr_plante: null,
    an_plantare: null,
    status: null,
    gps_lat: null,
    gps_lng: null,
    latitudine: null,
    longitudine: null,
    observatii: null,
    tip_unitate: overrides.tip_unitate ?? 'camp',
    cultura: null,
    soi: null,
    nr_randuri: null,
    distanta_intre_randuri: null,
    sistem_irigare: null,
    data_plantarii: null,
    created_at: '2026-05-01T00:00:00.000Z',
    created_by: null,
    updated_at: '2026-05-01T00:00:00.000Z',
    updated_by: null,
    tenant_id: 'tenant-1',
    data_origin: null,
    demo_seed_id: null,
    stadiu: null,
    rol: 'comercial',
    apare_in_dashboard: true,
    contribuie_la_productie: true,
    status_operational: 'activ',
    ...overrides,
  } as Parcela
}

function makeRawData(
  overrides: Partial<DashboardRawData> = {},
): DashboardRawData {
  return {
    currentDay: new Date('2026-05-02T09:00:00.000Z'),
    todayIso: '2026-05-02',
    yesterdayIso: '2026-05-01',
    tomorrowIso: '2026-05-03',
    seasonStartIso: '2026-03-01',
    previousSeasonStartIso: '2025-03-01',
    previousSeasonEndIso: '2025-05-02',
    parceleDashboard: [makeParcela()],
    activitatiDashboard: [
      {
        id: 'act-trat',
        id_activitate: 'A-1',
        tenant_id: 'tenant-1',
        parcela_id: 'parcela-1',
        tip_activitate: 'Tratament',
        tip_deprecat: false,
        produs_utilizat: 'Switch 62.5 WG',
        doza: null,
        timp_pauza_zile: 5,
        data_aplicare: '2026-04-20',
        observatii: null,
        operator: null,
        client_sync_id: 'sync-1',
        sync_status: null,
        conflict_flag: null,
        created_at: '2026-04-20T00:00:00.000Z',
        created_by: null,
        updated_at: '2026-04-20T00:00:00.000Z',
        updated_by: null,
      },
    ],
    recoltariDashboard: [],
    comenzi: [],
    stocuri: [],
    vanzari: [],
    cheltuieli: [],
    meteo: null,
    treatmentIntervalByParcela: new Map([['parcela-1', 7]]),
    nextTreatmentSuggestions: null,
    ...overrides,
  }
}

function makeSuggestion(
  overrides: Partial<DashboardTreatmentSuggestion> = {},
): DashboardTreatmentSuggestion {
  return {
    parcelaId: 'parcela-1',
    parcelaLabel: 'Parcela Nord',
    aplicareId: 'ap-1',
    planLabel: 'Plan zmeur 2026',
    interventieLabel: 'Protecție înflorit',
    produsLabel: 'Switch 62.5 WG',
    status: 'overdue',
    recommendedDate: '2026-05-01',
    firstSafeWindowLabel: null,
    reason: 'Aplicarea planificată pentru 2026-05-01 este depășită.',
    warnings: [],
    ...overrides,
  }
}

describe('dashboard engine treatment priority', () => {
  it('nu duplică semnalul legacy când există sugestie V2 overdue', () => {
    const raw = makeRawData({
      nextTreatmentSuggestions: {
        primary: makeSuggestion({ status: 'overdue' }),
        secondary: null,
      },
    })

    const states = buildParcelDashboardStates(raw)
    const tasks = buildDashboardTasks(raw, states)
    const alerts = buildDashboardAlerts(raw, states)

    expect(states[0]?.attentionFlags).not.toContain('treatment_overdue')
    expect(tasks.map((task) => task.id)).toContain('tratamente:recomandat-v2')
    expect(tasks.some((task) => task.id.startsWith('tratament:'))).toBe(false)
    expect(alerts.map((alert) => alert.id)).toContain('alert:tratamente-v2-overdue')
    expect(alerts.some((alert) => alert.id === 'alert:tratamente-depasite')).toBe(false)
  })

  it('păstrează fallback-ul legacy când sugestia V2 lipsește', () => {
    const raw = makeRawData()

    const states = buildParcelDashboardStates(raw)
    const tasks = buildDashboardTasks(raw, states)
    const alerts = buildDashboardAlerts(raw, states)

    expect(states[0]?.attentionFlags).toContain('treatment_overdue')
    expect(tasks.some((task) => task.id.startsWith('tratament:'))).toBe(true)
    expect(alerts.some((alert) => alert.id === 'alert:tratamente-depasite')).toBe(true)
  })

  it('afișează un avertisment critic când sugestia V2 este blocked', () => {
    const raw = makeRawData({
      nextTreatmentSuggestions: {
        primary: makeSuggestion({
          status: 'blocked',
          reason: 'Aplicarea este planificată azi. PHI-ul este încă activ.',
          warnings: ['phi'],
        }),
        secondary: null,
      },
    })

    const states = buildParcelDashboardStates(raw)
    const alerts = buildDashboardAlerts(raw, states)

    expect(alerts).toContainEqual({
      id: 'alert:tratamente-v2-blocked',
      category: 'tratamente',
      severity: 'critical',
      message: 'Tratament blocat: Aplicarea este planificată azi. PHI-ul este încă activ.',
    })
  })

  it('nu emite semnal fals de tratament urgent când sugestia V2 este weather_wait', () => {
    const raw = makeRawData({
      nextTreatmentSuggestions: {
        primary: makeSuggestion({
          status: 'weather_wait',
          reason: 'Aplicarea este planificată azi. Nu există încă o fereastră meteo sigură în următoarele 24h.',
          warnings: ['meteo'],
        }),
        secondary: null,
      },
    })

    const states = buildParcelDashboardStates(raw)
    const tasks = buildDashboardTasks(raw, states)
    const alerts = buildDashboardAlerts(raw, states)

    expect(states[0]?.attentionFlags).not.toContain('treatment_overdue')
    expect(tasks.some((task) => task.id === 'tratamente:recomandat-v2')).toBe(false)
    expect(alerts.some((alert) => alert.category === 'tratamente')).toBe(false)
  })
})
