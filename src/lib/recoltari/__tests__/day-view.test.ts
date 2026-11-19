import { describe, expect, it } from 'vitest'

import {
  estimatePaymentLei,
  formatKg,
  formatKgValue,
  formatLei,
  formatTarif,
  kgByCulegator,
  lastUsedParcelaId,
  recoltariOfDay,
  savedDiffersFromAttempt,
  shortDayLabel,
  splitWorkerName,
  summarizeRecoltariDay,
  type RecoltareAttempt,
} from '@/lib/recoltari/day-view'
import type { Recoltare } from '@/lib/supabase/queries/recoltari'

function makeRecoltare(overrides: Partial<Recoltare>): Recoltare {
  return {
    id: overrides.id ?? 'r-1',
    id_recoltare: overrides.id_recoltare ?? 'REC-1',
    data: overrides.data ?? '2026-11-19',
    parcela_id: overrides.parcela_id === undefined ? 'parcela-1' : overrides.parcela_id,
    culegator_id: overrides.culegator_id === undefined ? 'worker-1' : overrides.culegator_id,
    kg_cal1: overrides.kg_cal1 ?? 0,
    kg_cal2: overrides.kg_cal2 ?? 0,
    pret_lei_pe_kg_snapshot: overrides.pret_lei_pe_kg_snapshot ?? 2.5,
    valoare_munca_lei: overrides.valoare_munca_lei ?? 0,
    observatii: overrides.observatii ?? null,
    created_at: overrides.created_at ?? '2026-11-19T16:00:00.000Z',
    updated_at: overrides.updated_at ?? '2026-11-19T16:00:00.000Z',
    tenant_id: overrides.tenant_id ?? 'tenant-1',
  }
}

const TODAY = '2026-11-19'

describe('recoltări — ziua', () => {
  const rows = [
    makeRecoltare({ id: 'a', culegator_id: 'worker-1', kg_cal1: 20.5, kg_cal2: 6.85, valoare_munca_lei: 68.38 }),
    makeRecoltare({ id: 'b', culegator_id: 'worker-1', kg_cal1: 10, valoare_munca_lei: 25 }),
    makeRecoltare({ id: 'c', culegator_id: 'worker-2', kg_cal1: 8, kg_cal2: 2, valoare_munca_lei: 30 }),
    makeRecoltare({ id: 'd', culegator_id: null, kg_cal1: 1, valoare_munca_lei: 0 }),
    makeRecoltare({ id: 'ieri', data: '2026-11-18', culegator_id: 'worker-3', kg_cal1: 99, valoare_munca_lei: 99 }),
  ]

  it('alege doar recoltările zilei cerute, și când data are și oră', () => {
    expect(recoltariOfDay(rows, TODAY).map((row) => row.id)).toEqual(['a', 'b', 'c', 'd'])
    expect(recoltariOfDay(rows, '2026-11-18').map((row) => row.id)).toEqual(['ieri'])
    expect(recoltariOfDay([makeRecoltare({ id: 'x', data: '2026-11-19T00:00:00' })], TODAY)).toHaveLength(1)
    expect(recoltariOfDay(rows, '2026-11-17')).toEqual([])
  })

  it('adună totalurile zilei și numără culegătorii diferiți', () => {
    expect(summarizeRecoltariDay(recoltariOfDay(rows, TODAY))).toEqual({
      totalKg: 48.35,
      cal1Kg: 39.5,
      cal2Kg: 8.85,
      paymentLei: 123.38,
      workerCount: 2,
      harvestCount: 4,
    })
  })

  it('o zi fără recoltări are totul pe zero', () => {
    expect(summarizeRecoltariDay([])).toEqual({
      totalKg: 0,
      cal1Kg: 0,
      cal2Kg: 0,
      paymentLei: 0,
      workerCount: 0,
      harvestCount: 0,
    })
  })

  it('adună kilogramele pe culegător, peste mai multe cântăriri', () => {
    expect(kgByCulegator(recoltariOfDay(rows, TODAY))).toEqual({ 'worker-1': 37.35, 'worker-2': 10 })
  })
})

describe('recoltări — valori implicite', () => {
  it('parcela implicită e a ultimei recoltări create, nu a celei cu data cea mai mare', () => {
    const rows = [
      makeRecoltare({ id: 'veche', parcela_id: 'parcela-1', data: '2026-11-19', created_at: '2026-11-19T08:00:00Z' }),
      makeRecoltare({ id: 'noua', parcela_id: 'parcela-2', data: '2026-11-18', created_at: '2026-11-19T18:00:00Z' }),
    ]
    expect(lastUsedParcelaId(rows)).toBe('parcela-2')
  })

  it('sare peste recoltările fără parcelă și peste parcelele care nu mai există', () => {
    const rows = [
      makeRecoltare({ id: 'a', parcela_id: 'parcela-1', created_at: '2026-11-19T08:00:00Z' }),
      makeRecoltare({ id: 'b', parcela_id: 'stearsa', created_at: '2026-11-19T18:00:00Z' }),
      makeRecoltare({ id: 'c', parcela_id: null, created_at: '2026-11-19T19:00:00Z' }),
    ]
    expect(lastUsedParcelaId(rows, new Set(['parcela-1']))).toBe('parcela-1')
    expect(lastUsedParcelaId([])).toBeNull()
  })

  it('desparte numele în inițială, primul cuvânt și rest', () => {
    expect(splitWorkerName('Maria Onofrei')).toEqual({ initial: 'M', first: 'Maria', rest: 'Onofrei' })
    expect(splitWorkerName('  ștefan   cel mare ')).toEqual({ initial: 'Ș', first: 'ștefan', rest: 'cel mare' })
    expect(splitWorkerName('Ana')).toEqual({ initial: 'A', first: 'Ana', rest: '' })
    expect(splitWorkerName('')).toEqual({ initial: '?', first: 'Fără nume', rest: '' })
    expect(splitWorkerName(null)).toEqual({ initial: '?', first: 'Fără nume', rest: '' })
  })

  it('plata estimată e kg × tarif, rotunjită la bani', () => {
    expect(estimatePaymentLei(27.35, 2.5)).toBe(68.38)
    expect(estimatePaymentLei(0, 2.5)).toBe(0)
    expect(estimatePaymentLei(10, 0)).toBe(0)
  })

  it('fără tarif nu există plată estimată', () => {
    expect(estimatePaymentLei(10, null)).toBeNull()
    expect(estimatePaymentLei(10, undefined)).toBeNull()
    expect(estimatePaymentLei(10, Number.NaN)).toBeNull()
  })
})

describe('recoltări — ce a salvat serverul', () => {
  const attempt: RecoltareAttempt = {
    culegator_id: 'worker-1',
    parcela_id: 'parcela-1',
    data: TODAY,
    kg_cal1: 27.35,
    kg_cal2: 0,
  }

  it('spune când serverul a salvat altceva decât s-a trimis', () => {
    expect(savedDiffersFromAttempt(makeRecoltare({ kg_cal1: 27.35 }), attempt)).toBe(false)
    expect(savedDiffersFromAttempt(makeRecoltare({ kg_cal1: 27.35, data: '2026-11-19T00:00:00' }), attempt)).toBe(false)
    expect(savedDiffersFromAttempt(makeRecoltare({ kg_cal1: 20 }), attempt)).toBe(true)
    expect(savedDiffersFromAttempt(makeRecoltare({ kg_cal1: 27.35, parcela_id: 'parcela-2' }), attempt)).toBe(true)
  })
})

describe('recoltări — afișare', () => {
  // Spațiul dintre număr și unitate e cel scris în cod; separatorul de mii vine din `ro-RO`.
  it('scrie kilogramele cu virgulă, fără zerouri de umplutură', () => {
    expect(formatKgValue(27.35)).toBe('27,35')
    expect(formatKgValue(27.3)).toBe('27,3')
    expect(formatKg(12)).toBe('12 kg')
    expect(formatKg(0)).toBe('0 kg')
  })

  it('numește ziua de azi și pe cea de ieri, inclusiv peste trecerea de lună', () => {
    expect(shortDayLabel('2026-11-19', '2026-11-19')).toMatch(/^Azi, 19 nov/)
    expect(shortDayLabel('2026-11-18', '2026-11-19')).toMatch(/^Ieri, 18 nov/)
    expect(shortDayLabel('2026-11-17', '2026-11-19')).toMatch(/^17 nov/)
    expect(shortDayLabel('2026-10-31', '2026-11-01')).toMatch(/^Ieri, 31 oct/)
    expect(shortDayLabel('nu-e-data', '2026-11-19')).toBe('nu-e-data')
  })

  it('scrie banii cu două zecimale', () => {
    expect(formatLei(68.375)).toBe('68,38 lei')
    expect(formatLei(50)).toBe('50,00 lei')
    expect(formatTarif(2.5)).toBe('2,50 lei/kg')
  })
})
