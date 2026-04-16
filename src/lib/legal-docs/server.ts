import type { SupabaseClient } from '@supabase/supabase-js'

import { buildLegalDocsStatus } from '@/lib/legal-docs/shared'
import type { Database } from '@/types/supabase'

type AnySupabase = SupabaseClient<Database>

export async function getTenantLegalDocs(
  supabase: AnySupabase,
  tenantId: string | null,
) {
  if (!tenantId) {
    return {
      doc: null,
      status: buildLegalDocsStatus(null),
    }
  }

  const { data, error } = await supabase
    .from('farmer_legal_docs')
    .select('*')
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (error) {
    throw error
  }

  return {
    doc: data,
    status: buildLegalDocsStatus(data),
  }
}

export async function createLegalDocSignedUrl(
  supabase: AnySupabase,
  path: string | null | undefined,
): Promise<string | null> {
  if (!path?.trim()) return null

  const { data, error } = await supabase.storage.from('legal-docs').createSignedUrl(path, 60 * 60)
  if (error) {
    return null
  }

  return data?.signedUrl ?? null
}
