'use client'

import { useEffect, useLayoutEffect, useMemo, useState, type CSSProperties } from 'react'
import Image from 'next/image'
import { Minus, Plus, Truck, X } from 'lucide-react'

import { useAssociationShop } from '@/components/shop/association/association-shop-context'
import { getGustCategoryVisual } from '@/components/shop/association/catalog/gustCategoryVisual'
import { collectProductImageUrls } from '@/components/shop/association/catalog/gustProductTypes'
import type { GustCatalogProduct } from '@/components/shop/association/catalog/gustProductTypes'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { gustaBrandColors, gustaBrandShadows, gustaPrimaryTints } from '@/lib/shop/association/brand-tokens'
import { getAmountUntilFreeDelivery, getDeliveryFee } from '@/lib/shop/association/delivery'
import { resolveMerchantPublicInfo } from '@/lib/shop/association/merchant-info'
import { formatQuantityForDisplay, getQuantityStep } from '@/lib/shop/utils'
import { cn } from '@/lib/utils'

import { GustCheckoutForm } from './GustCheckoutForm'
import type { GustCartItem, GustCheckoutSuccess } from './gustCartTypes'
import { qtyStepForUnit } from './gustCartTypes'

const MD = '(min-width: 768px)'
const ANIM_MS = 400

function formatLinePrice(it: GustCartItem): string {
  if (it.price == null) return '—'
  return new Intl.NumberFormat('ro-RO', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number(it.price) * it.qty)
}

export type GustCartSheetProps = {
  open: boolean
  onClose: () => void
  items: GustCartItem[]
  /** Delta pozitiv sau negativ; la qty ≤ 0 părintele elimină linia. */
  onAdjustQty: (productId: string, delta: number) => void
  onCheckoutSuccess: (result: GustCheckoutSuccess) => void
  getProductImageUrls?: (productId: string) => string[]
}

export function GustCartSheet({
  open,
  onClose,
  items,
  onAdjustQty,
  onCheckoutSuccess,
  getProductImageUrls,
}: GustCartSheetProps) {
  const { publicSettings } = useAssociationShop()
  const merchant = resolveMerchantPublicInfo(publicSettings)
  const isDesktop = useMediaQuery(MD)
  const [step, setStep] = useState<'cart' | 'checkout'>('cart')
  const [mounted, setMounted] = useState(false)
  const [animateIn, setAnimateIn] = useState(false)

  useLayoutEffect(() => {
    if (open) {
      let inner = 0
      const outer = requestAnimationFrame(() => {
        setMounted(true)
        setAnimateIn(false)
        inner = requestAnimationFrame(() => setAnimateIn(true))
      })
      return () => {
        cancelAnimationFrame(outer)
        cancelAnimationFrame(inner)
      }
    }
    const fade = requestAnimationFrame(() => setAnimateIn(false))
    const unmount = window.setTimeout(() => setMounted(false), ANIM_MS)
    return () => {
      cancelAnimationFrame(fade)
      window.clearTimeout(unmount)
    }
  }, [open])

  useEffect(() => {
    if (!open || !mounted) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, mounted, onClose])

  useEffect(() => {
    if (!open) return
    const id = window.setTimeout(() => setStep('cart'), 0)
    return () => window.clearTimeout(id)
  }, [open])

  const total = useMemo(() => {
    return items.reduce((s, it) => {
      if (it.price == null) return s
      return s + Number(it.price) * it.qty
    }, 0)
  }, [items])

  const currency = items[0]?.moneda ?? 'RON'

  const deliveryHint = useMemo(() => {
    if (items.length === 0) return null
    const fee = getDeliveryFee(total)
    const until = getAmountUntilFreeDelivery(total)
    if (fee > 0) {
      return `🚚 +15 ${currency} livrare · Mai adaugă ${new Intl.NumberFormat('ro-RO', { maximumFractionDigits: 2 }).format(until)} ${currency} pt livrare gratuită`
    }
    return '🚚 Livrare gratuită ✓'
  }, [items.length, total, currency])

  const overlayOpacity = animateIn ? 1 : 0
  const mobileSlide = animateIn ? 'translateY(0)' : 'translateY(100%)'
  const desktopSlide = animateIn ? 'translateY(0) scale(1)' : 'translateY(20px) scale(0.98)'
  const sheetTransform = isDesktop ? desktopSlide : mobileSlide

  if (!mounted) return null

  return (
    <div className="fixed inset-0 z-[300]" role="presentation">
      <button
        type="button"
        aria-label="Închide panoul coșului"
        className="absolute inset-0 border-0 bg-black/40 transition-opacity ease-out"
        style={{
          opacity: overlayOpacity,
          transitionDuration: `${ANIM_MS}ms`,
        }}
        onClick={onClose}
      />

      <div
        className={cn(
          'pointer-events-none absolute inset-0 flex justify-center',
          isDesktop ? 'items-center p-4' : 'items-end',
        )}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="gust-cart-title"
          className={cn(
            'pointer-events-auto flex w-full flex-col overflow-hidden bg-white shadow-2xl transition-transform ease-out',
            isDesktop
              ? step === 'checkout'
                ? 'max-h-[90vh] rounded-[20px]'
                : 'max-h-[85vh] max-w-[440px] rounded-[20px]'
              : 'max-h-[88dvh] max-w-[440px] rounded-t-[24px]',
          )}
          style={{
            boxShadow: gustaBrandShadows.lg,
            transform: sheetTransform,
            transitionDuration: `${ANIM_MS}ms`,
            width: isDesktop && step === 'checkout' ? 'clamp(640px, 72vw, 720px)' : undefined,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div
            className="sticky top-0 z-[1] flex shrink-0 items-center justify-between border-b px-4 py-4"
            style={{ borderColor: gustaPrimaryTints[40], backgroundColor: gustaBrandColors.secondary }}
          >
            <h2
              id="gust-cart-title"
              className="assoc-heading text-xl font-extrabold"
              style={{ color: gustaBrandColors.primary, fontWeight: 800 }}
            >
              {step === 'cart' ? 'Coșul tău' : 'Checkout'}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className={cn(
                'flex h-9 w-9 items-center justify-center rounded-full border-0 transition hover:bg-black/5',
                'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2',
              )}
              style={
                {
                  color: gustaBrandColors.text,
                  ['--tw-outline-color' as string]: gustaBrandColors.primary,
                } as CSSProperties
              }
              aria-label="Închide coșul"
            >
              <X className="h-5 w-5" strokeWidth={2.5} aria-hidden />
            </button>
          </div>

          {step === 'cart' ? (
            <>
              <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
                {items.length === 0 ? (
                  <div className="flex flex-col items-center py-14 text-center">
                    <span className="text-5xl" aria-hidden>
                      🧺
                    </span>
                    <p className="assoc-heading mt-4 text-lg font-bold" style={{ color: gustaBrandColors.text }}>
                      Coșul este gol
                    </p>
                    <p className="assoc-body mt-2 max-w-xs text-sm" style={{ color: '#5a6563' }}>
                      Adaugă produse din magazin pentru a continua.
                    </p>
                  </div>
                ) : (
                  <ul className="space-y-3">
                    {items.map((it) => (
                      <GustCartLineRow
                        key={it.id}
                        item={it}
                        imageUrls={getProductImageUrls?.(it.id)}
                        onMinus={() => {
                          const { step: qtyStep, min } = getQuantityStep(it.unit)
                          const nextQty = it.qty - qtyStep
                          onAdjustQty(it.id, nextQty < min ? -it.qty : -qtyStep)
                        }}
                        onPlus={() => onAdjustQty(it.id, qtyStepForUnit(it.unit))}
                      />
                    ))}
                  </ul>
                )}
              </div>

              <div
                className="sticky bottom-0 shrink-0 border-t px-4 pt-4"
                style={{
                  borderColor: gustaPrimaryTints[40],
                  backgroundColor: '#fff',
                  paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 0px))',
                }}
              >
                <div className="flex items-center justify-between">
                  <span className="assoc-body text-sm font-semibold" style={{ color: gustaBrandColors.text }}>
                    Total
                  </span>
                  <span
                    className="assoc-heading text-lg font-extrabold tabular-nums"
                    style={{ color: gustaBrandColors.primary }}
                  >
                    {new Intl.NumberFormat('ro-RO', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(
                      total,
                    )}{' '}
                    {currency}
                  </span>
                </div>
                {deliveryHint ? (
                  <p
                    className="assoc-body mt-2 text-center text-[12px] font-semibold leading-snug sm:text-[13px]"
                    style={{ color: gustaBrandColors.primary }}
                  >
                    {deliveryHint}
                  </p>
                ) : null}
                <p className="assoc-body mt-2 text-center text-[11px] leading-snug" style={{ color: '#6b7a72' }}>
                  Comanda este preluată de {merchant.legalName}.
                </p>
                <button
                  type="button"
                  disabled={items.length === 0}
                  onClick={() => setStep('checkout')}
                  className={cn(
                    'assoc-heading mt-4 flex min-h-[52px] w-full items-center justify-center gap-2 rounded-[14px] text-base font-bold text-white transition duration-200 ease-out',
                    'hover:scale-[1.03] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:scale-100',
                  )}
                  style={
                    {
                      backgroundColor: gustaBrandColors.primary,
                      boxShadow: gustaBrandShadows.sm,
                      ['--tw-outline-color' as string]: '#fff',
                    } as CSSProperties
                  }
                >
                  <Truck className="h-5 w-5" strokeWidth={2.25} aria-hidden />
                  Continuă spre checkout
                </button>
                <p className="assoc-body mt-3 text-center text-[11px] leading-snug" style={{ color: '#5a6563' }}>
                  Plata se face la livrare (cash). {merchant.legalName} te va contacta pentru confirmare.
                </p>
              </div>
            </>
          ) : (
            <div
              className="flex min-h-0 flex-1 flex-col overflow-hidden px-4 pt-2 md:px-5"
              style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom, 0px))' }}
            >
              <GustCheckoutForm
                items={items}
                onBack={() => setStep('cart')}
                onComplete={onCheckoutSuccess}
                merchant={merchant}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function GustCartLineRow({
  item: it,
  imageUrls,
  onMinus,
  onPlus,
}: {
  item: GustCartItem
  imageUrls?: string[]
  onMinus: () => void
  onPlus: () => void
}) {
  const { bg, emoji } = getGustCategoryVisual(it.category)
  const stub: GustCatalogProduct = {
    id: it.id,
    nume: it.name,
    descriere: null,
    categorie: it.category,
    unitate_vanzare: it.unit,
    gramaj_per_unitate: null,
    pret_unitar: it.price,
    moneda: it.moneda,
    poze: imageUrls,
  }
  const urls = imageUrls ?? collectProductImageUrls(stub)
  const first = urls[0]

  return (
    <li
      className="flex gap-3 rounded-2xl border p-2.5"
      style={{ borderColor: '#e8e4db', backgroundColor: '#fff' }}
    >
      <div
        className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl"
        style={{ backgroundColor: first ? undefined : bg }}
      >
        {first ? (
          <Image
            src={first}
            alt={it.name}
            fill
            className="object-cover"
            sizes="56px"
            unoptimized
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-2xl" aria-hidden>
            {emoji}
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold" style={{ color: gustaBrandColors.text }}>
          {it.name}
        </p>
        <p className="mt-0.5 text-xs tabular-nums" style={{ color: '#5a6563' }}>
          {it.price != null
            ? `${new Intl.NumberFormat('ro-RO', { maximumFractionDigits: 2 }).format(Number(it.price))} ${it.moneda}/${it.unit}`
            : `— / ${it.unit}`}{' '}
          · {formatLinePrice(it)} {it.moneda}
        </p>
        <div className="mt-2 flex items-center gap-2">
          <button
            type="button"
            onClick={onMinus}
            className={cn(
              'flex h-[30px] w-[30px] items-center justify-center rounded-lg border text-sm font-bold transition hover:bg-black/[0.03]',
              'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1',
            )}
            style={
              {
                borderColor: gustaPrimaryTints[40],
                color: gustaBrandColors.primary,
                ['--tw-outline-color' as string]: gustaBrandColors.primary,
              } as CSSProperties
            }
            aria-label={`Scade cantitatea pentru ${it.name}`}
          >
            <Minus className="h-4 w-4" strokeWidth={2.5} aria-hidden />
          </button>
          <span
            className="min-w-[2.5rem] text-center text-sm font-bold tabular-nums"
            style={{ color: gustaBrandColors.text }}
          >
            {formatQuantityForDisplay(it.qty, it.unit)}
          </span>
          <button
            type="button"
            onClick={onPlus}
            className={cn(
              'flex h-[30px] w-[30px] items-center justify-center rounded-lg border text-sm font-bold transition hover:bg-black/[0.03]',
              'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1',
            )}
            style={
              {
                borderColor: gustaPrimaryTints[40],
                color: gustaBrandColors.primary,
                ['--tw-outline-color' as string]: gustaBrandColors.primary,
              } as CSSProperties
            }
            aria-label={`Crește cantitatea pentru ${it.name}`}
          >
            <Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden />
          </button>
        </div>
      </div>
    </li>
  )
}
