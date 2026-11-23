import { getSupabase } from '../client'
import type { RandStocCultura, SursaStocCultura } from '@/lib/stocuri/pe-cultura'
import { getTenantId } from '@/lib/tenant/get-tenant'

type RpcError = { code?: string; message?: string } | null

type StocPeCulturaRpcClient = {
  rpc: (
    fn: 'stoc_cal1_pe_cultura',
    args: { p_tenant_id: string },
  ) => Promise<{ data: Array<{ sursa: string; cultura: string | null; kg: number | string | null }> | null; error: RpcError }>
}

const SURSE = new Set<SursaStocCultura>(['recoltat', 'livrat', 'in_livrare', 'ajustare'])

/** Funcția nu există încă (migrarea 20261124100000 neaplicată). */
function lipsesteFunctia(error: RpcError): boolean {
  if (!error) return false
  return error.code === 'PGRST202' || error.code === '42883' || /could not find the function/i.test(error.message ?? '')
}

/**
 * Rândurile stocului pe cultură (`stoc_cal1_pe_cultura`). `null` = funcția lipsește: ecranul rămâne pe cifra
 * de azi (`get_sellable_cal1_stock_summary`), ca înainte de migrare.
 */
export async function getStocCal1PeCultura(): Promise<RandStocCultura[] | null> {
  const supabase = getSupabase()
  const tenantId = await getTenantId(supabase)
  const { data, error } = await (supabase as unknown as StocPeCulturaRpcClient).rpc('stoc_cal1_pe_cultura', { p_tenant_id: tenantId })
  if (error) {
    if (lipsesteFunctia(error)) return null
    throw Object.assign(new Error(error.message || 'Stocul pe cultură nu s-a încărcat.'), { code: error.code })
  }
  return (data ?? [])
    .filter((rand) => SURSE.has(rand.sursa as SursaStocCultura))
    .map((rand) => ({ sursa: rand.sursa as SursaStocCultura, cultura: rand.cultura, kg: Number(rand.kg) || 0 }))
}
