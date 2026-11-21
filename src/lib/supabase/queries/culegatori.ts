import { getSupabase } from '../client'
import { generateBusinessId } from '@/lib/supabase/business-ids'
import { cheieDeTrimis, findByClientSyncId, isClientSyncConflict } from '@/lib/supabase/idempotency'
import { getTenantId } from '@/lib/tenant/get-tenant'

// ========================================
// TYPES
// ========================================

export interface Culegator {
  id: string
  id_culegator: string
  nume_prenume: string
  tarif_lei_kg: number
  data_angajare: string | null
  status_activ: boolean
  telefon: string | null
  tip_angajare: string | null
  observatii: string | null
  created_at: string
  updated_at: string
}

export interface CreateCulegatorInput {
  nume_prenume: string
  tarif_lei_kg: number
  data_angajare?: string | null
  status_activ?: boolean
  telefon?: string | null
  tip_angajare?: string | null
  observatii?: string | null
  /** Cheia de idempotență a formularului (aceeași la reîncercare). */
  client_sync_id?: string | null
}

export interface UpdateCulegatorInput {
  nume_prenume?: string
  tarif_lei_kg?: number
  data_angajare?: string | null
  status_activ?: boolean
  telefon?: string | null
  tip_angajare?: string | null
  observatii?: string | null
}

// ========================================
// GENERATE NEXT ID
// ========================================

// ========================================
// GET
// ========================================

export async function getCulegatori(): Promise<Culegator[]> {
  const supabase = getSupabase()

  const { data, error } = await supabase
    .from('culegatori')
    .select('id,id_culegator,nume_prenume,tarif_lei_kg,data_angajare,status_activ,telefon,tip_angajare,observatii,created_at,updated_at,tenant_id')
    .order('created_at', { ascending: false })

  if (error) throw error

  return (data ?? []) as unknown as Culegator[]
}

// ========================================
// CREATE (FIXED VERSION)
// ========================================

export async function createCulegator(
  input: CreateCulegatorInput
): Promise<Culegator> {
  const supabase = getSupabase()
  const tenantId = await getTenantId(supabase)
  const key = await cheieDeTrimis(input.client_sync_id)
  if (key) {
    const existing = await findByClientSyncId<Culegator>(supabase, 'culegatori', tenantId, key)
    if (existing) return existing
  }
  const id_culegator = await generateBusinessId(supabase, 'CUL')

  const payload = {
    ...(key ? { client_sync_id: key } : {}),
    tenant_id: tenantId,
    id_culegator,
    nume_prenume: input.nume_prenume,
    tarif_lei_kg: input.tarif_lei_kg,
    data_angajare:
      input.data_angajare && input.data_angajare !== ''
        ? input.data_angajare
        : null,
    status_activ: input.status_activ ?? true,
    telefon:
      input.telefon && input.telefon !== '' ? input.telefon : null,
    tip_angajare:
      input.tip_angajare && input.tip_angajare !== ''
        ? input.tip_angajare
        : null,
    observatii:
      input.observatii && input.observatii !== ''
        ? input.observatii
        : null,
  }

  const { data, error } = await supabase
    .from('culegatori')
    .insert(payload)
    .select()
    .single()

  if (error && key && isClientSyncConflict(error)) {
    const existing = await findByClientSyncId<Culegator>(supabase, 'culegatori', tenantId, key)
    if (existing) return existing
  }
  if (error) throw error

  return data as unknown as Culegator
}

// ========================================
// UPDATE
// ========================================

export async function updateCulegator(
  id: string,
  input: UpdateCulegatorInput
): Promise<Culegator> {
  const supabase = getSupabase()

  // Doar câmpurile primite ajung în `update`. Înainte, un câmp netrimis era scris ca `null`:
  // „Marchează inactiv” sau un formular fără data angajării ar fi șters telefonul, tipul, nota și data.
  const emptyToNull = (value: string | null | undefined) => (value && value !== '' ? value : null)
  const payload = {
    ...(input.nume_prenume !== undefined ? { nume_prenume: input.nume_prenume } : {}),
    ...(input.tarif_lei_kg !== undefined ? { tarif_lei_kg: input.tarif_lei_kg } : {}),
    ...(input.status_activ !== undefined ? { status_activ: input.status_activ } : {}),
    ...(input.data_angajare !== undefined ? { data_angajare: emptyToNull(input.data_angajare) } : {}),
    ...(input.telefon !== undefined ? { telefon: emptyToNull(input.telefon) } : {}),
    ...(input.tip_angajare !== undefined ? { tip_angajare: emptyToNull(input.tip_angajare) } : {}),
    ...(input.observatii !== undefined ? { observatii: emptyToNull(input.observatii) } : {}),
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await supabase
    .from('culegatori')
    .update(payload)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error

  return data as unknown as Culegator
}

// ========================================
// DELETE
// ========================================

export async function deleteCulegator(id: string): Promise<void> {
  const supabase = getSupabase()

  // Check for related recoltari before deleting
  const { count: recoltariCount, error: recoltariError } = await supabase
    .from('recoltari')
    .select('*', { count: 'exact', head: true })
    .eq('culegator_id', id)

  if (recoltariError) throw recoltariError

  // If any related records exist, throw a descriptive error
  if ((recoltariCount ?? 0) > 0) {
    throw new Error(`Nu poți șterge. Are ${recoltariCount} recoltări asociate.`)
  }

  // Only proceed with delete if count is 0
  const { error } = await supabase
    .from('culegatori')
    .delete()
    .eq('id', id)

  if (error) throw error
}
