// src/lib/supabase/queries/cheltuieli.ts
import { createClient as createSupabaseClient } from '../client';

// ========================================
// INTERFAȚĂ TYPESCRIPT
// ========================================

export interface Cheltuiala {
  id: string;
  tenant_id: string;
  id_cheltuiala: string; // "CH001", "CH002", etc.
  data: string; // DATE string ISO format
  categorie: string;
  descriere: string | null;
  suma_lei: number;
  furnizor: string | null;
  document_url: string | null; // Supabase Storage URL (pentru mai târziu)
  created_at: string;
}

// Type pentru create (fără id, created_at, id_cheltuiala auto-generat)
export type CreateCheltuialaInput = Omit<Cheltuiala, 'id' | 'created_at' | 'id_cheltuiala'>;

// Type pentru update (doar câmpurile editabile)
export type UpdateCheltuialaInput = Partial<Omit<Cheltuiala, 'id' | 'tenant_id' | 'created_at'>>;

// ========================================
// CRUD FUNCTIONS
// ========================================

/**
 * Fetch all cheltuieli pentru un tenant
 * @param tenantId - ID-ul tenant-ului
 * @returns Array de cheltuieli sortate după dată (desc)
 */
export async function getCheltuieli(tenantId: string): Promise<Cheltuiala[]> {
  console.log('[getCheltuieli] Fetching cheltuieli for tenant:', tenantId);
  
  const supabase = createSupabaseClient();
  
  const { data, error } = await supabase
    .from('cheltuieli_diverse')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('data', { ascending: false }); // Cele mai recente primero

  if (error) {
    console.error('[getCheltuieli] ERROR:', error);
    throw new Error(`Eroare la încărcarea cheltuielilor: ${error.message}`);
  }

  console.log('[getCheltuieli] SUCCESS - Fetched:', data?.length || 0, 'cheltuieli');
  return data || [];
}

/**
 * Fetch cheltuială by ID
 * @param id - UUID-ul cheltuielii
 * @returns Cheltuială sau null
 */
export async function getCheltuialaById(id: string): Promise<Cheltuiala | null> {
  console.log('[getCheltuialaById] Fetching cheltuiala ID:', id);
  
  const supabase = createSupabaseClient();
  
  const { data, error } = await supabase
    .from('cheltuieli_diverse')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    console.error('[getCheltuialaById] ERROR:', error);
    return null;
  }

  console.log('[getCheltuialaById] SUCCESS - Found:', data?.id_cheltuiala);
  return data;
}

/**
 * Generează următorul ID_Cheltuiala automat (CH001, CH002, etc.)
 * @param tenantId - ID-ul tenant-ului
 * @returns Next ID în format "CH001", "CH002", etc.
 */
async function generateNextCheltuialaId(tenantId: string): Promise<string> {
  console.log('[generateNextCheltuialaId] Generating for tenant:', tenantId);
  
  const supabase = createSupabaseClient();
  
  // Fetch ultima cheltuială din tenant
  const { data, error } = await supabase
    .from('cheltuieli_diverse')
    .select('id_cheltuiala')
    .eq('tenant_id', tenantId)
    .order('id_cheltuiala', { ascending: false })
    .limit(1);

  if (error) {
    console.error('[generateNextCheltuialaId] ERROR:', error);
    throw new Error(`Eroare la generarea ID cheltuială: ${error.message}`);
  }

  if (!data || data.length === 0) {
    // Prima cheltuială
    console.log('[generateNextCheltuialaId] First cheltuiala - Returning CH001');
    return 'CH001';
  }

  // Extrage numărul din ultimul ID (ex: "CH005" → 5)
  const lastId = data[0].id_cheltuiala;
  const lastNumber = parseInt(lastId.substring(2)); // Remove "CH" prefix
  const nextNumber = lastNumber + 1;
  const nextId = `CH${String(nextNumber).padStart(3, '0')}`; // "CH006"

  console.log('[generateNextCheltuialaId] Last ID:', lastId, '→ Next ID:', nextId);
  return nextId;
}

/**
 * Create nouă cheltuială
 * @param cheltuiala - Date cheltuială (fără id, created_at, id_cheltuiala)
 * @returns Cheltuială creată
 */
export async function createCheltuiala(cheltuiala: CreateCheltuialaInput): Promise<Cheltuiala> {
  console.log('[createCheltuiala] Creating cheltuiala:', cheltuiala.categorie);
  
  const supabase = createSupabaseClient();
  
  // 1. Generează ID automat
  const id_cheltuiala = await generateNextCheltuialaId(cheltuiala.tenant_id);
  console.log('[createCheltuiala] Generated ID:', id_cheltuiala);

  // 2. Insert în database
  const { data, error } = await supabase
    .from('cheltuieli_diverse')
    .insert({
      ...cheltuiala,
      id_cheltuiala,
    })
    .select()
    .single();

  if (error) {
    console.error('[createCheltuiala] ERROR:', error);
    throw new Error(`Eroare la crearea cheltuielii: ${error.message}`);
  }

  console.log('[createCheltuiala] SUCCESS - Created:', data.id_cheltuiala);
  return data;
}

/**
 * Update cheltuială existentă
 * @param id - UUID-ul cheltuielii
 * @param updates - Câmpuri de actualizat
 * @returns Cheltuială actualizată
 */
export async function updateCheltuiala(
  id: string,
  updates: UpdateCheltuialaInput
): Promise<Cheltuiala> {
  console.log('[updateCheltuiala] Updating cheltuiala ID:', id, 'with:', updates);
  
  const supabase = createSupabaseClient();
  
  const { data, error } = await supabase
    .from('cheltuieli_diverse')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('[updateCheltuiala] ERROR:', error);
    throw new Error(`Eroare la actualizarea cheltuielii: ${error.message}`);
  }

  console.log('[updateCheltuiala] SUCCESS - Updated:', data.id_cheltuiala);
  return data;
}

/**
 * Delete cheltuială
 * @param id - UUID-ul cheltuielii
 */
export async function deleteCheltuiala(id: string): Promise<void> {
  console.log('[deleteCheltuiala] Deleting cheltuiala ID:', id);
  
  const supabase = createSupabaseClient();
  
  const { error } = await supabase
    .from('cheltuieli_diverse')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('[deleteCheltuiala] ERROR:', error);
    throw new Error(`Eroare la ștergerea cheltuielii: ${error.message}`);
  }

  console.log('[deleteCheltuiala] SUCCESS - Deleted cheltuiala ID:', id);
}

/**
 * Fetch cheltuieli pentru o anumită perioadă
 * @param tenantId - ID-ul tenant-ului
 * @param startDate - Data început (ISO format)
 * @param endDate - Data sfârșit (ISO format)
 * @returns Array de cheltuieli în perioada specificată
 */
export async function getCheltuieliByPeriod(
  tenantId: string,
  startDate: string,
  endDate: string
): Promise<Cheltuiala[]> {
  console.log('[getCheltuieliByPeriod] Fetching for tenant:', tenantId, 'period:', startDate, '-', endDate);
  
  const supabase = createSupabaseClient();
  
  const { data, error } = await supabase
    .from('cheltuieli_diverse')
    .select('*')
    .eq('tenant_id', tenantId)
    .gte('data', startDate)
    .lte('data', endDate)
    .order('data', { ascending: false });

  if (error) {
    console.error('[getCheltuieliByPeriod] ERROR:', error);
    throw new Error(`Eroare la încărcarea cheltuielilor: ${error.message}`);
  }

  console.log('[getCheltuieliByPeriod] SUCCESS - Fetched:', data?.length || 0);
  return data || [];
}

/**
 * Calculează total cheltuieli pentru o categorie
 * @param tenantId - ID-ul tenant-ului
 * @param categorie - Categoria de cheltuieli
 * @returns Total sumă în lei
 */
export async function getTotalByCategorie(
  tenantId: string,
  categorie: string
): Promise<number> {
  console.log('[getTotalByCategorie] Calculating for tenant:', tenantId, 'categorie:', categorie);
  
  const supabase = createSupabaseClient();
  
  const { data, error } = await supabase
    .from('cheltuieli_diverse')
    .select('suma_lei')
    .eq('tenant_id', tenantId)
    .eq('categorie', categorie);

  if (error) {
    console.error('[getTotalByCategorie] ERROR:', error);
    throw new Error(`Eroare la calcularea totalului: ${error.message}`);
  }

  const total = data?.reduce((sum, item) => sum + item.suma_lei, 0) || 0;
  console.log('[getTotalByCategorie] SUCCESS - Total:', total, 'lei');
  return total;
}
