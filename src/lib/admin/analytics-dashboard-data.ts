import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '@/types/supabase'

export type AnalyticsPeriod = '7d' | '30d' | '90d'
export type DemoSegment = 'all' | 'exclude_demo' | 'demo_only'
export type AiRange = '7d' | '30d'

export interface AnalyticsDashboardParams {
  period: AnalyticsPeriod
  demo: DemoSegment
  aiRange: AiRange
  aiFlow: string | null
  aiDecisionMode: string | null
}

function periodDays(p: AnalyticsPeriod): number {
  if (p === '7d') return 7
  if (p === '30d') return 30
  return 90
}

export function getPeriodBounds(period: AnalyticsPeriod): {
  currentStart: string
  currentEnd: string
  prevStart: string
  prevEnd: string
} {
  const days = periodDays(period)
  const currentEnd = new Date()
  currentEnd.setHours(23, 59, 59, 999)
  const currentStart = new Date(currentEnd)
  currentStart.setDate(currentStart.getDate() - days + 1)
  currentStart.setHours(0, 0, 0, 0)
  const prevEnd = new Date(currentStart)
  prevEnd.setMilliseconds(prevEnd.getMilliseconds() - 1)
  const prevStart = new Date(prevEnd)
  prevStart.setDate(prevStart.getDate() - days + 1)
  prevStart.setHours(0, 0, 0, 0)
  return {
    currentStart: currentStart.toISOString(),
    currentEnd: currentEnd.toISOString(),
    prevStart: prevStart.toISOString(),
    prevEnd: prevEnd.toISOString(),
  }
}

export function eventsLookbackIso(maxDays: number): string {
  const d = new Date()
  d.setDate(d.getDate() - maxDays)
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

type AdminClient = SupabaseClient<Database>

export type TenantLite = {
  id: string
  is_demo: boolean | null
  created_at: string | null
  nume_ferma: string | null
  exclude_from_analytics: boolean
}

export type RawAnalyticsEvent = {
  user_id: string | null
  tenant_id: string | null
  module: string | null
  event_name: string | null
  status: string | null
  created_at: string
  event_data: Record<string, unknown> | null
  page_url: string | null
}

function ratio(n: number, d: number): number {
  if (d <= 0) return 0
  return n / d
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size))
  }
  return out
}

async function countProfilesInRange(
  admin: AdminClient,
  start: string,
  end: string
): Promise<number> {
  const { count, error } = await admin
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('exclude_from_analytics', false)
    .gte('created_at', start)
    .lte('created_at', end)
  if (error) return 0
  return count ?? 0
}

async function countTenantsInRange(
  admin: AdminClient,
  start: string,
  end: string,
  demo: DemoSegment
): Promise<number> {
  const base = admin
    .from('tenants')
    .select('id', { count: 'exact', head: true })
    .eq('exclude_from_analytics', false)
    .gte('created_at', start)
    .lte('created_at', end)
  const q =
    demo === 'exclude_demo'
      ? base.eq('is_demo', false)
      : demo === 'demo_only'
        ? base.eq('is_demo', true)
        : base
  const { count } = await q
  return count ?? 0
}

async function listTenantIdsInRange(
  admin: AdminClient,
  start: string,
  end: string,
  demo: DemoSegment
): Promise<string[]> {
  const base = admin
    .from('tenants')
    .select('id')
    .eq('exclude_from_analytics', false)
    .gte('created_at', start)
    .lte('created_at', end)
  const q =
    demo === 'exclude_demo'
      ? base.eq('is_demo', false)
      : demo === 'demo_only'
        ? base.eq('is_demo', true)
        : base
  const { data, error } = await q
  if (error || !data) return []
  return data.map((r) => r.id)
}

async function countDistinctTenantsWithParcele(
  admin: AdminClient,
  tenantIds: string[]
): Promise<number> {
  if (tenantIds.length === 0) return 0
  const ids = new Set<string>()
  for (const part of chunk(tenantIds, 120)) {
    const { data, error } = await admin.from('parcele').select('tenant_id').in('tenant_id', part)
    if (error || !data) continue
    for (const row of data) {
      if (row.tenant_id) ids.add(row.tenant_id)
    }
  }
  return ids.size
}

async function countDistinctTenantsWithParceleCreatedInRange(
  admin: AdminClient,
  tenantIds: string[],
  start: string,
  end: string
): Promise<number> {
  if (tenantIds.length === 0) return 0
  const ids = new Set<string>()
  for (const part of chunk(tenantIds, 120)) {
    const { data, error } = await admin
      .from('parcele')
      .select('tenant_id')
      .in('tenant_id', part)
      .gte('created_at', start)
      .lte('created_at', end)
    if (error || !data) continue
    for (const row of data) {
      if (row.tenant_id) ids.add(row.tenant_id)
    }
  }
  return ids.size
}

async function countDistinctTenantsWithOperations(admin: AdminClient, tenantIds: string[]): Promise<number> {
  if (tenantIds.length === 0) return 0
  const ids = new Set<string>()
  for (const part of chunk(tenantIds, 80)) {
    const [r1, r2, r3] = await Promise.all([
      admin.from('recoltari').select('tenant_id').in('tenant_id', part),
      admin.from('vanzari').select('tenant_id').in('tenant_id', part),
      admin.from('activitati_agricole').select('tenant_id').in('tenant_id', part),
    ])
    for (const row of r1.data ?? []) if (row.tenant_id) ids.add(row.tenant_id)
    for (const row of r2.data ?? []) if (row.tenant_id) ids.add(row.tenant_id)
    for (const row of r3.data ?? []) if (row.tenant_id) ids.add(row.tenant_id)
  }
  return ids.size
}

async function avgDaysToFirstParcel(
  admin: AdminClient,
  tenantIds: string[]
): Promise<number | null> {
  if (tenantIds.length === 0) return null
  if (tenantIds.length > 800) return null
  const firstParcel = new Map<string, string>()
  for (const part of chunk(tenantIds, 120)) {
    const { data } = await admin.from('parcele').select('tenant_id, created_at').in('tenant_id', part)
    for (const row of data ?? []) {
      const tid = row.tenant_id
      const ca = row.created_at
      if (!tid || !ca) continue
      const prev = firstParcel.get(tid)
      if (!prev || ca < prev) firstParcel.set(tid, ca)
    }
  }
  const { data: tenants } = await admin.from('tenants').select('id, created_at').in('id', tenantIds)
  const byId = new Map((tenants ?? []).map((t) => [t.id, t.created_at]))
  const deltas: number[] = []
  for (const [tid, pCa] of firstParcel) {
    const tCa = byId.get(tid)
    if (!tCa) continue
    const d = (new Date(pCa).getTime() - new Date(tCa).getTime()) / 86_400_000
    if (Number.isFinite(d) && d >= 0 && d < 3650) deltas.push(d)
  }
  if (deltas.length === 0) return null
  return deltas.reduce((a, b) => a + b, 0) / deltas.length
}

const MODULE_ROUTE_ALIASES: Record<string, string> = {
  'activitati-agricole': 'activitati',
  'vanzari-butasi': 'vanzari',
}

function routeToModuleName(path: string | null): string | null {
  if (!path) return null
  const segment = path.split('/').filter(Boolean)[0]
  if (!segment) return null
  return MODULE_ROUTE_ALIASES[segment] ?? segment
}

function tenantAllowed(tenantId: string | null, demo: DemoSegment, demoMap: Map<string, boolean>): boolean {
  if (!tenantId) return false
  if (demo === 'all') return true
  const isDemo = demoMap.get(tenantId) ?? false
  if (demo === 'exclude_demo') return !isDemo
  return isDemo
}

/** Include în dashboard admin: respectă filtrul demo + exclude conturi/ferme de test (E2E etc.). */
function tenantInDashboardAnalytics(
  tenantId: string | null,
  demo: DemoSegment,
  demoMap: Map<string, boolean>,
  excludeMap: Map<string, boolean>
): boolean {
  if (!tenantId) return false
  if (excludeMap.get(tenantId)) return false
  return tenantAllowed(tenantId, demo, demoMap)
}

export interface FunnelStep {
  key: string
  label: string
  count: number
  pctOfFirst: number
  pctOfPrev: number | null
  note?: string
}

export interface ExecutiveKpi {
  key: string
  label: string
  value: string | number
  valueSuffix?: string
  subtitle?: string
  trend?: 'up' | 'down' | 'neutral'
  trendLabel?: string
  help: string
  state: 'ok' | 'approx' | 'unavailable'
}

export interface ModuleUsageRow {
  module: string
  views: number
  viewUsers: number
  actions: number
  actionUsers: number
  viewToAction: number | null
  coverage: 'good' | 'partial' | 'none'
}

export interface InsightItem {
  severity: 'critical' | 'warning' | 'info'
  title: string
  detail: string
  metric?: string
}

export interface LoadAnalyticsDashboardResult {
  bounds: ReturnType<typeof getPeriodBounds>
  period: AnalyticsPeriod
  demo: DemoSegment
  metricsError: string | null
  tenantMetricsRows: Array<{
    date: string
    total_tenants: number
    total_parcele: number
    total_recoltari: number
    total_vanzari: number
    total_kg_cal1: number
    total_kg_cal2: number
    total_revenue_lei: number
  }>
  executive: ExecutiveKpi[]
  funnel: FunnelStep[]
  funnelNotes: string[]
  activation: {
    activationRate: number | null
    activationHelp: string
    avgDaysToFirstParcel: number | null
    avgDaysHelp: string
    returningUserProxy: number | null
    returningHelp: string
    retentionD7: { state: 'unavailable'; message: string }
  }
  moduleRows: ModuleUsageRow[]
  moduleNotes: string[]
  insights: InsightItem[]
  operational: {
    latestDaily: {
      total_tenants: number
      total_parcele: number
      total_recoltari: number
      total_vanzari: number
      total_kg: number
      total_revenue_lei: number
    } | null
  }
  blockages: {
    tenantsNoParcelNonDemo: number
    demoTenants: number
    inactiveNonDemo7d: number
    topFormAbandon: Array<{ module: string; abandoned: number; opened: number }>
  }
  eventsForAi: RawAnalyticsEvent[]
  eventsForFailure: RawAnalyticsEvent[]
  raw7d: RawAnalyticsEvent[]
  events30d: RawAnalyticsEvent[]
  totalUsers: number
  totalTenants: number
  demoTenantsTotal: number
  inactiveTenantsPreview: Array<{
    id: string
    nume: string | null
    lastActivity: string | null
    daysInactive: number
  }>
}

export async function loadAnalyticsDashboardData(
  admin: AdminClient,
  params: AnalyticsDashboardParams
): Promise<LoadAnalyticsDashboardResult> {
  const bounds = getPeriodBounds(params.period)
  const { currentStart, currentEnd, prevStart, prevEnd } = bounds
  const maxEventDays = Math.max(periodDays(params.period), 90)

  const [{ data: tenantsData, error: tenantsErr }, metricsRes] = await Promise.all([
    admin.from('tenants').select('id, is_demo, created_at, nume_ferma, exclude_from_analytics'),
    admin
      .from('tenant_metrics_daily')
      .select(
        'date,total_tenants,total_parcele,total_recoltari,total_vanzari,total_kg_cal1,total_kg_cal2,total_revenue_lei'
      )
      .order('date', { ascending: false })
      .limit(30),
  ])

  const metricsError = tenantsErr?.message ?? metricsRes.error?.message ?? null
  const tenantRows = (tenantsData ?? []) as TenantLite[]
  const demoMap = new Map<string, boolean>()
  const excludeMap = new Map<string, boolean>()
  for (const t of tenantRows) {
    demoMap.set(t.id, Boolean(t.is_demo))
    excludeMap.set(t.id, Boolean(t.exclude_from_analytics))
  }

  const [
    signupsCurrent,
    signupsPrev,
    tenantsNewCurrent,
    tenantsNewPrev,
    cohortIds,
  ] = await Promise.all([
    countProfilesInRange(admin, currentStart, currentEnd),
    countProfilesInRange(admin, prevStart, prevEnd),
    countTenantsInRange(admin, currentStart, currentEnd, params.demo),
    countTenantsInRange(admin, prevStart, prevEnd, params.demo),
    listTenantIdsInRange(admin, currentStart, currentEnd, params.demo),
  ])

  const [withParcel, withOp] = await Promise.all([
    countDistinctTenantsWithParcele(admin, cohortIds),
    countDistinctTenantsWithOperations(admin, cohortIds),
  ])

  const withParcelCreatedInPeriod =
    params.demo === 'all'
      ? await countDistinctTenantsWithParceleCreatedInRange(admin, cohortIds, currentStart, currentEnd)
      : null

  const [{ count: totalUsers }, { count: totalTenants }, { count: demoTenantsTotal }] = await Promise.all([
    admin.from('profiles').select('id', { count: 'exact', head: true }).eq('exclude_from_analytics', false),
    admin.from('tenants').select('id', { count: 'exact', head: true }).eq('exclude_from_analytics', false),
    admin
      .from('tenants')
      .select('id', { count: 'exact', head: true })
      .eq('is_demo', true)
      .eq('exclude_from_analytics', false),
  ])

  const lookbackIso = eventsLookbackIso(maxEventDays)
  const { data: rawEvents, error: evErr } = await admin
    .from('analytics_events')
    .select('user_id, tenant_id, module, event_name, status, created_at, event_data, page_url')
    .gte('created_at', lookbackIso)
    .order('created_at', { ascending: false })

  if (evErr) {
    // continue with empty
  }

  const allEvents = (rawEvents ?? []) as unknown as RawAnalyticsEvent[]

  const filterEv = (e: RawAnalyticsEvent) =>
    tenantInDashboardAnalytics(e.tenant_id, params.demo, demoMap, excludeMap) &&
    e.created_at >= currentStart &&
    e.created_at <= currentEnd

  const eventsInPeriod = allEvents.filter(filterEv)

  const activeTenantIds7d = new Set<string>()
  const activeTenantIds7dAll = new Set<string>()
  const sevenAgo = eventsLookbackIso(7)
  for (const e of allEvents) {
    if (e.tenant_id && excludeMap.get(e.tenant_id)) continue
    if (e.created_at >= sevenAgo && e.tenant_id) activeTenantIds7dAll.add(e.tenant_id)
    if (!tenantAllowed(e.tenant_id, params.demo, demoMap)) continue
    if (e.created_at >= sevenAgo && e.tenant_id) activeTenantIds7d.add(e.tenant_id)
  }

  const todayStr = new Date()
  todayStr.setHours(0, 0, 0, 0)
  const todayIso = todayStr.toISOString()

  // Returning proxy: 8-14d ago had event AND 0-7d ago had event (same user)
  const fourteenAgo = eventsLookbackIso(14)
  const users8to14 = new Set<string>()
  const users0to7 = new Set<string>()
  for (const e of allEvents) {
    if (!e.user_id || !tenantInDashboardAnalytics(e.tenant_id, params.demo, demoMap, excludeMap)) continue
    const t = new Date(e.created_at).getTime()
    const seven = new Date(sevenAgo).getTime()
    const fourteen = new Date(fourteenAgo).getTime()
    if (t >= seven) users0to7.add(e.user_id)
    if (t < seven && t >= fourteen) users8to14.add(e.user_id)
  }
  let returning = 0
  for (const uid of users0to7) {
    if (users8to14.has(uid)) returning += 1
  }

  const demoStartedDistinct = new Set(
    eventsInPeriod.filter((e) => e.event_name === 'demo_started').map((e) => e.tenant_id).filter(Boolean)
  ).size

  const activationRate =
    cohortIds.length > 0 ? ratio(withOp, cohortIds.length) : null

  const avgDays = await avgDaysToFirstParcel(admin, cohortIds)

  const funnel: FunnelStep[] = []
  const funnelNotes: string[] = []

  if (params.demo === 'all') {
    const base = Math.max(signupsCurrent, 1)
    funnel.push({
      key: 'signups',
      label: 'Conturi noi (profiles)',
      count: signupsCurrent,
      pctOfFirst: 100,
      pctOfPrev: null,
    })
    funnel.push({
      key: 'tenants',
      label: 'Ferme noi (tenants) în perioadă',
      count: tenantsNewCurrent,
      pctOfFirst: ratio(tenantsNewCurrent, base) * 100,
      pctOfPrev: ratio(tenantsNewCurrent, signupsCurrent) * 100,
    })
    funnel.push({
      key: 'parcel',
      label: 'Cu ≥1 parcelă (orice moment)',
      count: withParcel,
      pctOfFirst: ratio(withParcel, base) * 100,
      pctOfPrev: ratio(withParcel, tenantsNewCurrent) * 100,
    })
    funnel.push({
      key: 'ops',
      label: 'Cu operațiune (recoltare / vânzare / activitate)',
      count: withOp,
      pctOfFirst: ratio(withOp, base) * 100,
      pctOfPrev: ratio(withOp, withParcel) * 100,
    })
    funnelNotes.push(
      'Pasul „Ferme noi” numără înregistrările în `tenants` (nu neapărat aceeași cohortă ca „Conturi noi”).'
    )
  } else {
    const first = Math.max(tenantsNewCurrent, 1)
    funnel.push({
      key: 'tenants',
      label:
        params.demo === 'exclude_demo'
          ? 'Ferme reale noi (non-demo) în perioadă'
          : 'Ferme demo noi în perioadă',
      count: tenantsNewCurrent,
      pctOfFirst: 100,
      pctOfPrev: null,
    })
    funnel.push({
      key: 'parcel',
      label: 'Cu ≥1 parcelă',
      count: withParcel,
      pctOfFirst: ratio(withParcel, first) * 100,
      pctOfPrev: ratio(withParcel, tenantsNewCurrent) * 100,
    })
    funnel.push({
      key: 'ops',
      label: 'Cu operațiune',
      count: withOp,
      pctOfFirst: ratio(withOp, first) * 100,
      pctOfPrev: ratio(withOp, withParcel) * 100,
    })
  }

  if (withParcelCreatedInPeriod !== null) {
    funnelNotes.push(
      `Parcele create în aceeași perioadă (tenant cohort): ${withParcelCreatedInPeriod} tenanți (semnal separat de „≥1 parcelă”).`
    )
  }

  const executive: ExecutiveKpi[] = [
    {
      key: 'signups',
      label: 'Conturi noi',
      value: signupsCurrent,
      trend:
        signupsPrev === 0
          ? 'neutral'
          : signupsCurrent >= signupsPrev
            ? 'up'
            : 'down',
      trendLabel:
        signupsPrev === 0
          ? 'fără bază anterioară'
          : `${signupsPrev} în intervalul anterior`,
      help: 'Număr de profiluri create cu `profiles.created_at` în perioada selectată.',
      state: 'ok',
    },
    {
      key: 'tenants_new',
      label: 'Ferme noi (tenants)',
      value: tenantsNewCurrent,
      trend:
        tenantsNewPrev === 0
          ? 'neutral'
          : tenantsNewCurrent >= tenantsNewPrev
            ? 'up'
            : 'down',
      trendLabel:
        tenantsNewPrev === 0
          ? 'fără bază anterioară'
          : `${tenantsNewPrev} anterior`,
      help: 'Înregistrări noi în `tenants` în perioadă, cu filtrul demo activ.',
      state: 'ok',
    },
    {
      key: 'demo_started',
      label: 'Demo pornit (evenimente)',
      value: demoStartedDistinct,
      help: 'Tenanți distincți cu `demo_started` în perioadă; necesită tenant în context pentru a fi înregistrat.',
      state: 'approx',
    },
    {
      key: 'activated',
      label: 'Activare (cohortă)',
      value:
        cohortIds.length === 0 || activationRate === null
          ? '—'
          : Math.round(activationRate * 100),
      valueSuffix: cohortIds.length === 0 || activationRate === null ? undefined : '%',
      subtitle:
        cohortIds.length > 0 ? `${withOp}/${cohortIds.length} cu operațiune` : undefined,
      help: 'Din tenanții noi în perioadă (cohortă), câți au cel puțin o recoltare, vânzare sau activitate agricolă.',
      state: cohortIds.length === 0 ? 'unavailable' : 'ok',
    },
    {
      key: 'active_7d',
      label: 'Ferme active 7 zile',
      value: activeTenantIds7d.size,
      help: 'Tenanți cu ≥1 eveniment în `analytics_events` în ultimele 7 zile (include navigare; respectă filtrul demo; exclude `exclude_from_analytics`).',
      state: 'approx',
    },
    {
      key: 'returning',
      label: 'Revenire (proxy)',
      value: returning,
      help: 'Utilizatori cu evenimente în ultimele 7 zile și și în zilele 8–14 anterior; nu este retenție D7 cohortă clasică.',
      state: 'approx',
    },
  ]

  const moduleViewMap: Record<string, { count: number; users: Set<string> }> = {}
  const moduleActionMap: Record<string, { count: number; users: Set<string> }> = {}

  const actionEvents = new Set([
    'create_success',
    'entity_created',
    'form_completed',
    'create_vanzare',
    'create_recoltare',
    'create_activitate',
  ])

  for (const e of eventsInPeriod) {
    let mod: string | null = null
    if (e.event_name === 'view_module' && e.module) {
      mod = e.module
    } else if (e.event_name === 'page_view') {
      mod = routeToModuleName(e.page_url)
    }
    if (mod) {
      if (!moduleViewMap[mod]) moduleViewMap[mod] = { count: 0, users: new Set() }
      moduleViewMap[mod].count++
      if (e.user_id) moduleViewMap[mod].users.add(e.user_id)
    }

    if (
      e.module &&
      (actionEvents.has(e.event_name ?? '') ||
        (e.event_name?.startsWith('create_') && e.event_name !== 'create_failed'))
    ) {
      const m = e.module
      if (!moduleActionMap[m]) moduleActionMap[m] = { count: 0, users: new Set() }
      moduleActionMap[m].count++
      if (e.user_id) moduleActionMap[m].users.add(e.user_id)
    }
  }

  const allModules = new Set([...Object.keys(moduleViewMap), ...Object.keys(moduleActionMap)])
  const moduleRows: ModuleUsageRow[] = Array.from(allModules)
    .map((module) => {
      const v = moduleViewMap[module]?.count ?? 0
      const vu = moduleViewMap[module]?.users.size ?? 0
      const a = moduleActionMap[module]?.count ?? 0
      const au = moduleActionMap[module]?.users.size ?? 0
      const viewToAction = v > 0 ? round2(a / v) : 0
      let coverage: ModuleUsageRow['coverage'] = 'good'
      if (v === 0 && a === 0) coverage = 'none'
      else if (v === 0 && a > 0) coverage = 'partial'
      return {
        module,
        views: v,
        viewUsers: vu,
        actions: a,
        actionUsers: au,
        viewToAction: v > 0 ? viewToAction : null,
        coverage,
      }
    })
    .sort((a, b) => b.views + b.actions - (a.views + a.actions))

  const moduleNotes = [
    'Views: `view_module` + `page_view` mapat la primul segment de rută. Acțiuni: `create_success`, `entity_created`, `form_completed` și evenimente `create_*` pe modul.',
    'Module fără `useTrackModuleView` se pot vedea doar prin `page_view` (inconsistent).',
  ]

  const nonDemoTenants = tenantRows.filter((t) => !t.is_demo && !t.exclude_from_analytics)
  const nonDemoIds = nonDemoTenants.map((t) => t.id)
  let tenantsNoParcelNonDemo = 0
  for (const part of chunk(nonDemoIds, 100)) {
    const { data: pc } = await admin.from('parcele').select('tenant_id').in('tenant_id', part)
    const withP = new Set((pc ?? []).map((r) => r.tenant_id))
    for (const id of part) {
      if (!withP.has(id)) tenantsNoParcelNonDemo++
    }
  }

  const now = new Date(todayIso).getTime()
  const tenantLastActivity: Record<string, string> = {}
  for (const e of allEvents) {
    if (!e.tenant_id) continue
    if (excludeMap.get(e.tenant_id)) continue
    if (!tenantLastActivity[e.tenant_id] || e.created_at > tenantLastActivity[e.tenant_id]) {
      tenantLastActivity[e.tenant_id] = e.created_at
    }
  }

  const inactiveNonDemo7d = nonDemoTenants.filter((t) => !activeTenantIds7dAll.has(t.id)).length

  const inactiveTenantsPreview = nonDemoTenants
    .filter((t) => !activeTenantIds7dAll.has(t.id))
    .map((t) => {
      const lastActivity = tenantLastActivity[t.id] ?? null
      const referenceTs = lastActivity
        ? new Date(lastActivity).getTime()
        : new Date(t.created_at ?? todayIso).getTime()
      const daysInactive = Math.floor((now - referenceTs) / 86_400_000)
      return {
        id: t.id,
        nume: t.nume_ferma,
        lastActivity,
        daysInactive,
      }
    })
    .sort((a, b) => b.daysInactive - a.daysInactive)
    .slice(0, 25)

  const funnelModuleSet = new Set(
    eventsInPeriod
      .filter((e) => ['open_create_form', 'create_success', 'form_abandoned'].includes(e.event_name ?? ''))
      .map((e) => e.module)
      .filter((m): m is string => Boolean(m))
  )
  const topFormAbandon: Array<{ module: string; abandoned: number; opened: number }> = []
  for (const mod of funnelModuleSet) {
    const modEv = eventsInPeriod.filter((e) => e.module === mod)
    const opened = modEv.filter((e) => e.event_name === 'open_create_form').length
    const abandoned = modEv.filter((e) => e.event_name === 'form_abandoned').length
    if (abandoned > 0 || opened > 0) {
      topFormAbandon.push({ module: mod, abandoned, opened })
    }
  }
  topFormAbandon.sort((a, b) => b.abandoned - a.abandoned)

  const insights: InsightItem[] = []
  if (tenantsNoParcelNonDemo > 0) {
    insights.push({
      severity: 'critical',
      title: 'Ferme reale fără parcelă',
      detail: `${tenantsNoParcelNonDemo} tenanți non-demo nu au nicio parcelă înregistrată (stare curentă, nu doar perioadă).`,
      metric: String(tenantsNoParcelNonDemo),
    })
  }
  if (inactiveNonDemo7d > 0) {
    insights.push({
      severity: 'warning',
      title: 'Ferme reale fără evenimente 7 zile',
      detail: `${inactiveNonDemo7d} tenanți non-demo nu au generat evenimente în ultimele 7 zile (include navigare).`,
      metric: String(inactiveNonDemo7d),
    })
  }
  if (topFormAbandon[0] && topFormAbandon[0].abandoned >= 3) {
    insights.push({
      severity: 'warning',
      title: 'Abandon formulare',
      detail: `Cel mai mare volum de abandon: modul „${topFormAbandon[0].module}” (${topFormAbandon[0].abandoned} abandonări vs ${topFormAbandon[0].opened} deschideri).`,
    })
  }

  const rows = (metricsRes.data ?? []) as LoadAnalyticsDashboardResult['tenantMetricsRows']
  const latest = rows[0]

  const eventRowExcluded = (e: RawAnalyticsEvent) => Boolean(e.tenant_id && excludeMap.get(e.tenant_id))

  const events30d = allEvents.filter(
    (e) => e.created_at >= eventsLookbackIso(30) && !eventRowExcluded(e),
  )
  const raw7d = allEvents.filter((e) => e.created_at >= sevenAgo && !eventRowExcluded(e))

  const aiRangeStart = params.aiRange === '7d' ? sevenAgo : eventsLookbackIso(30)
  const eventsForAi = allEvents.filter(
    (e) =>
      e.event_name === 'ai_chat_decision' &&
      e.created_at >= aiRangeStart &&
      !eventRowExcluded(e),
  )
  const eventsForFailure = events30d

  return {
    bounds,
    period: params.period,
    demo: params.demo,
    metricsError,
    tenantMetricsRows: rows,
    executive,
    funnel,
    funnelNotes,
    activation: {
      activationRate,
      activationHelp:
        'Raport din cohortă: tenanți noi în perioadă care au cel puțin o operațiune înregistrată în tabelele operaționale.',
      avgDaysToFirstParcel: avgDays,
      avgDaysHelp:
        avgDays === null
          ? 'Indisponibil pentru cohorte foarte mari sau fără parcele.'
          : 'Medie zile între `tenants.created_at` și prima `parcele.created_at` pentru cohorta selectată.',
      returningUserProxy: returning,
      returningHelp:
        'Proxy de revenire: același user_id cu evenimente în ultimele 7 zile și în intervalul 8–14 zile anterior.',
      retentionD7: {
        state: 'unavailable',
        message:
          'Retenție D7 cohortă (ex. % utilizatori care revin exact la 7 zile) nu este calculată încă; necesită agregare zilnică pe utilizator sau tabel de cohortă.',
      },
    },
    moduleRows,
    moduleNotes,
    insights,
    operational: {
      latestDaily: latest
        ? {
            total_tenants: latest.total_tenants,
            total_parcele: latest.total_parcele,
            total_recoltari: latest.total_recoltari,
            total_vanzari: latest.total_vanzari,
            total_kg: Number(latest.total_kg_cal1 || 0) + Number(latest.total_kg_cal2 || 0),
            total_revenue_lei: Number(latest.total_revenue_lei || 0),
          }
        : null,
    },
    blockages: {
      tenantsNoParcelNonDemo,
      demoTenants: demoTenantsTotal ?? 0,
      inactiveNonDemo7d,
      topFormAbandon: topFormAbandon.slice(0, 8),
    },
    eventsForAi,
    eventsForFailure,
    raw7d,
    events30d,
    totalUsers: totalUsers ?? 0,
    totalTenants: totalTenants ?? 0,
    demoTenantsTotal: demoTenantsTotal ?? 0,
    inactiveTenantsPreview,
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
