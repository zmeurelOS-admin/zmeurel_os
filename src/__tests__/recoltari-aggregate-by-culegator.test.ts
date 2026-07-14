import { describe, expect, it } from 'vitest'

import { aggregateRecoltariByCulegator } from '@/lib/recoltari/aggregate-by-culegator'
import type { Recoltare } from '@/lib/supabase/queries/recoltari'

function buildRecoltare(overrides: Partial<Recoltare>): Recoltare {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    id_recoltare: overrides.id_recoltare ?? 'REC-1',
    data: overrides.data ?? '2026-07-14',
    parcela_id: overrides.parcela_id ?? 'parcela-1',
    culegator_id: overrides.culegator_id ?? 'worker-1',
    kg_cal1: overrides.kg_cal1 ?? 0,
    kg_cal2: overrides.kg_cal2 ?? 0,
    pret_lei_pe_kg_snapshot: overrides.pret_lei_pe_kg_snapshot ?? 0,
    valoare_munca_lei: overrides.valoare_munca_lei ?? 0,
    observatii: overrides.observatii ?? null,
    created_at: overrides.created_at ?? '2026-07-14T08:00:00.000Z',
    updated_at: overrides.updated_at ?? '2026-07-14T08:00:00.000Z',
    tenant_id: overrides.tenant_id ?? 'tenant-1',
  }
}

describe('aggregateRecoltariByCulegator', () => {
  it('agregă plata din valoare_munca_lei, fără recalcul din tarif curent', () => {
    const aggregates = aggregateRecoltariByCulegator({
      recoltari: [
        buildRecoltare({
          id: 'r1',
          culegator_id: 'worker-1',
          kg_cal1: 8,
          kg_cal2: 2,
          pret_lei_pe_kg_snapshot: 3,
          valoare_munca_lei: 30,
        }),
        buildRecoltare({
          id: 'r2',
          culegator_id: 'worker-1',
          kg_cal1: 5,
          kg_cal2: 5,
          pret_lei_pe_kg_snapshot: 3,
          valoare_munca_lei: 40,
        }),
      ],
      resolveWorkerName: () => 'Ana',
    })

    expect(aggregates).toHaveLength(1)
    expect(aggregates[0]).toMatchObject({
      workerName: 'Ana',
      harvestCount: 2,
      totalKg: 20,
      totalCal1Kg: 13,
      totalCal2Kg: 7,
      totalPaymentLei: 70,
      uniformSnapshotRateLeiKg: 3,
      hasVariableRate: false,
    })
  })

  it('marchează rata variabilă când snapshot-urile diferă în aceeași perioadă', () => {
    const aggregates = aggregateRecoltariByCulegator({
      recoltari: [
        buildRecoltare({
          id: 'r1',
          culegator_id: 'worker-1',
          pret_lei_pe_kg_snapshot: 3,
          valoare_munca_lei: 15,
          kg_cal1: 5,
        }),
        buildRecoltare({
          id: 'r2',
          culegator_id: 'worker-1',
          pret_lei_pe_kg_snapshot: 4,
          valoare_munca_lei: 20,
          kg_cal1: 5,
        }),
      ],
      resolveWorkerName: () => 'Matei',
    })

    expect(aggregates[0]?.hasVariableRate).toBe(true)
    expect(aggregates[0]?.uniformSnapshotRateLeiKg).toBeNull()
    expect(aggregates[0]?.totalPaymentLei).toBe(35)
  })

  it('sortează descrescător după suma totală de plată', () => {
    const aggregates = aggregateRecoltariByCulegator({
      recoltari: [
        buildRecoltare({
          id: 'r1',
          culegator_id: 'worker-1',
          valoare_munca_lei: 45,
        }),
        buildRecoltare({
          id: 'r2',
          culegator_id: 'worker-2',
          valoare_munca_lei: 90,
        }),
      ],
      resolveWorkerName: (workerId) => (workerId === 'worker-1' ? 'Ana' : 'Bogdan'),
    })

    expect(aggregates.map((item) => item.workerName)).toEqual(['Bogdan', 'Ana'])
  })
})
