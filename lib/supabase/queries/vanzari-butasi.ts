// src/lib/supabase/queries/vanzari-butasi.ts
import { createClient as createSupabaseClient } from '../client';

// Interface pentru Vânzare Butași
export interface VanzareButasi {
  id: string;
  tenant_id: string;
  id_vanzare_butasi: string;
  data: string; // Date format: YYYY-MM-DD
  client_id: string | null;
  parcela_sursa_id: string | null;
  soi_butasi: string;
  cantitate_butasi: number;
  pret_unitar_lei: number;
  observatii: string | null;
  created_at: string;
}

// Input pentru creare vânzare butași
export interface CreateVanzareButasiInput {
  tenant_id: string;
  data: string;
  client_id?: string | null;
  parcela_sursa_id?: string | null;
  soi_butasi: string;
  cantitate_butasi: number;
  pret_unitar_lei: number;
  observatii?: string;
}

// Input pentru update vânzare butași
export interface UpdateVanzareButasiInput {
  data?: string;
  client_id?: string | null;
  parcela_sursa_id?: string | null;
  soi_butasi?: string;
  cantitate_butasi?: number;
  pret_unitar_lei?: number;
  observatii?: string;
}

// Generare ID automat pentru vânzări butași: VB001, VB002, etc.
async function generateNextId(tenantId: string): Promise<string> {
  const supabase = createSupabaseClient();

  const { data, error } = await supabase
    .from('vanzari_butasi')
    .select('id_vanzare_butasi')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(1);

  if (error) {
    console.error('Error fetching last vanzare butasi ID:', error);
    return 'VB001';
  }

  if (!data || data.length === 0) {
    return 'VB001';
  }

  const lastId = data[0].id_vanzare_butasi;
  const numericPart = parseInt(lastId.replace('VB', ''), 10);
  
  if (isNaN(numericPart)) {
    console.error('Invalid ID format:', lastId);
    return 'VB001';
  }
  
  const nextNumber = numericPart + 1;

  return `VB${nextNumber.toString().padStart(3, '0')}`;
}

// GET: Toate vânzările de butași pentru un tenant
export async function getVanzariButasi(tenantId: string): Promise<VanzareButasi[]> {
  const supabase = createSupabaseClient();

  const { data, error } = await supabase
    .from('vanzari_butasi')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('data', { ascending: false }); // Cele mai recente primero

  if (error) {
    console.error('Error fetching vanzari butasi:', error);
    throw error;
  }

  return data || [];
}

// GET: Vânzări butași pentru o anumită lună
export async function getVanzariButasiByMonth(
  tenantId: string,
  year: number,
  month: number
): Promise<VanzareButasi[]> {
  const supabase = createSupabaseClient();

  // Data începere și sfârșit lună
  const startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
  const endDate = new Date(year, month, 0).toISOString().split('T')[0]; // Ultima zi a lunii

  const { data, error } = await supabase
    .from('vanzari_butasi')
    .select('*')
    .eq('tenant_id', tenantId)
    .gte('data', startDate)
    .lte('data', endDate)
    .order('data', { ascending: false });

  if (error) {
    console.error('Error fetching vanzari butasi by month:', error);
    throw error;
  }

  return data || [];
}

// GET: Total sumă vânzări butași
export async function getTotalVanzari(tenantId: string): Promise<number> {
  const supabase = createSupabaseClient();

  const { data, error } = await supabase
    .from('vanzari_butasi')
    .select('cantitate_butasi, pret_unitar_lei')
    .eq('tenant_id', tenantId);

  if (error) {
    console.error('Error calculating total vanzari:', error);
    return 0;
  }

  return data?.reduce((sum, vb) => sum + (vb.cantitate_butasi * vb.pret_unitar_lei), 0) || 0;
}

// POST: Creare vânzare butași nouă
export async function createVanzareButasi(
  input: CreateVanzareButasiInput
): Promise<VanzareButasi> {
  const supabase = createSupabaseClient();

  const nextId = await generateNextId(input.tenant_id);

  const { data, error } = await supabase
    .from('vanzari_butasi')
    .insert({
      tenant_id: input.tenant_id,
      id_vanzare_butasi: nextId,
      data: input.data,
      client_id: input.client_id || null,
      parcela_sursa_id: input.parcela_sursa_id || null,
      soi_butasi: input.soi_butasi,
      cantitate_butasi: input.cantitate_butasi,
      pret_unitar_lei: input.pret_unitar_lei,
      observatii: input.observatii || null,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating vanzare butasi:', error);
    throw error;
  }

  return data;
}

// PUT: Update vânzare butași existentă
export async function updateVanzareButasi(
  id: string,
  input: UpdateVanzareButasiInput
): Promise<VanzareButasi> {
  const supabase = createSupabaseClient();

  const { data, error } = await supabase
    .from('vanzari_butasi')
    .update(input)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating vanzare butasi:', error);
    throw error;
  }

  return data;
}

// DELETE: Ștergere vânzare butași
export async function deleteVanzareButasi(id: string): Promise<void> {
  const supabase = createSupabaseClient();

  const { error } = await supabase.from('vanzari_butasi').delete().eq('id', id);

  if (error) {
    console.error('Error deleting vanzare butasi:', error);
    throw error;
  }
}
