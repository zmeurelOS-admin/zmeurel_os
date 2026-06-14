'use client'

import { useState } from 'react'
import { ChevronDown, Phone } from 'lucide-react'

import { AppDatePicker } from '@/components/ui/app-date-picker'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import type { ComandaStatus } from '@/lib/supabase/queries/comenzi'
import { waUrlForPhone } from '@/lib/shop/b2c-order-helpers'
import type { ShopOrderStatus } from '@/lib/shop/b2c-order-helpers'
import type { UnifiedOrderItem } from '@/lib/comenzi/unified-orders'
import {
  B2B_STATUS_LABELS,
  getShopOrderQuantity,
  SHOP_STATUS_LABELS,
} from '@/lib/comenzi/unified-orders'

const B2B_STATUS_OPTIONS = Object.keys(B2B_STATUS_LABELS) as ComandaStatus[]

const SHOP_STATUS_TRANSITIONS: Record<ShopOrderStatus, ShopOrderStatus[]> = {
  noua: ['confirmata', 'anulata'],
  confirmata: ['in_livrare', 'anulata'],
  in_livrare: ['livrata'],
  livrata: [],
  anulata: [],
}

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

function ShopStatusPill({ status }: { status: ShopOrderStatus }) {
  const toneClass =
    status === 'livrata'
      ? 'border-[var(--status-success-border)] bg-[var(--status-success-bg)] text-[var(--status-success-text)]'
      : status === 'anulata'
        ? 'border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] text-[var(--status-danger-text)]'
        : status === 'in_livrare'
          ? 'border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] text-[var(--status-warning-text)]'
          : 'border-[var(--border-default)] bg-[var(--surface-card-muted)] text-[var(--text-secondary)]'

  return (
    <span
      className={`inline-flex shrink-0 rounded-full border px-2 py-[3px] text-[11px] font-semibold leading-none ${toneClass}`}
    >
      {SHOP_STATUS_LABELS[status]}
    </span>
  )
}

function ConfirmationBadge() {
  return (
    <span
      className="inline-flex shrink-0 items-center rounded-full border px-2 py-[3px] text-[11px] font-semibold leading-none"
      style={{ background: '#FFF8EC', color: '#854F0B', borderColor: '#FAC775' }}
    >
      ⏳ Necesită confirmare
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
  onShopNotifiedChange,
}: {
  item: UnifiedOrderItem
  disabled?: boolean
  onOpenB2bDetails?: (id: string) => void
  onB2bStatusChange?: (id: string, status: ComandaStatus) => void
  onShopStatusChange?: (id: string, status: ShopOrderStatus) => void
  onShopConfirmedChange?: (id: string, confirmed: boolean) => void
  onShopDeliveryDateChange?: (id: string, deliveryDate: string | null) => void
  onShopNotifiedChange?: (id: string, notified: boolean) => void
}) {
  if (item.source === 'shop' && item.shopOrder) {
    return (
      <MobileShopOrderCard
        item={item}
        disabled={disabled}
        onShopStatusChange={onShopStatusChange}
        onShopConfirmedChange={onShopConfirmedChange}
        onShopDeliveryDateChange={onShopDeliveryDateChange}
        onShopNotifiedChange={onShopNotifiedChange}
      />
    )
  }

  const phoneHref = item.phone ? `tel:${item.phone.replace(/\s/g, '')}` : undefined
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
        <div className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-card-muted)] p-2.5">
          <p className="mb-1.5 text-xs font-semibold text-[var(--text-secondary)]">Status</p>
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
        </div>
      </div>
    </article>
  )
}

function MobileShopOrderCard({
  item,
  disabled,
  onShopStatusChange,
  onShopConfirmedChange,
  onShopDeliveryDateChange,
  onShopNotifiedChange,
}: {
  item: UnifiedOrderItem
  disabled?: boolean
  onShopStatusChange?: (id: string, status: ShopOrderStatus) => void
  onShopConfirmedChange?: (id: string, confirmed: boolean) => void
  onShopDeliveryDateChange?: (id: string, deliveryDate: string | null) => void
  onShopNotifiedChange?: (id: string, notified: boolean) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [statusMenuOpen, setStatusMenuOpen] = useState(false)
  const order = item.shopOrder!
  const status = order.status
  const statusTransitions = SHOP_STATUS_TRANSITIONS[status]
  const isTerminal = status === 'livrata' || status === 'anulata'
  const quantity = getShopOrderQuantity(order)
  const totalFormatted = new Intl.NumberFormat('ro-RO', {
    maximumFractionDigits: 0,
  }).format(Math.round(item.totalLei))
  const phoneHref = item.phone ? `tel:${item.phone.replace(/\s/g, '')}` : undefined
  const orderTime = new Intl.DateTimeFormat('ro-RO', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Bucharest',
  }).format(new Date(item.createdAt))
  const orderDateLong = new Intl.DateTimeFormat('ro-RO', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Europe/Bucharest',
  }).format(new Date(item.createdAt))
  const cityLabel = order.delivery_city?.trim() || item.addressShort || item.deliveryLabel
  const fullAddress = [order.delivery_address?.trim(), order.delivery_city?.trim()]
    .filter(Boolean)
    .join(', ')
  const needsConfirmation = order.needs_confirmation ?? order.delivery_zone === 'zona4'
  const cardBorderLeft =
    needsConfirmation && status === 'noua' ? 'border-l-[3px] border-l-[#E8A020]' : ''
  const cardTone =
    status === 'in_livrare'
      ? 'border-[var(--status-warning-border)]'
      : status === 'livrata'
        ? 'border-[var(--status-success-border)] opacity-80'
        : status === 'anulata'
          ? 'border-[var(--border-default)] opacity-50'
          : 'border-[var(--border-default)]'

  const markNotified = () => {
    if (!order.notified_wa) {
      onShopNotifiedChange?.(item.id, true)
    }
  }

  const handleStatusChange = (nextStatus: ShopOrderStatus) => {
    setStatusMenuOpen(false)

    if (nextStatus === 'confirmata') {
      const firstName = item.customerName.trim().split(/\s+/)[0] || item.customerName.trim()
      const message = `Bună ziua, ${firstName}! 🍓

Am primit comanda dvs. din ${orderDateLong} — *${quantity} caserole zmeură proaspătă* (${totalFormatted} lei).

Vă vom livra în cel mai scurt timp și veți primi un mesaj în ziua livrării cu detaliile.

Mulțumim că ați ales Ferma Zmeurel! 🌿`
      const whatsappUrl = `${waUrlForPhone(item.phone)}?text=${encodeURIComponent(message)}`
      window.open(whatsappUrl, '_blank', 'noopener,noreferrer')
      markNotified()
    }

    if (nextStatus === 'in_livrare') {
      const firstName = item.customerName.trim().split(/\s+/)[0] || item.customerName.trim()
      const deliveryAddress = fullAddress || item.addressShort || 'adresa comunicată'
      const message = `Bună ziua, ${firstName}! 🍓

Comanda dvs. de *${quantity} ${quantity === 1 ? 'caserolă' : 'caserole'} zmeură* (${totalFormatted} lei)
plasată pe ${orderDateLong} va fi livrată astăzi la adresa: ${deliveryAddress}.

Veți fi sunat cu puțin timp înainte de sosire.

Dacă doriți să modificați cantitatea, adresa sau alt detaliu, răspundeți la acest mesaj.

Mulțumim! — Ferma Zmeurel 🌿`
      const whatsappUrl = `${waUrlForPhone(item.phone)}?text=${encodeURIComponent(message)}`
      window.open(whatsappUrl, '_blank', 'noopener,noreferrer')
      markNotified()
    }

    onShopStatusChange?.(item.id, nextStatus)
  }

  const handleZona4WhatsApp = () => {
    const firstName = item.customerName.trim().split(/\s+/)[0] || item.customerName.trim()
    const deliveryCity = order.delivery_city?.trim() || 'localitatea dvs.'
    const message = `Bună ziua, ${firstName}! 🍓

Am primit comanda dvs. din ${orderDateLong} —
*${quantity} caserole zmeură proaspătă* (${totalFormatted} lei)
cu livrare în ${deliveryCity}.

Ne bucurăm că doriți să comandați! Întrucât livrăm periodic
în zona dvs., vă contactăm pentru a stabili împreună
locul și data livrării.

Vă mulțumim! — Ferma Zmeurel 🌿`
    const whatsappUrl = `${waUrlForPhone(item.phone)}?text=${encodeURIComponent(message)}`
    window.open(whatsappUrl, '_blank', 'noopener,noreferrer')
    markNotified()
  }

  return (
    <article
      className={`overflow-hidden rounded-2xl border bg-[var(--surface-card)] shadow-[var(--shadow-soft)] ${cardTone} ${cardBorderLeft}`}
    >
      <div className="px-3 py-3">
        <button
          type="button"
          aria-expanded={expanded}
          aria-label={`${expanded ? 'Ascunde' : 'Arată'} detaliile comenzii pentru ${item.customerName}`}
          onClick={() => setExpanded((current) => !current)}
          className="flex w-full items-start justify-between gap-2 rounded-lg text-left outline-none transition active:bg-[var(--surface-card-muted)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
        >
          <p className="min-w-0 flex-1 truncate text-[15px] font-bold leading-tight text-[var(--text-primary)]">
            {item.customerName}
          </p>
          <div className="flex shrink-0 items-center gap-1.5">
            <OriginBadge source="shop" />
            {needsConfirmation ? <ConfirmationBadge /> : null}
            <span className="text-[11px] font-medium text-[var(--text-tertiary)]">{orderTime}</span>
          </div>
        </button>

        <div className="mt-1 flex items-center justify-between gap-2">
          {phoneHref ? (
            <a
              href={phoneHref}
              className="inline-flex min-h-8 min-w-0 items-center gap-1.5 text-[13px] font-medium text-[var(--info-text)]"
            >
              <Phone className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span className="truncate">{item.phone}</span>
            </a>
          ) : (
            <span />
          )}
          <ShopStatusPill status={status} />
        </div>

        <button
          type="button"
          aria-label={`${expanded ? 'Ascunde' : 'Arată'} rezumatul comenzii pentru ${item.customerName}`}
          onClick={() => setExpanded((current) => !current)}
          className="mt-2 w-full border-t border-[var(--divider)] pt-2 text-left text-[13px] font-semibold text-[var(--text-primary)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
        >
          <span>
            {quantity} {quantity === 1 ? 'caserolă' : 'caserole'} · {totalFormatted} lei
          </span>
          <span className="text-[var(--text-tertiary)]"> · </span>
          <span className="font-medium text-[var(--text-secondary)]">📍 {cityLabel}</span>
          {order.delivery_date ? (
            <>
              <span className="text-[var(--text-tertiary)]"> · </span>
              <span className="font-medium text-[var(--text-secondary)]">
                📅 {formatOrderDateShort(order.delivery_date)}
              </span>
            </>
          ) : null}
        </button>
      </div>

      <div
        aria-hidden={!expanded}
        className={`grid transition-[grid-template-rows,opacity] duration-200 ${
          expanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
        }`}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="space-y-2 border-t border-[var(--divider)] px-3 py-3 text-[13px]">
            <div>
              <p className="text-xs font-semibold text-[var(--text-tertiary)]">Adresă</p>
              <p className="mt-0.5 text-[var(--text-primary)]">{fullAddress || '—'}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-[var(--text-tertiary)]">Produse</p>
              <p className="mt-0.5 text-[var(--text-secondary)]">{item.productsLabel}</p>
            </div>
            {order.delivery_date ? (
              <p className="font-medium text-[var(--text-secondary)]">
                Livrat preferabil: {formatOrderDateShort(order.delivery_date)}
              </p>
            ) : null}
            {order.milestone_reward ? (
              <MilestoneRewardBadge
                rewardLabel={order.milestone_reward.reward_label}
                status={order.milestone_reward.status}
              />
            ) : null}
          </div>
        </div>
      </div>

      {!isTerminal ? (
        <div className="grid grid-cols-2 gap-2 border-t border-[var(--divider)] px-3 py-3">
          {order.order_kind === 'preorder' && onShopDeliveryDateChange ? (
            <div className="min-w-0">
              <AppDatePicker
                id={`shop-mobile-delivery-date-${item.id}`}
                placeholder="Setează data"
                value={order.delivery_date ?? ''}
                disabled={disabled}
                triggerClassName="h-11 bg-[var(--surface-card)] px-2 text-xs"
                onChange={(value) => onShopDeliveryDateChange(item.id, value)}
              />
              {order.delivery_date ? (
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onShopDeliveryDateChange(item.id, null)}
                  className="mt-1 min-h-8 w-full text-xs font-medium text-[var(--text-tertiary)]"
                >
                  Șterge data
                </button>
              ) : null}
            </div>
          ) : (
            <div />
          )}

          <Popover open={statusMenuOpen} onOpenChange={setStatusMenuOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                disabled={disabled || statusTransitions.length === 0}
                className="flex h-11 min-w-0 items-center justify-between gap-2 rounded-xl border border-[var(--border-default)] bg-[var(--surface-card)] px-3 text-left text-xs font-semibold text-[var(--text-primary)] disabled:opacity-50"
                aria-label="Schimbă statusul comenzii"
              >
                <span className="truncate">{SHOP_STATUS_LABELS[status]}</span>
                <ChevronDown className="h-4 w-4 shrink-0 text-[var(--text-tertiary)]" aria-hidden />
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-52 p-2">
              <p className="px-2 pb-1.5 text-xs font-semibold text-[var(--text-tertiary)]">
                Schimbă statusul
              </p>
              <div className="space-y-1">
                {statusTransitions.map((nextStatus) => (
                  <button
                    key={nextStatus}
                    type="button"
                    onClick={() => handleStatusChange(nextStatus)}
                    className="flex min-h-11 w-full items-center rounded-lg px-3 text-left text-sm font-semibold text-[var(--text-primary)] transition hover:bg-[var(--surface-card-muted)] active:scale-[0.985]"
                  >
                    {SHOP_STATUS_LABELS[nextStatus]}
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        </div>
      ) : null}

      {needsConfirmation && status === 'noua' ? (
        <div className="border-t border-[var(--divider)] px-3 py-2.5">
          <button
            type="button"
            disabled={disabled}
            onClick={handleZona4WhatsApp}
            className="flex min-h-10 w-full items-center justify-center gap-2 rounded-full bg-[#25D366] px-4 text-[13px] font-bold text-white transition active:scale-[0.98] disabled:opacity-50"
          >
            💬 Stabilește livrare (WhatsApp)
          </button>
        </div>
      ) : null}

      <div className="flex min-h-10 items-center border-t border-[var(--divider)] px-3 py-2">
        {order.notified_wa ? (
          <p className="text-xs font-semibold text-[#3D7A5F]">✓ Anunțat WA</p>
        ) : (
          <label className="flex cursor-pointer items-center gap-2 text-[13px] font-medium text-[var(--text-secondary)]">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-[var(--border-default)]"
              checked={item.confirmed}
              disabled={disabled}
              onChange={(event) => onShopConfirmedChange?.(item.id, event.target.checked)}
            />
            WhatsApp trimis
          </label>
        )}
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
