'use client'

import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, Facebook, Globe, Instagram, MapPin, MessageCircle, ShoppingBag } from 'lucide-react'

import { gustaBrandColors, gustaBrandShadows, gustaPrimaryTints } from '@/lib/shop/association/brand-tokens'
import type { AssociationProduct } from '@/lib/shop/load-association-catalog'
import { associationProducerProfilePath } from '@/lib/shop/association-routes'
import { cn } from '@/lib/utils'

export type GustProducerCard = {
  tenantId: string
  farmName: string
  logoUrl: string | null
  description: string | null
  location: string
  listedProducts: string[]
  productCount: number
  website: string | null
  facebook: string | null
  instagram: string | null
  whatsapp: string | null
}

export type GustProducersPageProps = {
  producers: GustProducerCard[]
}

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function normalizeProductName(value: string): string {
  return value.trim().replace(/\s+/g, ' ')
}

function normalizeDescription(value: string | null): string | null {
  const trimmed = value?.trim()
  if (!trimmed) return null
  return trimmed.length > 120 ? `${trimmed.slice(0, 117).trimEnd()}...` : trimmed
}

function SocialIcon({
  icon: Icon,
  label,
  color,
}: {
  icon: typeof Facebook
  label: string
  color: string
}) {
  return (
    <span
      title={label}
      aria-label={label}
      className="inline-flex h-7 w-7 items-center justify-center rounded-full"
      style={{ backgroundColor: '#f2f3f1', color }}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden />
    </span>
  )
}

export function GustProducersPage({ producers }: GustProducersPageProps) {
  return (
    <section className="mx-auto max-w-6xl px-4 py-8 md:px-6 md:py-10">
      <h1 className="assoc-heading text-2xl font-extrabold md:text-3xl" style={{ color: gustaBrandColors.primary }}>
        Producători din rețea
      </h1>
      <p className="assoc-body mt-2 max-w-2xl text-sm leading-relaxed md:text-base" style={{ color: '#5a6563' }}>
        Oamenii din spatele produselor comercializate prin magazinul Asociației Gustă din Bucovina
      </p>

      {producers.length === 0 ? (
        <p className="assoc-body mt-10 text-center text-sm" style={{ color: '#5a6563' }}>
          Nu există producători în catalog momentan.
        </p>
      ) : (
        <ul className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {producers.map((producer) => (
            <li key={producer.tenantId}>
              <Link
                href={associationProducerProfilePath(producer.tenantId)}
                className={cn(
                  'group flex h-full w-full flex-col rounded-[18px] border border-[#e8ece9] bg-white p-5 text-left transition duration-200',
                  'hover:-translate-y-[2px] hover:shadow-[0_4px_16px_rgba(13,99,66,0.10)] active:scale-[0.99]',
                  'hover:border-[#0D6342]',
                )}
                style={{ boxShadow: gustaBrandShadows.sm }}
              >
                <div className="flex items-start gap-3.5">
                  <div
                    className="relative h-14 w-14 shrink-0 overflow-hidden rounded-full border-2"
                    style={{ borderColor: '#e8ece9' }}
                  >
                    {producer.logoUrl ? (
                      <Image
                        src={producer.logoUrl}
                        alt={`Logo ${producer.farmName}`}
                        fill
                        className="object-cover"
                        sizes="56px"
                        unoptimized
                      />
                    ) : (
                      <div
                        className="flex h-full w-full items-center justify-center text-base font-extrabold text-white"
                        style={{
                          background: `linear-gradient(135deg, ${gustaBrandColors.primary}, ${gustaPrimaryTints[80]})`,
                        }}
                      >
                        {initialsFromName(producer.farmName)}
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <h2
                      className="assoc-heading truncate text-base font-extrabold"
                      style={{ color: gustaBrandColors.text }}
                    >
                      {producer.farmName}
                    </h2>
                    <p
                      className="assoc-body mt-1 flex items-center gap-1.5 text-xs font-medium"
                      style={{ color: '#5a6563' }}
                    >
                      <MapPin className="h-3.5 w-3.5 shrink-0" style={{ color: gustaBrandColors.primary }} aria-hidden />
                      <span className="truncate">{producer.location}</span>
                    </p>
                  </div>
                </div>

                {producer.description ? (
                  <p
                    className="assoc-body mt-4 line-clamp-2 min-h-[2.75rem] text-sm leading-6"
                    style={{ color: '#5a6563' }}
                  >
                    {producer.description}
                  </p>
                ) : null}

                {producer.listedProducts.length > 0 ? (
                  <div
                    className="mt-4 flex items-start gap-2 rounded-xl px-3 py-2.5"
                    style={{ backgroundColor: '#f4f8f5', color: gustaBrandColors.primary }}
                  >
                    <ShoppingBag className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                    <p className="assoc-body line-clamp-2 text-sm font-semibold">
                      {producer.listedProducts.slice(0, 3).join(' · ')}
                      {producer.listedProducts.length > 3 ? ` + încă ${producer.listedProducts.length - 3}` : ''}
                    </p>
                  </div>
                ) : null}

                <div className="mt-auto flex items-center justify-between gap-3 border-t pt-4" style={{ borderColor: '#eef1ed' }}>
                  <div className="flex min-h-7 items-center gap-1.5">
                    {producer.facebook ? <SocialIcon icon={Facebook} label="Facebook" color="#1877F2" /> : null}
                    {producer.instagram ? <SocialIcon icon={Instagram} label="Instagram" color="#E4405F" /> : null}
                    {producer.whatsapp ? <SocialIcon icon={MessageCircle} label="WhatsApp" color="#25D366" /> : null}
                    {producer.website ? <SocialIcon icon={Globe} label="Website" color={gustaBrandColors.primary} /> : null}
                  </div>

                  <div
                    className="assoc-body inline-flex items-center gap-1.5 text-sm font-bold"
                    style={{ color: gustaBrandColors.primary }}
                  >
                    <span>{producer.productCount} produse</span>
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/** Construiește carduri de producători din catalogul public, agregând metadata și produsele reale listate. */
export function buildGustProducerCardsFromProducts(products: AssociationProduct[]): GustProducerCard[] {
  const byTenant = new Map<
    string,
    {
      farmName: string
      logoUrl: string | null
      description: string | null
      location: string | null
      listedProducts: Map<string, string>
      website: string | null
      facebook: string | null
      instagram: string | null
      whatsapp: string | null
    }
  >()

  for (const product of products) {
    const normalizedName = normalizeProductName(product.nume)
    const productKey = normalizedName.toLocaleLowerCase('ro-RO')
    const current = byTenant.get(product.tenantId)

    if (!current) {
      byTenant.set(product.tenantId, {
        farmName: product.farmName?.trim() || 'Fermă locală',
        logoUrl: product.producerLogoUrl?.trim() || null,
        description: normalizeDescription(product.producerDescription),
        location: product.producerLocation?.trim() || product.farmRegion?.trim() || null,
        listedProducts: new Map([[productKey, normalizedName]]),
        website: product.producerWebsite?.trim() || null,
        facebook: product.producerFacebook?.trim() || null,
        instagram: product.producerInstagram?.trim() || null,
        whatsapp: product.producerWhatsapp?.trim() || null,
      })
      continue
    }

    current.listedProducts.set(productKey, normalizedName)
    if (!current.logoUrl && product.producerLogoUrl?.trim()) current.logoUrl = product.producerLogoUrl.trim()

    const description = normalizeDescription(product.producerDescription)
    if (!current.description && description) current.description = description

    const location = product.producerLocation?.trim() || product.farmRegion?.trim() || null
    if (!current.location && location) current.location = location

    if (!current.website && product.producerWebsite?.trim()) current.website = product.producerWebsite.trim()
    if (!current.facebook && product.producerFacebook?.trim()) current.facebook = product.producerFacebook.trim()
    if (!current.instagram && product.producerInstagram?.trim()) current.instagram = product.producerInstagram.trim()
    if (!current.whatsapp && product.producerWhatsapp?.trim()) current.whatsapp = product.producerWhatsapp.trim()
  }

  return Array.from(byTenant.entries())
    .map(([tenantId, value]) => {
      const listedProducts = [...value.listedProducts.values()].sort((a, b) => a.localeCompare(b, 'ro'))
      return {
        tenantId,
        farmName: value.farmName,
        logoUrl: value.logoUrl,
        description: value.description,
        location: value.location?.trim() || 'Suceava',
        listedProducts,
        productCount: listedProducts.length,
        website: value.website,
        facebook: value.facebook,
        instagram: value.instagram,
        whatsapp: value.whatsapp,
      }
    })
    .sort((a, b) => a.farmName.localeCompare(b.farmName, 'ro'))
}
