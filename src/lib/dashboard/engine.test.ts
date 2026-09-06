import { describe, expect, it } from 'vitest'

import {
  buildDashboardAlerts,
  buildDashboardTasks,
  buildParcelDashboardStates,
  type DashboardRawData,
} from '@/lib/dashboard/engine'
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
    ...overrides,
  }
}

describe('dashboard engine treatment priority', () => {
  it('semnalează tratamentul depășit din activitatea legacy + intervalul culturii', () => {
    const raw = makeRawData()

    const states = buildParcelDashboardStates(raw)
    const tasks = buildDashboardTasks(raw, states)
    const alerts = buildDashboardAlerts(raw, states)

    expect(states[0]?.attentionFlags).toContain('treatment_overdue')
    expect(tasks.some((task) => task.id.startsWith('tratament:'))).toBe(true)
    expect(alerts.some((alert) => alert.id === 'alert:tratamente-depasite')).toBe(true)
  })
})
