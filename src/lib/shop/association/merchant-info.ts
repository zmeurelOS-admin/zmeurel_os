import { sanitizeAssociationSettings, type AssociationPublicSettings } from '@/lib/association/public-settings'
import {
  GUSTA_MERCHANT_LEGAL_NAME_DEFAULT,
  gustaAssociationBrand,
} from '@/lib/shop/association/brand-config'

export type ResolvedMerchantPublic = {
  legalName: string
  legalForm: string | null
  cui: string | null
  headquarters: string | null
  email: string | null
  phone: string | null
  registryNumber: string | null
  contactPerson: string | null
  deliveryPolicy: string | null
  complaintsPolicy: string | null
}

/** Date comerciant pentru magazin public — setări JSON sau fallback brand. */
export function resolveMerchantPublicInfo(settings: AssociationPublicSettings): ResolvedMerchantPublic {
  const legalName = settings.merchantLegalName?.trim() || GUSTA_MERCHANT_LEGAL_NAME_DEFAULT
  const legalForm = settings.merchantLegalForm?.trim() || null
  const cui = settings.merchantCui?.trim() || null
  const headquarters = settings.merchantHeadquarters?.trim() || null
  const email = settings.merchantEmail?.trim() || null
  const phone = settings.merchantPhone?.trim() || null
  const registryNumber = settings.merchantRegistryNumber?.trim() || null
  const contactPerson = settings.merchantContactPerson?.trim() || null
  const deliveryPolicy = settings.merchantDeliveryPolicy?.trim() || null
  const complaintsPolicy = settings.merchantComplaintsPolicy?.trim() || null
  return {
    legalName,
    legalForm,
    cui,
    headquarters,
    email,
    phone,
    registryNumber,
    contactPerson,
    deliveryPolicy,
    complaintsPolicy,
  }
}

/** Minim recomandat pentru conformitate (footer / T&C): identificare și contact. */
export function isMerchantComplianceComplete(settings: AssociationPublicSettings): boolean {
  const m = resolveMerchantPublicInfo(settings)
  return Boolean(
    m.cui && m.headquarters && m.email && m.phone
  )
}

export function merchantHasPublicContact(m: ResolvedMerchantPublic): boolean {
  return Boolean(m.email || m.phone || m.cui || m.headquarters)
}

export function platformAttributionHref(): string {
  return gustaAssociationBrand.platformAttributionUrl
}

let cachedDefaultMerchant: ResolvedMerchantPublic | null = null

/** Fallback pentru teste / randări fără context magazin. */
export function defaultResolvedMerchant(): ResolvedMerchantPublic {
  if (!cachedDefaultMerchant) {
    cachedDefaultMerchant = resolveMerchantPublicInfo(sanitizeAssociationSettings({}))
  }
  return cachedDefaultMerchant
}
