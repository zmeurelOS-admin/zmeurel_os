'use client'

import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import Link from 'next/link'
import { ArrowLeft, Check, ChevronDown, ChevronUp, Loader2 } from 'lucide-react'

import {
  gustaBrandColors,
  gustaBrandShadows,
  gustaPrimaryTints,
} from '@/lib/shop/association/brand-tokens'
import {
  defaultResolvedMerchant,
  type ResolvedMerchantPublic,
} from '@/lib/shop/association/merchant-info'
import { postShopOrderWithRetry } from '@/lib/shop/association/checkout-fetch'
import {
  formatDeliveryDateFromIso,
  getAmountUntilFreeDelivery,
  getDeliveryFee,
  getNextDeliveryDateIso,
} from '@/lib/shop/association/delivery'
import { formatQuantityForDisplay } from '@/lib/shop/utils'
import { cn } from '@/lib/utils'
import { toast } from '@/lib/ui/toast'

import type {
  GustCartItem,
  GustCheckoutSuccess,
  GustCommunicationChannel,
} from './gustCartTypes'

const INPUT_CLASS =
  'assoc-body w-full rounded-xl border-[1.5px] px-4 py-3 text-sm outline-none transition-[border-color,box-shadow] focus-visible:ring-2 focus-visible:ring-offset-2'

const TERMS_HREF = '/magazin/asociatie/termeni'
const PRIVACY_HREF = '/magazin/asociatie/confidentialitate'
const CHECKOUT_PREFS_KEY = 'gusta_checkout_prefs'

const RO_PHONE_DIGITS = /^[0-9+()\s.-]{10,}$/

const CHANNEL_OPTIONS: Array<{
  value: GustCommunicationChannel
  icon: string
  title: string
  description: string
  helper?: string
  recommended?: boolean
}> = [
  {
    value: 'whatsapp',
    icon: '💬',
    title: 'WhatsApp',
    description: 'Doresc să primesc confirmarea și actualizările acestei comenzi pe WhatsApp.',
    recommended: true,
  },
  {
    value: 'sms',
    icon: '📱',
    title: 'SMS',
    description: 'Doresc să primesc confirmarea și detaliile comenzii prin SMS.',
  },
  {
    value: 'apel',
    icon: '📞',
    title: 'Apel telefonic',
    description: 'Sunt de acord să fiu sunat(ă) pentru confirmarea și detaliile comenzii.',
    helper: 'Te vom suna noi pentru confirmare.',
  },
]

function normalizeRoPhone(raw: string): string {
  return raw.replace(/\s/g, '').replace(/^\+40/, '0')
}

function isLikelyRoPhone(value: string): boolean {
  const normalized = normalizeRoPhone(value)
  if (normalized.length < 10) return false
  if (!RO_PHONE_DIGITS.test(value)) return false
  const digits = normalized.replace(/\D/g, '')
  return digits.length >= 10
}

function formatLei(value: number): string {
  return new Intl.NumberFormat('ro-RO', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(value)
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

function isCommunicationChannel(value: unknown): value is GustCommunicationChannel {
  return value === 'whatsapp' || value === 'sms' || value === 'apel'
}

function getChannelLabel(channel: GustCommunicationChannel | null): string | null {
  if (channel === 'whatsapp') return 'WhatsApp'
  if (channel === 'sms') return 'SMS'
  if (channel === 'apel') return 'Apel telefonic'
  return null
}

function getInputStyle(): CSSProperties {
  return {
    borderColor: gustaPrimaryTints[40],
    color: gustaBrandColors.text,
  }
}

function handleInputFocus(target: HTMLInputElement | HTMLTextAreaElement) {
  target.style.borderColor = gustaBrandColors.primary
  target.style.boxShadow = `0 0 0 3px ${gustaBrandColors.primary}1a`
}

function handleInputBlur(target: HTMLInputElement | HTMLTextAreaElement) {
  target.style.borderColor = gustaPrimaryTints[40]
  target.style.boxShadow = 'none'
}

export type GustCheckoutFormProps = {
  items: GustCartItem[]
  onBack: () => void
  onComplete: (result: GustCheckoutSuccess) => void
  merchant?: ResolvedMerchantPublic
}

export function GustCheckoutForm({
  items,
  onBack,
  onComplete,
  merchant,
}: GustCheckoutFormProps) {
  const m = merchant ?? defaultResolvedMerchant()
  const [nume, setNume] = useState('')
  const [telefon, setTelefon] = useState('')
  const [locatie, setLocatie] = useState('')
  const [observatii, setObservatii] = useState('')
  const [canalComunicare, setCanalComunicare] = useState<GustCommunicationChannel | null>(null)
  const [saveLocally, setSaveLocally] = useState(false)
  const [showPrefillBanner, setShowPrefillBanner] = useState(false)
  const [summaryExpanded, setSummaryExpanded] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [inlineError, setInlineError] = useState<string | null>(null)
  const [channelError, setChannelError] = useState<string | null>(null)

  const grouped = useMemo(() => {
    const groupedMap = new Map<string, { farmName: string; lines: GustCartItem[] }>()
    for (const item of items) {
      const current = groupedMap.get(item.tenantId)
      if (!current) groupedMap.set(item.tenantId, { farmName: item.farmName, lines: [item] })
      else current.lines.push(item)
    }
    return Array.from(groupedMap.entries()).map(([tenantId, value]) => ({ tenantId, ...value }))
  }, [items])

  const estimatedTotal = useMemo(() => {
    return items.reduce((sum, item) => {
      if (item.price == null) return sum
      return sum + Number(item.price) * item.qty
    }, 0)
  }, [items])

  const deliveryDateIso = useMemo(() => getNextDeliveryDateIso(), [])
  const deliveryDateLabel = useMemo(
    () => formatDeliveryDateFromIso(deliveryDateIso),
    [deliveryDateIso],
  )
  const deliveryFee = useMemo(() => getDeliveryFee(estimatedTotal), [estimatedTotal])
  const amountUntilFree = useMemo(() => getAmountUntilFreeDelivery(estimatedTotal), [estimatedTotal])
  const grandTotal = useMemo(() => estimatedTotal + deliveryFee, [estimatedTotal, deliveryFee])
  const lineCount = items.length
  const qtySum = useMemo(() => items.reduce((sum, item) => sum + item.qty, 0), [items])
  const currency = items[0]?.moneda ?? 'RON'
  const submitDisabled = submitting || items.length === 0 || canalComunicare === null

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(CHECKOUT_PREFS_KEY)
      if (!saved) return
      const prefs = JSON.parse(saved) as {
        nume?: string
        telefon?: string
        adresa?: string
        canal_preferat?: string | null
      }
      setNume(prefs.nume || '')
      setTelefon(prefs.telefon || '')
      setLocatie(prefs.adresa || '')
      setCanalComunicare(isCommunicationChannel(prefs.canal_preferat) ? prefs.canal_preferat : null)
      setShowPrefillBanner(Boolean(prefs.nume || prefs.telefon || prefs.adresa || prefs.canal_preferat))
    } catch {
      // localStorage indisponibil sau date corupte - ignora
    }
  }, [])

  const validate = (): string | null => {
    if (nume.trim().length < 2) return 'Introdu numele complet.'
    if (!isLikelyRoPhone(telefon)) return 'Introdu un numar de telefon valid (Romania).'
    if (locatie.trim().length < 3) return 'Introdu localitatea sau adresa.'
    if (observatii.length > 500) return 'Observatiile au maxim 500 de caractere.'
    if (canalComunicare == null) {
      setChannelError('Te rugam sa alegi cum doresti sa fii contactat.')
      return 'Alege canalul de comunicare pentru confirmarea comenzii.'
    }
    return null
  }

  const submit = async () => {
    setInlineError(null)
    setChannelError(null)

    const validationError = validate()
    if (validationError) {
      setInlineError(validationError)
      toast.error(validationError)
      return
    }
    if (items.length === 0 || canalComunicare == null) return

    setSubmitting(true)
    try {
      let allIds: string[] = []
      let allOrderNumbers: string[] = []
      let linesSubtotalSum = 0
      let serverDeliveryFee: number | null = null
      let deliveryDateIsoFromApi = ''
      let currentCurrency = currency

      for (let farmIndex = 0; farmIndex < grouped.length; farmIndex++) {
        const group = grouped[farmIndex]!
        const lines = group.lines.map((line) => ({
          produsId: line.id,
          qty: line.qty,
        }))
        const body = {
          channel: 'association_shop' as const,
          tenantId: group.tenantId,
          lines,
          nume: nume.trim(),
          telefon: telefon.trim(),
          locatie: locatie.trim(),
          observatii: observatii.trim() || undefined,
          cartSubtotalLei: estimatedTotal,
          associationCheckoutPart: {
            farmIndex,
            farmCount: grouped.length,
          },
          canal_confirmare: canalComunicare,
          save_consent: canalComunicare === 'whatsapp' || canalComunicare === 'sms',
          user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
          whatsappConsent: canalComunicare === 'whatsapp',
        }

        let response: Response
        try {
          response = await postShopOrderWithRetry(body)
        } catch {
          const message = 'Eroare de retea. Incearca din nou.'
          setInlineError(message)
          toast.error(message)
          return
        }

        let data: {
          ok?: boolean
          error?: string
          orderIds?: string[]
          orderNumbers?: string[]
          totalLei?: number
          linesSubtotalLei?: number
          cartDeliveryFeeLei?: number
          deliveryDateIso?: string
          currency?: string
        } = {}

        try {
          const text = await response.text()
          data = text ? (JSON.parse(text) as typeof data) : {}
        } catch {
          data = {}
        }

        if (!response.ok || !data.ok || !data.orderIds?.length) {
          const message =
            typeof data.error === 'string' ? data.error : 'Nu am putut trimite comanda.'
          setInlineError(message)
          toast.error(message)
          return
        }

        allIds = allIds.concat(data.orderIds)
        if (Array.isArray(data.orderNumbers) && data.orderNumbers.length > 0) {
          allOrderNumbers = allOrderNumbers.concat(
            data.orderNumbers.filter((value): value is string => typeof value === 'string' && value.trim().length > 0),
          )
        }
        linesSubtotalSum += Number(data.linesSubtotalLei ?? data.totalLei ?? 0)
        if (farmIndex === 0 && typeof data.cartDeliveryFeeLei === 'number') {
          serverDeliveryFee = data.cartDeliveryFeeLei
        }
        if (typeof data.deliveryDateIso === 'string' && data.deliveryDateIso) {
          deliveryDateIsoFromApi = data.deliveryDateIso
        }
        currentCurrency = data.currency ?? currentCurrency
      }

      if (saveLocally) {
        try {
          window.localStorage.setItem(
            CHECKOUT_PREFS_KEY,
            JSON.stringify({
              nume: nume.trim(),
              telefon: telefon.trim(),
              adresa: locatie.trim(),
              canal_preferat: canalComunicare,
              saved_at: new Date().toISOString(),
            }),
          )
        } catch {
          // localStorage indisponibil - nu blocam checkout-ul
        }
      }

      const fee = serverDeliveryFee !== null ? serverDeliveryFee : getDeliveryFee(estimatedTotal)
      const resolvedDeliveryDateLabel = deliveryDateIsoFromApi
        ? formatDeliveryDateFromIso(deliveryDateIsoFromApi)
        : deliveryDateLabel

      const placedAt = new Date()
      const placedAtIso = placedAt.toISOString()
      const placedAtLabel = placedAt.toLocaleString('ro-RO', {
        timeZone: 'Europe/Bucharest',
        dateStyle: 'long',
        timeStyle: 'short',
      })
      const summaryLines = items.map((item) => ({
        productName: item.name,
        farmName: item.farmName,
        qty: item.qty,
        unit: item.unit,
        unitPrice: item.price ?? 0,
        lineTotal: round2((item.price ?? 0) * item.qty),
        currency: item.moneda,
      }))

      onComplete({
        orderIds: allIds,
        orderNumbers: allOrderNumbers,
        primaryOrderNumber: allOrderNumbers[0] ?? null,
        totalLei: linesSubtotalSum,
        currency: currentCurrency,
        farmCount: grouped.length,
        deliveryFeeLei: fee,
        grandTotalLei: round2(linesSubtotalSum + fee),
        deliveryDateLabel: resolvedDeliveryDateLabel,
        placedAtIso,
        placedAtLabel,
        clientName: nume.trim(),
        clientTelefon: telefon.trim(),
        clientLocatie: locatie.trim(),
        canalComunicare,
        summaryLines,
      })
    } catch (error) {
      const message =
        error instanceof Error && error.name === 'AbortError'
          ? 'Cererea a expirat (10s). Incearca din nou.'
          : 'Eroare de retea. Incearca din nou.'
      setInlineError(message)
      toast.error(message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="md:flex md:items-start md:justify-between md:gap-6">
        <div>
          <button
            type="button"
            onClick={onBack}
            className="assoc-body mb-4 flex items-center gap-2 text-sm font-semibold transition hover:opacity-80"
            style={{ color: gustaBrandColors.primary }}
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Inapoi la cos
          </button>

          <h2 className="assoc-heading text-xl font-extrabold md:text-2xl" style={{ color: gustaBrandColors.text }}>
            Finalizeaza comanda
          </h2>
        </div>
      </div>

      <div className="mt-4 min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 pb-4 md:grid md:grid-cols-[minmax(0,1.5fr)_minmax(240px,1fr)] md:gap-5">
          <section
            className="rounded-2xl border bg-white md:col-span-2"
            style={{ borderColor: gustaPrimaryTints[40], boxShadow: gustaBrandShadows.sm }}
          >
            <button
              type="button"
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
              onClick={() => setSummaryExpanded((current) => !current)}
              aria-expanded={summaryExpanded}
            >
              <div>
                <p
                  className="assoc-heading text-xs font-bold uppercase tracking-wide"
                  style={{ color: gustaPrimaryTints[80] }}
                >
                  Produse
                </p>
                <p className="assoc-body mt-1 text-sm font-semibold" style={{ color: gustaBrandColors.text }}>
                  {lineCount} {lineCount === 1 ? 'produs' : 'produse'} · {formatLei(estimatedTotal)} {currency}
                </p>
              </div>
              {summaryExpanded ? (
                <ChevronUp className="h-5 w-5 shrink-0" style={{ color: gustaBrandColors.primary }} aria-hidden />
              ) : (
                <ChevronDown
                  className="h-5 w-5 shrink-0"
                  style={{ color: gustaBrandColors.primary }}
                  aria-hidden
                />
              )}
            </button>
            {summaryExpanded ? (
              <div
                className="border-t px-4 pb-4 pt-3"
                style={{ borderColor: gustaPrimaryTints[20], color: '#5a6563' }}
              >
                <ul className="space-y-3">
                  {grouped.map((group) => (
                    <li key={group.tenantId}>
                      <p className="text-xs font-bold" style={{ color: gustaBrandColors.primary }}>
                        {group.farmName}
                      </p>
                      <ul className="mt-1 space-y-1 text-xs">
                        {group.lines.map((line) => (
                          <li key={line.id} className="flex justify-between gap-3">
                            <span className="min-w-0 truncate">
                              {line.name} × {formatQuantityForDisplay(line.qty, line.unit)} {line.unit}
                            </span>
                            {line.price != null ? (
                              <span className="shrink-0 tabular-nums font-semibold">
                                {formatLei(Number(line.price) * line.qty)} {line.moneda}
                              </span>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </section>

          <div className="space-y-4 md:col-start-1">
            <div
              className="space-y-4 rounded-2xl border bg-white p-4 md:p-5"
              style={{ borderColor: gustaPrimaryTints[40] }}
            >
              {showPrefillBanner ? (
                <div
                  className="flex items-start gap-3 rounded-[10px] border px-3.5 py-2.5 text-left"
                  style={{
                    backgroundColor: `${gustaBrandColors.accent}1a`,
                    borderColor: `${gustaBrandColors.accent}33`,
                  }}
                >
                  <p
                    className="assoc-body flex-1 text-[12px] leading-relaxed"
                    style={{ color: gustaBrandColors.text }}
                  >
                    📋 Date precompletate de la ultima ta comanda. Poti modifica orice camp.
                  </p>
                  <button
                    type="button"
                    className="text-xs font-bold"
                    style={{ color: gustaBrandColors.text }}
                    onClick={() => setShowPrefillBanner(false)}
                    aria-label="Ascunde bannerul de precompletare"
                  >
                    ✕
                  </button>
                </div>
              ) : null}

              <div>
                <label
                  className="assoc-body mb-1.5 block text-[13px] font-bold"
                  style={{ color: gustaBrandColors.text }}
                >
                  Nume complet
                </label>
                <input
                  type="text"
                  autoComplete="name"
                  value={nume}
                  onChange={(event) => setNume(event.target.value)}
                  className={INPUT_CLASS}
                  style={getInputStyle()}
                  onFocus={(event) => handleInputFocus(event.target)}
                  onBlur={(event) => handleInputBlur(event.target)}
                />
              </div>

              <div>
                <label
                  className="assoc-body mb-1.5 block text-[13px] font-bold"
                  style={{ color: gustaBrandColors.text }}
                >
                  Telefon
                </label>
                <input
                  type="tel"
                  autoComplete="tel"
                  inputMode="tel"
                  placeholder="07xx xxx xxx"
                  pattern="[0-9+\\s().-]{10,}"
                  value={telefon}
                  onChange={(event) => setTelefon(event.target.value)}
                  className={INPUT_CLASS}
                  style={getInputStyle()}
                  onFocus={(event) => handleInputFocus(event.target)}
                  onBlur={(event) => handleInputBlur(event.target)}
                />
              </div>

              <div>
                <label
                  className="assoc-body mb-1.5 block text-[13px] font-bold"
                  style={{ color: gustaBrandColors.text }}
                >
                  Localitate / Adresa
                </label>
                <input
                  type="text"
                  autoComplete="street-address"
                  value={locatie}
                  onChange={(event) => setLocatie(event.target.value)}
                  className={INPUT_CLASS}
                  style={getInputStyle()}
                  onFocus={(event) => handleInputFocus(event.target)}
                  onBlur={(event) => handleInputBlur(event.target)}
                />
                <p className="assoc-body mt-2 text-[12px] leading-relaxed" style={{ color: '#5a6563' }}>
                  📍 Livram in municipiul Suceava si localitatile limitrofe. Pentru alte zone, contactati{' '}
                  {m.legalName}.
                </p>
              </div>

              <div>
                <label
                  className="assoc-body mb-1.5 block text-[13px] font-bold"
                  style={{ color: gustaBrandColors.text }}
                >
                  Observatii (optional)
                </label>
                <textarea
                  value={observatii}
                  onChange={(event) => setObservatii(event.target.value.slice(0, 500))}
                  rows={3}
                  maxLength={500}
                  className={cn(INPUT_CLASS, 'resize-y')}
                  style={getInputStyle()}
                  onFocus={(event) => handleInputFocus(event.target)}
                  onBlur={(event) => handleInputBlur(event.target)}
                />
                <p className="mt-1 text-right text-[11px]" style={{ color: gustaPrimaryTints[80] }}>
                  {observatii.length}/500
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-4 md:col-start-2 md:row-start-2">
            <div
              className="rounded-[12px] border px-4 py-3.5 md:sticky md:top-0"
              style={{
                backgroundColor: gustaBrandColors.secondary,
                borderColor: gustaPrimaryTints[40],
              }}
            >
              <p
                className="assoc-heading text-xs font-bold uppercase tracking-wide"
                style={{ color: gustaPrimaryTints[80] }}
              >
                Rezumat comanda
              </p>
              <p className="assoc-body mt-2 text-sm" style={{ color: gustaBrandColors.text }}>
                <span className="font-semibold">Comerciant:</span> {m.legalName}
              </p>
              <p className="assoc-body mt-1 text-sm" style={{ color: '#5a6563' }}>
                Produse: {lineCount} {lineCount === 1 ? 'linie' : 'linii'} · Cantitate totala:{' '}
                {new Intl.NumberFormat('ro-RO', { maximumFractionDigits: 2 }).format(qtySum)}
              </p>
              <div
                className="assoc-body mt-3 space-y-1 border-t pt-3 text-sm"
                style={{ borderColor: gustaPrimaryTints[40], color: '#5a6563' }}
              >
                <div className="flex justify-between gap-2">
                  <span>Subtotal produse</span>
                  <span className="tabular-nums font-medium" style={{ color: gustaBrandColors.text }}>
                    {formatLei(estimatedTotal)} {currency}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span>Livrare</span>
                  <span className="tabular-nums font-medium" style={{ color: gustaBrandColors.text }}>
                    {deliveryFee > 0 ? `${formatLei(deliveryFee)} ${currency}` : 'Gratuita'}
                  </span>
                </div>
                <div className="flex justify-between gap-2 border-t pt-2" style={{ borderColor: gustaPrimaryTints[40] }}>
                  <span className="font-bold" style={{ color: gustaBrandColors.text }}>
                    TOTAL
                  </span>
                  <span
                    className="text-lg font-extrabold tabular-nums"
                    style={{ color: gustaBrandColors.primary }}
                  >
                    {formatLei(grandTotal)} {currency}
                  </span>
                </div>
                <div className="flex justify-between gap-2 pt-1 text-sm">
                  <span>Plata</span>
                  <span className="font-semibold" style={{ color: gustaBrandColors.text }}>
                    Cash la livrare
                  </span>
                </div>
                <p className="assoc-body pt-1 text-sm font-bold" style={{ color: gustaBrandColors.primary }}>
                  📅 Livrare estimata: {deliveryDateLabel}
                </p>
                {canalComunicare ? (
                  <div className="flex justify-between gap-2 pt-1 text-sm">
                    <span>Confirmare</span>
                    <span className="font-semibold" style={{ color: gustaBrandColors.text }}>
                      {getChannelLabel(canalComunicare)}
                    </span>
                  </div>
                ) : null}
              </div>
              {amountUntilFree > 0 ? (
                <p
                  className="assoc-body mt-2 text-[13px] font-semibold leading-snug"
                  style={{ color: gustaBrandColors.accent }}
                >
                  💡 Mai adauga {formatLei(amountUntilFree)} {currency} pentru livrare GRATUITA!
                </p>
              ) : null}
            </div>
          </div>

          <section
            className="rounded-2xl border bg-white p-4 md:col-span-2 md:p-5"
            style={{ borderColor: gustaPrimaryTints[40], boxShadow: gustaBrandShadows.sm }}
          >
            <h3
              className="assoc-body text-[14px] font-bold"
              style={{ color: gustaBrandColors.text, fontWeight: 700 }}
            >
              Cum doresti sa primesti confirmarea si detaliile comenzii?
            </h3>
            <div
              className="mt-3 grid gap-[10px] md:grid-cols-3 md:gap-3"
              role="radiogroup"
              aria-label="Canal de comunicare"
            >
              {CHANNEL_OPTIONS.map((option) => {
                const selected = canalComunicare === option.value
                const isWhatsapp = option.value === 'whatsapp'
                const borderColor = selected
                  ? isWhatsapp
                    ? gustaBrandColors.accent
                    : gustaBrandColors.primary
                  : isWhatsapp
                    ? `${gustaBrandColors.accent}4d`
                    : gustaPrimaryTints[40]
                const backgroundColor = selected
                  ? isWhatsapp
                    ? `${gustaBrandColors.accent}0d`
                    : `${gustaBrandColors.primary}0d`
                  : '#fff'

                return (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => {
                      setCanalComunicare(option.value)
                      setChannelError(null)
                      setInlineError(null)
                    }}
                    className="relative w-full rounded-[14px] p-4 text-left transition md:flex md:min-h-[176px] md:min-w-[180px] md:items-stretch"
                    style={{
                      border: `1.5px solid ${borderColor}`,
                      backgroundColor,
                    }}
                  >
                    {selected ? (
                      <span
                        className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full"
                        style={{
                          backgroundColor: isWhatsapp
                            ? gustaBrandColors.accent
                            : gustaBrandColors.primary,
                          color: '#fff',
                        }}
                      >
                        <Check className="h-3.5 w-3.5" aria-hidden />
                      </span>
                    ) : null}
                    <div className="flex items-start gap-3 md:flex-1 md:flex-col md:items-center md:justify-center md:text-center">
                      <span className="text-xl md:text-2xl" aria-hidden>
                        {option.icon}
                      </span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2 md:justify-center">
                          <p
                          className="assoc-body text-sm font-bold md:text-[15px]"
                          style={{ color: gustaBrandColors.text }}
                        >
                          {option.title}
                          </p>
                          {option.recommended ? (
                            <span
                              className="rounded-md px-1.5 py-0.5 text-[10px] font-bold"
                              style={{
                                backgroundColor: `${gustaBrandColors.accent}26`,
                                color: gustaBrandColors.accent,
                              }}
                            >
                              Recomandat
                            </span>
                          ) : null}
                        </div>
                        <p
                          className="assoc-body mt-2 text-[12px] leading-[1.45] md:text-[11px]"
                          style={{ color: '#6b7a72' }}
                        >
                          {option.description}
                        </p>
                        {option.helper ? (
                          <p className="assoc-body mt-2 text-[11px] italic" style={{ color: '#6b7a72' }}>
                            {option.helper}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
            {channelError ? (
              <p className="assoc-body mt-3 text-[12px] font-semibold" style={{ color: '#b42318' }}>
                {channelError}
              </p>
            ) : null}
            <p className="assoc-body mt-3 text-[11px] italic" style={{ color: '#6b7a72' }}>
              Poti schimba oricand preferinta la o comanda viitoare.
            </p>
          </section>

          <section
            className="rounded-2xl border bg-white p-4 md:col-span-2"
            style={{ borderColor: gustaPrimaryTints[40], boxShadow: gustaBrandShadows.sm }}
          >
            <label className="flex cursor-pointer items-start gap-3 text-left">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 shrink-0 rounded border-[var(--border-default)]"
                checked={saveLocally}
                onChange={(event) => setSaveLocally(event.target.checked)}
              />
              <span>
                <span
                  className="assoc-body block text-[13px] font-medium"
                  style={{ color: gustaBrandColors.text }}
                >
                  Salveaza datele mele pe acest dispozitiv pentru a comanda mai rapid data viitoare.
                </span>
                <span className="assoc-body mt-1 block text-[11px]" style={{ color: '#6b7a72' }}>
                  Datele sunt salvate doar pe acest dispozitiv, nu pe server.
                </span>
              </span>
            </label>
          </section>

          <div className="space-y-2 md:col-span-2">
            <p className="assoc-body text-[11px] leading-snug" style={{ color: '#6b7a72' }}>
              Prin plasarea comenzii, accepti{' '}
              <Link
                href={TERMS_HREF}
                className="font-semibold underline underline-offset-2"
                style={{ color: gustaBrandColors.primary }}
              >
                Termenii si conditiile
              </Link>{' '}
              si{' '}
              <Link
                href={PRIVACY_HREF}
                className="font-semibold underline underline-offset-2"
                style={{ color: gustaBrandColors.primary }}
              >
                Politica de confidentialitate
              </Link>
              .
            </p>
            <p className="assoc-body text-[11px] leading-snug" style={{ color: '#6b7a72' }}>
              Produsele alimentare proaspete/perisabile pot fi exceptate de la dreptul de retragere
              (OUG 34/2014). Garantia legala de conformitate se aplica in limitele legii.
            </p>
          </div>

          <div
            className="sticky bottom-0 z-[1] -mx-4 border-t bg-white/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] pt-3 backdrop-blur md:col-span-2 md:mx-0 md:border-0 md:bg-transparent md:px-0 md:pb-0 md:pt-0 md:backdrop-blur-0"
            style={{ borderColor: gustaPrimaryTints[40] }}
          >
            {inlineError ? (
              <p
                className="mb-3 rounded-xl border px-3 py-2 text-sm"
                style={{
                  borderColor: '#f5c2c7',
                  backgroundColor: '#fef2f2',
                  color: '#b42318',
                }}
              >
                {inlineError}
              </p>
            ) : null}

            <button
              type="button"
              disabled={submitDisabled}
              onClick={() => void submit()}
              className={cn(
                'assoc-heading flex min-h-[52px] w-full items-center justify-center gap-2 rounded-[14px] text-base font-bold text-white transition duration-200 ease-out',
                'hover:scale-[1.03] hover:brightness-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100',
              )}
              style={
                {
                  backgroundColor: gustaBrandColors.primary,
                  boxShadow: gustaBrandShadows.sm,
                  ['--tw-outline-color' as string]: '#fff',
                } as CSSProperties
              }
            >
              {submitting ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : null}
              Plaseaza comanda cu obligatie de plata
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
