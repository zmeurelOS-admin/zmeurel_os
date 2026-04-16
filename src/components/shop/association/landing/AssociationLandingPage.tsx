'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import {
  Facebook,
  Handshake,
  Instagram,
  Leaf,
  MapPin,
  Phone,
  Plus,
  ScrollText,
  ShieldCheck,
  ShoppingBag,
  Truck,
  type LucideIcon,
} from 'lucide-react'

import { AssociationProductImage } from '@/components/shop/association/AssociationProductImage'
import {
  labelForAssociationCategoryKey,
  resolveAssociationCategory,
  type AssociationCategoryDefinition,
} from '@/components/shop/association/tokens'
import type { GustProducerCard } from '@/components/shop/association/producers/GustProducersPage'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import type { AssociationPublicSettings } from '@/lib/association/public-settings'
import {
  normalizeFacebookUrl,
  normalizeInstagramUrl,
  normalizePhoneHref,
} from '@/lib/shop/association/public-links'
import { gustaAccentTints, gustaBrandColors, gustaBrandDark, gustaBrandShadows, gustaPrimaryTints } from '@/lib/shop/association/brand-tokens'
import type { AssociationProduct } from '@/lib/shop/load-association-catalog'
import {
  ASSOCIATION_SHOP_PRODUCATORI_PATH,
  associationProducerProfilePath,
  associationShopProdusePath,
} from '@/lib/shop/association-routes'
import { cn } from '@/lib/utils'

const MD = '(min-width: 768px)'

const HERO_STATS = [
  { value: '9', label: 'Categorii' },
  { value: '4 ani', label: 'Tradiție' },
  { value: '200+', label: 'În rețea' },
] as const

const TRUST_CARDS: Array<{
  icon: LucideIcon
  title: string
  text: string
}> = [
  {
    icon: ShieldCheck,
    title: 'Verificați oficial',
    text: 'Toți producătorii dețin documente legale, autorizații sanitare și respectă normele de trasabilitate.',
  },
  {
    icon: Handshake,
    title: 'Fără intermediari',
    text: 'Cumperi direct de la fermier. Fără adaos comercial, fără lanțuri de distribuție.',
  },
  {
    icon: Leaf,
    title: 'Produse naturale',
    text: 'Tratamente legale, metode tradiționale. Fără conservanți artificiali, fără E-uri.',
  },
  {
    icon: ScrollText,
    title: 'Tradiție bucovinească',
    text: 'Rețete din generație în generație, păstrate de producători locali din județul Suceava.',
  },
] as const

type AssociationLandingPageProps = {
  products: AssociationProduct[]
  categoryDefinitions: AssociationCategoryDefinition[]
  producerCards: GustProducerCard[]
  settings: AssociationPublicSettings
  formatPrice?: (p: AssociationProduct) => string
  onOpenProduct?: (p: AssociationProduct) => void
  onAddQuick?: (p: AssociationProduct) => void
}

function formatPriceDefault(p: AssociationProduct): string {
  return new Intl.NumberFormat('ro-RO', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number(p.displayPrice))
}

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function categoryAccent(key: string): { emoji: string; bg: string } {
  const normalized = key.trim().toLowerCase()
  if (normalized === 'fructe_legume') return { emoji: '🍓', bg: gustaAccentTints[20] }
  if (normalized === 'lactate_branzeturi') return { emoji: '🧀', bg: gustaPrimaryTints[20] }
  if (normalized === 'carne_mezeluri') return { emoji: '🥩', bg: gustaAccentTints[40] }
  if (normalized === 'miere_apicole') return { emoji: '🍯', bg: gustaAccentTints[20] }
  if (normalized === 'conserve_muraturi') return { emoji: '🫙', bg: gustaPrimaryTints[20] }
  if (normalized === 'panificatie_patiserie') return { emoji: '🥖', bg: gustaAccentTints[20] }
  if (normalized === 'bauturi') return { emoji: '🧃', bg: gustaPrimaryTints[40] }
  if (normalized === 'oua') return { emoji: '🥚', bg: gustaAccentTints[40] }
  return { emoji: '🌿', bg: gustaPrimaryTints[40] }
}

function InfoCard({
  icon,
  title,
  description,
  children,
}: {
  icon: LucideIcon
  title: string
  description?: string
  children?: ReactNode
}) {
  const Icon = icon

  return (
    <div
      className="rounded-[20px] border bg-white p-4 md:p-5"
      style={{
        borderColor: gustaPrimaryTints[40],
        boxShadow: '0 2px 14px rgba(13, 99, 66, 0.08)',
      }}
    >
      <div className="flex items-start gap-3">
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px]"
          style={{ backgroundColor: `${gustaBrandColors.primary}14`, color: gustaBrandColors.primary }}
        >
          <Icon className="h-5 w-5" aria-hidden />
        </div>
        <div className="min-w-0">
          <p className="assoc-heading text-base font-extrabold" style={{ color: gustaBrandColors.primary }}>
            {title}
          </p>
          {description ? (
            <p className="assoc-body mt-1 text-sm leading-relaxed" style={{ color: gustaBrandColors.text }}>
              {description}
            </p>
          ) : null}
          {children}
        </div>
      </div>
    </div>
  )
}

export default function AssociationLandingPage({
  products,
  categoryDefinitions,
  producerCards,
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

  const popularProducts = useMemo(() => {
    const sorted = [...products].sort((a, b) => {
      const ai = a.poza_1_url ? 1 : 0
      const bi = b.poza_1_url ? 1 : 0
      if (bi !== ai) return bi - ai
      return a.nume.localeCompare(b.nume, 'ro')
    })
    return sorted.slice(0, 4)
  }, [products])

  const topProducers = useMemo(
    () => [...producerCards].sort((a, b) => a.farmName.localeCompare(b.farmName, 'ro')).slice(0, 6),
    [producerCards],
  )

  const fadeCls = cn(
    'transition-all duration-700 ease-out motion-reduce:transition-none motion-reduce:opacity-100 motion-reduce:translate-y-0',
    entered ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3',
  )

  const marketLine =
    [settings.marketSchedule?.trim() || 'Sâmbătă, 08:00-12:30', settings.marketLocation?.trim() || 'Curtea DAJ Suceava']
      .filter(Boolean)
      .join(', ')
  const deliveryLine =
    settings.deliveryCutoffText?.trim() || 'Livrare locală disponibilă pentru comenzile din rețea.'
  const facebookHref = normalizeFacebookUrl(settings.facebookUrl)
  const instagramHref = normalizeInstagramUrl(settings.instagramUrl)
  const orderPhone = settings.orderPhone?.trim() || settings.merchantPhone?.trim() || ''
  const orderPhoneHref = normalizePhoneHref(orderPhone)

  const sectionPad = 'px-4 py-12 md:px-12 md:py-14'

  return (
    <div className={fadeCls} style={{ color: gustaBrandColors.text }}>
      <section
        className="relative overflow-hidden px-4 pb-14 pt-10 md:px-12 md:pb-18 md:pt-14"
        style={{
          background: `linear-gradient(160deg, ${gustaBrandColors.primary} 0%, ${gustaBrandDark.backgroundDeep} 100%)`,
        }}
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.08]"
          style={{
            backgroundImage:
              'radial-gradient(circle at 20% 10%, rgba(255,255,255,0.18), transparent 28%), radial-gradient(circle at 80% 0%, rgba(255,158,27,0.16), transparent 24%), linear-gradient(135deg, rgba(255,255,255,0.04), transparent 45%)',
          }}
          aria-hidden
        />
        <div className="relative mx-auto max-w-5xl text-center">
          <div
            className="assoc-heading inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold md:text-sm"
            style={{
              backgroundColor: gustaAccentTints[40],
              color: gustaBrandColors.text,
              boxShadow: '0 2px 12px rgba(13, 99, 66, 0.12)',
            }}
          >
            <span aria-hidden>🏅</span>
            Finalist Premii UE 2025
          </div>

          <div className="mt-6 flex justify-center">
            <Image
              src="/images/asociatie/logo_hero_pe_verde.png"
              alt="Gustă din Bucovina"
              width={500}
              height={170}
              className="h-auto w-full max-w-[500px] object-contain"
              priority
            />
          </div>

          <p
            className="assoc-body mx-auto mt-6 max-w-3xl text-pretty text-base leading-relaxed md:text-lg"
            style={{ color: gustaPrimaryTints[20] }}
          >
            Producători locali din Bucovina, verificați de Direcția Agricolă Județeană Suceava.
            Produse autentice, direct de la fermă.
          </p>

          <Link
            href={associationShopProdusePath()}
            className="assoc-heading mx-auto mt-8 flex min-h-[46px] w-fit items-center justify-center gap-2 rounded-[14px] px-6 text-base font-extrabold transition hover:brightness-105 active:scale-[0.98]"
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
              'mx-auto mt-10 grid max-w-2xl gap-3 text-center',
              isDesktop ? 'grid-cols-3' : 'grid-cols-1',
            )}
          >
            {HERO_STATS.map((row) => (
              <div
                key={row.label}
                className="rounded-[16px] px-4 py-4"
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.09)',
                  border: `1px solid ${gustaPrimaryTints[80]}55`,
                }}
              >
                <p className="assoc-heading text-xl font-extrabold text-white md:text-2xl">{row.value}</p>
                <p className="assoc-body mt-1 text-[12px] font-medium" style={{ color: gustaPrimaryTints[20] }}>
                  {row.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className={sectionPad} style={{ backgroundColor: gustaBrandColors.secondary }}>
        <div className="mx-auto max-w-6xl">
          <div className="max-w-2xl">
            <h2 className="assoc-heading text-2xl font-extrabold md:text-3xl" style={{ color: gustaBrandColors.primary }}>
              De ce au încredere clienții în rețeaua noastră
            </h2>
            <p className="assoc-body mt-2 text-sm leading-relaxed md:text-base" style={{ color: gustaBrandColors.text }}>
              Selectăm cu grijă producătorii și păstrăm traseul cât mai scurt între fermă și client.
            </p>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {TRUST_CARDS.map((card) => {
              const Icon = card.icon
              return (
                <div
                  key={card.title}
                  className="rounded-[22px] border bg-white p-5"
                  style={{
                    borderColor: gustaPrimaryTints[40],
                    boxShadow: '0 3px 18px rgba(13, 99, 66, 0.08)',
                  }}
                >
                  <div
                    className="flex h-12 w-12 items-center justify-center rounded-[16px]"
                    style={{ backgroundColor: `${gustaBrandColors.primary}14`, color: gustaBrandColors.primary }}
                  >
                    <Icon className="h-5 w-5" aria-hidden />
                  </div>
                  <h3 className="assoc-heading mt-4 text-lg font-extrabold" style={{ color: gustaBrandColors.primary }}>
                    {card.title}
                  </h3>
                  <p className="assoc-body mt-2 text-sm leading-relaxed" style={{ color: gustaBrandColors.text }}>
                    {card.text}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      <section className={cn(sectionPad, 'bg-white')}>
        <div className="mx-auto grid max-w-6xl gap-4 md:grid-cols-2 xl:grid-cols-4">
          <InfoCard icon={MapPin} title="Piața volantă" description={marketLine} />
          <InfoCard icon={Truck} title="Livrare locală" description={deliveryLine} />
          <InfoCard icon={Facebook} title="Contact & Facebook">
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {facebookHref ? (
                <Link
                  href={facebookHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-semibold"
                  style={{ borderColor: gustaPrimaryTints[40], color: gustaBrandColors.primary }}
                >
                  <Facebook className="h-4 w-4" aria-hidden />
                  Facebook
                </Link>
              ) : null}
              {instagramHref ? (
                <Link
                  href={instagramHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-semibold"
                  style={{ borderColor: gustaPrimaryTints[40], color: gustaBrandColors.primary }}
                >
                  <Instagram className="h-4 w-4" aria-hidden />
                  Instagram
                </Link>
              ) : null}
              {!facebookHref && !instagramHref ? (
                <p className="assoc-body mt-1 text-sm" style={{ color: gustaBrandColors.text }}>
                  Linkurile sociale pot fi completate din setările asociației.
                </p>
              ) : null}
            </div>
          </InfoCard>
          <InfoCard
            icon={Phone}
            title="Telefon comandă"
            description={orderPhone || 'Numărul de comandă poate fi adăugat din setările asociației.'}
          >
            {orderPhoneHref ? (
              <a
                href={orderPhoneHref}
                className="assoc-heading mt-3 inline-flex items-center gap-2 text-base font-extrabold underline underline-offset-4"
                style={{ color: gustaBrandColors.primary }}
              >
                <Phone className="h-4 w-4" aria-hidden />
                {orderPhone}
              </a>
            ) : null}
          </InfoCard>
        </div>
      </section>

      <section className={sectionPad} style={{ backgroundColor: gustaBrandColors.secondary }}>
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="assoc-heading text-2xl font-extrabold md:text-3xl" style={{ color: gustaBrandColors.primary }}>
                Categorii
              </h2>
              <p className="assoc-body mt-2 text-sm leading-relaxed md:text-base" style={{ color: gustaBrandColors.text }}>
                Toate cele 9 categorii sunt vizibile și te duc direct în catalogul public.
              </p>
            </div>
            <Link
              href={associationShopProdusePath()}
              className="assoc-heading inline-flex items-center gap-2 text-sm font-bold"
              style={{ color: gustaBrandColors.primary }}
            >
              Vezi tot catalogul
              <ShoppingBag className="h-4 w-4" aria-hidden />
            </Link>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {categoryDefinitions.map((category) => {
              const accent = categoryAccent(category.key)
              return (
                <Link
                  key={category.key}
                  href={associationShopProdusePath({ categorie: category.key })}
                  className="group flex items-center gap-3 rounded-[20px] border bg-white px-4 py-4 transition hover:-translate-y-0.5"
                  style={{
                    borderColor: gustaPrimaryTints[40],
                    boxShadow: '0 3px 18px rgba(13, 99, 66, 0.08)',
                  }}
                >
                  <div
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[16px] text-2xl"
                    style={{ backgroundColor: accent.bg }}
                    aria-hidden
                  >
                    {accent.emoji}
                  </div>
                  <div className="min-w-0">
                    <p className="assoc-heading text-base font-extrabold" style={{ color: gustaBrandColors.primary }}>
                      {category.label}
                    </p>
                      <p className="assoc-body mt-1 text-sm" style={{ color: '#6B7A72' }}>
                      Explorează produsele din această categorie
                    </p>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      </section>

      <section className={cn(sectionPad, 'bg-white')}>
        <div className="mx-auto max-w-6xl">
          <h2 className="assoc-heading text-2xl font-extrabold md:text-3xl" style={{ color: gustaBrandColors.primary }}>
            Produse populare
          </h2>
          <p className="assoc-body mt-2 text-sm leading-relaxed md:text-base" style={{ color: gustaBrandColors.text }}>
            O selecție rapidă din oferta activă a asociației.
          </p>
          {popularProducts.length === 0 ? (
            <p className="assoc-body mt-6 text-sm" style={{ color: gustaBrandColors.text }}>
              Nu sunt produse de afișat momentan.
            </p>
          ) : (
            <ul className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
              {popularProducts.map((product) => (
                <li key={product.id}>
                  <LandingPopularProductCard
                    product={product}
                    categoryDefinitions={categoryDefinitions}
                    formatPrice={formatPrice}
                    onOpen={() => onOpenProduct?.(product)}
                    onAdd={() => onAddQuick?.(product)}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className={sectionPad} style={{ backgroundColor: gustaBrandColors.secondary }}>
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="assoc-heading text-2xl font-extrabold md:text-3xl" style={{ color: gustaBrandColors.primary }}>
                Producători în rețea
              </h2>
              <p className="assoc-body mt-2 text-sm leading-relaxed md:text-base" style={{ color: gustaBrandColors.text }}>
                Cardurile folosesc imaginea reală a producătorului atunci când există, cu fallback la inițiale doar dacă lipsește.
              </p>
            </div>
            <Link
              href={ASSOCIATION_SHOP_PRODUCATORI_PATH}
              className="assoc-heading text-sm font-bold"
              style={{ color: gustaBrandColors.primary }}
            >
              Vezi toți producătorii
            </Link>
          </div>

          {topProducers.length === 0 ? (
            <p className="assoc-body mt-6 text-sm" style={{ color: gustaBrandColors.text }}>
              Nu sunt producători de afișat momentan.
            </p>
          ) : (
            <ul className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {topProducers.map((producer) => (
                <li key={producer.tenantId}>
                  <Link
                    href={associationProducerProfilePath(producer.tenantId)}
                    className="group flex h-full flex-col rounded-[24px] border bg-white p-5 transition hover:-translate-y-0.5"
                    style={{
                      borderColor: gustaPrimaryTints[40],
                      boxShadow: '0 4px 20px rgba(13, 99, 66, 0.08)',
                    }}
                  >
                    <div className="flex items-start gap-4">
                      <div
                        className="relative h-16 w-16 shrink-0 overflow-hidden rounded-full border-2"
                        style={{ borderColor: gustaPrimaryTints[40] }}
                      >
                        {producer.logoUrl ? (
                          <Image
                            src={producer.logoUrl}
                            alt={`Logo ${producer.farmName}`}
                            fill
                            className="object-cover"
                            sizes="64px"
                            unoptimized
                          />
                        ) : (
                          <div
                            className="flex h-full w-full items-center justify-center text-lg font-extrabold text-white"
                            style={{
                              background: `linear-gradient(135deg, ${gustaBrandColors.primary}, ${gustaPrimaryTints[80]})`,
                            }}
                          >
                            {initialsFromName(producer.farmName)}
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="assoc-heading text-lg font-extrabold" style={{ color: gustaBrandColors.primary }}>
                          {producer.farmName}
                        </p>
                        <p className="assoc-body mt-1 flex items-center gap-1.5 text-sm" style={{ color: '#6B7A72' }}>
                          <MapPin className="h-4 w-4 shrink-0" aria-hidden />
                          <span className="truncate">{producer.location}</span>
                        </p>
                      </div>
                    </div>

                    {producer.description ? (
                      <p className="assoc-body mt-4 line-clamp-3 text-sm leading-relaxed" style={{ color: gustaBrandColors.text }}>
                        {producer.description}
                      </p>
                    ) : null}

                    {producer.listedProducts.length > 0 ? (
                      <div
                        className="mt-4 rounded-[18px] px-4 py-3"
                        style={{ backgroundColor: '#F8FBF9', color: gustaBrandColors.text }}
                      >
                        <p className="assoc-heading text-sm font-bold" style={{ color: gustaBrandColors.primary }}>
                          Din oferta lor
                        </p>
                        <p className="assoc-body mt-1 text-sm leading-relaxed">
                          {producer.listedProducts.slice(0, 3).join(' · ')}
                          {producer.listedProducts.length > 3 ? ` + încă ${producer.listedProducts.length - 3}` : ''}
                        </p>
                      </div>
                    ) : null}

                    <div className="mt-auto pt-4">
                      <span
                        className="assoc-heading inline-flex items-center gap-2 text-sm font-bold"
                        style={{ color: gustaBrandColors.primary }}
                      >
                        {producer.productCount} produse în catalog
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  )
}

type CardProps = {
  product: AssociationProduct
  categoryDefinitions: AssociationCategoryDefinition[]
  formatPrice: (p: AssociationProduct) => string
  onOpen?: () => void
  onAdd?: () => void
}

function LandingPopularProductCard({
  product,
  categoryDefinitions,
  formatPrice,
  onOpen,
  onAdd,
}: CardProps) {
  const farmName = product.farmName?.trim() || 'Fermă locală'
  const hasImage = Boolean(product.poza_1_url?.trim())
  const categoryKey = resolveAssociationCategory(product.association_category, product.categorie)
  const accent = categoryAccent(categoryKey)

  return (
    <article
      className="flex h-full flex-col overflow-hidden rounded-[18px] border bg-white transition hover:shadow-md"
      style={{
        borderColor: gustaPrimaryTints[40],
        boxShadow: '0 3px 18px rgba(13, 99, 66, 0.08)',
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
        <div className="relative aspect-[4/5] w-full overflow-hidden" style={{ backgroundColor: accent.bg }}>
          {hasImage ? (
            <AssociationProductImage
              src={product.poza_1_url}
              alt={product.nume}
              sizes="(max-width: 768px) 50vw, 25vw"
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-5xl" aria-hidden>
              {accent.emoji}
            </div>
          )}
          <span
            className="assoc-body absolute left-3 top-3 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide"
            style={{
              backgroundColor: gustaBrandColors.secondary,
              color: gustaBrandColors.primary,
              boxShadow: '0 2px 10px rgba(13, 99, 66, 0.08)',
            }}
          >
            {labelForAssociationCategoryKey(categoryKey, categoryDefinitions)}
          </span>
        </div>
        <div className="flex flex-1 flex-col p-3">
          <h3 className="assoc-heading line-clamp-2 min-h-[2.25rem] text-sm font-bold" style={{ color: gustaBrandColors.text }}>
            {product.nume}
          </h3>
          <p className="assoc-body mt-1 line-clamp-1 text-xs" style={{ color: gustaPrimaryTints[80] }}>
            {farmName}
          </p>
          <p className="assoc-heading mt-2 text-base font-extrabold tabular-nums" style={{ color: gustaBrandColors.primary }}>
            {formatPrice(product)} <span className="text-xs font-semibold">{product.moneda}</span>
          </p>
        </div>
      </button>
      <div className="p-3 pt-0">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
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
