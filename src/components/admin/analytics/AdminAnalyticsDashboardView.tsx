import Link from 'next/link'
import type { ReactNode } from 'react'

import { AppShell } from '@/components/app/AppShell'
import { EmptyState } from '@/components/app/EmptyState'
import { PageHeader } from '@/components/app/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { LoadAnalyticsDashboardResult } from '@/lib/admin/analytics-dashboard-data'
import type { AnalyticsDashboardParams } from '@/lib/admin/analytics-dashboard-data'
import type { SentryTechHealth } from '@/lib/monitoring/sentry-tech-health'
import { buildAdminAnalyticsHref } from '@/lib/admin/analytics-url'
import { cn } from '@/lib/utils'

import { AnalyticsAiSection } from './AnalyticsAiSection'
import { AnalyticsRefreshButton } from './AnalyticsRefreshButton'
import { AdminAnalyticsSentrySection } from './AdminAnalyticsSentrySection'
import { MetricHint } from './MetricHint'

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

function getErrorFromEvent(e: LoadAnalyticsDashboardResult['eventsForFailure'][0]): string {
  const d = e.event_data
  if (d && typeof d === 'object' && d !== null && 'error_message' in d) {
    const m = (d as { error_message?: unknown }).error_message
    if (typeof m === 'string' && m.trim()) return m
  }
  return '—'
}

function ControlLink({
  href,
  label,
  active,
}: {
  href: string
  label: string
  active: boolean
}) {
  return (
    <Button asChild size="sm" variant={active ? 'default' : 'outline'} className="h-8 rounded-md text-xs">
      <Link href={href}>{label}</Link>
    </Button>
  )
}

function SectionTitle({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div className="border-b border-[var(--agri-border)] pb-3">
      <h2 className="text-lg font-semibold tracking-tight text-[var(--agri-text)]">{title}</h2>
      <p className="mt-1 max-w-4xl text-sm leading-relaxed text-muted-foreground">{description}</p>
    </div>
  )
}

function KpiStat({
  kpi,
}: {
  kpi: LoadAnalyticsDashboardResult['executive'][0]
}) {
  const stateBorder =
    kpi.state === 'ok'
      ? 'border-l-[var(--agri-primary)]'
      : kpi.state === 'approx'
        ? 'border-l-amber-500'
        : 'border-l-muted-foreground'

  return (
    <div
      className={cn(
        'flex min-h-[112px] flex-col justify-between rounded-xl border border-[var(--agri-border)] bg-[var(--agri-surface)] px-4 py-3 shadow-sm',
        'border-l-4',
        stateBorder
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <MetricHint label={kpi.help}>
          <span className="text-[13px] font-semibold leading-snug text-[var(--agri-text)]">{kpi.label}</span>
        </MetricHint>
        {kpi.state === 'approx' && (
          <span className="shrink-0 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-900">
            aprox.
          </span>
        )}
        {kpi.state === 'unavailable' && (
          <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase text-muted-foreground">
            n/a
          </span>
        )}
      </div>
      <div className="mt-2">
        <p className="text-2xl font-bold tabular-nums tracking-tight text-[var(--agri-text)]">
          {kpi.value}
          {kpi.valueSuffix ? <span className="text-lg font-semibold">{kpi.valueSuffix}</span> : null}
        </p>
        {kpi.subtitle ? <p className="mt-1 text-xs text-muted-foreground">{kpi.subtitle}</p> : null}
        {kpi.trendLabel ? (
          <p className="mt-1 text-[11px] text-muted-foreground">
            vs. interval anterior:{' '}
            <span className="font-medium text-[var(--agri-text)]">{kpi.trendLabel}</span>
          </p>
        ) : null}
      </div>
    </div>
  )
}

export function AdminAnalyticsDashboardView({
  data,
  params,
  sentryTechHealth,
}: {
  data: LoadAnalyticsDashboardResult
  params: AnalyticsDashboardParams
  sentryTechHealth: SentryTechHealth
}) {
  const failedGroups = new Map<string, { count: number; module: string; eventName: string; errorMessage: string }>()
  for (const e of data.eventsForFailure.filter((x) => x.status === 'failed')) {
    const errorMsg = getErrorFromEvent(e)
    const key = `${e.module ?? 'general'}::${e.event_name ?? 'unknown'}::${errorMsg}`
    const cur = failedGroups.get(key)
    if (cur) cur.count += 1
    else {
      failedGroups.set(key, {
        count: 1,
        module: e.module ?? 'general',
        eventName: e.event_name ?? 'unknown',
        errorMessage: errorMsg,
      })
    }
  }
  const topFailed = Array.from(failedGroups.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 12)

  return (
    <AppShell
      header={
        <PageHeader
          title="Analytics produs"
          subtitle="Semnale SaaS, activare și operare — desktop"
        />
      }
    >
      <div className="mx-auto w-full max-w-[1400px] space-y-10 px-4 py-6 md:px-6">
        {/* A — Control bar */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0 space-y-1">
            <p className="text-sm text-muted-foreground">
              Perioada: <span className="font-medium text-[var(--agri-text)]">{data.bounds.currentStart.slice(0, 10)}</span>{' '}
              → <span className="font-medium text-[var(--agri-text)]">{data.bounds.currentEnd.slice(0, 10)}</span>
            </p>
            <p className="text-xs text-muted-foreground">
              Bază: `analytics_events`, `tenant_metrics_daily`, `tenant`/`profiles`/`parcele`. Conturi/ferme cu
              `exclude_from_analytics` (ex. E2E `*@example.test`) sunt excluse din KPI-uri; demo-urile utilizatorilor
              reali rămân dacă nu sunt marcate.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex flex-wrap gap-1.5">
              <ControlLink
                href={buildAdminAnalyticsHref(params, { period: '7d' })}
                label="7 zile"
                active={params.period === '7d'}
              />
              <ControlLink
                href={buildAdminAnalyticsHref(params, { period: '30d' })}
                label="30 zile"
                active={params.period === '30d'}
              />
              <ControlLink
                href={buildAdminAnalyticsHref(params, { period: '90d' })}
                label="90 zile"
                active={params.period === '90d'}
              />
            </div>
            <div className="hidden h-6 w-px bg-[var(--agri-border)] lg:block" aria-hidden />
            <div className="flex flex-wrap gap-1.5">
              <ControlLink href={buildAdminAnalyticsHref(params, { demo: 'all' })} label="Toate" active={params.demo === 'all'} />
              <ControlLink
                href={buildAdminAnalyticsHref(params, { demo: 'exclude_demo' })}
                label="Fără demo"
                active={params.demo === 'exclude_demo'}
              />
              <ControlLink
                href={buildAdminAnalyticsHref(params, { demo: 'demo_only' })}
                label="Doar demo"
                active={params.demo === 'demo_only'}
              />
            </div>
            <AnalyticsRefreshButton />
          </div>
        </div>

        {/* B — Executive */}
        <section className="space-y-4">
          <SectionTitle
            title="Overview executiv"
            description="Intrări în produs, ferme noi și semnale de activitate. „Aprox.” = metrică permisivă sau proxy; „n/a” = lipsă cohortă."
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
            {data.executive.map((kpi) => (
              <KpiStat key={kpi.key} kpi={kpi} />
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Total platformă:{' '}
            <span className="font-medium text-[var(--agri-text)]">{formatNumber(data.totalUsers)}</span> utilizatori ·{' '}
            <span className="font-medium text-[var(--agri-text)]">{formatNumber(data.totalTenants)}</span> ferme ·{' '}
            <span className="font-medium text-[var(--agri-text)]">{formatNumber(data.demoTenantsTotal)}</span> demo.
          </p>
        </section>

        {/* C — Funnel */}
        <section className="space-y-4">
          <SectionTitle
            title="Funnel principal"
            description="Cohortă: înregistrări noi în perioadă (tenants) — conversii între pași; compară cu „Conturi noi” doar când filtrul demo = „Toate”."
          />
          <div className="overflow-x-auto rounded-xl border border-[var(--agri-border)] bg-[var(--agri-surface)] shadow-sm">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Pas</TableHead>
                  <TableHead className="text-right tabular-nums">Count</TableHead>
                  <TableHead className="text-right tabular-nums">% din primul pas</TableHead>
                  <TableHead className="text-right tabular-nums">% din pasul anterior</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.funnel.map((row) => (
                  <TableRow key={row.key}>
                    <TableCell className="font-medium">{row.label}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatNumber(row.count)}</TableCell>
                    <TableCell className="text-right tabular-nums">{Math.round(row.pctOfFirst)}%</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {row.pctOfPrev === null ? '—' : `${Math.round(row.pctOfPrev)}%`}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {data.funnelNotes.length > 0 && (
            <ul className="list-inside list-disc space-y-1 text-xs text-muted-foreground">
              {data.funnelNotes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          )}
        </section>

        {/* D — Activation */}
        <section className="space-y-4">
          <SectionTitle
            title="Activare & retenție"
            description="„Activare” = operațiune în DB; retenția clasică D7 nu e încă agregată."
          />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border border-[var(--agri-border)] bg-[var(--agri-surface)] p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Rată activare</p>
                <p className="mt-1 text-2xl font-bold tabular-nums">
                  {data.activation.activationRate === null ? '—' : `${Math.round(data.activation.activationRate * 100)}%`}
                </p>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{data.activation.activationHelp}</p>
              </div>
              <div className="rounded-xl border border-[var(--agri-border)] bg-[var(--agri-surface)] p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Medie zile până la prima parcelă
                </p>
                <p className="mt-1 text-2xl font-bold tabular-nums">
                  {data.activation.avgDaysToFirstParcel === null
                    ? '—'
                    : `${data.activation.avgDaysToFirstParcel.toFixed(1)} zile`}
                </p>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{data.activation.avgDaysHelp}</p>
              </div>
              <div className="rounded-xl border border-[var(--agri-border)] bg-[var(--agri-surface)] p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Revenire (proxy)</p>
                <p className="mt-1 text-2xl font-bold tabular-nums">
                  {formatNumber(data.activation.returningUserProxy ?? 0)}
                </p>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{data.activation.returningHelp}</p>
              </div>
              <div className="rounded-xl border border-dashed border-amber-300 bg-amber-50/90 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-900">Retenție D7 cohortă</p>
                <p className="mt-2 text-sm font-medium text-amber-950">{data.activation.retentionD7.message}</p>
              </div>
            </div>
        </section>

        {/* E — Modules */}
        <section className="space-y-4">
          <SectionTitle
            title="Utilizare pe module"
            description="Views vs acțiuni create în perioadă; rată view→acțiune când există views. Acoperire incompletă = instrumentare parțială."
          />
          <div className="overflow-x-auto rounded-xl border border-[var(--agri-border)] bg-[var(--agri-surface)] shadow-sm">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Modul</TableHead>
                  <TableHead className="text-right">Views</TableHead>
                  <TableHead className="text-right">Util. views</TableHead>
                  <TableHead className="text-right">Acțiuni</TableHead>
                  <TableHead className="text-right">Util. acțiuni</TableHead>
                  <TableHead className="text-right">View→acțiune</TableHead>
                  <TableHead className="text-right">Acoperire</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.moduleRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-sm text-muted-foreground">
                      Nu există date în perioadă pentru filtrul curent.
                    </TableCell>
                  </TableRow>
                ) : (
                  data.moduleRows.map((row) => (
                    <TableRow key={row.module}>
                      <TableCell className="font-medium">{row.module}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatNumber(row.views)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatNumber(row.viewUsers)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatNumber(row.actions)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatNumber(row.actionUsers)}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.viewToAction === null ? '—' : row.viewToAction.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right text-xs capitalize text-muted-foreground">{row.coverage}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          <ul className="list-inside list-disc space-y-1 text-xs text-muted-foreground">
            {data.moduleNotes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </section>

        {/* F — Blockages */}
        <section className="space-y-4">
          <SectionTitle
            title="Blocaje & oportunități"
            description="Unde se pierde valoarea: ferme goale, abandon formulare, inactivitate."
          />
          <div className="grid gap-4 lg:grid-cols-3">
            {data.insights.map((ins, idx) => (
              <div
                key={`${ins.title}-${idx}`}
                className={cn(
                  'rounded-xl border p-4 shadow-sm',
                  ins.severity === 'critical' && 'border-red-200 bg-red-50/80',
                  ins.severity === 'warning' && 'border-amber-200 bg-amber-50/80',
                  ins.severity === 'info' && 'border-[var(--agri-border)] bg-[var(--agri-surface)]'
                )}
              >
                <p className="text-sm font-semibold text-[var(--agri-text)]">{ins.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{ins.detail}</p>
              </div>
            ))}
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-xl border border-[var(--agri-border)] bg-[var(--agri-surface)] p-4">
              <p className="text-sm font-semibold text-[var(--agri-text)]">Formulare (perioadă)</p>
              <p className="mt-1 text-xs text-muted-foreground">Deschideri vs abandonuri pe modul.</p>
              <div className="mt-3 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Modul</TableHead>
                      <TableHead className="text-right">Deschise</TableHead>
                      <TableHead className="text-right">Abandon</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.blockages.topFormAbandon.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} className="text-xs text-muted-foreground">
                          Fără date.
                        </TableCell>
                      </TableRow>
                    ) : (
                      data.blockages.topFormAbandon.map((r) => (
                        <TableRow key={r.module}>
                          <TableCell className="font-medium">{r.module}</TableCell>
                          <TableCell className="text-right tabular-nums">{r.opened}</TableCell>
                          <TableCell className="text-right tabular-nums text-amber-600">{r.abandoned}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>

            <div className="rounded-xl border border-[var(--agri-border)] bg-[var(--agri-surface)] p-4">
              <p className="text-sm font-semibold text-[var(--agri-text)]">Ferme reale inactive (7 zile)</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {formatNumber(data.blockages.inactiveNonDemo7d)} fără evenimente în 7z (inclusiv navigare).
              </p>
              <div className="mt-3 max-h-64 overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Fermă</TableHead>
                      <TableHead className="text-right">Ultima activitate</TableHead>
                      <TableHead className="text-right">Zile</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.inactiveTenantsPreview.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} className="text-xs text-muted-foreground">
                          —
                        </TableCell>
                      </TableRow>
                    ) : (
                      data.inactiveTenantsPreview.map((t) => (
                        <TableRow key={t.id}>
                          <TableCell className="max-w-[220px] truncate text-sm font-medium">{t.nume ?? t.id}</TableCell>
                          <TableCell className="text-right text-xs text-muted-foreground">
                            {formatDate(t.lastActivity)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-xs">{t.daysInactive > 30 ? '30+' : t.daysInactive}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        </section>

        {/* G — Operational */}
        <section className="space-y-4">
          <SectionTitle
            title="Operațiuni agricole (agregat zilnic)"
            description="„Tenanți activi (zi)” = tenanți cu activitate operațională în acea zi. „Total parcele” din snapshot este cumulativ (toate timpurile), nu pe zi — nu îl comparăm cu celelalte coloane."
          />
          {data.metricsError ? (
            <Card className="border-red-200 bg-red-50">
              <CardContent className="p-4 text-sm text-red-800">{data.metricsError}</CardContent>
            </Card>
          ) : data.operational.latestDaily ? (
            <div className="grid gap-4 lg:grid-cols-5">
              <OperationalMiniStat
                title="Tenanți activi (zi curentă)"
                value={formatNumber(data.operational.latestDaily.total_tenants)}
                subtitle="distinct cu activitate în ziua respectivă"
              />
              <OperationalMiniStat
                title="Total parcele (cumulativ)"
                value={formatNumber(data.operational.latestDaily.total_parcele)}
                subtitle="toate parcele; nu e pe zi"
              />
              <OperationalMiniStat title="Recoltări (zi)" value={formatNumber(data.tenantMetricsRows[0]?.total_recoltari ?? 0)} />
              <OperationalMiniStat title="Kg (zi)" value={formatNumber(data.operational.latestDaily.total_kg)} />
              <OperationalMiniStat title="Venit (zi)" value={formatLei(data.operational.latestDaily.total_revenue_lei)} />
            </div>
          ) : (
            <EmptyState title="Nu există date agregate" description="Rulează refresh_tenant_metrics_daily." />
          )}

          {data.tenantMetricsRows.length > 0 && (
            <div className="overflow-x-auto rounded-xl border border-[var(--agri-border)] bg-[var(--agri-surface)] shadow-sm">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Data</TableHead>
                    <TableHead className="text-right">Tenanți activi (zi)</TableHead>
                    <TableHead className="text-right">Recoltări</TableHead>
                    <TableHead className="text-right">Vânzări</TableHead>
                    <TableHead className="text-right">Kg Cal1</TableHead>
                    <TableHead className="text-right">Kg Cal2</TableHead>
                    <TableHead className="text-right">Venit</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.tenantMetricsRows.map((row) => (
                    <TableRow key={row.date}>
                      <TableCell>{row.date}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatNumber(row.total_tenants)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatNumber(row.total_recoltari)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatNumber(row.total_vanzari)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatNumber(Number(row.total_kg_cal1 || 0))}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatNumber(Number(row.total_kg_cal2 || 0))}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatLei(Number(row.total_revenue_lei || 0))}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </section>

        {/* H — AI */}
        <section className="space-y-4">
          <SectionTitle
            title="Telemetrie tehnică (AI)"
            description="Pentru hardening beta; secundar față de funnel și activare."
          />
          <AnalyticsAiSection eventsRaw={data.eventsForAi} params={params} />
        </section>

        {/* Failed actions */}
        <section className="space-y-4">
          <SectionTitle
            title="Acțiuni eșuate (evenimente)"
            description="Grupate după modul, eveniment și mesaj; sursa JSON este `event_data`."
          />
          <div className="overflow-x-auto rounded-xl border border-[var(--agri-border)] bg-[var(--agri-surface)] shadow-sm">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Modul</TableHead>
                  <TableHead>Eveniment</TableHead>
                  <TableHead>Eroare</TableHead>
                  <TableHead className="text-right">Count</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topFailed.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">
                      Nu există acțiuni eșuate în ultimele 30 zile.
                    </TableCell>
                  </TableRow>
                ) : (
                  topFailed.map((row, i) => (
                    <TableRow key={`${row.module}-${row.eventName}-${i}`}>
                      <TableCell className="font-medium">{row.module}</TableCell>
                      <TableCell className="text-muted-foreground">{row.eventName}</TableCell>
                      <TableCell className="max-w-[280px] truncate text-xs text-muted-foreground">{row.errorMessage}</TableCell>
                      <TableCell className="text-right font-semibold text-red-600 tabular-nums">{row.count}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </section>

        {/* Tech Health — Sentry (config snapshot, nu metrici produs) */}
        <AdminAnalyticsSentrySection health={sentryTechHealth} />
      </div>
    </AppShell>
  )
}

function OperationalMiniStat({
  title,
  value,
  subtitle,
}: {
  title: string
  value: ReactNode
  subtitle?: string
}) {
  return (
    <div className="rounded-xl border border-[var(--agri-border)] bg-[var(--agri-surface)] px-4 py-3 shadow-sm">
      <p className="text-[13px] font-semibold text-[var(--agri-text)]">{title}</p>
      <p className="mt-2 text-xl font-bold tabular-nums tracking-tight">{value}</p>
      {subtitle ? <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{subtitle}</p> : null}
    </div>
  )
}
