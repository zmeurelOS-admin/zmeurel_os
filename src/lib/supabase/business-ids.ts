import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '@/types/supabase'

type RpcClient = SupabaseClient<Database> & {
  rpc: (
    fn: string,
    args: Record<string, unknown>
  ) => Promise<{
    data: unknown
    error: {
      code?: string
      message?: string
      details?: string
      hint?: string
    } | null
    status?: number
  }>
}

export async function generateBusinessId(
  supabase: SupabaseClient<Database>,
  prefix: string
): Promise<string> {
  const { data, error, status } = await (supabase as RpcClient).rpc('generate_business_id', { prefix })

  if (error) {
    const resolvedError = Object.assign(
      new Error(error.message || `Nu am putut genera ID-ul pentru prefixul ${prefix}.`),
      {
        code: error.code,
        details: error.details,
        hint: error.hint,
        status,
      },
    )
    throw resolvedError
  }

  if (typeof data === 'string' && data.trim()) {
    return data
  }

  throw new Error(`Functia generate_business_id a returnat un rezultat invalid pentru prefixul ${prefix}.`)
}
