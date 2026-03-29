import { z } from 'zod'

import { CATEGORII_CHELTUIELI, CATEGORII_INVESTITII } from '@/lib/financial/categories'

const FORM_MESSAGE_FALLBACK = 'Am pregătit formularul. Verifică și salvează!'
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const TARGETED_FLOW_KEYS = ['recoltare', 'activitate', 'comanda'] as const

const trimmedString = (max: number) => z.string().trim().min(1).max(max)
const optionalTrimmedString = (max: number) => trimmedString(max).optional()
const nullableTrimmedString = (max: number) =>
  z
    .union([trimmedString(max), z.null(), z.undefined()])
    .transform((value) => (typeof value === 'string' ? value : null))
const nullablePositiveNumber = (max: number) =>
  z
    .union([z.number().positive().max(max), z.null(), z.undefined()])
    .transform((value) => (typeof value === 'number' ? value : null))
const nullableIsoDate = z
  .union([z.string().regex(ISO_DATE_RE), z.null(), z.undefined()])
  .transform((value) => (typeof value === 'string' ? value : null))
const StructuredExtractionBaseSchema = z.object({
  intent: z.enum(['new_flow', 'continue_flow', 'unsure']).default('unsure'),
  missing_fields: z.array(trimmedString(40)).max(6).default([]),
  needs_clarification: z.boolean().default(false),
  confidence: z
    .union([z.number().min(0).max(1), z.null(), z.undefined()])
    .transform((value) => (typeof value === 'number' ? value : null)),
}).strict()

export const StructuredRecoltareExtractionSchema = StructuredExtractionBaseSchema.extend({
  flow_key: z.literal('recoltare'),
  parcela_id: nullableTrimmedString(120),
  cantitate_kg: nullablePositiveNumber(100_000_000),
  data: nullableIsoDate,
  observatii: nullableTrimmedString(220),
}).strict()

export const StructuredActivitateExtractionSchema = StructuredExtractionBaseSchema.extend({
  flow_key: z.literal('activitate'),
  parcela_id: nullableTrimmedString(120),
  tip: nullableTrimmedString(80),
  produs: nullableTrimmedString(120),
  doza: nullableTrimmedString(80),
  data: nullableIsoDate,
  observatii: nullableTrimmedString(220),
}).strict()

export const StructuredComandaExtractionSchema = StructuredExtractionBaseSchema.extend({
  flow_key: z.literal('comanda'),
  client_id: nullableTrimmedString(120),
  cantitate_kg: nullablePositiveNumber(100_000),
  produs: nullableTrimmedString(120),
  data_livrare: nullableIsoDate,
  pret_per_kg: nullablePositiveNumber(100_000),
  telefon: nullableTrimmedString(30),
  locatie_livrare: nullableTrimmedString(200),
  observatii: nullableTrimmedString(300),
}).strict()

export const StructuredTargetedFlowExtractionSchema = z.discriminatedUnion('flow_key', [
  StructuredRecoltareExtractionSchema,
  StructuredActivitateExtractionSchema,
  StructuredComandaExtractionSchema,
])

export const RecoltarePrefillDataSchema = z.object({
  parcela_id: optionalTrimmedString(120),
  parcela_label: optionalTrimmedString(120),
  cantitate_kg: z.coerce.number().positive().max(100_000_000).optional(),
  data: z.string().regex(ISO_DATE_RE).optional(),
  observatii: optionalTrimmedString(220),
}).strict()

export const ActivitatePrefillDataSchema = z.object({
  parcela_id: optionalTrimmedString(120),
  parcela_label: optionalTrimmedString(120),
  tip: optionalTrimmedString(80),
  produs: optionalTrimmedString(120),
  doza: optionalTrimmedString(80),
  data: z.string().regex(ISO_DATE_RE).optional(),
  observatii: optionalTrimmedString(220),
}).strict()

export const ComandaPrefillDataSchema = z.object({
  client_id: optionalTrimmedString(120),
  client_label: optionalTrimmedString(120),
  telefon: optionalTrimmedString(30),
  locatie_livrare: optionalTrimmedString(200),
  data_livrare: z.string().regex(ISO_DATE_RE).optional(),
  cantitate_kg: z.coerce.number().positive().max(100_000).optional(),
  pret_per_kg: z.coerce.number().positive().max(100_000).optional(),
  produs: optionalTrimmedString(120),
  observatii: optionalTrimmedString(300),
}).strict()

const OpenFormSchema = z.object({
  action: z.literal('open_form'),
  form: z.enum(['cheltuiala', 'investitie', 'recoltare', 'activitate', 'comanda', 'client']),
  prefill: z.record(z.string(), z.unknown()).default({}),
  message: z.string().trim().min(1).max(220).optional(),
}).strict()

const CheltuialaPrefillSchema = z.object({
  suma: z.coerce.number().positive().max(100_000_000),
  categorie: z.enum(CATEGORII_CHELTUIELI).optional(),
  data: z.string().regex(ISO_DATE_RE),
  descriere: z.string().trim().min(1).max(200).optional(),
}).strict()

const InvestitiePrefillSchema = z.object({
  suma: z.coerce.number().positive().max(100_000_000),
  categorie: z.enum(CATEGORII_INVESTITII),
  data: z.string().regex(ISO_DATE_RE),
  descriere: z.string().trim().min(1).max(200).optional(),
}).strict()

const RecoltarePrefillSchema = z.object({
  parcela_id: z.string().trim().min(1).max(120).optional(),
  parcela_label: z.string().trim().min(1).max(120).optional(),
  cantitate_kg: z.coerce.number().positive().max(100_000_000).optional(),
  parcela: z.string().trim().min(1).max(120).optional(),
  data: z.string().regex(ISO_DATE_RE).optional(),
  calitate: z.enum(['Cal I', 'Cal II']).optional(),
  observatii: z.string().trim().min(1).max(220).optional(),
}).strict()

const ActivitatePrefillSchema = z.object({
  parcela_id: z.string().trim().min(1).max(120).optional(),
  parcela_label: z.string().trim().min(1).max(120).optional(),
  tip: z.string().trim().min(1).max(80).optional(),
  parcela: z.string().trim().min(1).max(120).optional(),
  produs: z.string().trim().min(1).max(120).optional(),
  doza: z.string().trim().min(1).max(80).optional(),
  data: z.string().regex(ISO_DATE_RE).optional(),
  observatii: z.string().trim().min(1).max(220).optional(),
}).strict()

const ComandaPrefillSchema = z.object({
  client_id: z.string().trim().min(1).max(120).optional(),
  client_label: z.string().trim().min(1).max(120).optional(),
  nume_client: z.string().trim().min(1).max(120).optional(),
  telefon: z.string().trim().min(1).max(30).optional(),
  locatie_livrare: z.string().trim().min(1).max(200).optional(),
  data_livrare: z.string().regex(ISO_DATE_RE).optional(),
  cantitate_kg: z.coerce.number().positive().max(100_000).optional(),
  pret_per_kg: z.coerce.number().positive().max(100_000).optional(),
  produs: z.string().trim().min(1).max(120).optional(),
  observatii: z.string().trim().min(1).max(300).optional(),
}).strict()

const ClientPrefillSchema = z.object({
  nume_client: z.string().trim().min(1).max(120).optional(),
  telefon: z.string().trim().min(1).max(30).optional(),
  email: z.string().email().max(120).optional(),
  adresa: z.string().trim().min(1).max(200).optional(),
  observatii: z.string().trim().min(1).max(300).optional(),
}).strict()

export interface ConversationMemoryRow {
  mesaj_user?: string | null
  raspuns_ai?: string | null
  pathname?: string | null
  created_at?: string | null
}

function sanitizeMemoryText(text: string | null | undefined, maxLen = 120): string {
  return (text ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen)
}

export function buildCompactConversationMemory(
  rows: ConversationMemoryRow[],
  mode: 'path' | 'fallback'
): string {
  return rows
    .reverse()
    .map((row, idx) => {
      const route = sanitizeMemoryText(row?.pathname, 40)
      const userLine = sanitizeMemoryText(row?.mesaj_user, mode === 'path' ? 90 : 80)
      const aiLine = sanitizeMemoryText(row?.raspuns_ai, mode === 'path' ? 110 : 90)
      if (!userLine && !aiLine) return ''
      if (mode === 'path') return `${idx + 1}) U:${userLine} | A:${aiLine}`
      return `${idx + 1}) [${route || '-'}] U:${userLine} | A:${aiLine}`
    })
    .filter(Boolean)
    .join(' ; ')
    .slice(0, 420)
}

export function resolveConversationMemorySnippet(
  byPathRows: ConversationMemoryRow[],
  fallbackRows: ConversationMemoryRow[]
): string {
  if (byPathRows.length > 0) return buildCompactConversationMemory(byPathRows, 'path')
  return buildCompactConversationMemory(fallbackRows, 'fallback')
}

export function detectCreationIntentRo(message: string): boolean {
  return /(adaugă|adauga|creează|creeaza|înregistrează|inregistreaza|pune|bagă|baga|trece|fă|fa|notează|noteaza|înscrie|inscrie|pus)/i.test(message.toLowerCase())
}

export function detectEditIntentRo(message: string): boolean {
  return /(modifică|modifica|editează|editeaza|schimbă|schimba|actualizează|actualizeaza|corectează|corecteaza)/i.test(message.toLowerCase())
}

export function detectKeywordContextFlagsRo(message: string): {
  tratament: boolean
  client: boolean
  cheltuieli: boolean
  recoltare: boolean
  comenzi: boolean
  stocuri: boolean
  raport_cheltuieli: boolean
  raport_recoltari: boolean
  raport_comenzi: boolean
  raport_clienti: boolean
} {
  const msg = message.toLowerCase()
  return {
    tratament: /(tratament|stropit|stropire|produs|aplicat|irigat|irigare)/i.test(msg),
    client: /(telefon|număr|numar|client|client nou|client[aă] nou)\s+\w+/i.test(msg),
    cheltuieli: /(cules|culegător|culegator|plătit|platit|cheltuial|cheltuit|cât am dat|cat am dat|cât am cheltuit|cat am cheltuit)/i.test(msg),
    recoltare: /(recoltat|recolt|recoltare|kg|producție|productie|cât am cules|cat am cules|cât am recoltat|cat am recoltat)/i.test(msg),
    comenzi: /(comandă|comanda|livrare|livrat|nelivrat|arată-mi.*comenz|arata-mi.*comenz|vezi.*comenz|ce am.*de.*livrat)/i.test(msg),
    stocuri: /(stoc|disponibil|ce mai am|ce am)/i.test(msg),
    raport_cheltuieli: /(cât am cheltuit|cat am cheltuit|cât am dat|cat am dat|cheltuieli.*luna|cheltuieli.*săptămân|cheltuieli.*saptaman|compară.*cheltuieli|compar.*cheltuieli)/i.test(msg),
    raport_recoltari: /(cât am recoltat|cat am recoltat|cât am cules|cat am cules|recoltat.*azi|recoltat.*săptămân|recoltat.*saptaman|recoltat.*luna)/i.test(msg),
    raport_comenzi: /(ce am.*de.*livrat|ce.*de.*livrat.*azi|ce.*de.*livrat.*mâine|ce.*de.*livrat.*maine|câte.*comenzi.*nelivrate|cate.*comenzi.*nelivrate|câte.*comenzi.*livrate|cate.*comenzi.*livrate)/i.test(msg),
    raport_clienti: /(câți.*clienți.*noi|cati.*clienti.*noi|clienți.*noi.*luna|clienti.*noi.*luna)/i.test(msg),
  }
}

export function parseAndValidateOpenFormPayload(raw: unknown): {
  form: 'cheltuiala' | 'investitie' | 'recoltare' | 'activitate' | 'comanda' | 'client'
  prefill: Record<string, unknown>
  message: string
} | null {
  const openForm = OpenFormSchema.safeParse(raw)
  if (!openForm.success) return null

  const base = openForm.data

  if (base.form === 'cheltuiala') {
    const parsed = CheltuialaPrefillSchema.safeParse(base.prefill)
    if (!parsed.success) return null
    return { form: 'cheltuiala', prefill: parsed.data, message: base.message ?? FORM_MESSAGE_FALLBACK }
  }

  if (base.form === 'investitie') {
    const parsed = InvestitiePrefillSchema.safeParse(base.prefill)
    if (!parsed.success) return null
    return { form: 'investitie', prefill: parsed.data, message: base.message ?? FORM_MESSAGE_FALLBACK }
  }

  if (base.form === 'recoltare') {
    const parsed = RecoltarePrefillSchema.safeParse(base.prefill)
    if (!parsed.success) return null
    return { form: 'recoltare', prefill: parsed.data, message: base.message ?? FORM_MESSAGE_FALLBACK }
  }

  if (base.form === 'activitate') {
    const parsed = ActivitatePrefillSchema.safeParse(base.prefill)
    if (!parsed.success) return null
    return { form: 'activitate', prefill: parsed.data, message: base.message ?? FORM_MESSAGE_FALLBACK }
  }

  if (base.form === 'comanda') {
    const parsed = ComandaPrefillSchema.safeParse(base.prefill)
    if (!parsed.success) return null
    return { form: 'comanda', prefill: parsed.data, message: base.message ?? FORM_MESSAGE_FALLBACK }
  }

  if (base.form === 'client') {
    const parsed = ClientPrefillSchema.safeParse(base.prefill)
    if (!parsed.success) return null
    return { form: 'client', prefill: parsed.data, message: base.message ?? FORM_MESSAGE_FALLBACK }
  }

  return null
}

export function parsePrefillDataForForm(
  form: 'recoltare' | 'activitate' | 'comanda',
  raw: unknown
): Record<string, unknown> | null {
  if (form === 'recoltare') {
    const parsed = RecoltarePrefillDataSchema.safeParse(raw)
    return parsed.success ? parsed.data : null
  }

  if (form === 'activitate') {
    const parsed = ActivitatePrefillDataSchema.safeParse(raw)
    return parsed.success ? parsed.data : null
  }

  const parsed = ComandaPrefillDataSchema.safeParse(raw)
  return parsed.success ? parsed.data : null
}

export function extractOpenFormCandidateJson(text: string): unknown | null {
  const openFormIdx = text.indexOf('"action"')
  if (openFormIdx === -1) return null

  let braceStart = openFormIdx
  while (braceStart > 0 && text[braceStart] !== '{') braceStart--
  if (text[braceStart] !== '{') return null

  let depth = 0
  let braceEnd = -1
  for (let i = braceStart; i < text.length; i++) {
    if (text[i] === '{') depth++
    else if (text[i] === '}') {
      depth--
      if (depth === 0) {
        braceEnd = i
        break
      }
    }
  }
  if (braceEnd === -1) return null

  try {
    return JSON.parse(text.slice(braceStart, braceEnd + 1))
  } catch {
    return null
  }
}

export function resolveOpenFormActionFromText(text: string): {
  validAction: { form: 'cheltuiala' | 'investitie' | 'recoltare' | 'activitate' | 'comanda' | 'client'; prefill: Record<string, unknown>; message: string } | null
  hasInvalidOpenFormPayload: boolean
} {
  const candidate = extractOpenFormCandidateJson(text)
  if (!candidate) return { validAction: null, hasInvalidOpenFormPayload: false }
  const parsed = parseAndValidateOpenFormPayload(candidate)
  if (parsed) return { validAction: parsed, hasInvalidOpenFormPayload: false }

  const maybeAction = candidate as { action?: unknown }
  return { validAction: null, hasInvalidOpenFormPayload: maybeAction?.action === 'open_form' }
}

export type TargetedFlowKey = (typeof TARGETED_FLOW_KEYS)[number]
export type StructuredTargetedFlowExtraction = z.infer<typeof StructuredTargetedFlowExtractionSchema>
