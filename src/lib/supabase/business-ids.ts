import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '@/types/supabase'

type RpcClient = SupabaseClient<Database> & {
  rpc: (
    fn: string,
    args: Record<string, unknown>
  ) => Promise<{ data: unknown; error: { message?: string } | null }>
}

export async function generateBusinessId(
  supabase: SupabaseClient<Database>,
  prefix: string
): Promise<string> {
  const { data, error } = await (supabase as RpcClient).rpc('generate_business_id', { prefix })

  if (error) {
    throw new Error(error.message || `Nu am putut genera ID-ul pentru prefixul ${prefix}.`)
  }

  if (typeof data === 'string' && data.trim()) {
    return data
  }

  throw new Error(`Functia generate_business_id a returnat un rezultat invalid pentru prefixul ${prefix}.`)
}
