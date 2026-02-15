// src/lib/supabase/queries/investitii.ts
import { createClient as createSupabaseClient } from '../client';

// Interface pentru Investiție
export interface Investitie {
  id: string;
  tenant_id: string;
  id_investitie: string;
  data: string; // Date format: YYYY-MM-DD
  parcela_id: string | null;
  categorie: string;
  furnizor: string | null;
  descriere: string | null;
  suma_lei: number;
  created_at: string;
}

// Categorii CAPEX disponibile
export const CATEGORII_INVESTITII = [
  'Butași',
  'Spalieri & Sârmă',
  'Sistem Irigație',
  'Transport & Logistică',
  'Manoperă Plantare',
  'Alte Investiții',
] as const;

// Culori pentru badge-uri categorii (inline styles pentru Tailwind v4 alpha)
export const BADGE_COLORS: Record<string, { bg: string; text: string }> = {
  'Butași': { bg: '#dcfce7', text: '#166534' }, // green
  'Spalieri & Sârmă': { bg: '#dbeafe', text: '#1e40af' }, // blue
  'Sistem Irigație': { bg: '#cffafe', text: '#155e75' }, // cyan
  'Transport & Logistică': { bg: '#fef3c7', text: '#92400e' }, // yellow
  'Manoperă Plantare': { bg: '#f3e8ff', text: '#6b21a8' }, // purple
  'Alte Investiții': { bg: '#f3f4f6', text: '#374151' }, // gray
};

// Input pentru creare investiție
export interface CreateInvestitieInput {
  tenant_id: string;
  data: string;
  parcela_id?: string | null;
  categorie: string;
  furnizor?: string;
  descriere?: string;
  suma_lei: number;
}

// Input pentru update investiție
export interface UpdateInvestitieInput {
  data?: string;
  parcela_id?: string | null;
  categorie?: string;
  furnizor?: string;
  descriere?: string;
  suma_lei?: number;
}

// Generare ID automat pentru investiții: INV001, INV002, etc.
async function generateNextId(tenantId: string): Promise<string> {
  const supabase = createSupabaseClient();

  const { data, error } = await supabase
    .from('investitii')
    .select('id_investitie')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(1);

  if (error) {
    console.error('Error fetching last investitie ID:', error);
    return 'INV001';
  }

  if (!data || data.length === 0) {
    return 'INV001';
  }

  const lastId = data[0].id_investitie;
  const numericPart = parseInt(lastId.replace('INV', ''), 10);
  
  if (isNaN(numericPart)) {
    console.error('Invalid ID format:', lastId);
    return 'INV001';
  }
  
  const nextNumber = numericPart + 1;

  return `INV${nextNumber.toString().padStart(3, '0')}`;
}

// GET: Toate investițiile pentru un tenant
export async function getInvestitii(tenantId: string): Promise<Investitie[]> {
  const supabase = createSupabaseClient();

  const { data, error } = await supabase
    .from('investitii')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('data', { ascending: false }); // Cele mai recente primero

  if (error) {
    console.error('Error fetching investitii:', error);
    throw error;
  }

  return data || [];
}

// GET: Investiții pentru o anumită lună
export async function getInvestitiiByMonth(
  tenantId: string,
  year: number,
  month: number
): Promise<Investitie[]> {
  const supabase = createSupabaseClient();

  // Data începere și sfârșit lună
  const startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
  const endDate = new Date(year, month, 0).toISOString().split('T')[0]; // Ultima zi a lunii

  const { data, error } = await supabase
    .from('investitii')
    .select('*')
    .eq('tenant_id', tenantId)
    .gte('data', startDate)
    .lte('data', endDate)
    .order('data', { ascending: false });

  if (error) {
    console.error('Error fetching investitii by month:', error);
    throw error;
  }

  return data || [];
}

// GET: Investiții pentru o anumită perioadă
export async function getInvestitiiByPeriod(
  tenantId: string,
  startDate: string,
  endDate: string
): Promise<Investitie[]> {
  const supabase = createSupabaseClient();

  const { data, error } = await supabase
    .from('investitii')
    .select('*')
    .eq('tenant_id', tenantId)
    .gte('data', startDate)
    .lte('data', endDate)
    .order('data', { ascending: false });

  if (error) {
    console.error('Error fetching investitii by period:', error);
    throw error;
  }

  return data || [];
}

// GET: Total sumă investiții pentru o categorie
export async function getTotalByCategorie(
  tenantId: string,
  categorie: string
): Promise<number> {
  const supabase = createSupabaseClient();

  const { data, error } = await supabase
    .from('investitii')
    .select('suma_lei')
    .eq('tenant_id', tenantId)
    .eq('categorie', categorie);

  if (error) {
    console.error('Error calculating total by categorie:', error);
    return 0;
  }

  return data?.reduce((sum, inv) => sum + inv.suma_lei, 0) || 0;
}

// POST: Creare investiție nouă
export async function createInvestitie(
  input: CreateInvestitieInput
): Promise<Investitie> {
  const supabase = createSupabaseClient();

  const nextId = await generateNextId(input.tenant_id);

  const { data, error } = await supabase
    .from('investitii')
    .insert({
      tenant_id: input.tenant_id,
      id_investitie: nextId,
      data: input.data,
      parcela_id: input.parcela_id || null,
      categorie: input.categorie,
      furnizor: input.furnizor || null,
      descriere: input.descriere || null,
      suma_lei: input.suma_lei,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating investitie:', error);
    throw error;
  }

  return data;
}

// PUT: Update investiție existentă
export async function updateInvestitie(
  id: string,
  input: UpdateInvestitieInput
): Promise<Investitie> {
  const supabase = createSupabaseClient();

  const { data, error } = await supabase
    .from('investitii')
    .update(input)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating investitie:', error);
    throw error;
  }

  return data;
}

// DELETE: Ștergere investiție
export async function deleteInvestitie(id: string): Promise<void> {
  const supabase = createSupabaseClient();

  const { error } = await supabase.from('investitii').delete().eq('id', id);

  if (error) {
    console.error('Error deleting investitie:', error);
    throw error;
  }
}
