import { z } from 'zod'

import type { Database } from '@/types/supabase'
import { ATESTAT_LABEL } from '@/lib/acte/atestat'
import { acteDinDocument, lipsuriActe } from '@/lib/acte/stare'
import { normalizePhone } from '@/lib/utils/phone'
import { ziuaInRomania, zileCalendaristiceIntre } from '@/lib/utils/bucharest-date'

export type FarmerLegalType = Database['public']['Enums']['farmer_legal_type']
export type FarmerLegalDocsRow = Database['public']['Tables']['farmer_legal_docs']['Row']

export const LEGAL_DOCS_BUCKET = 'legal-docs'
export const LEGAL_TERMS_HREF = '/termeni'
export const LEGAL_PRIVACY_HREF = '/confidentialitate'

export const LEGAL_TYPE_OPTIONS: Array<{ value: FarmerLegalType; label: string }> = [
  { value: 'certificat_producator', label: ATESTAT_LABEL },
  { value: 'pfa', label: 'PFA' },
  { value: 'ii', label: 'Întreprindere Individuală' },
  { value: 'srl', label: 'SRL' },
]

export const LEGAL_TYPE_LABELS: Record<FarmerLegalType, string> = Object.fromEntries(
  LEGAL_TYPE_OPTIONS.map((item) => [item.value, item.label]),
) as Record<FarmerLegalType, string>

export const legalDocsFormSchema = z
  .object({
    full_name: z.string().trim().min(1, 'Numele și prenumele sunt obligatorii.'),
    legal_type: z.enum(['certificat_producator', 'pfa', 'ii', 'srl']),
    certificate_series: z.string().trim().optional().nullable(),
    certificate_number: z.string().trim().optional().nullable(),
    certificate_expiry: z.string().trim().optional().nullable(),
    locality: z.string().trim().min(1, 'Localitatea este obligatorie.'),
    phone: z
      .string()
      .trim()
      .min(1, 'Telefonul este obligatoriu.')
      .refine((value) => normalizePhone(value) !== null, 'Telefonul trebuie să fie un număr românesc valid.'),
    certificate_photo_url: z.string().trim().min(1, 'Încarcă documentul legal.'),
    cui: z.string().trim().optional().nullable(),
    accepted: z.boolean(),
  })
  .superRefine((value, ctx) => {
    if (!value.accepted) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['accepted'],
        message: 'Trebuie să confirmi corectitudinea datelor și acceptarea termenilor.',
      })
    }

    if (value.legal_type === 'certificat_producator') {
      if (!value.certificate_series?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['certificate_series'],
          message: 'Seria atestatului este obligatorie.',
        })
      }
      if (!value.certificate_number?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['certificate_number'],
          message: 'Numărul atestatului este obligatoriu.',
        })
      }
      if (!value.certificate_expiry?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['certificate_expiry'],
          message: 'Data „valabil până la” este obligatorie.',
        })
      }
      return
    }

    if (!value.cui?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['cui'],
        message: 'CUI / CIF este obligatoriu pentru forma juridică selectată.',
      })
    }
  })

export type LegalDocsFormValues = z.infer<typeof legalDocsFormSchema>

export type LegalDocsStatus = {
  complete: boolean
  missingFields: string[]
  isExpiringSoon: boolean
  isExpired: boolean
  expiryDate: string | null
}

export function isCertificateLegalType(legalType: FarmerLegalType | null | undefined): legalType is 'certificat_producator' {
  return legalType === 'certificat_producator'
}

/** Ce lipsește, cu etichetele din Actele fermei (sursa unică: `lipsuriActe`). */
export function getLegalDocsMissingFields(doc: Partial<FarmerLegalDocsRow> | null | undefined): string[] {
  return lipsuriActe(acteDinDocument(doc)).map((item) => item.eticheta)
}

export function getCertificateExpiryInfo(
  certificateExpiry: string | null | undefined,
  now = new Date(),
): Pick<LegalDocsStatus, 'isExpired' | 'isExpiringSoon' | 'expiryDate'> {
  if (!certificateExpiry) {
    return {
      isExpired: false,
      isExpiringSoon: false,
      expiryDate: null,
    }
  }

  // Ziua de azi în România (pe server ora locală e UTC), comparată pe zile calendaristice.
  const diffDays = zileCalendaristiceIntre(ziuaInRomania(now), certificateExpiry)

  return {
    expiryDate: certificateExpiry,
    isExpired: diffDays < 0,
    isExpiringSoon: diffDays >= 0 && diffDays < 30,
  }
}

export function buildLegalDocsStatus(
  doc: Partial<FarmerLegalDocsRow> | null | undefined,
  now = new Date(),
): LegalDocsStatus {
  const missingFields = getLegalDocsMissingFields(doc)
  const expiryInfo = getCertificateExpiryInfo(doc?.certificate_expiry, now)
  const complete = doc?.legal_docs_complete === true && missingFields.length === 0

  return {
    complete,
    missingFields,
    ...expiryInfo,
  }
}

export function normalizeLegalDocsPayload(values: LegalDocsFormValues) {
  const normalizedPhone = normalizePhone(values.phone)
  if (!normalizedPhone) {
    throw new Error('Telefonul trebuie să fie un număr românesc valid.')
  }

  if (values.legal_type === 'certificat_producator') {
    return {
      full_name: values.full_name.trim(),
      legal_type: values.legal_type,
      certificate_series: values.certificate_series?.trim() || null,
      certificate_number: values.certificate_number?.trim() || null,
      certificate_expiry: values.certificate_expiry?.trim() || null,
      locality: values.locality.trim(),
      phone: normalizedPhone,
      certificate_photo_url: values.certificate_photo_url.trim(),
      legal_accepted_at: new Date().toISOString(),
      cui: null,
    }
  }

  return {
    full_name: values.full_name.trim(),
    legal_type: values.legal_type,
    certificate_series: null,
    certificate_number: null,
    certificate_expiry: null,
    locality: values.locality.trim(),
    phone: normalizedPhone,
    certificate_photo_url: values.certificate_photo_url.trim(),
    legal_accepted_at: new Date().toISOString(),
    cui: values.cui?.trim() || null,
  }
}

export function sanitizeStorageFilename(name: string): string {
  const cleaned = name
    .normalize('NFKD')
    .replace(/[^\w.\-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()

  return cleaned || 'document'
}

export function toLegalDocStoragePath(tenantId: string, fileName: string): string {
  return `${tenantId}/${Date.now()}-${sanitizeStorageFilename(fileName)}`
}

export function mapLegalDocsMissingSummary(status: LegalDocsStatus): string {
  if (status.complete) return 'Actele fermei sunt complete'
  if (status.missingFields.length === 0) return 'Actele fermei sunt incomplete'
  return `Actele fermei sunt incomplete — lipsește: ${status.missingFields.join(', ')}`
}
