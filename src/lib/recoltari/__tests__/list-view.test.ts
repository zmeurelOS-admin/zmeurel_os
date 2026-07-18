import { describe, expect, it } from 'vitest'

import {
  calculateTodayRecoltariDashboard,
  filterRecoltariForList,
  groupRecoltariByDay,
  type RecoltariFilterState,
} from '@/lib/recoltari/list-view'
import type { Recoltare } from '@/lib/supabase/queries/recoltari'

function makeRecoltare(overrides: Partial<Recoltare>): Recoltare {
  return {
    id: overrides.id ?? 'r-1',
    id_recoltare: overrides.id_recoltare ?? 'REC-1',
    data: overrides.data ?? '2026-07-18',
    parcela_id: overrides.parcela_id ?? 'parcela-1',
    culegator_id: overrides.culegator_id ?? 'worker-1',
    kg_cal1: overrides.kg_cal1 ?? 0,
    kg_cal2: overrides.kg_cal2 ?? 0,
    pret_lei_pe_kg_snapshot: overrides.pret_lei_pe_kg_snapshot ?? 5,
    valoare_munca_lei: overrides.valoare_munca_lei ?? 0,
    observatii: overrides.observatii ?? null,
    created_at: overrides.created_at ?? '2026-07-18T08:00:00.000Z',
    updated_at: overrides.updated_at ?? '2026-07-18T08:00:00.000Z',
    tenant_id: overrides.tenant_id ?? 'tenant-1',
  }
}

const parcelaMap = {
  'parcela-1': { name: 'Maravilla 1', displayName: 'Maravilla 1', soi: 'Maravilla', status: 'activ', tipLabel: 'Parcelă' },
  'parcela-2': { name: 'Kweli Nord', displayName: 'Kweli Nord', soi: 'Kweli', status: 'activ', tipLabel: 'Solar' },
}

const culegatorMap = {
  'worker-1': { nume: 'Ana Pop', tarif: 5 },
  'worker-2': { nume: 'Ion Ionescu', tarif: 6 },
}

const baseFilters: RecoltariFilterState = {
  searchTerm: '',
  timeFilter: 'luna',
  parcelaId: 'all',
  culegatorId: 'all',
  customStartDate: '',
  customEndDate: '',
}

describe('recoltari list view helpers', () => {
  it('calculează dashboard-ul de azi independent de filtrele listei', () => {
    const rows = [
      makeRecoltare({ id: 'today-1', data: '2026-07-18', kg_cal1: 3, kg_cal2: 1, valoare_munca_lei: 20 }),
      makeRecoltare({ id: 'today-2', data: '2026-07-18', parcela_id: 'parcela-2', culegator_id: 'worker-2', kg_cal1: 2, kg_cal2: 0.5, valoare_munca_lei: 15 }),
      makeRecoltare({ id: 'old', data: '2026-07-14', kg_cal1: 99, kg_cal2: 99, valoare_munca_lei: 999 }),
    ]

    const dashboard = calculateTodayRecoltariDashboard(rows, '2026-07-18')
    const filtered = filterRecoltariForList({
      recoltari: rows,
      filters: { ...baseFilters, parcelaId: 'parcela-2', culegatorId: 'worker-2', searchTerm: 'kweli' },
      parcelaMap,
      culegatorMap,
      todayIso: '2026-07-18',
      currentWeekStartIso: '2026-07-13',
      currentMonthStartIso: '2026-07-01',
    })

    expect(dashboard).toEqual({ cal1Kg: 5, cal2Kg: 1.5, paidLei: 35 })
    expect(filtered.map((row) => row.id)).toEqual(['today-2'])
  })

  it('combină filtrele și grupează rezultatele pe zi descrescător', () => {
    const rows = [
      makeRecoltare({ id: 'match-new', data: '2026-07-18', parcela_id: 'parcela-1', culegator_id: 'worker-1', kg_cal1: 4, kg_cal2: 1, valoare_munca_lei: 25 }),
      makeRecoltare({ id: 'match-old', data: '2026-07-17', parcela_id: 'parcela-1', culegator_id: 'worker-1', kg_cal1: 2, kg_cal2: 0, valoare_munca_lei: 10 }),
      makeRecoltare({ id: 'wrong-worker', data: '2026-07-18', parcela_id: 'parcela-1', culegator_id: 'worker-2', kg_cal1: 10, kg_cal2: 0, valoare_munca_lei: 60 }),
      makeRecoltare({ id: 'wrong-parcel', data: '2026-07-18', parcela_id: 'parcela-2', culegator_id: 'worker-1', kg_cal1: 10, kg_cal2: 0, valoare_munca_lei: 50 }),
      makeRecoltare({ id: 'wrong-month', data: '2026-06-30', parcela_id: 'parcela-1', culegator_id: 'worker-1', kg_cal1: 10, kg_cal2: 0, valoare_munca_lei: 50 }),
    ]

    const filtered = filterRecoltariForList({
      recoltari: rows,
      filters: { ...baseFilters, parcelaId: 'parcela-1', culegatorId: 'worker-1' },
      parcelaMap,
      culegatorMap,
      todayIso: '2026-07-18',
      currentWeekStartIso: '2026-07-13',
      currentMonthStartIso: '2026-07-01',
    })
    const groups = groupRecoltariByDay(filtered)

    expect(filtered.map((row) => row.id)).toEqual(['match-new', 'match-old'])
    expect(groups.map((group) => group.date)).toEqual(['2026-07-18', '2026-07-17'])
    expect(groups[0]).toMatchObject({ harvestCount: 1, totalKg: 5, cal1Kg: 4, cal2Kg: 1, paidLei: 25 })
  })
})
