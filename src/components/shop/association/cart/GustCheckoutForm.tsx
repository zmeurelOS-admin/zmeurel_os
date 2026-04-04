'use client'

import { useMemo, useState, type CSSProperties } from 'react'
import Link from 'next/link'
import { ArrowLeft, Loader2 } from 'lucide-react'

import { gustaBrandColors, gustaBrandShadows, gustaPrimaryTints } from '@/lib/shop/association/brand-tokens'
import { defaultResolvedMerchant, type ResolvedMerchantPublic } from '@/lib/shop/association/merchant-info'
import { postShopOrderWithRetry } from '@/lib/shop/association/checkout-fetch'
import {
  formatDeliveryDateFromIso,
  getAmountUntilFreeDelivery,
  getDeliveryFee,
  getNextDeliveryDateIso,
} from '@/lib/shop/association/delivery'
import { cn } from '@/lib/utils'
import { toast } from '@/lib/ui/toast'

import type { GustCartItem, GustCheckoutSuccess } from './gustCartTypes'

const INPUT_CLASS =
  'assoc-body w-full rounded-xl border-[1.5px] px-4 py-3 text-sm outline-none transition-[border-color,box-shadow] focus-visible:ring-2 focus-visible:ring-offset-2'

const RO_PHONE_DIGITS = /^[0-9+()\s.-]{10,}$/

function normalizeRoPhone(raw: string): string {
  return raw.replace(/\s/g, '').replace(/^\+40/, '0')
}

function isLikelyRoPhone(s: string): boolean {
  const n = normalizeRoPhone(s)
  if (n.length < 10) return false
  if (!RO_PHONE_DIGITS.test(s)) return false
  const digits = n.replace(/\D/g, '')
  return digits.length >= 10
}

function formatLei(n: number): string {
  return new Intl.NumberFormat('ro-RO', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(n)
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

export type GustCheckoutFormProps = {
  items: GustCartItem[]
  onBack: () => void
  /** După toate comenzile reușite — părintele golește coșul / închide sheet-ul. */
  onComplete: (result: GustCheckoutSuccess) => void
  /** Comerciant (din setări publice); fallback la brand dacă lipsește. */
  merchant?: ResolvedMerchantPublic
}

const TERMS_HREF = '/magazin/asociatie/termeni'
const PRIVACY_HREF = '/magazin/asociatie/confidentialitate'

export function GustCheckoutForm({ items, onBack, onComplete, merchant }: GustCheckoutFormProps) {
  const m = merchant ?? defaultResolvedMerchant()
  const [nume, setNume] = useState('')
  const [telefon, setTelefon] = useState('')
  const [locatie, setLocatie] = useState('')
  const [observatii, setObservatii] = useState('')
  const [whatsappConsent, setWhatsappConsent] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [inlineError, setInlineError] = useState<string | null>(null)

  const grouped = useMemo(() => {
    const m = new Map<string, { farmName: string; lines: GustCartItem[] }>()
    for (const it of items) {
      const cur = m.get(it.tenantId)
      if (!cur) m.set(it.tenantId, { farmName: it.farmName, lines: [it] })
      else cur.lines.push(it)
    }
    return Array.from(m.entries()).map(([tenantId, v]) => ({ tenantId, ...v }))
  }, [items])

  const estimatedTotal = useMemo(() => {
    return items.reduce((s, it) => {
      if (it.price == null) return s
      return s + Number(it.price) * it.qty
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
  const qtySum = useMemo(() => items.reduce((s, it) => s + it.qty, 0), [items])

  const validate = (): string | null => {
    if (nume.trim().length < 2) return 'Introdu numele complet.'
    if (!isLikelyRoPhone(telefon)) return 'Introdu un număr de telefon valid (România).'
    if (locatie.trim().length < 3) return 'Introdu localitatea sau adresa.'
    if (observatii.length > 500) return 'Observațiile au maxim 500 de caractere.'
    return null
  }

  const submit = async () => {
    setInlineError(null)
    const v = validate()
    if (v) {
      setInlineError(v)
      toast.error(v)
      return
    }
    if (items.length === 0) return

    setSubmitting(true)
    try {
      let allIds: string[] = []
      let linesSubtotalSum = 0
      let serverDeliveryFee: number | null = null
      let deliveryDateIsoFromApi = ''
      let curCurrency = items[0]?.moneda ?? 'RON'

      for (let farmIndex = 0; farmIndex < grouped.length; farmIndex++) {
        const g = grouped[farmIndex]!
        const lines = g.lines.map((l) => ({
          produsId: l.id,
          qty: l.qty,
        }))
        const body = {
          channel: 'association_shop' as const,
          tenantId: g.tenantId,
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
          whatsappConsent,
        }
        let res: Response
        try {
          res = await postShopOrderWithRetry(body)
        } catch {
          const msg = 'Eroare de rețea. Încearcă din nou.'
          setInlineError(msg)
          toast.error(msg)
          return
        }
        let data: {
          ok?: boolean
          error?: string
          orderIds?: string[]
          totalLei?: number
          linesSubtotalLei?: number
          cartDeliveryFeeLei?: number
          deliveryDateIso?: string
          currency?: string
        } = {}
        try {
          const text = await res.text()
          data = text ? (JSON.parse(text) as typeof data) : {}
        } catch {
          data = {}
        }
        if (!res.ok || !data.ok || !data.orderIds?.length) {
          const msg = typeof data.error === 'string' ? data.error : 'Nu am putut trimite comanda.'
          setInlineError(msg)
          toast.error(msg)
          return
        }
        allIds = allIds.concat(data.orderIds)
        linesSubtotalSum += Number(data.linesSubtotalLei ?? data.totalLei ?? 0)
        if (farmIndex === 0 && typeof data.cartDeliveryFeeLei === 'number') {
          serverDeliveryFee = data.cartDeliveryFeeLei
        }
        if (typeof data.deliveryDateIso === 'string' && data.deliveryDateIso) {
          deliveryDateIsoFromApi = data.deliveryDateIso
        }
        curCurrency = data.currency ?? curCurrency
      }

      const fee = serverDeliveryFee !== null ? serverDeliveryFee : getDeliveryFee(estimatedTotal)
      const dateLabel = deliveryDateIsoFromApi
        ? formatDeliveryDateFromIso(deliveryDateIsoFromApi)
        : deliveryDateLabel

      const placedAt = new Date()
      const placedAtIso = placedAt.toISOString()
      const placedAtLabel = placedAt.toLocaleString('ro-RO', {
        timeZone: 'Europe/Bucharest',
        dateStyle: 'long',
        timeStyle: 'short',
      })
      const summaryLines = items.map((it) => ({
        productName: it.name,
        farmName: it.farmName,
        qty: it.qty,
        unit: it.unit,
        unitPrice: it.price ?? 0,
        lineTotal: round2((it.price ?? 0) * it.qty),
        currency: it.moneda,
      }))

      onComplete({
        orderIds: allIds,
        totalLei: linesSubtotalSum,
        currency: curCurrency,
        farmCount: grouped.length,
        deliveryFeeLei: fee,
        grandTotalLei: round2(linesSubtotalSum + fee),
        deliveryDateLabel: dateLabel,
        placedAtIso,
        placedAtLabel,
        clientName: nume.trim(),
        clientTelefon: telefon.trim(),
        clientLocatie: locatie.trim(),
        whatsappConsent,
        summaryLines,
      })
    } catch (err) {
      const msg =
        err instanceof Error && err.name === 'AbortError'
          ? 'Cererea a expirat (10s). Încearcă din nou.'
          : 'Eroare de rețea. Încearcă din nou.'
      setInlineError(msg)
      toast.error(msg)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <button
        type="button"
        onClick={onBack}
        className="assoc-body mb-4 flex items-center gap-2 text-sm font-semibold transition hover:opacity-80"
        style={{ color: gustaBrandColors.primary }}
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Înapoi la coș
      </button>

      <h2 className="assoc-heading text-xl font-extrabold" style={{ color: gustaBrandColors.text }}>
        Finalizează comanda
      </h2>

      <div
        className="mt-4 rounded-2xl border p-4 text-left"
        style={{ borderColor: gustaPrimaryTints[40], backgroundColor: '#fff' }}
      >
        <p className="assoc-heading text-xs font-bold uppercase tracking-wide" style={{ color: gustaPrimaryTints[80] }}>
          Rezumat
        </p>
        <ul className="mt-2 space-y-2">
          {grouped.map((g) => (
            <li key={g.tenantId} className="border-t pt-2 first:border-t-0 first:pt-0" style={{ borderColor: gustaPrimaryTints[20] }}>
              <p className="text-xs font-bold" style={{ color: gustaBrandColors.primary }}>
                {g.farmName}
              </p>
              <ul className="mt-1 space-y-0.5 text-xs" style={{ color: '#5a6563' }}>
                {g.lines.map((l) => (
                  <li key={l.id} className="flex justify-between gap-2">
                    <span className="min-w-0 truncate">
                      {l.name} × {l.qty} {l.unit}
                    </span>
                    {l.price != null ? (
                      <span className="shrink-0 tabular-nums font-semibold">
                        {formatLei(Number(l.price) * l.qty)} {l.moneda}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-5 min-h-0 flex-1 space-y-4 overflow-y-auto pb-2">
        <div>
          <label className="assoc-body mb-1.5 block text-[13px] font-bold" style={{ color: gustaBrandColors.text }}>
            Nume complet
          </label>
          <input
            type="text"
            autoComplete="name"
            value={nume}
            onChange={(e) => setNume(e.target.value)}
            className={INPUT_CLASS}
            style={{
              borderColor: gustaPrimaryTints[40],
              color: gustaBrandColors.text,
            }}
            onFocus={(e) => {
              e.target.style.borderColor = gustaBrandColors.primary
              e.target.style.boxShadow = `0 0 0 3px ${gustaBrandColors.primary}1a`
            }}
            onBlur={(e) => {
              e.target.style.borderColor = gustaPrimaryTints[40]
              e.target.style.boxShadow = 'none'
            }}
          />
        </div>
        <div>
          <label className="assoc-body mb-1.5 block text-[13px] font-bold" style={{ color: gustaBrandColors.text }}>
            Telefon
          </label>
          <input
            type="tel"
            autoComplete="tel"
            inputMode="tel"
            placeholder="07xx xxx xxx"
            pattern="[0-9+\\s().-]{10,}"
            value={telefon}
            onChange={(e) => setTelefon(e.target.value)}
            className={INPUT_CLASS}
            style={{
              borderColor: gustaPrimaryTints[40],
              color: gustaBrandColors.text,
            }}
            onFocus={(e) => {
              e.target.style.borderColor = gustaBrandColors.primary
              e.target.style.boxShadow = `0 0 0 3px ${gustaBrandColors.primary}1a`
            }}
            onBlur={(e) => {
              e.target.style.borderColor = gustaPrimaryTints[40]
              e.target.style.boxShadow = 'none'
            }}
          />
        </div>
        <div>
          <label className="assoc-body mb-1.5 block text-[13px] font-bold" style={{ color: gustaBrandColors.text }}>
            Localitate / Adresă
          </label>
          <input
            type="text"
            autoComplete="street-address"
            value={locatie}
            onChange={(e) => setLocatie(e.target.value)}
            className={INPUT_CLASS}
            style={{
              borderColor: gustaPrimaryTints[40],
              color: gustaBrandColors.text,
            }}
            onFocus={(e) => {
              e.target.style.borderColor = gustaBrandColors.primary
              e.target.style.boxShadow = `0 0 0 3px ${gustaBrandColors.primary}1a`
            }}
            onBlur={(e) => {
              e.target.style.borderColor = gustaPrimaryTints[40]
              e.target.style.boxShadow = 'none'
            }}
          />
          <p className="assoc-body mt-2 text-[12px] leading-relaxed" style={{ color: '#5a6563' }}>
            📍 Livrăm în municipiul Suceava și localitățile limitrofe. Pentru alte zone, contactați{' '}
            {m.legalName}.
          </p>
        </div>
        <div className="rounded-xl border px-3 py-3" style={{ borderColor: gustaPrimaryTints[40], backgroundColor: '#fff' }}>
          <label className="flex cursor-pointer items-start gap-3 text-left">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 shrink-0 rounded border-[var(--border-default)]"
              checked={whatsappConsent}
              onChange={(e) => setWhatsappConsent(e.target.checked)}
            />
            <span className="text-[13px] leading-snug" style={{ color: gustaBrandColors.text }}>
              Sunt de acord să fiu contactat pe WhatsApp la numărul indicat pentru detalii despre comandă și
              livrare.
            </span>
          </label>
          <p className="assoc-body mt-2 pl-7 text-[11px] leading-snug" style={{ color: '#6b7a72' }}>
            {m.legalName} vă va contacta pentru confirmarea și coordonarea livrării.
          </p>
        </div>
        <div>
          <label className="assoc-body mb-1.5 block text-[13px] font-bold" style={{ color: gustaBrandColors.text }}>
            Observații (opțional)
          </label>
          <textarea
            value={observatii}
            onChange={(e) => setObservatii(e.target.value.slice(0, 500))}
            rows={3}
            maxLength={500}
            className={cn(INPUT_CLASS, 'resize-y')}
            style={{
              borderColor: gustaPrimaryTints[40],
              color: gustaBrandColors.text,
            }}
            onFocus={(e) => {
              e.target.style.borderColor = gustaBrandColors.primary
              e.target.style.boxShadow = `0 0 0 3px ${gustaBrandColors.primary}1a`
            }}
            onBlur={(e) => {
              e.target.style.borderColor = gustaPrimaryTints[40]
              e.target.style.boxShadow = 'none'
            }}
          />
          <p className="mt-1 text-right text-[11px]" style={{ color: gustaPrimaryTints[80] }}>
            {observatii.length}/500
          </p>
        </div>

        {inlineError ? (
          <p className="rounded-xl border px-3 py-2 text-sm" style={{ borderColor: '#f5c2c7', backgroundColor: '#fef2f2', color: '#b42318' }}>
            {inlineError}
          </p>
        ) : null}
      </div>

      <div className="shrink-0 space-y-3 pt-2">
        <div
          className="rounded-[12px] border px-4 py-3.5"
          style={{
            backgroundColor: gustaBrandColors.secondary,
            borderColor: gustaPrimaryTints[40],
          }}
        >
          <p className="assoc-heading text-xs font-bold uppercase tracking-wide" style={{ color: gustaPrimaryTints[80] }}>
            Rezumat comandă
          </p>
          <p className="assoc-body mt-2 text-sm" style={{ color: gustaBrandColors.text }}>
            <span className="font-semibold">Comerciant:</span> {m.legalName}
          </p>
          <p className="assoc-body mt-1 text-sm" style={{ color: '#5a6563' }}>
            Produse: {lineCount} {lineCount === 1 ? 'linie' : 'linii'} · Cantitate totală:{' '}
            {new Intl.NumberFormat('ro-RO', { maximumFractionDigits: 2 }).format(qtySum)}
          </p>
          <div className="assoc-body mt-3 space-y-1 border-t pt-3 text-sm" style={{ borderColor: gustaPrimaryTints[40], color: '#5a6563' }}>
            <div className="flex justify-between gap-2">
              <span>Subtotal produse</span>
              <span className="tabular-nums font-medium" style={{ color: gustaBrandColors.text }}>
                {formatLei(estimatedTotal)} {items[0]?.moneda ?? 'RON'}
              </span>
            </div>
            <div className="flex justify-between gap-2">
              <span>Livrare</span>
              <span className="tabular-nums font-medium" style={{ color: gustaBrandColors.text }}>
                {deliveryFee > 0 ? `${formatLei(deliveryFee)} ${items[0]?.moneda ?? 'RON'}` : 'Gratuită'}
              </span>
            </div>
            <div className="flex justify-between gap-2 border-t pt-2" style={{ borderColor: gustaPrimaryTints[40] }}>
              <span className="font-bold" style={{ color: gustaBrandColors.text }}>
                TOTAL
              </span>
              <span className="text-lg font-extrabold tabular-nums" style={{ color: gustaBrandColors.primary }}>
                {formatLei(grandTotal)} {items[0]?.moneda ?? 'RON'}
              </span>
            </div>
            <div className="flex justify-between gap-2 pt-1 text-sm">
              <span>Plată</span>
              <span className="font-semibold" style={{ color: gustaBrandColors.text }}>
                Cash la livrare
              </span>
            </div>
            <p className="assoc-body pt-1 text-sm font-bold" style={{ color: gustaBrandColors.primary }}>
              📅 Livrare estimată: {deliveryDateLabel}
            </p>
          </div>
          {amountUntilFree > 0 ? (
            <p className="assoc-body mt-2 text-[13px] font-semibold leading-snug" style={{ color: gustaBrandColors.accent }}>
              💡 Mai adaugă {formatLei(amountUntilFree)} {items[0]?.moneda ?? 'RON'} pentru livrare GRATUITĂ!
            </p>
          ) : null}
          <p className="assoc-body mt-3 border-t pt-3 text-[11px] leading-relaxed" style={{ borderColor: gustaPrimaryTints[40], color: '#6b7a72' }}>
            Produsele alimentare proaspete/perisabile pot fi exceptate de la dreptul de retragere (OUG 34/2014).
            Garanție legală de conformitate: 2 ani (în limitele legii).{' '}
            <Link href={TERMS_HREF} className="font-semibold underline underline-offset-2" style={{ color: gustaBrandColors.primary }}>
              Detalii în Termeni și condiții
            </Link>
            .
          </p>
        </div>

        <button
          type="button"
          disabled={submitting || items.length === 0}
          onClick={() => void submit()}
          className={cn(
            'assoc-heading flex min-h-[52px] w-full items-center justify-center gap-2 rounded-[14px] text-base font-bold text-white transition duration-200 ease-out',
            'hover:scale-[1.03] hover:brightness-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50 disabled:hover:scale-100',
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
          Plasează comanda cu obligație de plată
        </button>
        <p className="assoc-body text-center text-[11px] leading-snug" style={{ color: '#6b7a72' }}>
          Conform OUG nr. 34/2014, art. 7 alin. (3) — comanda online constituie ofertă fermă.
        </p>
        {/* DRAFT_LEGAL_REVIEW — de revizuit cu avocat — linkuri către T&C și confidențialitate */}
        <p className="assoc-body text-center text-[11px] leading-snug" style={{ color: '#6b7a72' }}>
          Prin plasarea comenzii, accepți{' '}
          <Link href={TERMS_HREF} className="font-semibold underline underline-offset-2" style={{ color: gustaBrandColors.primary }}>
            Termenii și condițiile
          </Link>{' '}
          și{' '}
          <Link href={PRIVACY_HREF} className="font-semibold underline underline-offset-2" style={{ color: gustaBrandColors.primary }}>
            Politica de confidențialitate
          </Link>
          .
        </p>
      </div>
    </div>
  )
}
