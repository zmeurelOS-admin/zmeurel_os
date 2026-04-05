'use client'

import { useEffect, useState, type CSSProperties } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { X } from 'lucide-react'

import { useAssociationShop } from '@/components/shop/association/association-shop-context'
import { labelForCategory } from '@/components/shop/association/tokens'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { gustaBrandColors } from '@/lib/shop/association/brand-tokens'
import { resolveMerchantPublicInfo } from '@/lib/shop/association/merchant-info'
import { formatQuantityForDisplay } from '@/lib/shop/utils'
import { cn } from '@/lib/utils'

import { getGustCategoryVisual } from './gustCategoryVisual'
import { collectProductImageUrls, formatGustPrice, type GustCatalogProduct } from './gustProductTypes'

const MD = '(min-width: 768px)'
const ANIM_MS = 400

export type GustProductDetailProps = {
  product: GustCatalogProduct | null
  isOpen: boolean
  onClose: () => void
  onAddToCart: () => void
  cartQuantity: number
  farmName: string
  badge?: string
}

export function GustProductDetail({
  product: p,
  isOpen,
  onClose,
  onAddToCart,
  cartQuantity,
  farmName,
  badge,
}: GustProductDetailProps) {
  const router = useRouter()
  const { publicSettings } = useAssociationShop()
  const merchant = resolveMerchantPublicInfo(publicSettings)
  const isDesktop = useMediaQuery(MD)
  const [mounted, setMounted] = useState(false)
  const [animateIn, setAnimateIn] = useState(false)

  useEffect(() => {
    if (isOpen && p) {
      let inner = 0
      const outer = requestAnimationFrame(() => {
        setMounted(true)
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
  }, [isOpen, p])

  useEffect(() => {
    if (!mounted || !isOpen || !p) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mounted, isOpen, p, onClose])

  if (!mounted || !p) return null

  const urls = collectProductImageUrls(p)
  const firstUrl = urls[0]
  const { bg, emoji } = getGustCategoryVisual(p.categorie)
  const categoryLabel = labelForCategory(p.categorie)
  const gramaj =
    p.gramaj_per_unitate != null && Number.isFinite(p.gramaj_per_unitate)
      ? `${p.gramaj_per_unitate} g`
      : null
  const producerName = p.farmName?.trim() || farmName
  const producerHref = p.tenantId ? `/magazin/asociatie/producatori/${p.tenantId}` : null

  const mobileSlide = animateIn ? 'translateY(0)' : 'translateY(100%)'
  const desktopSlide = animateIn ? 'translateY(0) scale(1)' : 'translateY(24px) scale(0.98)'
  const sheetTransform = isDesktop ? desktopSlide : mobileSlide

  const overlayOpacity = animateIn ? 1 : 0

  return (
    <div className="fixed inset-0" style={{ zIndex: 300 }}>
      <div
        aria-hidden
        className="absolute inset-0 z-0 bg-black/40 transition-opacity ease-out"
        style={{
          opacity: overlayOpacity,
          transitionDuration: `${ANIM_MS}ms`,
        }}
        onClick={onClose}
      />

      <div className="pointer-events-none absolute inset-0 z-10 flex items-end justify-center md:items-center md:p-6">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="gust-product-detail-title"
          className={cn(
            'pointer-events-auto flex max-h-[90dvh] w-full flex-col overflow-hidden bg-white shadow-2xl transition-transform ease-out',
            isDesktop ? 'max-w-[520px] rounded-[20px]' : 'rounded-t-[24px]',
          )}
          style={{
            transform: sheetTransform,
            transitionDuration: `${ANIM_MS}ms`,
            boxShadow: '0 16px 48px rgba(13, 99, 66, 0.15)',
            paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="relative h-[220px] w-full shrink-0 overflow-hidden">
            {firstUrl ? (
              <Image
                src={firstUrl}
                alt={p.nume}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 520px"
                unoptimized
                loading="lazy"
              />
            ) : (
              <div
                className="flex h-full w-full items-center justify-center text-7xl"
                style={{ backgroundColor: bg }}
                aria-hidden
              >
                {emoji}
              </div>
            )}
            {badge ? (
              <span
                className="absolute left-3 top-3 rounded px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white"
                style={{ backgroundColor: gustaBrandColors.accent }}
              >
                {badge}
              </span>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              className={cn(
                'absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full border-0 shadow-md backdrop-blur-sm transition hover:bg-white',
                'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2',
              )}
              style={
                {
                  backgroundColor: 'rgba(255,255,255,0.9)',
                  color: gustaBrandColors.text,
                  ['--tw-outline-color' as string]: gustaBrandColors.primary,
                } as CSSProperties
              }
              aria-label="Închide detaliile produsului"
            >
              <X className="h-5 w-5" strokeWidth={2.5} aria-hidden />
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4 pt-4">
            <h2
              id="gust-product-detail-title"
              className="text-[22px] leading-tight"
              style={{ color: gustaBrandColors.text, fontWeight: 800 }}
            >
              {p.nume}
            </h2>
            {producerHref ? (
              <button
                type="button"
                className="mt-2 inline-flex items-center gap-2 text-left text-sm font-semibold text-[#0D6342] transition-colors hover:text-[#FF9E1B] hover:underline"
                onClick={(event) => {
                  event.stopPropagation()
                  onClose()
                  router.push(producerHref)
                }}
              >
                {p.producerLogoUrl ? (
                  <span className="relative h-5 w-5 overflow-hidden rounded-full">
                    <Image
                      src={p.producerLogoUrl}
                      alt=""
                      fill
                      className="object-cover"
                      sizes="20px"
                      unoptimized
                    />
                  </span>
                ) : (
                  <span aria-hidden>🌱</span>
                )}
                <span>{producerName}</span>
                <span className="text-[10px] opacity-60" aria-hidden>
                  ›
                </span>
              </button>
            ) : (
              <p
                className="mt-2 flex items-center gap-1.5 text-sm font-semibold"
                style={{ color: gustaBrandColors.primary }}
              >
                <span aria-hidden>🌱</span>
                {producerName}
              </p>
            )}
            <p className="mt-2 flex items-start gap-1.5 text-[12px] leading-snug" style={{ color: '#6b7a72' }}>
              <span aria-hidden>🏛</span>
              <span>Vândut de {merchant.legalName}</span>
            </p>
            {p.descriere?.trim() ? (
              <p className="mt-4 text-sm leading-relaxed" style={{ color: '#5a6563' }}>
                {p.descriere}
              </p>
            ) : null}

            {p.ingrediente?.trim() ? (
              <p className="mt-3 text-sm leading-relaxed" style={{ color: '#5a6563' }}>
                <span className="font-semibold" style={{ color: gustaBrandColors.text }}>
                  Ingrediente:{' '}
                </span>
                {p.ingrediente.trim()}
              </p>
            ) : null}
            {p.alergeni?.trim() ? (
              <p className="mt-2 text-sm font-bold leading-relaxed" style={{ color: '#CF222E' }}>
                Alergeni: {p.alergeni.trim()}
              </p>
            ) : null}
            {p.conditii_pastrare?.trim() ? (
              <p className="mt-3 text-sm leading-relaxed" style={{ color: '#5a6563' }}>
                <span className="font-semibold" style={{ color: gustaBrandColors.text }}>
                  Condiții de păstrare:{' '}
                </span>
                {p.conditii_pastrare.trim()}
              </p>
            ) : null}
            {p.termen_valabilitate?.trim() ? (
              <p className="mt-2 text-sm leading-relaxed" style={{ color: '#5a6563' }}>
                <span className="font-semibold" style={{ color: gustaBrandColors.text }}>
                  Termen de valabilitate:{' '}
                </span>
                {p.termen_valabilitate.trim()}
              </p>
            ) : null}

            <div className="mt-4 flex flex-wrap gap-2">
              <span
                className="rounded-full px-3 py-1 text-xs font-semibold"
                style={{
                  backgroundColor: `${gustaBrandColors.primary}14`,
                  color: gustaBrandColors.primary,
                }}
              >
                {categoryLabel}
              </span>
              <span
                className="rounded-full px-3 py-1 text-xs font-semibold"
                style={{ backgroundColor: '#f0efec', color: '#5a6563' }}
              >
                {p.unitate_vanzare}
                {gramaj ? ` · ${gramaj}` : ''}
              </span>
            </div>
          </div>

          <div
            className="flex shrink-0 flex-col gap-3 border-t px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
            style={{ borderColor: '#e8e4db' }}
          >
            <div>
              <p
                className="text-[28px] font-extrabold tabular-nums leading-none"
                style={{ color: gustaBrandColors.primary }}
              >
                {formatGustPrice(p)} <span className="text-base font-bold">{p.moneda}</span>
              </p>
              <p className="mt-1 text-sm" style={{ color: '#5a6563' }}>
                / {p.unitate_vanzare}
              </p>
            </div>
            <button
              type="button"
              onClick={onAddToCart}
              className={cn(
                'min-h-[48px] rounded-[14px] px-7 py-3.5 text-sm font-bold text-white transition duration-200 ease-out',
                'hover:scale-[1.03] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 active:scale-[0.99]',
              )}
              style={
                {
                  backgroundColor: gustaBrandColors.primary,
                  ['--tw-outline-color' as string]: '#fff',
                } as CSSProperties
              }
            >
              {cartQuantity > 0
                ? `În coș (${formatQuantityForDisplay(cartQuantity, p.unitate_vanzare)})`
                : 'Adaugă în coș'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
