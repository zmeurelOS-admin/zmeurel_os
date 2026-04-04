import { cache } from 'react'
import { z } from 'zod'

import { getSupabaseAdmin } from '@/lib/supabase/admin'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyAdmin = any

export const ASSOCIATION_SETTINGS_BUCKET = 'association-config'
export const ASSOCIATION_SETTINGS_PATH = 'settings.json'

export const ASSOCIATION_DAY_IDS = [
  'luni',
  'marti',
  'miercuri',
  'joi',
  'vineri',
  'sambata',
  'duminica',
] as const

export type AssociationDayId = (typeof ASSOCIATION_DAY_IDS)[number]

export const ASSOCIATION_DAY_LABELS: Record<AssociationDayId, string> = {
  luni: 'Luni',
  marti: 'Marți',
  miercuri: 'Miercuri',
  joi: 'Joi',
  vineri: 'Vineri',
  sambata: 'Sâmbătă',
  duminica: 'Duminică',
}

const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/

export const DEFAULT_ASSOCIATION_SETTINGS = {
  description:
    'Rețea de producători locali din Bucovina care aduce mai aproape produse autentice, direct de la fermă.',
  facebookUrl: 'https://www.facebook.com/haigustadinbucovina',
  marketSchedule: 'Sâmbătă, 08:00 - 12:30',
  marketLocation: 'Curtea DAJ Suceava',
  activeDays: ['sambata'] as AssociationDayId[],
  marketStartTime: '08:00',
  marketEndTime: '12:30',
  marketNote: '',
  /** Denumire juridică comerciant (magazin public / footer). Gol = fallback brand. */
  merchantLegalName: '',
  merchantLegalForm: '',
  merchantCui: '',
  merchantHeadquarters: '',
  merchantEmail: '',
  merchantPhone: '',
  merchantRegistryNumber: '',
  merchantContactPerson: '',
  merchantDeliveryPolicy: '',
  merchantComplaintsPolicy: '',
  updatedAt: null as string | null,
} as const

const settingsSchema = z.object({
  description: z.string().max(1200).default(DEFAULT_ASSOCIATION_SETTINGS.description),
  facebookUrl: z.union([z.literal(''), z.string().url()]).default(DEFAULT_ASSOCIATION_SETTINGS.facebookUrl),
  marketSchedule: z.string().max(160).default(DEFAULT_ASSOCIATION_SETTINGS.marketSchedule),
  marketLocation: z.string().max(160).default(DEFAULT_ASSOCIATION_SETTINGS.marketLocation),
  activeDays: z
    .array(z.enum(ASSOCIATION_DAY_IDS))
    .max(7)
    .default([...DEFAULT_ASSOCIATION_SETTINGS.activeDays]),
  marketStartTime: z
    .string()
    .regex(timeRegex)
    .default(DEFAULT_ASSOCIATION_SETTINGS.marketStartTime),
  marketEndTime: z
    .string()
    .regex(timeRegex)
    .default(DEFAULT_ASSOCIATION_SETTINGS.marketEndTime),
  marketNote: z.string().max(500).default(DEFAULT_ASSOCIATION_SETTINGS.marketNote),
  merchantLegalName: z.string().max(200).default(DEFAULT_ASSOCIATION_SETTINGS.merchantLegalName),
  merchantLegalForm: z.string().max(120).default(DEFAULT_ASSOCIATION_SETTINGS.merchantLegalForm),
  merchantCui: z.string().max(32).default(DEFAULT_ASSOCIATION_SETTINGS.merchantCui),
  merchantHeadquarters: z.string().max(500).default(DEFAULT_ASSOCIATION_SETTINGS.merchantHeadquarters),
  merchantEmail: z
    .union([z.literal(''), z.string().email()])
    .default(DEFAULT_ASSOCIATION_SETTINGS.merchantEmail),
  merchantPhone: z.string().max(40).default(DEFAULT_ASSOCIATION_SETTINGS.merchantPhone),
  merchantRegistryNumber: z.string().max(80).default(DEFAULT_ASSOCIATION_SETTINGS.merchantRegistryNumber),
  merchantContactPerson: z.string().max(120).default(DEFAULT_ASSOCIATION_SETTINGS.merchantContactPerson),
  merchantDeliveryPolicy: z.string().max(2000).default(DEFAULT_ASSOCIATION_SETTINGS.merchantDeliveryPolicy),
  merchantComplaintsPolicy: z.string().max(2000).default(DEFAULT_ASSOCIATION_SETTINGS.merchantComplaintsPolicy),
  updatedAt: z.string().datetime().nullable().default(DEFAULT_ASSOCIATION_SETTINGS.updatedAt),
})

export type AssociationPublicSettings = z.infer<typeof settingsSchema>

function uniqueDays(days: readonly AssociationDayId[]): AssociationDayId[] {
  return [...new Set(days)].filter((day): day is AssociationDayId =>
    (ASSOCIATION_DAY_IDS as readonly string[]).includes(day)
  )
}

export function sanitizeAssociationSettings(
  input: Partial<AssociationPublicSettings> | null | undefined
): AssociationPublicSettings {
  const normalized = settingsSchema.parse({
    description: input?.description?.trim() || DEFAULT_ASSOCIATION_SETTINGS.description,
    facebookUrl: input?.facebookUrl?.trim() || '',
    marketSchedule: input?.marketSchedule?.trim() || DEFAULT_ASSOCIATION_SETTINGS.marketSchedule,
    marketLocation: input?.marketLocation?.trim() || DEFAULT_ASSOCIATION_SETTINGS.marketLocation,
    activeDays: uniqueDays(input?.activeDays ?? DEFAULT_ASSOCIATION_SETTINGS.activeDays),
    marketStartTime: input?.marketStartTime?.trim() || DEFAULT_ASSOCIATION_SETTINGS.marketStartTime,
    marketEndTime: input?.marketEndTime?.trim() || DEFAULT_ASSOCIATION_SETTINGS.marketEndTime,
    marketNote: input?.marketNote?.trim() || '',
    merchantLegalName: input?.merchantLegalName?.trim() ?? '',
    merchantLegalForm: input?.merchantLegalForm?.trim() ?? '',
    merchantCui: input?.merchantCui?.trim() ?? '',
    merchantHeadquarters: input?.merchantHeadquarters?.trim() ?? '',
    merchantEmail: input?.merchantEmail?.trim() ?? '',
    merchantPhone: input?.merchantPhone?.trim() ?? '',
    merchantRegistryNumber: input?.merchantRegistryNumber?.trim() ?? '',
    merchantContactPerson: input?.merchantContactPerson?.trim() ?? '',
    merchantDeliveryPolicy: input?.merchantDeliveryPolicy?.trim() ?? '',
    merchantComplaintsPolicy: input?.merchantComplaintsPolicy?.trim() ?? '',
    updatedAt: input?.updatedAt ?? DEFAULT_ASSOCIATION_SETTINGS.updatedAt,
  })

  if (normalized.activeDays.length === 0) {
    normalized.activeDays = [...DEFAULT_ASSOCIATION_SETTINGS.activeDays]
  }

  return normalized
}

export async function loadAssociationSettings(): Promise<AssociationPublicSettings> {
  const admin = getSupabaseAdmin() as AnyAdmin
  const { data, error } = await admin.storage
    .from(ASSOCIATION_SETTINGS_BUCKET)
    .download(ASSOCIATION_SETTINGS_PATH)

  if (error || !data) {
    return sanitizeAssociationSettings(DEFAULT_ASSOCIATION_SETTINGS)
  }

  try {
    const text = await data.text()
    if (!text.trim()) {
      return sanitizeAssociationSettings(DEFAULT_ASSOCIATION_SETTINGS)
    }
    const parsed = JSON.parse(text) as Partial<AssociationPublicSettings>
    return sanitizeAssociationSettings(parsed)
  } catch (parseError) {
    console.warn('[association-settings] parse failed', parseError)
    return sanitizeAssociationSettings(DEFAULT_ASSOCIATION_SETTINGS)
  }
}

export const loadAssociationSettingsCached = cache(loadAssociationSettings)

export async function saveAssociationSettings(
  input: Partial<AssociationPublicSettings>
): Promise<AssociationPublicSettings> {
  const admin = getSupabaseAdmin() as AnyAdmin
  const existing = await loadAssociationSettings()
  const nextSettings = sanitizeAssociationSettings({
    ...existing,
    ...input,
    updatedAt: new Date().toISOString(),
  })

  const payload = new TextEncoder().encode(JSON.stringify(nextSettings, null, 2))
  const { error } = await admin.storage
    .from(ASSOCIATION_SETTINGS_BUCKET)
    .upload(ASSOCIATION_SETTINGS_PATH, payload, {
      upsert: true,
      cacheControl: '60',
      contentType: 'application/json; charset=utf-8',
    })

  if (error) {
    throw error
  }

  return nextSettings
}

export function formatAssociationActiveDays(days: readonly AssociationDayId[]): string {
  const unique = uniqueDays(days)
  if (unique.length === 0) return 'La cerere'
  if (unique.length === ASSOCIATION_DAY_IDS.length) return 'Zilnic'
  return unique.map((day) => ASSOCIATION_DAY_LABELS[day]).join(', ')
}

export function buildAssociationMarketLine(settings: AssociationPublicSettings): string {
  const days = formatAssociationActiveDays(settings.activeDays)
  const hours =
    settings.marketStartTime && settings.marketEndTime
      ? `${settings.marketStartTime} - ${settings.marketEndTime}`
      : settings.marketSchedule

  if (settings.marketLocation?.trim()) {
    return `${days}, ${hours} · ${settings.marketLocation.trim()}`
  }

  return `${days}, ${hours}`
}
