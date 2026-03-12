// src/lib/supabase/queries/vanzari.ts
import { getSupabase } from '../client';
import { insertMiscareStoc, deleteMiscariStocByReference } from './miscari-stoc';
import { getTenantId } from '@/lib/tenant/get-tenant';

// Constants
export const STATUS_PLATA = ['Platit', 'Restanta', 'Avans'] as const;

export interface Vanzare {
  id: string;
  id_vanzare: string;
  client_sync_id: string;
  data: string;
  client_id: string | null;
  comanda_id?: string | null;
  cantitate_kg: number;
  pret_lei_kg: number;
  pret_unitar_lei: number;
  status_plata: string;
  observatii_ladite: string | null;
  sync_status: string | null;
  conflict_flag: boolean | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  tenant_id: string | null;
}

export interface CreateVanzareInput {
  client_sync_id?: string;
  sync_status?: string;
  tenant_id?: string;
  data: string;
  client_id?: string;
  comanda_id?: string | null;
  cantitate_kg: number;
  pret_lei_kg: number;
  status_plata?: string;
  observatii_ladite?: string;
}

export interface UpdateVanzareInput {
  data?: string;
  client_id?: string;
  cantitate_kg?: number;
  pret_lei_kg?: number;
  status_plata?: string;
  observatii_ladite?: string;
}

type SupabaseLikeError = {
  message?: string;
  code?: string;
  details?: string;
  hint?: string;
};

type VanzareRpcClient = ReturnType<typeof getSupabase> & {
  rpc: {
    (
      fn: 'create_vanzare_with_stock',
      args: {
        p_data: string;
        p_client_id?: string | null;
        p_comanda_id?: string | null;
        p_cantitate_kg: number;
        p_pret_lei_kg: number;
        p_status_plata?: string;
        p_observatii_ladite?: string | null;
        p_client_sync_id?: string;
        p_sync_status?: string;
        p_tenant_id?: string;
      }
    ): Promise<{ data: Vanzare | null; error: SupabaseLikeError | null }>;
    (
      fn: 'delete_vanzare_with_stock',
      args: { p_vanzare_id: string }
    ): Promise<{ data: null; error: SupabaseLikeError | null }>;
  };
};

const isMissingColumnError = (error: SupabaseLikeError, column: string) =>
  error?.code === 'PGRST204' ||
  error?.code === '42703' ||
  error?.message?.includes(`'${column}'`) ||
  error?.message?.includes(column);

const toReadableError = (error: unknown, fallbackMessage: string) => {
  const e = (error ?? {}) as SupabaseLikeError;
  const message =
    e?.message ||
    e?.details ||
    e?.hint ||
    fallbackMessage;

  return Object.assign(new Error(message), {
    code: e?.code,
    details: e?.details,
    hint: e?.hint,
  });
};

export async function getVanzari(): Promise<Vanzare[]> {
  const supabase = getSupabase();
  const selectWithComanda = 'id,id_vanzare,data,client_id,comanda_id,cantitate_kg,pret_lei_kg,status_plata,observatii_ladite,created_at,updated_at,tenant_id';
  const selectLegacy = 'id,id_vanzare,data,client_id,cantitate_kg,pret_lei_kg,status_plata,observatii_ladite,created_at,updated_at,tenant_id';

  const { data, error } = await supabase
    .from('vanzari')
    .select(selectWithComanda)
    .order('data', { ascending: false });

  if (error && isMissingColumnError(error, 'comanda_id')) {
    const { data: legacyData, error: legacyError } = await supabase
      .from('vanzari')
      .select(selectLegacy)
      .order('data', { ascending: false });

    if (legacyError) {
      console.error('Error fetching vanzari:', JSON.stringify(legacyError));
      throw legacyError;
    }

    return (legacyData ?? []) as unknown as Vanzare[];
  }

  if (error) {
    console.error('Error fetching vanzari:', JSON.stringify(error));
    throw error;
  }

  return (data ?? []) as unknown as Vanzare[];
}

export async function createVanzare(input: CreateVanzareInput): Promise<Vanzare> {
  const supabase = getSupabase();
  const tenantId = input.tenant_id ?? (await getTenantId(supabase));
  const rpcClient = supabase as VanzareRpcClient;
  const { data, error } = await rpcClient.rpc('create_vanzare_with_stock', {
    p_data: input.data,
    p_client_id: input.client_id || null,
    p_comanda_id: input.comanda_id ?? null,
    p_cantitate_kg: Number(input.cantitate_kg || 0),
    p_pret_lei_kg: Number(input.pret_lei_kg || 0),
    p_status_plata: input.status_plata || 'Platit',
    p_observatii_ladite: input.observatii_ladite || null,
    p_client_sync_id: input.client_sync_id ?? crypto.randomUUID(),
    p_sync_status: input.sync_status ?? 'synced',
    p_tenant_id: tenantId,
  });

  if (!error && data) {
    return data as unknown as Vanzare;
  }

  const maybeError = error as SupabaseLikeError;
  console.error('Error creating vanzare:', {
    message: maybeError?.message,
    code: maybeError?.code,
    details: maybeError?.details,
    hint: maybeError?.hint,
  });
  throw toReadableError(error, 'Nu am putut salva vanzarea.');

}

export async function updateVanzare(id: string, input: UpdateVanzareInput): Promise<Vanzare> {
  const supabase = getSupabase();

  // First, fetch the old vanzare to compare cantitate_kg
  const { data: oldVanzare, error: fetchError } = await supabase
    .from('vanzari')
    .select('cantitate_kg, data')
    .eq('id', id)
    .single();

  if (fetchError) {
    console.error('Error fetching old vanzare:', fetchError);
    throw fetchError;
  }

  const { data, error } = await supabase
    .from('vanzari')
    .update({
      ...input,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating vanzare:', error);
    throw error;
  }

  // If cantitate_kg changed, update the stock movement
  if (input.cantitate_kg !== undefined && input.cantitate_kg !== oldVanzare.cantitate_kg) {
    // Delete old miscari_stoc record
    await deleteMiscariStocByReference(id, 'vanzare');

    // Create new miscari_stoc record with updated cantitate_kg
    try {
      await insertMiscareStoc({
        tip: 'vanzare',
        cantitate_cal1: -Number(data.cantitate_kg),
        cantitate_cal2: 0,
        referinta_id: data.id,
        data: data.data,
        descriere: 'Scadere stoc la vanzare',
      });
    } catch (stockError) {
      console.error('Warning: failed to write stock movement for vanzare update:', stockError);
    }
  }

  return data as unknown as Vanzare;
}

export async function deleteVanzare(id: string): Promise<void> {
  const supabase = getSupabase();
  const rpcClient = supabase as VanzareRpcClient;
  const { error } = await rpcClient.rpc('delete_vanzare_with_stock', {
    p_vanzare_id: id,
  });

  if (error) {
    console.error('Error deleting vanzare:', error);
    throw error;
  }
}
