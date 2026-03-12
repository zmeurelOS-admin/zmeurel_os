import { getSupabase } from '../client'
import { getTenantId } from '@/lib/tenant/get-tenant'

export interface StocGlobal {
  cal1: number
  cal2: number
}

export interface AjustareStocInput {
  cantitate_cal1: number
  cantitate_cal2: number
  motiv?: string | null
  data?: string
}

type SupabaseLikeError = {
  code?: string
  message?: string
}

function round2(value: number): number {
  return Math.round((Number(value) || 0) * 100) / 100
}

function isMissingColumnError(error: unknown, columnName: string): boolean {
  const e = (error ?? {}) as SupabaseLikeError
  const message = (e.message ?? '').toLowerCase()
  return e.code === 'PGRST204' || message.includes(columnName.toLowerCase())
}

export async function getStocGlobal(): Promise<StocGlobal> {
  const supabase = getSupabase()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('miscari_stoc')
    .select('cantitate_cal1,cantitate_cal2')

  if (error) {
    if (isMissingColumnError(error, 'cantitate_cal1') || isMissingColumnError(error, 'cantitate_cal2')) {
      return { cal1: 0, cal2: 0 }
    }
    throw error
  }

  const totals = (data ?? []).reduce(
    (acc: StocGlobal, row: { cantitate_cal1?: number | null; cantitate_cal2?: number | null }) => {
      acc.cal1 += Number(row.cantitate_cal1 ?? 0)
      acc.cal2 += Number(row.cantitate_cal2 ?? 0)
      return acc
    },
    { cal1: 0, cal2: 0 }
  )

  return { cal1: round2(totals.cal1), cal2: round2(totals.cal2) }
}

export async function getStocCal1(): Promise<number> {
  const global = await getStocGlobal()
  return global.cal1
}

export async function getStocCal2(): Promise<number> {
  const global = await getStocGlobal()
  return global.cal2
}

export async function createAjustareStoc(input: AjustareStocInput): Promise<void> {
  const supabase = getSupabase()
  const tenantId = await getTenantId(supabase)

  const payload = {
    tenant_id: tenantId,
    tip: 'ajustare',
    data: input.data ?? new Date().toISOString().split('T')[0],
    cantitate_cal1: round2(input.cantitate_cal1),
    cantitate_cal2: round2(input.cantitate_cal2),
    descriere: input.motiv?.trim() || null,
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from('miscari_stoc').insert(payload)
  if (error) throw error
}
