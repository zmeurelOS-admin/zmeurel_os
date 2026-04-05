'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { MapPin, Plus, ShoppingBag } from 'lucide-react'

import { AssociationProductImage } from '@/components/shop/association/AssociationProductImage'
import { labelForCategory } from '@/components/shop/association/tokens'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import {
  buildAssociationMarketLine,
  type AssociationPublicSettings,
} from '@/lib/association/public-settings'
import { gustaAssociationBrand } from '@/lib/shop/association/brand-config'
import {
  gustaAccentTints,
  gustaBrandColors,
  gustaBrandDark,
  gustaBrandShadows,
  gustaPrimaryTints,
} from '@/lib/shop/association/brand-tokens'
import type { AssociationProduct } from '@/lib/shop/load-association-catalog'
import { associationProducerProfilePath, associationShopProdusePath } from '@/lib/shop/association-routes'
import { cn } from '@/lib/utils'

const MD = '(min-width: 768px)'

const shadowPrimarySoft = '0 2px 12px rgba(13, 99, 66, 0.08)'
const shadowPrimaryMd = '0 4px 20px rgba(13, 99, 66, 0.08)'

function formatPriceDefault(p: AssociationProduct): string {
  return new Intl.NumberFormat('ro-RO', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number(p.displayPrice))
}

const CATEGORY_EMOJI: Record<string, string> = {
  fruct: '🍓',
  leguma: '🥬',
  procesat: '🫙',
  altele: '🌿',
}

function emojiForCategory(key: string): string {
  const k = key.trim().toLowerCase()
  return CATEGORY_EMOJI[k] ?? '🌱'
}

function bgTintForCategory(key: string): string {
  const k = key.trim().toLowerCase()
  if (k === 'fruct') return gustaAccentTints[20]
  if (k === 'leguma') return gustaPrimaryTints[20]
  if (k === 'procesat') return gustaAccentTints[40]
  return gustaPrimaryTints[40]
}

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export type AssociationLandingPageProps = {
  products: AssociationProduct[]
  settings: AssociationPublicSettings
  formatPrice?: (p: AssociationProduct) => string
  onOpenProduct?: (p: AssociationProduct) => void
  onAddQuick?: (p: AssociationProduct) => void
}

const HERO_STATS = [
  { value: '50+', label: 'Producători' },
  { value: '7+', label: 'Categorii' },
  { value: '4 ani', label: 'Tradiție' },
  { value: '200+', label: 'În rețea' },
] as const

const VALUE_CARDS = [
  {
    emoji: '🏅',
    title: 'Calitate',
    text: 'Verificați de DAJ Suceava',
  },
  {
    emoji: '🤝',
    title: 'Comunitate',
    text: '50+ producători uniți',
  },
  {
    emoji: '🌾',
    title: 'Tradiție',
    text: 'Rețete din generație în generație',
  },
] as const

export default function AssociationLandingPage({
  products,
  settings,
  formatPrice = formatPriceDefault,
  onOpenProduct,
  onAddQuick,
}: AssociationLandingPageProps) {
  const isDesktop = useMediaQuery(MD)
  const [entered, setEntered] = useState(false)

  useEffect(() => {
    const id = requestAnimationFrame(() => setEntered(true))
    return () => cancelAnimationFrame(id)
  }, [])

  const categories = useMemo(() => {
    const s = new Set(products.map((p) => p.categorie))
    return Array.from(s).sort((a, b) => a.localeCompare(b, 'ro'))
  }, [products])

  const popularProducts = useMemo(() => {
    const sorted = [...products].sort((a, b) => {
      const ai = a.poza_1_url ? 1 : 0
      const bi = b.poza_1_url ? 1 : 0
      if (bi !== ai) return bi - ai
      return a.nume.localeCompare(b.nume, 'ro')
    })
    return sorted.slice(0, 4)
  }, [products])

  const producersPreview = useMemo(() => {
    const m = new Map<
      string,
      { tenantId: string; name: string; region: string | null; categories: Set<string> }
    >()
    for (const p of products) {
      const cur = m.get(p.tenantId)
      if (!cur) {
        m.set(p.tenantId, {
          tenantId: p.tenantId,
          name: p.farmName?.trim() || 'Fermă locală',
          region: p.farmRegion,
          categories: new Set([p.categorie]),
        })
      } else {
        cur.categories.add(p.categorie)
        if (!cur.region && p.farmRegion) cur.region = p.farmRegion
      }
    }
    return Array.from(m.values())
      .sort((a, b) => a.name.localeCompare(b.name, 'ro'))
      .slice(0, 6)
      .map((row) => {
        const counts = new Map<string, number>()
        for (const c of row.categories) {
          const k = c.trim()
          counts.set(k, (counts.get(k) ?? 0) + 1)
        }
        let top = ''
        let topN = -1
        const sortedKeys = [...counts.keys()].sort((a, b) => a.localeCompare(b, 'ro'))
        for (const cat of sortedKeys) {
          const n = counts.get(cat) ?? 0
          if (n > topN) {
            topN = n
            top = cat
          }
        }
        const specialty = top ? labelForCategory(top) : '—'
        return { ...row, specialty }
      })
  }, [products])

  const fadeCls = cn(
    'transition-all duration-700 ease-out motion-reduce:transition-none motion-reduce:opacity-100 motion-reduce:translate-y-0',
    entered ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3',
  )
  const heroDescription = settings.description?.trim() || gustaAssociationBrand.heroDescription
  const infoCards = [
    {
      id: 'volanta',
      emoji: '📍',
      title: 'Piața volantă',
      desc: buildAssociationMarketLine(settings),
      desktopOnly: false,
    },
    {
      id: 'livrare',
      emoji: '🚚',
      title: 'Livrare locală',
      desc: settings.marketLocation?.trim() || 'Livrare miercurea · Gratuit peste 150 lei',
      desktopOnly: false,
    },
    {
      id: 'contact',
      emoji: '📞',
      title: 'Contact & Facebook',
      desc: settings.facebookUrl?.trim() || gustaAssociationBrand.social.facebookUrl,
      desktopOnly: false,
    },
    {
      id: 'natural',
      emoji: '🌿',
      title: 'Produse naturale',
      desc: settings.marketNote?.trim() || 'Fără conservanți, direct din fermă',
      desktopOnly: true,
    },
  ] as const

  const sectionPad = 'px-4 py-10 md:px-12 md:py-12'

  return (
    <div className={fadeCls} style={{ color: gustaBrandColors.text }}>
      {/* Hero */}
      <section
        className="relative overflow-hidden px-4 pb-12 pt-10 md:px-12 md:pb-16 md:pt-14"
        style={{
          background: `linear-gradient(165deg, ${gustaBrandColors.primary} 0%, ${gustaBrandDark.backgroundDeep} 100%)`,
        }}
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage: `repeating-linear-gradient(
              -45deg,
              rgba(255, 255, 255, 0.5) 0,
              rgba(255, 255, 255, 0.5) 1px,
              transparent 1px,
              transparent 12px
            )`,
          }}
          aria-hidden
        />
        <div className="relative mx-auto w-full max-w-[600px] text-center">
          <div className="mb-5 flex justify-center">
            <div
              className="overflow-hidden rounded-[20px] bg-white/10 p-2.5 shadow-[0_12px_36px_rgba(0,0,0,0.16)]"
              style={{ backdropFilter: 'blur(6px)' }}
            >
              <Image
                src="/images/gusta-logo.png"
                alt="Gustă din Bucovina"
                width={120}
                height={120}
                className="h-[96px] w-[96px] rounded-[16px] object-contain md:h-[120px] md:w-[120px]"
                priority
              />
            </div>
          </div>
          <div
            className="assoc-heading mb-5 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold md:text-sm"
            style={{
              backgroundColor: gustaAccentTints[40],
              color: gustaBrandColors.text,
              boxShadow: shadowPrimarySoft,
            }}
          >
            <span aria-hidden>🏅</span>
            Finalist Premii UE 2025
          </div>
          <h1
            className="assoc-heading text-balance font-extrabold leading-tight text-white"
            style={{
              fontWeight: 800,
              fontSize: isDesktop ? 40 : 28,
              lineHeight: 1.15,
              textShadow: '0 2px 24px rgba(0,0,0,0.15)',
            }}
          >
            {gustaAssociationBrand.name}
          </h1>
          <p
            className="assoc-body mx-auto mt-4 max-w-xl text-pretty text-sm leading-relaxed md:text-base"
            style={{ color: gustaPrimaryTints[20] }}
          >
            {heroDescription}
          </p>
          <Link
            href={associationShopProdusePath()}
            className="assoc-heading mx-auto mt-8 flex min-h-[44px] items-center justify-center gap-2 rounded-[12px] px-6 text-base font-bold transition hover:brightness-105 active:scale-[0.98]"
            style={{
              backgroundColor: gustaBrandColors.accent,
              color: gustaBrandColors.text,
              boxShadow: gustaBrandShadows.accentGlow,
            }}
          >
            <ShoppingBag className="h-5 w-5" strokeWidth={2.5} aria-hidden />
            Explorează produsele
          </Link>

          <div
            className={cn(
              'mt-10 grid gap-3 text-center',
              isDesktop ? 'grid-cols-4' : 'grid-cols-2',
            )}
          >
            {HERO_STATS.map((row) => (
              <div
                key={row.label}
                className="rounded-[10px] px-2 py-3"
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.08)',
                  border: `1px solid ${gustaPrimaryTints[80]}55`,
                }}
              >
                <p className="assoc-heading text-lg font-extrabold text-white md:text-xl">{row.value}</p>
                <p className="assoc-body mt-0.5 text-[11px] font-medium md:text-xs" style={{ color: gustaPrimaryTints[20] }}>
                  {row.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Valori */}
      <section className={sectionPad} style={{ backgroundColor: gustaBrandColors.secondary }}>
        <div className="mx-auto grid max-w-6xl grid-cols-3 gap-2 md:gap-6">
          {VALUE_CARDS.map((v) => (
            <div
              key={v.title}
              className="flex flex-col items-center rounded-[16px] border bg-white px-2 py-4 text-center shadow-sm md:px-5 md:py-8"
              style={{
                borderColor: gustaPrimaryTints[40],
                boxShadow: shadowPrimarySoft,
              }}
            >
              <span className="text-2xl md:text-3xl" aria-hidden>
                {v.emoji}
              </span>
              <h3 className="assoc-heading mt-2 text-sm font-bold md:text-lg" style={{ color: gustaBrandColors.primary }}>
                {v.title}
              </h3>
              <p className="assoc-body mt-1 text-[11px] leading-snug md:text-sm" style={{ color: gustaBrandColors.text }}>
                {v.text}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Info bar */}
      <section className={cn(sectionPad, 'bg-white')}>
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
          {infoCards.map((card) => (
            <div
              key={card.id}
              className={cn(
                'flex gap-3 rounded-[16px] border p-3 md:p-4',
                card.desktopOnly && 'hidden md:flex',
              )}
              style={{ borderColor: gustaPrimaryTints[40], boxShadow: shadowPrimarySoft }}
            >
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] text-lg"
                style={{ backgroundColor: `${gustaBrandColors.primary}1A` }}
                aria-hidden
              >
                {card.emoji}
              </div>
              <div className="min-w-0 text-left">
                <p className="assoc-heading text-sm font-bold md:text-base" style={{ color: gustaBrandColors.primary }}>
                  {card.title}
                </p>
                <p className="assoc-body mt-0.5 text-[11px] leading-snug md:text-xs" style={{ color: gustaBrandColors.text }}>
                  {card.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Categorii */}
      <section className={sectionPad} style={{ backgroundColor: gustaBrandColors.secondary }}>
        <div className="mx-auto max-w-6xl">
          <h2 className="assoc-heading text-xl font-extrabold md:text-2xl" style={{ color: gustaBrandColors.primary }}>
            Categorii
          </h2>
          <p className="assoc-body mt-1 text-sm md:text-base" style={{ color: gustaBrandColors.text }}>
            Alege o categorie și descoperă produsele din magazinul Asociației Gustă din Bucovina.
          </p>
          <div
            className={cn(
              'mt-5 flex gap-2 overflow-x-auto pb-1',
              '[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
            )}
          >
            {categories.map((cat) => (
              <Link
                key={cat}
                href={associationShopProdusePath({ categorie: cat })}
                className="assoc-heading shrink-0 rounded-full px-4 py-2 text-sm font-bold transition hover:brightness-95 active:scale-[0.98]"
                style={{
                  backgroundColor: gustaBrandColors.primary,
                  color: gustaBrandColors.secondary,
                  boxShadow: shadowPrimarySoft,
                }}
              >
                {labelForCategory(cat)}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Produse populare */}
      <section className={cn(sectionPad, 'bg-white')}>
        <div className="mx-auto max-w-6xl">
          <h2 className="assoc-heading text-xl font-extrabold md:text-2xl" style={{ color: gustaBrandColors.primary }}>
            Produse populare
          </h2>
          {popularProducts.length === 0 ? (
            <p className="assoc-body mt-4 text-sm" style={{ color: gustaBrandColors.text }}>
              Nu sunt produse de afișat momentan.
            </p>
          ) : (
            <ul className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
              {popularProducts.map((p) => (
                <li key={p.id}>
                  <LandingPopularProductCard
                    product={p}
                    formatPrice={formatPrice}
                    onOpen={() => onOpenProduct?.(p)}
                    onAdd={() => onAddQuick?.(p)}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Producători */}
      <section className={sectionPad} style={{ backgroundColor: gustaBrandColors.secondary }}>
        <div className="mx-auto max-w-6xl">
          <h2 className="assoc-heading text-xl font-extrabold md:text-2xl" style={{ color: gustaBrandColors.primary }}>
            Producători
          </h2>
          <p className="assoc-body mt-1 text-sm md:text-base" style={{ color: gustaBrandColors.text }}>
            Fermieri verificați din rețeaua asociației.
          </p>
          {producersPreview.length === 0 ? (
            <p className="assoc-body mt-4 text-sm" style={{ color: gustaBrandColors.text }}>
              Nu sunt producători de afișat.
            </p>
          ) : (
            <ul className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-5">
              {producersPreview.map((f) => {
                const locationLabel = f.region?.trim() || 'Suceava'
                return (
                  <li key={f.tenantId}>
                    <Link
                      href={associationProducerProfilePath(f.tenantId)}
                      className={cn(
                        'flex w-full flex-col items-center rounded-[16px] border bg-white px-3 py-4 text-center transition md:px-5 md:py-6',
                        'hover:shadow-md active:scale-[0.99]',
                      )}
                      style={{ borderColor: gustaPrimaryTints[40], boxShadow: shadowPrimarySoft }}
                    >
                      <div
                        className="flex h-14 w-14 items-center justify-center rounded-full text-lg font-extrabold text-white md:h-16 md:w-16 md:text-xl"
                        style={{
                          background: `linear-gradient(135deg, ${gustaBrandColors.primary}, ${gustaPrimaryTints[80]})`,
                          boxShadow: shadowPrimaryMd,
                        }}
                      >
                        {initialsFromName(f.name)}
                      </div>
                      <p
                        className="assoc-heading mt-3 line-clamp-2 text-sm font-bold md:text-base"
                        style={{ color: gustaBrandColors.text }}
                      >
                        {f.name}
                      </p>
                      <p
                        className="assoc-body mt-1 text-xs font-medium md:text-sm"
                        style={{ color: gustaPrimaryTints[80] }}
                      >
                        {f.specialty}
                      </p>
                      <p
                        className="assoc-body mt-2 flex items-center justify-center gap-1 text-[11px] md:text-xs"
                        style={{ color: gustaBrandColors.text }}
                      >
                        <MapPin className="h-3.5 w-3.5 shrink-0" style={{ color: gustaBrandColors.primary }} aria-hidden />
                        <span className="line-clamp-2">{locationLabel}</span>
                      </p>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </section>
    </div>
  )
}

type CardProps = {
  product: AssociationProduct
  formatPrice: (p: AssociationProduct) => string
  onOpen?: () => void
  onAdd?: () => void
}

function LandingPopularProductCard({ product: p, formatPrice, onOpen, onAdd }: CardProps) {
  const farmName = p.farmName?.trim() || 'Fermă locală'
  const hasImage = Boolean(p.poza_1_url?.trim())

  return (
    <article
      className="flex h-full flex-col overflow-hidden rounded-[16px] border bg-white transition hover:shadow-md"
      style={{
        borderColor: gustaPrimaryTints[40],
        boxShadow: shadowPrimarySoft,
      }}
    >
      <button
        type="button"
        onClick={onOpen}
        disabled={!onOpen}
        className={cn(
          'block w-full flex-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
          !onOpen && 'cursor-default',
        )}
        style={{ ['--tw-ring-color' as string]: gustaBrandColors.primary }}
      >
        <div
          className="relative aspect-[4/5] w-full overflow-hidden"
          style={{ backgroundColor: bgTintForCategory(p.categorie) }}
        >
          {hasImage ? (
            <AssociationProductImage
              src={p.poza_1_url}
              alt={p.nume}
              sizes="(max-width: 768px) 50vw, 25vw"
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-5xl" aria-hidden>
              {emojiForCategory(p.categorie)}
            </div>
          )}
          <span
            className="assoc-body absolute left-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
            style={{
              backgroundColor: gustaBrandColors.secondary,
              color: gustaBrandColors.primary,
              boxShadow: shadowPrimarySoft,
            }}
          >
            {labelForCategory(p.categorie)}
          </span>
        </div>
        <div className="flex flex-1 flex-col p-3">
          <h3 className="assoc-heading line-clamp-2 min-h-[2.25rem] text-sm font-bold" style={{ color: gustaBrandColors.text }}>
            {p.nume}
          </h3>
          <p className="assoc-body mt-1 line-clamp-1 text-xs" style={{ color: gustaPrimaryTints[80] }}>
            {farmName}
          </p>
          <p className="assoc-heading mt-2 text-base font-extrabold tabular-nums" style={{ color: gustaBrandColors.primary }}>
            {formatPrice(p)} <span className="text-xs font-semibold">{p.moneda}</span>
          </p>
        </div>
      </button>
      <div className="p-3 pt-0">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onAdd?.()
          }}
          disabled={!onAdd}
          className="assoc-heading flex h-10 w-full items-center justify-center gap-2 rounded-[12px] text-sm font-bold transition hover:brightness-95 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
          style={{
            backgroundColor: gustaBrandColors.accent,
            color: gustaBrandColors.text,
            boxShadow: gustaBrandShadows.accentGlow,
          }}
        >
          <Plus className="h-4 w-4" strokeWidth={2.5} />
          Adaugă
        </button>
      </div>
    </article>
  )
}
