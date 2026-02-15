// src/lib/supabase/queries/culegatori.ts
import { createClient } from '../client';

// ========================================
// INTERFAȚĂ TYPESCRIPT
// ========================================

export interface Culegator {
  id: string;
  tenant_id: string;
  id_culegator: string; // "C001", "C002", etc.
  nume_prenume: string;
  telefon: string | null;
  tip_angajare: string; // "Sezonier", "Permanent", etc.
  tarif_lei_kg: number; // 0 = salarizat fix
  data_angajare: string | null; // DATE string ISO format
  status_activ: boolean;
  created_at: string;
}

// Type pentru create (fără id, created_at, id_culegator auto-generat)
export type CreateCulegatorInput = Omit<Culegator, 'id' | 'created_at' | 'id_culegator'>;

// Type pentru update (doar câmpurile editabile)
export type UpdateCulegatorInput = Partial<Omit<Culegator, 'id' | 'tenant_id' | 'created_at'>>;

// ========================================
// CRUD FUNCTIONS
// ========================================

/**
 * Fetch all culegători pentru un tenant
 * @param tenantId - ID-ul tenant-ului
 * @returns Array de culegători sortați după id_culegator
 */
export async function getCulegatori(tenantId: string): Promise<Culegator[]> {
  console.log('[getCulegatori] Fetching culegatori for tenant:', tenantId);
  
  const supabase = createClient();
  
  const { data, error } = await supabase
    .from('culegatori')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('id_culegator', { ascending: true });

  if (error) {
    console.error('[getCulegatori] ERROR:', error);
    throw new Error(`Eroare la încărcarea culegătorilor: ${error.message}`);
  }

  console.log('[getCulegatori] SUCCESS - Fetched:', data?.length || 0, 'culegatori');
  return data || [];
}

/**
 * Fetch culegător by ID
 * @param id - UUID-ul culegătorului
 * @returns Culegător sau null
 */
export async function getCulegatorById(id: string): Promise<Culegator | null> {
  console.log('[getCulegatorById] Fetching culegator ID:', id);
  
  const supabase = createClient();
  
  const { data, error } = await supabase
    .from('culegatori')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    console.error('[getCulegatorById] ERROR:', error);
    return null;
  }

  console.log('[getCulegatorById] SUCCESS - Found:', data?.nume_prenume);
  return data;
}

/**
 * Generează următorul ID_Culegator automat (C001, C002, etc.)
 * @param tenantId - ID-ul tenant-ului
 * @returns Next ID în format "C001", "C002", etc.
 */
async function generateNextCulegatorId(tenantId: string): Promise<string> {
  console.log('[generateNextCulegatorId] Generating for tenant:', tenantId);
  
  const supabase = createClient();
  
  // Fetch ultimul culegător din tenant
  const { data, error } = await supabase
    .from('culegatori')
    .select('id_culegator')
    .eq('tenant_id', tenantId)
    .order('id_culegator', { ascending: false })
    .limit(1);

  if (error) {
    console.error('[generateNextCulegatorId] ERROR:', error);
    throw new Error(`Eroare la generarea ID culegător: ${error.message}`);
  }

  if (!data || data.length === 0) {
    // Primul culegător
    console.log('[generateNextCulegatorId] First culegator - Returning C001');
    return 'C001';
  }

  // Extrage numărul din ultimul ID (ex: "C005" → 5)
  const lastId = data[0].id_culegator;
  const lastNumber = parseInt(lastId.substring(1)); // Remove "C" prefix
  const nextNumber = lastNumber + 1;
  const nextId = `C${String(nextNumber).padStart(3, '0')}`; // "C006"

  console.log('[generateNextCulegatorId] Last ID:', lastId, '→ Next ID:', nextId);
  return nextId;
}

/**
 * Create nou culegător
 * @param culegator - Date culegător (fără id, created_at, id_culegator)
 * @returns Culegător creat
 */
export async function createCulegator(culegator: CreateCulegatorInput): Promise<Culegator> {
  console.log('[createCulegator] Creating culegator:', culegator.nume_prenume);
  
  const supabase = createClient();
  
  // 1. Generează ID automat
  const id_culegator = await generateNextCulegatorId(culegator.tenant_id);
  console.log('[createCulegator] Generated ID:', id_culegator);

  // 2. Insert în database
  const { data, error } = await supabase
    .from('culegatori')
    .insert({
      ...culegator,
      id_culegator,
    })
    .select()
    .single();

  if (error) {
    console.error('[createCulegator] ERROR:', error);
    throw new Error(`Eroare la crearea culegătorului: ${error.message}`);
  }

  console.log('[createCulegator] SUCCESS - Created:', data.id_culegator, data.nume_prenume);
  return data;
}

/**
 * Update culegător existent
 * @param id - UUID-ul culegătorului
 * @param updates - Câmpuri de actualizat
 * @returns Culegător actualizat
 */
export async function updateCulegator(
  id: string,
  updates: UpdateCulegatorInput
): Promise<Culegator> {
  console.log('[updateCulegator] Updating culegator ID:', id, 'with:', updates);
  
  const supabase = createClient();
  
  const { data, error } = await supabase
    .from('culegatori')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('[updateCulegator] ERROR:', error);
    throw new Error(`Eroare la actualizarea culegătorului: ${error.message}`);
  }

  console.log('[updateCulegator] SUCCESS - Updated:', data.id_culegator, data.nume_prenume);
  return data;
}

/**
 * Delete culegător
 * @param id - UUID-ul culegătorului
 */
export async function deleteCulegator(id: string): Promise<void> {
  console.log('[deleteCulegator] Deleting culegator ID:', id);
  
  const supabase = createClient();
  
  const { error } = await supabase
    .from('culegatori')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('[deleteCulegator] ERROR:', error);
    throw new Error(`Eroare la ștergerea culegătorului: ${error.message}`);
  }

  console.log('[deleteCulegator] SUCCESS - Deleted culegator ID:', id);
}

/**
 * Toggle status activ/inactiv pentru culegător
 * @param id - UUID-ul culegătorului
 * @param status_activ - Noul status (true/false)
 * @returns Culegător actualizat
 */
export async function toggleCulegatorStatus(
  id: string,
  status_activ: boolean
): Promise<Culegator> {
  console.log('[toggleCulegatorStatus] Toggling status for ID:', id, 'to:', status_activ);
  
  return updateCulegator(id, { status_activ });
}

/**
 * Fetch only active culegători (pentru dropdown-uri)
 * @param tenantId - ID-ul tenant-ului
 * @returns Array de culegători activi
 */
export async function getActiveCulegatori(tenantId: string): Promise<Culegator[]> {
  console.log('[getActiveCulegatori] Fetching active culegatori for tenant:', tenantId);
  
  const supabase = createClient();
  
  const { data, error } = await supabase
    .from('culegatori')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('status_activ', true)
    .order('nume_prenume', { ascending: true });

  if (error) {
    console.error('[getActiveCulegatori] ERROR:', error);
    throw new Error(`Eroare la încărcarea culegătorilor activi: ${error.message}`);
  }

  console.log('[getActiveCulegatori] SUCCESS - Fetched:', data?.length || 0, 'active culegatori');
  return data || [];
}
