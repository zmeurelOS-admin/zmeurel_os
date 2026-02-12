import { createClient } from '../client';

export interface Parcela {
  id: string;
  tenant_id: string;
  id_parcela: string;
  nume_parcela: string;
  suprafata_m2: number;
  soi_plantat: string | null;
  an_plantare: number;
  nr_plante: number | null;
  status: string;
  gps_lat: number | null;
  gps_lng: number | null;
  observatii: string | null;
  created_at: string;
  updated_at: string;
}

export type NewParcela = Omit<Parcela, 'id' | 'created_at' | 'updated_at'>;

export async function getParcele(tenantId: string): Promise<Parcela[]> {
  console.log('🔍 [getParcele] Starting fetch for tenant:', tenantId);
  
  const supabase = createClient();
  
  console.log('🔍 [getParcele] Supabase client created');

  const { data, error } = await supabase
    .from('parcele')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('id_parcela', { ascending: true });

  console.log('🔍 [getParcele] Query executed');
  console.log('🔍 [getParcele] Data:', data);
  console.log('🔍 [getParcele] Error:', JSON.stringify(error, null, 2));

  if (error) {
    console.error('❌ [getParcele] Error details:', {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    });
    throw new Error(`Eroare la încărcarea parcelelor: ${error.message || 'Unknown error'}`);
  }

  console.log('✅ [getParcele] Success, returned', data?.length || 0, 'parcele');
  return data || [];
}

export async function getNextParcelaId(tenantId: string): Promise<string> {
  const supabase = createClient();

  const { count, error } = await supabase
    .from('parcele')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenantId);

  if (error) {
    console.error('❌ [getNextParcelaId] Error:', error);
    throw new Error(`Eroare la generarea ID parcelă: ${error.message}`);
  }

  const nextNumber = (count || 0) + 1;
  return `P${String(nextNumber).padStart(3, '0')}`;
}

export async function createParcela(parcela: NewParcela): Promise<Parcela> {
  console.log('🔍 [createParcela] Creating:', parcela);
  
  const supabase = createClient();

  const { data, error } = await supabase
    .from('parcele')
    .insert(parcela)
    .select()
    .single();

  if (error) {
    console.error('❌ [createParcela] Error:', {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    });
    throw new Error(`Eroare la crearea parcelei: ${error.message}`);
  }

  console.log('✅ [createParcela] Success:', data);
  return data;
}

export async function updateParcela(
  id: string,
  updates: Partial<NewParcela>
): Promise<Parcela> {
  console.log('🔍 [updateParcela] Updating:', id, updates);
  
  const supabase = createClient();

  const { data, error } = await supabase
    .from('parcele')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('❌ [updateParcela] Error:', {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    });
    throw new Error(`Eroare la actualizarea parcelei: ${error.message}`);
  }

  console.log('✅ [updateParcela] Success:', data);
  return data;
}

export async function deleteParcela(id: string): Promise<void> {
  console.log('🔍 [deleteParcela] Deleting:', id);
  
  const supabase = createClient();

  const { error } = await supabase.from('parcele').delete().eq('id', id);

  if (error) {
    console.error('❌ [deleteParcela] Error:', {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    });
    throw new Error(`Eroare la ștergerea parcelei: ${error.message}`);
  }

  console.log('✅ [deleteParcela] Success');
}

export async function getParceleCount(tenantId: string): Promise<number> {
  const supabase = createClient();

  const { count, error } = await supabase
    .from('parcele')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenantId);

  if (error) {
    console.error('❌ [getParceleCount] Error:', error);
    throw new Error(`Eroare la numărarea parcelelor: ${error.message}`);
  }

  return count || 0;
}

export async function getTotalSuprafata(tenantId: string): Promise<number> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('parcele')
    .select('suprafata_m2')
    .eq('tenant_id', tenantId);

  if (error) {
    console.error('❌ [getTotalSuprafata] Error:', error);
    throw new Error(`Eroare la calcularea suprafeței: ${error.message}`);
  }

  return data?.reduce((sum, p) => sum + (p.suprafata_m2 || 0), 0) || 0;
}
