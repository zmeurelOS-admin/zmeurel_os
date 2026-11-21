import { loadSchemaFeaturesSafe } from "@/lib/schema-features"
import { getSupabase } from "@/lib/supabase/client"
import { generateBusinessId } from "@/lib/supabase/business-ids"
import { cheieDeTrimis, findByClientSyncId, isClientSyncConflict } from "@/lib/supabase/idempotency"
import { getTenantId } from "@/lib/tenant/get-tenant"
import { normalizePhoneNumber } from "@/lib/utils/normalize-phone"

export type ClientTip = 'standard' | 'patiserie' | 'magazin'

export interface Client {
  id: string
  id_client: string
  nume_client: string
  telefon: string | null
  email: string | null
  adresa: string | null
  pret_negociat_lei_kg: number | null
  observatii: string | null
  created_at: string | null
  updated_at: string | null
  tenant_id: string
  tip: ClientTip
  google_resource_name?: string | null
  google_etag?: string | null
  data_origin?: string | null
  /**
   * Locul de livrare salvat la o livrare. Lipsesc cât coloanele nu există în baza de date
   * (migrarea `20261120090000_redesign_noapte.sql`; vezi `lib/schema-features`).
   */
  latitudine?: number | null
  longitudine?: number | null
  locatie_salvata_la?: string | null
  locatie_precizie_m?: number | null
}

type ClientRowLike = Omit<Client, 'tip'> & {
  tip?: string | null
}

export interface CreateClientInput {
  nume_client: string
  telefon?: string | null
  email?: string | null
  adresa?: string | null
  pret_negociat_lei_kg?: number | null
  observatii?: string | null
  tip?: ClientTip
  /** Cheia de idempotență a formularului (aceeași la reîncercare). */
  client_sync_id?: string | null
}

export interface ClientDuplicateWarning {
  id: string
  nume_client: string
}

export interface UpdateClientInput {
  nume_client?: string
  telefon?: string | null
  email?: string | null
  adresa?: string | null
  pret_negociat_lei_kg?: number | null
  observatii?: string | null
  tip?: ClientTip
}

export function normalizeClientTip(value: string | null | undefined): ClientTip {
  return value === 'patiserie' || value === 'magazin' ? value : 'standard'
}

function mapClientRow(row: ClientRowLike): Client {
  return {
    ...row,
    tip: normalizeClientTip(row.tip),
  }
}

function triggerGoogleContactPush(client: Pick<Client, 'id' | 'tenant_id'>): void {
  if (typeof window === 'undefined') return

  void fetch('/api/integrations/google/push-client', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      clientId: client.id,
      tenantId: client.tenant_id,
    }),
    keepalive: true,
  })
    .then((response) => {
      if (!response.ok) {
        console.error('[google-push] request failed', { status: response.status })
      }
    })
    .catch(() => {
      console.error('[google-push] fetch failed')
    })
}

const CLIENT_SELECT =
  "id,id_client,nume_client,telefon,email,adresa,pret_negociat_lei_kg,observatii,created_at,updated_at,tenant_id,tip,google_resource_name,google_etag,data_origin"
const CLIENT_LOCATION_SELECT = "latitudine,longitudine,locatie_salvata_la,locatie_precizie_m"

export async function getClienți(): Promise<Client[]> {
  const supabase = getSupabase()
  const tenantId = await getTenantId(supabase)

  // Coloanele de locație se cer doar dacă există: altfel PostgREST respinge tot `select`-ul.
  const { clientiLocatie } = await loadSchemaFeaturesSafe()
  const columns = clientiLocatie ? `${CLIENT_SELECT},${CLIENT_LOCATION_SELECT}` : CLIENT_SELECT

  const { data, error } = await supabase
    .from("clienti")
    .select(columns)
    .eq("tenant_id", tenantId)
    .order("nume_client", { ascending: true })

  if (error) throw error
  return ((data ?? []) as unknown as ClientRowLike[]).map((row) => mapClientRow(row))
}

export interface ClientLocationInput {
  latitudine: number
  longitudine: number
  /** Precizia GPS, în metri. */
  precizieM: number
}

/**
 * Salvează locul de livrare al unui client. Doar la cererea fermierului (comutatorul de la „Da, livrat”
 * sau răspunsul „Da, actualizează”): locația nu se schimbă niciodată singură.
 * Refuză cât coloanele nu există în baza de date.
 */
export async function saveClientLocation(clientId: string, input: ClientLocationInput): Promise<void> {
  const { clientiLocatie } = await loadSchemaFeaturesSafe()
  if (!clientiLocatie) {
    throw new Error('Locațiile se activează după actualizarea bazei de date.')
  }
  const supabase = getSupabase()
  const tenantId = await getTenantId(supabase)
  const { error } = await supabase
    .from("clienti")
    .update({
      latitudine: input.latitudine,
      longitudine: input.longitudine,
      locatie_precizie_m: Math.round(input.precizieM * 10) / 10,
      locatie_salvata_la: new Date().toISOString(),
    })
    .eq("id", clientId)
    .eq("tenant_id", tenantId)

  if (error) throw error
}

function normalizeClientName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
}

export async function createClienți(
  input: CreateClientInput,
  options?: { onDuplicateWarning?: (existing: ClientDuplicateWarning) => void }
): Promise<Client> {
  const supabase = getSupabase()
  const tenantId = await getTenantId(supabase)
  const key = await cheieDeTrimis(input.client_sync_id)
  if (key) {
    // Reîncercarea aceleiași salvări: clientul există deja, nu se mai creează (nici avertizarea de nume).
    const existing = await findByClientSyncId<ClientRowLike>(supabase, "clienti", tenantId, key)
    if (existing) return mapClientRow(existing)
  }
  const normalizedName = normalizeClientName(input.nume_client)

  if (normalizedName) {
    const { data: existing, error: duplicateError } = await supabase
      .from("clienti")
      .select("id,nume_client")
      .eq("tenant_id", tenantId)
      .ilike("nume_client", normalizedName)
      .limit(1)

    if (duplicateError) throw duplicateError

    const similarClient = existing?.[0]
    if (similarClient) {
      options?.onDuplicateWarning?.({
        id: similarClient.id,
        nume_client: similarClient.nume_client,
      })
    }
  }

  const id_client = await generateBusinessId(supabase, 'C')

  const { data, error } = await supabase
    .from("clienti")
    .insert({
      ...(key ? { client_sync_id: key } : {}),
      tenant_id: tenantId,
      id_client,
      nume_client: input.nume_client.trim(),
      telefon: input.telefon ? normalizePhoneNumber(input.telefon) : null,
      email: input.email ?? null,
      adresa: input.adresa ?? null,
      pret_negociat_lei_kg: input.pret_negociat_lei_kg ?? null,
      observatii: input.observatii ?? null,
      tip: normalizeClientTip(input.tip),
      data_origin: 'manual',
    })
    .select()
    .single()

  if (error && key && isClientSyncConflict(error)) {
    const existing = await findByClientSyncId<ClientRowLike>(supabase, "clienti", tenantId, key)
    if (existing) return mapClientRow(existing)
  }
  if (error) throw error
  const client = mapClientRow(data as ClientRowLike)
  triggerGoogleContactPush(client)
  return client
}

export async function updateClienți(
  id: string,
  input: UpdateClientInput
): Promise<Client> {
  const supabase = getSupabase()
  const tenantId = await getTenantId(supabase)

  const { data, error } = await supabase
    .from("clienti")
    .update({
      ...input,
      telefon: input.telefon !== undefined
        ? (input.telefon ? normalizePhoneNumber(input.telefon) : null)
        : input.telefon,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .select()
    .single()

  if (error) throw error
  const client = mapClientRow(data as ClientRowLike)
  triggerGoogleContactPush(client)
  return client
}

export async function deleteClienți(id: string): Promise<void> {
  const supabase = getSupabase()
  const tenantId = await getTenantId(supabase)

  // Check for related records before deleting
  const { count: vanzariCount, error: vanzariError } = await supabase
    .from("vanzari")
    .select("*", { count: "exact", head: true })
    .eq("client_id", id)
    .eq("tenant_id", tenantId)

  if (vanzariError) throw vanzariError

  const { count: comenziCount, error: comenziError } = await supabase
    .from("comenzi")
    .select("*", { count: "exact", head: true })
    .eq("client_id", id)
    .eq("tenant_id", tenantId)

  if (comenziError) throw comenziError

  const { count: vanzariButasiCount, error: vanzariButasiError } = await supabase
    .from("vanzari_butasi")
    .select("*", { count: "exact", head: true })
    .eq("client_id", id)
    .eq("tenant_id", tenantId)

  if (vanzariButasiError) throw vanzariButasiError

  // If any related records exist, throw a descriptive error
  if ((vanzariCount ?? 0) > 0 || (comenziCount ?? 0) > 0 || (vanzariButasiCount ?? 0) > 0) {
    const parts: string[] = []
    if ((vanzariCount ?? 0) > 0) parts.push(`${vanzariCount} vânzări`)
    if ((comenziCount ?? 0) > 0) parts.push(`${comenziCount} comenzi`)
    if ((vanzariButasiCount ?? 0) > 0) parts.push(`${vanzariButasiCount} vânzări butași`)
    
    throw new Error(`Nu poți șterge acest client. Are ${parts.join(" și ")} asociate.`)
  }

  // Only proceed with delete if all counts are 0
  const { error } = await supabase
    .from("clienti")
    .delete()
    .eq("id", id)
    .eq("tenant_id", tenantId)

  if (error) throw error
}
