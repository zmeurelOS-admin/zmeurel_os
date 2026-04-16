// src/lib/supabase/queries/cheltuieli.ts
import { getSupabase } from '../client';
import { generateBusinessId } from '@/lib/supabase/business-ids';
import { resolveCheltuialaCategorie } from '@/lib/financial/categories';
import { getTenantId } from '@/lib/tenant/get-tenant';

export interface Cheltuiala {
  id: string;
  id_cheltuiala: string;
  client_sync_id: string;
  data: string;
  categorie: string | null;
  descriere: string | null;
  suma_lei: number;
  furnizor: string | null;
  document_url: string | null;
  sync_status: string | null;
  conflict_flag: boolean | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  tenant_id: string | null;
}

export interface CreateCheltuialaInput {
  client_sync_id?: string;
  sync_status?: string;
  data: string;
  categorie?: string;
  descriere?: string;
  suma_lei: number;
  furnizor?: string;
  document_url?: string;
}

export interface UpdateCheltuialaInput {
  data?: string;
  categorie?: string;
  descriere?: string;
  suma_lei?: number;
  furnizor?: string;
  document_url?: string;
}

type SupabaseLikeError = {
  message?: string;
  code?: string;
  details?: string;
  hint?: string;
};

const isMissingColumnError = (error: SupabaseLikeError, column: string) =>
  error?.code === 'PGRST204' || error?.message?.includes(`'${column}'`);

const isSchemaCacheMismatch = (error: unknown) => {
  const e = (error ?? {}) as SupabaseLikeError;
  const message = (e.message ?? '').toLowerCase();
  return (
    e?.code === 'PGRST204' ||
    e?.code === '42703' ||
    isMissingColumnError(e, 'client_sync_id') ||
    message.includes('schema cache') ||
    message.includes('could not find the') ||
    message.includes('client_sync_id')
  );
};

const shouldFallbackToLegacyInsert = (error: unknown) => {
  const e = (error ?? {}) as SupabaseLikeError;
  const message = (e.message ?? '').toLowerCase();
  const code = e.code ?? '';

  return (
    code === 'PGRST204' ||
    code === '42703' ||
    code === '42P10' ||
    isMissingColumnError(e, 'client_sync_id') ||
    isMissingColumnError(e, 'sync_status') ||
    isMissingColumnError(e, 'created_by') ||
    isMissingColumnError(e, 'updated_by') ||
    message.includes('schema cache') ||
    message.includes('on conflict')
  );
};

const shouldFallbackToLegacySelect = (error: unknown) => {
  const e = (error ?? {}) as SupabaseLikeError;
  const message = (e.message ?? '').toLowerCase();
  const code = e.code ?? '';

  return (
    code === 'PGRST204' ||
    code === '42703' ||
    isMissingColumnError(e, 'client_sync_id') ||
    isMissingColumnError(e, 'sync_status') ||
    isMissingColumnError(e, 'created_by') ||
    isMissingColumnError(e, 'updated_by') ||
    message.includes('schema cache') ||
    message.includes('could not find the')
  );
};

const toReadableError = (error: unknown, fallbackMessage: string) => {
  const e = (error ?? {}) as SupabaseLikeError;
  const message = e?.message || e?.details || e?.hint || fallbackMessage;
  return Object.assign(new Error(message), {
    code: e?.code,
    details: e?.details,
    hint: e?.hint,
    isSchemaCacheError: isSchemaCacheMismatch(error),
  });
};

function normalizeCheltuialaRow(row: Record<string, unknown>): Cheltuiala {
  return {
    id: String(row.id ?? ''),
    id_cheltuiala: String(row.id_cheltuiala ?? ''),
    client_sync_id: String(row.client_sync_id ?? row.id ?? crypto.randomUUID()),
    data: String(row.data ?? ''),
    categorie: resolveCheltuialaCategorie((row.categorie as string | null) ?? null),
    descriere: (row.descriere as string | null) ?? null,
    suma_lei: Number(row.suma_lei ?? 0),
    furnizor: (row.furnizor as string | null) ?? null,
    document_url: (row.document_url as string | null) ?? null,
    sync_status: (row.sync_status as string | null) ?? null,
    conflict_flag: (row.conflict_flag as boolean | null) ?? null,
    created_by: (row.created_by as string | null) ?? null,
    updated_by: (row.updated_by as string | null) ?? null,
    created_at: String(row.created_at ?? ''),
    updated_at: String(row.updated_at ?? ''),
    tenant_id: (row.tenant_id as string | null) ?? null,
  };
}

export async function getCheltuieli(): Promise<Cheltuiala[]> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from('cheltuieli_diverse')
    .select('id,id_cheltuiala,client_sync_id,data,categorie,descriere,suma_lei,furnizor,document_url,sync_status,conflict_flag,created_by,updated_by,created_at,updated_at,tenant_id')
    .order('data', { ascending: false });

  if (!error) {
    return ((data ?? []) as unknown as Record<string, unknown>[]).map(normalizeCheltuialaRow);
  }

  if (shouldFallbackToLegacySelect(error)) {
    const { data: legacyData, error: legacyError } = await supabase
      .from('cheltuieli_diverse')
      .select('id,id_cheltuiala,data,categorie,descriere,suma_lei,furnizor,document_url,created_at,updated_at,tenant_id')
      .order('data', { ascending: false });

    if (legacyError) {
      
      throw toReadableError(legacyError, 'Nu am putut încărca cheltuielile.');
    }

    return ((legacyData ?? []) as unknown as Record<string, unknown>[]).map(normalizeCheltuialaRow);
  }

  
  throw toReadableError(error, 'Nu am putut încărca cheltuielile.');
}

export async function createCheltuiala(
  input: CreateCheltuialaInput
): Promise<Cheltuiala> {
  const supabase = getSupabase();
  const nextId = await generateBusinessId(supabase, 'CH');
  const tenantId = await getTenantId(supabase);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from('cheltuieli_diverse')
    .upsert(
      {
        client_sync_id: input.client_sync_id ?? crypto.randomUUID(),
        id_cheltuiala: nextId,
        data: input.data,
        categorie: input.categorie ? resolveCheltuialaCategorie(input.categorie) : null,
        descriere: input.descriere || null,
        suma_lei: input.suma_lei,
        furnizor: input.furnizor || null,
        document_url: input.document_url || null,
        sync_status: input.sync_status ?? 'synced',
        created_by: user?.id ?? null,
        updated_by: user?.id ?? null,
        tenant_id: tenantId,
      },
      { onConflict: 'client_sync_id' }
    )
    .select()
    .single();

  if (!error) {
    return data as unknown as Cheltuiala;
  }

  if (shouldFallbackToLegacyInsert(error)) {
    const payloadLegacy = {
      id_cheltuiala: nextId,
      data: input.data,
      categorie: input.categorie ? resolveCheltuialaCategorie(input.categorie) : null,
      descriere: input.descriere || null,
      suma_lei: input.suma_lei,
      furnizor: input.furnizor || null,
      document_url: input.document_url || null,
      tenant_id: tenantId,
    };

    const { data: fallbackData, error: fallbackError } = await supabase
      .from('cheltuieli_diverse')
      .insert(payloadLegacy)
      .select()
      .single();

    if (fallbackError) {
      
      throw toReadableError(fallbackError, 'Nu am putut salva cheltuiala.');
    }

    return fallbackData as unknown as Cheltuiala;
  }

  
  throw toReadableError(error, 'Nu am putut salva cheltuiala.');
}

export async function updateCheltuiala(
  id: string,
  input: UpdateCheltuialaInput
): Promise<Cheltuiala> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from('cheltuieli_diverse')
    .update({
      ...input,
      ...(input.categorie !== undefined
        ? { categorie: input.categorie ? resolveCheltuialaCategorie(input.categorie) : null }
        : {}),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    
    throw error;
  }

  return data as unknown as Cheltuiala;
}

export async function deleteCheltuiala(id: string): Promise<void> {
  const supabase = getSupabase();

  const { error } = await supabase
    .from('cheltuieli_diverse')
    .delete()
    .eq('id', id);

  if (error) {
    
    throw error;
  }
}

