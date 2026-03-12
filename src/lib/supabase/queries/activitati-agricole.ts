// src/lib/supabase/queries/activitati-agricole.ts
import { getSupabase } from '../client'
import { generateBusinessId } from '@/lib/supabase/business-ids'
import { getTenantId } from '@/lib/tenant/get-tenant'

export const TIPURI_ACTIVITATI = [
  'Tratament Fungicid',
  'Tratament Insecticid',
  'Tratament Erbicid',
  'Fertilizare Organica',
  'Fertilizare Chimica',
  'Fertilizare Foliara',
  'Irigare',
  'Tundere/Curatare',
  'Altele',
] as const

export interface ActivitateAgricola {
  id: string
  id_activitate: string
  client_sync_id: string
  data_aplicare: string
  parcela_id: string | null
  tip_activitate: string | null
  produs_utilizat: string | null
  doza: string | null
  timp_pauza_zile: number
  operator: string | null
  observatii: string | null
  sync_status: string | null
  conflict_flag: boolean | null
  created_by: string | null
  updated_by: string | null
  created_at: string
  updated_at: string
  tenant_id: string | null
}

export interface CreateActivitateAgricolaInput {
  client_sync_id?: string
  sync_status?: string
  data_aplicare: string
  parcela_id?: string
  tip_activitate?: string
  produs_utilizat?: string
  doza?: string
  timp_pauza_zile?: number
  operator?: string
  observatii?: string
}

export interface UpdateActivitateAgricolaInput {
  data_aplicare?: string
  parcela_id?: string
  tip_activitate?: string
  produs_utilizat?: string
  doza?: string
  timp_pauza_zile?: number
  operator?: string
  observatii?: string
}

type SupabaseLikeError = {
  message?: string
  code?: string
  details?: string
  hint?: string
  status?: number
}

const isMissingColumnError = (error: SupabaseLikeError, column: string) =>
  error?.code === 'PGRST204' || error?.message?.includes(`'${column}'`)

const toError = (error: SupabaseLikeError): Error & SupabaseLikeError => {
  const message = error?.message || error?.details || 'Eroare necunoscuta la salvare activitate'
  return Object.assign(new Error(message), {
    code: error?.code,
    details: error?.details,
    hint: error?.hint,
    status: error?.status,
  })
}

export async function getActivitatiAgricole(): Promise<ActivitateAgricola[]> {
  const supabase = getSupabase()

  const { data, error } = await supabase
    .from('activitati_agricole')
    .select('id,id_activitate,data_aplicare,parcela_id,tip_activitate,produs_utilizat,doza,timp_pauza_zile,operator,observatii,created_at,updated_at,tenant_id')
    .order('data_aplicare', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching activitati:', error)
    throw error
  }

  return (data ?? []) as unknown as ActivitateAgricola[]
}

export async function createActivitateAgricola(
  input: CreateActivitateAgricolaInput
): Promise<ActivitateAgricola> {
  const supabase = getSupabase()
  const nextId = await generateBusinessId(supabase, 'AA')
  const tenantId = await getTenantId(supabase)
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const fullPayload = {
    client_sync_id: input.client_sync_id ?? crypto.randomUUID(),
    id_activitate: nextId,
    data_aplicare: input.data_aplicare,
    parcela_id: input.parcela_id ?? null,
    tip_activitate: input.tip_activitate ?? null,
    produs_utilizat: input.produs_utilizat ?? null,
    doza: input.doza ?? null,
    timp_pauza_zile: input.timp_pauza_zile ?? 0,
    operator: input.operator ?? null,
    observatii: input.observatii ?? null,
    sync_status: input.sync_status ?? 'synced',
    created_by: user?.id ?? null,
    updated_by: user?.id ?? null,
    tenant_id: tenantId,
  }

  const { data, error } = await supabase
    .from('activitati_agricole')
    .upsert(fullPayload, { onConflict: 'client_sync_id' })
    .select()
    .single()

  if (error) {
    const maybeError = error as SupabaseLikeError
    const missingSyncColumns =
      isMissingColumnError(maybeError, 'client_sync_id') ||
      isMissingColumnError(maybeError, 'sync_status') ||
      isMissingColumnError(maybeError, 'created_by') ||
      isMissingColumnError(maybeError, 'updated_by')

    if (missingSyncColumns) {
      // Fallback for environments where idempotency/audit migrations are not applied yet.
      const { data: fallbackData, error: fallbackError } = await supabase
        .from('activitati_agricole')
        .insert({
          id_activitate: nextId,
          data_aplicare: input.data_aplicare,
          parcela_id: input.parcela_id ?? null,
          tip_activitate: input.tip_activitate ?? null,
          produs_utilizat: input.produs_utilizat ?? null,
          doza: input.doza ?? null,
          timp_pauza_zile: input.timp_pauza_zile ?? 0,
          operator: input.operator ?? null,
          observatii: input.observatii ?? null,
          tenant_id: tenantId,
        })
        .select()
        .single()

      if (fallbackError) {
        console.error('Error creating activitate (fallback):', {
          message: fallbackError.message,
          code: fallbackError.code,
          details: fallbackError.details,
          hint: fallbackError.hint,
        })
        throw toError(fallbackError)
      }

      return fallbackData as unknown as ActivitateAgricola
    }

    console.error('Error creating activitate:', {
      message: maybeError?.message,
      code: maybeError?.code,
      details: maybeError?.details,
      hint: maybeError?.hint,
      status: maybeError?.status,
    })
    throw toError(maybeError)
  }

  return data as unknown as ActivitateAgricola
}

export async function updateActivitateAgricola(
  id: string,
  input: UpdateActivitateAgricolaInput
): Promise<ActivitateAgricola> {
  const supabase = getSupabase()

  const { data, error } = await supabase
    .from('activitati_agricole')
    .update({
      ...input,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Error updating activitate:', error)
    throw error
  }

  return data as unknown as ActivitateAgricola
}

export async function deleteActivitateAgricola(id: string): Promise<void> {
  const supabase = getSupabase()

  const { error } = await supabase
    .from('activitati_agricole')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Error deleting activitate:', error)
    throw error
  }
}

export function calculatePauseStatus(
  dataAplicare: string,
  timpPauzaZile: number
): {
  dataRecoltarePermisa: string
  status: 'OK' | 'Pauza'
} {
  const aplicareDate = new Date(dataAplicare)
  const recoltareDate = new Date(aplicareDate)
  recoltareDate.setDate(recoltareDate.getDate() + timpPauzaZile)

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  return {
    dataRecoltarePermisa: recoltareDate.toISOString().split('T')[0],
    status: today >= recoltareDate ? 'OK' : 'Pauza',
  }
}

