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
    <div className="flex min-h-[120px] flex-col items-center justify-center gap-2 px-2 py-6 text-center">
      <Sparkles className="h-5 w-5 text-[var(--text-tertiary)]" />
      <div className="text-[14px] font-semibold leading-5 text-[var(--text-primary)]">Nicio dată disponibilă</div>
      <div className="max-w-xs text-[12px] leading-5 text-[var(--text-secondary)]">
        Widget-ul rămâne disponibil în layout și se va popula automat când apar date noi.
      </div>
    </div>
  )
}

function orderStatusToneClass(status: string): string {
  const normalized = status.trim().toLowerCase()
  if (normalized.includes('anulat')) return 'text-[var(--status-danger-text)]'
  if (normalized.includes('livrat')) return 'text-[var(--status-success-text)]'
  if (normalized.includes('confirm') || normalized.includes('program') || normalized.includes('livrare')) {
    return 'text-[var(--status-warning-text)]'
  }
  return 'text-[var(--text-secondary)]'
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
        'dashboard-widget-frame flex h-full flex-col overflow-hidden p-0',
        editMode ? 'border-dashed border-[color:color-mix(in_srgb,var(--focus-ring)_45%,var(--border-default))] bg-[var(--surface-card)]' : '',
        className
      )}
    >
      {!hideHeader ? (
        <div className="flex items-start justify-between gap-3 px-[18px] pb-2 pt-3.5">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              {editMode && handleEnabled ? (
                <span
                  className="dashboard-widget-handle inline-flex cursor-grab items-center text-[var(--text-tertiary)] active:cursor-grabbing"
                  aria-hidden
                >
                  <GripVertical className="h-3.5 w-3.5" />
                </span>
              ) : null}
              {title ? (
                <h3 className="truncate text-[1.02rem] leading-tight tracking-[-0.03em] text-[var(--text-primary)] [font-weight:750]">
                  {title}
                </h3>
              ) : null}
            </div>
            {description ? (
              <p className="mt-1 text-[12px] font-normal leading-5 tracking-[-0.01em] text-[var(--text-secondary)]">
                {description}
              </p>
            ) : null}
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

      <div className={cn('flex flex-1 flex-col px-[18px] pb-4', hideHeader ? 'pt-0' : 'pt-2')}>
        {placeholder ? <WidgetPlaceholder /> : children}
      </div>

      {footer ? (
        <div className="border-t border-[var(--divider)] px-[18px] py-3">{footer}</div>
      ) : null}
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
      className="dashboard-kpi-summary-widget bg-[var(--surface-card)]"
    >
      <div className="flex flex-col gap-3.5 pt-2">
        {items.map((item) => (
          <div key={item.id} className="space-y-1">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[13px] leading-5 text-[var(--text-secondary)]">{item.label}</span>
              <span
                className={cn(
                  'shrink-0 text-[1.05rem] font-semibold tabular-nums tracking-[-0.03em]',
                  item.tone === 'positive'
                    ? 'text-[var(--success-text)]'
                    : item.tone === 'negative'
                      ? 'text-[var(--danger-text)]'
                      : 'text-[var(--text-primary)]'
                )}
              >
                {item.value}
              </span>
            </div>
            {item.meta ? (
              <div className="text-[12px] leading-5 text-[var(--text-secondary)]">{item.meta}</div>
            ) : null}
            {item.trendLabel ? (
              <div className="text-[12px] font-medium text-[var(--info-text)]">{item.trendLabel}</div>
            ) : null}
          </div>
        ))}
      </div>
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
      <div className="flex flex-col gap-3.5">
        {items.map((item) => (
          <div key={item.id} className="space-y-1">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 truncate text-[14px] leading-5 text-[var(--text-primary)] [font-weight:650]">
                {item.client}
              </div>
              <span className={cn('shrink-0 text-[12px] leading-5', orderStatusToneClass(item.status))}>
                {item.status}
              </span>
            </div>
            <div className="text-[12px] leading-5 text-[var(--text-secondary)]">
              {item.quantity} · {item.deliveryDate}
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
      <div className="flex flex-col gap-3.5">
        {items.map((item) => (
          <div key={item.id} className="space-y-1">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-[14px] leading-5 text-[var(--text-primary)] [font-weight:650]">{item.title}</div>
                <div className="mt-0.5 text-[12px] leading-5 text-[var(--text-secondary)]">{item.parcela}</div>
              </div>
              <span className="shrink-0 text-[12px] leading-5 text-[var(--text-secondary)]">{item.date}</span>
            </div>
            <div className="text-[12px] font-medium leading-5 text-[var(--text-secondary)]">{item.detail}</div>
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
      <div className="flex flex-col gap-3.5">
        {items.map((item) => (
          <div key={item.id} className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate text-[14px] leading-5 text-[var(--text-primary)] [font-weight:650]">{item.parcela}</div>
              <div className="mt-0.5 text-[12px] leading-5 text-[var(--text-secondary)]">{item.timestamp}</div>
            </div>
            <div className="shrink-0 text-[13px] font-semibold tabular-nums text-[var(--success-text)]">
              {item.quantity}
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
      <div className="flex flex-col gap-3.5">
        {items.map((item) => {
          const critical = item.severity === 'critical'
          return (
            <div key={item.id} className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-[14px] leading-5 text-[var(--text-primary)] [font-weight:650]">{item.produs}</div>
                <div className="mt-0.5 text-[12px] leading-5 text-[var(--text-secondary)]">{item.locatie}</div>
              </div>
              <span
                className={cn(
                  'shrink-0 text-[13px] font-semibold tabular-nums',
                  critical ? 'text-[var(--status-danger-text)]' : 'text-[var(--status-warning-text)]'
                )}
              >
                {item.quantity}
              </span>
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
      <div className="flex h-full flex-col gap-4">
        <div className="space-y-2">
          <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--text-tertiary)]">
            {periodLabel}
          </div>
          <div className="text-[1.35rem] font-bold leading-tight tracking-[-0.03em] text-[var(--text-primary)] [font-weight:750]">
            {total}
          </div>
          <div className="text-[12px] leading-5 text-[var(--text-secondary)]">Perioada comparată: {previous}</div>
          {trendLabel ? (
            <div className="flex items-center gap-1.5 text-[12px] font-semibold text-[var(--info-text)]">
              {trendLabel.startsWith('-') ? <TrendingDown className="h-3.5 w-3.5 shrink-0" /> : <TrendingUp className="h-3.5 w-3.5 shrink-0" />}
              <span>{trendLabel}</span>
            </div>
          ) : null}
        </div>
        <div className="mt-auto flex flex-wrap items-end justify-between gap-3 border-t border-[var(--divider)] pt-3">
          <div>
            <div className="text-[14px] leading-tight text-[var(--text-primary)] [font-weight:650]">Trend venituri</div>
            <div className="mt-0.5 text-[12px] leading-5 text-[var(--text-secondary)]">Ultimele 8 săptămâni</div>
          </div>
          <Sparkline values={series} className="h-10 w-28" height={32} strokeClassName="stroke-[var(--info-text)]" />
        </div>
      </div>
    </WidgetFrame>
  )
}
