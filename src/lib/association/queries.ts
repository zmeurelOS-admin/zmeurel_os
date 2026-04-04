import { createClient } from '@/lib/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import type { Database } from '@/types/supabase'

type ProduseRow = Database['public']['Tables']['produse']['Row']
type TenantRow = Pick<
  Database['public']['Tables']['tenants']['Row'],
  'nume_ferma' | 'is_association_approved'
>

export type AssociationProduct = ProduseRow & {
  farmName: string | null
  /** Din tenants embed — dacă e false, vitrina asociației nu publică ferma. */
  tenantIsAssociationApproved: boolean
}

export type AssociationOrderRow = Pick<
  Database['public']['Tables']['comenzi']['Row'],
  | 'id'
  | 'status'
  | 'data_comanda'
  | 'data_livrare'
  | 'telefon'
  | 'locatie_livrare'
  | 'client_nume_manual'
  | 'client_id'
  | 'produs_id'
  | 'total'
  | 'cantitate_kg'
  | 'pret_per_kg'
  | 'tenant_id'
  | 'observatii'
  | 'created_at'
  | 'updated_at'
  | 'linked_vanzare_id'
  | 'data_origin'
>

export type AssociationOrder = AssociationOrderRow & {
  clientName: string | null
  localitate: string | null
  farmName: string | null
  produs: Pick<ProduseRow, 'id' | 'nume' | 'pret_unitar'> | null
}

export type AssociationProducerRole = 'admin' | 'moderator' | 'viewer'

/** În ERP asociație, lista de producători include doar tenants cu `is_association_approved = true` (întotdeauna true aici). */
export type AssociationProducer = {
  id: string
  nume_ferma: string
  is_association_approved: boolean | null
  descriere_publica: string | null
  localitate: string | null
  poze_ferma: string[]
  specialitate: string | null
  activeProductCount: number
  listedProductCount: number
  ownerUserId: string | null
  ownerEmail: string | null
  associationRole: AssociationProducerRole | null
  associationMemberId: string | null
}

/** Payload pentru panoul ERP asociație (`AssociationDashboardClient`). */
export type AssociationRecentOrderRow = {
  id: string
  client_name: string
  product_name: string
  amount: number
  status: string
  date: string
}

export type AssociationDashboardPageStats = {
  ordersToday: { count: number; total: number }
  ordersWeek: { count: number; total: number; trendPercent: number | null }
  ordersMonth: { count: number; total: number }
  productsListed: number
  productsTotal: number
  producersActive: number
  recentOrders: AssociationRecentOrderRow[]
  pendingProducts: number
  /** Comenzi cu `status = noua` (badge pe acțiunea rapidă). */
  newOrdersCount: number
  /** Oferte produs cu status „trimisă” (în așteptare). */
  pendingOffersCount: number
}

export type AssociationOfferWorkspaceRow = {
  id: string
  product_id: string
  tenant_id: string
  offered_by: string
  status: string
  suggested_price: number | null
  message: string | null
  review_note: string | null
  reviewed_at: string | null
  created_at: string
  produse: {
    id: string
    nume: string
    categorie: string
    pret_unitar: number | null
    unitate_vanzare: string
    moneda: string
    status: string
  } | null
  tenants: { id: string; nume_ferma: string | null } | null
}

/** @deprecated Folosește `AssociationDashboardPageStats` + `getAssociationDashboardPageData`. */
export type AssociationDashboardStats = {
  ordersToday: { count: number; totalLei: number }
  ordersThisWeek: { count: number; totalLei: number }
  ordersThisMonth: { count: number; totalLei: number }
  totalListedProducts: number
  activeProducersCount: number
  topProducts: Array<{ produsId: string; nume: string; orderCount: number }>
}

const MAGAZIN_ASOCIATIE = 'magazin_asociatie'

async function bucharestToday(supabase: Awaited<ReturnType<typeof createClient>>): Promise<string> {
  const { data, error } = await supabase.rpc('bucharest_today')
  if (error || !data) {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Bucharest' })
  }
  return data
}

/** Luni = 0 … Duminică = 6, în Europe/Bucharest (fără offset fix DST). */
function weekdayMon0Bucharest(ymd: string): number {
  const d = new Date(`${ymd}T12:00:00.000Z`)
  const w = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Bucharest',
    weekday: 'short',
  })
    .formatToParts(d)
    .find((p) => p.type === 'weekday')?.value
  const map: Record<string, number> = {
    Mon: 0,
    Tue: 1,
    Wed: 2,
    Thu: 3,
    Fri: 4,
    Sat: 5,
    Sun: 6,
  }
  return map[w ?? 'Mon'] ?? 0
}

function addDaysYmd(ymd: string, delta: number): string {
  const [y, m, day] = ymd.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, day, 12, 0, 0))
  dt.setUTCDate(dt.getUTCDate() + delta)
  const yy = dt.getUTCFullYear()
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(dt.getUTCDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

function startOfCalendarWeekMonday(ymd: string): string {
  return addDaysYmd(ymd, -weekdayMon0Bucharest(ymd))
}

function startOfMonth(ymd: string): string {
  const [y, m] = ymd.split('-')
  return `${y}-${m}-01`
}

async function approvedTenantIds(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<string[]> {
  const { data, error } = await supabase
    .from('tenants')
    .select('id')
    .eq('is_association_approved', true)

  if (error || !data?.length) {
    return []
  }
  return data.map((t) => t.id)
}

export async function getAssociationProducts(): Promise<AssociationProduct[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('produse')
    .select(
      `
      *,
      tenants!inner (
        nume_ferma,
        is_association_approved
      )
    `
    )
    .order('association_listed', { ascending: false })
    .order('created_at', { ascending: false })

  if (error || !data) {
    return []
  }

  return data.map((row) => {
    const embed = row.tenants as TenantRow | TenantRow[] | null
    const tenant = Array.isArray(embed) ? embed[0] : embed
    const { tenants: _relation, ...rest } = row as ProduseRow & {
      tenants?: TenantRow | TenantRow[] | null
    }
    void _relation
    return {
      ...(rest as ProduseRow),
      farmName: tenant?.nume_ferma ?? null,
      tenantIsAssociationApproved: tenant?.is_association_approved ?? false,
    }
  })
}

export async function getAssociationOrders(): Promise<AssociationOrder[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('comenzi')
    .select(
      `
      id,
      status,
      data_comanda,
      data_livrare,
      telefon,
      locatie_livrare,
      client_nume_manual,
      client_id,
      produs_id,
      total,
      cantitate_kg,
      pret_per_kg,
      tenant_id,
      observatii,
      created_at,
      updated_at,
      linked_vanzare_id,
      data_origin,
      produse ( id, nume, pret_unitar ),
      clienti ( nume_client, telefon, adresa ),
      tenants ( nume_ferma )
    `
    )
    .eq('data_origin', MAGAZIN_ASOCIATIE)
    .order('data_comanda', { ascending: false })

  if (error || !data) {
    return []
  }

  return data.map((raw) => {
    const r = raw as unknown as AssociationOrderRow & {
      produse: Pick<ProduseRow, 'id' | 'nume' | 'pret_unitar'> | null
      clienti: {
        nume_client: string
        telefon: string | null
        adresa: string | null
      } | null
      tenants: { nume_ferma: string } | { nume_ferma: string }[] | null
    }
    const prodEmbed = r.produse
    const produs = Array.isArray(prodEmbed) ? prodEmbed[0] ?? null : prodEmbed
    const cliEmbed = r.clienti
    const cli = Array.isArray(cliEmbed) ? cliEmbed[0] ?? null : cliEmbed
    const tnEmbed = r.tenants
    const tnt = Array.isArray(tnEmbed) ? tnEmbed[0] ?? null : tnEmbed

    const clientName = cli?.nume_client ?? r.client_nume_manual ?? null
    const phone = r.telefon ?? cli?.telefon ?? null
    const localitate = r.locatie_livrare ?? cli?.adresa ?? null

    return {
      id: r.id,
      status: r.status,
      data_comanda: r.data_comanda,
      data_livrare: r.data_livrare,
      telefon: phone,
      locatie_livrare: r.locatie_livrare,
      client_nume_manual: r.client_nume_manual,
      client_id: r.client_id,
      produs_id: r.produs_id,
      total: r.total,
      cantitate_kg: r.cantitate_kg,
      pret_per_kg: r.pret_per_kg,
      tenant_id: r.tenant_id,
      observatii: r.observatii,
      created_at: r.created_at,
      updated_at: r.updated_at,
      linked_vanzare_id: r.linked_vanzare_id,
      data_origin: r.data_origin,
      clientName,
      localitate,
      farmName: tnt?.nume_ferma ?? null,
      produs: produs ?? null,
    }
  })
}

function parseAssociationProducerRole(
  raw: string | null | undefined
): AssociationProducerRole | null {
  if (raw === 'admin' || raw === 'moderator' || raw === 'viewer') return raw
  return null
}

export async function getAssociationProducers(): Promise<AssociationProducer[]> {
  const supabase = await createClient()

  const { data: tenants, error: tErr } = await supabase
    .from('tenants')
    .select(
      'id, nume_ferma, owner_user_id, is_association_approved, descriere_publica, localitate, poze_ferma, specialitate'
    )
    .eq('is_association_approved', true)
    .order('nume_ferma', { ascending: true })

  if (tErr || !tenants?.length) {
    return []
  }

  const ids = tenants.map((t) => t.id)
  const { data: counts, error: cErr } = await supabase
    .from('produse')
    .select('tenant_id, status, association_listed')
    .in('tenant_id', ids)

  const ownerIds = [
    ...new Set(
      tenants.map((t) => t.owner_user_id).filter((x): x is string => typeof x === 'string' && x.length > 0)
    ),
  ]

  const emailByUserId = new Map<string, string>()
  const memberByUserId = new Map<string, { id: string; role: AssociationProducerRole }>()

  if (ownerIds.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin = getSupabaseAdmin() as any

    const { data: membersRows, error: membersErr } = await admin
      .from('association_members')
      .select('id, user_id, role')
      .in('user_id', ownerIds)

    if (!membersErr && membersRows) {
      for (const row of membersRows as Array<{ id: string; user_id: string; role: string }>) {
        const role = parseAssociationProducerRole(row.role)
        if (role) {
          memberByUserId.set(row.user_id, { id: row.id, role })
        }
      }
    }

    await Promise.all(
      ownerIds.map(async (uid) => {
        const { data } = await admin.auth.admin.getUserById(uid)
        const email = data.user?.email
        if (email) emailByUserId.set(uid, email)
      })
    )
  }

  if (cErr || !counts) {
    return tenants.map((t) => {
      const uid = t.owner_user_id
      const mem = uid ? memberByUserId.get(uid) : undefined
      return {
        id: t.id,
        nume_ferma: t.nume_ferma ?? '',
        is_association_approved: t.is_association_approved,
        descriere_publica: t.descriere_publica ?? null,
        localitate: t.localitate ?? 'Suceava',
        poze_ferma: Array.isArray(t.poze_ferma) ? t.poze_ferma.filter((url) => typeof url === 'string') : [],
        specialitate: t.specialitate ?? null,
        activeProductCount: 0,
        listedProductCount: 0,
        ownerUserId: uid ?? null,
        ownerEmail: uid ? emailByUserId.get(uid) ?? null : null,
        associationRole: mem?.role ?? null,
        associationMemberId: mem?.id ?? null,
      }
    })
  }

  const byTenant = new Map<string, { active: number; listed: number }>()
  for (const tid of ids) {
    byTenant.set(tid, { active: 0, listed: 0 })
  }
  for (const p of counts) {
    const cur = byTenant.get(p.tenant_id)
    if (!cur) continue
    if (p.status === 'activ') {
      cur.active += 1
      if (p.association_listed) {
        cur.listed += 1
      }
    }
  }

  return tenants.map((t) => {
    const c = byTenant.get(t.id) ?? { active: 0, listed: 0 }
    const uid = t.owner_user_id
    const mem = uid ? memberByUserId.get(uid) : undefined
    return {
      id: t.id,
      nume_ferma: t.nume_ferma ?? '',
      is_association_approved: t.is_association_approved,
      descriere_publica: t.descriere_publica ?? null,
      localitate: t.localitate ?? 'Suceava',
      poze_ferma: Array.isArray(t.poze_ferma) ? t.poze_ferma.filter((url) => typeof url === 'string') : [],
      specialitate: t.specialitate ?? null,
      activeProductCount: c.active,
      listedProductCount: c.listed,
      ownerUserId: uid ?? null,
      ownerEmail: uid ? emailByUserId.get(uid) ?? null : null,
      associationRole: mem?.role ?? null,
      associationMemberId: mem?.id ?? null,
    }
  })
}

function aggregateAssociationOrderBuckets(
  rows: Array<{ data_comanda: string; total: number; produs_id: string | null }>,
  todayStr: string,
  weekStart: string,
  monthStart: string
): {
  today: { count: number; total: number }
  week: { count: number; total: number }
  prevWeek: { count: number; total: number }
  month: { count: number; total: number }
  topCounts: Map<string, number>
} {
  const prevWeekStart = addDaysYmd(weekStart, -7)
  const prevWeekEnd = addDaysYmd(weekStart, -1)
  const today = { count: 0, total: 0 }
  const week = { count: 0, total: 0 }
  const prevWeek = { count: 0, total: 0 }
  const month = { count: 0, total: 0 }
  const topCounts = new Map<string, number>()

  for (const r of rows) {
    const d = r.data_comanda
    const total = Number(r.total) || 0
    if (d === todayStr) {
      today.count += 1
      today.total += total
    }
    if (d >= weekStart && d <= todayStr) {
      week.count += 1
      week.total += total
    }
    if (d >= prevWeekStart && d <= prevWeekEnd) {
      prevWeek.count += 1
      prevWeek.total += total
    }
    if (d >= monthStart && d <= todayStr) {
      month.count += 1
      month.total += total
    }
    if (r.produs_id) {
      topCounts.set(r.produs_id, (topCounts.get(r.produs_id) ?? 0) + 1)
    }
  }

  return { today, week, prevWeek, month, topCounts }
}

function weekTrendPercent(week: { count: number }, prevWeek: { count: number }): number | null {
  if (prevWeek.count === 0) {
    return week.count === 0 ? null : 100
  }
  return Math.round(((week.count - prevWeek.count) / prevWeek.count) * 100)
}

export async function getAssociationDashboardPageData(): Promise<AssociationDashboardPageStats> {
  const supabase = await createClient()
  const todayStr = await bucharestToday(supabase)
  const weekStart = startOfCalendarWeekMonday(todayStr)
  const monthStart = startOfMonth(todayStr)
  const prevWeekStart = addDaysYmd(weekStart, -7)
  const fetchFrom = [prevWeekStart, monthStart].sort()[0]!

  const { data: orderRows, error: oErr } = await supabase
    .from('comenzi')
    .select('data_comanda, total, produs_id')
    .eq('data_origin', MAGAZIN_ASOCIATIE)
    .gte('data_comanda', fetchFrom)
    .lte('data_comanda', todayStr)

  const orders = oErr || !orderRows ? [] : orderRows
  const { today, week, prevWeek, month } = aggregateAssociationOrderBuckets(
    orders,
    todayStr,
    weekStart,
    monthStart
  )
  const trendPercent = weekTrendPercent(week, prevWeek)

  const { count: productsListed } = await supabase
    .from('produse')
    .select('id, tenants!inner(is_association_approved)', { count: 'exact', head: true })
    .eq('status', 'activ')
    .eq('tenants.is_association_approved', true)
    .eq('association_listed', true)

  const { count: productsTotal } = await supabase
    .from('produse')
    .select('id, tenants!inner(is_association_approved)', { count: 'exact', head: true })
    .eq('status', 'activ')
    .eq('tenants.is_association_approved', true)

  const { count: pendingProducts } = await supabase
    .from('produse')
    .select('id, tenants!inner(is_association_approved)', { count: 'exact', head: true })
    .eq('status', 'activ')
    .eq('tenants.is_association_approved', true)
    .eq('association_listed', false)

  const tenantIds = await approvedTenantIds(supabase)
  let producersActive = 0
  if (tenantIds.length > 0) {
    const { data: listedByTenant, error: ltErr } = await supabase
      .from('produse')
      .select('tenant_id')
      .eq('association_listed', true)
      .eq('status', 'activ')
      .in('tenant_id', tenantIds)

    if (!ltErr && listedByTenant?.length) {
      producersActive = new Set(listedByTenant.map((r) => r.tenant_id)).size
    }
  }

  const { count: newOrdersCount } = await supabase
    .from('comenzi')
    .select('id', { count: 'exact', head: true })
    .eq('data_origin', MAGAZIN_ASOCIATIE)
    .eq('status', 'noua')

  const { data: recentRaw, error: rErr } = await supabase
    .from('comenzi')
    .select(
      `
      id,
      status,
      data_comanda,
      total,
      client_nume_manual,
      produse ( nume ),
      clienti ( nume_client )
    `
    )
    .eq('data_origin', MAGAZIN_ASOCIATIE)
    .order('data_comanda', { ascending: false })
    .limit(5)

  const recentOrders: AssociationRecentOrderRow[] = []
  if (!rErr && recentRaw) {
    for (const raw of recentRaw) {
      const r = raw as {
        id: string
        status: string
        data_comanda: string
        total: number
        client_nume_manual: string | null
        produse: { nume: string } | { nume: string }[] | null
        clienti: { nume_client: string } | { nume_client: string }[] | null
      }
      const p = r.produse
      const prodName = Array.isArray(p) ? p[0]?.nume : p?.nume
      const c = r.clienti
      const cliName = Array.isArray(c) ? c[0]?.nume_client : c?.nume_client
      recentOrders.push({
        id: r.id,
        client_name: cliName ?? r.client_nume_manual ?? '—',
        product_name: prodName ?? '—',
        amount: Number(r.total) || 0,
        status: r.status,
        date: r.data_comanda,
      })
    }
  }

  const { count: pendingOffersCount } = await supabase
    .from('association_product_offers')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'trimisa')

  return {
    ordersToday: { count: today.count, total: today.total },
    ordersWeek: { count: week.count, total: week.total, trendPercent },
    ordersMonth: { count: month.count, total: month.total },
    productsListed: productsListed ?? 0,
    productsTotal: productsTotal ?? 0,
    producersActive,
    recentOrders,
    pendingProducts: pendingProducts ?? 0,
    newOrdersCount: newOrdersCount ?? 0,
    pendingOffersCount: pendingOffersCount ?? 0,
  }
}

export async function listAssociationOffersForWorkspace(): Promise<AssociationOfferWorkspaceRow[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('association_product_offers')
    .select(
      `
      id,
      product_id,
      tenant_id,
      offered_by,
      status,
      suggested_price,
      message,
      review_note,
      reviewed_at,
      created_at,
      produse ( id, nume, categorie, pret_unitar, unitate_vanzare, moneda, status ),
      tenants ( id, nume_ferma )
    `
    )
    .order('created_at', { ascending: false })

  if (error) throw error

  return (data ?? []) as unknown as AssociationOfferWorkspaceRow[]
}

/** @deprecated Prefer `getAssociationDashboardPageData`. */
export async function getAssociationDashboardStats(): Promise<AssociationDashboardStats> {
  const s = await getAssociationDashboardPageData()
  return {
    ordersToday: { count: s.ordersToday.count, totalLei: s.ordersToday.total },
    ordersThisWeek: { count: s.ordersWeek.count, totalLei: s.ordersWeek.total },
    ordersThisMonth: { count: s.ordersMonth.count, totalLei: s.ordersMonth.total },
    totalListedProducts: s.productsListed,
    activeProducersCount: s.producersActive,
    topProducts: [],
  }
}
