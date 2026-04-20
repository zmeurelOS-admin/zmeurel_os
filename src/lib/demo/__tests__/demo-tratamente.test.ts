import { describe, expect, it } from 'vitest'

import {
  buildDemoTratamenteFixture,
  DEMO_TRATAMENTE_FIXED_IDS,
  isDemoTratamenteFallbackRow,
} from '@/lib/demo/tratamente-demo'

const produseByName = {
  'Kocide 2000': 'prod-1',
  'Topas 100 EC': 'prod-2',
  'Switch 62.5 WG': 'prod-3',
  'Karate Zeon': 'prod-4',
  'Thiovit Jet': 'prod-5',
  'Luna Sensation': 'prod-6',
  'Movento 100 SC': 'prod-7',
  'Teldor 500 SC': 'prod-8',
} as const

describe('demo tratamente fixtures', () => {
  it('generează exact 2 planuri, 13 linii, 2 stadii dual-cohortă și 5 aplicări pentru Maravilla', () => {
    const fixture = buildDemoTratamenteFixture({
      tenantId: 'tenant-1',
      parcelaId: 'parcela-1',
      produseByName: { ...produseByName },
      seedId: 'seed-1',
      parcelaMeta: {
        cultura: 'zmeur',
        soi_plantat: 'Maravilla',
      },
    })

    expect(fixture.planuri).toHaveLength(2)
    expect(fixture.linii).toHaveLength(13)
    expect(fixture.asignari).toHaveLength(1)
    expect(fixture.configurariSezon).toHaveLength(1)
    expect(fixture.stadii).toHaveLength(2)
    expect(fixture.aplicari).toHaveLength(5)
    expect(fixture.stadii.map((item) => item.cohort)).toEqual(['floricane', 'primocane'])
    expect(fixture.linii.filter((item) => item.cohort_trigger !== null)).toHaveLength(2)
  })

  it('lasă configurarea sezonieră neutră pentru un soi care nu este rubus', () => {
    const fixture = buildDemoTratamenteFixture({
      tenantId: 'tenant-1',
      parcelaId: 'parcela-1',
      produseByName: { ...produseByName },
      seedId: 'seed-1',
      parcelaMeta: {
        cultura: 'capsun',
        soi_plantat: 'Căpșun',
      },
    })

    expect(fixture.configurariSezon[0]?.sistem_conducere ?? null).toBeNull()
    expect(fixture.configurariSezon[0]?.tip_ciclu_soi ?? null).toBeNull()
  })

  it('identifică rândurile demo pentru cleanup după UUID fix', () => {
    expect(
      isDemoTratamenteFallbackRow('planuri_tratament', { id: DEMO_TRATAMENTE_FIXED_IDS.planuri.zmeur })
    ).toBe(true)
    expect(
      isDemoTratamenteFallbackRow('planuri_tratament_linii', { id: DEMO_TRATAMENTE_FIXED_IDS.linii.zmeur[0] })
    ).toBe(true)
    expect(
      isDemoTratamenteFallbackRow('aplicari_tratament', { id: DEMO_TRATAMENTE_FIXED_IDS.aplicari[4] })
    ).toBe(true)
    expect(
      isDemoTratamenteFallbackRow('configurari_parcela_sezon', {
        id: DEMO_TRATAMENTE_FIXED_IDS.configurari.primocane,
      })
    ).toBe(true)
  })

  it('este determinist și nu schimbă ID-urile între rulări', () => {
    const first = buildDemoTratamenteFixture({
      tenantId: 'tenant-1',
      parcelaId: 'parcela-1',
      produseByName: { ...produseByName },
      seedId: 'seed-1',
      parcelaMeta: {
        cultura: 'zmeur',
        soi_plantat: 'Delniwa',
      },
    })
    const second = buildDemoTratamenteFixture({
      tenantId: 'tenant-1',
      parcelaId: 'parcela-1',
      produseByName: { ...produseByName },
      seedId: 'seed-1',
      parcelaMeta: {
        cultura: 'zmeur',
        soi_plantat: 'Delniwa',
      },
    })

    expect(first.planuri.map((item) => item.id)).toEqual(second.planuri.map((item) => item.id))
    expect(first.linii.map((item) => item.id)).toEqual(second.linii.map((item) => item.id))
    expect(first.aplicari.map((item) => item.id)).toEqual(second.aplicari.map((item) => item.id))
    expect(first.configurariSezon.map((item) => item.id)).toEqual(second.configurariSezon.map((item) => item.id))
  })
})
