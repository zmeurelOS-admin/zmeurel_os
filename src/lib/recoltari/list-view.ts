import { getRecoltareTotalKg, type Recoltare } from '@/lib/supabase/queries/recoltari'

export type RecoltariFilterState = {
  searchTerm: string
  timeFilter: 'azi' | 'saptamana' | 'luna' | 'custom' | 'toate'
  parcelaId: string
  culegatorId: string
  customStartDate: string
  customEndDate: string
}

export type RecoltariTodayDashboard = {
  cal1Kg: number
  cal2Kg: number
  paidLei: number
}

export type RecoltariDayGroup = {
  date: string
  harvests: Recoltare[]
  harvestCount: number
  totalKg: number
  cal1Kg: number
  cal2Kg: number
  paidLei: number
}

export type RecoltariParcelaMetaMap = Record<
  string,
  { name: string; displayName: string; soi: string; status: string; tipLabel: string }
>

export type RecoltariWorkerMetaMap = Record<string, { nume: string; tarif: number }>

function toDateOnly(value: string | null | undefined): string {
  return (value ?? '').slice(0, 10)
}

export function calculateTodayRecoltariDashboard(recoltari: Recoltare[], todayIso: string): RecoltariTodayDashboard {
  return recoltari.reduce(
    (totals, recoltare) => {
      if (toDateOnly(recoltare.data) !== todayIso) return totals
      totals.cal1Kg += Number(recoltare.kg_cal1 ?? 0)
      totals.cal2Kg += Number(recoltare.kg_cal2 ?? 0)
      totals.paidLei += Number(recoltare.valoare_munca_lei ?? 0)
      return totals
    },
    { cal1Kg: 0, cal2Kg: 0, paidLei: 0 },
  )
}

function getFilterDateRange(filters: RecoltariFilterState, todayIso: string, currentWeekStartIso: string, currentMonthStartIso: string): { start: string | null; end: string | null } {
  if (filters.timeFilter === 'azi') return { start: todayIso, end: todayIso }
  if (filters.timeFilter === 'saptamana') return { start: currentWeekStartIso, end: todayIso }
  if (filters.timeFilter === 'luna') return { start: currentMonthStartIso, end: todayIso }
  if (filters.timeFilter === 'custom') {
    return {
      start: filters.customStartDate || null,
      end: filters.customEndDate || null,
    }
  }
  return { start: null, end: null }
}

export function filterRecoltariForList(params: {
  recoltari: Recoltare[]
  filters: RecoltariFilterState
  parcelaMap: RecoltariParcelaMetaMap
  culegatorMap: RecoltariWorkerMetaMap
  todayIso: string
  currentWeekStartIso: string
  currentMonthStartIso: string
}): Recoltare[] {
  const term = params.filters.searchTerm.trim().toLowerCase()
  const { start, end } = getFilterDateRange(
    params.filters,
    params.todayIso,
    params.currentWeekStartIso,
    params.currentMonthStartIso,
  )

  return params.recoltari.filter((recoltare) => {
    const date = toDateOnly(recoltare.data)
    if (!date) return false
    if (start && date < start) return false
    if (end && date > end) return false
    if (params.filters.parcelaId !== 'all' && recoltare.parcela_id !== params.filters.parcelaId) return false
    if (params.filters.culegatorId !== 'all' && recoltare.culegator_id !== params.filters.culegatorId) return false

    if (!term) return true

    const parcelaName = recoltare.parcela_id ? params.parcelaMap[recoltare.parcela_id]?.name || '' : ''
    const parcelaDisplay = recoltare.parcela_id ? params.parcelaMap[recoltare.parcela_id]?.displayName || '' : ''
    const parcelaSoi = recoltare.parcela_id ? params.parcelaMap[recoltare.parcela_id]?.soi || '' : ''
    const parcelaTip = recoltare.parcela_id ? params.parcelaMap[recoltare.parcela_id]?.tipLabel || '' : ''
    const culegatorName = recoltare.culegator_id ? params.culegatorMap[recoltare.culegator_id]?.nume || '' : ''

    return (
      parcelaName.toLowerCase().includes(term) ||
      parcelaDisplay.toLowerCase().includes(term) ||
      parcelaSoi.toLowerCase().includes(term) ||
      parcelaTip.toLowerCase().includes(term) ||
      culegatorName.toLowerCase().includes(term) ||
      (recoltare.observatii?.toLowerCase().includes(term) ?? false)
    )
  })
}

export function groupRecoltariByDay(recoltari: Recoltare[]): RecoltariDayGroup[] {
  const grouped = new Map<string, RecoltariDayGroup>()

  recoltari.forEach((recoltare) => {
    const date = toDateOnly(recoltare.data)
    if (!date) return

    const current =
      grouped.get(date) ??
      {
        date,
        harvests: [],
        harvestCount: 0,
        totalKg: 0,
        cal1Kg: 0,
        cal2Kg: 0,
        paidLei: 0,
      }

    current.harvests.push(recoltare)
    current.harvestCount += 1
    current.cal1Kg += Number(recoltare.kg_cal1 ?? 0)
    current.cal2Kg += Number(recoltare.kg_cal2 ?? 0)
    current.totalKg += getRecoltareTotalKg(recoltare)
    current.paidLei += Number(recoltare.valoare_munca_lei ?? 0)
    grouped.set(date, current)
  })

  return Array.from(grouped.values())
    .map((group) => ({
      ...group,
      harvests: [...group.harvests].sort((a, b) => {
        const workerSort = String(a.culegator_id ?? '').localeCompare(String(b.culegator_id ?? ''), 'ro-RO')
        if (workerSort !== 0) return workerSort
        return String(a.created_at ?? '').localeCompare(String(b.created_at ?? ''), 'ro-RO')
      }),
    }))
    .sort((a, b) => b.date.localeCompare(a.date))
}
