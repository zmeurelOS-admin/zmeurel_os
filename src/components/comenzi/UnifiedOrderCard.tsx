'use client'

import { useState } from 'react'
import { ChevronDown, Phone } from 'lucide-react'

import { AppDatePicker } from '@/components/ui/app-date-picker'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  B2B_STATUS_TRANSITIONS,
  B2B_STATUS_LABELS,
  formatOrderDateTime,
  SHOP_STATUS_TRANSITIONS,
  SHOP_STATUS_LABELS,
  type UnifiedOrderItem,
} from '@/lib/comenzi/unified-orders'
import type { ComandaStatus } from '@/lib/supabase/queries/comenzi'
import { waUrlForPhone, type ShopOrderStatus } from '@/lib/shop/b2c-order-helpers'

function OriginBadge({ source }: { source: UnifiedOrderItem['source'] }) {
  const isShop = source === 'shop'
  return (
    <span
      className="inline-flex shrink-0 items-center rounded-full px-2 py-[3px] text-[11px] font-semibold leading-none"
      style={{
        background: isShop ? '#FFF0F0' : '#EEF4FF',
        color: isShop ? '#C85151' : '#3B7DD8',
      }}
    >
      {isShop ? 'Shop' : 'Manual'}
    </span>
  )
}

function StatusPill({ item }: { item: UnifiedOrderItem }) {
  const toneClass =
    item.status === 'livrata'
      ? 'border-[var(--status-success-border)] bg-[var(--status-success-bg)] text-[var(--status-success-text)]'
      : item.status === 'anulata'
        ? 'border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] text-[var(--status-danger-text)]'
        : item.status === 'in_livrare'
          ? 'border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] text-[var(--status-warning-text)]'
          : 'border-[var(--border-default)] bg-[var(--surface-card-muted)] text-[var(--text-secondary)]'

  return (
    <span
      className={`inline-flex shrink-0 rounded-full border px-2 py-[3px] text-[11px] font-semibold leading-none ${toneClass}`}
    >
      {item.statusLabel}
    </span>
  )
}

function ConfirmationBadge() {
  return (
    <span
      className="inline-flex shrink-0 items-center rounded-full border px-2 py-[3px] text-[11px] font-semibold leading-none"
      style={{ background: '#FFF8EC', color: '#854F0B', borderColor: '#FAC775' }}
    >
      Necesită confirmare
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
  return (
    <div className="mt-2 inline-flex max-w-full flex-col rounded-xl border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] px-2.5 py-1.5 text-[var(--status-warning-text)]">
      <span className="truncate text-xs font-bold">{rewardLabel}</span>
      <span className="text-[10px] font-semibold opacity-80">
        {status === 'validated' ? 'Bonus validat' : 'Bonus la livrare'}
      </span>
    </div>
  )
}

export function UnifiedOrderCard({
  item,
  disabled,
  compact,
  onOpenB2bDetails,
  onB2bStatusChange,
  onB2bDeliveryDateChange,
  onShopStatusChange,
  onShopConfirmedChange,
  onShopDeliveryDateChange,
  onShopNotifiedChange,
  onEdit,
}: {
  item: UnifiedOrderItem
  disabled?: boolean
  compact?: boolean
  onOpenB2bDetails?: (id: string) => void
  onB2bStatusChange?: (id: string, status: ComandaStatus) => void
  onB2bDeliveryDateChange?: (id: string, deliveryDate: string | null) => void
  onShopStatusChange?: (id: string, status: ShopOrderStatus) => void
  onShopConfirmedChange?: (id: string, confirmed: boolean) => void
  onShopDeliveryDateChange?: (id: string, deliveryDate: string | null) => void
  onShopNotifiedChange?: (id: string, notified: boolean) => void
  onEdit?: (id: string, source: 'shop' | 'manual') => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [statusMenuOpen, setStatusMenuOpen] = useState(false)
  const isShop = item.source === 'shop'
  const shopOrder = item.shopOrder
  const b2bOrder = item.b2bComanda
  const isTerminal = item.status === 'livrata' || item.status === 'anulata'
  const needsConfirmation =
    Boolean(shopOrder?.needs_confirmation ?? shopOrder?.delivery_zone === 'zona4') &&
    item.status === 'noua'
  const statusTransitions = isShop
    ? SHOP_STATUS_TRANSITIONS[item.status as ShopOrderStatus]
    : B2B_STATUS_TRANSITIONS[item.status as ComandaStatus]
  const totalFormatted = new Intl.NumberFormat('ro-RO', {
    maximumFractionDigits: 0,
  }).format(Math.round(item.totalLei))
  const quantityFormatted = new Intl.NumberFormat('ro-RO', {
    maximumFractionDigits: 2,
  }).format(item.quantity)
  const quantityLabel =
    item.quantityUnit === 'kg'
      ? `${quantityFormatted} kg`
      : `${quantityFormatted} ${item.quantity === 1 ? 'caserolă' : 'caserole'}`
  const phoneHref = item.phone ? `tel:${item.phone.replace(/\s/g, '')}` : undefined
  const fullAddress = isShop
    ? [shopOrder?.delivery_address?.trim(), shopOrder?.delivery_city?.trim()]
        .filter(Boolean)
        .join(', ')
    : b2bOrder?.locatie_livrare?.trim() || ''
  const orderDateLong = new Intl.DateTimeFormat('ro-RO', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/Bucharest',
  }).format(new Date(item.createdAt))
  const leftBorderColor = needsConfirmation
    ? '#E8A020'
    : isShop
      ? '#F16B6B'
      : '#3B7DD8'

  const markShopNotified = () => {
    if (shopOrder && !shopOrder.notified_wa) {
      onShopNotifiedChange?.(item.id, true)
    }
  }

  const openStatusWhatsApp = (nextStatus: ShopOrderStatus | ComandaStatus) => {
    if (!item.phone || (nextStatus !== 'confirmata' && nextStatus !== 'in_livrare')) return

    const firstName = item.customerName.trim().split(/\s+/)[0] || item.customerName.trim()
    const deliveryAddress = fullAddress || item.addressShort || 'adresa comunicată'
    const unitDescription =
      item.quantityUnit === 'kg'
        ? `${quantityFormatted} kg`
        : `${quantityFormatted} ${item.quantity === 1 ? 'caserolă' : 'caserole'} de zmeură`
    const message =
      nextStatus === 'confirmata'
        ? `Bună ziua, ${firstName}! 🍓\n\nAm primit comanda dvs. din ${orderDateLong}: ${unitDescription} (${totalFormatted} lei).\n\nVă vom contacta cu detaliile livrării.\n\nMulțumim că ați ales Ferma Zmeurel! 🌿`
        : `Bună ziua, ${firstName}! 🍓\n\nComanda dvs. de ${unitDescription} (${totalFormatted} lei), plasată pe ${orderDateLong}, va fi livrată la adresa: ${deliveryAddress}.\n\nVeți fi sunat cu puțin timp înainte de sosire.\n\nMulțumim! — Ferma Zmeurel 🌿`

    window.open(
      `${waUrlForPhone(item.phone)}?text=${encodeURIComponent(message)}`,
      '_blank',
      'noopener,noreferrer',
    )
    markShopNotified()
  }

  const handleStatusChange = (nextStatus: ShopOrderStatus | ComandaStatus) => {
    setStatusMenuOpen(false)
    openStatusWhatsApp(nextStatus)
    if (isShop) {
      onShopStatusChange?.(item.id, nextStatus as ShopOrderStatus)
    } else {
      onB2bStatusChange?.(item.id, nextStatus as ComandaStatus)
    }
  }

  const handleDeliveryDateChange = (value: string | null) => {
    if (isShop) {
      onShopDeliveryDateChange?.(item.id, value)
    } else {
      onB2bDeliveryDateChange?.(item.id, value)
    }
  }

  const handleZona4WhatsApp = () => {
    const firstName = item.customerName.trim().split(/\s+/)[0] || item.customerName.trim()
    const message = `Bună ziua, ${firstName}!\n\nAm primit comanda dvs. de ${quantityLabel} (${totalFormatted} lei) cu livrare în ${item.localityLabel}.\n\nVă contactăm pentru a stabili locul și data livrării.\n\nMulțumim! — Ferma Zmeurel`
    window.open(
      `${waUrlForPhone(item.phone)}?text=${encodeURIComponent(message)}`,
      '_blank',
      'noopener,noreferrer',
    )
    markShopNotified()
  }

  return (
    <article
      className={`overflow-hidden rounded-2xl border-[1.5px] bg-[var(--surface-card)] shadow-[var(--shadow-soft)] ${
        item.status === 'livrata' ? 'opacity-80' : item.status === 'anulata' ? 'opacity-50' : ''
      }`}
      style={{
        borderColor: '#E0DEE8',
        borderLeftWidth: '4px',
        borderLeftColor: leftBorderColor,
      }}
    >
      <div className={compact ? 'px-3 py-2' : 'px-3 py-3'}>
        <button
          type="button"
          aria-expanded={expanded}
          aria-label={`${expanded ? 'Ascunde' : 'Arată'} detaliile comenzii pentru ${item.customerName}`}
          onClick={() => setExpanded((current) => !current)}
          className="flex w-full items-start justify-between gap-2 rounded-lg text-left outline-none transition active:bg-[var(--surface-card-muted)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
        >
          <p
            className={`min-w-0 flex-1 truncate leading-tight text-[var(--text-primary)] ${
              compact ? 'text-[13px] font-medium' : 'text-[15px] font-bold'
            }`}
          >
            {item.customerName}
          </p>
          <div className={`flex shrink-0 items-center ${compact ? 'gap-1' : 'gap-1.5'}`}>
            <OriginBadge source={item.source} />
            {needsConfirmation ? <ConfirmationBadge /> : null}
            <span className="whitespace-nowrap text-[11px] font-medium text-[var(--text-tertiary)]">
              {formatOrderDateTime(item.createdAt)}
            </span>
          </div>
        </button>

        <div className={`flex items-center justify-between gap-2 ${compact ? 'mt-0.5' : 'mt-1'}`}>
          {phoneHref ? (
            <a
              href={phoneHref}
              className={`inline-flex min-w-0 items-center gap-1 font-medium text-[var(--info-text)] ${
                compact ? 'min-h-6 text-[12px]' : 'min-h-8 gap-1.5 text-[13px]'
              }`}
            >
              <Phone className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span className="truncate">{item.phone}</span>
            </a>
          ) : (
            <span />
          )}
          <StatusPill item={item} />
        </div>

        <button
          type="button"
          aria-label={`${expanded ? 'Ascunde' : 'Arată'} rezumatul comenzii pentru ${item.customerName}`}
          onClick={() => setExpanded((current) => !current)}
          className={`w-full border-t border-[var(--divider)] text-left font-semibold text-[var(--text-primary)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] ${
            compact ? 'mt-1.5 pt-1.5 text-[12px]' : 'mt-2 pt-2 text-[13px]'
          }`}
        >
          <span>{quantityLabel} · {totalFormatted} lei</span>
          <span className="text-[var(--text-tertiary)]"> · </span>
          <span className="font-medium text-[var(--text-secondary)]">{item.localityLabel}</span>
          {item.deliveryDate ? (
            <>
              <span className="text-[var(--text-tertiary)]"> · </span>
              <span className="font-medium text-[var(--text-secondary)]">
                {formatDeliveryDate(item.deliveryDate)}
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
            {shopOrder?.milestone_reward ? (
              <MilestoneRewardBadge
                rewardLabel={shopOrder.milestone_reward.reward_label}
                status={shopOrder.milestone_reward.status}
              />
            ) : null}
            {!isShop && onOpenB2bDetails ? (
              <button
                type="button"
                className="min-h-9 text-xs font-semibold text-[var(--primary)]"
                onClick={() => onOpenB2bDetails(item.id)}
              >
                Vezi toate detaliile
              </button>
            ) : null}
            {onEdit ? (
              <button
                type="button"
                className="min-h-9 text-xs font-semibold text-[var(--primary)]"
                onClick={() => onEdit(item.id, isShop ? 'shop' : 'manual')}
              >
                ✏ Editează
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {!isTerminal ? (
        <div
          className={`grid grid-cols-2 border-t border-[var(--divider)] px-3 ${
            compact ? 'gap-1.5 py-2' : 'gap-2 py-3'
          }`}
        >
          <div className="min-w-0">
            <AppDatePicker
              id={`unified-delivery-date-${item.source}-${item.id}`}
              placeholder="Setează data"
              value={item.deliveryDate ?? ''}
              disabled={disabled}
              triggerClassName={
                compact
                  ? 'h-8 bg-[var(--surface-card)] px-2 text-xs'
                  : 'h-11 bg-[var(--surface-card)] px-2 text-xs'
              }
              onChange={handleDeliveryDateChange}
            />
            {item.deliveryDate ? (
              <button
                type="button"
                disabled={disabled}
                onClick={() => handleDeliveryDateChange(null)}
                className={`w-full text-xs font-medium text-[var(--text-tertiary)] ${
                  compact ? 'mt-0.5 min-h-6' : 'mt-1 min-h-8'
                }`}
              >
                Șterge data
              </button>
            ) : null}
          </div>

          <Popover open={statusMenuOpen} onOpenChange={setStatusMenuOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                disabled={disabled || statusTransitions.length === 0}
                className={`flex min-w-0 items-center justify-between gap-2 rounded-xl border border-[var(--border-default)] bg-[var(--surface-card)] px-3 text-left text-xs font-semibold text-[var(--text-primary)] disabled:opacity-50 ${
                  compact ? 'h-8' : 'h-11'
                }`}
                aria-label="Schimbă statusul comenzii"
              >
                <span className="truncate">{item.statusLabel}</span>
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
                    {isShop
                      ? SHOP_STATUS_LABELS[nextStatus as ShopOrderStatus]
                      : B2B_STATUS_LABELS[nextStatus as ComandaStatus]}
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        </div>
      ) : null}

      {needsConfirmation ? (
        <div className={`border-t border-[var(--divider)] px-3 ${compact ? 'py-1.5' : 'py-2.5'}`}>
          <button
            type="button"
            disabled={disabled || !item.phone}
            onClick={handleZona4WhatsApp}
            className={`flex w-full items-center justify-center rounded-full bg-[#25D366] px-4 font-bold text-white transition active:scale-[0.98] disabled:opacity-50 ${
              compact ? 'min-h-8 text-xs' : 'min-h-10 text-[13px]'
            }`}
          >
            Stabilește livrare pe WhatsApp
          </button>
        </div>
      ) : null}

      {shopOrder ? (
        <div
          className={`flex items-center border-t border-[var(--divider)] px-3 ${
            compact ? 'min-h-8 py-1.5' : 'min-h-10 py-2'
          }`}
        >
          {shopOrder.notified_wa ? (
            <p className="text-xs font-semibold text-[var(--success-text)]">✓ Anunțat WA</p>
          ) : (
            <label
              className={`flex cursor-pointer items-center gap-2 font-medium text-[var(--text-secondary)] ${
                compact ? 'text-xs' : 'text-[13px]'
              }`}
            >
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
      ) : null}
    </article>
  )
}

function formatDeliveryDate(value: string): string {
  return new Intl.DateTimeFormat('ro-RO', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(new Date(`${value}T12:00:00.000Z`))
}
