// src/lib/supabase/queries/activitati-agricole.ts
import { createClient as createSupabaseClient } from '../client';

// Interface pentru Activitate Agricolă
export interface ActivitateAgricola {
  id: string;
  tenant_id: string;
  id_activitate: string;
  data_aplicare: string;
  parcela_id: string | null;
  tip_activitate: string;
  produs_utilizat: string | null;
  doza: string | null;
  timp_pauza_zile: number;
  operator: string | null;
  observatii: string | null;
  created_at: string;
}

// Tipuri activități disponibile
export const TIPURI_ACTIVITATI = [
  'Tratament Fungicid',
  'Tratament Insecticid',
  'Tratament Erbicid',
  'Fertilizare Organică',
  'Fertilizare Chimică',
  'Fertilizare Foliară',
  'Irigare',
  'Tundere/Curățare',
  'Altele',
] as const;

// Input pentru creare activitate
export interface CreateActivitateAgricolaInput {
  tenant_id: string;
  data_aplicare: string;
  parcela_id?: string | null;
  tip_activitate: string;
  produs_utilizat?: string;
  doza?: string;
  timp_pauza_zile?: number;
  operator?: string;
  observatii?: string;
}

// Input pentru update activitate
export interface UpdateActivitateAgricolaInput {
  data_aplicare?: string;
  parcela_id?: string | null;
  tip_activitate?: string;
  produs_utilizat?: string;
  doza?: string;
  timp_pauza_zile?: number;
  operator?: string;
  observatii?: string;
}

// Generare ID automat pentru activități: AA001, AA002, etc.
async function generateNextId(tenantId: string): Promise<string> {
  const supabase = createSupabaseClient();

  const { data, error } = await supabase
    .from('activitati_agricole')
    .select('id_activitate')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(1);

  if (error) {
    console.error('Error fetching last activitate ID:', error);
    return 'AA001';
  }

  if (!data || data.length === 0) {
    return 'AA001';
  }

  const lastId = data[0].id_activitate;
  const numericPart = parseInt(lastId.replace('AA', ''), 10);
  
  if (isNaN(numericPart)) {
    console.error('Invalid ID format:', lastId);
    return 'AA001';
  }
  
  const nextNumber = numericPart + 1;

  return `AA${nextNumber.toString().padStart(3, '0')}`;
}

// GET: Toate activitățile pentru un tenant
export async function getActivitatiAgricole(tenantId: string): Promise<ActivitateAgricola[]> {
  const supabase = createSupabaseClient();

  const { data, error } = await supabase
    .from('activitati_agricole')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('data_aplicare', { ascending: false });

  if (error) {
    console.error('Error fetching activitati agricole:', error);
    throw error;
  }

  return data || [];
}

// GET: Activități pentru o anumită lună
export async function getActivitatiByMonth(
  tenantId: string,
  year: number,
  month: number
): Promise<ActivitateAgricola[]> {
  const supabase = createSupabaseClient();

  const startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
  const endDate = new Date(year, month, 0).toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('activitati_agricole')
    .select('*')
    .eq('tenant_id', tenantId)
    .gte('data_aplicare', startDate)
    .lte('data_aplicare', endDate)
    .order('data_aplicare', { ascending: false });

  if (error) {
    console.error('Error fetching activitati by month:', error);
    throw error;
  }

  return data || [];
}

// Calcul data recoltare permisă și status pauză
export function calculatePauseStatus(
  dataAplicare: string,
  timpPauzaZile: number
): { dataRecoltarePermisa: string; statusPauza: 'OK' | 'Pauză' } {
  const dataAplicareDate = new Date(dataAplicare);
  const dataRecoltareDate = new Date(dataAplicareDate);
  dataRecoltareDate.setDate(dataRecoltareDate.getDate() + timpPauzaZile);
  
  const dataRecoltarePermisa = dataRecoltareDate.toISOString().split('T')[0];
  const today = new Date().toISOString().split('T')[0];
  
  const statusPauza = today >= dataRecoltarePermisa ? 'OK' : 'Pauză';
  
  return { dataRecoltarePermisa, statusPauza };
}

// POST: Creare activitate nouă
export async function createActivitateAgricola(
  input: CreateActivitateAgricolaInput
): Promise<ActivitateAgricola> {
  const supabase = createSupabaseClient();

  const nextId = await generateNextId(input.tenant_id);

  // Convert date to ISO timestamp for TIMESTAMPTZ field
  const dataAplicareISO = new Date(input.data_aplicare).toISOString();

  const { data, error } = await supabase
    .from('activitati_agricole')
    .insert({
      tenant_id: input.tenant_id,
      id_activitate: nextId,
      data_aplicare: dataAplicareISO,
      parcela_id: input.parcela_id || null,
      tip_activitate: input.tip_activitate,
      produs_utilizat: input.produs_utilizat || null,
      doza: input.doza || null,
      timp_pauza_zile: input.timp_pauza_zile || 0,
      operator: input.operator || null,
      observatii: input.observatii || null,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating activitate agricola:', error);
    throw error;
  }

  return data;
}

// PUT: Update activitate existentă
export async function updateActivitateAgricola(
  id: string,
  input: UpdateActivitateAgricolaInput
): Promise<ActivitateAgricola> {
  const supabase = createSupabaseClient();

  // Convert date to ISO timestamp if provided
  const updateData = { ...input };
  if (updateData.data_aplicare) {
    updateData.data_aplicare = new Date(updateData.data_aplicare).toISOString();
  }

  const { data, error } = await supabase
    .from('activitati_agricole')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating activitate agricola:', error);
    throw error;
  }

  return data;
}

// DELETE: Ștergere activitate
export async function deleteActivitateAgricola(id: string): Promise<void> {
  const supabase = createSupabaseClient();

  const { error } = await supabase.from('activitati_agricole').delete().eq('id', id);

  if (error) {
    console.error('Error deleting activitate agricola:', error);
    throw error;
  }
}