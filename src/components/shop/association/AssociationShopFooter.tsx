'use client'

import Image from 'next/image'
import Link from 'next/link'

import type { AssociationPublicSettings } from '@/lib/association/public-settings'
import { merchantHasPublicContact, resolveMerchantPublicInfo } from '@/lib/shop/association/merchant-info'
import {
  ASSOCIATION_SHOP_BASE,
  associationShopProdusePath,
  ASSOCIATION_SHOP_PRODUCATORI_PATH,
} from '@/lib/shop/association-routes'
import { ZMEUREL_TECH_PLATFORM } from '@/lib/shop/association/tech-platform'

type Props = {
  settings: AssociationPublicSettings
}

const legalLinkClass =
  'block text-[13px] font-medium text-white/95 underline-offset-2 hover:text-white hover:underline'

const anpcCardClass =
  'assoc-heading inline-flex flex-1 min-w-[140px] items-center justify-center rounded-lg border border-white/30 px-4 py-2 text-center text-[12px] font-semibold text-white transition hover:bg-white/10'

/* DRAFT_LEGAL_REVIEW — footer identitate / ANPC / navigare */
export function AssociationShopFooter({ settings }: Props) {
  const m = resolveMerchantPublicInfo(settings)
  const showDetail = merchantHasPublicContact(m)

  return (
    <footer
      className="assoc-body mt-auto w-full px-6 py-8 text-[12px] leading-relaxed sm:px-8 sm:py-10 sm:text-[13px]"
      style={{ backgroundColor: '#0D6342', color: 'rgba(255,255,255,0.95)' }}
    >
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex justify-center sm:justify-start">
          <Image
            src="/images/gusta-logo-white.png"
            alt="Gustă din Bucovina"
            width={60}
            height={60}
            className="h-[60px] w-[60px] object-contain"
          />
        </div>
        <div>
          <p className="font-semibold text-white">
            Comerciant: <span className="font-bold">{m.legalName}</span>
          </p>
          {m.legalForm ? (
            <p className="mt-1">
              <span className="text-white/85">Formă juridică:</span> {m.legalForm}
            </p>
          ) : null}
          {m.cui ? (
            <p className="mt-1">
              <span className="text-white/85">CUI / CIF:</span> {m.cui}
            </p>
          ) : null}
          {m.headquarters ? (
            <p className="mt-1 whitespace-pre-wrap">
              <span className="text-white/85">Adresă:</span> {m.headquarters}
            </p>
          ) : null}
          {m.email ? (
            <p className="mt-1">
              <span className="text-white/85">Email:</span>{' '}
              <a href={`mailto:${m.email}`} className="font-medium underline underline-offset-2 hover:text-white">
                {m.email}
              </a>
            </p>
          ) : null}
          {m.phone ? (
            <p className="mt-1">
              <span className="text-white/85">Telefon:</span>{' '}
              <a
                href={`tel:${m.phone.replace(/\s/g, '')}`}
                className="font-medium underline underline-offset-2 hover:text-white"
              >
                {m.phone}
              </a>
            </p>
          ) : null}
          {!showDetail ? (
            <p className="mt-2 text-white/90">
              {m.legalName} — completează datele de contact în setările asociației (panoul intern).
            </p>
          ) : null}
        </div>

        <div className="border-t border-white/20 pt-5 text-[11px] leading-relaxed text-white/85 sm:text-[12px]">
          <p className="assoc-heading font-semibold text-white/95">Furnizor serviciu informatic (platformă)</p>
          <p className="mt-1">
            <span className="text-white/80">Platformă tehnică:</span> {ZMEUREL_TECH_PLATFORM.productName}
          </p>
          <p className="mt-0.5">
            <span className="text-white/80">Contact tehnic:</span>{' '}
            <a
              href={`mailto:${ZMEUREL_TECH_PLATFORM.contactEmail}`}
              className="font-medium underline underline-offset-2 hover:text-white"
            >
              {ZMEUREL_TECH_PLATFORM.contactEmail}
            </a>
          </p>
          <p className="mt-0.5">
            <span className="text-white/80">Web:</span>{' '}
            <Link
              href={ZMEUREL_TECH_PLATFORM.websiteUrl}
              className="font-medium underline underline-offset-2 hover:text-white"
              target="_blank"
              rel="noopener noreferrer"
            >
              {ZMEUREL_TECH_PLATFORM.websiteLabel}
            </Link>
          </p>
          <p className="mt-2 text-white/75">{ZMEUREL_TECH_PLATFORM.operatorLine}</p>
        </div>

        <div className="border-t border-white/20 pt-6">
          <div className="grid gap-8 sm:grid-cols-2">
            <div>
              <p className="assoc-heading mb-3 text-[11px] font-bold uppercase tracking-wide text-white/70">Meniu</p>
              <nav className="flex flex-col gap-2" aria-label="Meniu subsol">
                <Link href={ASSOCIATION_SHOP_BASE} className={legalLinkClass}>
                  Acasă
                </Link>
                <Link href={associationShopProdusePath()} className={legalLinkClass}>
                  Magazin
                </Link>
                <Link href={ASSOCIATION_SHOP_PRODUCATORI_PATH} className={legalLinkClass}>
                  Producători
                </Link>
              </nav>
            </div>
            <div>
              <p className="assoc-heading mb-3 text-[11px] font-bold uppercase tracking-wide text-white/70">Legal</p>
              <nav className="flex flex-col gap-2" aria-label="Legislație și informații">
                <Link href={`${ASSOCIATION_SHOP_BASE}/termeni`} className={legalLinkClass}>
                  Termeni și condiții
                </Link>
                <Link href={`${ASSOCIATION_SHOP_BASE}/confidentialitate`} className={legalLinkClass}>
                  Politica de confidențialitate
                </Link>
                <Link href={`${ASSOCIATION_SHOP_BASE}/cookies`} className={legalLinkClass}>
                  Cookies
                </Link>
                <Link href={`${ASSOCIATION_SHOP_BASE}/despre`} className={legalLinkClass}>
                  Despre comerciant
                </Link>
              </nav>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <a
            href="https://www.anpc.gov.ro/categorie/1271/sal"
            target="_blank"
            rel="noopener noreferrer"
            className={anpcCardClass}
          >
            ANPC — Soluționarea alternativă a litigiilor
          </a>
          <a
            href="https://ec.europa.eu/consumers/odr"
            target="_blank"
            rel="noopener noreferrer"
            className={anpcCardClass}
          >
            Soluționarea online a litigiilor — Platforma UE
          </a>
        </div>

        <div className="border-t border-white/20 pt-4 text-center text-[11px] text-white/85 sm:text-left sm:text-[12px]">
          <p>© {new Date().getFullYear()} {m.legalName}</p>
        </div>
      </div>
    </footer>
  )
}
