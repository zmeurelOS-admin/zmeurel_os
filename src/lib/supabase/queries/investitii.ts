// src/lib/supabase/queries/investitii.ts

import { getSupabase } from '../client'
import { getFinancialMutationError } from '@/lib/financial/save-errors'
import { resolveFinancialWriteContext } from '@/lib/financial/write-context'
import { generateBusinessId } from '@/lib/supabase/business-ids'
import { resolveInvestitieCategorie } from '@/lib/financial/categories'

// ===============================
// CONSTANTS
// ===============================

export { CATEGORII_INVESTITII } from '@/lib/financial/categories'

// BADGE COLORS (pentru UI)
export const BADGE_COLORS: Record<string, string> = {
  'Material săditor': 'bg-green-100 text-green-700',
  'Irigații și fertigare': 'bg-blue-100 text-blue-700',
  'Sisteme de susținere și protecție': 'bg-purple-100 text-purple-700',
  'Construcții și amenajări': 'bg-orange-100 text-orange-700',
  'Utilaje și echipamente': 'bg-yellow-100 text-yellow-700',
  'Depozitare și răcire': 'bg-indigo-100 text-indigo-700',
  'Infrastructură și utilități': 'bg-cyan-100 text-cyan-700',
  'IT și automatizări': 'bg-violet-100 text-violet-700',
  'Alte investiții': 'bg-gray-100 text-gray-700',
}

// ===============================
// TYPES
// ===============================

export interface Investitie {
  id: string
  id_investitie: string
  data: string
  parcela_id: string | null
  categorie: string | null
  furnizor: string | null
  descriere: string | null
  suma_lei: number
  created_at: string
  updated_at: string
}

export interface CreateInvestitieInput {
  data: string
  parcela_id?: string
  categorie: string
  furnizor?: string
  descriere?: string
  suma_lei: number
}

export interface UpdateInvestitieInput {
  data?: string
  parcela_id?: string
  categorie?: string
  furnizor?: string
  descriere?: string
  suma_lei?: number
}

function normalizeInvestitieRow(row: Record<string, unknown>): Investitie {
  return {
    id: String(row.id ?? ''),
    id_investitie: String(row.id_investitie ?? ''),
    data: String(row.data ?? ''),
    parcela_id: (row.parcela_id as string | null) ?? null,
    categorie: resolveInvestitieCategorie((row.categorie as string | null) ?? null),
    furnizor: (row.furnizor as string | null) ?? null,
    descriere: (row.descriere as string | null) ?? null,
    suma_lei: Number(row.suma_lei ?? 0),
    created_at: String(row.created_at ?? ''),
    updated_at: String(row.updated_at ?? ''),
  }
}

// ===============================
// INTERNAL ID GENERATOR
// ===============================

// ===============================
// QUERIES (RLS-FIRST)
// ===============================

export async function getInvestitii(): Promise<Investitie[]> {
  const supabase = getSupabase()

  const { data, error } = await supabase
    .from('investitii')
    .select('id,id_investitie,data,parcela_id,categorie,furnizor,descriere,document_url,suma_lei,created_at,updated_at,tenant_id')
    .order('data', { ascending: false })

  if (error) throw error

  return ((data ?? []) as unknown as Record<string, unknown>[]).map(normalizeInvestitieRow)
}

/**
 * CREATE INVESTITIE (RLS-FIRST)
 * 
 * RLS REQUIREMENTS:
 * - tenant_id MUST be set automatically via BEFORE INSERT trigger OR RLS WITH CHECK policy
 * - INSERT policy must exist with WITH CHECK validating tenant_id matches current user's tenant
 * 
 * DB SCHEMA EXPECTATIONS:
 * - tenant_id: NOT NULL (required)
 * - tenant_id: No DEFAULT value (set via trigger)
 * 
 * REQUIRED TRIGGER (if not using RLS WITH CHECK to set):
 * CREATE FUNCTION set_tenant_id_investitii()
 * RETURNS trigger AS $$
 * BEGIN
 *   SELECT tenant_id
 *   INTO NEW.tenant_id
 *   FROM public.profiles
 *   WHERE id = auth.uid();
 *   RETURN NEW;
 * END;
 * $$ LANGUAGE plpgsql;
 * 
 * CREATE TRIGGER set_tenant_before_insert_investitii
 * BEFORE INSERT ON investitii
 * FOR EACH ROW EXECUTE FUNCTION set_tenant_id_investitii();
 * 
 * REQUIRED RLS POLICY:
 * CREATE POLICY tenant_isolation_insert_investitii
 * ON investitii
 * FOR INSERT
 * WITH CHECK (
 *   tenant_id = public.current_tenant_id()
 * );
 */
export async function createInvestitie(
  input: CreateInvestitieInput
): Promise<Investitie> {
  const supabase = getSupabase()
  const { tenantId } = await resolveFinancialWriteContext(supabase, 'investitii')

  let nextId: string
  try {
    nextId = await generateBusinessId(supabase, 'INV')
  } catch (error) {
    throw getFinancialMutationError(error, {
      fallbackMessage: 'Nu am putut genera ID-ul investiției.',
      module: 'investitii',
      operation: 'generate_business_id',
      tableOrRpc: 'public.generate_business_id',
    })
  }

  const { data, error } = await supabase
    .from('investitii')
    .insert({
      tenant_id: tenantId,
      id_investitie: nextId,
      data: input.data,
      parcela_id: input.parcela_id ?? null,
      categorie: resolveInvestitieCategorie(input.categorie),
      furnizor: input.furnizor ?? null,
      descriere: input.descriere ?? null,
      suma_lei: input.suma_lei,
    })
    .select()
    .single()

  if (error) {
    throw getFinancialMutationError(error, {
      fallbackMessage: 'Nu am putut salva investiția.',
      module: 'investitii',
      operation: 'insert',
      tableOrRpc: 'public.investitii',
    })
  }

  return normalizeInvestitieRow(data as unknown as Record<string, unknown>)
}

export async function updateInvestitie(
  id: string,
  input: UpdateInvestitieInput
): Promise<Investitie> {
  const supabase = getSupabase()
  const { tenantId } = await resolveFinancialWriteContext(supabase, 'investitii')

  const { data, error } = await supabase
    .from('investitii')
    .update({
      ...input,
      ...(input.categorie !== undefined
        ? { categorie: input.categorie ? resolveInvestitieCategorie(input.categorie) : null }
        : {}),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .select()
    .single()

  if (error) {
    throw getFinancialMutationError(error, {
      fallbackMessage: 'Nu am putut actualiza investiția.',
      module: 'investitii',
      operation: 'update',
      tableOrRpc: 'public.investitii',
    })
  }

  return normalizeInvestitieRow(data as unknown as Record<string, unknown>)
}

export async function deleteInvestitie(id: string): Promise<void> {
  const supabase = getSupabase()
  const { tenantId } = await resolveFinancialWriteContext(supabase, 'investitii')

  const { error } = await supabase
    .from('investitii')
    .delete()
    .eq('id', id)
    .eq('tenant_id', tenantId)

  if (error) {
    throw getFinancialMutationError(error, {
      fallbackMessage: 'Nu am putut șterge investiția.',
      module: 'investitii',
      operation: 'delete',
      tableOrRpc: 'public.investitii',
    })
  }
}

