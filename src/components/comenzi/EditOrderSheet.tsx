'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

import {
  buildDeliveryLocation,
  deriveDeliverySelection,
  ErpLocalitySelector,
} from '@/components/comenzi/ErpLocalitySelector'
import { AppDatePicker } from '@/components/ui/app-date-picker'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import {
  B2B_STATUS_LABELS,
  B2B_STATUS_TRANSITIONS,
  SHOP_STATUS_LABELS,
  SHOP_STATUS_TRANSITIONS,
  type UnifiedOrderItem,
} from '@/lib/comenzi/unified-orders'
import { normalizeRomanianMobilePhone, ROMANIAN_PHONE_ERROR } from '@/lib/shop/phone'
import type { LocalityConfig, VillageConfig } from '@/lib/shop/delivery-zones'
import type { Client } from '@/lib/supabase/queries/clienti'
import {
  updateComanda,
  type ComandaOrderKind,
  type ComandaStatus,
} from '@/lib/supabase/queries/comenzi'
import type { ShopOrderStatus } from '@/lib/shop/b2c-order-helpers'
import { toast } from '@/lib/ui/toast'

type EditOrderForm = {
  clientId: string
  customerName: string
  phone: string
  deliveryMode: 'livrare' | 'ridicare'
  locality: LocalityConfig | null
  village: VillageConfig | null
  street: string
  quantity: string
  price: string
  deliveryDate: string
  status: string
  notes: string
  shopVid: string
  shopLabel: string
}

export type EditOrderSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  order: UnifiedOrderItem
  clienti: Client[]
  onSaved: () => void
}

const ORDER_KIND_LABELS: Record<ComandaOrderKind, string> = {
  manual: 'Manual',
  cadou: '🎁 Cadou',
  consum_propriu: '🏠 Consum propriu',
}

function normalizeSearch(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase('ro-RO')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function firstShopItem(order: UnifiedOrderItem): {
  vid: string
  label: string
  qty: number
  priceLei: number
} {
  const items = order.shopOrder?.items
  const raw = Array.isArray(items)
    ? items.find((item) => item && typeof item === 'object' && !Array.isArray(item))
    : null
  const item = (raw ?? {}) as {
    vid?: unknown
    label?: unknown
    qty?: unknown
    price_lei?: unknown
  }
  const qty = typeof item.qty === 'number' && item.qty > 0 ? item.qty : Math.max(1, order.quantity)
  const fallbackPrice = qty > 0 ? Math.round(order.totalLei / qty) : 20

  return {
    vid: typeof item.vid === 'string' && item.vid.trim() ? item.vid.trim() : 'zmeura',
    label:
      typeof item.label === 'string' && item.label.trim()
        ? item.label.trim()
        : 'Zmeură — Caserolă 500 g',
    qty,
    priceLei:
      typeof item.price_lei === 'number' && item.price_lei >= 0
        ? item.price_lei
        : fallbackPrice,
  }
}

function formFromOrder(order: UnifiedOrderItem): EditOrderForm {
  if (order.source === 'shop' && order.shopOrder) {
    const shop = order.shopOrder
    const item = firstShopItem(order)
    const deliverySelection =
      shop.delivery_mode === 'ridicare'
        ? deriveDeliverySelection('Ridicare la fermă (Văratec)')
        : deriveDeliverySelection(
            [shop.delivery_city?.trim(), shop.delivery_address?.trim()]
              .filter(Boolean)
              .join(', '),
          )

    return {
      clientId: '',
      customerName: shop.customer_name,
      phone: shop.customer_phone,
      deliveryMode: shop.delivery_mode === 'ridicare' ? 'ridicare' : 'livrare',
      locality: deliverySelection.locality,
      village: deliverySelection.village,
      street: deliverySelection.street,
      quantity: String(item.qty),
      price: String(item.priceLei),
      deliveryDate: shop.delivery_date ?? '',
      status: shop.status,
      notes: shop.notes ?? '',
      shopVid: item.vid,
      shopLabel: item.label,
    }
  }

  const manual = order.b2bComanda
  const deliverySelection = deriveDeliverySelection(manual?.locatie_livrare ?? '')
  return {
    clientId: manual?.client_id ?? '',
    customerName: order.customerName,
    phone: manual?.telefon ?? order.phone,
    deliveryMode: deliverySelection.mode,
    locality: deliverySelection.locality,
    village: deliverySelection.village,
    street: deliverySelection.street,
    quantity: String(manual?.cantitate_kg ?? order.quantity),
    price:
      manual?.order_kind === 'cadou' || manual?.order_kind === 'consum_propriu'
        ? '0'
        : String(manual?.pret_per_kg ?? (order.quantity ? order.totalLei / order.quantity : 0)),
    deliveryDate: manual?.data_livrare ?? '',
    status: manual?.status ?? order.status,
    notes: manual?.observatii ?? '',
    shopVid: '',
    shopLabel: '',
  }
}

export function EditOrderSheet({
  open,
  onOpenChange,
  order,
  clienti,
  onSaved,
}: EditOrderSheetProps) {
  const isMobile = useMediaQuery('(max-width: 767px)')
  const [form, setForm] = useState<EditOrderForm>(() => formFromOrder(order))
  const [clientMenuOpen, setClientMenuOpen] = useState(false)
  const [blockedMessage, setBlockedMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const clientMenuRef = useRef<HTMLDivElement>(null)
  // Bridge-urile Shop sunt editate ca `comenzi`; ramura Shop rămâne doar
  // pentru eventualii consumatori legacy care oferă un ShopOrder fără bridge.
  const isShop = !order.b2bComanda && order.source === 'shop'
  const manualOrderKind = (order.b2bComanda?.order_kind ?? 'manual') as ComandaOrderKind
  const isZeroPriceKind =
    !isShop && (manualOrderKind === 'cadou' || manualOrderKind === 'consum_propriu')

  useEffect(() => {
    if (!open) return
    queueMicrotask(() => {
      setForm(formFromOrder(order))
      setClientMenuOpen(false)
      setBlockedMessage('')
    })
  }, [open, order])

  useEffect(() => {
    const closeClientMenu = (event: MouseEvent) => {
      if (clientMenuRef.current && !clientMenuRef.current.contains(event.target as Node)) {
        setClientMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', closeClientMenu)
    return () => document.removeEventListener('mousedown', closeClientMenu)
  }, [])

  const filteredClients = useMemo(() => {
    const term = normalizeSearch(form.customerName)
    if (term.length < 2) return clienti.slice(0, 30)
    return clienti
      .filter(
        (client) =>
          normalizeSearch(client.nume_client).includes(term) ||
          normalizeSearch(client.telefon ?? '').includes(term),
      )
      .slice(0, 30)
  }, [clienti, form.customerName])

  const quantity = Number(form.quantity)
  const price = Number(form.price)
  const total = Number.isFinite(quantity) && Number.isFinite(price) ? quantity * price : 0
  const statusOptions = useMemo(() => {
    if (isShop) {
      const current = form.status as ShopOrderStatus
      return [current, ...(SHOP_STATUS_TRANSITIONS[current] ?? [])].filter(
        (status, index, values) =>
          (status !== 'livrata' || status === current) && values.indexOf(status) === index,
      )
    }
    const current = form.status as ComandaStatus
    return [current, ...(B2B_STATUS_TRANSITIONS[current] ?? [])].filter(
      (status, index, values) =>
        (status !== 'livrata' || status === current) && values.indexOf(status) === index,
    )
  }, [form.status, isShop])

  const updateDeliveryLocation = (
    locality: LocalityConfig | null,
    village: VillageConfig | null,
    street: string,
  ) => {
    setForm((current) => ({ ...current, locality, village, street }))
  }

  const normalizePhoneOnBlur = () => {
    const normalized = normalizeRomanianMobilePhone(form.phone)
    if (normalized) setForm((current) => ({ ...current, phone: normalized }))
  }

  const save = async () => {
    const normalizedPhone = normalizeRomanianMobilePhone(form.phone)
    if (!form.customerName.trim()) {
      toast.error('Introdu numele clientului.')
      return
    }
    if (!normalizedPhone) {
      toast.error(ROMANIAN_PHONE_ERROR)
      return
    }
    if (!Number.isFinite(quantity) || quantity <= 0 || (isShop && !Number.isInteger(quantity))) {
      toast.error(isShop ? 'Cantitatea trebuie să fie un număr întreg pozitiv.' : 'Cantitatea trebuie să fie mai mare decât 0.')
      return
    }
    if (!Number.isFinite(price) || price < 0 || (isShop && !Number.isInteger(price))) {
      toast.error(isShop ? 'Prețul trebuie să fie un număr întreg pozitiv sau zero.' : 'Prețul nu poate fi negativ.')
      return
    }
    if (!isZeroPriceKind && total <= 0) {
      toast.error('Totalul comenzii trebuie să fie mai mare decât 0.')
      return
    }

    const location =
      form.deliveryMode === 'ridicare'
        ? 'Ridicare la fermă (Văratec)'
        : buildDeliveryLocation(form.locality, form.village, form.street)

    setSaving(true)
    try {
      if (isShop) {
        const initial = formFromOrder(order)
        const deliveryCity = form.village?.name ?? form.locality?.name ?? ''
        const initialDeliveryCity =
          initial.village?.name ?? initial.locality?.name ?? ''
        const deliveryAddress = form.deliveryMode === 'livrare' ? form.street.trim() : ''
        const initialDeliveryAddress =
          initial.deliveryMode === 'livrare' ? initial.street.trim() : ''
        const payload: Record<string, unknown> = {}

        if (form.customerName.trim() !== initial.customerName.trim()) {
          payload.customer_name = form.customerName.trim()
        }
        if (normalizedPhone !== normalizeRomanianMobilePhone(initial.phone)) {
          payload.customer_phone = normalizedPhone
        }
        if ((form.notes.trim() || null) !== (initial.notes.trim() || null)) {
          payload.notes = form.notes.trim() || null
        }
        if (form.deliveryMode !== initial.deliveryMode) {
          payload.delivery_mode = form.deliveryMode
        }
        if (
          deliveryAddress !== initialDeliveryAddress ||
          deliveryCity !== initialDeliveryCity
        ) {
          payload.delivery_address = deliveryAddress
          payload.delivery_city = deliveryCity
        }
        if ((form.deliveryDate || null) !== (initial.deliveryDate || null)) {
          payload.delivery_date = form.deliveryDate || null
        }
        if (form.status !== initial.status && form.status !== 'livrata') {
          payload.status = form.status
        }
        if (
          quantity !== Number(initial.quantity) ||
          price !== Number(initial.price)
        ) {
          payload.items = [
            {
              vid: form.shopVid,
              label: form.shopLabel,
              qty: quantity,
              price_lei: price,
            },
          ]
        }

        if (Object.keys(payload).length === 0) {
          toast.success('Nu există modificări de salvat.')
          onSaved()
          return
        }

        const response = await fetch(`/api/shop/b2c/orders/${order.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const result = (await response.json()) as { success?: boolean; error?: string }
        if (!response.ok || !result.success) {
          throw new Error(result.error ?? 'Nu am putut actualiza comanda Shop.')
        }
      } else {
        await updateComanda(order.id, {
          client_id: form.clientId || null,
          client_nume_manual: form.clientId ? null : form.customerName.trim(),
          telefon: normalizedPhone,
          locatie_livrare: location || null,
          data_livrare: form.deliveryDate || null,
          cantitate_kg: quantity,
          pret_per_kg: price,
          ...(form.status !== 'livrata'
            ? { status: form.status as ComandaStatus }
            : {}),
          observatii: form.notes.trim() || null,
        })
      }

      toast.success('Comanda a fost actualizată.')
      onSaved()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nu am putut actualiza comanda.')
    } finally {
      setSaving(false)
    }
  }

  const content = (
    <div className="space-y-4 px-4 pb-5 sm:px-5">
      <div ref={clientMenuRef} className="relative space-y-1.5">
        <Label htmlFor={`edit-order-client-${order.id}`}>Client</Label>
        <Input
          id={`edit-order-client-${order.id}`}
          value={form.customerName}
          autoComplete="off"
          onFocus={() => setClientMenuOpen(true)}
          onChange={(event) => {
            setForm((current) => ({
              ...current,
              clientId: '',
              customerName: event.target.value,
            }))
            setClientMenuOpen(true)
          }}
        />
        {clientMenuOpen ? (
          <div className="absolute inset-x-0 bottom-full z-50 mb-1 max-h-56 overflow-y-auto rounded-xl border border-[var(--border-default)] bg-[var(--surface-card)] shadow-[var(--shadow-elevated)]">
            {filteredClients.map((client) => (
              <button
                key={client.id}
                type="button"
                className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-[var(--surface-card-muted)]"
                onMouseDown={(event) => {
                  event.preventDefault()
                  const selection = deriveDeliverySelection(client.adresa ?? '')
                  setForm((current) => ({
                    ...current,
                    clientId: client.id,
                    customerName: client.nume_client,
                    phone: client.telefon || current.phone,
                    deliveryMode: selection.mode,
                    locality: selection.locality,
                    village: selection.village,
                    street: selection.street,
                  }))
                  setClientMenuOpen(false)
                }}
              >
                <span className="font-semibold text-[var(--text-primary)]">{client.nume_client}</span>
                {client.telefon ? (
                  <span className="text-[var(--text-secondary)]">{client.telefon}</span>
                ) : null}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`edit-order-phone-${order.id}`}>Telefon</Label>
        <Input
          id={`edit-order-phone-${order.id}`}
          value={form.phone}
          inputMode="tel"
          onBlur={normalizePhoneOnBlur}
          onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
        />
      </div>

      <div className="space-y-2">
        <Label>Mod livrare</Label>
        <div className="grid grid-cols-2 gap-2">
          {(['livrare', 'ridicare'] as const).map((mode) => (
            <Button
              key={mode}
              type="button"
              variant={form.deliveryMode === mode ? 'default' : 'outline'}
              onClick={() =>
                setForm((current) => ({
                  ...current,
                  deliveryMode: mode,
                  locality: mode === 'ridicare' ? null : current.locality,
                  village: mode === 'ridicare' ? null : current.village,
                  street: mode === 'ridicare' ? '' : current.street,
                }))
              }
            >
              {mode === 'livrare' ? 'Livrare' : 'Ridicare'}
            </Button>
          ))}
        </div>
      </div>

      {form.deliveryMode === 'livrare' ? (
        <ErpLocalitySelector
          selectedLocality={form.locality}
          selectedVillage={form.village}
          street={form.street}
          blockedMessage={blockedMessage}
          onSelectLocality={(locality) => {
            setBlockedMessage('')
            updateDeliveryLocation(locality, null, form.street)
          }}
          onSelectVillage={(village) => {
            setBlockedMessage('')
            updateDeliveryLocation(form.locality, village, form.street)
          }}
          onBlockedVillage={(village) =>
            setBlockedMessage(village.blockedMessage ?? `Nu livrăm în ${village.name}.`)
          }
          onStreetChange={(street) =>
            updateDeliveryLocation(form.locality, form.village, street)
          }
        />
      ) : null}

      {!isShop ? (
        <div className="space-y-1.5">
          <Label htmlFor={`edit-order-kind-${order.id}`}>Tip comandă</Label>
          <Input
            id={`edit-order-kind-${order.id}`}
            readOnly
            value={ORDER_KIND_LABELS[manualOrderKind] ?? ORDER_KIND_LABELS.manual}
          />
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor={`edit-order-quantity-${order.id}`}>
            Cantitate ({isShop ? 'caserole' : 'kg'})
          </Label>
          <Input
            id={`edit-order-quantity-${order.id}`}
            type="number"
            min="0"
            step={isShop ? '1' : '0.01'}
            inputMode={isShop ? 'numeric' : 'decimal'}
            value={form.quantity}
            onChange={(event) =>
              setForm((current) => ({ ...current, quantity: event.target.value }))
            }
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`edit-order-price-${order.id}`}>
            Preț ({isShop ? 'lei/caserolă' : 'lei/kg'})
          </Label>
          <Input
            id={`edit-order-price-${order.id}`}
            type="number"
            min="0"
            step={isShop ? '1' : '0.01'}
            inputMode="decimal"
            value={form.price}
            readOnly={isZeroPriceKind}
            disabled={isZeroPriceKind}
            onChange={(event) =>
              setForm((current) => ({ ...current, price: event.target.value }))
            }
          />
        </div>

        <AppDatePicker
          id={`edit-order-delivery-date-${order.id}`}
          label="Data livrare"
          value={form.deliveryDate}
          onChange={(value) => setForm((current) => ({ ...current, deliveryDate: value }))}
        />
      </div>

      {isShop && price !== 20 ? (
        <p className="text-xs font-semibold text-[var(--status-warning-text)]">
          ⚠ Prețul standard este 20 lei/caserolă
        </p>
      ) : null}

      <div className="flex items-center justify-between rounded-xl bg-[var(--surface-card-muted)] px-4 py-3">
        <span className="text-sm font-semibold text-[var(--text-secondary)]">Total calculat</span>
        <strong className="text-lg tabular-nums text-[var(--text-primary)]">
          {new Intl.NumberFormat('ro-RO', { maximumFractionDigits: 2 }).format(total)} lei
        </strong>
      </div>

      <div className="space-y-1.5">
        <Label>Status</Label>
        <div className="flex flex-wrap gap-1.5">
          {statusOptions.map((status) => {
            const isActive = form.status === status
            const isDisabled = statusOptions.length <= 1
            return (
              <button
                key={status}
                type="button"
                aria-pressed={isActive}
                disabled={isDisabled}
                onClick={() => setForm((current) => ({ ...current, status }))}
                className={cn(
                  'inline-flex min-h-8 items-center justify-center rounded-full border px-3 text-sm font-medium transition',
                  isActive
                    ? 'border-[var(--status-success-border)] bg-[var(--status-success-bg)] text-[var(--success-text)]'
                    : 'border-[var(--border-default)] bg-[var(--surface-card)] text-[var(--text-primary)] hover:bg-[var(--surface-card-muted)]',
                  isDisabled && 'cursor-default opacity-60',
                )}
              >
                {isShop
                  ? SHOP_STATUS_LABELS[status as ShopOrderStatus]
                  : B2B_STATUS_LABELS[status as ComandaStatus]}
              </button>
            )
          })}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`edit-order-notes-${order.id}`}>Observații</Label>
        <Textarea
          id={`edit-order-notes-${order.id}`}
          className="min-h-[2.75rem] md:min-h-[3rem]"
          maxLength={1000}
          value={form.notes}
          onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
        />
      </div>
    </div>
  )

  const actions = (
    <>
      <Button type="button" variant="outline" disabled={saving} onClick={() => onOpenChange(false)}>
        Anulează
      </Button>
      <Button type="button" disabled={saving} onClick={() => void save()}>
        {saving ? 'Se salvează...' : 'Salvează'}
      </Button>
    </>
  )

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="max-h-[92dvh] overflow-y-auto rounded-t-[28px]">
          <SheetHeader>
            <SheetTitle>Editează comanda</SheetTitle>
            <SheetDescription>{order.customerName}</SheetDescription>
          </SheetHeader>
          {content}
          <SheetFooter>{actions}</SheetFooter>
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(94vw,560px)] max-w-[560px] gap-0 p-0">
        <DialogHeader className="px-5 pb-3 pt-5">
          <DialogTitle>Editează comanda</DialogTitle>
          <DialogDescription>{order.customerName}</DialogDescription>
        </DialogHeader>
        {content}
        <DialogFooter className="px-5 py-4">{actions}</DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
