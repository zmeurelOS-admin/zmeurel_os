'use client'

import { useState } from 'react'
import {
  Ban,
  CalendarDays,
  CircleDollarSign,
  ChevronDown,
  PackageCheck,
  Pencil,
  Phone,
  PhoneCall,
  PhoneOff,
  StickyNote,
  Truck,
} from 'lucide-react'

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
import { getDisplayOrderObservatii } from '@/lib/comenzi/shop-observations'
import type { ComandaStatus } from '@/lib/supabase/queries/comenzi'
import { todayBucharestDate, waUrlForPhone, type ShopOrderStatus } from '@/lib/shop/b2c-order-helpers'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'

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
  onCallStatusChange,
  onShopStatusChange,
  onShopConfirmedChange,
  onShopDeliveryDateChange,
  onShopNotifiedChange,
  onMarkPaid,
  onEdit,
  variant = 'livrari',
  comenziMode,
  reorderPosition,
}: {
  item: UnifiedOrderItem
  /** În Comenzi statusul rămâne control în detalii, nu badge permanent pe card. */
  variant?: 'comenzi' | 'livrari'
  /** Sub-varianta operațională a cardului din modulul Comenzi. */
  comenziMode?: 'active' | 'programate'
  /** Randare compactă, blocată, folosită exclusiv în modul de reordonare Livrări. */
  reorderPosition?: number
  disabled?: boolean
  compact?: boolean
  selectable?: boolean
  selected?: boolean
  onToggleSelect?: (selected: boolean) => void
  onOpenB2bDetails?: (id: string) => void
  onB2bStatusChange?: (id: string, status: ComandaStatus) => void | Promise<void>
  onB2bDeliveryDateChange?: (id: string, deliveryDate: string | null) => void | Promise<void>
  onCallStatusChange?: (id: string, status: 'no_answer' | null) => void | Promise<void>
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
  const hasKnownLocality =
    Boolean(item.localityLabel.trim()) && item.localityLabel !== 'Necunoscută'
  const blocksStatusWhatsApp =
    isCanonicalComanda &&
    (item.orderKind === 'cadou' || item.orderKind === 'consum_propriu')

  if (variant === 'comenzi') {
    return (
      <ComenziOperationalCard
        item={item}
        disabled={disabled}
        mode={comenziMode ?? (item.status === 'programata' ? 'programate' : 'active')}
        onStatusChange={onB2bStatusChange}
        onDeliveryDateChange={onB2bDeliveryDateChange}
        onEdit={onEdit}
      />
    )
  }

  if (typeof reorderPosition === 'number') {
    return <DeliveryReorderCard item={item} position={reorderPosition} />
  }

  const hasNoAnswer = item.lastCallStatus === 'no_answer'

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
        className={`overflow-hidden rounded-xl border shadow-[var(--shadow-soft)] ${
          hasNoAnswer ? 'bg-[var(--status-warning-bg)]' : 'bg-[var(--surface-card)]'
        } ${
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
              <p className="min-w-0 flex-1 line-clamp-2 text-[14px] font-bold leading-tight text-[var(--text-primary)]">
                {item.customerName}
              </p>
              <OriginBadge item={item} />
              {variant === 'livrari' ? <StatusPill item={item} /> : null}
              {hasNoAnswer ? <NoAnswerBadge /> : null}
              {isUnpaid ? <UnpaidBadge /> : null}
            </div>
            <div className="flex items-center justify-between gap-2 text-xs text-[var(--text-tertiary)]">
              <span className="min-w-0 flex-1 truncate">
                {displayQuantityLabel} · {totalFormatted} lei
                {hasKnownLocality ? ` · ${item.localityLabel}` : ''}
              </span>
              <span className="shrink-0">{mobileDateLabel}</span>
            </div>
          </button>
        </div>

        {phoneHref ? (
          <div className="border-t border-[var(--divider)] px-3 py-1.5">
            <a
              href={phoneHref}
              className="inline-flex min-h-9 max-w-full items-center gap-2 text-sm font-semibold text-[var(--info-text)] transition active:scale-[0.985]"
            >
              <Phone className="h-4 w-4 shrink-0" aria-hidden />
              <span className="truncate">{item.phone}</span>
            </a>
          </div>
        ) : null}

        <DeliveryQuickActions
          item={item}
          disabled={disabled}
          hasNoAnswer={hasNoAnswer}
          onStatusChange={onB2bStatusChange}
          onCallStatusChange={onCallStatusChange}
        />

        <div
          aria-hidden={!expanded}
          className={`grid transition-[grid-template-rows,opacity] duration-200 ${
            expanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
          }`}
        >
          <div className="min-h-0 overflow-hidden">
            <div className="space-y-3 border-t border-[var(--divider)] px-3 py-3">
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
      className={`overflow-hidden rounded-2xl border-[1.5px] shadow-[var(--shadow-soft)] ${
        hasNoAnswer ? 'bg-[var(--status-warning-bg)]' : 'bg-[var(--surface-card)]'
      } ${
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
                className={`min-w-0 flex-1 line-clamp-2 leading-tight text-[var(--text-primary)] ${
                  compact ? 'text-[12px] font-medium' : 'text-[15px] font-bold'
                }`}
              >
                {item.customerName}
              </p>
              <div className={`flex max-w-[48%] shrink-0 flex-wrap items-center justify-end ${compact ? 'gap-1' : 'gap-1.5'}`}>
                <OriginBadge item={item} />
                {needsConfirmation ? <ConfirmationBadge /> : null}
                {hasNoAnswer ? <NoAnswerBadge /> : null}
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
              {hasKnownLocality ? (
                <>
                  <span className="text-[var(--text-tertiary)]"> · </span>
                  <span className="font-medium text-[var(--text-secondary)]">{item.localityLabel}</span>
                </>
              ) : null}
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
        <>
          <DeliveryQuickActions
            item={item}
            disabled={disabled}
            hasNoAnswer={hasNoAnswer}
            onStatusChange={onB2bStatusChange}
            onCallStatusChange={onCallStatusChange}
          />
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
        </>
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

function ComenziOperationalCard({
  item,
  disabled,
  mode,
  onStatusChange,
  onDeliveryDateChange,
  onEdit,
}: {
  item: UnifiedOrderItem
  disabled?: boolean
  mode: 'active' | 'programate'
  onStatusChange?: (id: string, status: ComandaStatus) => void | Promise<void>
  onDeliveryDateChange?: (id: string, value: string | null) => void | Promise<void>
  onEdit?: (id: string, source: 'shop' | 'manual') => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [scheduleOpen, setScheduleOpen] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const totalFormatted = new Intl.NumberFormat('ro-RO', { maximumFractionDigits: 0 }).format(Math.round(item.totalLei))
  const quantityFormatted = new Intl.NumberFormat('ro-RO', { maximumFractionDigits: 2 }).format(item.quantity)
  const quantityLabel = item.quantityUnit === 'kg' ? `${quantityFormatted} kg` : formatKgFromGrams(item.quantity * KG_PER_CASEROLĂ * 1000)
  const isOverdue = mode === 'programate' && Boolean(item.deliveryDate && item.deliveryDate < todayBucharestDate())
  const isTerminal = item.status === 'livrata' || item.status === 'anulata'
  const isCanonicalComanda = Boolean(item.b2bComanda)
  const scheduleLabel = mode === 'programate' ? 'Reprogramează' : 'Programează'
  const observatii = getDisplayOrderObservatii(
    item.b2bComanda?.observatii,
    item.source === 'shop',
  )
  const scheduledForLabel =
    mode === 'active' && item.deliveryDate
      ? item.deliveryDate === todayBucharestDate()
        ? 'Programat pt azi'
        : `Programat pt ${formatDeliveryDate(item.deliveryDate)}`
      : null
  const locality = item.localityLabel || 'Necunoscută'

  const scheduleOrder = async (date: string) => {
    if (!onDeliveryDateChange) return
    await onDeliveryDateChange(item.id, date)
    if (mode === 'active' && item.status !== 'programata') {
      await onStatusChange?.(item.id, 'programata')
    }
    setScheduleOpen(false)
  }

  return (
    <article
      className={`overflow-hidden rounded-[22px] border-[1.5px] shadow-[var(--shadow-soft)] ${
        isOverdue ? 'border-[var(--status-danger-border)] bg-[var(--status-danger-bg)]' : 'border-[var(--card-border-default)] bg-[var(--surface-card)]'
      }`}
    >
      <button
        type="button"
        aria-expanded={expanded}
        aria-label={`${expanded ? 'Ascunde' : 'Arată'} detaliile comenzii pentru ${item.customerName}`}
        onClick={() => setExpanded((current) => !current)}
        className="flex min-h-[72px] w-full items-center justify-between gap-3 px-3 py-3 text-left outline-none transition active:bg-[var(--surface-card-muted)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="min-w-0 flex-1 line-clamp-2 text-[15px] font-bold leading-tight text-[var(--text-primary)]">
              {item.customerName}
            </p>
            <span className="shrink-0 rounded-full bg-[var(--status-info-bg)] px-2 py-1 text-xs font-bold tabular-nums text-[var(--status-info-text)]">
              {quantityLabel}
            </span>
          </div>
          <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-1.5">
            {scheduledForLabel ? (
              <span className="inline-flex max-w-full rounded-full border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] px-2 py-0.5 text-[11px] font-bold text-[var(--status-warning-text)]">
                {scheduledForLabel}
              </span>
            ) : null}
            <span className="min-w-0 truncate text-xs font-medium text-[var(--text-secondary)]">
              {locality}
            </span>
          </div>
        </div>
        <ChevronDown
          className={`h-5 w-5 shrink-0 text-[var(--text-tertiary)] transition-transform duration-200 ${
            expanded ? 'rotate-180' : ''
          }`}
          aria-hidden
        />
      </button>

      <div
        aria-hidden={!expanded}
        className={`grid transition-[grid-template-rows,opacity] duration-200 ${
          expanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
        }`}
      >
        <div className="min-h-0 overflow-hidden">
          {item.dupPhoneWarning ? (
            <div className="border-b border-l-4 border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] px-3 py-2 text-xs font-semibold leading-snug text-[var(--status-warning-text)]">
              Același telefon ca „{item.dupPhoneWarning}” — verifică dacă e duplicat
            </div>
          ) : null}
          {isOverdue ? (
            <div className="border-b border-l-4 border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] px-3 py-2 text-xs font-bold text-[var(--status-danger-text)]">
              Restanță — data a trecut, reprogramează
            </div>
          ) : null}

          <div className="border-t border-[var(--divider)] px-3 py-3">
            <div className="flex items-start justify-between gap-3">
              <OriginBadge item={item} />
              {onEdit ? (
                <button
                  type="button"
                  onClick={() => onEdit(item.id, isCanonicalComanda ? 'manual' : 'shop')}
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--border-default)] bg-[var(--surface-card)] text-[var(--text-secondary)] shadow-sm transition active:scale-[0.985]"
                  aria-label={`Editează comanda pentru ${item.customerName}`}
                >
                  <Pencil className="h-4 w-4" aria-hidden />
                </button>
              ) : null}
            </div>

            <div className="mt-3 grid grid-cols-3 divide-x divide-[var(--divider)] rounded-xl bg-[var(--surface-card-muted)] py-2">
              <CardMetric label="Cantitate" value={quantityLabel} />
              <CardMetric label="Total" value={`${totalFormatted} lei`} />
              <CardMetric label="Dată" value={formatComenziDate(item.deliveryDate ?? item.orderDate)} />
            </div>

            {observatii ? (
              <div className="mt-3 flex items-start gap-2 rounded-xl border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] px-3 py-2.5 text-[var(--status-warning-text)]">
                <StickyNote className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                <div className="min-w-0">
                  <p className="text-[11px] font-bold uppercase tracking-[0.02em]">Observații</p>
                  <p className="mt-0.5 text-sm font-medium leading-snug">{observatii}</p>
                </div>
              </div>
            ) : null}

            {!isTerminal ? (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={disabled || !isCanonicalComanda || !onDeliveryDateChange}
                  onClick={() => setScheduleOpen(true)}
                  className="flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-xl border border-[var(--border-default)] bg-[var(--surface-card)] px-1 text-[11px] font-semibold text-[var(--text-primary)] transition active:scale-[0.985] disabled:opacity-50"
                >
                  <CalendarDays className="h-4 w-4" aria-hidden />
                  <span className="truncate">{scheduleLabel}</span>
                </button>
                <button
                  type="button"
                  disabled={disabled || !isCanonicalComanda || !onStatusChange}
                  onClick={() => void Promise.resolve(onStatusChange?.(item.id, 'in_livrare'))}
                  className="flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-xl border border-[var(--status-info-border)] bg-[var(--status-info-bg)] px-1 text-[11px] font-semibold text-[var(--status-info-text)] transition active:scale-[0.985] disabled:opacity-50"
                >
                  <Truck className="h-4 w-4" aria-hidden />
                  <span>În livrare</span>
                </button>
                <button
                  type="button"
                  disabled={disabled || !isCanonicalComanda || !onStatusChange}
                  onClick={() => void Promise.resolve(onStatusChange?.(item.id, 'livrata'))}
                  className="flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-xl border border-[var(--success-border)] bg-[var(--success-text)] px-1 text-[11px] font-semibold text-white transition active:scale-[0.985] disabled:opacity-50"
                >
                  <PackageCheck className="h-4 w-4" aria-hidden />
                  <span>Livrat</span>
                </button>
                <button
                  type="button"
                  disabled={disabled || !isCanonicalComanda || !onStatusChange}
                  onClick={() => setCancelOpen(true)}
                  className="flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-xl border border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] px-1 text-[11px] font-semibold text-[var(--status-danger-text)] transition active:scale-[0.985] disabled:opacity-50"
                >
                  <Ban className="h-4 w-4" aria-hidden />
                  <span>Anulează</span>
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <OrderScheduleSheet
        key={`${item.id}-${scheduleOpen ? item.deliveryDate ?? 'today' : 'closed'}`}
        open={scheduleOpen}
        currentDate={item.deliveryDate}
        customerName={item.customerName}
        pending={Boolean(disabled)}
        onOpenChange={setScheduleOpen}
        onSave={scheduleOrder}
      />
      <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Anulezi comanda?</AlertDialogTitle>
            <AlertDialogDescription>
              Comanda pentru {item.customerName} nu va mai apărea în lista activă.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Renunță</AlertDialogCancel>
            <AlertDialogAction
              className="bg-[var(--status-danger-text)] text-white"
              onClick={() => void Promise.resolve(onStatusChange?.(item.id, 'anulata'))}
            >
              Da, anulează
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </article>
  )
}

function DeliveryReorderCard({ item, position }: { item: UnifiedOrderItem; position: number }) {
  const locality = item.localityLabel || 'Necunoscută'

  return (
    <article className="flex min-h-16 items-center gap-3 rounded-xl border border-[var(--card-border-default)] bg-[var(--surface-card)] px-3 py-3 shadow-[var(--shadow-soft)]">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--agri-primary)] text-sm font-bold text-white">
        {position}
      </span>
      <div className="min-w-0">
        <p className="truncate text-sm font-bold text-[var(--text-primary)]">{item.customerName}</p>
        <p className="mt-0.5 truncate text-xs font-medium text-[var(--text-secondary)]">{locality}</p>
      </div>
    </article>
  )
}

function CardMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 px-2 text-center">
      <p className="truncate text-[10px] font-medium text-[var(--text-tertiary)]">{label}</p>
      <p className="mt-0.5 truncate text-xs font-bold tabular-nums text-[var(--text-primary)]">{value}</p>
    </div>
  )
}

function NoAnswerBadge() {
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] px-2 py-[3px] text-[10px] font-semibold leading-none text-[var(--status-warning-text)]">
      <PhoneOff className="h-3 w-3" aria-hidden />
      Sunat, nu a răspuns
    </span>
  )
}

function DeliveryQuickActions({
  item,
  disabled,
  hasNoAnswer,
  onStatusChange,
  onCallStatusChange,
}: {
  item: UnifiedOrderItem
  disabled?: boolean
  hasNoAnswer: boolean
  onStatusChange?: (id: string, status: ComandaStatus) => void | Promise<void>
  onCallStatusChange?: (id: string, status: 'no_answer' | null) => void | Promise<void>
}) {
  const phoneHref = item.phone ? `tel:${item.phone.replace(/\s/g, '')}` : undefined
  const canAct = Boolean(item.b2bComanda)

  return (
    <div className="grid grid-cols-3 gap-2 border-t border-[var(--divider)] px-3 py-2.5">
      {phoneHref ? (
        <a
          href={phoneHref}
          className="flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-xl border border-[var(--status-info-border)] bg-[var(--status-info-bg)] px-1 text-[11px] font-semibold text-[var(--status-info-text)] transition active:scale-[0.985]"
        >
          <PhoneCall className="h-4 w-4" aria-hidden />
          Sună
        </a>
      ) : (
        <span className="flex min-h-11 flex-col items-center justify-center rounded-xl border border-[var(--border-default)] px-1 text-[11px] font-medium text-[var(--text-tertiary)]">
          Fără telefon
        </span>
      )}
      <button
        type="button"
        disabled={disabled || !canAct || !onCallStatusChange}
        onClick={() => void Promise.resolve(onCallStatusChange?.(item.id, hasNoAnswer ? null : 'no_answer'))}
        className={`flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-xl border px-1 text-[11px] font-semibold transition active:scale-[0.985] disabled:opacity-50 ${
          hasNoAnswer
            ? 'border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] text-[var(--status-warning-text)]'
            : 'border-[var(--border-default)] bg-[var(--surface-card)] text-[var(--text-primary)]'
        }`}
      >
        <PhoneOff className="h-4 w-4" aria-hidden />
        N-a răspuns
      </button>
      <button
        type="button"
        disabled={disabled || !canAct || !onStatusChange}
        onClick={() => void Promise.resolve(onStatusChange?.(item.id, 'livrata'))}
        className="flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-xl border border-[var(--status-success-border)] bg-[var(--status-success-bg)] px-1 text-[11px] font-semibold text-[var(--status-success-text)] transition active:scale-[0.985] disabled:opacity-50"
      >
        <PackageCheck className="h-4 w-4" aria-hidden />
        Livrat
      </button>
    </div>
  )
}

function OrderScheduleSheet({
  open,
  currentDate,
  customerName,
  pending,
  onOpenChange,
  onSave,
}: {
  open: boolean
  currentDate: string | null
  customerName: string
  pending: boolean
  onOpenChange: (open: boolean) => void
  onSave: (value: string) => void | Promise<void>
}) {
  const [selectedDate, setSelectedDate] = useState(currentDate ?? todayBucharestDate())
  const today = todayBucharestDate()
  const quickDates = [
    { label: 'Azi', value: today },
    { label: 'Mâine', value: addDaysToIso(today, 1) },
    { label: 'Peste 2 zile', value: addDaysToIso(today, 2) },
  ]

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-[28px] pb-[max(1rem,env(safe-area-inset-bottom))]">
        <SheetHeader>
          <SheetTitle>Programează livrarea</SheetTitle>
          <SheetDescription>{customerName}</SheetDescription>
        </SheetHeader>
        <div className="space-y-4 px-4 pb-2 pt-4">
          <div className="grid grid-cols-3 gap-2">
            {quickDates.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setSelectedDate(option.value)}
                className={`min-h-11 rounded-xl border px-2 text-xs font-semibold transition active:scale-[0.985] ${
                  selectedDate === option.value
                    ? 'border-[var(--status-success-border)] bg-[var(--status-success-bg)] text-[var(--status-success-text)]'
                    : 'border-[var(--border-default)] bg-[var(--surface-card)] text-[var(--text-primary)]'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
          <AppDatePicker
            id="unified-order-schedule-date"
            label="Altă dată"
            value={selectedDate}
            onChange={(value) => value && setSelectedDate(value)}
            triggerClassName="min-h-11"
          />
          <button
            type="button"
            disabled={pending || !selectedDate}
            onClick={() => void Promise.resolve(onSave(selectedDate))}
            className="flex min-h-12 w-full items-center justify-center rounded-xl bg-[var(--agri-primary)] px-4 text-sm font-bold text-white transition active:scale-[0.985] disabled:opacity-50"
          >
            {pending ? 'Se salvează...' : 'Confirmă data'}
          </button>
        </div>
      </SheetContent>
    </Sheet>
  )
}

function addDaysToIso(value: string, days: number): string {
  const date = new Date(`${value}T12:00:00.000Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

function formatComenziDate(value: string): string {
  if (value === todayBucharestDate()) return 'Azi'
  return formatDeliveryDate(value)
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
