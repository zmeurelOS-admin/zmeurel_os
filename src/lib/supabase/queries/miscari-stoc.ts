// Sursa unică de adevăr pentru disponibilul comercial este RPC-ul
// `get_sellable_cal1_stock_summary` (pipeline derivat: recoltari − comenzi + ajustari_stoc).
// Tabelul `miscari_stoc` este arhivă înghețată din 2026-07-11: codul viu nu mai
// scrie și nu mai citește din el. Funcțiile vechi de agregare pe ledger
// (getStocuriPeLocatii, getStocGlobal, insertMiscareStoc etc.) au fost eliminate.
import { getSupabase } from '../client'
import { getTenantId } from '@/lib/tenant/get-tenant'

/** Formă istorică de agregare pe locație — folosită doar ca tip de afișare în dashboard. */
export interface StocLocationRow {
  locatie_id: string
  locatie_nume: string
  produs: string
  stoc_fresh_cal1: number
  stoc_fresh_cal2: number
  stoc_congelat: number
  stoc_procesat: number
  total_kg: number
  last_updated: string | null
}

export interface SellableCal1StockSummary {
  recoltatCal1Kg: number
  consumatDefinitivCal1Kg: number
  rezervatActivCal1Kg: number
  legacyInLivrareFaraRezervareKg: number
  stocCal1LedgerKg: number
  disponibilCal1Kg: number
}

export interface RecoltareDeleteImpact {
  hasStock: boolean
  stockToRemoveKg: number
  hasDownstreamSales: boolean
}

type SupabaseLikeError = {
  code?: string
  message?: string
}

type SellableCal1StockSummaryRpcRow = {
  recoltat_cal1_kg?: number | null
  consumat_definitiv_cal1_kg?: number | null
  rezervat_activ_cal1_kg?: number | null
  legacy_in_livrare_fara_rezervare_kg?: number | null
  stoc_cal1_ledger_kg?: number | null
  disponibil_cal1_kg?: number | null
}

type SellableCal1StockSummaryRpcClient = ReturnType<typeof getSupabase> & {
  rpc: (
    fn: 'get_sellable_cal1_stock_summary',
    args: { p_tenant_id: string },
  ) => Promise<{
    data: SellableCal1StockSummaryRpcRow[] | SellableCal1StockSummaryRpcRow | null
    error: SupabaseLikeError | null
  }>
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

function isMissingInventoryTableError(error: unknown): boolean {
  const err = (error ?? {}) as SupabaseLikeError
  const message = (err.message ?? '').toLowerCase()
  return (
    err.code === 'PGRST205' ||
    message.includes('could not find the table') ||
    message.includes('relation "public.miscari_stoc" does not exist')
  )
}

export async function getSellableCal1StockSummary(): Promise<SellableCal1StockSummary> {
  const supabase = getSupabase()
  const tenantId = await getTenantId(supabase)
  const rpcClient = supabase as SellableCal1StockSummaryRpcClient
  const { data, error } = await rpcClient.rpc('get_sellable_cal1_stock_summary', {
    p_tenant_id: tenantId,
  })

  if (error) {
    if (isMissingInventoryTableError(error)) {
      return {
        recoltatCal1Kg: 0,
        consumatDefinitivCal1Kg: 0,
        rezervatActivCal1Kg: 0,
        legacyInLivrareFaraRezervareKg: 0,
        stocCal1LedgerKg: 0,
        disponibilCal1Kg: 0,
      }
    }
    throw error
  }

  const row = Array.isArray(data) ? data[0] : data
  return {
    recoltatCal1Kg: round2(Number(row?.recoltat_cal1_kg ?? 0)),
    consumatDefinitivCal1Kg: round2(Number(row?.consumat_definitiv_cal1_kg ?? 0)),
    rezervatActivCal1Kg: round2(Number(row?.rezervat_activ_cal1_kg ?? 0)),
    legacyInLivrareFaraRezervareKg: round2(Number(row?.legacy_in_livrare_fara_rezervare_kg ?? 0)),
    stocCal1LedgerKg: round2(Number(row?.stoc_cal1_ledger_kg ?? 0)),
    disponibilCal1Kg: round2(Number(row?.disponibil_cal1_kg ?? 0)),
  }
}

/**
 * Impactul ștergerii unei recoltări, calculat din sursa derivată (nu din
 * miscari_stoc): se pierd `kg_cal1` din stocul recoltat, iar ștergerea e
 * blocată de RPC dacă disponibilul ar deveni negativ (kg-urile sunt deja
 * vândute/angajate în comenzi).
 */
export async function getRecoltareDeleteImpact(recoltareId: string): Promise<RecoltareDeleteImpact> {
  const supabase = getSupabase()
  const tenantId = await getTenantId(supabase)

  const { data, error } = await supabase
    .from('recoltari')
    .select('kg_cal1')
    .eq('id', recoltareId)
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (error) throw error

  const stockToRemoveKg = round2(Number(data?.kg_cal1 ?? 0))

  if (stockToRemoveKg <= 0) {
    return {
      hasStock: false,
      stockToRemoveKg: 0,
      hasDownstreamSales: false,
    }
  }

  const summary = await getSellableCal1StockSummary()

  return {
    hasStock: true,
    stockToRemoveKg,
    hasDownstreamSales: summary.disponibilCal1Kg - stockToRemoveKg < -0.001,
  }
}
