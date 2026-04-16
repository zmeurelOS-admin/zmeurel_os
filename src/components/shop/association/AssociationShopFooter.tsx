'use client'

import Image from 'next/image'
import Link from 'next/link'
import { Facebook, Instagram, Mail, Phone } from 'lucide-react'

import type { AssociationPublicSettings } from '@/lib/association/public-settings'
import { merchantHasPublicContact, resolveMerchantPublicInfo } from '@/lib/shop/association/merchant-info'
import {
  normalizeFacebookUrl,
  normalizeInstagramUrl,
  normalizePhoneHref,
} from '@/lib/shop/association/public-links'
import {
  ASSOCIATION_SHOP_BASE,
  associationShopProdusePath,
  ASSOCIATION_SHOP_PRODUCATORI_PATH,
} from '@/lib/shop/association-routes'
import { ZMEUREL_TECH_PLATFORM } from '@/lib/shop/association/tech-platform'

type Props = {
  settings: AssociationPublicSettings
}

const linkClass = 'block text-[13px] font-medium text-white/90 underline-offset-2 hover:text-white hover:underline'

function SocialLink({
  href,
  label,
  icon: Icon,
}: {
  href: string
  label: string
  icon: typeof Facebook
}) {
  return (
    <Link
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex min-h-10 items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/16"
    >
      <Icon className="h-4 w-4" aria-hidden />
      {label}
    </Link>
  )
}

/* DRAFT_LEGAL_REVIEW — footer identitate / contact / social / legal */
export function AssociationShopFooter({ settings }: Props) {
  const merchant = resolveMerchantPublicInfo(settings)
  const showDetail = merchantHasPublicContact(merchant)
  const facebookHref = normalizeFacebookUrl(settings.facebookUrl)
  const instagramHref = normalizeInstagramUrl(settings.instagramUrl)
  const orderPhone = settings.orderPhone?.trim() || merchant.phone
  const phoneHref = normalizePhoneHref(orderPhone)
  const email = merchant.email?.trim() || null

  return (
    <footer
      className="assoc-body mt-auto w-full px-6 py-10 text-[13px] leading-relaxed sm:px-8 sm:py-12"
      style={{
        background:
          'linear-gradient(180deg, rgba(13,99,66,1) 0%, rgba(10,79,53,1) 100%)',
        color: 'rgba(255,255,255,0.95)',
      }}
    >
      <div className="mx-auto max-w-6xl space-y-8">
        <div className="grid gap-8 lg:grid-cols-[1.4fr_0.8fr_0.8fr]">
          <div className="space-y-5">
            <Image
              src="/images/asociatie/logo_hero_pe_verde.png"
              alt="Gustă din Bucovina"
              width={280}
              height={96}
              className="h-auto w-full max-w-[280px] object-contain"
              priority={false}
            />
            <p className="max-w-xl text-sm text-white/80">
              Producători locali din Bucovina, verificați de Direcția Agricolă Județeană Suceava.
              Produse autentice, direct de la fermă.
            </p>
            <div className="flex flex-wrap gap-2.5">
              {facebookHref ? <SocialLink href={facebookHref} label="Facebook" icon={Facebook} /> : null}
              {instagramHref ? <SocialLink href={instagramHref} label="Instagram" icon={Instagram} /> : null}
            </div>
          </div>

          <div>
            <p className="assoc-heading mb-3 text-[11px] font-bold uppercase tracking-wide text-white/70">Contact</p>
            <div className="space-y-2 text-sm text-white/88">
              {orderPhone ? (
                <p className="flex items-start gap-2">
                  <Phone className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                  {phoneHref ? (
                    <a href={phoneHref} className="font-semibold underline underline-offset-2 hover:text-white">
                      {orderPhone}
                    </a>
                  ) : (
                    <span>{orderPhone}</span>
                  )}
                </p>
              ) : null}
              {email ? (
                <p className="flex items-start gap-2">
                  <Mail className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                  <a href={`mailto:${email}`} className="font-semibold underline underline-offset-2 hover:text-white">
                    {email}
                  </a>
                </p>
              ) : null}
              <p className="pt-1 font-semibold text-white">Comerciant: Asociația Gustă din Bucovina</p>
              {merchant.legalForm ? <p>Formă juridică: {merchant.legalForm}</p> : null}
              {merchant.cui ? <p>CUI / CIF: {merchant.cui}</p> : null}
              {merchant.headquarters ? <p className="whitespace-pre-wrap">Adresă: {merchant.headquarters}</p> : null}
              {!showDetail ? (
                <p className="text-white/70">
                  Datele de contact publice pot fi completate din setările asociației.
                </p>
              ) : null}
            </div>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-1">
            <div>
              <p className="assoc-heading mb-3 text-[11px] font-bold uppercase tracking-wide text-white/70">Meniu</p>
              <nav className="space-y-2" aria-label="Meniu subsol">
                <Link href={ASSOCIATION_SHOP_BASE} className={linkClass}>
                  Acasă
                </Link>
                <Link href={associationShopProdusePath()} className={linkClass}>
                  Magazin
                </Link>
                <Link href={ASSOCIATION_SHOP_PRODUCATORI_PATH} className={linkClass}>
                  Producători
                </Link>
              </nav>
            </div>
            <div>
              <p className="assoc-heading mb-3 text-[11px] font-bold uppercase tracking-wide text-white/70">Legal</p>
              <nav className="space-y-2" aria-label="Legislație și informații">
                <Link href={`${ASSOCIATION_SHOP_BASE}/termeni`} className={linkClass}>
                  Termeni și condiții
                </Link>
                <Link href={`${ASSOCIATION_SHOP_BASE}/confidentialitate`} className={linkClass}>
                  Politica de confidențialitate
                </Link>
                <Link href={`${ASSOCIATION_SHOP_BASE}/cookies`} className={linkClass}>
                  Cookies
                </Link>
                <Link href={`${ASSOCIATION_SHOP_BASE}/despre`} className={linkClass}>
                  Despre comerciant
                </Link>
              </nav>
            </div>
          </div>
        </div>

        <div className="rounded-[24px] border border-white/14 bg-white/8 p-5 text-[12px] text-white/78">
          <p className="assoc-heading font-semibold text-white/92">Furnizor serviciu informatic</p>
          <p className="mt-1">
            Platformă tehnică: <span className="font-semibold text-white">{ZMEUREL_TECH_PLATFORM.productName}</span>
          </p>
          <p className="mt-0.5">
            Contact tehnic:{' '}
            <a
              href={`mailto:${ZMEUREL_TECH_PLATFORM.contactEmail}`}
              className="font-medium underline underline-offset-2 hover:text-white"
            >
              {ZMEUREL_TECH_PLATFORM.contactEmail}
            </a>
          </p>
          <p className="mt-0.5">
            Web:{' '}
            <Link
              href={ZMEUREL_TECH_PLATFORM.websiteUrl}
              className="font-medium underline underline-offset-2 hover:text-white"
              target="_blank"
              rel="noopener noreferrer"
            >
              {ZMEUREL_TECH_PLATFORM.websiteLabel}
            </Link>
          </p>
          <p className="mt-2 text-white/66">{ZMEUREL_TECH_PLATFORM.operatorLine}</p>
        </div>

        <div className="border-t border-white/15 pt-4 text-center text-[12px] text-white/78 sm:flex sm:items-center sm:justify-between sm:text-left">
          <p>© {new Date().getFullYear()} {merchant.legalName}</p>
          <p>Produse locale autentice din Bucovina</p>
        </div>
      </div>
    </footer>
  )
}
