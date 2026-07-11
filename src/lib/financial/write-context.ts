import type { SupabaseClient } from '@supabase/supabase-js'

import {
  createFinancialMutationError,
  createTenantMismatchFinancialError,
  type FinancialModule,
} from '@/lib/financial/save-errors'
import { getTenantId } from '@/lib/tenant/get-tenant'
import type { Database } from '@/types/supabase'

type RpcCurrentTenantClient = SupabaseClient<Database> & {
  rpc: (
    fn: 'current_tenant_id',
    args?: Record<string, never>,
  ) => Promise<{
    data: string | null
    error: {
      code?: string
      message?: string
      details?: string
      hint?: string
    } | null
    status?: number
  }>
}

export async function resolveFinancialWriteContext(
  supabase: SupabaseClient<Database>,
  module: FinancialModule,
): Promise<{ tenantId: string; userId: string }> {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user?.id) {
    throw createFinancialMutationError({
      error: authError ?? new Error('Neautorizat'),
      fallbackMessage: 'Trebuie să fii autentificat pentru a salva.',
      module,
      operation: 'auth.getUser',
      tableOrRpc: 'auth',
      statusOverride: authError ? undefined : 401,
    })
  }

  let tenantId: string
  try {
    tenantId = await getTenantId(supabase)
  } catch (error) {
    throw createFinancialMutationError({
      error,
      fallbackMessage: 'Tenant indisponibil pentru utilizatorul curent.',
      module,
      operation: 'tenant.resolve',
      tableOrRpc: 'auth',
    })
  }

  const { data: currentTenantId, error: currentTenantError } = await (supabase as RpcCurrentTenantClient).rpc(
    'current_tenant_id',
    {},
  )

  if (currentTenantError) {
    throw createFinancialMutationError({
      error: currentTenantError,
      fallbackMessage: 'Nu am putut verifica tenantul curent din baza de date.',
      module,
      operation: 'current_tenant_id',
      tableOrRpc: 'public.current_tenant_id',
    })
  }

  if (!currentTenantId) {
    throw createFinancialMutationError({
      error: new Error('Tenant indisponibil pentru utilizatorul curent.'),
      fallbackMessage: 'Tenant indisponibil pentru utilizatorul curent.',
      module,
      operation: 'current_tenant_id',
      tableOrRpc: 'public.current_tenant_id',
      kindOverride: 'tenant_unavailable',
      statusOverride: 403,
    })
  }

  if (currentTenantId !== tenantId) {
    throw createTenantMismatchFinancialError({
      module,
      expectedTenantId: tenantId,
      currentTenantId,
    })
  }

  return {
    tenantId,
    userId: user.id,
  }
}
