import { getSupabase } from '../client'
import { getTenantId } from '@/lib/tenant/get-tenant'
import { loadSchemaFeaturesSafe } from '@/lib/schema-features'
import { cheieDeTrimis, findByClientSyncId, isClientSyncConflict } from '@/lib/supabase/idempotency'
import { getSellableCal1StockSummary } from './miscari-stoc'
import type { Tables, TablesInsert, TablesUpdate } from '@/types/supabase'
import { type Vanzare } from './vanzari'
import { ziuaInRomania } from '@/lib/utils/bucharest-date'
import { completeazaStareaPlatii, type StarePlataRpcClient } from '@/lib/comenzi/stare-plata'
import { culturaPrincipala, culturileFermei } from '@/lib/parcele/culturi-ferma'
import { asiguraProdusCultura } from './produse-cultura'

export const COMENZI_STATUSES = [
  'noua',
  'confirmata',
  'programata',
  'in_livrare',
  'livrata',
  'anulata',
] as const

export type ComandaStatus = (typeof COMENZI_STATUSES)[number]
export type ComandaPaymentStatus = 'platit' | 'neplatit'
export const COMANDA_ORDER_KINDS = ['manual', 'cadou', 'consum_propriu'] as const
export type ComandaOrderKind = (typeof COMANDA_ORDER_KINDS)[number]

export interface ComandaLinkedVanzare {
  status_plata: string | null
  data_incasare: string | null
  /** Banii vânzării (cât s-a livrat de fapt, nu cât s-a comandat), pentru „de încasat”. */
  cantitate_kg?: number | null
  pret_lei_kg?: number | null
  suma_incasata_partial_lei?: number | null
}

export interface Comanda {
  id: string
  tenant_id: string
  client_id: string | null
  client_nume_manual: string | null
  telefon: string | null
  locatie_livrare: string | null
  data_comanda: string
  data_livrare: string | null
  cantitate_kg: number
  pret_per_kg: number
  total: number
  order_kind?: ComandaOrderKind
  status: ComandaStatus
  observatii: string | null
  linked_vanzare_id: string | null
  linked_vanzare?: ComandaLinkedVanzare | null
  shop_order_id?: string | null
  parent_comanda_id: string | null
  created_at: string
  updated_at: string
  created_by?: string | null
  updated_by?: string | null
  /** Ex. `magazin_public` pentru comenzi din magazinul fermierului. */
  data_origin: string | null
  /** Semnal neblocant pentru un telefon activ deja folosit de alt nume. */
  dup_phone_warning?: string | null
  /** Stare operațională din Livrări; null când apelul nu are marcaj. */
  last_call_status?: 'no_answer' | null
  client_nume?: string | null
  /** Poziție manuală în traseul de livrare (drag-and-drop din /livrari); null = ordine FIFO. */
  ordine_livrare?: number | null
  /**
   * Se livrează cu prioritate. `false` și cât coloana nu există în baza de date
   * (migrarea `20261120090000_redesign_noapte.sql`; vezi `lib/schema-features`).
   */
  prioritara?: boolean
}

export interface CreateComandaInput {
  /** Se trimite doar dacă există coloana. */
  prioritara?: boolean
  client_id?: string | null
  client_nume_manual?: string | null
  telefon?: string | null
  locatie_livrare?: string | null
  data_comanda?: string
  data_livrare?: string | null
  cantitate_kg: number
  pret_per_kg: number
  order_kind?: ComandaOrderKind
  status?: ComandaStatus
  observatii?: string | null
  /** Cheia de idempotență a formularului (aceeași la reîncercare). */
  client_sync_id?: string | null
  /** Cultura comenzii („Afine”), aleasă când ferma are mai multe; lipsă = cultura principală a fermei. */
  cultura?: string | null
}

export interface UpdateComandaInput {
  /** Se trimite doar dacă există coloana. */
  prioritara?: boolean
  client_id?: string | null
  client_nume_manual?: string | null
  telefon?: string | null
  locatie_livrare?: string | null
  data_comanda?: string
  data_livrare?: string | null
  cantitate_kg?: number
  pret_per_kg?: number
  order_kind?: ComandaOrderKind
  status?: ComandaStatus
  observatii?: string | null
  last_call_status?: 'no_answer' | null
}

export interface DeliverComandaInput {
  comandaId: string
  cantitateLivrataKg: number
  statusPlata: ComandaPaymentStatus
  dataLivrareRamasa?: string | null
}

export interface DeliverShopOrderPartialInput {
  shopOrderId: string
  deliveredKg: number
  statusPlata?: ComandaPaymentStatus
  dataLivrareRamasa?: string | null
}

type SupabaseLikeError = {
  message?: string
  code?: string
  details?: string
  hint?: string
}

type DeliverOrderAtomicPayload = {
  already_delivered?: boolean
  delivered_order: Record<string, unknown> | null
  vanzare: Vanzare | null
  remaining_order: Record<string, unknown> | null
  deducted_stock_kg: number | null
}

type DeliverShopOrderPayload = {
  delivery?: DeliverOrderAtomicPayload | null
  remaining_order?: Record<string, unknown> | null
}

type DeliverAndCloneComandaPayload = {
  delivered_order: Record<string, unknown> | null
  vanzare: Vanzare | null
  new_order: Record<string, unknown> | null
}

type ComandaRow = Tables<'comenzi'>
type ComandaQueryRow = ComandaRow & {
  order_kind?: string | null
  clienti?: Pick<Tables<'clienti'>, 'nume_client'> | null
  vanzare?: {
    status_plata?: string | null
    data_incasare?: string | null
    cantitate_kg?: number | null
    pret_lei_kg?: number | null
    suma_incasata_partial_lei?: number | null
  } | null
  shop_order_link?: {
    shop_order_id?: string | null
  } | null
}
type ComandaInsertCompat = Omit<TablesInsert<'comenzi'>, 'data_livrare'> & {
  data_livrare: string | null
  order_kind?: string
}
type ComandaUpdateCompat = Omit<TablesUpdate<'comenzi'>, 'data_livrare'> & {
  data_livrare?: string | null
  order_kind?: string
}

const COMANDA_BASE_SELECT_FIELDS: string = `
  id,
  tenant_id,
  client_id,
  client_nume_manual,
  telefon,
  locatie_livrare,
  data_comanda,
  data_livrare,
  cantitate_kg,
  pret_per_kg,
  total,
  order_kind,
  status,
  observatii,
  linked_vanzare_id,
  parent_comanda_id,
  created_at,
  updated_at,
  created_by,
  updated_by,
  data_origin,
  dup_phone_warning,
  last_call_status,
  ordine_livrare,
  clienti (
    nume_client
  ),
  vanzare:vanzari!comenzi_linked_vanzare_id_fkey (
    status_plata,
    data_incasare,
    cantitate_kg,
    pret_lei_kg,
    suma_incasata_partial_lei
  ),
  shop_order_link:shop_order_erp_links!shop_order_erp_links_comanda_id_fkey (
    shop_order_id
  )
`

/**
 * Coloanele cerute la citire. `prioritara` se cere doar dacă există: altfel PostgREST respinge tot `select`-ul.
 */
async function resolveComandaSelect(): Promise<{ fields: string; hasPrioritara: boolean }> {
  const { comenziPrioritara } = await loadSchemaFeaturesSafe()
  return {
    fields: comenziPrioritara ? `prioritara,${COMANDA_BASE_SELECT_FIELDS}` : COMANDA_BASE_SELECT_FIELDS,
    hasPrioritara: comenziPrioritara,
  }
}

type ComenziRpcClient = ReturnType<typeof getSupabase> & {
  rpc: {
    (
      fn: 'set_comanda_delivered',
      args: {
        p_comanda_id: string
        p_delivered_qty: number | null
        p_status_plata: ComandaPaymentStatus
      }
    ): Promise<{
      data: DeliverOrderAtomicPayload | null
      error: SupabaseLikeError | null
    }>
    (
      fn: 'delete_comanda_atomic',
      args: {
        p_comanda_id: string
        p_tenant_id: string
      }
    ): Promise<{
      data: null
      error: SupabaseLikeError | null
    }>
    (
      fn: 'reopen_comanda_atomic',
      args: {
        p_comanda_id: string
        p_tenant_id: string
      }
    ): Promise<{
      data: Record<string, unknown> | null
      error: SupabaseLikeError | null
    }>
    (
      fn: 'set_shop_order_delivered',
      args: {
        p_shop_order_id: string
        p_delivered_qty: number | null
        p_status_plata: ComandaPaymentStatus
      }
    ): Promise<{
      data: DeliverShopOrderPayload | null
      error: SupabaseLikeError | null
    }>
    (
      fn: 'set_comanda_in_delivery',
      args: {
        p_comanda_id: string
      }
    ): Promise<{
      data: ComandaQueryRow | null
      error: SupabaseLikeError | null
    }>
    (
      fn: 'mark_comanda_incasata',
      args: {
        p_comanda_id: string
      }
    ): Promise<{
      data: Vanzare | null
      error: SupabaseLikeError | null
    }>
    (
      fn: 'livreaza_si_copiaza_comanda',
      args: {
        p_comanda_id: string
        p_new_cantitate_kg: number
        p_new_data_livrare: string
        p_status_plata: 'platit' | 'neplatit'
        p_suma_primita_lei: number
        p_plata_id: string
      }
    ): Promise<{
      data: DeliverAndCloneComandaPayload | null
      error: SupabaseLikeError | null
    }>
    (
      fn: 'deliver_and_clone_comanda',
      args: {
        p_comanda_id: string
        p_new_cantitate_kg: number
        p_new_data_livrare: string
      }
    ): Promise<{
      data: DeliverAndCloneComandaPayload | null
      error: SupabaseLikeError | null
    }>
  }
}

function toReadableError(error: unknown, fallbackMessage: string) {
  const e = (error ?? {}) as SupabaseLikeError
  const message = e.message || e.details || e.hint || fallbackMessage
  return Object.assign(new Error(message), {
    code: e.code,
    details: e.details,
    hint: e.hint,
  })
}

function round2(value: number): number {
  return Math.round((Number(value) || 0) * 100) / 100
}

function ensureStatus(status: string): ComandaStatus {
  const normalized = String(status || '').trim().toLowerCase()
  if (normalized === 'pregatita') {
    return 'programata'
  }
  if (!COMENZI_STATUSES.includes(normalized as ComandaStatus)) {
    return 'noua'
  }
  return normalized as ComandaStatus
}

function ensureOrderKind(orderKind: string | null | undefined): ComandaOrderKind {
  const normalized = String(orderKind || '').trim().toLowerCase()
  if (COMANDA_ORDER_KINDS.includes(normalized as ComandaOrderKind)) {
    return normalized as ComandaOrderKind
  }
  return 'manual'
}

function mapComanda(row: ComandaQueryRow): Comanda {
  return {
    id: row.id,
    tenant_id: row.tenant_id,
    client_id: row.client_id ?? null,
    client_nume_manual: row.client_nume_manual ?? null,
    telefon: row.telefon ?? null,
    locatie_livrare: row.locatie_livrare ?? null,
    data_comanda: row.data_comanda,
    data_livrare: row.data_livrare ?? null,
    cantitate_kg: Number(row.cantitate_kg ?? 0),
    pret_per_kg: Number(row.pret_per_kg ?? 0),
    total: Number(row.total ?? 0),
    order_kind: ensureOrderKind(row.order_kind),
    status: ensureStatus(row.status),
    observatii: row.observatii ?? null,
    linked_vanzare_id: row.linked_vanzare_id ?? null,
    linked_vanzare: row.vanzare
      ? {
          status_plata: row.vanzare.status_plata ?? null,
          data_incasare: row.vanzare.data_incasare ?? null,
          cantitate_kg: row.vanzare.cantitate_kg ?? null,
          pret_lei_kg: row.vanzare.pret_lei_kg ?? null,
          suma_incasata_partial_lei: row.vanzare.suma_incasata_partial_lei ?? null,
        }
      : null,
    shop_order_id: row.shop_order_link?.shop_order_id ?? null,
    parent_comanda_id: row.parent_comanda_id ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
    created_by: row.created_by ?? null,
    updated_by: row.updated_by ?? null,
    data_origin: row.data_origin ?? null,
    dup_phone_warning: row.dup_phone_warning ?? null,
    last_call_status: row.last_call_status === 'no_answer' ? 'no_answer' : null,
    prioritara: row.prioritara === true,
    client_nume: row.clienti?.nume_client ?? null,
    ordine_livrare: row.ordine_livrare ?? null,
  }
}

function getDefaultActiveStatus(dataLivrare?: string | null): ComandaStatus {
  const today = ziuaInRomania()
  return dataLivrare && dataLivrare > today ? 'programata' : 'confirmata'
}

/**
 * Produsul comenzii (`comenzi.produs_id`), din cultura ei (promptul 31): cultura aleasă în formular, altfel cultura
 * principală a fermei (din parcele). Produsul „<Cultură> proaspătă” se asigură dacă lipsește; unul existent care se
 * potrivește (ex. „Zmeură proaspătă”) rămâne cel folosit, ca înainte. Nefatal: `null` fără parcele sau la eroare.
 */
async function resolveProdusComanda(
  supabase: ReturnType<typeof getSupabase>,
  tenantId: string,
  cultura: string | null | undefined,
): Promise<string | null> {
  try {
    let text = cultura?.trim() || null
    if (!text) {
      const { data, error } = await supabase
        .from('parcele')
        .select('cultura,tip_fruct,status,status_operational')
        .eq('tenant_id', tenantId)
      if (error) return null
      text = culturaPrincipala(culturileFermei(data ?? []))?.nume ?? null
    }
    return text ? await asiguraProdusCultura(text) : null
  } catch {
    return null
  }
}

async function selectComandaRowById(
  supabase: ReturnType<typeof getSupabase>,
  id: string,
  tenantId: string,
): Promise<ComandaQueryRow> {
  const { fields } = await resolveComandaSelect()
  const { data, error } = await supabase
    .from('comenzi')
    .select(fields)
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single()

  if (error) throw toReadableError(error, 'Nu am putut încărca comanda.')
  const [row] = await completeazaStareaPlatii(supabase as unknown as StarePlataRpcClient, [
    data as unknown as ComandaQueryRow,
  ])
  return row
}

type ComenziQueryContextLike = {
  queryKey?: unknown
}

/**
 * Starea unei comenzi (`null` dacă nu mai există). O folosește vânzarea rapidă la reîncercare, ca să nu
 * rescrie o comandă deja livrată.
 */
export async function getComandaStatus(id: string): Promise<string | null> {
  const supabase = getSupabase()
  const tenantId = await getTenantId(supabase)
  const { data, error } = await supabase
    .from('comenzi')
    .select('status')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .maybeSingle()
  if (error) throw toReadableError(error, 'Nu am putut încărca comanda.')
  return data?.status ?? null
}

export async function getComenzi(): Promise<Comanda[]>
export async function getComenzi(includeAssociation: boolean): Promise<Comanda[]>
export async function getComenzi(
  includeAssociationOrContext: boolean | ComenziQueryContextLike = false,
): Promise<Comanda[]> {
  const supabase = getSupabase()
  const tenantId = await getTenantId(supabase)
  const includeAssociation =
    typeof includeAssociationOrContext === 'boolean' ? includeAssociationOrContext : false
  const { fields } = await resolveComandaSelect()
  let query = supabase
    .from('comenzi')
    .select(fields)
    .eq('tenant_id', tenantId)

  // Păstrăm comenzile legacy/manuale fără `data_origin`, dar ascundem cele venite
  // din magazinul asociației din dashboardul fermierului.
  if (!includeAssociation) {
    query = query.or('data_origin.is.null,data_origin.neq.magazin_asociatie')
  }

  const { data, error } = await query
    .order('data_livrare', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false })

  if (error) throw toReadableError(error, 'Nu am putut incarca comenzile.')
  // Operatorul nu citește `vanzari` (migrarea 20261122100000): starea plății vine atunci prin RPC.
  const rows = await completeazaStareaPlatii(
    supabase as unknown as StarePlataRpcClient,
    (data ?? []) as unknown as ComandaQueryRow[],
  )
  return rows.map(mapComanda)
}

export async function createComanda(input: CreateComandaInput): Promise<Comanda> {
  const supabase = getSupabase()
  const tenantId = await getTenantId(supabase)
  const requestedStatus = input.status ?? 'noua'
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const { fields, hasPrioritara } = await resolveComandaSelect()
  const key = await cheieDeTrimis(input.client_sync_id)
  const payload: ComandaInsertCompat = {
    ...(key ? { client_sync_id: key } : {}),
    // Coloana nouă pleacă spre server doar dacă există (altfel PostgREST respinge toată cererea).
    ...(hasPrioritara && input.prioritara !== undefined ? { prioritara: input.prioritara } : {}),
    tenant_id: tenantId,
    client_id: input.client_id ?? null,
    client_nume_manual: input.client_nume_manual?.trim() || null,
    telefon: input.telefon?.trim() || null,
    locatie_livrare: input.locatie_livrare?.trim() || null,
    data_comanda: input.data_comanda ?? ziuaInRomania(),
    data_livrare: input.data_livrare ?? null,
    cantitate_kg: round2(input.cantitate_kg),
    pret_per_kg: round2(input.pret_per_kg),
    total: round2(input.cantitate_kg * input.pret_per_kg),
    order_kind: input.order_kind ?? 'manual',
    status: requestedStatus === 'in_livrare' ? getDefaultActiveStatus(input.data_livrare ?? null) : requestedStatus,
    observatii: input.observatii?.trim() || null,
    produs_id: await resolveProdusComanda(supabase, tenantId, input.cultura),
    created_by: user?.id ?? null,
    updated_by: user?.id ?? null,
  }

  // Reîncercarea aceleiași salvări: comanda există deja (cheia de idempotență), nu se creează a doua.
  let inserted: ComandaQueryRow | null = key
    ? await findByClientSyncId<ComandaQueryRow>(supabase, 'comenzi', tenantId, key, fields)
    : null

  if (!inserted) {
    const { data, error } = await supabase
      .from('comenzi')
      .insert(payload as TablesInsert<'comenzi'>)
      .select(fields)
      .single()

    if (error && key && isClientSyncConflict(error)) {
      inserted = await findByClientSyncId<ComandaQueryRow>(supabase, 'comenzi', tenantId, key, fields)
    }
    if (!inserted) {
      if (error) throw toReadableError(error, 'Nu am putut salva comanda.')
      inserted = data as unknown as ComandaQueryRow
    }
  }

  if (requestedStatus !== 'in_livrare') {
    return mapComanda(inserted)
  }

  const rpcClient = supabase as ComenziRpcClient

  const { data: inDeliveryData, error: inDeliveryError } = await rpcClient.rpc(
    'set_comanda_in_delivery',
    {
      p_comanda_id: inserted.id,
    },
  )
  if (inDeliveryError) {
    throw toReadableError(inDeliveryError, 'Nu am putut trimite comanda în livrare.')
  }

  if (!inDeliveryData) {
    throw new Error('Nu am primit comanda actualizată de la baza de date.')
  }

  return mapComanda(inDeliveryData)
}

export async function updateComanda(id: string, input: UpdateComandaInput): Promise<Comanda> {
  const supabase = getSupabase()
  const tenantId = await getTenantId(supabase)
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const current = await selectComandaRowById(supabase, id, tenantId)
  const shouldSetInDelivery = input.status === 'in_livrare'
  const { hasPrioritara } = await resolveComandaSelect()

  const payload: ComandaUpdateCompat = {
    ...(hasPrioritara && input.prioritara !== undefined ? { prioritara: input.prioritara } : {}),
    ...(input.client_id !== undefined ? { client_id: input.client_id ?? null } : {}),
    ...(input.client_nume_manual !== undefined ? { client_nume_manual: input.client_nume_manual?.trim() || null } : {}),
    ...(input.telefon !== undefined ? { telefon: input.telefon?.trim() || null } : {}),
    ...(input.locatie_livrare !== undefined ? { locatie_livrare: input.locatie_livrare?.trim() || null } : {}),
    ...(input.data_comanda !== undefined ? { data_comanda: input.data_comanda } : {}),
    ...(input.data_livrare !== undefined ? { data_livrare: input.data_livrare ?? null } : {}),
    ...(input.cantitate_kg !== undefined ? { cantitate_kg: round2(input.cantitate_kg) } : {}),
    ...(input.pret_per_kg !== undefined ? { pret_per_kg: round2(input.pret_per_kg) } : {}),
    ...(input.order_kind !== undefined ? { order_kind: input.order_kind } : {}),
    ...(!shouldSetInDelivery && input.status !== undefined ? { status: input.status } : {}),
    ...(input.observatii !== undefined ? { observatii: input.observatii?.trim() || null } : {}),
    ...(input.last_call_status !== undefined ? { last_call_status: input.last_call_status } : {}),
    updated_at: new Date().toISOString(),
    updated_by: user?.id ?? null,
  }

  if (payload.cantitate_kg !== undefined || payload.pret_per_kg !== undefined) {
    const cantitate = round2(payload.cantitate_kg ?? Number(current.cantitate_kg ?? 0))
    const pret = round2(payload.pret_per_kg ?? Number(current.pret_per_kg ?? 0))
    payload.total = round2(cantitate * pret)
  }

  const hasNonTransitionUpdate =
    Object.keys(payload).some((key) => key !== 'updated_at' && key !== 'updated_by')

  if (hasNonTransitionUpdate) {
    const { error } = await supabase
      .from('comenzi')
      .update(payload as TablesUpdate<'comenzi'>)
      .eq('id', id)
      .eq('tenant_id', tenantId)

    if (error) throw toReadableError(error, 'Nu am putut actualiza comanda.')
  }

  const rpcClient = supabase as ComenziRpcClient

  if (shouldSetInDelivery) {
    const { data, error } = await rpcClient.rpc('set_comanda_in_delivery', {
      p_comanda_id: id,
    })

    if (error) {
      throw toReadableError(error, 'Nu am putut trimite comanda în livrare.')
    }

    if (!data) {
      throw new Error('Nu am primit comanda actualizată de la baza de date.')
    }

    return mapComanda(data)
  }

  if (!hasNonTransitionUpdate) {
    return mapComanda(current)
  }

  return mapComanda(await selectComandaRowById(supabase, id, tenantId))
}

/**
 * Salvează ordinea manuală de livrare (drag-and-drop din /livrari) în DB,
 * ca să fie vizibilă pentru orice utilizator al tenantului, pe orice dispozitiv.
 * `orderedIds` este lista completă de id-uri de comenzi, în ordinea dorită.
 */
export async function updateOrdineLivrare(orderedIds: string[]): Promise<void> {
  const supabase = getSupabase()
  const tenantId = await getTenantId(supabase)

  const results = await Promise.all(
    orderedIds.map((id, index) =>
      supabase
        .from('comenzi')
        .update({ ordine_livrare: index } as TablesUpdate<'comenzi'>)
        .eq('id', id)
        .eq('tenant_id', tenantId),
    ),
  )

  const firstError = results.find((result) => result.error)?.error
  if (firstError) throw toReadableError(firstError, 'Nu am putut salva ordinea livrărilor.')
}

export async function deleteComanda(id: string): Promise<void> {
  /*
  SQL reference for the atomic delete path lives in:
  supabase/migrations/20260313_atomic_order_operations.sql

  create or replace function public.delete_comanda_atomic(
    p_comanda_id uuid,
    p_tenant_id uuid
  ) returns void;
  */
  const supabase = getSupabase()
  const tenantId = await getTenantId(supabase)
  const rpcClient = supabase as ComenziRpcClient
  const { error } = await rpcClient.rpc('delete_comanda_atomic', {
    p_comanda_id: id,
    p_tenant_id: tenantId,
  })

  if (error) throw toReadableError(error, 'Nu am putut sterge comanda.')
}

export async function deliverComanda(input: DeliverComandaInput): Promise<{
  deliveredOrder: Comanda
  vanzare: Vanzare
  remainingOrder: Comanda | null
  deductedStockKg: number
}> {
  const deliveredQty = round2(input.cantitateLivrataKg)

  if (!Number.isFinite(deliveredQty) || deliveredQty <= 0) {
    throw new Error('Cantitatea livrata trebuie sa fie mai mare decat 0.')
  }

  const rpcClient = getSupabase() as ComenziRpcClient
  const { data, error } = await rpcClient.rpc('set_comanda_delivered', {
    p_comanda_id: input.comandaId,
    p_delivered_qty: deliveredQty,
    p_status_plata: input.statusPlata,
  })

  if (error) {
    throw toReadableError(error, 'Nu am putut finaliza livrarea comenzii.')
  }

  if (!data?.delivered_order || !data.vanzare) {
    throw new Error('Livrarea nu a putut fi finalizata complet.')
  }

  return {
    deliveredOrder: mapComanda(data.delivered_order as ComandaQueryRow),
    vanzare: data.vanzare,
    remainingOrder: data.remaining_order ? mapComanda(data.remaining_order as ComandaQueryRow) : null,
    deductedStockKg: round2(Number(data.deducted_stock_kg ?? 0)),
  }
}

export interface DeliverAndCloneComandaInput {
  comandaId: string
  newCantitateKg: number
  newDataLivrare: string
  /**
   * Plata comenzii livrate, ca la livrarea obișnuită. Lipsă sau `platit`: încasat tot (drumul vechi,
   * `deliver_and_clone_comanda`). `neplatit` (cu sau fără avans): `livreaza_si_copiaza_comanda`.
   */
  plata?: {
    statusPlata: 'platit' | 'neplatit'
    /** Avansul primit (0 = nimic). */
    sumaPrimitaLei: number
    /** Cheia plății: aceeași la reîncercare. */
    plataId: string
  }
}

/**
 * Livrează integral o comandă `in_livrare` ȘI creează o clonă `programata`
 * pentru livrarea următoare, atomic. Încasat tot: RPC `deliver_and_clone_comanda`;
 * avans sau neîncasat: RPC `livreaza_si_copiaza_comanda` (migrarea 20261121130000).
 */
export async function deliverAndCloneComanda(input: DeliverAndCloneComandaInput): Promise<{
  deliveredOrder: Comanda
  newOrder: Comanda
}> {
  const newCantitateKg = round2(input.newCantitateKg)

  if (!Number.isFinite(newCantitateKg) || newCantitateKg <= 0) {
    throw new Error('Cantitatea comenzii noi trebuie sa fie mai mare decat 0.')
  }
  if (!input.newDataLivrare) {
    throw new Error('Data de livrare a comenzii noi este obligatorie.')
  }

  const rpcClient = getSupabase() as ComenziRpcClient
  const plata = input.plata
  const { data, error } =
    plata && plata.statusPlata === 'neplatit'
      ? await rpcClient.rpc('livreaza_si_copiaza_comanda', {
          p_comanda_id: input.comandaId,
          p_new_cantitate_kg: newCantitateKg,
          p_new_data_livrare: input.newDataLivrare,
          p_status_plata: 'neplatit',
          p_suma_primita_lei: round2(Math.max(0, plata.sumaPrimitaLei)),
          p_plata_id: plata.plataId,
        })
      : await rpcClient.rpc('deliver_and_clone_comanda', {
          p_comanda_id: input.comandaId,
          p_new_cantitate_kg: newCantitateKg,
          p_new_data_livrare: input.newDataLivrare,
        })

  if (error?.code === 'PGRST202' || error?.code === '42883') {
    throw new Error(
      'Avansul și „Nu a plătit” la „Livrează și copiază” se activează după actualizarea bazei de date. Până atunci alege Cash sau Transfer cu toată suma.',
    )
  }

  if (error) {
    throw toReadableError(error, 'Nu am putut livra si clona comanda.')
  }

  if (!data?.delivered_order || !data.new_order) {
    throw new Error('Livrarea si clonarea nu au putut fi finalizate complet.')
  }

  return {
    deliveredOrder: mapComanda(data.delivered_order as ComandaQueryRow),
    newOrder: mapComanda(data.new_order as ComandaQueryRow),
  }
}

export async function deliverShopOrderPartial(
  input: DeliverShopOrderPartialInput
): Promise<{
  shopOrderId: string
  deliveredKg: number
  remainingOrder: Comanda | null
}> {
  const rpcClient = getSupabase() as ComenziRpcClient
  const deliveredKg = round2(input.deliveredKg)
  const { data, error } = await rpcClient.rpc(
    'set_shop_order_delivered',
    {
      p_shop_order_id: input.shopOrderId,
      p_delivered_qty: deliveredKg,
      p_status_plata: input.statusPlata ?? 'platit',
    }
  )
  if (error) throw toReadableError(error, 'Nu am putut finaliza livrarea parțială.')
  const delivery = data?.delivery ?? null
  return {
    shopOrderId: input.shopOrderId,
    deliveredKg,
    remainingOrder: delivery?.remaining_order
      ? mapComanda(delivery.remaining_order as ComandaQueryRow)
      : null,
  }
}

export async function markComandaIncasata(comandaId: string): Promise<Vanzare> {
  const rpcClient = getSupabase() as ComenziRpcClient
  const { data, error } = await rpcClient.rpc('mark_comanda_incasata', {
    p_comanda_id: comandaId,
  })

  if (error) {
    throw toReadableError(error, 'Nu am putut marca plata ca încasată.')
  }

  if (!data) {
    throw new Error('Nu am primit vânzarea actualizată de la baza de date.')
  }

  return data
}

export async function reopenComanda(id: string): Promise<Comanda> {
  /*
  SQL reference for the atomic reopen path lives in:
  supabase/migrations/20260313_atomic_order_operations.sql

  create or replace function public.reopen_comanda_atomic(
    p_comanda_id uuid,
    p_tenant_id uuid
  ) returns public.comenzi;
  */
  const supabase = getSupabase()
  const tenantId = await getTenantId(supabase)
  const rpcClient = supabase as ComenziRpcClient
  const { data, error } = await rpcClient.rpc('reopen_comanda_atomic', {
    p_comanda_id: id,
    p_tenant_id: tenantId,
  })

  if (error) throw toReadableError(error, 'Nu am putut redeschide comanda.')
  if (!data) {
    throw new Error('Nu am primit comanda redeschisa de la baza de date.')
  }
  return mapComanda(data as ComandaQueryRow)
}

export async function getComenziStockSummaryAzi(): Promise<{
  totalStocDisponibilKg: number
  totalStocCal1Kg: number
  rezervatActivKg: number
  legacyInLivrareKg: number
}> {
  const summary = await getSellableCal1StockSummary()
  return {
    totalStocDisponibilKg: summary.disponibilCal1Kg,
    totalStocCal1Kg: summary.stocCal1LedgerKg,
    rezervatActivKg: summary.rezervatActivCal1Kg,
    legacyInLivrareKg: summary.legacyInLivrareFaraRezervareKg,
  }
}
