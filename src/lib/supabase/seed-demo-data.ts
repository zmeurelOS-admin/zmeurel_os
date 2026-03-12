import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '@/types/supabase'

type SeedSummary = {
  parcele: number
  clienti: number
  culegatori: number
  recoltari: number
  vanzari: number
  cheltuieli: number
  activitati: number
  comenzi: number
  miscari_stoc: number
  vanzari_butasi: number
  vanzari_butasi_items: number
}

type SeedResult =
  | { success: true; summary: SeedSummary }
  | { success: false; error: string; summary: Partial<SeedSummary> }

const EMPTY_SUMMARY: SeedSummary = {
  parcele: 0,
  clienti: 0,
  culegatori: 0,
  recoltari: 0,
  vanzari: 0,
  cheltuieli: 0,
  activitati: 0,
  comenzi: 0,
  miscari_stoc: 0,
  vanzari_butasi: 0,
  vanzari_butasi_items: 0,
}

export async function seedDemoData(
  supabaseAdmin: SupabaseClient<Database>,
  tenantId: string,
  userId: string
): Promise<SeedResult> {
  if (!tenantId) {
    throw new Error('tenantId is undefined')
  }

  if (!userId) {
    throw new Error('userId is undefined')
  }

  try {
    const { error } = await (supabaseAdmin as unknown as {
      rpc: (
        fn: string,
        args: { p_tenant_id: string }
      ) => Promise<{ error: { message?: string } | null }>
    }).rpc('seed_demo_for_tenant', {
      p_tenant_id: tenantId,
    })

    if (error) {
      throw new Error(error.message ?? 'seed_demo_for_tenant failed')
    }

    return {
      success: true,
      summary: { ...EMPTY_SUMMARY },
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unexpected error',
      summary: { ...EMPTY_SUMMARY },
    }
  }
}
