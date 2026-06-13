'use client'

import { MessageCircle, Phone } from 'lucide-react'

import { AppDatePicker } from '@/components/ui/app-date-picker'
import type { ComandaStatus } from '@/lib/supabase/queries/comenzi'
import { waUrlForPhone } from '@/lib/shop/b2c-order-helpers'
import type { ShopOrderStatus } from '@/lib/shop/b2c-order-helpers'
import type { UnifiedOrderItem } from '@/lib/comenzi/unified-orders'
import { B2B_STATUS_LABELS, SHOP_STATUS_LABELS } from '@/lib/comenzi/unified-orders'

const SHOP_STATUS_OPTIONS: ShopOrderStatus[] = [
  'noua',
  'confirmata',
  'in_livrare',
  'livrata',
  'anulata',
]

const B2B_STATUS_OPTIONS = Object.keys(B2B_STATUS_LABELS) as ComandaStatus[]

function OriginBadge({ source }: { source: UnifiedOrderItem['source'] }) {
  if (source === 'shop') {
    return (
      <span
        className="inline-flex shrink-0 items-center rounded-full px-2 py-[3px] text-[11px] font-semibold leading-none"
        style={{ background: '#EEEAFE', color: '#5B4FCF' }}
      >
        🛒 Shop
      </span>
    )
  }
  return (
    <span
      className="inline-flex shrink-0 items-center rounded-full px-2 py-[3px] text-[11px] font-semibold leading-none"
      style={{ background: '#F1EFE8', color: '#5F5E5A' }}
    >
      ✏️ Manual
    </span>
  )
}

function StatusPill({ label }: { label: string }) {
  return (
    <span className="inline-flex shrink-0 rounded-full border border-[var(--border-default)] bg-[var(--surface-card-muted)] px-2 py-[3px] text-[11px] font-semibold leading-none text-[var(--text-secondary)]">
      {label}
    </span>
  )
}

function MilestoneRewardBadge({
  rewardLabel,
  status,
}: {
  rewardLabel: string
  status: 'pending' | 'validated'
}) {
  const statusLabel = status === 'validated' ? 'Bonus validat' : 'Bonus la livrare'

  return (
    <div
      className="mt-2 inline-flex max-w-full flex-col rounded-xl border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] px-2.5 py-1.5 text-[var(--status-warning-text)]"
      title={statusLabel}
    >
      <span className="truncate text-xs font-bold">🎁 {rewardLabel}</span>
      <span className="text-[10px] font-semibold opacity-80">{statusLabel}</span>
    </div>
  )
}

export function UnifiedOrderCard({
  item,
  disabled,
  onOpenB2bDetails,
  onB2bStatusChange,
  onShopStatusChange,
  onShopConfirmedChange,
  onShopDeliveryDateChange,
}: {
  item: UnifiedOrderItem
  disabled?: boolean
  onOpenB2bDetails?: (id: string) => void
  onB2bStatusChange?: (id: string, status: ComandaStatus) => void
  onShopStatusChange?: (id: string, status: ShopOrderStatus) => void
  onShopConfirmedChange?: (id: string, confirmed: boolean) => void
  onShopDeliveryDateChange?: (id: string, deliveryDate: string | null) => void
}) {
  const phoneHref = item.phone ? `tel:${item.phone.replace(/\s/g, '')}` : undefined
  const waHref = item.phone ? waUrlForPhone(item.phone) : undefined
  const totalFormatted = new Intl.NumberFormat('ro-RO', { maximumFractionDigits: 0 }).format(
    Math.round(item.totalLei),
  )
  const milestoneReward = item.shopOrder?.milestone_reward

  return (
    <article className="rounded-2xl border border-[var(--border-default)] bg-[var(--surface-card)] p-3 shadow-[var(--shadow-soft)]">
      <div className="flex items-start justify-between gap-2">
        <button
          type="button"
          className="min-w-0 flex-1 text-left"
          onClick={() => {
            if (item.source === 'b2b' && item.b2bComanda) onOpenB2bDetails?.(item.b2bComanda.id)
          }}
        >
          <p className="truncate text-[15px] font-bold leading-tight text-[var(--text-primary)]">
            {item.customerName}
          </p>
        </button>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
          <OriginBadge source={item.source} />
          <StatusPill label={item.statusLabel} />
        </div>
      </div>

      {milestoneReward ? (
        <MilestoneRewardBadge
          rewardLabel={milestoneReward.reward_label}
          status={milestoneReward.status}
        />
      ) : null}

      {phoneHref ? (
        <a
          href={phoneHref}
          className="mt-1 inline-flex min-h-[44px] items-center gap-1.5 text-[14px] font-medium text-[var(--info-text)]"
        >
          <Phone className="h-4 w-4 shrink-0" aria-hidden />
          {item.phone}
        </a>
      ) : null}

      <p className="mt-1 line-clamp-2 text-[13px] leading-snug text-[var(--text-secondary)]">
        {item.productsLabel}
      </p>

      <p className="mt-1.5 text-[14px] leading-snug text-[var(--text-primary)]">
        <span className="font-bold text-[#F16B6B]">{totalFormatted} lei</span>
        <span className="text-[var(--text-tertiary)]"> · </span>
        <span>{item.deliveryLabel}</span>
        <span className="text-[var(--text-tertiary)]"> · </span>
        <span className="text-[var(--text-secondary)]">{item.addressShort}</span>
      </p>
      {item.source === 'shop' && item.shopOrder?.delivery_date ? (
        <p className="mt-1 text-xs font-medium text-[var(--text-secondary)]">
          Livrat preferabil: {formatOrderDateShort(item.shopOrder.delivery_date)}
        </p>
      ) : null}

      <p className="mt-1 text-xs text-[var(--text-tertiary)]">
        {new Intl.DateTimeFormat('ro-RO', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          timeZone: 'Europe/Bucharest',
        }).format(new Date(item.createdAt))}
      </p>

      <div className="mt-3 flex flex-col gap-2">
        {item.source === 'shop' &&
        item.shopOrder?.order_kind === 'preorder' &&
        onShopDeliveryDateChange ? (
          <div className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-card-muted)] p-2.5">
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <p className="text-xs font-semibold text-[var(--text-secondary)]">Data livrării</p>
              {item.shopOrder.delivery_date ? (
                <button
                  type="button"
                  aria-label={`Șterge data livrării pentru ${item.customerName}`}
                  disabled={disabled}
                  onClick={() => onShopDeliveryDateChange(item.id, null)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full text-lg text-[var(--text-tertiary)] transition active:scale-[0.98] disabled:opacity-50"
                >
                  ×
                </button>
              ) : null}
            </div>
            <AppDatePicker
              id={`shop-delivery-date-${item.id}`}
              placeholder="Setează data"
              value={item.shopOrder.delivery_date ?? ''}
              disabled={disabled}
              triggerClassName="h-11 bg-[var(--surface-card)] text-sm"
              onChange={(value) => onShopDeliveryDateChange(item.id, value)}
            />
          </div>
        ) : null}

        {waHref ? (
          <a
            href={waHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full bg-[#25D366] px-4 text-[14px] font-bold text-white transition active:scale-[0.98]"
          >
            <MessageCircle className="h-4 w-4" aria-hidden />
            WhatsApp
          </a>
        ) : null}

        <div className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-card-muted)] p-2.5">
          <p className="mb-1.5 text-xs font-semibold text-[var(--text-secondary)]">Status</p>
          {item.source === 'shop' ? (
            <>
              <select
                value={item.status}
                disabled={disabled}
                onChange={(e) => onShopStatusChange?.(item.id, e.target.value as ShopOrderStatus)}
                className="min-h-11 w-full rounded-xl border border-[var(--border-default)] bg-[var(--surface-card)] px-3 text-[14px] font-medium"
                aria-label="Schimbă statusul comenzii"
              >
                {SHOP_STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {SHOP_STATUS_LABELS[status]}
                  </option>
                ))}
              </select>
              <label className="mt-1 flex min-h-11 cursor-pointer items-center gap-2 text-[14px] font-medium text-[var(--text-secondary)]">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-[var(--border-default)]"
                  checked={item.confirmed}
                  disabled={disabled}
                  onChange={(e) => onShopConfirmedChange?.(item.id, e.target.checked)}
                />
                Confirmat
              </label>
            </>
          ) : (
            <select
              value={item.status}
              disabled={disabled}
              onChange={(e) => onB2bStatusChange?.(item.id, e.target.value as ComandaStatus)}
              className="min-h-11 w-full rounded-xl border border-[var(--border-default)] bg-[var(--surface-card)] px-3 text-[14px] font-medium"
              aria-label="Schimbă statusul comenzii"
            >
              {B2B_STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {B2B_STATUS_LABELS[status]}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>
    </article>
  )
}

function formatOrderDateShort(value: string): string {
  return new Intl.DateTimeFormat('ro-RO', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(new Date(`${value}T12:00:00.000Z`))
}
