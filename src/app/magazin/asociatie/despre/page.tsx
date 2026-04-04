import type { Metadata } from 'next'
import Link from 'next/link'

import { AssociationLegalDoc, AssociationLegalSection } from '@/components/shop/association/AssociationLegalDoc'
import { loadAssociationSettingsCached } from '@/lib/association/public-settings'
import { gustaAssociationBrand } from '@/lib/shop/association/brand-config'
import { resolveMerchantPublicInfo } from '@/lib/shop/association/merchant-info'
import {
  ASSOCIATION_SHOP_BASE,
  associationShopProdusePath,
  ASSOCIATION_SHOP_PRODUCATORI_PATH,
} from '@/lib/shop/association-routes'
import { ZMEUREL_TECH_PLATFORM } from '@/lib/shop/association/tech-platform'

/* DRAFT_LEGAL_REVIEW */

const title = 'Despre comerciant — Magazinul Gustă din Bucovina'
const description = 'Informații despre Asociația Gustă din Bucovina și despre magazinul online.'

export const metadata: Metadata = {
  title,
  description,
  openGraph: { title, description },
}

export default async function MagazinAsociatieDesprePage() {
  const settings = await loadAssociationSettingsCached()
  const m = resolveMerchantPublicInfo(settings)
  const desc = settings.description?.trim() || gustaAssociationBrand.description

  return (
    <AssociationLegalDoc title="Despre comerciant — Magazinul Gustă din Bucovina">
      <AssociationLegalSection title={m.legalName}>
        <p className="whitespace-pre-wrap">{desc}</p>
        <p className="mt-3 text-[13px] text-[#6B7A72]">
          Piață volantă (indicativ): {gustaAssociationBrand.volantă.title} — {settings.marketLocation || gustaAssociationBrand.volantă.location}
        </p>
      </AssociationLegalSection>

      <AssociationLegalSection title="Valori">
        <ul>
          {gustaAssociationBrand.values.map((v) => (
            <li key={v.key}>
              <strong>{v.label}:</strong> {v.blurb}
            </li>
          ))}
        </ul>
      </AssociationLegalSection>

      <AssociationLegalSection title="Furnizorul platformei tehnice">
        <p>
          <strong>{ZMEUREL_TECH_PLATFORM.productName}</strong> ({ZMEUREL_TECH_PLATFORM.websiteLabel}) oferă
          infrastructura software prin care sunt afișate produsele și transmise comenzile către comerciant. Nu este
          parte în contractul de vânzare-cumpărare încheiat între dumneavoastră și {m.legalName}.
        </p>
        <p className="mt-2">
          Contact tehnic:{' '}
          <a href={`mailto:${ZMEUREL_TECH_PLATFORM.contactEmail}`} className="font-semibold underline underline-offset-2">
            {ZMEUREL_TECH_PLATFORM.contactEmail}
          </a>
          {' · '}
          <a
            href={ZMEUREL_TECH_PLATFORM.websiteUrl}
            className="font-semibold underline underline-offset-2"
            target="_blank"
            rel="noopener noreferrer"
          >
            {ZMEUREL_TECH_PLATFORM.websiteUrl.replace('https://', '')}
          </a>
        </p>
        <p className="mt-2 text-[12px] text-[#6B7A72]">{ZMEUREL_TECH_PLATFORM.operatorLine}</p>
        {/* DRAFT_LEGAL_REVIEW — identitate juridică operator tehnic */}
      </AssociationLegalSection>

      <AssociationLegalSection title="Date legale">
        <dl className="space-y-2">
          <div>
            <dt className="font-semibold">Denumire</dt>
            <dd>{m.legalName}</dd>
          </div>
          {m.legalForm ? (
            <div>
              <dt className="font-semibold">Formă juridică</dt>
              <dd>{m.legalForm}</dd>
            </div>
          ) : null}
          {m.cui ? (
            <div>
              <dt className="font-semibold">CUI / CIF</dt>
              <dd>{m.cui}</dd>
            </div>
          ) : null}
          {m.registryNumber ? (
            <div>
              <dt className="font-semibold">Nr. registru</dt>
              <dd>{m.registryNumber}</dd>
            </div>
          ) : null}
          {m.headquarters ? (
            <div>
              <dt className="font-semibold">Sediu</dt>
              <dd className="whitespace-pre-wrap">{m.headquarters}</dd>
            </div>
          ) : null}
          {m.email ? (
            <div>
              <dt className="font-semibold">Email</dt>
              <dd>
                <a href={`mailto:${m.email}`}>{m.email}</a>
              </dd>
            </div>
          ) : null}
          {m.phone ? (
            <div>
              <dt className="font-semibold">Telefon</dt>
              <dd>
                <a href={`tel:${m.phone.replace(/\s/g, '')}`}>{m.phone}</a>
              </dd>
            </div>
          ) : null}
          {m.contactPerson ? (
            <div>
              <dt className="font-semibold">Persoană de contact</dt>
              <dd>{m.contactPerson}</dd>
            </div>
          ) : null}
        </dl>
      </AssociationLegalSection>

      <AssociationLegalSection title="Contact și documente">
        <p>Documente legale:</p>
        <ul className="!mt-1">
          <li>
            <Link href={`${ASSOCIATION_SHOP_BASE}/termeni`}>Termeni și condiții</Link>
          </li>
          <li>
            <Link href={`${ASSOCIATION_SHOP_BASE}/confidentialitate`}>Politica de confidențialitate</Link>
          </li>
          <li>
            <Link href={`${ASSOCIATION_SHOP_BASE}/cookies`}>Politica de cookies</Link>
          </li>
        </ul>
        <p className="mt-4">
          Magazin:{' '}
          <Link href={associationShopProdusePath()} className="font-semibold">
            Vezi produsele
          </Link>{' '}
          ·{' '}
          <Link href={ASSOCIATION_SHOP_PRODUCATORI_PATH} className="font-semibold">
            Producători
          </Link>{' '}
          · <Link href={ASSOCIATION_SHOP_BASE}>Acasă</Link>
        </p>
      </AssociationLegalSection>
    </AssociationLegalDoc>
  )
}
