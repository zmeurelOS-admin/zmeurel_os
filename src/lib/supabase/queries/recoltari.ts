// src/lib/supabase/queries/recoltari.ts
import { createClient as createSupabaseClient } from '../client';

// Interface pentru Recoltare
export interface Recoltare {
  id: string;
  tenant_id: string;
  id_recoltare: string;
  data: string;
  culegator_id: string | null;
  parcela_id: string | null;
  nr_caserole: number;
  tara_kg: number;
  observatii: string | null;
  created_at: string;
}

// Input pentru creare recoltare
export interface CreateRecoltareInput {
  tenant_id: string;
  data: string;
  culegator_id?: string | null;
  parcela_id?: string | null;
  nr_caserole: number;
  tara_kg?: number;
  observatii?: string;
}

// Input pentru update recoltare
export interface UpdateRecoltareInput {
  data?: string;
  culegator_id?: string | null;
  parcela_id?: string | null;
  nr_caserole?: number;
  tara_kg?: number;
  observatii?: string;
}

// Generare ID automat pentru recoltări: R001, R002, etc.
async function generateNextId(tenantId: string): Promise<string> {
  const supabase = createSupabaseClient();

  const { data, error } = await supabase
    .from('recoltari')
    .select('id_recoltare')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(1);

  if (error) {
    console.error('Error fetching last recoltare ID:', error);
    return 'R001';
  }

  if (!data || data.length === 0) {
    return 'R001';
  }

  const lastId = data[0].id_recoltare;
  const numericPart = parseInt(lastId.replace('R', ''), 10);
  
  if (isNaN(numericPart)) {
    console.error('Invalid ID format:', lastId);
    return 'R001';
  }
  
  const nextNumber = numericPart + 1;

  return `R${nextNumber.toString().padStart(3, '0')}`;
}

// GET: Toate recoltările pentru un tenant
export async function getRecoltari(tenantId: string): Promise<Recoltare[]> {
  const supabase = createSupabaseClient();

  const { data, error } = await supabase
    .from('recoltari')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('data', { ascending: false });

  if (error) {
    console.error('Error fetching recoltari:', error);
    throw error;
  }

  return data || [];
}

// GET: Recoltări pentru o anumită lună
export async function getRecoltariByMonth(
  tenantId: string,
  year: number,
  month: number
): Promise<Recoltare[]> {
  const supabase = createSupabaseClient();

  const startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
  const endDate = new Date(year, month, 0).toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('recoltari')
    .select('*')
    .eq('tenant_id', tenantId)
    .gte('data', startDate)
    .lte('data', endDate)
    .order('data', { ascending: false });

  if (error) {
    console.error('Error fetching recoltari by month:', error);
    throw error;
  }

  return data || [];
}

// POST: Creare recoltare nouă
export async function createRecoltare(
  input: CreateRecoltareInput
): Promise<Recoltare> {
  const supabase = createSupabaseClient();

  const nextId = await generateNextId(input.tenant_id);

  const { data, error } = await supabase
    .from('recoltari')
    .insert({
      tenant_id: input.tenant_id,
      id_recoltare: nextId,
      data: input.data,
      culegator_id: input.culegator_id || null,
      parcela_id: input.parcela_id || null,
      nr_caserole: input.nr_caserole,
      tara_kg: input.tara_kg || 0,
      observatii: input.observatii || null,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating recoltare:', error);
    throw error;
  }

  return data;
}

// PUT: Update recoltare existentă
export async function updateRecoltare(
  id: string,
  input: UpdateRecoltareInput
): Promise<Recoltare> {
  const supabase = createSupabaseClient();

  const { data, error } = await supabase
    .from('recoltari')
    .update(input)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating recoltare:', error);
    throw error;
  }

  return data;
}

// DELETE: Ștergere recoltare
export async function deleteRecoltare(id: string): Promise<void> {
  const supabase = createSupabaseClient();

  const { error } = await supabase.from('recoltari').delete().eq('id', id);

  if (error) {
    console.error('Error deleting recoltare:', error);
    throw error;
  }
}
