import { getRecoltareTotalKg, type Recoltare } from '@/lib/supabase/queries/recoltari'

export interface RecoltareWorkerAggregate {
  workerKey: string
  workerId: string | null
  workerName: string
  harvestCount: number
  totalKg: number
  totalCal1Kg: number
  totalCal2Kg: number
  totalPaymentLei: number
  uniformSnapshotRateLeiKg: number | null
  hasVariableRate: boolean
  harvests: Recoltare[]
}

function round2(value: number): number {
  return Math.round((Number(value) || 0) * 100) / 100
}

function compareRecoltariDesc(left: Recoltare, right: Recoltare): number {
  const leftDate = String(left.data || '')
  const rightDate = String(right.data || '')
  if (leftDate !== rightDate) return rightDate.localeCompare(leftDate)

  const leftUpdated = String(left.updated_at || left.created_at || '')
  const rightUpdated = String(right.updated_at || right.created_at || '')
  if (leftUpdated !== rightUpdated) return rightUpdated.localeCompare(leftUpdated)

  return String(right.id || '').localeCompare(String(left.id || ''))
}

export function aggregateRecoltariByCulegator(params: {
  recoltari: Recoltare[]
  resolveWorkerName: (workerId: string | null) => string | undefined
}): RecoltareWorkerAggregate[] {
  const aggregateMap = new Map<
    string,
    {
      workerKey: string
      workerId: string | null
      workerName: string
      harvestCount: number
      totalKg: number
      totalCal1Kg: number
      totalCal2Kg: number
      totalPaymentLei: number
      harvests: Recoltare[]
      snapshotRates: Set<number>
    }
  >()

  for (const recoltare of params.recoltari) {
    const workerId = recoltare.culegator_id ?? null
    const workerKey = workerId ?? '__fara-culegator__'
    const workerName =
      params.resolveWorkerName(workerId) ?? (workerId ? 'Culegător necunoscut' : 'Fără culegător')

    const current =
      aggregateMap.get(workerKey) ??
      {
        workerKey,
        workerId,
        workerName,
        harvestCount: 0,
        totalKg: 0,
        totalCal1Kg: 0,
        totalCal2Kg: 0,
        totalPaymentLei: 0,
        harvests: [],
        snapshotRates: new Set<number>(),
      }

    current.harvestCount += 1
    current.totalCal1Kg = round2(current.totalCal1Kg + Number(recoltare.kg_cal1 ?? 0))
    current.totalCal2Kg = round2(current.totalCal2Kg + Number(recoltare.kg_cal2 ?? 0))
    current.totalKg = round2(current.totalKg + getRecoltareTotalKg(recoltare))
    current.totalPaymentLei = round2(current.totalPaymentLei + Number(recoltare.valoare_munca_lei ?? 0))
    current.harvests.push(recoltare)
    current.snapshotRates.add(round2(Number(recoltare.pret_lei_pe_kg_snapshot ?? 0)))

    aggregateMap.set(workerKey, current)
  }

  return Array.from(aggregateMap.values())
    .map((aggregate) => {
      const rates = Array.from(aggregate.snapshotRates.values())
      const sortedHarvests = [...aggregate.harvests].sort(compareRecoltariDesc)

      return {
        workerKey: aggregate.workerKey,
        workerId: aggregate.workerId,
        workerName: aggregate.workerName,
        harvestCount: aggregate.harvestCount,
        totalKg: aggregate.totalKg,
        totalCal1Kg: aggregate.totalCal1Kg,
        totalCal2Kg: aggregate.totalCal2Kg,
        totalPaymentLei: aggregate.totalPaymentLei,
        uniformSnapshotRateLeiKg: rates.length === 1 ? rates[0] ?? null : null,
        hasVariableRate: rates.length > 1,
        harvests: sortedHarvests,
      } satisfies RecoltareWorkerAggregate
    })
    .sort((left, right) => {
      if (right.totalPaymentLei !== left.totalPaymentLei) return right.totalPaymentLei - left.totalPaymentLei
      if (right.totalKg !== left.totalKg) return right.totalKg - left.totalKg
      return left.workerName.localeCompare(right.workerName, 'ro-RO')
    })
}
