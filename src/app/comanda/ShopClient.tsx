'use client'

import Image from 'next/image'
import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react'

import { ShopNotifPrompt } from '@/components/shop/ShopNotifPrompt'
import {
  computeZmeuraTotalLei,
  ZMEURA_CASEROLA_PRICE_LEI,
  ZMEURA_KG_PRICE_LEI,
  ZMEURA_PRODUCT_ID,
} from '@/lib/shop/pricing'
import { normalizeRomanianMobilePhone, ROMANIAN_PHONE_ERROR } from '@/lib/shop/phone'
import { markNotificationPromptSession, shouldShowNotificationPrompt } from '@/lib/shop/useNotificationPrompt'
import styles from './comanda.module.css'

const WA_NUMBER = '40752953048'
const WA_BASE = `https://wa.me/${WA_NUMBER}`
const FACEBOOK_HREF = 'https://www.facebook.com/ZmeuraSuceava/'
const INSTAGRAM_HREF = 'https://www.instagram.com/zmeurel_sv/'
const PHONE_HREF = 'tel:+40752953048'
const PHONE_LABEL = '+40 752 953 048'
const FARM_ADDRESS = 'Văratec, jud. Suceava'
const FARM_PICKUP_SCHEDULE = 'Ridicare zilnic 9:00–18:00'
const FARM_MAP_HREF = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(FARM_ADDRESS)}`
const CUSTOMER_CACHE_TTL_MS = 90 * 24 * 60 * 60 * 1000
const DELIVERY_CITY_SUGGESTIONS = [
  'Suceava',
  'Salcea',
  'Văratec',
  'Șcheia',
  'Ipotești',
  'Bosanci',
  'Mitocu Dragomirnei',
  'Moara',
  'Adâncata',
  'Verești',
] as const
const DELIVERY_CITIES_DATALIST_ID = 'shop-delivery-cities'

type CheckoutFieldErrors = {
  name?: string
  phone?: string
  city?: string
  address?: string
  cart?: string
}

type AcquisitionSource = 'facebook' | 'instagram' | 'recomandare' | 'google' | 'altceva'

const ACQUISITION_SOURCE_OPTIONS: Array<{ value: AcquisitionSource; label: string }> = [
  { value: 'facebook', label: '📘 Facebook' },
  { value: 'instagram', label: '📸 Instagram' },
  { value: 'recomandare', label: '👥 Recomandare' },
  { value: 'google', label: '🔍 Google' },
  { value: 'altceva', label: '➕ Altceva' },
]

export type ComandaShopProduct = {
  id: string
  name: string
  description: string | null
  unit_label: string
  price_lei: number | null
  available: boolean
  sort_order: number
}

type CartLine = {
  product: ComandaShopProduct
  qty: number
}

type DeliveryMode = 'livrare' | 'ridicare'

type CustomerSnapshot = {
  name: string
  phone: string
  delivery_address: string
  delivery_city: string
  delivery_mode: DeliveryMode
  savedAt: number
}

type LastOrderItem = {
  product_id: string
  name: string
  quantity: number
  unit_label: string
  price_lei: number
}

type LastOrder = {
  items: LastOrderItem[]
  total_lei: number
  created_at: string
}

function formatLei(value: number) {
  return new Intl.NumberFormat('ro-RO', { maximumFractionDigits: 0 }).format(value)
}

function formatKg(qty: number) {
  return new Intl.NumberFormat('ro-RO', { maximumFractionDigits: 1 }).format(qty / 2)
}

function formatOrderDate(value: string): string {
  return new Intl.DateTimeFormat('ro-RO', { day: '2-digit', month: 'short' }).format(new Date(value))
}

function summarizeLastOrder(items: LastOrderItem[]): string {
  return items
    .slice(0, 3)
    .map((item) => `${item.name} x${item.quantity}`)
    .join(', ')
}

export function normalizeCustomerPhone(value: string): string {
  const normalized = normalizeRomanianMobilePhone(value)
  return normalized ? normalized.slice(1) : ''
}

function customerStorageKey(normalizedPhone: string): string {
  return `zmeurel_c_${normalizedPhone}`
}

function legacyCustomerStorageKey(normalizedPhone: string): string {
  return `zmeurel_customer_${normalizedPhone}`
}

export function validateCheckoutForm(input: {
  orderName: string
  orderPhone: string
  orderCity: string
  orderAddress: string
  deliveryMode: DeliveryMode
  cartLineCount: number
}): CheckoutFieldErrors {
  const errors: CheckoutFieldErrors = {}

  if (input.orderName.trim().length < 2) {
    errors.name = 'Numele trebuie să aibă cel puțin 2 caractere.'
  }

  if (!normalizeRomanianMobilePhone(input.orderPhone)) {
    errors.phone = ROMANIAN_PHONE_ERROR
  }

  if (input.cartLineCount === 0) {
    errors.cart = 'Coșul este gol.'
  }

  if (input.deliveryMode === 'livrare') {
    if (!input.orderCity.trim()) {
      errors.city = 'Completează localitatea.'
    }
    if (input.orderAddress.trim().length < 5) {
      errors.address = 'Adresa trebuie să aibă cel puțin 5 caractere.'
    }
  }

  return errors
}

function coerceDeliveryMode(value: unknown): DeliveryMode {
  return value === 'ridicare' ? 'ridicare' : 'livrare'
}

export function readCustomerSnapshotFromStorage(phone: string): CustomerSnapshot | null {
  if (typeof window === 'undefined') return null

  const normalizedPhone = normalizeCustomerPhone(phone)
  if (normalizedPhone.length < 9) return null

  try {
    const raw =
      window.localStorage.getItem(customerStorageKey(normalizedPhone)) ??
      window.localStorage.getItem(legacyCustomerStorageKey(normalizedPhone))
    if (!raw) return null

    const parsed = JSON.parse(raw) as Partial<CustomerSnapshot>
    if (typeof parsed.savedAt !== 'number' || Date.now() - parsed.savedAt > CUSTOMER_CACHE_TTL_MS) {
      window.localStorage.removeItem(customerStorageKey(normalizedPhone))
      return null
    }

    return {
      name: typeof parsed.name === 'string' ? parsed.name : '',
      phone: normalizedPhone,
      delivery_address: typeof parsed.delivery_address === 'string' ? parsed.delivery_address : '',
      delivery_city: typeof parsed.delivery_city === 'string' ? parsed.delivery_city : '',
      delivery_mode: coerceDeliveryMode(parsed.delivery_mode),
      savedAt: parsed.savedAt,
    }
  } catch {
    return null
  }
}

export function writeCustomerSnapshotToStorage(snapshot: Omit<CustomerSnapshot, 'savedAt'>): void {
  if (typeof window === 'undefined') return

  const normalizedPhone = normalizeCustomerPhone(snapshot.phone)
  if (normalizedPhone.length < 9) return

  try {
    window.localStorage.setItem(
      customerStorageKey(normalizedPhone),
      JSON.stringify({
        ...snapshot,
        phone: normalizedPhone,
        savedAt: Date.now(),
      }),
    )
  } catch {
    // localStorage is best-effort.
  }
}

function buildWaMessage(input: {
  lines: CartLine[]
  total: number
  name: string
  phone: string
  deliveryMode: DeliveryMode
  address: string
  notes: string
}) {
  const productLines = input.lines
    .map((line) => {
      const sub = computeZmeuraTotalLei(line.qty)
      return `• ${line.product.unit_label} × ${line.qty} = ${formatLei(sub)} lei`
    })
    .join('\n')

  const deliveryLine =
    input.deliveryMode === 'livrare'
      ? `Livrare la: ${input.address.trim()}`
      : 'Ridicare de la fermă'

  const notesBlock = input.notes.trim() ? `\nObservații: ${input.notes.trim()}` : ''

  return `Comandă nouă — Zmeurel 🍓

${productLines}
TOTAL: ${formatLei(input.total)} lei

Nume: ${input.name.trim()}
Telefon: ${input.phone.trim()}
${deliveryLine}${notesBlock}`
}

function ZmeurelLogo({
  className = '',
  wordmarkClassName = 'text-[#F16B6B]',
}: {
  className?: string
  wordmarkClassName?: string
}) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Image
        src="/icons/icon.svg"
        alt="Zmeurel"
        width={36}
        height={36}
        unoptimized
        className="shrink-0 rounded-[10px]"
      />
      <span className={`text-[22px] font-semibold tracking-tight ${wordmarkClassName} ${styles.fontDisplay}`}>
        Zmeurel
      </span>
    </div>
  )
}

function CheckoutOrderSummary({ lines, total }: { lines: CartLine[]; total: number }) {
  const totalQty = lines.reduce((sum, line) => sum + line.qty, 0)

  return (
    <section className="rounded-[18px] bg-[#FFF6F3] px-4 py-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-bold text-[#312E3F]">Sumar comandă</p>
          <p className="mt-1 text-xs text-[#312E3F]/65">
            {totalQty} {totalQty === 1 ? 'caserolă' : 'caserole'} · {formatKg(totalQty)} kg
          </p>
        </div>
        <p className="text-xl font-extrabold tabular-nums text-[#F16B6B]">{formatLei(total)} lei</p>
      </div>
      <ul className="mt-3 space-y-1.5 text-[13px] text-[#312E3F]">
        {lines.map((line) => {
          const lineTotal = computeZmeuraTotalLei(line.qty)
          return (
            <li key={line.product.id} className="flex items-center justify-between gap-3">
              <span>Zmeură · caserolă 500g × {line.qty}</span>
              <span className="shrink-0 font-semibold tabular-nums">{formatLei(lineTotal)} lei</span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

export function ShopClient({
  products,
  loadError,
}: {
  products: ComandaShopProduct[]
  loadError: string | null
}) {
  const available = useMemo(
    () => products.filter((product) => product.available && product.id === ZMEURA_PRODUCT_ID),
    [products],
  )
  const primaryProduct = available[0] ?? products.find((product) => product.id === ZMEURA_PRODUCT_ID) ?? null

  const [qtyById, setQtyById] = useState<Record<string, number>>(() =>
    available[0] ? { [available[0].id]: 1 } : {},
  )
  const [sheetOpen, setSheetOpen] = useState(false)
  const [orderName, setOrderName] = useState('')
  const [orderPhone, setOrderPhone] = useState('')
  const [deliveryMode, setDeliveryMode] = useState<DeliveryMode>('livrare')
  const [orderAddress, setOrderAddress] = useState('')
  const [orderCity, setOrderCity] = useState('')
  const [orderNotes, setOrderNotes] = useState('')
  const [orderSubmitting, setOrderSubmitting] = useState(false)
  const [orderError, setOrderError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<CheckoutFieldErrors>({})
  const [orderSuccess, setOrderSuccess] = useState(false)
  const [phoneTouched, setPhoneTouched] = useState(false)
  const [sourcePromptVisible, setSourcePromptVisible] = useState(false)
  const [sourceSaved, setSourceSaved] = useState(false)
  const [notificationPromptVisible, setNotificationPromptVisible] = useState(false)
  const [pendingNotifPrompt, setPendingNotifPrompt] = useState(false)
  const [customerAutofillNotice, setCustomerAutofillNotice] = useState<string | null>(null)
  const [recognizedCustomerPhone, setRecognizedCustomerPhone] = useState<string | null>(null)
  const [lastOrder, setLastOrder] = useState<LastOrder | null>(null)
  const [lastOrderApplied, setLastOrderApplied] = useState(false)
  const lastCustomerLookupPhoneRef = useRef<string | null>(null)

  const nameFieldRef = useRef<HTMLDivElement>(null)
  const phoneFieldRef = useRef<HTMLDivElement>(null)
  const cityFieldRef = useRef<HTMLDivElement>(null)
  const addressFieldRef = useRef<HTMLDivElement>(null)
  const cartErrorRef = useRef<HTMLParagraphElement>(null)

  useEffect(() => {
    if (sheetOpen || !pendingNotifPrompt) return

    const frame = window.requestAnimationFrame(() => {
      setPendingNotifPrompt(false)
      if (shouldShowNotificationPrompt()) {
        markNotificationPromptSession()
        setNotificationPromptVisible(true)
      }
    })

    return () => window.cancelAnimationFrame(frame)
  }, [pendingNotifPrompt, sheetOpen])

  const applyCustomerSnapshot = useCallback((snapshot: CustomerSnapshot, source: 'local' | 'api') => {
    if (snapshot.name) setOrderName(snapshot.name)
    if (snapshot.delivery_address) setOrderAddress(snapshot.delivery_address)
    if (snapshot.delivery_city) setOrderCity(snapshot.delivery_city)
    setDeliveryMode(snapshot.delivery_mode)
    setRecognizedCustomerPhone(snapshot.phone)
    setLastOrderApplied(false)
    void source
    setCustomerAutofillNotice('✓ Date preluate')
  }, [])

  const updateOrderName = useCallback((value: string) => {
    setOrderName(value)
    setCustomerAutofillNotice(null)
  }, [])

  const updateOrderPhone = useCallback((value: string) => {
    setOrderPhone(value)
    setPhoneTouched(true)
    setFieldErrors((current) => {
      if (!current.phone) return current
      const next = { ...current }
      delete next.phone
      return next
    })

    const rawDigits = value.replace(/\D+/g, '')
    const normalizedPhone = normalizeCustomerPhone(value)
    if (rawDigits.length >= 10 && normalizedPhone.length >= 9) return

    lastCustomerLookupPhoneRef.current = null
    setCustomerAutofillNotice(null)
    setRecognizedCustomerPhone(null)
    setLastOrder(null)
    setLastOrderApplied(false)
  }, [])

  const normalizeOrderPhoneOnBlur = useCallback(() => {
    setPhoneTouched(true)
    const normalized = normalizeRomanianMobilePhone(orderPhone)
    if (normalized) setOrderPhone(normalized)
  }, [orderPhone])

  useEffect(() => {
    if (!customerAutofillNotice) return
    const timeout = window.setTimeout(() => setCustomerAutofillNotice(null), 3000)
    return () => window.clearTimeout(timeout)
  }, [customerAutofillNotice])

  useEffect(() => {
    const rawDigits = orderPhone.replace(/\D+/g, '')
    const normalizedPhone = normalizeCustomerPhone(orderPhone)

    if (rawDigits.length < 10 || normalizedPhone.length < 9) {
      lastCustomerLookupPhoneRef.current = null
      return
    }

    if (lastCustomerLookupPhoneRef.current === normalizedPhone) return
    lastCustomerLookupPhoneRef.current = normalizedPhone

    const cached = readCustomerSnapshotFromStorage(orderPhone)
    if (cached) {
      const cachedApplyTimeout = window.setTimeout(() => {
        applyCustomerSnapshot(cached, 'local')
      }, 0)
      return () => window.clearTimeout(cachedApplyTimeout)
    }

    const controller = new AbortController()
    const timeout = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/shop/b2c/customer?phone=${encodeURIComponent(orderPhone)}`, {
          signal: controller.signal,
        })
        if (!res.ok) return

        const data = (await res.json()) as {
          found?: boolean
          name?: string
          delivery_address?: string
          delivery_city?: string
          delivery_mode?: string
        }
        if (!data.found) return

        applyCustomerSnapshot(
          {
            name: data.name ?? '',
            phone: normalizedPhone,
            delivery_address: data.delivery_address ?? '',
            delivery_city: data.delivery_city ?? '',
            delivery_mode: coerceDeliveryMode(data.delivery_mode),
            savedAt: Date.now(),
          },
          'api',
        )
      } catch {
        // Offline/error fallback is the localStorage path above.
      }
    }, 500)

    return () => {
      controller.abort()
      window.clearTimeout(timeout)
    }
  }, [applyCustomerSnapshot, orderPhone])

  useEffect(() => {
    if (!recognizedCustomerPhone) return

    const lookupPhone = recognizedCustomerPhone
    const controller = new AbortController()
    async function loadLastOrder() {
      try {
        const res = await fetch(
          `/api/shop/b2c/customer/last-order?phone=${encodeURIComponent(lookupPhone)}`,
          { signal: controller.signal },
        )
        if (!res.ok) return

        const data = (await res.json()) as {
          found?: boolean
          items?: LastOrderItem[]
          total_lei?: number
          created_at?: string
        }
        if (!data.found || !Array.isArray(data.items) || !data.created_at || typeof data.total_lei !== 'number') {
          setLastOrder(null)
          return
        }

        setLastOrder({
          items: data.items,
          total_lei: data.total_lei,
          created_at: data.created_at,
        })
      } catch {
        // Last order is an enhancement; the checkout must keep working without it.
      }
    }

    void loadLastOrder()
    return () => controller.abort()
  }, [recognizedCustomerPhone])

  const cartLines = useMemo((): CartLine[] => {
    return available
      .filter((p) => (qtyById[p.id] ?? 0) > 0)
      .map((p) => ({ product: p, qty: qtyById[p.id] ?? 0 }))
  }, [available, qtyById])

  const cartCount = useMemo(() => cartLines.reduce((s, l) => s + l.qty, 0), [cartLines])
  const cartTotal = useMemo(() => computeZmeuraTotalLei(cartCount), [cartCount])
  const primaryQty = primaryProduct ? (qtyById[primaryProduct.id] ?? 0) : 0
  const normalizedOrderPhone = normalizeRomanianMobilePhone(orderPhone)
  const hasValidIdentity = orderName.trim().length >= 2 && normalizedOrderPhone !== null
  const visiblePhoneError =
    fieldErrors.phone ?? (phoneTouched && !normalizedOrderPhone ? ROMANIAN_PHONE_ERROR : undefined)

  const setQty = useCallback((id: string, next: number) => {
    setQtyById((prev) => {
      const value = Math.max(0, Math.min(99, next))
      if (value === 0) {
        const next = { ...prev }
        delete next[id]
        return next
      }
      return { ...prev, [id]: value }
    })
  }, [])

  const reorderLastOrder = useCallback(() => {
    if (!lastOrder) return

    setQtyById((prev) => {
      const next = { ...prev }
      for (const item of lastOrder.items) {
        if (available.some((product) => product.id === item.product_id)) {
          next[item.product_id] = Math.max(1, Math.min(99, Math.round(item.quantity)))
        }
      }
      return next
    })
    setLastOrderApplied(true)
  }, [available, lastOrder])

  const openCheckout = useCallback(() => {
    if (primaryProduct?.available && primaryQty === 0) {
      setQty(primaryProduct.id, 1)
    }
    setOrderSuccess(false)
    setNotificationPromptVisible(false)
    setPendingNotifPrompt(false)
    setOrderError(null)
    setSheetOpen(true)
  }, [primaryProduct, primaryQty, setQty])

  const submitAcquisitionSource = async (source: AcquisitionSource) => {
    try {
      const res = await fetch('/api/shop/b2c/customer/source', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: orderPhone,
          source,
        }),
      })
      const json = (await res.json()) as { ok?: boolean }
      if (res.ok && json.ok) {
        setSourceSaved(true)
        setSourcePromptVisible(false)
      }
    } catch {
      // This survey is optional; checkout success must not depend on it.
    }
  }

  const scrollToFirstFieldError = useCallback((errors: CheckoutFieldErrors) => {
    const targets: Array<[keyof CheckoutFieldErrors, RefObject<HTMLElement | null>]> = [
      ['name', nameFieldRef],
      ['phone', phoneFieldRef],
      ['city', cityFieldRef],
      ['address', addressFieldRef],
      ['cart', cartErrorRef],
    ]

    for (const [key, ref] of targets) {
      if (errors[key] && ref.current) {
        ref.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
        break
      }
    }
  }, [])

  const submitOrder = async () => {
    const validationErrors = validateCheckoutForm({
      orderName,
      orderPhone,
      orderCity,
      orderAddress,
      deliveryMode,
      cartLineCount: cartLines.length,
    })

    if (Object.keys(validationErrors).length > 0) {
      setFieldErrors(validationErrors)
      setPhoneTouched(true)
      setOrderError(null)
      scrollToFirstFieldError(validationErrors)
      return
    }

    if (!normalizedOrderPhone) return

    setFieldErrors({})
    setOrderSubmitting(true)
    setOrderError(null)
    setOrderSuccess(false)
    setNotificationPromptVisible(false)
    setPendingNotifPrompt(false)

    const items = cartLines.map((line) => ({
      vid: line.product.id,
      label: `${line.product.name} — ${line.product.unit_label}`,
      qty: line.qty,
      price_lei: ZMEURA_CASEROLA_PRICE_LEI,
    }))

    try {
      const res = await fetch('/api/shop/b2c/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_name: orderName.trim(),
          customer_phone: normalizedOrderPhone,
          delivery_mode: deliveryMode,
          delivery_address: deliveryMode === 'livrare' ? orderAddress.trim() : undefined,
          delivery_city: deliveryMode === 'livrare' ? orderCity.trim() || undefined : undefined,
          items,
          total_lei: cartTotal,
          notes: orderNotes.trim() || undefined,
        }),
      })
      const json = (await res.json()) as { success?: boolean; error?: string; order_id?: string }
      if (!res.ok || !json.success) {
        setOrderError(json.error ?? 'Nu am putut salva comanda.')
        setOrderSubmitting(false)
        return
      }

      setOrderSuccess(true)
      setNotificationPromptVisible(false)
      setPendingNotifPrompt(true)
      setSourcePromptVisible(true)
      setSourceSaved(false)
      writeCustomerSnapshotToStorage({
        name: orderName.trim(),
        phone: normalizedOrderPhone,
        delivery_address: orderAddress.trim(),
        delivery_city: orderCity.trim(),
        delivery_mode: deliveryMode,
      })
      const message = buildWaMessage({
        lines: cartLines,
        total: cartTotal,
        name: orderName,
        phone: normalizedOrderPhone,
        deliveryMode,
        address: orderAddress,
        notes: orderNotes,
      })
      window.open(`${WA_BASE}?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer')

      setQtyById(primaryProduct?.available ? { [primaryProduct.id]: 1 } : {})
      setOrderSubmitting(false)
    } catch {
      setOrderError('Eroare de rețea. Încearcă din nou.')
      setOrderSubmitting(false)
    }
  }

  return (
    <div className="w-full pb-32">
      <header className="sticky top-0 z-40 border-b-4 border-[#F16B6B] bg-[#312E3F] px-4 py-3">
        <ZmeurelLogo wordmarkClassName="text-white" />
      </header>

      {loadError ? (
        <p className="mx-3 mt-3 rounded-2xl bg-white px-4 py-3 text-sm font-medium text-[#E15453] shadow-sm">
          {loadError}
        </p>
      ) : null}

      <main>
        <section className="relative aspect-[25/14] overflow-hidden bg-[#312E3F]">
          <Image
            src="/shop/shop-hero.jpg"
            alt="Caserolă cu zmeură proaspătă ținută în mână, în plantația din Văratec"
            fill
            priority
            sizes="(max-width: 640px) 100vw, 540px"
            className="object-cover object-bottom"
          />
          <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-[#312E3F]/35 to-transparent" aria-hidden />
          <span className="absolute left-4 top-4 rounded-full bg-[#FFF6F3]/95 px-3 py-2 text-xs font-bold text-[#3D7A5F] shadow-md backdrop-blur-sm">
            ✓ Culeasă în ziua livrării
          </span>
        </section>

        <section className="relative z-10 mx-3 -mt-11 rounded-[26px] bg-white p-[18px] shadow-[0_12px_36px_rgba(120,100,70,0.16)]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className={`text-[26px] font-semibold leading-tight text-[#312E3F] ${styles.fontDisplay}`}>
                Zmeură proaspătă
              </h1>
              <p className="mt-1 text-sm font-medium text-[#312E3F]/65">Caserolă 500g · Văratec, Suceava</p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-[28px] font-extrabold leading-none tabular-nums text-[#F16B6B]">
                {formatLei(cartTotal)} lei
              </p>
              <p className="mt-1 text-[11px] font-semibold text-[#3D7A5F]">
                {formatLei(ZMEURA_KG_PRICE_LEI)} lei/kg
              </p>
            </div>
          </div>

          {primaryProduct?.available ? (
            <>
              <div className="mt-4 flex items-center justify-center gap-4">
                <button
                  type="button"
                  aria-label="Scade cantitatea"
                  onClick={() => setQty(primaryProduct.id, Math.max(1, primaryQty - 1))}
                  className="grid h-[54px] w-[54px] place-items-center rounded-2xl bg-[#FFF6F3] text-[28px] font-medium text-[#312E3F] shadow-sm transition active:scale-[0.985] active:shadow-none"
                >
                  −
                </button>
                <span className="min-w-16 text-center text-[32px] font-extrabold tabular-nums text-[#312E3F]">
                  {primaryQty}
                </span>
                <button
                  type="button"
                  aria-label="Crește cantitatea"
                  onClick={() => setQty(primaryProduct.id, primaryQty + 1)}
                  className="grid h-[54px] w-[54px] place-items-center rounded-2xl bg-[#F16B6B] text-[28px] font-medium text-white shadow-md transition active:scale-[0.985] active:shadow-sm"
                >
                  +
                </button>
              </div>
              <p className="mt-1 text-center text-sm font-semibold text-[#312E3F]/70">
                {primaryQty} {primaryQty === 1 ? 'caserolă' : 'caserole'} · {formatKg(primaryQty)} kg
              </p>

              <div className="mt-3 grid grid-cols-4 gap-2" aria-label="Cantități rapide">
                {[1, 2, 4, 6].map((qty) => (
                  <button
                    key={qty}
                    type="button"
                    aria-label={`Alege ${qty} ${qty === 1 ? 'caserolă' : 'caserole'}`}
                    aria-pressed={primaryQty === qty}
                    onClick={() => setQty(primaryProduct.id, qty)}
                    className={`min-h-11 rounded-xl text-sm font-bold transition active:scale-[0.985] ${
                      primaryQty === qty
                        ? 'bg-[#312E3F] text-white shadow-sm'
                        : 'bg-[#FFF6F3] text-[#312E3F]'
                    }`}
                  >
                    {qty}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={openCheckout}
                className="mt-4 min-h-[54px] w-full rounded-2xl bg-[#F16B6B] px-5 text-base font-extrabold text-white shadow-[0_8px_20px_rgba(241,107,107,0.3)] transition active:scale-[0.985] active:shadow-sm"
              >
                Comandă acum · {formatLei(cartTotal)} lei
              </button>
              <p className="mt-3 text-center text-[11px] font-semibold leading-relaxed text-[#312E3F]/60">
                ✓ Culeasă în ziua livrării · ✓ Livrare locală · ✓ Plată cash
              </p>
            </>
          ) : (
            <p className="mt-4 rounded-2xl bg-[#FFF6F3] px-4 py-4 text-sm font-semibold text-[#312E3F]">
              Zmeura nu este disponibilă momentan. Revino curând.
            </p>
          )}
        </section>

        <section className="mt-8 px-3">
          <div className="grid grid-cols-3 gap-2">
            <Benefit icon="🚚" label="Livrare locală" />
            <Benefit icon="🌿" label="Culeasă în ziua livrării" />
            <Benefit icon="🧺" label="De la fermă" />
          </div>
          <div className="relative mt-4 aspect-[2/1] overflow-hidden rounded-[24px] bg-[#F3DAD4] shadow-md">
            <Image
              src="/shop/shop-ferma.jpg"
              alt="Ferma Zmeurel din Văratec"
              fill
              sizes="(max-width: 640px) 100vw, 540px"
              className="object-cover object-center"
            />
            <span className="absolute bottom-3 left-3 rounded-full bg-[#312E3F]/85 px-3 py-1.5 text-xs font-semibold text-white">
              Direct de la fermă
            </span>
          </div>
        </section>

        <footer className="mt-8 border-t-4 border-[#F16B6B] bg-[#312E3F] px-5 pb-10 pt-8 text-white">
          <FooterBrand />
          <div className="mt-6 space-y-2 text-sm">
            <a
              href={PHONE_HREF}
              className="flex min-h-11 items-center gap-3 rounded-xl bg-white/10 px-3 font-semibold transition active:scale-[0.985]"
            >
              <span aria-hidden>☎</span>
              {PHONE_LABEL}
            </a>
            <div className="flex min-h-11 items-center gap-3 rounded-xl bg-white/10 px-3">
              <span aria-hidden>⌖</span>
              {FARM_ADDRESS}
            </div>
          </div>
          <div className="mt-5 grid gap-2 min-[390px]:grid-cols-3">
            <FooterSocialLink href={WA_BASE} label="WhatsApp" className="bg-[#25D366]">
              <FooterWhatsAppIcon />
            </FooterSocialLink>
            <FooterSocialLink href={FACEBOOK_HREF} label="Facebook" className="bg-[#1877F2]">
              <FooterFacebookIcon />
            </FooterSocialLink>
            <FooterSocialLink
              href={INSTAGRAM_HREF}
              label="Instagram"
              className="bg-gradient-to-br from-[#833AB4] via-[#E4405F] to-[#FCAF45]"
            >
              <FooterInstagramIcon />
            </FooterSocialLink>
          </div>
          <p className="mt-6 text-xs text-white/60">© {new Date().getFullYear()} Zmeurel · Văratec</p>
        </footer>
      </main>

      {primaryProduct?.available && cartCount > 0 ? (
        <div className="fixed inset-x-0 bottom-0 z-50 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="mx-auto flex max-w-[540px] items-center justify-between gap-3 rounded-[20px] bg-[#312E3F] px-4 py-3 text-white shadow-[0_12px_34px_rgba(49,46,63,0.3)]">
            <div>
              <p className="text-xs font-medium text-white/65">
                {cartCount} {cartCount === 1 ? 'caserolă' : 'caserole'} · {formatKg(cartCount)} kg
              </p>
              <p className="text-lg font-extrabold tabular-nums">{formatLei(cartTotal)} lei</p>
            </div>
            <button
              type="button"
              onClick={openCheckout}
              className="min-h-12 shrink-0 rounded-2xl bg-[#F16B6B] px-5 text-sm font-extrabold text-white transition active:scale-[0.985]"
            >
              Comandă acum
            </button>
          </div>
        </div>
      ) : null}

      {/* ORDER SHEET */}
      {sheetOpen ? (
        <div className="fixed inset-0 z-[60] flex flex-col justify-end">
          <button
            type="button"
            aria-label="Închide"
            className={`absolute inset-0 bg-black/40 ${styles.sheetBackdrop}`}
            onClick={() => !orderSubmitting && setSheetOpen(false)}
          />
          <div
            className={`relative mx-auto max-h-[90dvh] w-full max-w-[540px] overflow-y-auto rounded-t-[26px] bg-white px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 ${styles.sheetPanel}`}
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-[#F3DAD4]" aria-hidden />
            <h2 className={`text-xl font-semibold text-[#312E3F] ${styles.fontDisplay}`}>Finalizează comanda</h2>

            {orderSuccess ? (
              <div className="mt-4 space-y-3">
                <p className="rounded-xl bg-[#E8F5EE] px-4 py-3 text-sm font-medium text-[#0D9B5C]">
                  Comanda a fost salvată. WhatsApp s-a deschis cu mesajul pregătit — trimite-l pentru confirmare.
                </p>

                {sourcePromptVisible ? (
                  <div className="rounded-2xl border border-[#F3DAD4] bg-[#FFF6F3] p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold text-[#312E3F]">Cum ai aflat de noi?</p>
                        <p className="mt-0.5 text-xs text-[#312E3F]/65">Opțional, ne ajută să înțelegem ce merge.</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSourcePromptVisible(false)}
                        className="rounded-full px-2 py-1 text-xs font-semibold text-[#312E3F]/55"
                      >
                        Închide
                      </button>
                    </div>
                    <div className="mt-3 grid grid-cols-1 gap-2 min-[360px]:grid-cols-2">
                      {ACQUISITION_SOURCE_OPTIONS.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => submitAcquisitionSource(option.value)}
                          className="rounded-xl border border-[#F3DAD4] bg-white px-3 py-3 text-left text-sm font-semibold text-[#312E3F] active:scale-[0.98]"
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : sourceSaved ? (
                  <p className="rounded-xl bg-[#E8F5EE] px-4 py-3 text-xs font-medium text-[#0D9B5C]">
                    Mulțumim! Am salvat răspunsul.
                  </p>
                ) : null}
              </div>
            ) : (
              <>
                <div className="mt-4">
                  <CheckoutOrderSummary lines={cartLines} total={cartTotal} />
                </div>

                <div className="mt-4 space-y-3">
                  <div ref={phoneFieldRef}>
                    <Field
                      label="Telefon"
                      value={orderPhone}
                      onChange={updateOrderPhone}
                      onBlur={normalizeOrderPhoneOnBlur}
                      autoComplete="tel"
                      inputMode="tel"
                      placeholder="07xx xxx xxx"
                      error={visiblePhoneError}
                      autoFocus
                    />
                    {!recognizedCustomerPhone ? (
                      <p className="mt-1 text-xs text-[#6b7280]">
                        Dacă ai mai comandat, completăm datele automat.
                      </p>
                    ) : null}
                  </div>
                  <div ref={nameFieldRef}>
                    <Field
                      label="Nume"
                      value={orderName}
                      onChange={updateOrderName}
                      autoComplete="name"
                      error={fieldErrors.name}
                    />
                    {customerAutofillNotice ? (
                      <p className="mt-1 text-xs font-semibold text-[#3D7A5F]">{customerAutofillNotice}</p>
                    ) : null}
                  </div>

                  <div>
                    <p className="mb-2 text-xs font-semibold text-[#312E3F]">Mod livrare</p>
                    <div className="flex gap-2">
                      <ToggleChip
                        active={deliveryMode === 'livrare'}
                        onClick={() => setDeliveryMode('livrare')}
                        label="Livrare"
                      />
                      <ToggleChip
                        active={deliveryMode === 'ridicare'}
                        onClick={() => setDeliveryMode('ridicare')}
                        label="Ridicare"
                      />
                    </div>
                  </div>

                  {deliveryMode === 'livrare' ? (
                    <>
                      <div ref={cityFieldRef}>
                        <Field
                          label="Localitate"
                          value={orderCity}
                          onChange={setOrderCity}
                          autoComplete="address-level2"
                          list={DELIVERY_CITIES_DATALIST_ID}
                          error={fieldErrors.city}
                        />
                      </div>
                      <datalist id={DELIVERY_CITIES_DATALIST_ID}>
                        {DELIVERY_CITY_SUGGESTIONS.map((city) => (
                          <option key={city} value={city} />
                        ))}
                      </datalist>
                      <div ref={addressFieldRef}>
                        <Field
                          label="Adresă livrare"
                          value={orderAddress}
                          onChange={setOrderAddress}
                          error={fieldErrors.address}
                        />
                      </div>
                    </>
                  ) : (
                    <div className="rounded-[18px] bg-[#FFF6F3] p-4">
                      <p className="text-xs font-bold uppercase tracking-wide text-[#3D7A5F]">Ridicare de la fermă</p>
                      <p className="mt-2 text-sm font-bold text-[#312E3F]">{FARM_ADDRESS}</p>
                      <p className="mt-1 text-xs text-[#312E3F]/70">{FARM_PICKUP_SCHEDULE}</p>
                      <a
                        href={FARM_MAP_HREF}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-3 inline-flex min-h-11 items-center rounded-xl bg-[#3D7A5F] px-4 text-sm font-bold text-white transition active:scale-[0.985]"
                      >
                        Vezi pe hartă
                      </a>
                    </div>
                  )}

                  <label className="block text-xs font-semibold text-[#312E3F]">
                    Observații (opțional)
                    <textarea
                      value={orderNotes}
                      onChange={(e) => setOrderNotes(e.target.value)}
                      rows={2}
                      className="mt-1 w-full resize-none rounded-lg border border-[#F3DAD4] bg-[#FFF6F3] px-3 py-[14px] text-sm outline-none focus:border-[#F16B6B]"
                    />
                  </label>
                </div>

                <p className="mt-4 rounded-xl bg-[#FFF6F3] px-3 py-2 text-xs leading-relaxed text-[#312E3F]/80">
                  Livrăm în Suceava și comunele învecinate. Minim 2 kg în afara municipiului. Nu livrăm prin
                  curier.
                </p>

                <p className="mt-2 rounded-xl bg-[#FFF6F3] px-3 py-2 text-xs font-medium text-[#312E3F]/80">
                  Plată: cash la livrare
                </p>

                {lastOrder && lastOrder.items.length > 0 ? (
                  <div className="mt-3 rounded-xl border border-[#F3DAD4] bg-white px-3 py-3 text-xs text-[#312E3F]">
                    <p className="font-semibold">
                      Ultima comandă: {formatOrderDate(lastOrder.created_at)} — {summarizeLastOrder(lastOrder.items)}
                    </p>
                    <div className="mt-2 flex items-center justify-between gap-3">
                      <span className="text-[#312E3F]/65">{formatLei(lastOrder.total_lei)} lei</span>
                      <button
                        type="button"
                        onClick={reorderLastOrder}
                        className="rounded-full bg-[#F16B6B] px-3 py-2 text-xs font-bold text-white active:scale-[0.98]"
                      >
                        {lastOrderApplied ? 'Adăugat în coș' : 'Comandă din nou'}
                      </button>
                    </div>
                  </div>
                ) : null}

                {fieldErrors.cart ? (
                  <p ref={cartErrorRef} className="mt-3 text-sm text-[#E15453]">
                    {fieldErrors.cart}
                  </p>
                ) : null}

                {orderError ? <p className="mt-3 text-sm text-[#E15453]">{orderError}</p> : null}

                <button
                  type="button"
                  disabled={orderSubmitting || !hasValidIdentity}
                  onClick={submitOrder}
                  className="mt-4 min-h-[52px] w-full rounded-2xl bg-[#F16B6B] px-4 text-sm font-extrabold text-white shadow-[0_8px_20px_rgba(241,107,107,0.25)] transition active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {orderSubmitting ? 'Se salvează…' : 'Trimite comanda'}
                </button>
              </>
            )}

            <button
              type="button"
              className="mt-3 w-full py-2 text-sm font-medium text-[#312E3F]/60"
              onClick={() => setSheetOpen(false)}
            >
              Închide
            </button>
          </div>
        </div>
      ) : null}

      {notificationPromptVisible ? (
        <ShopNotifPrompt onClose={() => setNotificationPromptVisible(false)} />
      ) : null}
    </div>
  )
}

function Benefit({ icon, label }: { icon: string; label: string }) {
  return (
    <div className="flex min-h-[92px] flex-col items-center justify-center rounded-[18px] bg-white px-2 py-3 text-center shadow-[0_4px_16px_rgba(120,100,70,0.08)]">
      <span className="text-xl" aria-hidden>
        {icon}
      </span>
      <p className="mt-1.5 text-[11px] font-bold leading-tight text-[#312E3F]">{label}</p>
    </div>
  )
}

function FooterBrand() {
  return (
    <div>
      <Image
        src="/icons/icon.svg"
        alt="Zmeurel"
        width={54}
        height={54}
        unoptimized
        className="mb-2 block rounded-[14px]"
      />
      <p className={`text-[28px] font-semibold leading-none text-white ${styles.fontDisplay}`}>Zmeurel</p>
      <p
        className={`mt-1 text-sm italic ${styles.fontDisplay}`}
        style={{ color: 'rgba(255,255,255,0.9)' }}
      >
        gust cu zâmbete dulci
      </p>
    </div>
  )
}

function FooterSocialLink({
  href,
  label,
  className,
  children,
}: {
  href: string
  label: string
  className: string
  children: React.ReactNode
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      className={`flex min-h-12 items-center justify-center gap-2 rounded-xl px-3 text-sm font-bold text-white shadow-sm transition active:scale-[0.985] ${className}`}
    >
      {children}
      <span>{label}</span>
    </a>
  )
}

function FooterWhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24" aria-hidden>
      <path d="M12 2a10 10 0 00-8.7 15l-1.3 4.7 4.8-1.3A10 10 0 1012 2zm0 18a8 8 0 01-4-1.1l-.3-.2-2.8.7.8-2.7-.2-.3A8 8 0 1112 20zm4.4-5.6c-.2-.1-1.4-.7-1.6-.8s-.4-.1-.5.1-.6.8-.8 1-.3.2-.5 0a6.5 6.5 0 01-3.2-2.8c-.2-.4.2-.4.6-1.2.1-.2 0-.3 0-.5s-.5-1.3-.7-1.7-.4-.4-.5-.4h-.5a1 1 0 00-.7.3c-.2.3-.9.9-.9 2.1s.9 2.5 1 2.6 1.8 2.7 4.3 3.8c1.6.7 2.2.7 3 .6.5 0 1.4-.6 1.6-1.1s.2-1 .1-1.1-.2-.2-.4-.3z" />
    </svg>
  )
}

function FooterFacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24" aria-hidden>
      <path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z" />
    </svg>
  )
}

function FooterInstagramIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" width="24" height="24" aria-hidden>
      <rect x="4" y="4" width="16" height="16" rx="5" />
      <circle cx="12" cy="12" r="3.6" />
      <circle cx="17" cy="7" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  )
}

function Field({
  label,
  value,
  onChange,
  onBlur,
  autoComplete,
  inputMode,
  list,
  placeholder,
  error,
  autoFocus,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  onBlur?: () => void
  autoComplete?: string
  inputMode?: 'tel' | 'text'
  list?: string
  placeholder?: string
  error?: string
  autoFocus?: boolean
}) {
  return (
    <label className="block text-xs font-semibold text-[#312E3F]">
      {label}
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        list={list}
        placeholder={placeholder}
        className={`mt-1 w-full rounded-lg border bg-white px-3 py-[14px] text-sm outline-none ${
          error ? 'border-[#E15453] focus:border-[#E15453]' : 'border-[#F3DAD4] focus:border-[#F16B6B]'
        }`}
        autoComplete={autoComplete}
        inputMode={inputMode}
        autoFocus={autoFocus}
      />
      {error ? <p className="mt-1 text-xs font-medium text-[#E15453]">{error}</p> : null}
    </label>
  )
}

function ToggleChip({
  active,
  onClick,
  label,
}: {
  active: boolean
  onClick: () => void
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 rounded-full px-3 py-2 text-sm font-semibold transition ${
        active ? 'bg-[#F16B6B] text-white' : 'border border-[#F3DAD4] bg-[#FFF6F3] text-[#312E3F]'
      }`}
    >
      {label}
    </button>
  )
}
