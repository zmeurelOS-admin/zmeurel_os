import { describe, expect, it } from 'vitest'

import {
  completeazaRecomandariCuReguliPlatforma,
  type RecomandareInterventie,
  type RegulaRecomandarePlatforma,
} from '@/lib/supabase/queries/tratamente'

function makePlanRecomandare(id: string, produsNume = `Produs plan ${id}`): RecomandareInterventie {
  return {
    linieId: `linie-${id}`,
    titlu: `Plan ${id}`,
    stadiuTrigger: 'inflorit',
    sursa: 'plan',
    produse: [
      {
        nume: produsNume,
        dozaSugerataMlPerHl: null,
        dozaSugerataLPerHa: null,
        cantitateText: '1 L/ha',
      },
    ],
  }
}

function makeRegula(overrides: Partial<RegulaRecomandarePlatforma> = {}): RegulaRecomandarePlatforma {
  const id = overrides.id ?? `regula-${overrides.cod ?? 'test'}`
  return {
    id,
    cod: overrides.cod ?? id,
    cultura_tip: 'zmeur',
    fenofaza: 'inflorit',
    metoda_aplicare: 'foliar',
    cohort: null,
    luni_active: null,
    titlu: overrides.titlu ?? `Regula ${id}`,
    descriere: null,
    produs_sugerat_nume: overrides.produs_sugerat_nume ?? `Produs regula ${id}`,
    produs_sugerat_doza_text: overrides.produs_sugerat_doza_text ?? '0.2 L/ha',
    tip_interventie: 'protectie',
    prioritate: overrides.prioritate ?? 50,
    activ: overrides.activ ?? true,
    sursa: 'standard_agronomic',
    ...overrides,
  }
}

describe('recomandari reguli platforma', () => {
  it('returnează doar planul când planul activ are cel puțin 3 recomandări', () => {
    const result = completeazaRecomandariCuReguliPlatforma({
      recomandariPlan: [
        makePlanRecomandare('1'),
        makePlanRecomandare('2'),
        makePlanRecomandare('3'),
      ],
      reguli: [makeRegula({ id: 'fallback-1', prioritate: 100 })],
      cohort: null,
      lunaCurenta: 7,
    })

    expect(result.map((item) => item.sursa)).toEqual(['plan', 'plan', 'plan'])
    expect(result.map((item) => item.linieId)).toEqual(['linie-1', 'linie-2', 'linie-3'])
  })

  it('completează un plan insuficient cu reguli până la maxim 5 recomandări', () => {
    const result = completeazaRecomandariCuReguliPlatforma({
      recomandariPlan: [makePlanRecomandare('1')],
      reguli: [
        makeRegula({ id: 'r1', prioritate: 90 }),
        makeRegula({ id: 'r2', prioritate: 80 }),
        makeRegula({ id: 'r3', prioritate: 70 }),
        makeRegula({ id: 'r4', prioritate: 60 }),
        makeRegula({ id: 'r5', prioritate: 50 }),
      ],
      cohort: null,
      lunaCurenta: 7,
    })

    expect(result).toHaveLength(5)
    expect(result[0]?.sursa).toBe('plan')
    expect(result.slice(1).map((item) => item.sursa)).toEqual([
      'platforma',
      'platforma',
      'platforma',
      'platforma',
    ])
  })

  it('folosește doar reguli când planul activ lipsește', () => {
    const result = completeazaRecomandariCuReguliPlatforma({
      recomandariPlan: [],
      reguli: [
        makeRegula({ id: 'r1', prioritate: 10 }),
        makeRegula({ id: 'r2', prioritate: 20 }),
      ],
      cohort: null,
      lunaCurenta: 7,
    })

    expect(result.map((item) => item.sursa)).toEqual(['platforma', 'platforma'])
    expect(result.map((item) => item.linieId)).toEqual(['regula_r2', 'regula_r1'])
  })

  it('filtrează regulile pe cohort', () => {
    const result = completeazaRecomandariCuReguliPlatforma({
      recomandariPlan: [],
      reguli: [
        makeRegula({ id: 'primocane', cohort: 'primocane', prioritate: 90 }),
        makeRegula({ id: 'floricane', cohort: 'floricane', prioritate: 80 }),
        makeRegula({ id: 'general', cohort: null, prioritate: 70 }),
      ],
      cohort: 'primocane',
      lunaCurenta: 7,
    })

    expect(result.map((item) => item.linieId)).toEqual(['regula_primocane', 'regula_general'])
  })

  it('filtrează regulile pe lunile active', () => {
    const result = completeazaRecomandariCuReguliPlatforma({
      recomandariPlan: [],
      reguli: [
        makeRegula({ id: 'vara', luni_active: [7, 8], prioritate: 90 }),
        makeRegula({ id: 'tot-anul', luni_active: null, prioritate: 80 }),
      ],
      cohort: null,
      lunaCurenta: 3,
    })

    expect(result.map((item) => item.linieId)).toEqual(['regula_tot-anul'])
  })

  it('elimină fallback-ul cu același produs ca recomandarea din plan', () => {
    const result = completeazaRecomandariCuReguliPlatforma({
      recomandariPlan: [makePlanRecomandare('laser', 'Laser 240 SC')],
      reguli: [
        makeRegula({ id: 'duplicat', produs_sugerat_nume: 'Laser 240 SC', prioritate: 90 }),
        makeRegula({ id: 'nou', produs_sugerat_nume: 'Switch 62.5 WG', prioritate: 80 }),
      ],
      cohort: null,
      lunaCurenta: 7,
    })

    expect(result.map((item) => item.produse[0]?.nume)).toEqual(['Laser 240 SC', 'Switch 62.5 WG'])
  })

  it('ordonează regulile fallback după prioritate descrescătoare', () => {
    const result = completeazaRecomandariCuReguliPlatforma({
      recomandariPlan: [],
      reguli: [
        makeRegula({ id: 'jos', prioritate: 10 }),
        makeRegula({ id: 'sus', prioritate: 95 }),
        makeRegula({ id: 'mijloc', prioritate: 50 }),
      ],
      cohort: null,
      lunaCurenta: 7,
    })

    expect(result.map((item) => item.linieId)).toEqual(['regula_sus', 'regula_mijloc', 'regula_jos'])
  })
})
