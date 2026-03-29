'use client'

import Link from 'next/link'
import { GripVertical, Sparkles, TrendingDown, TrendingUp, X } from 'lucide-react'

import { Sparkline } from '@/components/dashboard/Sparkline'
import { Button } from '@/components/ui/button'
import { AppCard } from '@/components/ui/app-card'
import { cn } from '@/lib/utils'

type WidgetFrameProps = {
  title?: string
  description?: string
  editMode: boolean
  children: React.ReactNode
  footer?: React.ReactNode
  placeholder?: boolean
  onDisable?: () => void
  className?: string
  handleEnabled?: boolean
  hideHeader?: boolean
}

function WidgetPlaceholder() {
  return (
    <div className="flex h-full min-h-[140px] flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--agri-border)] bg-[var(--agri-surface-muted)]/60 px-4 text-center">
      <Sparkles className="mb-3 h-5 w-5 text-[var(--agri-text-muted)]" />
      <div className="text-sm font-semibold text-[var(--agri-text)]">Nicio dată disponibilă</div>
      <div className="mt-1 max-w-xs text-xs leading-5 text-[var(--agri-text-muted)]">
        Widget-ul rămâne disponibil în layout și se va popula automat când apar date noi.
      </div>
    </div>
  )
}

function WidgetFrame({
  title,
  description,
  editMode,
  children,
  footer,
  placeholder = false,
  onDisable,
  className,
  handleEnabled = true,
  hideHeader = false,
}: WidgetFrameProps) {
  return (
    <AppCard
      className={cn(
        'flex h-full flex-col overflow-hidden p-0 shadow-[0_10px_24px_rgba(16,32,21,0.06)]',
        editMode ? 'border-dashed border-[var(--agri-primary)]/45 bg-[var(--agri-surface)]' : '',
        className
      )}
    >
      {!hideHeader ? (
        <div className="flex items-start justify-between gap-3 border-b border-[var(--agri-border)]/70 px-4 py-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              {editMode && handleEnabled ? (
                <span className="dashboard-widget-handle inline-flex cursor-grab items-center rounded-md border border-[var(--agri-border)] bg-[var(--agri-surface-muted)] px-1.5 py-1 text-[var(--agri-text-muted)] active:cursor-grabbing">
                  <GripVertical className="h-3.5 w-3.5" />
                </span>
              ) : null}
              {title ? <h3 className="truncate text-sm font-semibold text-[var(--agri-text)]">{title}</h3> : null}
            </div>
            {description ? <p className="mt-1 text-xs leading-5 text-[var(--agri-text-muted)]">{description}</p> : null}
          </div>
          {editMode && onDisable ? (
            <Button
              type="button"
              size="icon-xs"
              variant="outline"
              onClick={onDisable}
              className="shrink-0 rounded-full"
              aria-label={`Ascunde widget ${title ?? 'fără titlu'}`}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-1 flex-col px-4 py-4">
        {placeholder ? <WidgetPlaceholder /> : children}
      </div>

      {footer ? <div className="border-t border-[var(--agri-border)]/70 px-4 py-3">{footer}</div> : null}
    </AppCard>
  )
}

type KpiSummaryItem = {
  id: string
  label: string
  value: string
  meta: string
  tone?: 'neutral' | 'positive' | 'negative'
  trendLabel?: string
}

export function KpiSummaryWidget({
  editMode,
  items,
}: {
  editMode: boolean
  items: KpiSummaryItem[]
}) {
  return (
    <WidgetFrame
      editMode={editMode}
      handleEnabled={false}
      hideHeader
      placeholder={items.length === 0}
      className="bg-[linear-gradient(180deg,rgba(45,106,79,0.06),rgba(255,255,255,0))]"
    >
      {items.length === 1 ? (
        <div className="rounded-2xl border border-[var(--agri-border)] bg-[var(--agri-surface)] px-6 py-5">
          <div className="truncate text-xs font-semibold uppercase tracking-wide text-[var(--agri-text-muted)]">
            {items[0].label}
          </div>
          <div
            className={cn(
              'mt-2 text-[clamp(2rem,6vw,2.5rem)] font-bold leading-none',
              items[0].tone === 'positive'
                ? 'text-[var(--value-positive)]'
                : items[0].tone === 'negative'
                  ? 'text-[var(--value-negative)]'
                  : 'text-[var(--agri-text)]'
            )}
          >
            {items[0].value}
          </div>
          <div className="mt-2 text-xs text-[var(--agri-text-muted)]">{items[0].meta}</div>
          {items[0].trendLabel ? (
            <div className="mt-1 truncate text-xs font-semibold text-[var(--agri-primary)]">{items[0].trendLabel}</div>
          ) : null}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {items.map((item) => (
            <div
              key={item.id}
              className="rounded-2xl border border-[var(--agri-border)] bg-[var(--agri-surface)] px-4 py-4"
            >
              <div className="truncate text-xs font-semibold uppercase tracking-wide text-[var(--agri-text-muted)]">
                {item.label}
              </div>
              <div
                className={cn(
                  'mt-2 whitespace-nowrap text-[clamp(1.35rem,3vw,1.75rem)] font-bold leading-none',
                  item.tone === 'positive'
                    ? 'text-[var(--value-positive)]'
                    : item.tone === 'negative'
                      ? 'text-[var(--value-negative)]'
                      : 'text-[var(--agri-text)]'
                )}
              >
                {item.value}
              </div>
              <div className="mt-2 text-xs text-[var(--agri-text-muted)]">{item.meta}</div>
              {item.trendLabel ? (
                <div className="mt-1 truncate text-xs font-semibold text-[var(--agri-primary)]">{item.trendLabel}</div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </WidgetFrame>
  )
}

type RecentOrderItem = {
  id: string
  client: string
  status: string
  quantity: string
  deliveryDate: string
}

export function ComenziRecenteWidget({
  editMode,
  items,
  empty,
  onDisable,
}: {
  editMode: boolean
  items: RecentOrderItem[]
  empty: boolean
  onDisable?: () => void
}) {
  return (
    <WidgetFrame
      title="Comenzi Recente"
      editMode={editMode}
      onDisable={onDisable}
      placeholder={empty}
      footer={
        <Button asChild size="sm" variant="outline">
          <Link href="/comenzi">Vezi toate comenzile</Link>
        </Button>
      }
    >
      <div className="space-y-3">
        {items.map((item) => (
          <div
            key={item.id}
            className="rounded-2xl border border-[var(--agri-border)] bg-[var(--agri-surface-muted)]/35 px-4 py-3"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-[var(--agri-text)]">{item.client}</div>
                <div className="mt-1 text-xs text-[var(--agri-text-muted)]">
                  {item.quantity} · {item.deliveryDate}
                </div>
              </div>
              <span className="rounded-full border border-[var(--agri-border)] bg-[var(--agri-surface)] px-2.5 py-1 text-[11px] font-semibold text-[var(--agri-text-muted)]">
                {item.status}
              </span>
            </div>
          </div>
        ))}
      </div>
    </WidgetFrame>
  )
}

type PlannedActivityItem = {
  id: string
  title: string
  parcela: string
  date: string
  detail: string
}

export function ActivitatiPlanificateWidget({
  editMode,
  items,
  empty,
  onDisable,
}: {
  editMode: boolean
  items: PlannedActivityItem[]
  empty: boolean
  onDisable?: () => void
}) {
  return (
    <WidgetFrame
      title="Activități Planificate"
      editMode={editMode}
      onDisable={onDisable}
      placeholder={empty}
      footer={
        <Button asChild size="sm" variant="outline">
          <Link href="/activitati-agricole">Vezi activitățile</Link>
        </Button>
      }
    >
      <div className="space-y-3">
        {items.map((item) => (
          <div
            key={item.id}
            className="rounded-2xl border border-[var(--agri-border)] bg-[var(--surface-card)] pl-3 pr-4 py-3 border-l-4 border-l-amber-500"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-[var(--agri-text)]">{item.title}</div>
                <div className="mt-1 text-xs text-[var(--agri-text-muted)]">{item.parcela}</div>
                <div className="mt-2 text-xs font-medium text-[var(--agri-text-muted)]">{item.detail}</div>
              </div>
              <div className="rounded-xl border border-[var(--agri-border)] bg-[var(--agri-surface-muted)] px-2.5 py-1 text-[11px] font-semibold text-[var(--agri-text-muted)]">
                {item.date}
              </div>
            </div>
          </div>
        ))}
      </div>
    </WidgetFrame>
  )
}

type RecentHarvestItem = {
  id: string
  parcela: string
  quantity: string
  timestamp: string
}

export function RecoltariRecenteWidget({
  editMode,
  items,
  empty,
  onDisable,
}: {
  editMode: boolean
  items: RecentHarvestItem[]
  empty: boolean
  onDisable?: () => void
}) {
  return (
    <WidgetFrame
      title="Recoltări Recente"
      editMode={editMode}
      onDisable={onDisable}
      placeholder={empty}
      footer={
        <Button asChild size="sm" variant="outline">
          <Link href="/recoltari">Vezi recoltările</Link>
        </Button>
      }
    >
      <div className="space-y-3">
        {items.map((item) => (
          <div
            key={item.id}
            className="rounded-2xl border border-[var(--agri-border)] bg-[var(--surface-card)] pl-3 pr-4 py-3 border-l-4 border-l-green-500"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-[var(--agri-text)]">{item.parcela}</div>
                <div className="mt-1 text-xs text-[var(--agri-text-muted)]">{item.timestamp}</div>
              </div>
              <div className="text-right">
                <div className="text-sm font-bold text-[var(--value-positive)]">{item.quantity}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </WidgetFrame>
  )
}

type CriticalStockItem = {
  id: string
  produs: string
  locatie: string
  quantity: string
  severity: 'warning' | 'critical'
}

export function StocuriCriticeWidget({
  editMode,
  items,
  empty,
  onDisable,
}: {
  editMode: boolean
  items: CriticalStockItem[]
  empty: boolean
  onDisable?: () => void
}) {
  return (
    <WidgetFrame
      title="Stocuri Critice"
      editMode={editMode}
      onDisable={onDisable}
      placeholder={empty}
      footer={
        <Button asChild size="sm" variant="outline">
          <Link href="/stocuri">Vezi stocurile</Link>
        </Button>
      }
    >
      <div className="space-y-3">
        {items.map((item) => {
          const critical = item.severity === 'critical'
          return (
            <div
              key={item.id}
              className={cn(
                'rounded-2xl border border-[var(--agri-border)] bg-[var(--surface-card)] pl-3 pr-4 py-3 border-l-4',
                critical ? 'border-l-red-500' : 'border-l-amber-500'
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-[var(--agri-text)]">{item.produs}</div>
                  <div className="mt-1 text-xs text-[var(--agri-text-muted)]">{item.locatie}</div>
                </div>
                <div
                  className={cn(
                    'rounded-xl px-2.5 py-1 text-[11px] font-bold',
                    critical
                      ? 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400'
                      : 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400'
                  )}
                >
                  {item.quantity}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </WidgetFrame>
  )
}

export function SumarVenituriWidget({
  editMode,
  empty,
  total,
  previous,
  periodLabel,
  trendLabel,
  series,
  onDisable,
}: {
  editMode: boolean
  empty: boolean
  total: string
  previous: string
  periodLabel: string
  trendLabel: string | null
  series: number[]
  onDisable?: () => void
}) {
  return (
    <WidgetFrame
      title="Sumar Venituri"
      editMode={editMode}
      onDisable={onDisable}
      placeholder={empty}
      footer={
        <Button asChild size="sm" variant="outline">
          <Link href="/rapoarte">Deschide rapoarte</Link>
        </Button>
      }
    >
      <div className="flex h-full flex-col justify-between gap-4">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--agri-text-muted)]">
            {periodLabel}
          </div>
          <div className="mt-2 text-3xl font-bold text-[var(--agri-text)]">{total}</div>
          <div className="mt-2 text-xs text-[var(--agri-text-muted)]">Perioada comparată: {previous}</div>
          {trendLabel ? (
            <div className="mt-3 inline-flex items-center gap-1 rounded-full border border-[var(--agri-border)] bg-[var(--agri-surface-muted)] px-2.5 py-1 text-xs font-semibold text-[var(--agri-primary)]">
              {trendLabel.startsWith('-') ? <TrendingDown className="h-3.5 w-3.5" /> : <TrendingUp className="h-3.5 w-3.5" />}
              {trendLabel}
            </div>
          ) : null}
        </div>
        <div className="rounded-2xl border border-[var(--agri-border)] bg-[var(--agri-surface-muted)]/40 px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-[var(--agri-text)]">Trend venituri</div>
              <div className="mt-1 text-xs text-[var(--agri-text-muted)]">Ultimele 8 săptămâni</div>
            </div>
            <Sparkline values={series} className="h-10 w-28" height={32} strokeClassName="stroke-[var(--agri-primary)]" />
          </div>
        </div>
      </div>
    </WidgetFrame>
  )
}
