import { describe, expect, it } from 'vitest'

import { resolveRecurrence } from '@/lib/tratamente/recurrence'

describe('resolveRecurrence', () => {
  it('recurență fără aplicări anterioare propune azi', () => {
    const result = resolveRecurrence({
      todayIso: '2026-05-02',
      plannedDate: null,
      lastAppliedDate: null,
      appliedCount: 0,
      regulaRepetare: 'interval',
      intervalRepetareZile: 7,
      numarRepetariMax: null,
      productIntervalMinDays: [],
    })

    expect(result.source).toBe('first_due_now')
    expect(result.dueDate).toBe('2026-05-02')
  })

  it('recurență după o aplicare efectuată calculează următoarea repetare', () => {
    const result = resolveRecurrence({
      todayIso: '2026-05-02',
      plannedDate: null,
      lastAppliedDate: '2026-04-30',
      appliedCount: 1,
      regulaRepetare: 'interval',
      intervalRepetareZile: 7,
      numarRepetariMax: null,
      productIntervalMinDays: [],
    })

    expect(result.source).toBe('repeat_interval')
    expect(result.dueDate).toBe('2026-05-07')
    expect(result.reason).toContain('Următoarea repetare recomandată')
  })

  it('blochează recurența când numărul maxim de repetări este atins', () => {
    const result = resolveRecurrence({
      todayIso: '2026-05-02',
      plannedDate: null,
      lastAppliedDate: '2026-04-30',
      appliedCount: 2,
      regulaRepetare: 'interval',
      intervalRepetareZile: 7,
      numarRepetariMax: 2,
      productIntervalMinDays: [],
    })

    expect(result.maxReached).toBe(true)
    expect(result.dueDate).toBeNull()
    expect(result.reason).toContain('numărul maxim')
  })

  it('folosește intervalul produsului dacă este mai restrictiv', () => {
    const result = resolveRecurrence({
      todayIso: '2026-05-02',
      plannedDate: null,
      lastAppliedDate: '2026-05-01',
      appliedCount: 1,
      regulaRepetare: 'interval',
      intervalRepetareZile: 7,
      numarRepetariMax: null,
      productIntervalMinDays: [10],
    })

    expect(result.effectiveRepeatIntervalDays).toBe(10)
    expect(result.dueDate).toBe('2026-05-11')
    expect(result.reason).toContain('intervalul mai restrictiv al produsului')
  })

  it('respectă aplicarea deja planificată pentru aceeași linie', () => {
    const result = resolveRecurrence({
      todayIso: '2026-05-02',
      plannedDate: '2026-05-09',
      lastAppliedDate: '2026-05-01',
      appliedCount: 1,
      regulaRepetare: 'interval',
      intervalRepetareZile: 7,
      numarRepetariMax: null,
      productIntervalMinDays: [10],
    })

    expect(result.source).toBe('existing_planned')
    expect(result.dueDate).toBe('2026-05-09')
  })
})
