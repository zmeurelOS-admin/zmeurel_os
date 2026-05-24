import { describe, expect, it } from 'vitest'

import {
  mapAplicariCrossParcelToJurnal,
  type AplicareCrossParcelItem,
  type AplicareProdusV2,
} from '@/lib/supabase/queries/tratamente'

function makeProdus(overrides: Partial<AplicareProdusV2> = {}): AplicareProdusV2 {
  return {
    id: overrides.id ?? 'aplicare-produs-1',
    tenant_id: 'tenant-1',
    aplicare_id: 'aplicare-1',
    plan_linie_produs_id: null,
    ordine: 1,
    produs_id: overrides.produs_id ?? null,
    produs_nume_manual: overrides.produs_nume_manual ?? null,
    produs_nume_snapshot: overrides.produs_nume_snapshot ?? 'Switch 62.5 WG',
    substanta_activa_snapshot: null,
    tip_snapshot: null,
    frac_irac_snapshot: null,
    phi_zile_snapshot: null,
    doza_ml_per_hl: overrides.doza_ml_per_hl ?? null,
    doza_l_per_ha: overrides.doza_l_per_ha ?? null,
    cantitate_totala: null,
    unitate_cantitate: null,
    cantitate_text: overrides.cantitate_text ?? '0.6 kg/ha',
    stoc_mutatie_id: null,
    observatii: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    produs: overrides.produs ?? null,
    plan_linie_produs: null,
    ...overrides,
  }
}

function makeAplicare(overrides: Partial<AplicareCrossParcelItem> = {}): AplicareCrossParcelItem {
  return {
    id: overrides.id ?? 'aplicare-1',
    tenant_id: 'tenant-1',
    parcela_id: overrides.parcela_id ?? 'parcela-1',
    cultura_id: null,
    plan_linie_id: null,
    sursa: 'manuala',
    produs_id: null,
    produs_nume_manual: null,
    data_programata: null,
    data_planificata: overrides.data_planificata ?? null,
    data_aplicata: overrides.data_aplicata ?? '2026-05-09',
    status: overrides.status ?? 'aplicata',
    tip_interventie: null,
    scop: null,
    metoda_aplicare: overrides.metoda_aplicare ?? 'foliar',
    parcela_nume: overrides.parcela_nume ?? 'Maravilla',
    parcela_cod: 'M-1',
    parcela_suprafata_m2: 4000,
    parcela_lat: null,
    parcela_lng: null,
    plan_id: null,
    plan_nume: null,
    plan_arhivat: null,
    linie_id: null,
    stadiu_trigger: null,
    produs_nume: overrides.produs_nume ?? 'Produs fallback',
    produs_tip: null,
    produs_frac: null,
    produs_phi_zile: null,
    doza_ml_per_hl: null,
    doza_l_per_ha: null,
    observatii: null,
    operator: null,
    meteo_snapshot: null,
    produse_aplicare: overrides.produse_aplicare ?? [makeProdus()],
    produse_planificate: [],
    phi_warning: false,
    urmatoarea_recoltare: null,
    ...overrides,
  }
}

describe('mapAplicariCrossParcelToJurnal', () => {
  it('păstrează doar aplicările aplicate sau ciornele', () => {
    const result = mapAplicariCrossParcelToJurnal([
      makeAplicare({ id: 'aplicata', status: 'aplicata' }),
      makeAplicare({ id: 'ciorna', status: 'ciorna' }),
      makeAplicare({ id: 'planificata', status: 'planificata' }),
    ])

    expect(result.map((item) => item.aplicareId)).toEqual(['aplicata', 'ciorna'])
  })

  it('ordonează jurnalul descrescător după data efectivă', () => {
    const result = mapAplicariCrossParcelToJurnal([
      makeAplicare({ id: 'vechi', data_aplicata: '2026-05-01' }),
      makeAplicare({ id: 'nou', data_aplicata: '2026-05-10' }),
      makeAplicare({ id: 'mijloc', data_aplicata: '2026-05-05' }),
    ])

    expect(result.map((item) => item.aplicareId)).toEqual(['nou', 'mijloc', 'vechi'])
  })

  it('agregă produsele și dozele din aplicare', () => {
    const result = mapAplicariCrossParcelToJurnal([
      makeAplicare({
        id: 'mix',
        produse_aplicare: [
          makeProdus({ id: 'p1', produs_nume_snapshot: 'Movento', cantitate_text: '0.75 L/ha' }),
          makeProdus({ id: 'p2', produs_nume_snapshot: 'Calbit C', cantitate_text: '2.5 L/ha' }),
        ],
      }),
    ])

    expect(result[0]?.produse).toEqual([
      { nume: 'Movento', dozaText: '0.75 L/ha' },
      { nume: 'Calbit C', dozaText: '2.5 L/ha' },
    ])
  })

  it('respectă limita cerută', () => {
    const result = mapAplicariCrossParcelToJurnal([
      makeAplicare({ id: '1', data_aplicata: '2026-05-03' }),
      makeAplicare({ id: '2', data_aplicata: '2026-05-02' }),
      makeAplicare({ id: '3', data_aplicata: '2026-05-01' }),
    ], 2)

    expect(result.map((item) => item.aplicareId)).toEqual(['1', '2'])
  })
})
