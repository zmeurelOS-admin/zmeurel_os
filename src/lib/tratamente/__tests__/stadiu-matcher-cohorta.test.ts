import { describe, expect, it } from 'vitest'

import { matchLiniiCuStadii } from '@/lib/tratamente/generator/stadiu-matcher'
import type { PlanLinie, StadiuInregistrat } from '@/lib/tratamente/generator/types'

const linieGeneric: PlanLinie = {
  id: 'linie-generic',
  planId: 'plan-1',
  ordine: 1,
  stadiuTrigger: 'inflorit',
  cohortTrigger: null,
  produsId: 'prod-1',
  produsNumeManual: null,
  dozaMlPerHl: 80,
  dozaLPerHa: null,
  observatii: null,
}

const linieFloricane: PlanLinie = {
  ...linieGeneric,
  id: 'linie-floricane',
  cohortTrigger: 'floricane',
}

const liniePrimocane: PlanLinie = {
  ...linieGeneric,
  id: 'linie-primocane',
  stadiuTrigger: 'crestere_vegetativa',
  cohortTrigger: 'primocane',
}

const stadiiMixed: StadiuInregistrat[] = [
  {
    id: 'st-1',
    parcelaId: 'parcela-1',
    an: 2026,
    stadiu: 'inflorit',
    cohort: 'floricane',
    dataObservata: '2026-05-18',
    sursa: 'manual',
  },
  {
    id: 'st-2',
    parcelaId: 'parcela-1',
    an: 2026,
    stadiu: 'crestere_vegetativa',
    cohort: 'primocane',
    dataObservata: '2026-05-18',
    sursa: 'manual',
  },
]

describe('matchLiniiCuStadii — dual cohorta', () => {
  it('pentru parcelă non-Rubus păstrează matching-ul clasic', () => {
    const rezultate = matchLiniiCuStadii(
      [linieGeneric],
      [{ ...stadiiMixed[0]!, cohort: null }],
      { isRubusMixt: false, stadiuFloricane: null, stadiuPrimocane: null, stadiu: 'inflorit' },
    )

    expect(rezultate).toHaveLength(1)
    expect(rezultate[0]?.cohortLaAplicare ?? null).toBeNull()
  })

  it('pentru Rubus primocane_only păstrează matching-ul clasic', () => {
    const rezultate = matchLiniiCuStadii(
      [linieGeneric],
      [{ ...stadiiMixed[1]!, cohort: null }],
      { isRubusMixt: false, stadiuFloricane: null, stadiuPrimocane: null, stadiu: 'crestere_vegetativa' },
    )

    expect(rezultate).toHaveLength(0)
  })

  it('pentru Rubus mixt, linia fără cohort_trigger se potrivește pe oricare cohortă atinsă', () => {
    const rezultate = matchLiniiCuStadii(
      [linieGeneric],
      stadiiMixed,
      { isRubusMixt: true, stadiuFloricane: 'inflorit', stadiuPrimocane: 'crestere_vegetativa', stadiu: null },
    )

    expect(rezultate).toHaveLength(1)
    expect(rezultate[0]?.cohortLaAplicare ?? null).toBeNull()
  })

  it('pentru Rubus mixt, linia cu cohort_trigger=floricane se potrivește strict pe floricane', () => {
    const rezultate = matchLiniiCuStadii(
      [linieFloricane],
      stadiiMixed,
      { isRubusMixt: true, stadiuFloricane: 'inflorit', stadiuPrimocane: 'crestere_vegetativa', stadiu: null },
    )

    expect(rezultate).toHaveLength(1)
    expect(rezultate[0]?.cohortLaAplicare).toBe('floricane')
  })

  it('pentru Rubus mixt, cohortele în stadii diferite păstrează matching separat', () => {
    const rezultate = matchLiniiCuStadii(
      [linieFloricane, liniePrimocane],
      stadiiMixed,
      { isRubusMixt: true, stadiuFloricane: 'inflorit', stadiuPrimocane: 'crestere_vegetativa', stadiu: null },
    )

    expect(rezultate.map((item) => [item.id, item.cohortLaAplicare])).toEqual([
      ['linie-floricane', 'floricane'],
      ['linie-primocane', 'primocane'],
    ])
  })
})
