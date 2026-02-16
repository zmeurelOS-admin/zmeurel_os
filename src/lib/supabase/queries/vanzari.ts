// src/lib/supabase/queries/vanzari.ts
import { createClient as createSupabaseClient } from '../client';

// Interface pentru Vânzare
export interface Vanzare {
  id: string;
  tenant_id: string;
  id_vanzare: string;
  data: string;
  client_id: string | null;
  cantitate_kg: number;
  pret_lei_kg: number;
  status_plata: string;
  observatii_ladite: string | null;
  created_at: string;
}

// Status plată disponibile
export const STATUS_PLATA = ['Plătit', 'Restanță', 'Avans'] as const;

// Input pentru creare vânzare
export interface CreateVanzareInput {
  tenant_id: string;
  data: string;
  client_id?: string | null;
  cantitate_kg: number;
  pret_lei_kg: number;
  status_plata?: string;
  observatii_ladite?: string;
}

// Input pentru update vânzare
export interface UpdateVanzareInput {
  data?: string;
  client_id?: string | null;
  cantitate_kg?: number;
  pret_lei_kg?: number;
  status_plata?: string;
  observatii_ladite?: string;
}

// Generare ID automat pentru vânzări: V001, V002, etc.
async function generateNextId(tenantId: string): Promise<string> {
  const supabase = createSupabaseClient();

  const { data, error } = await supabase
    .from('vanzari')
    .select('id_vanzare')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(1);

  if (error) {
    console.error('Error fetching last vanzare ID:', error);
    return 'V001';
  }

  if (!data || data.length === 0) {
    return 'V001';
  }

  const lastId = data[0].id_vanzare;
  const numericPart = parseInt(lastId.replace('V', ''), 10);
  
  if (isNaN(numericPart)) {
    console.error('Invalid ID format:', lastId);
    return 'V001';
  }
  
  const nextNumber = numericPart + 1;

  return `V${nextNumber.toString().padStart(3, '0')}`;
}

// GET: Toate vânzările pentru un tenant
export async function getVanzari(tenantId: string): Promise<Vanzare[]> {
  const supabase = createSupabaseClient();

  const { data, error } = await supabase
    .from('vanzari')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('data', { ascending: false });

  if (error) {
    console.error('Error fetching vanzari:', error);
    throw error;
  }

  return data || [];
}

// GET: Vânzări pentru o anumită lună
export async function getVanzariByMonth(
  tenantId: string,
  year: number,
  month: number
): Promise<Vanzare[]> {
  const supabase = createSupabaseClient();

  const startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
  const endDate = new Date(year, month, 0).toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('vanzari')
    .select('*')
    .eq('tenant_id', tenantId)
    .gte('data', startDate)
    .lte('data', endDate)
    .order('data', { ascending: false });

  if (error) {
    console.error('Error fetching vanzari by month:', error);
    throw error;
  }

  return data || [];
}

// POST: Creare vânzare nouă
export async function createVanzare(
  input: CreateVanzareInput
): Promise<Vanzare> {
  const supabase = createSupabaseClient();

  const nextId = await generateNextId(input.tenant_id);

  const { data, error } = await supabase
    .from('vanzari')
    .insert({
      tenant_id: input.tenant_id,
      id_vanzare: nextId,
      data: input.data,
      client_id: input.client_id || null,
      cantitate_kg: input.cantitate_kg,
      pret_lei_kg: input.pret_lei_kg,
      status_plata: input.status_plata || 'Plătit',
      observatii_ladite: input.observatii_ladite || null,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating vanzare:', error);
    throw error;
  }

  return data;
}

// PUT: Update vânzare existentă
export async function updateVanzare(
  id: string,
  input: UpdateVanzareInput
): Promise<Vanzare> {
  const supabase = createSupabaseClient();

  const { data, error } = await supabase
    .from('vanzari')
    .update(input)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating vanzare:', error);
    throw error;
  }

  return data;
}

// DELETE: Ștergere vânzare
export async function deleteVanzare(id: string): Promise<void> {
  const supabase = createSupabaseClient();

  const { error } = await supabase.from('vanzari').delete().eq('id', id);

  if (error) {
    console.error('Error deleting vanzare:', error);
    throw error;
  }
}
