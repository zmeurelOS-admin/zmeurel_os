'use client'

import type { ReactNode } from 'react'

import { CalendarDays, ExternalLink, LayoutGrid, Package, Users } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

import { AppShell } from '@/components/app/AppShell'
import { PageHeader } from '@/components/app/PageHeader'
import { MobileEntityCard } from '@/components/ui/MobileEntityCard'
import { cn } from '@/lib/utils'
import { gustaBrandColors, gustaBrandShadows } from '@/lib/shop/association/brand-tokens'
import type { AssociationDashboardPageStats } from '@/lib/association/queries'
import type { StatusTone } from '@/lib/ui/theme'

const fmtLei = (n: number) =>
  new Intl.NumberFormat('ro-RO', { maximumFractionDigits: 0 }).format(n)

export type AssociationDashboardProps = {
  stats: AssociationDashboardPageStats
  /** False dacă lipsesc CUI, sediu, email sau telefon în setările comerciantului. */
  merchantComplianceComplete?: boolean
}

function comandaStatusTone(status: string): StatusTone {
  const n = status.trim().toLowerCase()
  if (['livrata', 'platit', 'achitat', 'achitata'].includes(n)) return 'success'
  if (['anulata', 'restanta', 'expirat'].includes(n)) return 'danger'
  if (['noua', 'inactiv'].includes(n)) return 'neutral'
  return 'warning'
}

type KpiCardProps = {
  emoji: string
  label: string
  value: string
  subline?: ReactNode
  icon?: ReactNode
  highlight?: boolean
}

function KpiCard({ emoji, label, value, subline, icon, highlight }: KpiCardProps) {
  return (
    <div
      className="flex gap-4 rounded-2xl border border-[var(--border-default)] bg-[var(--surface-card)] p-5 sm:p-6"
      style={{ boxShadow: gustaBrandShadows.sm, borderRadius: 16 }}
    >
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[color:color-mix(in_srgb,var(--agri-primary)_12%,var(--surface-card))] text-xl">
        {icon ?? <span aria-hidden>{emoji}</span>}
      </div>
      <div className="min-w-0 flex-1">
        <div
          className={cn(
            'text-[28px] font-bold leading-none tracking-tight tabular-nums',
            highlight ? '' : 'text-[var(--text-primary)]'
          )}
          style={highlight ? { color: gustaBrandColors.primary } : undefined}
        >
          {value}
        </div>
        <div className="mt-1.5 text-[10px] font-semibold uppercase leading-snug tracking-wide text-[var(--text-secondary)] sm:text-xs">
          {label}
        </div>
        {subline ? <div className="mt-1 text-sm text-[var(--text-secondary)]">{subline}</div> : null}
      </div>
    </div>
  )
}

const quickChipClass =
  'inline-flex h-10 min-h-10 shrink-0 items-center gap-2 rounded-[12px] border border-[var(--border-default)] bg-[var(--surface-card)] px-4 text-[13px] font-semibold text-[var(--text-primary)] transition-colors hover:border-[var(--agri-primary)] hover:bg-[var(--agri-primary)] hover:text-white active:scale-[0.99]'

export function AssociationDashboardClient({
  stats,
  merchantComplianceComplete = true,
}: AssociationDashboardProps) {
  const router = useRouter()
  const { ordersWeek } = stats

  const trendNode =
    ordersWeek.trendPercent == null ? (
      <span className="text-[var(--text-muted)]">— față de săpt. anterioară</span>
    ) : (
      <span
        className="inline-flex items-center gap-1 font-semibold tabular-nums"
        style={{
          color: ordersWeek.trendPercent >= 0 ? gustaBrandColors.accent : 'var(--status-danger-text)',
        }}
      >
        {ordersWeek.trendPercent >= 0 ? '↑' : '↓'} {Math.abs(ordersWeek.trendPercent)}% vs săpt. anterioară
      </span>
    )

  return (
    <AppShell
      header={<PageHeader title="Asociație" subtitle="Gustă din Bucovina — tablou de bord" />}
    >
      <div className="mx-auto w-full max-w-6xl pb-10 pt-1 md:pt-2">
        {!merchantComplianceComplete ? (
          <div
            className="mb-5 rounded-2xl border px-4 py-3 text-sm"
            style={{
              borderColor: 'rgba(179, 90, 0, 0.35)',
              backgroundColor: 'rgba(179, 90, 0, 0.08)',
              color: 'var(--text-primary)',
            }}
          >
            <span aria-hidden>⚠️ </span>
            Completează datele comerciantului în Setări pentru conformitate legală.{' '}
            <Link href="/asociatie/setari" className="font-semibold underline underline-offset-2">
              Deschide setările
            </Link>
          </div>
        ) : null}
        {/* KPI */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiCard
            emoji="📅"
            icon={<CalendarDays className="h-6 w-6" style={{ color: gustaBrandColors.primary }} />}
            label="Comenzi azi"
            value={String(stats.ordersToday.count)}
            subline={
              <span style={{ color: gustaBrandColors.primary }} className="font-semibold tabular-nums">
                {fmtLei(stats.ordersToday.total)} RON
              </span>
            }
            highlight={stats.ordersToday.count > 0}
          />
          <KpiCard
            emoji="📊"
            icon={<LayoutGrid className="h-6 w-6" style={{ color: gustaBrandColors.primary }} />}
            label="Săptămânal"
            value={String(stats.ordersWeek.count)}
            subline={trendNode}
            highlight={stats.ordersWeek.count > 0}
          />
          <KpiCard
            emoji="🛒"
            icon={<Package className="h-6 w-6" style={{ color: gustaBrandColors.primary }} />}
            label="Produse listate"
            value={`${stats.productsListed}`}
            subline={
              <span>
                din <span className="font-medium tabular-nums">{stats.productsTotal}</span> disponibile (active,
                aprobate)
              </span>
            }
            highlight={stats.productsListed > 0}
          />
          <KpiCard
            emoji="🌾"
            icon={<Users className="h-6 w-6" style={{ color: gustaBrandColors.primary }} />}
            label="Producători activi"
            value={String(stats.producersActive)}
            subline="Cu produse listate"
            highlight={stats.producersActive > 0}
          />
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <Link
            href="/asociatie/comenzi?status=noua"
            className={cn(quickChipClass, 'no-underline')}
          >
            <span aria-hidden>📋</span>
            Comenzi noi
            {stats.newOrdersCount > 0 ? (
              <span
                className="ml-0.5 min-w-[1.25rem] rounded-full px-1.5 py-0.5 text-center text-[11px] font-bold text-white"
                style={{ backgroundColor: gustaBrandColors.accent }}
              >
                {stats.newOrdersCount > 99 ? '99+' : stats.newOrdersCount}
              </span>
            ) : null}
          </Link>
          <Link href="/asociatie/produse" className={cn(quickChipClass, 'no-underline')}>
            <span aria-hidden>📦</span>
            Produse
          </Link>
          <Link href="/asociatie/oferte" className={cn(quickChipClass, 'no-underline')}>
            <span aria-hidden>📨</span>
            Oferte noi
            {(stats.pendingOffersCount ?? 0) > 0 ? (
              <span
                className="ml-0.5 min-w-[1.25rem] rounded-full px-1.5 py-0.5 text-center text-[11px] font-bold text-white"
                style={{ backgroundColor: gustaBrandColors.primary }}
              >
                {(stats.pendingOffersCount ?? 0) > 99 ? '99+' : stats.pendingOffersCount}
              </span>
            ) : null}
          </Link>
          <a
            href="/magazin/asociatie"
            target="_blank"
            rel="noopener noreferrer"
            className={cn(quickChipClass, 'no-underline')}
          >
            <span aria-hidden>🏪</span>
            Magazin
            <ExternalLink className="h-3.5 w-3.5 opacity-70" aria-hidden />
          </a>
        </div>

        {/* Activitate recentă */}
        <div className="mt-10">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-[var(--text-secondary)]">
            Activitate recentă
          </h2>

          <div className="hidden md:block">
            <div
              className="overflow-hidden rounded-2xl border border-[var(--border-default)] bg-[var(--surface-card)]"
              style={{ boxShadow: gustaBrandShadows.sm }}
            >
              <ul className="divide-y divide-[var(--border-default)]">
                {stats.recentOrders.length === 0 ? (
                  <li className="px-5 py-10 text-center text-sm text-[var(--text-secondary)]">
                    Nicio comandă recentă vizibilă.
                  </li>
                ) : (
                  stats.recentOrders.map((o) => (
                    <li key={o.id}>
                      <button
                        type="button"
                        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-[var(--surface-card-muted)]"
                        onClick={() => router.push('/asociatie/comenzi')}
                      >
                        <div className="min-w-0">
                          <div className="truncate font-semibold text-[var(--text-primary)]">
                            {o.client_name}
                            <span className="font-normal text-[var(--text-secondary)]"> · {o.product_name}</span>
                          </div>
                          <div className="mt-0.5 text-xs text-[var(--text-secondary)]">{o.date}</div>
                        </div>
                        <div className="flex shrink-0 items-center gap-4">
                          <span
                            className="text-lg font-bold tabular-nums"
                            style={{ color: gustaBrandColors.primary }}
                          >
                            {fmtLei(o.amount)} <span className="text-xs font-semibold">RON</span>
                          </span>
                          <span className="rounded-md border border-[var(--border-default)] bg-[var(--surface-card-muted)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--text-secondary)]">
                            {o.status}
                          </span>
                        </div>
                      </button>
                    </li>
                  ))
                )}
              </ul>
            </div>
          </div>

          <div className="space-y-2 md:hidden">
            {stats.recentOrders.length === 0 ? (
              <p className="rounded-2xl border border-[var(--border-default)] bg-[var(--surface-card-muted)] px-4 py-8 text-center text-sm text-[var(--text-secondary)]">
                Nicio comandă recentă.
              </p>
            ) : (
              stats.recentOrders.map((o) => (
                <MobileEntityCard
                  key={o.id}
                  title={o.client_name}
                  subtitle={o.product_name}
                  mainValue={`${fmtLei(o.amount)} RON`}
                  meta={o.date}
                  statusLabel={o.status}
                  statusTone={comandaStatusTone(o.status)}
                  showChevron
                  interactive
                  onClick={() => router.push('/asociatie/comenzi')}
                  ariaLabel={`Comandă ${o.client_name}, ${o.amount} RON`}
                />
              ))
            )}
          </div>
        </div>
      </div>
    </AppShell>
  )
}
