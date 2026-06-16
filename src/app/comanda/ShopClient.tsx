'use client'

import Image from 'next/image'
import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react'

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
import { AppDatePicker } from '@/components/ui/app-date-picker'
import { Input } from '@/components/ui/input'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { ShopNotifPrompt } from '@/components/shop/ShopNotifPrompt'
import {
  CAMPAIGN_DATA,
  isCampaignSnapshot,
  mergeCampaignSnapshot,
  type CampaignData,
  type CampaignMilestone,
} from '@/lib/shop/campaign-mock'
import {
  computeZmeuraTotalLei,
  ZMEURA_CASEROLA_PRICE_LEI,
  ZMEURA_CASEROLE_PER_KG,
  ZMEURA_KG_PRICE_LEI,
  ZMEURA_PRODUCT_ID,
} from '@/lib/shop/pricing'
import { normalizeRomanianMobilePhone, ROMANIAN_PHONE_ERROR } from '@/lib/shop/phone'
import {
  DELIVERY_ZONES,
  LOCALITIES,
  getZoneMinimumMessage,
  type DeliveryZone,
  type LocalityConfig,
  type VillageConfig,
} from '@/lib/shop/delivery-zones'
import { markNotificationPromptSession, shouldShowNotificationPrompt } from '@/lib/shop/useNotificationPrompt'
import { CampaignMeter } from './components/CampaignMeter'
import { CampaignMilestones } from './components/CampaignMilestones'
import { CampaignRules } from './components/CampaignRules'
import { SeasonLeaderboard } from './components/SeasonLeaderboard'
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
const CAMPAIGN_RETRY_DELAYS_MS = [1000, 2000, 4000] as const

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

type OrderRequestPayload = {
  customer_name: string
  customer_phone: string
  delivery_mode: DeliveryMode
  delivery_address?: string
  delivery_city?: string
  campaign_id: string
  idempotencyKey: string
  deliveryZone?: DeliveryZone
  preferredDeliveryDate?: string | null
  items: Array<{
    vid: string
    label: string
    qty: number
    price_lei: number
  }>
  total_lei: number
  notes?: string
}

type RecentShopOrder = {
  found: true
  minutes_ago: number
  items: Array<{
    qty: number
    label: string
  }>
  total_lei: number
  order_kind: string
}

function formatLei(value: number) {
  return new Intl.NumberFormat('ro-RO', { maximumFractionDigits: 0 }).format(value)
}

function formatKg(qty: number) {
  return new Intl.NumberFormat('ro-RO', { maximumFractionDigits: 1 }).format(qty / 2)
}

function formatPriceBreakdown(qty: number): string {
  const pairs = Math.floor(qty / ZMEURA_CASEROLE_PER_KG)
  const remainingCaserole = qty % ZMEURA_CASEROLE_PER_KG
  const parts: string[] = []

  if (pairs > 0) {
    parts.push(`${pairs} ${pairs === 1 ? 'pereche' : 'perechi'} × ${formatLei(ZMEURA_KG_PRICE_LEI)} lei`)
  }
  if (remainingCaserole > 0) {
    parts.push(
      `${remainingCaserole} ${remainingCaserole === 1 ? 'caserolă' : 'caserole'} × ${formatLei(ZMEURA_CASEROLA_PRICE_LEI)} lei`,
    )
  }

  return parts.join(' + ')
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

/** @deprecated Use getZoneMinimumMessage from delivery-zones.ts */
export function getDeliveryMinimumMessage(
  deliveryMode: DeliveryMode,
  zone: DeliveryZone | null,
  totalQty: number,
): string | null {
  if (deliveryMode === 'ridicare') return null
  if (zone === null) return 'Selectează zona de livrare.'
  return getZoneMinimumMessage(zone, totalQty)
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
  const [selectedLocality, setSelectedLocality] = useState<LocalityConfig | null>(null)
  const [selectedVillage, setSelectedVillage] = useState<VillageConfig | null>(null)
  const [deliveryZone, setDeliveryZone] = useState<DeliveryZone | null>(null)
  const [orderAddress, setOrderAddress] = useState('')
  const [orderCity, setOrderCity] = useState('')
  const [preferredDeliveryDate, setPreferredDeliveryDate] = useState('')
  const [preferredDeliveryDateVisible, setPreferredDeliveryDateVisible] = useState(false)
  const [orderNotes, setOrderNotes] = useState('')
  const [orderSubmitting, setOrderSubmitting] = useState(false)
  const [orderError, setOrderError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<CheckoutFieldErrors>({})
  const [orderSuccess, setOrderSuccess] = useState(false)
  const [campaign, setCampaign] = useState<CampaignData | null>(null)
  const [capturedMilestone, setCapturedMilestone] = useState<CampaignMilestone | null>(null)
  const [phoneTouched, setPhoneTouched] = useState(false)
  const [sourcePromptVisible, setSourcePromptVisible] = useState(false)
  const [sourceSaved, setSourceSaved] = useState(false)
  const [notificationPromptVisible, setNotificationPromptVisible] = useState(false)
  const [pendingNotifPrompt, setPendingNotifPrompt] = useState(false)
  const [customerAutofillNotice, setCustomerAutofillNotice] = useState<string | null>(null)
  const [recognizedCustomerPhone, setRecognizedCustomerPhone] = useState<string | null>(null)
  const [lastOrder, setLastOrder] = useState<LastOrder | null>(null)
  const [lastOrderApplied, setLastOrderApplied] = useState(false)
  const [recentOrder, setRecentOrder] = useState<RecentShopOrder | null>(null)
  const [primaryQtyInput, setPrimaryQtyInput] = useState(() =>
    available[0] ? String(qtyById[available[0].id] ?? 1) : '',
  )
  const lastCustomerLookupPhoneRef = useRef<string | null>(null)
  const campaignFallbackRef = useRef(false)
  const checkoutIdempotencyKeyRef = useRef<string | null>(null)
  const orderSubmitLockRef = useRef(false)
  const pendingOrderPayloadRef = useRef<OrderRequestPayload | null>(null)

  const nameFieldRef = useRef<HTMLDivElement>(null)
  const phoneFieldRef = useRef<HTMLDivElement>(null)
  const cityFieldRef = useRef<HTMLDivElement>(null)
  const addressFieldRef = useRef<HTMLDivElement>(null)
  const cartErrorRef = useRef<HTMLParagraphElement>(null)

  useEffect(() => {
    const controller = new AbortController()
    const retryTimeouts = new Set<number>()
    let recoveryInFlight = false

    async function loadCampaign(): Promise<boolean> {
      try {
        const response = await fetch('/api/shop/campaign/zmeura-2026', {
          signal: controller.signal,
        })
        if (!response.ok) return false

        const snapshot: unknown = await response.json()
        if (isCampaignSnapshot(snapshot)) {
          campaignFallbackRef.current = false
          setCampaign(mergeCampaignSnapshot(snapshot))
          return true
        }
      } catch (error) {
        if (controller.signal.aborted) return false
        if (error instanceof DOMException && error.name === 'AbortError') return false
      }

      return false
    }

    function setCampaignFallback() {
      if (controller.signal.aborted) return
      campaignFallbackRef.current = true
      setCampaign(CAMPAIGN_DATA)
    }

    async function loadCampaignWithRetry(attempt = 0) {
      const loaded = await loadCampaign()
      if (loaded || controller.signal.aborted) return

      const retryDelay = CAMPAIGN_RETRY_DELAYS_MS[attempt]
      if (retryDelay === undefined) {
        setCampaignFallback()
        return
      }

      const timeout = window.setTimeout(() => {
        retryTimeouts.delete(timeout)
        void loadCampaignWithRetry(attempt + 1)
      }, retryDelay)
      retryTimeouts.add(timeout)
    }

    async function recoverCampaignWhenOnline() {
      if (!campaignFallbackRef.current || recoveryInFlight || controller.signal.aborted) return

      recoveryInFlight = true
      try {
        await loadCampaign()
      } finally {
        recoveryInFlight = false
      }
    }

    void loadCampaignWithRetry()
    window.addEventListener('online', recoverCampaignWhenOnline)

    return () => {
      controller.abort()
      retryTimeouts.forEach((timeout) => window.clearTimeout(timeout))
      retryTimeouts.clear()
      window.removeEventListener('online', recoverCampaignWhenOnline)
    }
  }, [])

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
  const blockedVillage =
    deliveryMode === 'livrare' && selectedVillage?.blocked ? selectedVillage : null
  const deliveryMinimumMessage = blockedVillage
    ? null
    : getDeliveryMinimumMessage(deliveryMode, deliveryZone, cartCount)
  const preferredDeliveryDateMin = useMemo(() => {
    const date = new Date()
    date.setDate(date.getDate() + 1)
    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, '0'),
      String(date.getDate()).padStart(2, '0'),
    ].join('-')
  }, [])
  const preferredDeliveryDateMax = useMemo(() => {
    const date = new Date()
    date.setDate(date.getDate() + 60)
    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, '0'),
      String(date.getDate()).padStart(2, '0'),
    ].join('-')
  }, [])

  const setQty = useCallback((id: string, next: number) => {
    setQtyById((prev) => {
      const value = Math.max(0, Math.min(999, next))
      if (value === 0) {
        const next = { ...prev }
        delete next[id]
        return next
      }
      return { ...prev, [id]: value }
    })
  }, [])

  useEffect(() => {
    if (primaryQty > 0) {
      setPrimaryQtyInput(String(primaryQty))
    }
  }, [primaryQty])

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
    if (!checkoutIdempotencyKeyRef.current) {
      checkoutIdempotencyKeyRef.current = crypto.randomUUID()
    }
    setOrderSuccess(false)
    setCapturedMilestone(null)
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

  const placeOrder = async (payload: OrderRequestPayload) => {
    try {
      const res = await fetch('/api/shop/b2c/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = (await res.json()) as {
        success?: boolean
        error?: string
        order_id?: string
        current_count?: number
        hit_milestone?: boolean
        milestone_threshold?: number | null
        milestone_reward?: string | null
      }
      if (!res.ok || !json.success) {
        setOrderError(json.error ?? 'Nu am putut salva comanda.')
        setOrderSubmitting(false)
        orderSubmitLockRef.current = false
        return
      }

      setOrderSuccess(true)
      const currentCount = json.current_count
      if (typeof currentCount === 'number') {
        setCampaign((currentCampaign) => {
          if (!currentCampaign) return currentCampaign

          return mergeCampaignSnapshot({
            currentCount,
            targetQty: currentCampaign.target,
            status: 'active',
            milestones: currentCampaign.milestones.map((milestone) => ({
              threshold: milestone.threshold,
              rewardLabel: milestone.rewardLabel,
              reached:
                milestone.reached ||
                (json.hit_milestone === true && milestone.threshold === json.milestone_threshold),
            })),
            leaderboard: currentCampaign.leaderboard,
          })
        })
      }
      setCapturedMilestone(
        json.hit_milestone &&
          typeof json.milestone_threshold === 'number' &&
          typeof json.milestone_reward === 'string'
          ? {
              threshold: json.milestone_threshold,
              rewardLabel: json.milestone_reward,
              reached: true,
              isNext: false,
            }
          : null,
      )
      setNotificationPromptVisible(false)
      setPendingNotifPrompt(true)
      setSourcePromptVisible(true)
      setSourceSaved(false)
      writeCustomerSnapshotToStorage({
        name: orderName.trim(),
        phone: payload.customer_phone,
        delivery_address: orderAddress.trim(),
        delivery_city: orderCity.trim(),
        delivery_mode: deliveryMode,
      })
      const message = buildWaMessage({
        lines: cartLines,
        total: cartTotal,
        name: orderName,
        phone: payload.customer_phone,
        deliveryMode,
        address: orderAddress,
        notes: orderNotes,
      })
      window.open(`${WA_BASE}?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer')

      checkoutIdempotencyKeyRef.current = null
      pendingOrderPayloadRef.current = null
      setRecentOrder(null)
      setPreferredDeliveryDate('')
      setPreferredDeliveryDateVisible(false)
      setQtyById(primaryProduct?.available ? { [primaryProduct.id]: 1 } : {})
      setOrderSubmitting(false)
      orderSubmitLockRef.current = false
    } catch {
      setOrderError('Eroare de rețea. Încearcă din nou.')
      setOrderSubmitting(false)
      orderSubmitLockRef.current = false
    }
  }

  const submitOrder = async () => {
    if (orderSubmitLockRef.current || deliveryMinimumMessage || blockedVillage) return

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

    if (!checkoutIdempotencyKeyRef.current) {
      checkoutIdempotencyKeyRef.current = crypto.randomUUID()
    }

    orderSubmitLockRef.current = true
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

    const payload: OrderRequestPayload = {
      customer_name: orderName.trim(),
      customer_phone: normalizedOrderPhone,
      delivery_mode: deliveryMode,
      delivery_address: deliveryMode === 'livrare' ? orderAddress.trim() : undefined,
      delivery_city:
        deliveryMode === 'livrare'
          ? ((selectedVillage?.name ?? selectedLocality?.name ?? orderCity.trim()) || undefined)
          : undefined,
      campaign_id: CAMPAIGN_DATA.campaignId,
      idempotencyKey: checkoutIdempotencyKeyRef.current,
      ...(deliveryMode === 'livrare' && deliveryZone !== null ? { deliveryZone } : {}),
      ...(deliveryMode === 'livrare'
        ? { preferredDeliveryDate: preferredDeliveryDate || null }
        : {}),
      items,
      total_lei: cartTotal,
      notes: orderNotes.trim() || undefined,
    }
    pendingOrderPayloadRef.current = payload

    try {
      const recentResponse = await fetch('/api/shop/b2c/check-recent-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: normalizedOrderPhone,
          campaignId: CAMPAIGN_DATA.campaignId,
        }),
      })

      if (recentResponse.ok) {
        const recentJson = (await recentResponse.json()) as Partial<RecentShopOrder> & { found?: boolean }
        if (
          recentJson.found === true &&
          typeof recentJson.minutes_ago === 'number' &&
          Array.isArray(recentJson.items) &&
          recentJson.items.length > 0 &&
          typeof recentJson.total_lei === 'number'
        ) {
          setRecentOrder(recentJson as RecentShopOrder)
          setOrderSubmitting(false)
          orderSubmitLockRef.current = false
          return
        }
      }
    } catch {
      // Recent-order lookup is best-effort; idempotency still protects the write.
    }

    await placeOrder(payload)
  }

  const cancelRecentOrder = () => {
    setRecentOrder(null)
    pendingOrderPayloadRef.current = null
  }

  const confirmRecentOrder = () => {
    const payload = pendingOrderPayloadRef.current
    if (!payload || orderSubmitLockRef.current) return

    orderSubmitLockRef.current = true
    setRecentOrder(null)
    setOrderSubmitting(true)
    setOrderError(null)
    void placeOrder(payload)
  }

  return (
    <div className="w-full pb-32 lg:pb-0">
      <header className="sticky top-0 z-40 flex items-center justify-between gap-3 border-b-4 border-[#F16B6B] bg-[#312E3F] px-4 py-3 lg:px-8 lg:py-4">
        <ZmeurelLogo wordmarkClassName="text-white" />
        <nav
          className="hidden items-center gap-7 text-sm font-bold text-white/80 lg:flex"
          aria-label="Navigație magazin"
        >
          <a className="transition hover:text-white" href="#ferma">
            Despre fermă
          </a>
          <a className="transition hover:text-white" href="#precomanda">
            Comandă
          </a>
          <a className="transition hover:text-white" href="#contact">
            Contact
          </a>
        </nav>
        <div className="flex items-center gap-3">
          <a
            className="hidden text-sm font-bold text-white/85 transition hover:text-white lg:inline-flex"
            href={PHONE_HREF}
          >
            {PHONE_LABEL}
          </a>
          <a
            className="hidden min-h-11 items-center rounded-xl bg-[var(--coral)] px-5 text-sm font-extrabold text-white shadow-sm transition hover:bg-[var(--coral-deep)] lg:inline-flex"
            href="#precomanda"
          >
            Comandă acum
          </a>
          <span className="shrink-0 rounded-full border border-[#FFB1AA]/55 bg-[#F16B6B]/18 px-3 py-1.5 text-[11px] font-extrabold tracking-wide text-[#FFD6D1] lg:hidden">
            Livrări active
          </span>
        </div>
      </header>

      {loadError ? (
        <p className="mx-3 mt-3 rounded-2xl bg-white px-4 py-3 text-sm font-medium text-[#E15453] shadow-sm">
          {loadError}
        </p>
      ) : null}

      <main>
        <section className="relative aspect-[25/14] overflow-hidden bg-[#312E3F] lg:mx-auto lg:grid lg:aspect-auto lg:max-w-[1160px] lg:grid-cols-2 lg:items-start lg:gap-12 lg:overflow-visible lg:bg-transparent lg:px-8 lg:py-14">
          <div className="absolute inset-0 lg:relative lg:inset-auto lg:aspect-[4/5]">
            <div className="absolute inset-0 lg:overflow-hidden lg:rounded-2xl lg:bg-[var(--ink)]">
              <Image
                src="/shop/shop-hero.jpg"
                alt="Caserolă cu zmeură proaspătă ținută în mână, în plantația din Văratec"
                fill
                priority
                sizes="(max-width: 1023px) 100vw, 600px"
                className="object-cover object-[center_60%]"
              />
              <div
                className="absolute inset-0 bg-gradient-to-b from-[#312E3F]/35 via-transparent to-[#312E3F]/85 lg:hidden"
                aria-hidden
              />
              <span className="absolute left-4 top-4 rounded-full bg-[#FFF6F3]/95 px-3 py-2 text-xs font-bold text-[#3D7A5F] shadow-md backdrop-blur-sm lg:hidden">
                ✓ Culeasă în ziua livrării
              </span>
            </div>
            <svg
              viewBox="0 0 180 180"
              className="absolute -right-5 top-7 hidden h-40 w-40 -rotate-12 text-[var(--ink)] lg:block"
              aria-hidden="true"
            >
              <circle
                cx="90"
                cy="90"
                r="76"
                fill="#FFF6F3"
                fillOpacity="0.96"
                stroke="currentColor"
                strokeWidth="4"
              />
              <circle cx="90" cy="90" r="64" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="4 5" />
              <text x="90" y="64" textAnchor="middle" fill="currentColor" fontSize="17" fontWeight="800">
                CULEASĂ AZI
              </text>
              <text x="90" y="94" textAnchor="middle" fill="currentColor" fontSize="25" fontWeight="900">
                ZMEUREL
              </text>
              <text x="90" y="119" textAnchor="middle" fill="currentColor" fontSize="12" fontWeight="800">
                VĂRATEC, SUCEAVA
              </text>
            </svg>
          </div>
          <div className="absolute inset-x-0 bottom-0 px-4 pb-5 lg:hidden">
            <h1 className={`max-w-[420px] text-[29px] font-semibold leading-[1.05] text-white ${styles.fontDisplay}`}>
              Zmeură proaspătă din Văratec
            </h1>
            <p className="mt-2 text-sm font-semibold text-white/78">Zmeură proaspătă 2026</p>
          </div>
          <div className="hidden lg:block lg:pt-6">
            <span className="inline-flex rounded-full bg-[var(--coral)]/12 px-4 py-2 text-sm font-extrabold text-[var(--coral-deep)]">
              Livrări active
            </span>
            <h1 className={`mt-5 text-6xl font-semibold leading-[0.98] text-[var(--ink)] ${styles.fontDisplay}`}>
              Zmeură proaspătă din Văratec
            </h1>
            <p className="mt-5 max-w-lg text-lg font-medium leading-relaxed text-[var(--ink)]/72">
              Zmeură culeasă manual în ziua livrării, direct din plantația noastră din Văratec.
            </p>
            <div className="mt-8 flex items-center gap-4">
              <a
                href="#precomanda"
                className="inline-flex min-h-12 items-center rounded-2xl bg-[var(--coral)] px-6 text-base font-extrabold text-white shadow-md transition hover:bg-[var(--coral-deep)]"
              >
                Comandă zmeură
              </a>
              <a href={PHONE_HREF} className="text-sm font-extrabold text-[var(--ink)]">
                {PHONE_LABEL}
              </a>
            </div>
          </div>
        </section>

        <section className="px-3 pt-4 lg:mx-auto lg:max-w-[1160px] lg:px-8 lg:py-4">
          <div className="rounded-[20px] border border-[#F3DAD4] bg-[#FFF0ED] px-4 py-4 text-[#312E3F] shadow-[0_6px_18px_rgba(241,107,107,0.1)]">
            <p className="text-sm font-extrabold leading-relaxed text-[#E15453]">
              Livrări în curs · Comenzile se onorează în ordinea primirii · Plata cash la livrare
            </p>
            <p className="mt-2 border-t border-[#F3DAD4] pt-2 text-xs leading-relaxed text-[#312E3F]/72">
              Livrare în Suceava și localitățile apropiate. Alte zone — confirmăm telefonic.
            </p>
          </div>
        </section>

        <div className="mt-5 lg:mx-auto lg:max-w-[640px]">
          <CampaignMeter campaign={campaign} />
        </div>

        <section
          id="precomanda"
          className="mt-7 px-3 lg:mx-auto lg:grid lg:max-w-[1160px] lg:grid-cols-[1.2fr_0.9fr] lg:items-start lg:gap-12 lg:px-8 lg:py-16"
          aria-labelledby="preorder-product-title"
        >
          <h2
            id="preorder-product-title"
            className={`mb-3 text-[25px] font-semibold text-[#312E3F] lg:hidden ${styles.fontDisplay}`}
          >
            Comandă zmeură
          </h2>
          <div className="hidden lg:block">
            <p className="text-sm font-extrabold uppercase tracking-[0.18em] text-[var(--coral-deep)]">
              Din recolta 2026
            </p>
            <h2 className={`mt-3 text-5xl font-semibold leading-tight text-[var(--ink)] ${styles.fontDisplay}`}>
              Comandă din recolta Văratec
            </h2>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-[var(--ink)]/72">
              Alegi cantitatea, iar noi te contactăm pentru stabilirea livrării.
            </p>
            <ul className="mt-8 space-y-4 text-base font-bold text-[var(--ink)]">
              <li className="flex items-center gap-3">
                <span className="grid h-8 w-8 place-items-center rounded-full bg-[var(--coral)]/12 text-[var(--coral-deep)]">
                  ✓
                </span>
                Confirmare telefonică înainte de livrare
              </li>
              <li className="flex items-center gap-3">
                <span className="grid h-8 w-8 place-items-center rounded-full bg-[var(--coral)]/12 text-[var(--coral-deep)]">
                  ✓
                </span>
                Livrare locală în Suceava și împrejurimi
              </li>
              <li className="flex items-center gap-3">
                <span className="grid h-8 w-8 place-items-center rounded-full bg-[var(--coral)]/12 text-[var(--coral-deep)]">
                  ✓
                </span>
                Plată cash la primirea comenzii
              </li>
            </ul>
          </div>
          <div className="rounded-[26px] bg-white p-[18px] shadow-[0_12px_36px_rgba(120,100,70,0.16)] lg:sticky lg:top-[88px]">
            <div className="grid gap-2 min-[360px]:grid-cols-2">
              <div className="rounded-[18px] border border-[#F3DAD4] bg-[#FFF9F7] px-3 py-3">
                <p className="text-xs font-bold text-[#312E3F]/68">1 caserolă · 500 g</p>
                <p className="mt-1 text-xl font-extrabold tabular-nums text-[#F16B6B]">
                  {formatLei(ZMEURA_CASEROLA_PRICE_LEI)} lei
                </p>
              </div>
              <div className="rounded-[18px] border border-[#F16B6B] bg-[#FFF0ED] px-3 py-3">
                <p className="text-xs font-bold text-[#312E3F]/68">2 caserole · 1 kg</p>
                <p className="mt-1 text-xl font-extrabold tabular-nums text-[#F16B6B]">
                  {formatLei(ZMEURA_KG_PRICE_LEI)} lei
                </p>
              </div>
            </div>

            {primaryProduct?.available ? (
              <>
                <div className="mt-5 flex items-center justify-center gap-4">
                  <button
                    type="button"
                    aria-label="Scade cantitatea"
                    onClick={() => setQty(primaryProduct.id, Math.max(1, primaryQty - 1))}
                    className="grid h-[54px] w-[54px] place-items-center rounded-2xl bg-[#FFF6F3] text-[28px] font-medium text-[#312E3F] shadow-sm transition active:scale-[0.985] active:shadow-none"
                  >
                    −
                  </button>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={999}
                    aria-label="Cantitate caserole"
                    value={primaryQtyInput}
                    onChange={(event) => {
                      const raw = event.target.value
                      setPrimaryQtyInput(raw)
                      if (!/^\d+$/.test(raw)) return

                      const nextQty = Number.parseInt(raw, 10)
                      if (nextQty >= 1) {
                        setQty(primaryProduct.id, nextQty)
                      }
                    }}
                    onBlur={(event) => {
                      const nextQty = Number.parseInt(event.target.value, 10)
                      if (!Number.isInteger(nextQty) || nextQty < 0) {
                        setPrimaryQtyInput('1')
                        setQty(primaryProduct.id, 1)
                        return
                      }
                      if (nextQty === 0) {
                        setPrimaryQtyInput('0')
                        setQty(primaryProduct.id, 0)
                        return
                      }

                      const normalizedQty = Math.min(999, nextQty)
                      setPrimaryQtyInput(String(normalizedQty))
                      setQty(primaryProduct.id, normalizedQty)
                    }}
                    className="h-[54px] w-20 rounded-xl bg-transparent text-center text-[32px] font-extrabold tabular-nums text-[#312E3F] outline-none transition focus:bg-[#FFF6F3] focus:ring-2 focus:ring-[#F16B6B]/35 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  />
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
                {primaryQty > 200 ? (
                  <p className="mt-1 text-center text-xs leading-relaxed text-[var(--status-warning-text)]">
                    Pentru comenzi mari (peste 200 caserole), te rugăm să ne contactezi telefonic pentru
                    confirmare disponibilitate.
                  </p>
                ) : null}

                <div className="mt-3 grid grid-cols-4 gap-2" aria-label="Cantități rapide">
                  {[1, 2, 4, 6].map((qty) => (
                    <button
                      key={qty}
                      type="button"
                      aria-label={`Alege ${qty} ${qty === 1 ? 'caserolă' : 'caserole'}`}
                      aria-pressed={primaryQty === qty}
                      onClick={() => setQty(primaryProduct.id, qty)}
                      className={`relative min-h-12 rounded-xl pt-1 text-sm font-bold transition active:scale-[0.985] ${
                        primaryQty === qty
                          ? 'bg-[#312E3F] text-white shadow-sm'
                          : 'bg-[#FFF6F3] text-[#312E3F]'
                      }`}
                    >
                      {qty}
                      {qty === 2 ? (
                        <span
                          className={`absolute inset-x-0 bottom-1 text-[8px] font-extrabold uppercase tracking-wide ${
                            primaryQty === qty ? 'text-[#FFB1AA]' : 'text-[#E15453]'
                          }`}
                        >
                          popular
                        </span>
                      ) : null}
                    </button>
                  ))}
                </div>

                <p className="mt-3 rounded-xl bg-[#FFF6F3] px-3 py-2 text-center text-xs font-semibold text-[#312E3F]/72">
                  {formatPriceBreakdown(primaryQty)}
                </p>

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
          </div>
        </section>

        <section id="ferma" className="mt-8 px-3 lg:mx-auto lg:max-w-[1160px] lg:px-8 lg:py-16">
          <div className="grid grid-cols-3 gap-2 lg:gap-6">
            <div>
              <Benefit icon="🚚" label="Livrare locală" />
            </div>
            <div className="lg:border-l lg:border-l-[var(--line)] lg:pl-6">
              <Benefit icon="🌿" label="Culeasă în ziua livrării" />
            </div>
            <div className="lg:border-l lg:border-l-[var(--line)] lg:pl-6">
              <Benefit icon="🧺" label="De la fermă" />
            </div>
          </div>
          <div className="lg:mt-14 lg:grid lg:grid-cols-2 lg:items-center lg:gap-12">
            <div className="relative mt-4 aspect-[2/1] overflow-hidden rounded-[24px] bg-[#F3DAD4] shadow-md lg:mt-0 lg:aspect-[4/3]">
              <Image
                src="/shop/shop-ferma.jpg"
                alt="Ferma Zmeurel din Văratec"
                fill
                sizes="(max-width: 1023px) 100vw, 600px"
                className="object-cover object-center"
              />
              <span className="absolute bottom-3 left-3 rounded-full bg-[#312E3F]/85 px-3 py-1.5 text-xs font-semibold text-white">
                Direct de la fermă
              </span>
            </div>
            <div className="hidden lg:block">
              <p className="text-sm font-extrabold uppercase tracking-[0.18em] text-[var(--coral-deep)]">
                Cultivată cu grijă
              </p>
              <h2 className={`mt-3 text-5xl font-semibold leading-tight text-[var(--ink)] ${styles.fontDisplay}`}>
                Direct de la fermă
              </h2>
              <p className="mt-5 text-lg leading-relaxed text-[var(--ink)]/72">
                Cultivăm soiurile Maravilla și Delniwa în Văratec, cu irigare prin picurare și atenție la fiecare
                plantă. Zmeura este recoltată manual, în fiecare zi, pentru a ajunge proaspătă la tine.
              </p>
            </div>
          </div>
        </section>

        <div className="mt-8 lg:mx-auto lg:max-w-[640px]">
          <CampaignMilestones campaign={campaign} />
        </div>

        <div className="mt-8 lg:mx-auto lg:max-w-[640px]">
          {campaign ? <SeasonLeaderboard campaign={campaign} /> : null}
        </div>

        <div className="mt-8 lg:mx-auto lg:max-w-[640px]">
          {campaign ? <CampaignRules campaign={campaign} /> : null}
        </div>

        <footer
          id="contact"
          className="mt-8 border-t-4 border-[#F16B6B] bg-[#312E3F] px-5 pb-10 pt-8 text-white lg:grid lg:grid-cols-3 lg:gap-12 lg:px-12 lg:py-12"
        >
          <div>
            <FooterBrand />
          </div>
          <div>
            <div className="mt-6 space-y-2 text-sm lg:mt-0">
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
          </div>
          <nav
            className="hidden flex-col items-start gap-4 text-sm font-bold text-white/75 lg:flex"
            aria-label="Linkuri footer"
          >
            <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-white">Navigație</p>
            <a className="transition hover:text-white" href="#ferma">
              Despre fermă
            </a>
            <a className="transition hover:text-white" href="#precomanda">
              Comandă
            </a>
            <a className="transition hover:text-white" href="#contact">
              Contact
            </a>
          </nav>
          <p className="mt-6 text-xs text-white/60 lg:col-span-3 lg:mt-0">
            © {new Date().getFullYear()} Zmeurel · Văratec
          </p>
        </footer>
      </main>

      {primaryProduct?.available && cartCount > 0 ? (
        <div className="fixed inset-x-0 bottom-0 z-50 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:hidden">
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
      <Sheet
        open={sheetOpen}
        onOpenChange={(open) => {
          if (!orderSubmitting) setSheetOpen(open)
        }}
      >
        <SheetContent
          side="bottom"
          showCloseButton={false}
          overlayClassName="!z-[59] bg-black/40 backdrop-blur-none"
          className="!z-[60] mx-auto max-h-[90dvh] w-full max-w-[540px] rounded-t-[26px] border-[#F3DAD4] bg-white px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 text-[#312E3F] shadow-[0_-18px_48px_rgba(49,46,63,0.2)]"
          onOpenAutoFocus={(event) => {
            event.preventDefault()
            phoneFieldRef.current?.querySelector('input')?.focus({ preventScroll: true })
          }}
        >
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-[#F3DAD4]" aria-hidden />
          <SheetHeader className="px-0 pb-0 pt-0">
            <SheetTitle className={`text-xl font-semibold text-[#312E3F] ${styles.fontDisplay}`}>
              {orderSuccess ? 'Comandă înregistrată' : 'Finalizează comanda'}
            </SheetTitle>
            <SheetDescription className="text-sm text-[#312E3F]/68">
              Te sunăm înainte de livrare pentru confirmarea zilei și a detaliilor.
            </SheetDescription>
          </SheetHeader>

          {orderSuccess ? (
            <div className="mt-4 space-y-3">
              {capturedMilestone ? (
                <div className="rounded-[20px] border border-[#F6C85F] bg-[#FFF4D8] px-4 py-5 text-center text-[#312E3F]">
                  <p className="text-3xl" aria-hidden>
                    🎉
                  </p>
                  <p className={`mt-2 text-[22px] font-semibold ${styles.fontDisplay}`}>Felicitări!</p>
                  <p className="mt-2 text-sm leading-relaxed">
                    Comanda ta a trecut pragul de{' '}
                    <strong>{capturedMilestone.threshold.toLocaleString('ro-RO')} caserole</strong>. Primești{' '}
                    <strong>{capturedMilestone.rewardLabel}</strong> la livrare.
                  </p>
                </div>
              ) : (
                <p className="rounded-xl bg-[#E8F5EE] px-4 py-3 text-sm font-medium text-[#0D9B5C]">
                  Comanda a fost salvată. WhatsApp s-a deschis cu mesajul pregătit — trimite-l pentru
                  confirmare.
                </p>
              )}

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
              <p className="mt-4 rounded-xl border border-[#F6C85F] bg-[#FFF4D8] px-3 py-3 text-xs font-semibold leading-relaxed text-[#6F4B00]">
                Vei fi contactat telefonic pentru confirmare. Plata se face cash la livrare, nu în avans.
              </p>

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
                    <LocalityZoneSelector
                      selectedLocality={selectedLocality}
                      selectedVillage={selectedVillage}
                      deliveryZone={deliveryZone}
                      cartCount={cartCount}
                      blockedVillage={blockedVillage}
                      deliveryMinimumMessage={deliveryMinimumMessage}
                      onSelectLocality={(locality) => {
                        setSelectedLocality(locality)
                        setSelectedVillage(null)
                        if (!locality.villages) {
                          setDeliveryZone(locality.zone)
                          setOrderCity(locality.name)
                        } else {
                          setDeliveryZone(null)
                          setOrderCity(locality.name)
                        }
                      }}
                      onSelectVillage={(village) => {
                        setSelectedVillage(village)
                        if (village === null) {
                          setDeliveryZone(selectedLocality?.villages ? null : (selectedLocality?.zone ?? null))
                          setOrderCity(selectedLocality?.name ?? '')
                        } else {
                          setDeliveryZone(village.blocked ? null : village.zone)
                          setOrderCity(village.name)
                        }
                      }}
                      onSelectOtherLocality={() => {
                        setSelectedLocality(null)
                        setSelectedVillage(null)
                        setDeliveryZone('zona4')
                        setOrderCity('')
                      }}
                    />
                    <div ref={addressFieldRef}>
                      <Field
                        label="Adresă livrare"
                        value={orderAddress}
                        onChange={setOrderAddress}
                        error={fieldErrors.address}
                      />
                    </div>
                    <div>
                      {!preferredDeliveryDateVisible && !preferredDeliveryDate ? (
                        <button
                          type="button"
                          onClick={() => setPreferredDeliveryDateVisible(true)}
                          className="min-h-11 text-left text-xs font-semibold text-[#3D7A5F] underline decoration-[#3D7A5F]/35 underline-offset-4"
                        >
                          Ai o dată preferată de livrare? (opțional)
                        </button>
                      ) : (
                        <div className="rounded-xl border border-[#F3DAD4] bg-[#FFF6F3] p-3">
                          <div className="mb-2 flex items-center justify-between gap-3">
                            <p className="text-xs font-semibold text-[#312E3F]">
                              Dată preferată de livrare (opțional)
                            </p>
                            {preferredDeliveryDate ? (
                              <button
                                type="button"
                                aria-label="Șterge data preferată"
                                onClick={() => setPreferredDeliveryDate('')}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-lg font-semibold text-[#312E3F]/60 transition active:scale-[0.98]"
                              >
                                ×
                              </button>
                            ) : null}
                          </div>
                          <AppDatePicker
                            id="shop-preferred-delivery-date"
                            placeholder="Selectează data"
                            value={preferredDeliveryDate}
                            min={preferredDeliveryDateMin}
                            max={preferredDeliveryDateMax}
                            triggerClassName="h-11 border-[#F3DAD4] bg-white text-sm"
                            onChange={setPreferredDeliveryDate}
                          />
                        </div>
                      )}
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
                disabled={orderSubmitting || !hasValidIdentity || deliveryMinimumMessage !== null}
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
        </SheetContent>
      </Sheet>

      <AlertDialog
        open={recentOrder !== null}
        onOpenChange={(open) => {
          if (!open) cancelRecentOrder()
        }}
      >
        <AlertDialogContent className="border-[#F3DAD4] bg-white text-[#312E3F]">
          <AlertDialogHeader>
            <AlertDialogTitle className={`text-[#312E3F] ${styles.fontDisplay}`}>
              Ai mai plasat o comandă recent
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3 text-[#312E3F]/72">
              {recentOrder?.items[0] ? (
                <span className="block">
                  Acum {Math.max(0, Math.round(recentOrder.minutes_ago))} minute ai trimis o comandă de{' '}
                  {recentOrder.items[0].qty} × {recentOrder.items[0].label} în valoare de{' '}
                  {formatLei(recentOrder.total_lei)} lei.
                </span>
              ) : null}
              <span className="block font-semibold text-[#312E3F]">
                Mai vrei să trimiți și această comandă nouă?
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={cancelRecentOrder}>Renunț</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRecentOrder}>Da, trimite comandă nouă</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        list={list}
        placeholder={placeholder}
        aria-invalid={Boolean(error)}
        className={`mt-1 h-auto min-h-12 rounded-lg bg-white px-3 py-[14px] text-sm text-[#312E3F] shadow-none ${
          error
            ? 'border-[#E15453] focus-visible:border-[#E15453] focus-visible:shadow-[0_0_0_3px_rgba(225,84,83,0.12)]'
            : 'border-[#F3DAD4] focus-visible:border-[#F16B6B] focus-visible:shadow-[0_0_0_3px_rgba(241,107,107,0.12)]'
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

const ZONE_BORDER_COLORS: Record<DeliveryZone, string> = {
  zona1: '#B8D89C',
  zona2: '#B5D4F4',
  zona3: '#FAC775',
  zona4: '#D1D5DB',
  ridicare: '#D1D5DB',
}

const ZONE_ACTIVE_TEXT: Record<DeliveryZone, string> = {
  zona1: '#3B6D11',
  zona2: '#185FA5',
  zona3: '#854F0B',
  zona4: '#374151',
  ridicare: '#374151',
}

function LocalityChip({
  label,
  zone,
  active,
  blocked,
  onClick,
}: {
  label: string
  zone: DeliveryZone
  active: boolean
  blocked?: boolean
  onClick?: () => void
}) {
  const borderColor = blocked ? '#D1D5DB' : ZONE_BORDER_COLORS[zone]
  const activeText = blocked ? '#9CA3AF' : ZONE_ACTIVE_TEXT[zone]

  if (blocked) {
    return (
      <span
        className="flex items-center gap-1 rounded-full border px-2.5 py-1.5 text-xs font-semibold text-[#9CA3AF]"
        style={{ borderColor, background: '#F9FAFB', cursor: 'not-allowed' }}
        title="Livrare indisponibilă"
      >
        <span>✕</span> {label}
      </span>
    )
  }

  return (
    <button
      type="button"
      onClick={onClick}
      style={
        active
          ? { background: '#F16B6B', color: '#fff', borderColor: '#F16B6B' }
          : { borderColor, color: active ? '#fff' : activeText, background: 'transparent' }
      }
      className="rounded-full border px-2.5 py-1.5 text-xs font-semibold transition active:scale-[0.97]"
    >
      {label}
    </button>
  )
}

function LocalityZoneSelector({
  selectedLocality,
  selectedVillage,
  deliveryZone,
  cartCount,
  blockedVillage,
  deliveryMinimumMessage,
  onSelectLocality,
  onSelectVillage,
  onSelectOtherLocality,
}: {
  selectedLocality: LocalityConfig | null
  selectedVillage: VillageConfig | null
  deliveryZone: DeliveryZone | null
  cartCount: number
  blockedVillage: VillageConfig | null
  deliveryMinimumMessage: string | null
  onSelectLocality: (locality: LocalityConfig) => void
  onSelectVillage: (village: VillageConfig | null) => void
  onSelectOtherLocality: () => void
}) {
  const selectedName = selectedVillage?.name ?? selectedLocality?.name ?? null

  return (
    <div>
      <p className="mb-2 text-xs font-semibold text-[#312E3F]">Localitate livrare</p>

      <div className="flex flex-wrap gap-1.5">
        {LOCALITIES.map((locality) => (
          <LocalityChip
            key={locality.name}
            label={locality.name}
            zone={locality.zone}
            active={selectedLocality?.name === locality.name && !selectedVillage}
            onClick={() => onSelectLocality(locality)}
          />
        ))}
        <LocalityChip
          label="Altă localitate…"
          zone="zona4"
          active={selectedLocality === null && deliveryZone === 'zona4'}
          onClick={onSelectOtherLocality}
        />
      </div>

      {selectedLocality?.villages ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {selectedLocality.villages.map((village) => (
            <LocalityChip
              key={village.name}
              label={village.name}
              zone={village.zone}
              active={selectedVillage?.name === village.name}
              blocked={village.blocked}
              onClick={village.blocked ? undefined : () => onSelectVillage(village)}
            />
          ))}
        </div>
      ) : null}

      {blockedVillage ? (
        <p
          role="alert"
          className="mt-2 rounded-xl bg-[#FFF4D8] px-3 py-2 text-xs font-semibold leading-relaxed text-[#6F4B00]"
        >
          {blockedVillage.blockedMessage}
        </p>
      ) : deliveryZone === 'zona4' && selectedName ? (
        <p className="mt-2 rounded-xl bg-[#FFF8EC] px-3 py-2 text-xs font-semibold leading-relaxed text-[#6F4B00]">
          ℹ️ Livrăm și în {selectedName} — vom stabili împreună locul livrării după ce plasezi comanda.
        </p>
      ) : deliveryZone && cartCount > 0 && !deliveryMinimumMessage ? (
        <p className="mt-2 rounded-xl bg-[#EAF3DE] px-3 py-2 text-xs font-semibold leading-relaxed text-[#3B6D11]">
          ✓ Livrăm în {selectedName} — minim {DELIVERY_ZONES[deliveryZone].minQty} caserole ({DELIVERY_ZONES[deliveryZone].minKg} kg)
        </p>
      ) : deliveryMinimumMessage ? (
        <p
          role="alert"
          className="mt-2 rounded-xl bg-[#FFF4D8] px-3 py-2 text-xs font-semibold leading-relaxed text-[#6F4B00]"
        >
          {deliveryMinimumMessage}
        </p>
      ) : !selectedLocality && deliveryZone !== 'zona4' ? (
        <p className="mt-2 text-xs text-[#9CA3AF]">Selectează localitatea pentru a vedea minimul de comandă.</p>
      ) : null}
    </div>
  )
}
