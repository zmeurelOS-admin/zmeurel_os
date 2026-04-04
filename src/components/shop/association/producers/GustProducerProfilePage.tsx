'use client'

import { useCallback, useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ChevronLeft, MapPin } from 'lucide-react'

import { useAssociationShop } from '@/components/shop/association/association-shop-context'
import { GustProductCard } from '@/components/shop/association/catalog/GustProductCard'
import { labelForCategory } from '@/components/shop/association/tokens'
import type { AssociationProduct } from '@/lib/shop/load-association-catalog'
import type { ProducerFarmPublic } from '@/lib/shop/load-producer-profile'
import {
  ASSOCIATION_SHOP_BASE,
  ASSOCIATION_SHOP_PRODUCATORI_PATH,
  associationShopProdusePath,
} from '@/lib/shop/association-routes'
import { gustaBrandColors, gustaPrimaryTints } from '@/lib/shop/association/brand-tokens'
import { cn } from '@/lib/utils'

const FALLBACK_ABOUT =
  'Producător local verificat, membru al asociației Gustă din Bucovina.'

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function dominantCategoryLabel(products: AssociationProduct[]): string | null {
  if (products.length === 0) return null
  const counts = new Map<string, number>()
  for (const p of products) {
    const k = p.categorie.trim()
    counts.set(k, (counts.get(k) ?? 0) + 1)
  }
  let top = ''
  let topN = -1
  for (const [k, n] of counts) {
    if (n > topN) {
      topN = n
      top = k
    }
  }
  return top ? labelForCategory(top) : null
}

export type GustProducerProfilePageProps = {
  tenantId: string
  farm: ProducerFarmPublic
  products: AssociationProduct[]
  associationMarketLine?: string
}

export function GustProducerProfilePage({
  tenantId,
  farm,
  products,
  associationMarketLine,
}: GustProducerProfilePageProps) {
  const ctx = useAssociationShop()
  const [descExpanded, setDescExpanded] = useState(false)

  const mergedProducts = useMemo(() => {
    const byId = new Map(ctx.products.map((p) => [p.id, p]))
    return products.map((p) => byId.get(p.id) ?? p)
  }, [ctx.products, products])

  const specialtyLabel = farm.specialitate?.trim() || dominantCategoryLabel(mergedProducts) || 'Producător local'
  const aboutText = farm.descrierePublica?.trim() || FALLBACK_ABOUT
  const isCustomDescription = Boolean(farm.descrierePublica?.trim())
  const longText = aboutText.length > 220
  const aboutDisplay =
    !longText || descExpanded ? aboutText : `${aboutText.slice(0, 220).trim()}…`

  const openDetail = useCallback(
    (productId: string) => {
      const p = mergedProducts.find((x) => x.id === productId)
      if (p) ctx.openProductDetail(p)
    },
    [ctx, mergedProducts]
  )

  const addToCart = useCallback(
    (productId: string) => {
      const p = mergedProducts.find((x) => x.id === productId)
      if (p) ctx.addQuickToCart(p)
    },
    [ctx, mergedProducts]
  )

  const rawPoze = farm.pozeFerma.filter((u) => u.trim().length > 0)
  const heroPhoto = rawPoze[0]?.trim()
  const galleryPhotos = heroPhoto ? rawPoze.slice(1, 7) : rawPoze.slice(0, 6)

  return (
    <div className="pb-28 md:pb-12">
      <div className="mx-auto max-w-5xl px-4 pt-6 md:px-6 md:pt-8">
        <Link
          href={ASSOCIATION_SHOP_PRODUCATORI_PATH}
          className="assoc-body mb-6 inline-flex items-center gap-1 text-sm font-semibold transition hover:opacity-90"
          style={{ color: gustaBrandColors.primary }}
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
          Toți producătorii
        </Link>

        {/* Hero */}
        <header className="flex flex-col gap-4 border-b pb-8" style={{ borderColor: '#e8e4db' }}>
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
            <div
              className="relative h-[96px] w-[96px] shrink-0 overflow-hidden rounded-full shadow-md"
              style={{ boxShadow: '0 8px 28px rgba(13,99,66,0.15)' }}
            >
              {heroPhoto ? (
                <Image
                  src={heroPhoto}
                  alt={farm.numeFerma}
                  fill
                  className="object-cover"
                  sizes="96px"
                  unoptimized
                  priority
                />
              ) : (
                <div
                  className="flex h-full w-full items-center justify-center text-2xl font-extrabold text-white"
                  style={{
                    background: `linear-gradient(135deg, ${gustaBrandColors.primary}, ${gustaPrimaryTints[80]})`,
                  }}
                >
                  {initialsFromName(farm.numeFerma)}
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1 text-center sm:text-left">
              <h1
                className="assoc-heading text-2xl font-extrabold leading-tight md:text-[26px]"
                style={{ color: gustaBrandColors.text }}
              >
                {farm.numeFerma}
              </h1>
              <p
                className="assoc-body mt-2 flex items-center justify-center gap-1.5 text-sm sm:justify-start"
                style={{ color: '#5a6563' }}
              >
                <MapPin className="h-4 w-4 shrink-0" style={{ color: gustaBrandColors.primary }} aria-hidden />
                {farm.localitate}
              </p>
              <div className="mt-3 flex flex-wrap justify-center gap-2 sm:justify-start">
                <span
                  className="inline-flex items-center rounded-full px-3 py-1 text-xs font-bold"
                  style={{
                    backgroundColor: gustaPrimaryTints[20],
                    color: gustaBrandColors.primary,
                    border: `1px solid ${gustaPrimaryTints[40]}`,
                  }}
                >
                  🌾 {specialtyLabel}
                </span>
              </div>
            </div>
          </div>

          {/* Despre */}
          <div className="max-w-3xl">
            <p
              className="assoc-body whitespace-pre-wrap text-sm leading-relaxed md:text-[15px]"
              style={{ color: '#5a6563' }}
            >
              {aboutDisplay}
            </p>
            {isCustomDescription && longText ? (
              <button
                type="button"
                className="assoc-body mt-2 text-sm font-semibold underline-offset-2 hover:underline"
                style={{ color: gustaBrandColors.primary }}
                onClick={() => setDescExpanded((e) => !e)}
              >
                {descExpanded ? 'Restrânge' : 'Citește mai mult'}
              </button>
            ) : null}
          </div>

          {/* Galerie */}
          {galleryPhotos.length > 0 ? (
            <div className="-mx-1">
              <p className="assoc-heading mb-2 text-xs font-bold uppercase tracking-wide" style={{ color: '#7a8580' }}>
                Fermă & produse
              </p>
              <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {galleryPhotos.map((url, i) => (
                  <div
                    key={`${url}-${i}`}
                    className="relative h-[180px] w-[min(72vw,280px)] shrink-0 overflow-hidden rounded-[12px] border bg-white"
                    style={{ borderColor: '#e8e4db' }}
                  >
                    <Image
                      src={url}
                      alt={`${farm.numeFerma} — fotografie ${i + 1}`}
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 72vw, 280px"
                      loading="lazy"
                      unoptimized
                    />
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <p className="assoc-body rounded-xl border px-4 py-3 text-sm leading-relaxed" style={{ borderColor: '#e8e4db', color: '#5a6563' }}>
            {associationMarketLine || 'Ne găsim adesea la piața volantă din Suceava, în fiecare sâmbătă dimineața.'}
          </p>
        </header>

        {/* Produse */}
        <section className="mt-10">
          <h2 className="assoc-heading text-xl font-extrabold md:text-2xl" style={{ color: gustaBrandColors.primary }}>
            Produsele lui {farm.numeFerma}
            <span className="assoc-body ml-2 text-base font-semibold" style={{ color: '#5a6563' }}>
              ({mergedProducts.length})
            </span>
          </h2>

          {mergedProducts.length === 0 ? (
            <p className="assoc-body mt-6 rounded-2xl border px-4 py-10 text-center text-sm" style={{ borderColor: '#e8e4db', color: '#5a6563' }}>
              Produse în curând — revino mai târziu sau explorează restul magazinului.
            </p>
          ) : (
            <ul className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 lg:grid-cols-4">
              {mergedProducts.map((p) => (
                <li key={p.id}>
                  <GustProductCard
                    product={p}
                    farmName={farm.numeFerma}
                    onOpenDetail={openDetail}
                    onAddToCart={addToCart}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Footer nav */}
        <div className="mt-12 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-center">
          <Link
            href={ASSOCIATION_SHOP_PRODUCATORI_PATH}
            className={cn(
              'assoc-heading inline-flex min-h-[44px] items-center justify-center rounded-xl border px-5 py-3 text-sm font-bold transition',
              'hover:-translate-y-0.5 active:scale-[0.99]'
            )}
            style={{ borderColor: gustaPrimaryTints[40], color: gustaBrandColors.primary, backgroundColor: '#fff' }}
          >
            ← Toți producătorii
          </Link>
          <Link
            href={associationShopProdusePath({ fermier: tenantId })}
            className={cn(
              'assoc-heading inline-flex min-h-[44px] items-center justify-center rounded-xl px-5 py-3 text-sm font-bold text-white transition',
              'hover:-translate-y-0.5 active:scale-[0.99]'
            )}
            style={{ backgroundColor: gustaBrandColors.primary }}
          >
            Vezi produsele în catalog filtrat
          </Link>
          <Link
            href={`${ASSOCIATION_SHOP_BASE}/produse`}
            className="assoc-body inline-flex min-h-[44px] items-center justify-center rounded-xl border px-5 py-3 text-sm font-semibold transition hover:bg-black/5"
            style={{ borderColor: '#e8e4db', color: '#5a6563' }}
          >
            Explorează tot magazinul
          </Link>
        </div>
      </div>
    </div>
  )
}
