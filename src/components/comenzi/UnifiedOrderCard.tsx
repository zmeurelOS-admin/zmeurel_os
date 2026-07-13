'use client'

import { useState } from 'react'
import { CircleDollarSign, ChevronDown, Phone } from 'lucide-react'

import { AppDatePicker } from '@/components/ui/app-date-picker'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  B2B_STATUS_TRANSITIONS,
  B2B_STATUS_LABELS,
  formatOrderDateTime,
  KG_PER_CASEROLĂ,
  SHOP_STATUS_TRANSITIONS,
  SHOP_STATUS_LABELS,
  type UnifiedOrderItem,
} from '@/lib/comenzi/unified-orders'
import type { ComandaStatus } from '@/lib/supabase/queries/comenzi'
import { waUrlForPhone, type ShopOrderStatus } from '@/lib/shop/b2c-order-helpers'

function formatKgFromGrams(grams: number): string {
  return `${new Intl.NumberFormat('ro-RO', {
    minimumFractionDigits: grams % 1000 === 0 ? 0 : grams % 500 === 0 ? 1 : 2,
    maximumFractionDigits: 2,
  }).format(grams / 1000)} kg`
}

function formatDisplayTextWithoutCaserole(value: string): string {
  return value
    .replace(/([+-]?)\s*(\d+)\s*caserol(?:ă|e)\s*(\d+)\s*g/gi, (_, prefix: string, count: string, grams: string) => {
      const totalGrams = Number(count) * Number(grams)
      return `${prefix ?? ''}${formatKgFromGrams(totalGrams)}`
    })
    .replace(/\bO caserolă bonus\b/gi, `${formatKgFromGrams(500)} bonus`)
    .replace(/\bDouă caserole bonus\b/gi, `${formatKgFromGrams(1000)} bonus`)
    .replace(/Caserolă\s*(\d+)\s*g\s*×\s*(\d+)/gi, (_, grams: string, qty: string) =>
      formatKgFromGrams(Number(grams) * Number(qty)),
    )
    .replace(/Caserolă\s*(\d+)\s*g/gi, (_, grams: string) => formatKgFromGrams(Number(grams)))
}

function OriginBadge({ item }: { item: UnifiedOrderItem }) {
  const isShop = item.source === 'shop'
  const badgeProps = isShop
    ? {
        className: 'bg-[var(--status-danger-bg)] text-[var(--status-danger-text)]',
        label: 'Shop',
      }
    : item.orderKind === 'cadou'
      ? {
          className: 'bg-[var(--status-success-bg)] text-[var(--status-success-text)]',
          label: '🎁 Cadou',
        }
      : item.orderKind === 'consum_propriu'
        ? {
            className: 'bg-[var(--status-neutral-bg)] text-[var(--status-neutral-text)]',
            label: '🏠 Consum',
          }
        : {
            className: 'bg-[var(--status-info-bg)] text-[var(--status-info-text)]',
            label: 'Manual',
          }
  return (
    <span
      className={`inline-flex max-w-full shrink-0 items-center rounded-full px-2 py-[3px] text-[11px] font-semibold leading-none ${badgeProps.className}`}
      title={badgeProps.label}
    >
      <span className="truncate">{badgeProps.label}</span>
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
      data-testid="order-status-pill"
      className={`inline-flex shrink-0 rounded-full border px-2 py-[3px] text-[11px] font-semibold leading-none ${toneClass}`}
    >
      {item.statusLabel}
    </span>
  )
}

function UnpaidBadge() {
  return (
    <span className="inline-flex shrink-0 rounded-full border border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] px-2 py-[3px] text-[11px] font-semibold leading-none text-[var(--status-danger-text)]">
      Neplătit
    </span>
  )
}

function ConfirmationBadge() {
  return (
    <span
      className="inline-flex shrink-0 items-center rounded-full border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] px-2 py-[3px] text-[11px] font-semibold leading-none text-[var(--status-warning-text)]"
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
      <span className="truncate text-xs font-bold">{formatDisplayTextWithoutCaserole(rewardLabel)}</span>
      <span className="text-[10px] font-semibold opacity-80">
        {status === 'validated' ? 'Bonus validat' : 'Bonus la livrare'}
      </span>
    </div>
  )
}

function SelectionCheckbox({
  checked,
  disabled,
  customerName,
  onCheckedChange,
}: {
  checked: boolean
  disabled?: boolean
  customerName: string
  onCheckedChange: (checked: boolean) => void
}) {
  return (
    <label
      className={`mt-0.5 inline-flex min-h-10 min-w-10 shrink-0 items-center justify-center rounded-xl border bg-[var(--surface-card)] shadow-sm ${
        disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
      }`}
      onClick={(event) => event.stopPropagation()}
    >
      <span className="sr-only">{`Selectează comanda pentru ${customerName}`}</span>
      <input
        type="checkbox"
        className="h-4 w-4 rounded border-[var(--border-default)]"
        checked={checked}
        disabled={disabled}
        aria-label={`Selectează comanda pentru ${customerName}`}
        onClick={(event) => event.stopPropagation()}
        onChange={(event) => onCheckedChange(event.target.checked)}
      />
    </label>
  )
}

export function UnifiedOrderCard({
  item,
  disabled,
  compact,
  selectable,
  selected,
  onToggleSelect,
  onOpenB2bDetails,
  onB2bStatusChange,
  onB2bDeliveryDateChange,
  onShopStatusChange,
  onShopConfirmedChange,
  onShopDeliveryDateChange,
  onShopNotifiedChange,
  onMarkPaid,
  onEdit,
  variant = 'livrari',
}: {
  item: UnifiedOrderItem
  /** În Comenzi statusul rămâne control în detalii, nu badge permanent pe card. */
  variant?: 'comenzi' | 'livrari'
  disabled?: boolean
  compact?: boolean
  selectable?: boolean
  selected?: boolean
  onToggleSelect?: (selected: boolean) => void
  onOpenB2bDetails?: (id: string) => void
  onB2bStatusChange?: (id: string, status: ComandaStatus) => void | Promise<void>
  onB2bDeliveryDateChange?: (id: string, deliveryDate: string | null) => void
  onShopStatusChange?: (id: string, status: ShopOrderStatus) => void | Promise<void>
  onShopConfirmedChange?: (id: string, confirmed: boolean) => void
  onShopDeliveryDateChange?: (id: string, deliveryDate: string | null) => void
  onShopNotifiedChange?: (id: string, notified: boolean) => void
  onMarkPaid?: (comandaId: string) => void | Promise<void>
  onEdit?: (id: string, source: 'shop' | 'manual') => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [statusMenuOpen, setStatusMenuOpen] = useState(false)
  const isShop = item.source === 'shop'
  const shopOrder = item.shopOrder
  const b2bOrder = item.b2bComanda
  // În dashboard, inclusiv comenzile Shop sunt rânduri `comenzi` bridge.
  // Păstrăm fallback-ul legacy doar pentru consumatorii non-dashboard ai cardului.
  const isCanonicalComanda = Boolean(b2bOrder)
  const isTerminal = item.status === 'livrata' || item.status === 'anulata'
  const isUnpaid =
    item.status === 'livrata' &&
    item.paymentStatus === 'neplatit' &&
    Boolean(item.paymentComandaId)
  const needsConfirmation =
    !isCanonicalComanda &&
    Boolean(shopOrder?.needs_confirmation ?? shopOrder?.delivery_zone === 'zona4') &&
    item.status === 'noua'
  const statusTransitions = isCanonicalComanda
    ? B2B_STATUS_TRANSITIONS[item.status as ComandaStatus]
    : SHOP_STATUS_TRANSITIONS[item.status as ShopOrderStatus]
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
  const kgLabel =
    item.quantityUnit === 'kg'
      ? null
      : `${(item.quantity * KG_PER_CASEROLĂ).toFixed(1)} kg`
  const displayQuantityLabel = kgLabel ?? quantityLabel
  const phoneHref = item.phone ? `tel:${item.phone.replace(/\s/g, '')}` : undefined
  const fullAddress = isCanonicalComanda
    ? b2bOrder?.locatie_livrare?.trim() || ''
    : [shopOrder?.delivery_address?.trim(), shopOrder?.delivery_city?.trim()]
        .filter(Boolean)
        .join(', ')
  const orderDateLong = new Intl.DateTimeFormat('ro-RO', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/Bucharest',
  }).format(new Date(item.createdAt))
  const leftBorderColor = needsConfirmation
    ? 'var(--indicator-confirmation)'
    : isShop
      ? 'var(--indicator-shop)'
      : item.clientTip === 'patiserie'
        ? 'var(--indicator-patiserie)'
        : item.clientTip === 'magazin'
          ? 'var(--indicator-magazin)'
          : 'var(--indicator-manual)'
  const mobileDateLabel = formatCompactDate(item.deliveryDate ?? item.createdAt)
  const blocksStatusWhatsApp =
    isCanonicalComanda &&
    (item.orderKind === 'cadou' || item.orderKind === 'consum_propriu')

  const markShopNotified = () => {
    if (shopOrder && !shopOrder.notified_wa) {
      onShopNotifiedChange?.(item.id, true)
    }
  }

  const openStatusWhatsApp = (nextStatus: ShopOrderStatus | ComandaStatus) => {
    if (blocksStatusWhatsApp) return
    if (!item.phone || (nextStatus !== 'confirmata' && nextStatus !== 'in_livrare')) return

    const firstName = item.customerName.trim().split(/\s+/)[0] || item.customerName.trim()
    const deliveryAddress = fullAddress || item.addressShort || 'adresa comunicată'
    const unitDescription =
      item.quantityUnit === 'kg'
        ? `${quantityFormatted} kg`
        : `${displayQuantityLabel} de zmeură`
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

  const handleStatusChange = async (nextStatus: ShopOrderStatus | ComandaStatus) => {
    setStatusMenuOpen(false)
    if (isCanonicalComanda) {
      try {
        await onB2bStatusChange?.(item.id, nextStatus as ComandaStatus)
        openStatusWhatsApp(nextStatus)
      } catch {
        // Eroarea este afișată în parent; WhatsApp se deschide doar după succes.
      }
    } else if (isShop) {
      try {
        await onShopStatusChange?.(item.id, nextStatus as ShopOrderStatus)
        // WB se deschide doar după confirmarea serverului
        openStatusWhatsApp(nextStatus)
      } catch {
        // eroarea e gestionată în parent via toast; nu deschidem WB
      }
    } else {
      try {
        await onB2bStatusChange?.(item.id, nextStatus as ComandaStatus)
        openStatusWhatsApp(nextStatus)
      } catch {
        // Eroarea este afișată în parent; WhatsApp se deschide doar după succes.
      }
    }
  }

  const handleDeliveryDateChange = (value: string | null) => {
    if (isCanonicalComanda) {
      onB2bDeliveryDateChange?.(item.id, value)
    } else {
      onShopDeliveryDateChange?.(item.id, value)
    }
  }

  const handleZona4WhatsApp = () => {
    const firstName = item.customerName.trim().split(/\s+/)[0] || item.customerName.trim()
    const message = `Bună ziua, ${firstName}!\n\nAm primit comanda dvs. de ${displayQuantityLabel} (${totalFormatted} lei) cu livrare în ${item.localityLabel}.\n\nVă contactăm pentru a stabili locul și data livrării.\n\nMulțumim! — Ferma Zmeurel`
    window.open(
      `${waUrlForPhone(item.phone)}?text=${encodeURIComponent(message)}`,
      '_blank',
      'noopener,noreferrer',
    )
    markShopNotified()
  }

  if (!compact) {
    return (
      <article
        className={`overflow-hidden rounded-xl border bg-[var(--surface-card)] shadow-[var(--shadow-soft)] ${
          item.status === 'livrata' ? 'opacity-80' : item.status === 'anulata' ? 'opacity-50' : ''
        } ${selected ? 'ring-2 ring-[var(--focus-ring)] ring-offset-1 ring-offset-[var(--surface-page)]' : ''}`}
        style={{
          borderColor: 'var(--card-border-default)',
          borderLeftWidth: '3px',
          borderLeftColor: leftBorderColor,
        }}
      >
        <div className="flex items-start gap-2 px-3 py-2.5">
          {selectable ? (
            <SelectionCheckbox
              checked={Boolean(selected)}
              disabled={disabled}
              customerName={item.customerName}
              onCheckedChange={(checked) => onToggleSelect?.(checked)}
            />
          ) : null}
          <button
            type="button"
            aria-expanded={expanded}
            aria-label={`${expanded ? 'Ascunde' : 'Arată'} detaliile comenzii pentru ${item.customerName}`}
            onClick={() => setExpanded((current) => !current)}
            className="flex min-w-0 flex-1 flex-col gap-1 text-left outline-none transition active:bg-[var(--surface-card-muted)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
          >
            <div className="flex flex-wrap items-center gap-1.5">
              <p className="min-w-0 flex-1 truncate text-[14px] font-bold leading-tight text-[var(--text-primary)]">
                {item.customerName}
              </p>
              <OriginBadge item={item} />
              {variant === 'livrari' ? <StatusPill item={item} /> : null}
              {isUnpaid ? <UnpaidBadge /> : null}
            </div>
            <div className="flex items-center justify-between gap-2 text-xs text-[var(--text-tertiary)]">
              <span className="min-w-0 flex-1 truncate">
                {displayQuantityLabel} · {totalFormatted} lei ·{' '}
                {item.localityLabel}
              </span>
              <span className="shrink-0">{mobileDateLabel}</span>
            </div>
          </button>
        </div>

        <div
          aria-hidden={!expanded}
          className={`grid transition-[grid-template-rows,opacity] duration-200 ${
            expanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
          }`}
        >
          <div className="min-h-0 overflow-hidden">
            <div className="space-y-3 border-t border-[var(--divider)] px-3 py-3">
              {phoneHref ? (
                <a
                  href={phoneHref}
                  className="inline-flex min-h-9 items-center gap-2 text-sm font-medium text-[var(--info-text)]"
                >
                  <Phone className="h-4 w-4 shrink-0" aria-hidden />
                  <span className="truncate">{item.phone}</span>
                </a>
              ) : null}

              {!isTerminal ? (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <AppDatePicker
                      id={`unified-mobile-delivery-date-${item.source}-${item.id}`}
                      placeholder="Setează data"
                      value={item.deliveryDate ?? ''}
                      disabled={disabled}
                      triggerClassName="h-10 bg-[var(--surface-card)] px-3 text-sm"
                      onChange={handleDeliveryDateChange}
                    />
                    {item.deliveryDate ? (
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => handleDeliveryDateChange(null)}
                        className="w-full text-left text-xs font-medium text-[var(--text-tertiary)]"
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
                        className="flex h-10 w-full items-center justify-between gap-2 rounded-xl border border-[var(--border-default)] bg-[var(--surface-card)] px-3 text-left text-sm font-semibold text-[var(--text-primary)] disabled:opacity-50"
                        aria-label="Schimbă statusul comenzii"
                      >
                        <span className="truncate">{item.statusLabel}</span>
                        <ChevronDown
                          className="h-4 w-4 shrink-0 text-[var(--text-tertiary)]"
                          aria-hidden
                        />
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
                            {isCanonicalComanda
                              ? B2B_STATUS_LABELS[nextStatus as ComandaStatus]
                              : SHOP_STATUS_LABELS[nextStatus as ShopOrderStatus]}
                          </button>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
              ) : null}

              {onEdit ? (
                <button
                  type="button"
                  className="min-h-10 text-left text-sm font-semibold text-[var(--primary)]"
                  onClick={() => onEdit(item.id, isCanonicalComanda ? 'manual' : 'shop')}
                >
                  ✏ Editează
                </button>
              ) : null}

              {shopOrder ? (
                shopOrder.notified_wa ? (
                  <p className="text-sm font-semibold text-[var(--success-text)]">✓ Anunțat WA</p>
                ) : (
                  <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-[var(--text-secondary)]">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-[var(--border-default)]"
                      checked={item.confirmed}
                      disabled={disabled}
                      onChange={(event) =>
                        onShopConfirmedChange?.(item.id, event.target.checked)
                      }
                    />
                    WhatsApp trimis
                  </label>
                )
              ) : null}

              {needsConfirmation ? (
                <button
                  type="button"
                  disabled={disabled || !item.phone}
                  onClick={handleZona4WhatsApp}
                  className="flex min-h-10 w-full items-center justify-center rounded-full bg-[var(--whatsapp-green)] px-4 text-sm font-bold text-white transition active:scale-[0.98] disabled:opacity-50"
                >
                  Stabilește livrare pe WhatsApp
                </button>
              ) : null}
            </div>
          </div>
        </div>

        {isUnpaid && onMarkPaid ? (
          <div className="border-t border-[var(--divider)] px-3 py-2.5">
            <button
              type="button"
              disabled={disabled}
              onClick={() => {
                if (item.paymentComandaId) {
                  void Promise.resolve(onMarkPaid(item.paymentComandaId)).catch(() => undefined)
                }
              }}
              className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[var(--status-danger-bg)] px-3 text-sm font-bold text-[var(--status-danger-text)] transition active:scale-[0.985] disabled:opacity-50"
            >
              <CircleDollarSign className="h-4 w-4" aria-hidden />
              Marchează încasat
            </button>
          </div>
        ) : null}
      </article>
    )
  }

  return (
    <article
      className={`overflow-hidden rounded-2xl border-[1.5px] bg-[var(--surface-card)] shadow-[var(--shadow-soft)] ${
        item.status === 'livrata' ? 'opacity-80' : item.status === 'anulata' ? 'opacity-50' : ''
      } ${selected ? 'ring-2 ring-[var(--focus-ring)] ring-offset-1 ring-offset-[var(--surface-page)]' : ''}`}
      style={{
        borderColor: 'var(--card-border-default)',
        borderLeftWidth: '4px',
        borderLeftColor: leftBorderColor,
      }}
    >
      <div className={compact ? 'px-3 py-2' : 'px-3 py-3'}>
        <div className={`flex items-start ${compact ? 'gap-2' : 'gap-2.5'}`}>
          {selectable ? (
            <SelectionCheckbox
              checked={Boolean(selected)}
              disabled={disabled}
              customerName={item.customerName}
              onCheckedChange={(checked) => onToggleSelect?.(checked)}
            />
          ) : null}
          <div className="min-w-0 flex-1">
            <button
              type="button"
              aria-expanded={expanded}
              aria-label={`${expanded ? 'Ascunde' : 'Arată'} detaliile comenzii pentru ${item.customerName}`}
              onClick={() => setExpanded((current) => !current)}
              className={`flex w-full items-start justify-between rounded-lg text-left outline-none transition active:bg-[var(--surface-card-muted)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] ${
                compact ? 'gap-1' : 'gap-2'
              }`}
            >
              <p
                className={`min-w-0 flex-1 truncate leading-tight text-[var(--text-primary)] ${
                  compact ? 'text-[12px] font-medium' : 'text-[15px] font-bold'
                }`}
              >
                {item.customerName}
              </p>
              <div className={`flex max-w-[48%] shrink-0 flex-wrap items-center justify-end ${compact ? 'gap-1' : 'gap-1.5'}`}>
                <OriginBadge item={item} />
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
              {variant === 'livrari' ? <StatusPill item={item} /> : null}
              {isUnpaid ? <UnpaidBadge /> : null}
            </div>

            <button
              type="button"
              aria-label={`${expanded ? 'Ascunde' : 'Arată'} rezumatul comenzii pentru ${item.customerName}`}
              onClick={() => setExpanded((current) => !current)}
              className={`w-full border-t border-[var(--divider)] text-left font-semibold text-[var(--text-primary)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] ${
                compact ? 'mt-1.5 pt-1.5 text-[11px]' : 'mt-2 pt-2 text-[13px]'
              }`}
            >
              <span>{displayQuantityLabel} · {totalFormatted} lei</span>
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
        </div>
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
              <p className="mt-0.5 text-[var(--text-secondary)]">
                {formatDisplayTextWithoutCaserole(item.productsLabel)}
              </p>
            </div>
            {shopOrder?.milestone_reward ? (
              <MilestoneRewardBadge
                rewardLabel={shopOrder.milestone_reward.reward_label}
                status={shopOrder.milestone_reward.status}
              />
            ) : null}
            {isCanonicalComanda && onOpenB2bDetails ? (
              <button
                type="button"
                className="min-h-9 text-xs font-semibold text-[var(--primary)]"
                onClick={() => onOpenB2bDetails(item.id)}
              >
                Vezi toate detaliile
              </button>
            ) : null}
            {expanded && shopOrder ? (
              shopOrder.notified_wa ? (
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
                    onChange={(event) =>
                      onShopConfirmedChange?.(item.id, event.target.checked)
                    }
                  />
                  WhatsApp trimis
                </label>
              )
            ) : null}
            {onEdit ? (
              <button
                type="button"
                className="min-h-9 text-xs font-semibold text-[var(--primary)]"
                onClick={() => onEdit(item.id, isCanonicalComanda ? 'manual' : 'shop')}
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
            compact ? 'gap-1.5 py-1.5' : 'gap-2 py-3'
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
                    {isCanonicalComanda
                      ? B2B_STATUS_LABELS[nextStatus as ComandaStatus]
                      : SHOP_STATUS_LABELS[nextStatus as ShopOrderStatus]}
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
            className={`flex w-full items-center justify-center rounded-full bg-[var(--whatsapp-green)] px-4 font-bold text-white transition active:scale-[0.98] disabled:opacity-50 ${
              compact ? 'min-h-8 text-xs' : 'min-h-10 text-[13px]'
            }`}
          >
            Stabilește livrare pe WhatsApp
          </button>
        </div>
      ) : null}

      {isUnpaid && onMarkPaid ? (
        <div className={`border-t border-[var(--divider)] px-3 ${compact ? 'py-1.5' : 'py-2.5'}`}>
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              if (item.paymentComandaId) {
                void Promise.resolve(onMarkPaid(item.paymentComandaId)).catch(() => undefined)
              }
            }}
            className={`flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--status-danger-bg)] px-3 font-bold text-[var(--status-danger-text)] transition active:scale-[0.985] disabled:opacity-50 ${
              compact ? 'min-h-9 text-xs' : 'min-h-11 text-sm'
            }`}
          >
            <CircleDollarSign className="h-4 w-4" aria-hidden />
            Marchează încasat
          </button>
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

function formatCompactDate(value: string): string {
  const parsed = value.includes('T') ? new Date(value) : new Date(`${value}T12:00:00.000Z`)
  if (Number.isNaN(parsed.getTime())) return '—'
  return new Intl.DateTimeFormat('ro-RO', {
    day: 'numeric',
    month: 'short',
    timeZone: value.includes('T') ? 'Europe/Bucharest' : 'UTC',
  })
    .format(parsed)
    .replace(/\./g, '')
}
