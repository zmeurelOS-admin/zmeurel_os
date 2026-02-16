// src/lib/supabase/queries/clienti.ts
import { createClient as createSupabaseClient } from '../client';

// ========================================
// INTERFAȚĂ TYPESCRIPT
// ========================================

export interface Client {
  id: string;
  tenant_id: string;
  id_client: string; // "CL001", "CL002", etc.
  nume_client: string;
  telefon: string | null;
  email: string | null;
  adresa: string | null;
  pret_negociat_lei_kg: number | null; // NULL = preț standard
  observatii: string | null;
  created_at: string;
}

// Type pentru create (fără id, created_at, id_client auto-generat)
export type CreateClientInput = Omit<Client, 'id' | 'created_at' | 'id_client'>;

// Type pentru update (doar câmpurile editabile)
export type UpdateClientInput = Partial<Omit<Client, 'id' | 'tenant_id' | 'created_at'>>;

// ========================================
// CRUD FUNCTIONS
// ========================================

/**
 * Fetch all clienți pentru un tenant
 * @param tenantId - ID-ul tenant-ului
 * @returns Array de clienți sortați după id_client
 */
export async function getClienti(tenantId: string): Promise<Client[]> {
  console.log('[getClienti] Fetching clienti for tenant:', tenantId);
  
  const supabase = createSupabaseClient();
  
  const { data, error } = await supabase
    .from('clienti')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('id_client', { ascending: true });

  if (error) {
    console.error('[getClienti] ERROR:', error);
    throw new Error(`Eroare la încărcarea clienților: ${error.message}`);
  }

  console.log('[getClienti] SUCCESS - Fetched:', data?.length || 0, 'clienti');
  return data || [];
}

/**
 * Fetch client by ID
 * @param id - UUID-ul clientului
 * @returns Client sau null
 */
export async function getClientById(id: string): Promise<Client | null> {
  console.log('[getClientById] Fetching client ID:', id);
  
  const supabase = createSupabaseClient();
  
  const { data, error } = await supabase
    .from('clienti')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    console.error('[getClientById] ERROR:', error);
    return null;
  }

  console.log('[getClientById] SUCCESS - Found:', data?.nume_client);
  return data;
}

/**
 * Generează următorul ID_Client automat (CL001, CL002, etc.)
 * @param tenantId - ID-ul tenant-ului
 * @returns Next ID în format "CL001", "CL002", etc.
 */
async function generateNextClientId(tenantId: string): Promise<string> {
  console.log('[generateNextClientId] Generating for tenant:', tenantId);
  
  const supabase = createSupabaseClient();
  
  // Fetch ultimul client din tenant
  const { data, error } = await supabase
    .from('clienti')
    .select('id_client')
    .eq('tenant_id', tenantId)
    .order('id_client', { ascending: false })
    .limit(1);

  if (error) {
    console.error('[generateNextClientId] ERROR:', error);
    throw new Error(`Eroare la generarea ID client: ${error.message}`);
  }

  if (!data || data.length === 0) {
    // Primul client
    console.log('[generateNextClientId] First client - Returning CL001');
    return 'CL001';
  }

  // Extrage numărul din ultimul ID (ex: "CL005" → 5)
  const lastId = data[0].id_client;
  const lastNumber = parseInt(lastId.substring(2)); // Remove "CL" prefix
  const nextNumber = lastNumber + 1;
  const nextId = `CL${String(nextNumber).padStart(3, '0')}`; // "CL006"

  console.log('[generateNextClientId] Last ID:', lastId, '→ Next ID:', nextId);
  return nextId;
}

/**
 * Create nou client
 * @param client - Date client (fără id, created_at, id_client)
 * @returns Client creat
 */
export async function createClient(client: CreateClientInput): Promise<Client> {
  console.log('[createClient] Creating client:', client.nume_client);
  
  const supabase = createSupabaseClient();
  
  // 1. Generează ID automat
  const id_client = await generateNextClientId(client.tenant_id);
  console.log('[createClient] Generated ID:', id_client);

  // 2. Insert în database
  const { data, error } = await supabase
    .from('clienti')
    .insert({
      ...client,
      id_client,
    })
    .select()
    .single();

  if (error) {
    console.error('[createClient] ERROR:', error);
    throw new Error(`Eroare la crearea clientului: ${error.message}`);
  }

  console.log('[createClient] SUCCESS - Created:', data.id_client, data.nume_client);
  return data;
}

/**
 * Update client existent
 * @param id - UUID-ul clientului
 * @param updates - Câmpuri de actualizat
 * @returns Client actualizat
 */
export async function updateClient(
  id: string,
  updates: UpdateClientInput
): Promise<Client> {
  console.log('[updateClient] Updating client ID:', id, 'with:', updates);
  
  const supabase = createSupabaseClient();
  
  const { data, error } = await supabase
    .from('clienti')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('[updateClient] ERROR:', error);
    throw new Error(`Eroare la actualizarea clientului: ${error.message}`);
  }

  console.log('[updateClient] SUCCESS - Updated:', data.id_client, data.nume_client);
  return data;
}

/**
 * Delete client
 * @param id - UUID-ul clientului
 */
export async function deleteClient(id: string): Promise<void> {
  console.log('[deleteClient] Deleting client ID:', id);
  
  const supabase = createSupabaseClient();
  
  const { error } = await supabase
    .from('clienti')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('[deleteClient] ERROR:', error);
    throw new Error(`Eroare la ștergerea clientului: ${error.message}`);
  }

  console.log('[deleteClient] SUCCESS - Deleted client ID:', id);
}

/**
 * Fetch clienți cu preț negociat (pentru rapoarte)
 * @param tenantId - ID-ul tenant-ului
 * @returns Array de clienți cu prețuri negociate
 */
export async function getClientiCuPretNegociat(tenantId: string): Promise<Client[]> {
  console.log('[getClientiCuPretNegociat] Fetching for tenant:', tenantId);
  
  const supabase = createSupabaseClient();
  
  const { data, error } = await supabase
    .from('clienti')
    .select('*')
    .eq('tenant_id', tenantId)
    .not('pret_negociat_lei_kg', 'is', null)
    .order('nume_client', { ascending: true });

  if (error) {
    console.error('[getClientiCuPretNegociat] ERROR:', error);
    throw new Error(`Eroare la încărcarea clienților: ${error.message}`);
  }

  console.log('[getClientiCuPretNegociat] SUCCESS - Fetched:', data?.length || 0);
  return data || [];
}
