import { AppShell } from '@/components/app/AppShell'
import { EmptyState } from '@/components/app/EmptyState'
import { KpiCard } from '@/components/app/KpiCard'
import { PageHeader } from '@/components/app/PageHeader'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { createClient } from '@/lib/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

type MetricsRow = {
  date: string
  total_tenants: number
  total_parcele: number
  total_recoltari: number
  total_vanzari: number
  total_kg_cal1: number
  total_kg_cal2: number
  total_revenue_lei: number
}

type AnalyticsEvent = {
  user_id: string | null
  tenant_id: string | null
  module: string | null
  event_name: string | null
  status: string | null
  created_at: string
  metadata: Record<string, unknown> | null
  page_url: string | null
}

type TenantRow = {
  id: string
  nume_ferma: string | null
  created_at: string | null
  is_demo: boolean | null
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('ro-RO').format(value)
}

function formatLei(value: number): string {
  return new Intl.NumberFormat('ro-RO', {
    style: 'currency',
    currency: 'RON',
    maximumFractionDigits: 0,
  }).format(value)
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('ro-RO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function sevenDaysAgo(): string {
  const d = new Date()
  d.setDate(d.getDate() - 7)
  return d.toISOString()
}

function thirtyDaysAgo(): string {
  const d = new Date()
  d.setDate(d.getDate() - 30)
  return d.toISOString()
}

function todayStart(): string {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
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

export async function AnalyticsDashboard() {
  const supabase = await createClient()
  const admin = getSupabaseAdmin()

  const today = new Date().toISOString().slice(0, 10)
  const { error: refreshError } = await supabase.rpc('refresh_tenant_metrics_daily', { p_date: today })

  const { data: metricsData, error: metricsError } = await supabase
    .from('tenant_metrics_daily')
    .select('date,total_tenants,total_parcele,total_recoltari,total_vanzari,total_kg_cal1,total_kg_cal2,total_revenue_lei')
    .order('date', { ascending: false })
    .limit(30)

  // — KPI counts —
  const [
    { count: totalUsers },
    { count: totalTenants },
    { count: demoTenants },
  ] = await Promise.all([
    admin.from('profiles').select('id', { count: 'exact', head: true }),
    admin.from('tenants').select('id', { count: 'exact', head: true }),
    admin.from('tenants').select('id', { count: 'exact', head: true }).eq('is_demo', true),
  ])

  // — 7-day events for KPI cards (DAU / WAU / active tenants) —
  const { data: raw7d, error: err7d } = await admin
    .from('analytics_events' as any)
    .select('user_id, tenant_id, module, event_name, status, created_at, metadata, page_url')
    .gte('created_at', sevenDaysAgo())

  console.log('[analytics] 7d query:', { count: raw7d?.length ?? 0, error: err7d?.message ?? null, sample: raw7d?.[0] ?? null })

  const events7d: AnalyticsEvent[] = (raw7d ?? []) as unknown as AnalyticsEvent[]

  const activeTenantIds7d = new Set(events7d.map((e) => e.tenant_id).filter(Boolean))
  const activeTenants7d = activeTenantIds7d.size

  const todayStr = todayStart()
  const dau = new Set(
    events7d.filter((e) => e.created_at >= todayStr && e.user_id).map((e) => e.user_id)
  ).size
  const wau = new Set(events7d.filter((e) => e.user_id).map((e) => e.user_id)).size

  // — 30-day events for the analytics sections below —
  const { data: raw30d } = await admin
    .from('analytics_events' as any)
    .select('user_id, tenant_id, module, event_name, status, created_at, metadata, page_url')
    .gte('created_at', thirtyDaysAgo())
    .order('created_at', { ascending: false })

  const events30d: AnalyticsEvent[] = (raw30d ?? []) as unknown as AnalyticsEvent[]

  // — 1. Module usage — view_module (trackEvent, uses module col) OR page_view (track, uses page_url) —
  const moduleViewMap: Record<string, { count: number; users: Set<string> }> = {}
  for (const e of events30d) {
    let mod: string | null = null
    if (e.event_name === 'view_module' && e.module) {
      mod = e.module
    } else if (e.event_name === 'page_view') {
      mod = routeToModuleName(e.page_url)
    }
    if (!mod) continue
    if (!moduleViewMap[mod]) moduleViewMap[mod] = { count: 0, users: new Set() }
    moduleViewMap[mod].count++
    if (e.user_id) moduleViewMap[mod].users.add(e.user_id)
  }
  const moduleViewEntries = Object.entries(moduleViewMap)
    .map(([mod, d]) => ({ mod, count: d.count, uniqueUsers: d.users.size }))
    .sort((a, b) => b.count - a.count)
  const maxModuleViews = moduleViewEntries[0]?.count ?? 1

  // — 2. Operations funnel — open_create_form / create_success / form_abandoned —
  const funnelModuleSet = new Set(
    events30d
      .filter((e) => ['open_create_form', 'create_success', 'form_abandoned'].includes(e.event_name ?? ''))
      .map((e) => e.module)
      .filter((m): m is string => Boolean(m))
  )
  const funnelData = Array.from(funnelModuleSet).map((mod) => {
    const modEvents = events30d.filter((e) => e.module === mod)
    const opened = modEvents.filter((e) => e.event_name === 'open_create_form').length
    const succeeded = modEvents.filter((e) => e.event_name === 'create_success').length
    const abandoned = modEvents.filter((e) => e.event_name === 'form_abandoned').length
    return { module: mod, opened, succeeded, abandoned }
  }).sort((a, b) => b.opened - a.opened)

  // — 3. Inactive tenants — no events in last 7 days —
  const { data: allTenants } = await admin
    .from('tenants' as any)
    .select('id, nume_ferma, created_at, is_demo')
    .eq('is_demo', false)
    .order('created_at', { ascending: false })

  // Build last-activity map from 30-day events (covers 7–30 day inactive cases)
  const tenantLastActivity: Record<string, string> = {}
  for (const e of events30d) {
    if (!e.tenant_id) continue
    if (!tenantLastActivity[e.tenant_id] || e.created_at > tenantLastActivity[e.tenant_id]) {
      tenantLastActivity[e.tenant_id] = e.created_at
    }
  }

  const now = Date.now()
  const inactiveTenants = ((allTenants ?? []) as unknown as TenantRow[])
    .filter((t: TenantRow) => !activeTenantIds7d.has(t.id))
    .map((t: TenantRow) => {
      const lastActivity = tenantLastActivity[t.id] ?? null
      const referenceTs = lastActivity
        ? new Date(lastActivity).getTime()
        : new Date(t.created_at ?? now).getTime()
      const daysInactive = Math.floor((now - referenceTs) / 86_400_000)
      return { ...t, lastActivity, daysInactive }
    })
    .sort((a, b) => b.daysInactive - a.daysInactive)

  // — 4. Top failed actions — status = 'failed', group by module + event_name + error —
  type FailedGroup = { count: number; module: string; eventName: string; errorMessage: string }
  const failedGroupMap: Record<string, FailedGroup> = {}
  for (const e of events30d) {
    if (e.status !== 'failed') continue
    const errorMsg =
      (e.metadata as Record<string, unknown> | null)?.error_message as string | undefined ?? '—'
    const key = `${e.module ?? 'general'}::${e.event_name ?? 'unknown'}::${errorMsg}`
    if (!failedGroupMap[key]) {
      failedGroupMap[key] = {
        count: 0,
        module: e.module ?? 'general',
        eventName: e.event_name ?? 'unknown',
        errorMessage: errorMsg,
      }
    }
    failedGroupMap[key].count++
  }
  const topFailed = Object.values(failedGroupMap)
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)

  const rows = (metricsData ?? []) as MetricsRow[]
  const latest = rows[0]
  const hasMetricsError = refreshError || metricsError

  return (
    <AppShell
      header={
        <PageHeader
          title="📊 Beta Analytics"
          subtitle="Statistici utilizatori și comportament în aplicație"
        />
      }
    >
      <div className="mx-auto w-full max-w-6xl space-y-4 py-4">

        {/* — KPI Cards — */}
        <section className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          <KpiCard title="Utilizatori totali" value={formatNumber(totalUsers ?? 0)} />
          <KpiCard title="Tenanți totali" value={formatNumber(totalTenants ?? 0)} />
          <KpiCard title="Tenanți demo" value={formatNumber(demoTenants ?? 0)} />
          <KpiCard title="Tenanți activi 7z" value={formatNumber(activeTenants7d)} />
          <KpiCard title="DAU (azi)" value={formatNumber(dau)} />
          <KpiCard title="WAU (7 zile)" value={formatNumber(wau)} />
        </section>

        {/* — Tenant Metrics — */}
        {hasMetricsError ? (
          <Card className="rounded-2xl border-red-200 bg-red-50">
            <CardContent className="p-4 text-sm text-red-800">
              Eroare la încărcare metrici agregate:{' '}
              {refreshError?.message ?? metricsError?.message}
            </CardContent>
          </Card>
        ) : latest ? (
          <>
            <section className="grid grid-cols-2 gap-3 lg:grid-cols-5">
              <KpiCard
                title="Tenanți activi (zi curentă)"
                value={formatNumber(latest.total_tenants)}
              />
              <KpiCard title="Total terenuri" value={formatNumber(latest.total_parcele)} />
              <KpiCard
                title="Înregistrări recoltări"
                value={formatNumber(latest.total_recoltari)}
              />
              <KpiCard
                title="Kg recoltate"
                value={formatNumber(
                  Number(latest.total_kg_cal1 || 0) + Number(latest.total_kg_cal2 || 0)
                )}
              />
              <KpiCard
                title="Venit agregat"
                value={formatLei(Number(latest.total_revenue_lei || 0))}
              />
            </section>

            <Card className="rounded-2xl border-[var(--agri-border)] shadow-sm">
              <CardHeader>
                <CardTitle>Evoluție 30 zile</CardTitle>
                <CardDescription>
                  Date agregate anonimizate. Nu sunt expuse date identificabile pe tenant.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto px-4 pb-4 sm:px-6">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead className="text-right">Tenanți activi</TableHead>
                      <TableHead className="text-right">Recoltări</TableHead>
                      <TableHead className="text-right">Vânzări</TableHead>
                      <TableHead className="text-right">Kg Cal1</TableHead>
                      <TableHead className="text-right">Kg Cal2</TableHead>
                      <TableHead className="text-right">Venit</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row) => (
                      <TableRow key={row.date}>
                        <TableCell>{row.date}</TableCell>
                        <TableCell className="text-right">
                          {formatNumber(row.total_tenants)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatNumber(row.total_recoltari)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatNumber(row.total_vanzari)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatNumber(Number(row.total_kg_cal1 || 0))}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatNumber(Number(row.total_kg_cal2 || 0))}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatLei(Number(row.total_revenue_lei || 0))}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </div>
              </CardContent>
            </Card>
          </>
        ) : (
          <EmptyState
            title="Nu există date agregate"
            description="Rulează jobul refresh_tenant_metrics_daily pentru a genera primul snapshot zilnic."
          />
        )}

        {/* ─────────────────────────────────────────────────────────── */}
        {/* Sections below use 30-day analytics_events data            */}
        {/* ─────────────────────────────────────────────────────────── */}

        {/* — 1. Utilizare module — */}
        {moduleViewEntries.length > 0 && (
          <Card className="rounded-2xl border-[var(--agri-border)] shadow-sm">
            <CardHeader>
              <CardTitle>Utilizare module</CardTitle>
              <CardDescription>
                Vizualizări per modul în ultimele 30 de zile
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {moduleViewEntries.map(({ mod, count, uniqueUsers }) => (
                  <div key={mod} className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
                    <div className="flex items-center justify-between sm:contents">
                      <span className="text-sm font-medium text-[var(--agri-text)] sm:w-28 sm:shrink-0">
                        {mod}
                      </span>
                      <span className="text-xs text-muted-foreground sm:hidden">
                        {uniqueUsers} util.
                      </span>
                    </div>
                    <div className="flex flex-1 items-center gap-2">
                      <div className="flex-1 overflow-hidden rounded-full bg-[var(--agri-surface-muted)]">
                        <div
                          className="h-4 rounded-full bg-emerald-500"
                          style={{
                            width: `${Math.round((count / maxModuleViews) * 100)}%`,
                            minWidth: '4px',
                          }}
                        />
                      </div>
                      <span className="w-8 shrink-0 text-right text-sm font-semibold">
                        {count}
                      </span>
                    </div>
                    <span className="hidden sm:block sm:w-24 sm:shrink-0 sm:text-right sm:text-xs sm:text-muted-foreground">
                      {uniqueUsers} utilizatori
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* — 2. Flux operațiuni — */}
        <Card className="rounded-2xl border-[var(--agri-border)] shadow-sm">
          <CardHeader>
            <CardTitle>Flux operațiuni</CardTitle>
            <CardDescription>
              Formulare inițiate vs. finalizate vs. abandonate în ultimele 30 de zile
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {funnelData.length === 0 ? (
              <p className="px-4 pb-4 text-sm text-muted-foreground sm:px-6">Nu există date.</p>
            ) : (
              <div className="overflow-x-auto px-4 pb-4 sm:px-6">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Modul</TableHead>
                      <TableHead className="text-right">Începute</TableHead>
                      <TableHead className="text-right">Finalizate</TableHead>
                      <TableHead className="text-right">Abandonate</TableHead>
                      <TableHead className="text-right">Rată %</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {funnelData.map((row) => (
                      <TableRow key={row.module}>
                        <TableCell className="font-medium">{row.module}</TableCell>
                        <TableCell className="text-right">{row.opened}</TableCell>
                        <TableCell className="text-right text-emerald-600">
                          {row.succeeded}
                        </TableCell>
                        <TableCell className="text-right text-amber-600">
                          {row.abandoned}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {row.opened > 0
                            ? `${Math.round((row.succeeded / row.opened) * 100)}%`
                            : '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* — 3. Tenanți inactivi — */}
        {inactiveTenants.length > 0 && (
          <Card className="rounded-2xl border-amber-200 bg-amber-50 shadow-sm">
            <CardHeader>
              <CardTitle className="text-amber-900">
                ⚠️ Tenanți inactivi (7+ zile)
              </CardTitle>
              <CardDescription className="text-amber-700">
                Tenanți fără activitate înregistrată în ultimele 7 zile
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto px-4 pb-4 sm:px-6">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-amber-800">Tenant</TableHead>
                      <TableHead className="text-right text-amber-800">Ultima activitate</TableHead>
                      <TableHead className="text-right text-amber-800">Zile inactiv</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {inactiveTenants.map((t) => (
                      <TableRow key={t.id} className="border-amber-100">
                        <TableCell className="font-medium text-amber-900">
                          {t.nume_ferma ?? t.id}
                        </TableCell>
                        <TableCell className="text-right text-amber-800">
                          {t.lastActivity ? formatDate(t.lastActivity) : '—'}
                        </TableCell>
                        <TableCell className="text-right font-semibold text-amber-900">
                          {t.daysInactive > 30 ? '30+' : t.daysInactive}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* — 4. Acțiuni eșuate — */}
        <Card className="rounded-2xl border-[var(--agri-border)] shadow-sm">
          <CardHeader>
            <CardTitle>Acțiuni eșuate</CardTitle>
            <CardDescription>
              Cele mai frecvente erori în ultimele 30 de zile (top 10)
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {topFailed.length === 0 ? (
              <p className="px-4 pb-4 text-sm text-muted-foreground sm:px-6">Nu există acțiuni eșuate.</p>
            ) : (
              <div className="overflow-x-auto px-4 pb-4 sm:px-6">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Modul</TableHead>
                      <TableHead>Eveniment</TableHead>
                      <TableHead>Eroare</TableHead>
                      <TableHead className="text-right">Count</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {topFailed.map((row, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{row.module}</TableCell>
                        <TableCell className="text-muted-foreground">{row.eventName}</TableCell>
                        <TableCell className="max-w-[200px] truncate text-xs text-muted-foreground">
                          {row.errorMessage}
                        </TableCell>
                        <TableCell className="text-right font-semibold text-red-600">
                          {row.count}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

      </div>
    </AppShell>
  )
}
