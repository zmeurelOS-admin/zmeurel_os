import { google } from '@ai-sdk/google'
import { generateObject, generateText } from 'ai'
import { NextResponse } from 'next/server'

import { createClient } from '@/lib/supabase/server'
import type { Tables } from '@/types/supabase'
import { getTenantIdOrNull } from '@/lib/tenant/get-tenant'
import { routeFinancialMessage } from '@/lib/financial/chat-router'
import {
  detectCreationIntentRo,
  detectEditIntentRo,
  detectKeywordContextFlagsRo,
  parsePrefillDataForForm,
  resolveOpenFormActionFromText,
  StructuredTargetedFlowExtractionSchema,
  type StructuredTargetedFlowExtraction,
} from './contract-helpers'
import { resolveAiDailyLimit } from './ai-usage-limit'
import {
  loadRecentConversationMemory,
  shouldUseConversationMemory,
} from './conversation-memory'
import {
  getBucharestNowContext,
  getTodayInBucharest,
  getYesterdayInBucharest,
} from './date-helpers'
import {
  extractActivitateTip,
  extractCantitateKg,
  extractClientName,
  extractComandaProdus,
  extractComandaSursa,
  extractCorrectionPayload,
  extractDateRo,
  extractDescriere,
  extractDoza,
  extractNumeClient,
  extractObservatiiCandidate,
  extractParcela,
  extractPretPerKg,
  extractProdus,
  extractSuma,
  extractTelefon,
} from './extractors'
import {
  detectActiveFlow,
  detectStrongFlowIntent,
  getFlowFriendlyMessage as buildPreparedFormMessage,
  getRequiredSaveHintFields,
  isStructuredTargetedFlow,
  loadCanonicalCandidates,
  REQUIRED_FIELDS_FOR_OPEN,
  type ActiveFlow,
  resolveCanonicalProduct,
  resolveCanonicalValue,
} from './flow-detection'
import {
  hasActivitySignalRo,
  hasClientSignalRo,
  hasExplicitCorrectionSignalRo,
  hasFinancialCostSignalRo,
  hasHarvestSignalRo,
  hasInvestmentSignalRo,
  hasOrderSignalRo,
  hasQuestionIntentRo,
} from './signal-detectors'
import {
  detectClearedFields,
  normalizeForMatch,
  sanitizeCanonicalEntity,
  toNumberOrNull,
} from './utils'

// ─── Config ───────────────────────────────────────────────────────────────────

const MODEL_NAME = process.env.AI_GEMINI_MODEL ?? 'gemini-2.5-flash'
const SIMPLE_MODEL_NAME = process.env.AI_GEMINI_SIMPLE_MODEL?.trim() ?? ''
const DAILY_LIMIT = Math.max(1, parseInt(process.env.AI_CHAT_DAILY_LIMIT ?? '20', 10) || 20)
const MAX_MSG_CHARS = 500
const MAX_OUTPUT_TOKENS = Math.max(64, parseInt(process.env.AI_CHAT_MAX_OUTPUT_TOKENS ?? '220', 10) || 220)
const USAGE_LOG_ENABLED = process.env.AI_CHAT_USAGE_LOG === 'true'

type ServerSupabaseClient = Awaited<ReturnType<typeof createClient>>
type AiConversationSnippet = Pick<Tables<'ai_conversations'>, 'mesaj_user' | 'raspuns_ai'>
type UsageStatsSource = {
  usage?: Record<string, unknown>
  providerMetadata?: {
    usage?: Record<string, unknown>
  } | null
} | null | undefined

function extractUsageStats(result: UsageStatsSource): { inputTokens: number | null; outputTokens: number | null; reasoningTokens: number | null; totalTokens: number | null } {
  const usage = result?.usage ?? result?.providerMetadata?.usage ?? {}
  const inputTokens = toNumberOrNull(
    usage?.inputTokens ?? usage?.promptTokens ?? usage?.inputTokenCount ?? usage?.promptTokenCount
  )
  const outputTokens = toNumberOrNull(
    usage?.outputTokens ?? usage?.completionTokens ?? usage?.outputTokenCount ?? usage?.candidatesTokenCount
  )
  const reasoningTokens = toNumberOrNull(
    usage?.reasoningTokens ?? usage?.thoughtsTokenCount ?? usage?.thinkingTokens
  )
  const totalTokensRaw = toNumberOrNull(
    usage?.totalTokens ?? usage?.totalTokenCount
  )
  const totalTokens =
    totalTokensRaw ??
    (inputTokens !== null || outputTokens !== null || reasoningTokens !== null
      ? (inputTokens ?? 0) + (outputTokens ?? 0) + (reasoningTokens ?? 0)
      : null)

  return { inputTokens, outputTokens, reasoningTokens, totalTokens }
}

function shouldAttemptStructuredTargetedFlow(params: {
  stickyFlow: ActiveFlow
  explicitNewFlow: ActiveFlow
  hasHarvestSignal: boolean
  hasActivitySignal: boolean
  hasOrderSignal: boolean
  hasKgQuantitySignal: boolean
  hasParcelaHint: boolean
  hasProductLikeHint: boolean
  hasDozaSignal: boolean
}): boolean {
  const {
    stickyFlow,
    explicitNewFlow,
    hasHarvestSignal,
    hasActivitySignal,
    hasOrderSignal,
    hasKgQuantitySignal,
    hasParcelaHint,
    hasProductLikeHint,
    hasDozaSignal,
  } = params

  if (isStructuredTargetedFlow(stickyFlow)) return true
  if (isStructuredTargetedFlow(explicitNewFlow)) return true
  if (hasHarvestSignal || hasActivitySignal || hasOrderSignal) return true
  if (hasKgQuantitySignal && hasParcelaHint) return true
  if ((hasProductLikeHint || hasDozaSignal) && hasParcelaHint) return true
  return false
}

function buildTargetedFlowExtractionPrompt(params: {
  nowIso: string
  nowLocalDate: string
  nowLocalDateTime: string
  timezone: string
  currentPath: string
  currentMessage: string
  effectiveMessage: string
  stickyFlow: ActiveFlow
  continuationUsed: boolean
  parcele: Array<{ id: string; label: string; aliases: string[] }>
  clienti: Array<{ id: string; label: string; phone?: string }>
  produseActivitate: string[]
  produseComanda: string[]
}): string {
  const {
    nowIso,
    nowLocalDate,
    nowLocalDateTime,
    timezone,
    currentPath,
    currentMessage,
    effectiveMessage,
    stickyFlow,
    continuationUsed,
    parcele,
    clienti,
    produseActivitate,
    produseComanda,
  } = params

  return [
    'Ești extractorul semantic pentru Zmeurel OS. Răspunzi strict prin obiectul structurat cerut de schemă.',
    `Data locală curentă: ${nowLocalDate}`,
    `Data și ora locală curentă: ${nowLocalDateTime}`,
    `Now ISO (debug): ${nowIso}`,
    `Timezone: ${timezone}`,
    `Rută curentă: ${currentPath}`,
    `Flow anterior activ: ${stickyFlow ?? 'none'}`,
    `Continuation folosit: ${continuationUsed ? 'da' : 'nu'}`,
    'Reguli obligatorii:',
    '- Decide flow_key dintre: recoltare, activitate, comanda.',
    '- Dacă mesajul nou exprimă clar altă intenție decât flow-ul anterior, noua intenție câștigă.',
    '- Alege *_id doar din listele valide injectate.',
    '- REGULĂ CRITICĂ JSON: Dacă o informație lipsește sau nu este sigură (ex. un ID, cantitatea, observațiile, data), NU folosi valoarea null, NU folosi șir gol și NU inventa o valoare. Pur și simplu OMITE complet acea cheie din obiectul JSON generat. Obiectul trebuie să conțină doar cheile pentru care ai valori sigure și valide.',
    '- Nu inventa entități. Nu ghici ID-uri.',
    '- Interpretează datele relativ la timezone-ul dat. Returnează datele în format YYYY-MM-DD.',
    '- Ignoră ezitări și voice junk: "ă", "aaa", "îhî", repetiții fără sens.',
    '- Nu pune politețuri sau filler în observatii.',
    '- Nu duplica în observatii informații deja extrase în câmpuri dedicate.',
    '- missing_fields trebuie să conțină doar câmpuri reale lipsă pentru flow-ul ales.',
    '- needs_clarification este true doar când lipsește ceva esențial sau alegerea entității nu e sigură.',
    'Context conversație:',
    JSON.stringify({
      current_message: currentMessage,
      effective_message: effectiveMessage,
      valid_parcele: parcele,
      valid_clienti: clienti,
      valid_produse_activitate: produseActivitate,
      valid_produse_comanda: produseComanda,
    }),
  ].join('\n')
}

type StructuredFlowParseResult =
  | {
      kind: 'clarify'
      flow: 'recoltare' | 'activitate' | 'comanda'
      text: string
      fieldsMissing: string[]
      fieldsPresent: string[]
      canonicalizationUsed: boolean
    }
  | {
      kind: 'form'
      flow: 'recoltare' | 'activitate' | 'comanda'
      prefillData: Record<string, unknown>
      fieldsPresent: string[]
      canonicalizationUsed: boolean
    }

function resolveStructuredTargetedFlow(params: {
  extraction: StructuredTargetedFlowExtraction
  canonicalCandidates: Awaited<ReturnType<typeof loadCanonicalCandidates>>
  followUpDate?: string
  today: string
}): StructuredFlowParseResult {
  const { extraction, canonicalCandidates, followUpDate, today } = params
  const resolveFormDate = (contextDate?: string | null) => followUpDate ?? contextDate ?? today

  if (extraction.flow_key === 'recoltare') {
    const parcela = extraction.parcela_id ? canonicalCandidates.parcelaById[extraction.parcela_id] : undefined
    const formDate = followUpDate ?? extraction.data ?? undefined
    const missing = Array.from(
      new Set(
        [
          ...(parcela ? [] : extraction.parcela_id ? ['parcela'] : []),
          ...(extraction.missing_fields ?? []),
        ].filter(Boolean)
      )
    )
    if (!parcela && !missing.includes('parcela')) missing.push('parcela')
    if (!formDate && !missing.includes('data')) missing.push('data')

    if (missing.length > 0 || extraction.needs_clarification) {
      if (missing.includes('parcela') && missing.includes('data')) {
        return {
          kind: 'clarify',
          flow: 'recoltare',
          text: 'Pentru recoltare, de pe ce parcelă și pentru ce dată?',
          fieldsMissing: missing,
          fieldsPresent: [],
          canonicalizationUsed: false,
        }
      }
      if (missing.includes('parcela')) {
        return {
          kind: 'clarify',
          flow: 'recoltare',
          text: 'Pentru recoltare, de pe ce parcelă?',
          fieldsMissing: missing,
          fieldsPresent: formDate ? ['data'] : [],
          canonicalizationUsed: false,
        }
      }
      return {
        kind: 'clarify',
        flow: 'recoltare',
        text: 'Pentru recoltare, pentru ce dată?',
        fieldsMissing: missing,
        fieldsPresent: parcela ? ['parcela_id', 'parcela_label'] : [],
        canonicalizationUsed: false,
      }
    }

    const prefillData = sanitizePrefill({
      parcela_id: parcela?.id,
      parcela_label: parcela?.label,
      cantitate_kg: extraction.cantitate_kg ?? undefined,
      data: resolveFormDate(extraction.data),
      observatii: extraction.observatii ?? undefined,
    })
    return {
      kind: 'form',
      flow: 'recoltare',
      prefillData,
      fieldsPresent: Object.keys(prefillData),
      canonicalizationUsed: true,
    }
  }

  if (extraction.flow_key === 'activitate') {
    const parcela = extraction.parcela_id ? canonicalCandidates.parcelaById[extraction.parcela_id] : undefined
    const produs = resolveCanonicalProduct(extraction.produs, canonicalCandidates.produseActivitate)
    const formDate = followUpDate ?? extraction.data ?? undefined
    const missing = Array.from(
      new Set(
        [
          ...(parcela ? [] : extraction.parcela_id ? ['parcela'] : []),
          ...(extraction.produs && !produs ? ['produs'] : []),
          ...(extraction.missing_fields ?? []),
        ].filter(Boolean)
      )
    )
    if (!extraction.tip && !missing.includes('tip')) missing.push('tip')
    if (!formDate && !missing.includes('data')) missing.push('data')

    if (missing.length > 0 || extraction.needs_clarification) {
      const prefix = parcela ? `Pentru activitatea la ${parcela.label}, ` : 'Pentru activitate, '
      if (missing.includes('tip') && missing.includes('data')) {
        return {
          kind: 'clarify',
          flow: 'activitate',
          text: 'Pentru activitate, ce tip activitate și pentru ce dată?',
          fieldsMissing: missing,
          fieldsPresent: [],
          canonicalizationUsed: false,
        }
      }
      if (missing.includes('tip')) {
        return {
          kind: 'clarify',
          flow: 'activitate',
          text: `${prefix}ce tip activitate?`,
          fieldsMissing: missing,
          fieldsPresent: parcela ? ['parcela_id', 'parcela_label'] : [],
          canonicalizationUsed: false,
        }
      }
      if (missing.includes('produs')) {
        return {
          kind: 'clarify',
          flow: 'activitate',
          text: 'Pentru activitate, ce produs ai folosit?',
          fieldsMissing: missing,
          fieldsPresent: parcela ? ['parcela_id', 'parcela_label'] : [],
          canonicalizationUsed: false,
        }
      }
      if (missing.includes('parcela')) {
        return {
          kind: 'clarify',
          flow: 'activitate',
          text: 'Pentru activitate, la ce parcelă?',
          fieldsMissing: missing,
          fieldsPresent: extraction.tip ? ['tip'] : [],
          canonicalizationUsed: false,
        }
      }
      return {
        kind: 'clarify',
        flow: 'activitate',
        text: `${prefix}pentru ce dată?`,
        fieldsMissing: missing,
        fieldsPresent: [extraction.tip ? 'tip' : '', parcela ? 'parcela_id' : '', produs ? 'produs' : ''].filter(Boolean),
        canonicalizationUsed: false,
      }
    }

    const prefillData = sanitizePrefill({
      parcela_id: parcela?.id,
      parcela_label: parcela?.label,
      tip: extraction.tip ?? undefined,
      produs,
      doza: extraction.doza ?? undefined,
      data: resolveFormDate(extraction.data),
      observatii: extraction.observatii ?? undefined,
    })
    return {
      kind: 'form',
      flow: 'activitate',
      prefillData,
      fieldsPresent: Object.keys(prefillData),
      canonicalizationUsed: true,
    }
  }

  const client = extraction.client_id ? canonicalCandidates.clientById[extraction.client_id] : undefined
  const produs = resolveCanonicalProduct(extraction.produs, canonicalCandidates.produseComanda)
  const deliveryDate = followUpDate ?? extraction.data_livrare ?? undefined
  const missing = Array.from(
    new Set(
      [
        ...(client ? [] : extraction.client_id ? ['nume_client'] : []),
        ...(extraction.produs && !produs ? ['produs'] : []),
        ...(extraction.missing_fields ?? []),
      ].filter(Boolean)
    )
  )
  if (!client && !missing.includes('nume_client')) missing.push('nume_client')
  if (extraction.cantitate_kg == null && !missing.includes('cantitate_kg')) missing.push('cantitate_kg')
  if (!deliveryDate && !missing.includes('data_livrare')) missing.push('data_livrare')

  if (missing.length > 0 || extraction.needs_clarification) {
    if (missing.includes('nume_client')) {
      return {
        kind: 'clarify',
        flow: 'comanda',
        text: 'Pentru ce client?',
        fieldsMissing: missing,
        fieldsPresent: [],
        canonicalizationUsed: false,
      }
    }
    if (missing.includes('cantitate_kg')) {
      return {
        kind: 'clarify',
        flow: 'comanda',
        text: `Pentru comanda către ${client?.label ?? 'client'}, ce cantitate (kg)?`,
        fieldsMissing: missing,
        fieldsPresent: client ? ['client_id', 'client_label'] : [],
        canonicalizationUsed: false,
      }
    }
    if (missing.includes('data_livrare')) {
      return {
        kind: 'clarify',
        flow: 'comanda',
        text: `Pentru comanda către ${client?.label ?? 'client'}, pentru ce dată de livrare?`,
        fieldsMissing: missing,
        fieldsPresent: client ? ['client_id', 'client_label'] : [],
        canonicalizationUsed: false,
      }
    }
    return {
      kind: 'clarify',
      flow: 'comanda',
      text: 'Pentru comandă, ce produs dorești?',
      fieldsMissing: missing,
      fieldsPresent: client ? ['client_id', 'client_label'] : [],
      canonicalizationUsed: false,
    }
  }

  const prefillData = sanitizePrefill({
    client_id: client?.id,
    client_label: client?.label,
    telefon: extraction.telefon ?? client?.phone ?? undefined,
    locatie_livrare: extraction.locatie_livrare ?? undefined,
    data_livrare: resolveFormDate(extraction.data_livrare),
    cantitate_kg: extraction.cantitate_kg ?? undefined,
    pret_per_kg: extraction.pret_per_kg ?? client?.negotiatedPricePerKg ?? undefined,
    produs,
    observatii: extraction.observatii ?? undefined,
  })

  return {
    kind: 'form',
    flow: 'comanda',
    prefillData,
    fieldsPresent: Object.keys(prefillData),
    canonicalizationUsed: true,
  }
}

function isShortFollowUpMessage(message: string): boolean {
  const trimmed = message.trim()
  if (!trimmed) return false
  if (trimmed.length > 40) return false

  const tokens = trimmed.split(/\s+/).filter(Boolean)
  if (tokens.length > 5) return false

  return (
    /^(azi|ast[aă]zi|ieri|alalt[aă]ieri|acum 2 zile|acum dou[aă] zile|m[aâ]ine|poim[aâ]ine)$/i.test(trimmed) ||
    /^(\d+(?:[.,]\d+)?)\s*(kg|g|l|ml|lei|ron)$/i.test(trimmed) ||
    /^(?:la\s+)?(\d+(?:[.,]\d+)?)\s*(?:lei|ron)\s*(?:\/|pe\s*)\s*kg$/i.test(trimmed) ||
    /^(\d+(?:[.,]\d+)?)$/i.test(trimmed) ||
    /^(?:\+?4[\s-]?)?0\d(?:[\s-]?\d){8,12}$/.test(trimmed) ||
    /^0\d{5,}$/i.test(trimmed) ||
    /^[a-zăâîșşțţ][a-z0-9ăâîșşțţ\- ]{1,30}$/i.test(trimmed)
  )
}

function isPendingClarificationText(aiText: string): boolean {
  return /(ce cantitate|ce doz[aă]|ce sum[aă]|pentru ce dat[aă]|la ce parcel[aă]|de pe ce parcel[aă]|ce produs|ce tip activitate|pentru ce client|cum se nume[șs]te clientul|ce detaliu mai completezi|mai am nevoie de|mai completeaz[aă]\s+pre[țt]ul\/kg|investi[țt]ie\s+capex|cheltuial[aă]\s+opex|capex\)\s+sau|opex\)\s+\?)/i.test(aiText)
}

function isActiveFormFlowText(aiText: string): boolean {
  return /(am preg[aă]tit formularul|am completat|am deschis formularul|verific[aă] [șs]i salveaz[aă])/i.test(aiText)
}

function detectExplicitFinancialFollowUpFlow(message: string): ActiveFlow {
  const trimmed = message.trim()
  if (!trimmed) return null

  if (/\b(?:capex|investi[țt]ie|investitie)\b/i.test(trimmed)) return 'investitie'
  if (/\b(?:opex|cheltuial[aă])\b/i.test(trimmed)) return 'cheltuiala'
  return null
}

function isAmbiguousFinancialClarification(aiText: string): boolean {
  return /(capex|opex|investi[țt]ie|cheltuial[aă]).*(sau)|(.+sau.+)(capex|opex|investi[țt]ie|cheltuial[aă])/i.test(aiText)
}

function collectMissingRequired(
  required: readonly string[],
  fieldPresence: Record<string, boolean>
): string[] {
  const missing: string[] = []
  for (const field of required) {
    if (!fieldPresence[field]) missing.push(field)
  }
  return missing
}

function sanitizePrefill(prefill: Record<string, unknown>): Record<string, unknown> {
  const cleaned: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(prefill)) {
    if (value === undefined || value === null) continue
    if (typeof value === 'number' && !Number.isFinite(value)) continue
    if (typeof value === 'string') {
      const trimmed = value.trim()
      if (!trimmed) continue
      cleaned[key] = trimmed
      continue
    }
    cleaned[key] = value
  }
  return cleaned
}

function shouldRestartFreshCreateFlow(params: {
  message: string
  stickyFlow: ActiveFlow
  previousAiMessage: string
  explicitNewFlow: ActiveFlow
}): boolean {
  const { message, stickyFlow, previousAiMessage, explicitNewFlow } = params

  if (!stickyFlow || stickyFlow !== explicitNewFlow) return false
  if (stickyFlow === 'recoltare' || stickyFlow === 'activitate') return false
  if (!isActiveFormFlowText(previousAiMessage)) return false
  if (!detectCreationIntentRo(message)) return false
  return true
}

function shouldTreatAsFreshCreateMessage(params: {
  message: string
  today: string
  yesterday: string
}): boolean {
  const { message, today, yesterday } = params
  if (!detectCreationIntentRo(message)) return false

  return (
    extractDateRo(message, today, yesterday) != null ||
    extractSuma(message) != null ||
    extractCantitateKg(message) != null
  )
}

async function resolveContinuationMessage(params: {
  supabase: ServerSupabaseClient
  userId: string
  tenantId: string | null
  pathname: string
  message: string
  historyHint?: { previousUserMessage?: string; previousAiMessage?: string } | null
}): Promise<{ effectiveMessage: string; continuationUsed: boolean; previousUserMessage?: string; previousAiMessage?: string }> {
  const { supabase, userId, tenantId, pathname, message, historyHint } = params

  const continuationCandidate =
    isShortFollowUpMessage(message) ||
    hasExplicitCorrectionSignalRo(message) ||
    detectClearedFields(message).size > 0

  if (!continuationCandidate) {
    return { effectiveMessage: message, continuationUsed: false }
  }

  const resolveFromHint = () => {
    const hintedUser = (historyHint?.previousUserMessage ?? '').trim()
    const hintedAi = (historyHint?.previousAiMessage ?? '').trim()
    if (!hintedUser || !hintedAi) return null
    if (!isPendingClarificationText(hintedAi) && !isActiveFormFlowText(hintedAi)) return null
    return {
      effectiveMessage: `${hintedUser} ${message}`.replace(/\s+/g, ' ').trim(),
      continuationUsed: true,
      previousUserMessage: hintedUser,
      previousAiMessage: hintedAi,
    }
  }

  try {
    const query = tenantId
      ? supabase.from('ai_conversations').select('mesaj_user, raspuns_ai').eq('tenant_id', tenantId).eq('user_id', userId).eq('pathname', pathname)
      : supabase.from('ai_conversations').select('mesaj_user, raspuns_ai').eq('user_id', userId).eq('pathname', pathname)

    const { data } = await query.order('created_at', { ascending: false }).limit(1)
    const rows: AiConversationSnippet[] = Array.isArray(data) ? data : []
    const last = rows.length > 0 ? rows[0] : null
    const lastUser = (last?.mesaj_user ?? '').trim()
    const lastAi = (last?.raspuns_ai ?? '').trim()

    if (!lastUser || !lastAi) return resolveFromHint() ?? { effectiveMessage: message, continuationUsed: false }
    if (!isPendingClarificationText(lastAi) && !isActiveFormFlowText(lastAi)) {
      return resolveFromHint() ?? { effectiveMessage: message, continuationUsed: false }
    }

    return {
      effectiveMessage: `${lastUser} ${message}`.replace(/\s+/g, ' ').trim(),
      continuationUsed: true,
      previousUserMessage: lastUser,
      previousAiMessage: lastAi,
    }
  } catch {
    return resolveFromHint() ?? { effectiveMessage: message, continuationUsed: false }
  }
}

// ─── JSON response helpers ────────────────────────────────────────────────────

interface ChatResponse {
  type: 'answer' | 'form' | 'limit'
  response?: string
  form?: string
  prefill_data?: Record<string, unknown>
  prefill?: Record<string, unknown>
  message?: string
  messagesUsed: number
  messagesLimit: number
}

type DecisionMode = 'deterministic' | 'ambiguous_clarification' | 'llm_fallback' | 'continuation'
type ClarificationKind = 'missing_required' | 'ambiguity' | 'generic_fallback' | 'none'
type FlowFinalState = 'clarify' | 'open_form' | 'report' | 'fallback' | 'limit' | 'error'

interface ChatDecisionTelemetry {
  flowSelected?: string
  decisionMode?: DecisionMode
  clarificationKind?: ClarificationKind
  flowFinalState?: FlowFinalState
  openFormEmitted?: boolean
  saveHintEmitted?: boolean
  missingRequiredOpenFieldsCount?: number
  missingSaveHintFieldsCount?: number
  fieldsPresent?: string[]
  fieldsMissing?: string[]
  canonicalizationUsed?: boolean
  llmUsed?: boolean
}

function jsonAnswer(text: string, messagesUsed: number, messagesLimit: number): NextResponse<ChatResponse> {
  return NextResponse.json({ type: 'answer', response: text, messagesUsed, messagesLimit })
}

function jsonForm(
  data: { form: string; prefill_data: Record<string, unknown>; message: string },
  messagesUsed: number,
  messagesLimit: number
): NextResponse<ChatResponse> {
  return NextResponse.json({
    type: 'form',
    form: data.form,
    prefill_data: data.prefill_data,
    // Backward-compatible alias for older tests/consumers.
    prefill: data.prefill_data,
    message: data.message,
    messagesUsed,
    messagesLimit,
  })
}

// ─── System prompt (~500 tokens) ─────────────────────────────────────────────

function buildSystemPrompt(ctx: {
  today: string
  yesterday: string
  pathname: string
  context: string
  memory: string
}): string {
  const { today, yesterday, pathname, context, memory } = ctx
  const parts: string[] = [
    `Ești asistentul Zmeurel OS pentru fermieri. Română ONLY. Max 3 propoziții. Fără inventat.`,
    `Azi:${today} Ieri:${yesterday} Pagina:${pathname}`,
  ]
  if (context) parts.push(`Date fermă: ${context}`)
  if (memory) parts.push(`Memorie scurtă conversație: ${memory}`)
  parts.push(`Interpretare română uzuală: "bagă/adaugă/trece/pune"=adăugare; "modifică/editează/schimbă"=editare; "arată-mi/vezi/cât am/cât am dat"=interogare.`)
  parts.push(`Timp: "azi"=${today}, "ieri"=${yesterday}, "luna asta"=luna curentă, "săptămâna asta"=săptămâna curentă.`)
  parts.push(`Context loc: "pe solar", "la parcelă", "la zmeură", "la Delniwa" indică loc/cultură; dacă e ambiguu, întreabă scurt.`)
  parts.push(`Linkuri markdown [Pagina](/ruta). Dacă lipsesc date: "Nu am această informație."`)
  parts.push(`ADĂUGARE DATE → returnezi EXCLUSIV JSON (fără alt text):
Cheltuiala(OPEX): {"action":"open_form","form":"cheltuiala","prefill":{"suma":N,"categorie":"C","data":"D","descriere":"S"}}
Categ.OPEX: Fertilizanți|Tratamente fitosanitare|Ambalaje|Forță de muncă|Combustibil și energie|Consumabile|Transport și livrare|Reparații și întreținere|Servicii și taxe|Diverse operaționale
Investiție(CAPEX): {"action":"open_form","form":"investitie","prefill":{"suma":N,"categorie":"C","data":"D","descriere":"S"}}
Categ.CAPEX: Material săditor|Irigații și fertigare|Sisteme de susținere și protecție|Construcții și amenajări|Utilaje și echipamente|Depozitare și răcire|Infrastructură și utilități|IT și automatizări|Alte investiții
Recoltare: {"action":"open_form","form":"recoltare","prefill":{"cantitate_kg":N,"parcela":"S","data":"D","calitate":"Cal I"}}
Activitate: {"action":"open_form","form":"activitate","prefill":{"tip":"S","parcela":"S","produs":"S","doza":"S","data":"D"}}
Comanda: {"action":"open_form","form":"comanda","prefill":{"nume_client":"S","telefon":"S","locatie_livrare":"S","data_livrare":"D","cantitate_kg":N,"produs":"S","observatii":"S"}}
Client: {"action":"open_form","form":"client","prefill":{"nume_client":"S","telefon":"S","email":"E","adresa":"S","observatii":"S"}}
Reguli: 
- Cheltuiala: suma și data OBLIGATORII. Dacă lipsesc: "Ce sumă?" sau "Pentru ce dată?"
- Investiție: suma, categorie și data OBLIGATORII. Dacă lipsesc: "Ce sumă?", "Ce categorie?" sau "Pentru ce dată?"
- Recoltare: cantitate_kg OBLIGATORIE. Dacă lipsește: "Câte kg?"
- Activitate: tip și produs OBLIGATORII. Dacă lipsesc: "Ce tip activitate?" sau "Ce produs?"
- Comandă: nume_client OBLIGATORIU. Dacă lipsește: "Pentru ce client?"
- Client: nume_client OBLIGATORIU. Dacă lipsește: "Cum se numește clientul?"
- Pompă/folie/sârmă ambiguu→întreabă CAPEX vs OPEX
- Parcelă ambiguă→întreabă "La ce parcelă?"
- Produs ambiguu→întreabă "Ce produs?"`)
  parts.push(`Exemple:
"bagă 220 lei motorină azi"→{"action":"open_form","form":"cheltuiala","prefill":{"suma":220,"categorie":"Combustibil și energie","data":"${today}","descriere":"Motorină"}}
"trece butași 1500 lei la delniwa"→{"action":"open_form","form":"investitie","prefill":{"suma":1500,"categorie":"Material săditor","data":"${today}","descriere":"Butași Delniwa"}}
"cât am dat luna asta pe tratamente?"→răspuns scurt din context; fără JSON
"arată-mi ce am recoltat săptămâna asta pe solar"→răspuns scurt din context; fără JSON
"300 lei manoperă ieri"→{"action":"open_form","form":"cheltuiala","prefill":{"suma":300,"categorie":"Forță de muncă","data":"${yesterday}","descriere":"Manoperă"}}
"butași zmeur 1200 lei"→{"action":"open_form","form":"investitie","prefill":{"suma":1200,"categorie":"Material săditor","data":"${today}","descriere":"Butași zmeur"}}
"recoltat 12kg Delniwa azi"→{"action":"open_form","form":"recoltare","prefill":{"cantitate_kg":12,"parcela":"Delniwa","data":"${today}","calitate":"Cal I"}}
"stropit Delniwa Switch 0.5L azi"→{"action":"open_form","form":"activitate","prefill":{"tip":"tratament","parcela":"Delniwa","produs":"Switch","doza":"0.5L","data":"${today}"}}
"comandă pentru Maria de 4 kg zmeură mâine"→{"action":"open_form","form":"comanda","prefill":{"nume_client":"Maria","cantitate_kg":4,"produs":"zmeură","data_livrare":"${today}"}}
"client nou, Ioana Popescu, 07..."→{"action":"open_form","form":"client","prefill":{"nume_client":"Ioana Popescu","telefon":"07..."}}`)
  parts.push(`NU afișa JSON în răspuns — frontend-ul îl interceptează automat.`)
  return parts.join('\n')
}

// ─── Route ────────────────────────────────────────────────────────────────────

type ChatPostRouteDeps = {
  createClient: typeof createClient
  getTenantIdOrNull: typeof getTenantIdOrNull
  generateText: typeof generateText
  generateObject: typeof generateObject
}

const DEFAULT_CHAT_POST_ROUTE_DEPS: ChatPostRouteDeps = {
  createClient,
  getTenantIdOrNull,
  generateText,
  generateObject,
}

export function createChatPostHandler(depsOverride: Partial<ChatPostRouteDeps> = {}) {
  const deps: ChatPostRouteDeps = {
    ...DEFAULT_CHAT_POST_ROUTE_DEPS,
    ...depsOverride,
  }

  return async function POST(request: Request) {
  try {
    const supabase = await deps.createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user?.id) {
      return NextResponse.json({ error: 'Trebuie să fii autentificat.' }, { status: 401 })
    }

    const userId = user.id

    // --- Parse & validate body ---
    let message: string
    let pathname: string
    let conversationId: string | null = null
    let historyHint: { previousUserMessage?: string; previousAiMessage?: string } | null = null
    try {
      const body = await request.json()
      // Accept both { message: string } (new) and { messages: Array } (legacy)
      if (typeof body.message === 'string') {
        message = body.message
      } else if (Array.isArray(body.messages)) {
        message = String(body.messages[body.messages.length - 1]?.content ?? '')
      } else {
        return NextResponse.json({ error: 'Date invalide.' }, { status: 400 })
      }
      if (typeof body.pathname !== 'string') {
        return NextResponse.json({ error: 'Date invalide.' }, { status: 400 })
      }
      pathname = body.pathname

      if (typeof body.conversationId === 'string') {
        const trimmedConversationId = body.conversationId.trim()
        if (trimmedConversationId.length > 0) {
          conversationId = trimmedConversationId.substring(0, 120)
        }
      }

      const history = typeof body.history === 'object' && body.history !== null ? body.history : null
      if (history) {
        const previousUserMessage =
          typeof (history as { previousUserMessage?: unknown }).previousUserMessage === 'string'
            ? (history as { previousUserMessage: string }).previousUserMessage.trim().substring(0, 500)
            : ''
        const previousAiMessage =
          typeof (history as { previousAiMessage?: unknown }).previousAiMessage === 'string'
            ? (history as { previousAiMessage: string }).previousAiMessage.trim().substring(0, 1000)
            : ''
        if (previousUserMessage || previousAiMessage) {
          historyHint = {
            previousUserMessage: previousUserMessage || undefined,
            previousAiMessage: previousAiMessage || undefined,
          }
        }
      }
    } catch {
      return NextResponse.json({ error: 'Date invalide.' }, { status: 400 })
    }

    // --- Validate ---
    if (!message.trim()) {
      return NextResponse.json({ error: 'Mesaj gol.' }, { status: 400 })
    }
    if (message.length > MAX_MSG_CHARS) {
      return NextResponse.json(
        { error: `Mesajul e prea lung (max ${MAX_MSG_CHARS} caractere).` },
        { status: 400 }
      )
    }

    if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
      console.error('[chat] GOOGLE_GENERATIVE_AI_API_KEY lipsă')
      return NextResponse.json({ error: 'Configurare lipsă pe server.' }, { status: 500 })
    }

    const today = getTodayInBucharest()
    const yesterday = getYesterdayInBucharest()

    // --- Tenant ---
    let tenantId: string | null = null
    try {
      tenantId = await deps.getTenantIdOrNull(supabase)
    } catch (err) {
      console.warn('[chat] getTenantIdOrNull failed:', err)
    }

    let isSuperadmin = false
    try {
      const { data: profileRows } = await supabase
        .from('profiles')
        .select('is_superadmin')
        .eq('id', userId)
        .limit(1)
      isSuperadmin = Boolean(profileRows?.[0]?.is_superadmin)
    } catch {
      isSuperadmin = false
    }
    const effectiveDailyLimit = resolveAiDailyLimit({
      baseLimit: DAILY_LIMIT,
      isSuperadmin,
      email: user.email,
    })

    // --- Rate limit (atomic check + increment) ---
    const { data: rlResult, error: rlError } = await supabase.rpc('check_and_increment_ai_usage', {
      p_user_id: userId,
      p_today: today,
      p_limit: effectiveDailyLimit,
    })

    if (rlError) {
      console.error('[chat] Rate limit RPC failed:', rlError.message)
      return NextResponse.json({ error: 'Verificarea limitei a eșuat.' }, { status: 503 })
    }

    const rl = rlResult as { allowed?: boolean; count?: number; limit?: number; error?: string } | null
    const messagesUsed = rl?.count ?? 0

    if (rl?.error === 'unauthorized') {
      return NextResponse.json({ error: 'Acces neautorizat.' }, { status: 403 })
    }
    if (rl?.error === 'profile_not_found') {
      return NextResponse.json({ error: 'Profilul tău nu a fost găsit.' }, { status: 503 })
    }
    if (rl?.allowed === false) {
      const appliedLimit = rl?.limit ?? effectiveDailyLimit
      console.error('[ai-chat]', { event: 'rate_limit_hit', userId: userId.slice(0, 8) })
      return NextResponse.json(
        {
          type: 'limit',
          response: `Ai atins limita de ${appliedLimit} mesaje pe azi. Revino mâine!`,
          messagesUsed,
          messagesLimit: appliedLimit,
        },
        { status: 429 }
      )
    }
    if (rl?.allowed !== true) {
      console.error('[chat] Unexpected RPC response:', JSON.stringify(rl))
      return NextResponse.json({ error: 'Eroare internă la verificarea limitei.' }, { status: 503 })
    }

    const continuation = await resolveContinuationMessage({
      supabase,
      userId,
      tenantId,
      pathname,
      message,
      historyHint,
    })
    const previousUserMessage = continuation.previousUserMessage ?? ''
    const previousAiMessage = continuation.previousAiMessage ?? ''
    const explicitNewFlow = detectStrongFlowIntent(message) ?? detectExplicitFinancialFollowUpFlow(message)
    const continuationUsedBeforeBreak = continuation.continuationUsed
    const initialStickyFlow = continuationUsedBeforeBreak
      ? detectActiveFlow(`${previousAiMessage} ${previousUserMessage}`)
      : null
    const shouldPreferExplicitAmbiguityFlow =
      continuationUsedBeforeBreak &&
      Boolean(explicitNewFlow) &&
      isAmbiguousFinancialClarification(previousAiMessage)
    const shouldResetFreshCreateFlow =
      continuationUsedBeforeBreak &&
      shouldRestartFreshCreateFlow({
        message,
        stickyFlow: shouldPreferExplicitAmbiguityFlow ? explicitNewFlow : initialStickyFlow,
        previousAiMessage,
        explicitNewFlow,
      })
    const shouldResetContinuationForFreshCreateMessage =
      continuationUsedBeforeBreak &&
      shouldTreatAsFreshCreateMessage({
        message,
        today,
        yesterday,
      })
    const shouldBreakStickyFlow =
      shouldResetContinuationForFreshCreateMessage ||
      shouldResetFreshCreateFlow ||
      (continuationUsedBeforeBreak &&
      !shouldPreferExplicitAmbiguityFlow &&
      Boolean(initialStickyFlow) &&
      Boolean(explicitNewFlow) &&
      initialStickyFlow !== explicitNewFlow)
    const continuationUsed = shouldBreakStickyFlow ? false : continuation.continuationUsed
    const stickyFlow = shouldBreakStickyFlow
      ? null
      : shouldPreferExplicitAmbiguityFlow
        ? explicitNewFlow
        : initialStickyFlow
    const effectiveMessage = shouldBreakStickyFlow ? message : continuation.effectiveMessage
    if (continuationUsed) console.error('[ai-chat]', { event: 'continuation_detected', stickyFlow, msgLength: message.length })
    const isShortFollowUp = isShortFollowUpMessage(message)
    const hasExplicitEntityChange =
      /(schimb|modific|corect|în loc de|in loc de|nu .* ci|alt[aă]|altul|alta)\b/i.test(message) ||
      hasExplicitCorrectionSignalRo(message)
    const correctionPayload = hasExplicitCorrectionSignalRo(message) ? (extractCorrectionPayload(message) ?? '') : ''
    const clearedFields = detectClearedFields(message)
    const shouldLockEntities = continuationUsed && isShortFollowUp && !hasExplicitEntityChange
    const defaultDecisionMode: DecisionMode = continuationUsed ? 'continuation' : 'deterministic'
    const storedUserMessage = (continuationUsed ? effectiveMessage : message).substring(0, 500)
    const lastMsg = effectiveMessage.toLowerCase()
    const followUpDate = continuationUsed ? (extractDateRo(message, today, yesterday) ?? undefined) : undefined
    const resolveFormDate = (contextDate?: string | null) => followUpDate ?? contextDate ?? today
    const correctionUsed = Boolean(correctionPayload)
    const fieldClearUsed = clearedFields.size > 0

    const buildDecisionMetadata = (decision: ChatDecisionTelemetry, status: 'success' | 'failed' = 'success') => {
      const fieldsPresent = Array.isArray(decision.fieldsPresent)
        ? Array.from(new Set(decision.fieldsPresent.filter(Boolean))).slice(0, 12)
        : []
      const fieldsMissing = Array.isArray(decision.fieldsMissing)
        ? Array.from(new Set(decision.fieldsMissing.filter(Boolean))).slice(0, 12)
        : []

      return {
        flow_selected: decision.flowSelected ?? 'none',
        decision_mode: decision.decisionMode ?? defaultDecisionMode,
        conversation_id_present: Boolean(conversationId),
        continuation_used: continuationUsed,
        entity_locking_used: shouldLockEntities,
        correction_used: correctionUsed,
        field_clear_used: fieldClearUsed,
        canonicalization_used: Boolean(decision.canonicalizationUsed),
        save_hint_emitted: Boolean(decision.saveHintEmitted),
        open_form_emitted: Boolean(decision.openFormEmitted),
        missing_required_open_fields_count: decision.missingRequiredOpenFieldsCount ?? 0,
        missing_save_hint_fields_count: decision.missingSaveHintFieldsCount ?? 0,
        clarification_kind: decision.clarificationKind ?? 'none',
        flow_final_state: decision.flowFinalState ?? 'fallback',
        fields_present: fieldsPresent,
        fields_missing: fieldsMissing,
        llm_used: Boolean(decision.llmUsed),
        status,
      }
    }

    const emitDecisionTelemetry = (decision: ChatDecisionTelemetry, status: 'success' | 'failed' = 'success') => {
      const metadata = buildDecisionMetadata(decision, status)
      if (process.env.NODE_ENV === 'development') {
        console.info('[chat] decision', JSON.stringify(metadata))
      }
      supabase
        .from('analytics_events')
        .insert({
          event_name: 'ai_chat_decision',
          module: 'ai_chat',
          status,
          event_data: metadata,
          user_id: userId,
          tenant_id: tenantId,
        })
        .then(() => {}, () => {})
    }

    const computeSaveHintMeta = (form: string, messageText: string, prefill: Record<string, unknown>) => {
      const requiredSave = getRequiredSaveHintFields(form)
      const missingSave = requiredSave.filter((field) => {
        const value = prefill[field]
        if (typeof value === 'number') return !Number.isFinite(value) || value <= 0
        if (typeof value === 'string') return value.trim().length === 0
        return value == null
      })
      return {
        saveHintEmitted: missingSave.length > 0 || /culeg[ăa]tor|pre[țt]ul?\/kg/i.test(messageText),
        missingSaveHintFieldsCount: missingSave.length,
      }
    }

    const saveConversationFireAndForget = (aiResponse: string) => {
      void supabase
        .from('ai_conversations')
        .insert({
          tenant_id: tenantId,
          user_id: userId,
          mesaj_user: storedUserMessage,
          raspuns_ai: aiResponse.substring(0, 1000),
          pathname,
          created_at: new Date().toISOString(),
        })
        .then(() => {}, () => {})
    }

    const jsonAnswerWithMemory = (text: string, decision: ChatDecisionTelemetry = {}) => {
      saveConversationFireAndForget(text)
      emitDecisionTelemetry(
        {
          flowFinalState: 'clarify',
          openFormEmitted: false,
          ...decision,
          fieldsPresent: decision.fieldsPresent ?? [],
          fieldsMissing: decision.fieldsMissing ?? [],
        },
      )
      return jsonAnswer(text, messagesUsed, effectiveDailyLimit)
    }

    const jsonFormWithMemory = (
      data: { form: string; prefill_data?: Record<string, unknown>; prefill?: Record<string, unknown>; message: string },
      decision: ChatDecisionTelemetry = {}
    ) => {
      saveConversationFireAndForget(data.message)
      const validatedPrefill =
        (isStructuredTargetedFlow(data.form) ? parsePrefillDataForForm(data.form, data.prefill_data ?? data.prefill ?? {}) : null) ??
        data.prefill_data ??
        data.prefill ??
        {}
      const sanitizedPrefill = sanitizePrefill(validatedPrefill)
      const saveHintMeta = computeSaveHintMeta(data.form, data.message, sanitizedPrefill)
      emitDecisionTelemetry(
        {
          flowSelected: data.form,
          flowFinalState: 'open_form',
          decisionMode: defaultDecisionMode,
          openFormEmitted: true,
          fieldsPresent: Object.keys(sanitizedPrefill),
          ...saveHintMeta,
          ...decision,
        },
      )
      return jsonForm(
        {
          form: data.form,
          message: data.message,
          prefill_data: sanitizedPrefill,
        },
        messagesUsed,
        effectiveDailyLimit
      )
    }

    const jsonAnswerTracked = (text: string, decision: ChatDecisionTelemetry = {}, status: 'success' | 'failed' = 'success') => {
      emitDecisionTelemetry(
        {
          flowFinalState: 'fallback',
          openFormEmitted: false,
          ...decision,
          fieldsPresent: decision.fieldsPresent ?? [],
          fieldsMissing: decision.fieldsMissing ?? [],
        },
        status,
      )
      return jsonAnswer(text, messagesUsed, effectiveDailyLimit)
    }

    const jsonFormTracked = (
      data: { form: string; prefill_data?: Record<string, unknown>; prefill?: Record<string, unknown>; message: string },
      decision: ChatDecisionTelemetry = {}
    ) => {
      const validatedPrefill =
        (isStructuredTargetedFlow(data.form) ? parsePrefillDataForForm(data.form, data.prefill_data ?? data.prefill ?? {}) : null) ??
        data.prefill_data ??
        data.prefill ??
        {}
      const sanitizedPrefill = sanitizePrefill(validatedPrefill)
      const saveHintMeta = computeSaveHintMeta(data.form, data.message, sanitizedPrefill)
      emitDecisionTelemetry(
        {
          flowSelected: data.form,
          flowFinalState: 'open_form',
          openFormEmitted: true,
          fieldsPresent: Object.keys(sanitizedPrefill),
          ...saveHintMeta,
          ...decision,
        },
      )
      return jsonForm(
        {
          form: data.form,
          message: data.message,
          prefill_data: sanitizedPrefill,
        },
        messagesUsed,
        effectiveDailyLimit
      )
    }

    const jsonAmbiguityWithMemory = (text: string, decision: ChatDecisionTelemetry = {}) => {
      return jsonAnswerWithMemory(text, {
        decisionMode: 'ambiguous_clarification',
        clarificationKind: 'ambiguity',
        flowFinalState: 'clarify',
        ...decision,
      })
    }

    // --- Intent detection: edit (deterministic, zero LLM cost) ---
    const hasEditIntent = detectEditIntentRo(lastMsg)

    if (hasEditIntent && tenantId) {
      // Try to find existing records for editing
      const today = getTodayInBucharest()
      const yesterday = getYesterdayInBucharest()
      
      // Extract potential identifiers
      const extractData = (txt: string): string | null => extractDateRo(txt, today, yesterday) ?? null

      const targetDate = extractData(lastMsg)
      
      // Check for cheltuiala edit
      if (/(cheltuial[aă]|cheltuieli|motorin[aă]|manoper[aă]|tratament)/i.test(lastMsg)) {
        let query = supabase
          .from('cheltuieli_diverse')
          .select('id, suma_lei, categorie, data, descriere')
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: false })
          .limit(5)
        
        if (targetDate) {
          query = query.eq('data', targetDate)
        }
        
        const { data: cheltuieli } = await query
        
        if (cheltuieli && cheltuieli.length === 1) {
          const c = cheltuieli[0]
          return jsonFormTracked(
            {
              form: 'cheltuiala',
              message: 'Am găsit cheltuiala pentru editare. Verifică și salvează!',
              prefill: {
                id: c.id,
                suma: c.suma_lei,
                categorie: c.categorie,
                data: c.data,
                descriere: c.descriere,
              },
            },
            {
              flowSelected: 'cheltuiala',
              decisionMode: 'deterministic',
              flowFinalState: 'open_form',
            }
          )
        } else if (cheltuieli && cheltuieli.length > 1) {
          return jsonAnswerTracked(
            `Am găsit ${cheltuieli.length} cheltuieli. Te rog specifică care dorești să editezi (ex: "modifică cheltuiala cu motorină de azi").`,
            {
              flowSelected: 'cheltuiala',
              decisionMode: 'deterministic',
              clarificationKind: 'generic_fallback',
              flowFinalState: 'clarify',
            }
          )
        }
      }

      // Check for investitie edit
      if (/(investiti[ei]|investitie|butaș|butas|pomp[aă]|irigații|irigatii)/i.test(lastMsg)) {
        let query = supabase
          .from('investitii')
          .select('id, suma_lei, categorie, data, descriere')
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: false })
          .limit(5)
        
        if (targetDate) {
          query = query.eq('data', targetDate)
        }
        
        const { data: investitii } = await query
        
        if (investitii && investitii.length === 1) {
          const i = investitii[0]
          return jsonFormTracked(
            {
              form: 'investitie',
              message: 'Am găsit investiția pentru editare. Verifică și salvează!',
              prefill: {
                id: i.id,
                suma: i.suma_lei,
                categorie: i.categorie,
                data: i.data,
                descriere: i.descriere,
              },
            },
            {
              flowSelected: 'investitie',
              decisionMode: 'deterministic',
              flowFinalState: 'open_form',
            }
          )
        } else if (investitii && investitii.length > 1) {
          return jsonAnswerTracked(
            `Am găsit ${investitii.length} investiții. Te rog specifică care dorești să editezi (ex: "modifică investiția cu butași de ieri").`,
            {
              flowSelected: 'investitie',
              decisionMode: 'deterministic',
              clarificationKind: 'generic_fallback',
              flowFinalState: 'clarify',
            }
          )
        }
      }

      // Check for activitate edit
      if (/(activitat[ei]|activitate|stropit|tratat|irigat)/i.test(lastMsg)) {
        let query = supabase
          .from('activitati_agricole')
          .select('id, tip_activitate, produs_utilizat, doza, data_aplicare, parcela_id')
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: false })
          .limit(5)
        
        if (targetDate) {
          query = query.eq('data_aplicare', targetDate)
        }
        
        const { data: activitati } = await query
        
        if (activitati && activitati.length === 1) {
          const a = activitati[0]
          return jsonFormTracked(
            {
              form: 'activitate',
              message: 'Am găsit activitatea pentru editare. Verifică și salvează!',
              prefill: {
                id: a.id,
                tip: a.tip_activitate,
                produs: a.produs_utilizat,
                doza: a.doza,
                data: a.data_aplicare,
                parcela: a.parcela_id,
              },
            },
            {
              flowSelected: 'activitate',
              decisionMode: 'deterministic',
              flowFinalState: 'open_form',
            }
          )
        } else if (activitati && activitati.length > 1) {
          return jsonAnswerTracked(
            `Am găsit ${activitati.length} activități. Te rog specifică care dorești să editezi (ex: "modifică activitatea de stropit de azi").`,
            {
              flowSelected: 'activitate',
              decisionMode: 'deterministic',
              clarificationKind: 'generic_fallback',
              flowFinalState: 'clarify',
            }
          )
        }
      }

      // If we couldn't find a single record, ask for clarification
      return jsonAnswerTracked(
        'Te rog să fii mai specific: spune-mi ce tip de înregistrare vrei să editezi (cheltuială, investiție sau activitate) și când (azi, ieri sau data exactă).',
        {
          decisionMode: 'deterministic',
          clarificationKind: 'generic_fallback',
          flowFinalState: 'clarify',
        }
      )
    }

    // --- Intent detection: creation (deterministic, zero LLM cost) ---
    const hasCreationIntent = detectCreationIntentRo(lastMsg)
    const hasQuestionIntent = hasQuestionIntentRo(lastMsg)
    const hasHarvestSignal = hasHarvestSignalRo(lastMsg)
    const hasActivitySignal = hasActivitySignalRo(lastMsg)
    const hasOrderSignal = hasOrderSignalRo(lastMsg)
    const hasClientSignal = hasClientSignalRo(lastMsg)
    const hasInvestmentSignal = hasInvestmentSignalRo(lastMsg)
    const hasCostSignal = hasFinancialCostSignalRo(lastMsg)
    const hasKgQuantitySignal = /(\d+(?:[.,]\d+)?)\s*(?:de\s+)?(?:kg|kile|kilograme?)\b/i.test(lastMsg)
    const hasDozaSignal = extractDoza(effectiveMessage) != null
    const hasParcelaHint = Boolean(extractParcela(effectiveMessage)) || /\b(?:la|de pe|pe)\s+[a-z0-9ăâîșşțţ\-]{2,}/i.test(lastMsg)
    const hasProductLikeHint = /\b(switch|fungicid|erbicid|insecticid|tratament|produs|motorin[aă])\b/i.test(lastMsg)
    const hasVagueActionSignal = /(am pus ceva|am pus|pus ceva)\b/i.test(lastMsg)
    const hasDateSignal = Boolean(extractDateRo(effectiveMessage, today, yesterday))
    const hasNameKgDateHint = /\b\d+(?:[.,]\d+)?\s*(?:de\s+)?(?:kg|kile|kilograme?)\b/.test(lastMsg) && /(azi|astăzi|ieri|alaltăieri|mâine|poimâine)/i.test(lastMsg)
    const hasUsefulVagueSignal =
      (hasKgQuantitySignal && hasParcelaHint) ||
      (hasProductLikeHint && hasParcelaHint) ||
      (hasDozaSignal && hasParcelaHint) ||
      (hasVagueActionSignal && hasDateSignal)
    const hasCreateLikeIntent =
      Boolean(stickyFlow) ||
      hasCreationIntent ||
      (!hasQuestionIntent && (hasHarvestSignal || hasActivitySignal || hasCostSignal || hasOrderSignal || hasClientSignal || hasNameKgDateHint || hasUsefulVagueSignal))

    if (hasCreateLikeIntent) {
      const canonicalCandidates = await loadCanonicalCandidates({ supabase, tenantId })
      const shouldUseStructuredTargetedFlow = shouldAttemptStructuredTargetedFlow({
        stickyFlow,
        explicitNewFlow,
        hasHarvestSignal,
        hasActivitySignal,
        hasOrderSignal,
        hasKgQuantitySignal,
        hasParcelaHint,
        hasProductLikeHint,
        hasDozaSignal,
      })

      if (shouldUseStructuredTargetedFlow) {
        const bucharestNow = getBucharestNowContext()
        const structuredModel =
          effectiveMessage.length < 180 && SIMPLE_MODEL_NAME
            ? SIMPLE_MODEL_NAME
            : MODEL_NAME
        const shouldInjectClients =
          stickyFlow === 'comanda' || explicitNewFlow === 'comanda' || hasOrderSignal
        const shouldInjectActivityProducts =
          stickyFlow === 'activitate' || explicitNewFlow === 'activitate' || hasActivitySignal || hasProductLikeHint || hasDozaSignal
        const shouldInjectOrderProducts =
          stickyFlow === 'comanda' || explicitNewFlow === 'comanda' || hasOrderSignal
        const extractionPrompt = buildTargetedFlowExtractionPrompt({
          nowIso: bucharestNow.nowIso,
          nowLocalDate: bucharestNow.nowLocalDate,
          nowLocalDateTime: bucharestNow.nowLocalDateTime,
          timezone: bucharestNow.timezone,
          currentPath: pathname,
          currentMessage: message,
          effectiveMessage,
          stickyFlow,
          continuationUsed,
          parcele: canonicalCandidates.parcelaOptions.slice(0, 80),
          clienti: shouldInjectClients ? canonicalCandidates.clientOptions.slice(0, 80) : [],
          produseActivitate: shouldInjectActivityProducts ? canonicalCandidates.produseActivitate.slice(0, 80) : [],
          produseComanda: shouldInjectOrderProducts ? canonicalCandidates.produseComanda.slice(0, 80) : [],
        })

        try {
          const runStructuredExtraction = async () => {
            try {
              return await deps.generateObject({
                model: google(structuredModel),
                system: extractionPrompt,
                prompt: effectiveMessage.slice(0, MAX_MSG_CHARS),
                schema: StructuredTargetedFlowExtractionSchema,
                schemaName: 'targeted_agri_flow_extraction',
                mode: 'json',
                maxTokens: MAX_OUTPUT_TOKENS,
                ...(effectiveMessage.length < 180
                  ? { providerOptions: { google: { thinkingConfig: { thinkingBudget: 0 } } } }
                  : {}),
              })
            } catch (firstErr) {
              const errMsg = firstErr instanceof Error ? firstErr.message : String(firstErr)
              const likelyProviderOptionIssue =
                /(thinking|providerOptions|thinkingConfig|budget|unknown|invalid)/i.test(errMsg)

              if (!likelyProviderOptionIssue) throw firstErr

              return deps.generateObject({
                model: google(structuredModel),
                system: extractionPrompt,
                prompt: effectiveMessage.slice(0, MAX_MSG_CHARS),
                schema: StructuredTargetedFlowExtractionSchema,
                schemaName: 'targeted_agri_flow_extraction',
                mode: 'json',
                maxTokens: MAX_OUTPUT_TOKENS,
              })
            }
          }

          const result = await runStructuredExtraction()

          if (USAGE_LOG_ENABLED) {
            const usage = extractUsageStats(result)
            console.info(
              '[chat] structured_usage',
              JSON.stringify({
                model: structuredModel,
                inputTokens: usage.inputTokens,
                outputTokens: usage.outputTokens,
                reasoningTokens: usage.reasoningTokens,
                totalTokens: usage.totalTokens,
              })
            )
          }

          const structuredResult = resolveStructuredTargetedFlow({
            extraction: result.object as StructuredTargetedFlowExtraction,
            canonicalCandidates,
            followUpDate,
            today,
          })

          if (structuredResult.kind === 'clarify') {
            return jsonAnswerWithMemory(
              structuredResult.text,
              {
                flowSelected: structuredResult.flow,
                decisionMode: defaultDecisionMode,
                clarificationKind: 'missing_required',
                missingRequiredOpenFieldsCount: structuredResult.fieldsMissing.length,
                fieldsMissing: structuredResult.fieldsMissing,
                fieldsPresent: structuredResult.fieldsPresent,
                canonicalizationUsed: structuredResult.canonicalizationUsed,
                llmUsed: true,
              }
            )
          }

          return jsonFormWithMemory(
            {
              form: structuredResult.flow,
              message: buildPreparedFormMessage(structuredResult.flow, structuredResult.prefillData),
              prefill_data: structuredResult.prefillData,
            },
            {
              flowSelected: structuredResult.flow,
              decisionMode: defaultDecisionMode,
              fieldsPresent: structuredResult.fieldsPresent,
              canonicalizationUsed: structuredResult.canonicalizationUsed,
              llmUsed: true,
            }
          )
        } catch (structuredErr) {
          const error = structuredErr instanceof Error ? structuredErr : new Error(String(structuredErr))
          console.error('[ai-chat]', { event: 'structured_extraction_failed', input: effectiveMessage.slice(0, 100), error: { name: error.name, message: error.message } })
          console.error('Structured extraction failed, trying deterministic:', error)
          // BUG-FOUND: dacă ieșim aici cu fallback generic, sărim peste extragerea
          // deterministică deja existentă de mai jos. Asta rupe cazuri clare precum
          // "Am recoltat 20 kg azi din Delniwa" atunci când generateObject eșuează.
        }
      }

      const correctionDate = correctionPayload ? extractDateRo(correctionPayload, today, yesterday) : undefined
      let data = correctionDate ?? followUpDate ?? extractDateRo(effectiveMessage, today, yesterday)
      const parcelaPrev = previousUserMessage ? extractParcela(previousUserMessage) : undefined
      const parcelaNow = extractParcela(effectiveMessage)
      const parcelaCorrection = correctionPayload ? extractParcela(correctionPayload) : undefined
      const parcelaRaw = parcelaCorrection ?? (shouldLockEntities ? (parcelaPrev ?? parcelaNow) : (parcelaNow ?? parcelaPrev))
      const parcelaCanonical = resolveCanonicalValue(parcelaRaw, canonicalCandidates.parcele)
      const parcelaCanonicalMatches = parcelaCanonical.match
        ? (canonicalCandidates.parcelaAliasToCanonical[parcelaCanonical.match] ?? [parcelaCanonical.match])
        : []
      const parcelaCanonicalMatch = parcelaCanonicalMatches.length === 1 ? parcelaCanonicalMatches[0] : null
      const parcelaCanonicalAmbiguous = Array.from(
        new Set(
          [
            ...parcelaCanonicalMatches,
            ...parcelaCanonical.ambiguous.flatMap((item) => canonicalCandidates.parcelaAliasToCanonical[item] ?? [item]),
          ]
            .filter(Boolean)
        )
      )
      let parcela = parcelaCanonicalMatch ?? parcelaRaw
      const cantitateCorrection = correctionPayload ? extractCantitateKg(correctionPayload) : undefined
      let cantitate_kg = cantitateCorrection ?? extractCantitateKg(effectiveMessage)
      const pretPerKgPrev = previousUserMessage ? extractPretPerKg(previousUserMessage) : undefined
      const pretPerKgNow = extractPretPerKg(effectiveMessage)
      const pretPerKgCorrection = correctionPayload ? extractPretPerKg(correctionPayload) : undefined
      let pret_per_kg = pretPerKgCorrection ?? (shouldLockEntities ? (pretPerKgPrev ?? pretPerKgNow) : (pretPerKgNow ?? pretPerKgPrev))
      const dozaCorrection = correctionPayload ? extractDoza(correctionPayload) : undefined
      let doza = dozaCorrection ?? extractDoza(effectiveMessage)
      const produsPrev = previousUserMessage ? extractProdus(previousUserMessage) : undefined
      const produsNow = extractProdus(effectiveMessage)
      const produsCorrection = correctionPayload ? extractProdus(correctionPayload) : undefined
      const produsRaw = produsCorrection ?? (shouldLockEntities ? (produsPrev ?? produsNow) : (produsNow ?? produsPrev))
      const produsCanonical = resolveCanonicalValue(produsRaw, canonicalCandidates.produseActivitate)
      let produs = produsCanonical.match ?? produsRaw
      parcela = sanitizeCanonicalEntity(parcela, 'parcela')
      produs = sanitizeCanonicalEntity(produs, 'produs')
      const tip = extractActivitateTip(effectiveMessage)
      let observatiiRecoltare = extractObservatiiCandidate(effectiveMessage, [
        parcelaRaw,
        parcelaCanonicalMatch,
        cantitate_kg,
        data,
      ])
      let observatiiActivitate = extractObservatiiCandidate(effectiveMessage, [
        tip,
        parcelaRaw,
        parcelaCanonicalMatch,
        produsRaw,
        produsCanonical.match,
        doza,
        data,
      ])
      const hasLandHint = Boolean(parcela) || /\b(?:la|de pe|pe)\s+[a-z0-9ăâîșşțţ\-]{2,}/i.test(lastMsg)
      const hasHarvestDominantSignal =
        hasHarvestSignal || ((Boolean(stickyFlow) || hasCreationIntent) && hasKgQuantitySignal && hasLandHint && !hasCostSignal && !hasActivitySignal)
      const hasActivityDominantSignal =
        hasActivitySignal &&
        (!hasCostSignal || hasLandHint || Boolean(produs) || Boolean(doza) || Boolean(data) || /\bcu\s+[a-z0-9ăâîșşțţ\-]/i.test(lastMsg))

      if (clearedFields.has('data')) data = undefined
      if (clearedFields.has('parcela') || clearedFields.has('sursa')) parcela = undefined
      if (clearedFields.has('cantitate')) cantitate_kg = undefined
      if (clearedFields.has('suma')) pret_per_kg = undefined
      if (clearedFields.has('doza')) doza = undefined
      if (clearedFields.has('produs')) produs = undefined
      if (clearedFields.has('observatii')) {
        observatiiRecoltare = undefined
        observatiiActivitate = undefined
      }

      const preferHarvestFlow = stickyFlow === 'recoltare' || (hasHarvestDominantSignal && !hasCostSignal)
      const preferActivityFlow = stickyFlow === 'activitate' || (hasActivityDominantSignal && (!hasCostSignal || parcela || produs || doza || data))
      const preferExpenseFlow = stickyFlow === 'cheltuiala' || (!stickyFlow && hasCostSignal && !hasOrderSignal && !hasInvestmentSignal && !hasHarvestDominantSignal && !hasActivityDominantSignal)
      const preferInvestmentFlow = stickyFlow === 'investitie' || hasInvestmentSignal
      const preferOrderFlow = stickyFlow === 'comanda' || hasOrderSignal
      const preferClientFlow = stickyFlow === 'client' || hasClientSignal
      const selectedDeterministicFlow = preferHarvestFlow ? 'recoltare' : preferActivityFlow ? 'activitate' : preferExpenseFlow ? 'cheltuiala' : preferInvestmentFlow ? 'investitie' : preferOrderFlow ? 'comanda' : preferClientFlow ? 'client' : null
      if (selectedDeterministicFlow) console.info('[ai-chat]', { event: 'flow_selected', flow: selectedDeterministicFlow, trigger: stickyFlow ? 'stickyFlow' : 'signal', input: message.slice(0, 80) })

      if (preferHarvestFlow) {
        const required = REQUIRED_FIELDS_FOR_OPEN.recoltare
        if (parcelaRaw && !parcelaCanonicalMatch && parcelaCanonicalAmbiguous.length > 1) {
          return jsonAmbiguityWithMemory(`Te referi la parcela ${parcelaCanonicalAmbiguous[0]} sau ${parcelaCanonicalAmbiguous[1]}?`, {
            flowSelected: 'recoltare',
            missingRequiredOpenFieldsCount: 1,
            fieldsMissing: ['parcela'],
          })
        }
        if (parcelaRaw && !parcelaCanonicalMatch && parcelaCanonical.hasCandidates) {
          return jsonAnswerWithMemory('Nu găsesc parcela în datele fermei. La ce parcelă te referi?', {
            flowSelected: 'recoltare',
            decisionMode: defaultDecisionMode,
            clarificationKind: 'missing_required',
            missingRequiredOpenFieldsCount: 1,
            fieldsMissing: ['parcela'],
          })
        }

        const missing = collectMissingRequired(required, {
          parcela: Boolean(parcela),
          data: Boolean(data),
        })

        if (missing.length > 0) {
          const safeParcelaForClarification = parcelaCanonicalMatch ?? undefined
          const prefix = safeParcelaForClarification ? `Pentru recoltare, ` : 'Pentru recoltare, '
          if (missing.includes('parcela') && missing.includes('data')) {
            return jsonAnswerWithMemory('Pentru recoltare, de pe ce parcelă și pentru ce dată?', {
              flowSelected: 'recoltare',
              decisionMode: defaultDecisionMode,
              clarificationKind: 'missing_required',
              missingRequiredOpenFieldsCount: missing.length,
              fieldsMissing: missing,
            })
          }
          if (missing.includes('parcela')) return jsonAnswerWithMemory('Pentru recoltare, de pe ce parcelă?', {
            flowSelected: 'recoltare',
            decisionMode: defaultDecisionMode,
            clarificationKind: 'missing_required',
            missingRequiredOpenFieldsCount: missing.length,
            fieldsMissing: missing,
          })
          return jsonAnswerWithMemory(`${prefix}pentru ce dată?`, {
            flowSelected: 'recoltare',
            decisionMode: defaultDecisionMode,
            clarificationKind: 'missing_required',
            missingRequiredOpenFieldsCount: missing.length,
            fieldsMissing: missing,
          })
        }

        const prefillDate = resolveFormDate(data)
        return jsonFormWithMemory(
          {
            form: 'recoltare',
            message: buildPreparedFormMessage('recoltare', { cantitate_kg, parcela, data: prefillDate }),
            prefill: { cantitate_kg, parcela, data: prefillDate, observatii: observatiiRecoltare },
          },
          {
            flowSelected: 'recoltare',
            decisionMode: defaultDecisionMode,
            canonicalizationUsed: Boolean(parcelaRaw && parcelaCanonicalMatch && parcelaCanonicalMatch !== parcelaRaw),
          }
        )
      }

      if (preferActivityFlow) {
        const required = REQUIRED_FIELDS_FOR_OPEN.activitate
        if (parcelaRaw && !parcelaCanonicalMatch && parcelaCanonicalAmbiguous.length > 1) {
          return jsonAmbiguityWithMemory(`Te referi la parcela ${parcelaCanonicalAmbiguous[0]} sau ${parcelaCanonicalAmbiguous[1]}?`, {
            flowSelected: 'activitate',
            missingRequiredOpenFieldsCount: 1,
            fieldsMissing: ['parcela'],
          })
        }
        if (parcelaRaw && !parcelaCanonicalMatch && parcelaCanonical.hasCandidates) {
          return jsonAnswerWithMemory('Nu găsesc parcela în datele fermei. La ce parcelă te referi?', {
            flowSelected: 'activitate',
            decisionMode: defaultDecisionMode,
            clarificationKind: 'missing_required',
            missingRequiredOpenFieldsCount: 1,
            fieldsMissing: ['parcela'],
          })
        }
        if (produsRaw && !produsCanonical.match && produsCanonical.ambiguous.length > 1) {
          return jsonAmbiguityWithMemory(`Te referi la produsul ${produsCanonical.ambiguous[0]} sau ${produsCanonical.ambiguous[1]}?`, {
            flowSelected: 'activitate',
            missingRequiredOpenFieldsCount: 1,
            fieldsMissing: ['produs'],
          })
        }
        if (produsRaw && !produsCanonical.match && produsCanonical.hasCandidates) {
          return jsonAnswerWithMemory('Nu găsesc produsul în datele fermei. Ce produs ai folosit?', {
            flowSelected: 'activitate',
            decisionMode: defaultDecisionMode,
            clarificationKind: 'missing_required',
            missingRequiredOpenFieldsCount: 1,
            fieldsMissing: ['produs'],
          })
        }

        const missing = collectMissingRequired(required, {
          tip: Boolean(tip),
          data: Boolean(data),
        })

        if (missing.length > 0) {
          const safeParcelaForClarification = parcelaCanonicalMatch ?? undefined
          const safeProdusForClarification = produsCanonical.match ?? undefined
          const contextBits = [safeParcelaForClarification ? `la ${safeParcelaForClarification}` : '', safeProdusForClarification ? `cu ${safeProdusForClarification}` : ''].filter(Boolean).join(' ')
          const prefix = contextBits ? `Pentru activitatea ${contextBits}, ` : 'Pentru activitate, '
          if (missing.includes('tip') && missing.includes('data')) return jsonAnswerWithMemory('Pentru activitate, ce tip activitate și pentru ce dată?', {
            flowSelected: 'activitate',
            decisionMode: defaultDecisionMode,
            clarificationKind: 'missing_required',
            missingRequiredOpenFieldsCount: missing.length,
            fieldsMissing: missing,
          })
          if (missing.includes('tip')) return jsonAnswerWithMemory(`${prefix}ce tip activitate?`, {
            flowSelected: 'activitate',
            decisionMode: defaultDecisionMode,
            clarificationKind: 'missing_required',
            missingRequiredOpenFieldsCount: missing.length,
            fieldsMissing: missing,
          })
          return jsonAnswerWithMemory(`${prefix}pentru ce dată?`, {
            flowSelected: 'activitate',
            decisionMode: defaultDecisionMode,
            clarificationKind: 'missing_required',
            missingRequiredOpenFieldsCount: missing.length,
            fieldsMissing: missing,
          })
        }

        const prefillDate = resolveFormDate(data)
        return jsonFormWithMemory(
          {
            form: 'activitate',
            message: buildPreparedFormMessage('activitate', { tip, parcela, produs, doza, data: prefillDate }),
            prefill: { tip, parcela, produs, doza, data: prefillDate, observatii: observatiiActivitate },
          },
          {
            flowSelected: 'activitate',
            decisionMode: defaultDecisionMode,
            canonicalizationUsed: Boolean(
              (parcelaRaw && parcelaCanonicalMatch && parcelaCanonicalMatch !== parcelaRaw) ||
              (produsRaw && produsCanonical.match && produsCanonical.match !== produsRaw)
            ),
          }
        )
      }

      const financialRoute = (!preferOrderFlow && !preferClientFlow && (preferExpenseFlow || preferInvestmentFlow || hasCostSignal))
        ? routeFinancialMessage(effectiveMessage)
        : null

      if (financialRoute?.type === 'ambiguous') {
        return jsonAmbiguityWithMemory(financialRoute.clarification)
      }

      if ((preferExpenseFlow || financialRoute?.type === 'cheltuiala') && financialRoute?.type !== 'investitie') {
        const required = REQUIRED_FIELDS_FOR_OPEN.cheltuiala
        let suma = extractSuma(effectiveMessage)
        if (clearedFields.has('suma')) suma = undefined
        // BUG-FOUND: când routerul financiar nu recunoaște un consumabil clar (ex. "caserole"),
        // financialRoute rămâne null aici, categorieChelt devine undefined și fluxul cade
        // în clarificare generică în loc să deschidă formularul de cheltuială.
        const categorieChelt = financialRoute?.type === 'cheltuiala' ? financialRoute.categorie : undefined
        const descriereChelt = extractDescriere(
          effectiveMessage,
          /(cheltuial[aă]|cheltuieli|cost|sum[aă]|categorie|factur[aă]|bon|opex|capex|investi[țt]ie|investitie)/gi,
          [parcela, produs, doza, data]
        )
        const context = descriereChelt ? `Pentru cheltuiala cu ${descriereChelt}, ` : 'Pentru cheltuială, '
        const missing = collectMissingRequired(required, {
          suma: suma != null,
          data: Boolean(data),
          categorie: Boolean(categorieChelt),
        })

        if (missing.length > 0) {
          if (missing.includes('suma') && missing.includes('data')) return jsonAnswerWithMemory(`${context}ce sumă și pentru ce dată?`, {
            flowSelected: 'cheltuiala',
            decisionMode: defaultDecisionMode,
            clarificationKind: 'missing_required',
            missingRequiredOpenFieldsCount: missing.length,
            fieldsMissing: missing,
          })
          if (missing.includes('suma') && missing.includes('categorie')) return jsonAnswerWithMemory(`${context}ce sumă și ce categorie?`, {
            flowSelected: 'cheltuiala',
            decisionMode: defaultDecisionMode,
            clarificationKind: 'missing_required',
            missingRequiredOpenFieldsCount: missing.length,
            fieldsMissing: missing,
          })
          if (missing.includes('data') && missing.includes('categorie')) return jsonAnswerWithMemory(`${context}pentru ce dată și ce categorie?`, {
            flowSelected: 'cheltuiala',
            decisionMode: defaultDecisionMode,
            clarificationKind: 'missing_required',
            missingRequiredOpenFieldsCount: missing.length,
            fieldsMissing: missing,
          })
          if (missing.includes('suma')) return jsonAnswerWithMemory(`${context}ce sumă?`, {
            flowSelected: 'cheltuiala',
            decisionMode: defaultDecisionMode,
            clarificationKind: 'missing_required',
            missingRequiredOpenFieldsCount: missing.length,
            fieldsMissing: missing,
          })
          if (missing.includes('data')) return jsonAnswerWithMemory(`${context}pentru ce dată?`, {
            flowSelected: 'cheltuiala',
            decisionMode: defaultDecisionMode,
            clarificationKind: 'missing_required',
            missingRequiredOpenFieldsCount: missing.length,
            fieldsMissing: missing,
          })
          return jsonAnswerWithMemory(`${context}ce categorie?`, {
            flowSelected: 'cheltuiala',
            decisionMode: defaultDecisionMode,
            clarificationKind: 'missing_required',
            missingRequiredOpenFieldsCount: missing.length,
            fieldsMissing: missing,
          })
        }

        const prefillDate = resolveFormDate(data)
        return jsonFormWithMemory(
          {
            form: 'cheltuiala',
            message: buildPreparedFormMessage('cheltuiala', {
              suma,
              data: prefillDate,
              categorie: categorieChelt,
              descriere: descriereChelt,
            }),
            prefill: {
              suma,
              data: prefillDate,
              categorie: categorieChelt,
              descriere: descriereChelt,
            },
          },
          {
            flowSelected: 'cheltuiala',
            decisionMode: defaultDecisionMode,
          }
        )
      }

      if (preferInvestmentFlow || financialRoute?.type === 'investitie') {
        const required = REQUIRED_FIELDS_FOR_OPEN.investitie
        let suma = extractSuma(effectiveMessage)
        if (clearedFields.has('suma')) suma = undefined
        const descriereInv = extractDescriere(
          effectiveMessage,
          /(investiti[ei]|investitie|sum[aă]|categorie|factur[aă]|bon|capex|opex|cheltuial[aă])/gi,
          [parcela, produs, doza, data]
        )
        const categorieInv = financialRoute?.type === 'investitie' ? financialRoute.categorie : undefined
        const context = descriereInv ? `Pentru investiția "${descriereInv}", ` : 'Pentru investiție, '
        const missing = collectMissingRequired(required, {
          suma: suma != null,
          data: Boolean(data),
          categorie: Boolean(categorieInv),
        })

        if (missing.length > 0) {
          if (missing.includes('suma') && missing.includes('data')) return jsonAnswerWithMemory(`${context}ce sumă și pentru ce dată?`, {
            flowSelected: 'investitie',
            decisionMode: defaultDecisionMode,
            clarificationKind: 'missing_required',
            missingRequiredOpenFieldsCount: missing.length,
            fieldsMissing: missing,
          })
          if (missing.includes('suma') && missing.includes('categorie')) return jsonAnswerWithMemory(`${context}ce sumă și ce categorie?`, {
            flowSelected: 'investitie',
            decisionMode: defaultDecisionMode,
            clarificationKind: 'missing_required',
            missingRequiredOpenFieldsCount: missing.length,
            fieldsMissing: missing,
          })
          if (missing.includes('data') && missing.includes('categorie')) return jsonAnswerWithMemory(`${context}pentru ce dată și ce categorie?`, {
            flowSelected: 'investitie',
            decisionMode: defaultDecisionMode,
            clarificationKind: 'missing_required',
            missingRequiredOpenFieldsCount: missing.length,
            fieldsMissing: missing,
          })
          if (missing.includes('suma')) return jsonAnswerWithMemory(`${context}ce sumă?`, {
            flowSelected: 'investitie',
            decisionMode: defaultDecisionMode,
            clarificationKind: 'missing_required',
            missingRequiredOpenFieldsCount: missing.length,
            fieldsMissing: missing,
          })
          if (missing.includes('data')) return jsonAnswerWithMemory(`${context}pentru ce dată?`, {
            flowSelected: 'investitie',
            decisionMode: defaultDecisionMode,
            clarificationKind: 'missing_required',
            missingRequiredOpenFieldsCount: missing.length,
            fieldsMissing: missing,
          })
          return jsonAnswerWithMemory(`${context}ce categorie?`, {
            flowSelected: 'investitie',
            decisionMode: defaultDecisionMode,
            clarificationKind: 'missing_required',
            missingRequiredOpenFieldsCount: missing.length,
            fieldsMissing: missing,
          })
        }

        const prefillDate = resolveFormDate(data)
        return jsonFormWithMemory(
          {
            form: 'investitie',
            message: buildPreparedFormMessage('investitie', {
              suma,
              data: prefillDate,
              categorie: categorieInv,
              descriere: descriereInv,
            }),
            prefill: {
              suma,
              data: prefillDate,
              categorie: categorieInv,
              descriere: descriereInv,
            },
          },
          {
            flowSelected: 'investitie',
            decisionMode: defaultDecisionMode,
          }
        )
      }

      if (hasCreationIntent && hasLandHint && !hasHarvestDominantSignal && !hasActivityDominantSignal && !hasCostSignal && !preferOrderFlow && !preferClientFlow) {
        const hasProductLikeHint = /\b(switch|fungicid|erbicid|insecticid|tratament|produs)\b/i.test(lastMsg) || Boolean(produs) || Boolean(doza)
        if (hasProductLikeHint) {
          return jsonAmbiguityWithMemory('Vrei să trec asta ca activitate agricolă sau cheltuială?')
        }
        return jsonAmbiguityWithMemory('Te referi la o recoltare sau la o activitate agricolă?')
      }

      if (!hasCreationIntent && hasNameKgDateHint && !preferHarvestFlow && !preferOrderFlow) {
        return jsonAmbiguityWithMemory('Te referi la o recoltare sau la o comandă?')
      }

      if (!preferHarvestFlow && !preferActivityFlow && !preferExpenseFlow && !preferInvestmentFlow && !preferOrderFlow && !preferClientFlow) {
        if (hasKgQuantitySignal && hasLandHint && !hasCostSignal) {
          return jsonAmbiguityWithMemory('Te referi la o recoltare sau la o comandă?')
        }
        if ((hasProductLikeHint && hasLandHint) || (hasDozaSignal && hasLandHint)) {
          return jsonAmbiguityWithMemory('Vrei să trec asta ca activitate agricolă sau cheltuială?')
        }
        if (hasVagueActionSignal && hasDateSignal) {
          return jsonAmbiguityWithMemory('Te referi la o activitate agricolă sau la o cheltuială?')
        }
      }

      if (preferOrderFlow) {
        const required = REQUIRED_FIELDS_FOR_OPEN.comanda
        const numeClientPrev = previousUserMessage ? extractNumeClient(previousUserMessage) : undefined
        const numeClientNow = extractNumeClient(effectiveMessage)
        const bareClientCorrection =
          correctionPayload &&
          !extractDateRo(correctionPayload, today, yesterday) &&
          extractCantitateKg(correctionPayload) == null &&
          extractPretPerKg(correctionPayload) == null
            ? extractClientName(correctionPayload)
            : undefined
        const numeClientCorrection = correctionPayload ? (extractNumeClient(correctionPayload) ?? bareClientCorrection) : undefined
        const numeClientRaw = numeClientCorrection ?? (shouldLockEntities ? (numeClientPrev ?? numeClientNow) : (numeClientNow ?? numeClientPrev))
        const numeClientCanonical = resolveCanonicalValue(numeClientRaw, canonicalCandidates.clienti)
        const fallbackRawClientName = sanitizeCanonicalEntity(numeClientRaw, 'client')
        const normalizedRawClient = normalizeForMatch(fallbackRawClientName ?? '')
        const normalizedCanonicalClient = normalizeForMatch(numeClientCanonical.match ?? '')
        // BUG-FOUND: "Matia" era fuzzy-matched greșit la "Maria" prin Levenshtein.
        // Pentru clienți, acceptăm auto-legarea canonică doar când match-ul este exact
        // sau prefix clar; altfel păstrăm numele raw în formularul de comandă.
        const shouldTrustCanonicalClientMatch =
          Boolean(numeClientCanonical.match) &&
          Boolean(normalizedRawClient) &&
          (
            normalizedCanonicalClient === normalizedRawClient ||
            normalizedCanonicalClient.startsWith(normalizedRawClient) ||
            normalizedRawClient.startsWith(normalizedCanonicalClient)
          )
        if (numeClientRaw && !numeClientCanonical.match && numeClientCanonical.ambiguous.length > 1) {
          return jsonAmbiguityWithMemory(`Pentru comanda aceasta, la ce client te referi: ${numeClientCanonical.ambiguous[0]} sau ${numeClientCanonical.ambiguous[1]}?`, {
            flowSelected: 'comanda',
            missingRequiredOpenFieldsCount: 1,
            fieldsMissing: ['nume_client'],
          })
        }
        const nume_client = shouldTrustCanonicalClientMatch
          ? sanitizeCanonicalEntity(numeClientCanonical.match ?? undefined, 'client')
          : fallbackRawClientName
        const client_id = shouldTrustCanonicalClientMatch && nume_client
          ? canonicalCandidates.clientNameToId[nume_client]
          : undefined
        const telefonPrev = previousUserMessage ? extractTelefon(previousUserMessage) : undefined
        const telefonNow = extractTelefon(effectiveMessage)
        const telefonCorrection = correctionPayload ? extractTelefon(correctionPayload) : undefined
        let telefon = telefonCorrection ?? (shouldLockEntities ? (telefonPrev ?? telefonNow) : (telefonNow ?? telefonPrev))
        if (!telefon && nume_client) {
          telefon = canonicalCandidates.clientNameToPhone[nume_client] || undefined
        }
        if (pret_per_kg == null && !clearedFields.has('suma') && client_id) {
          pret_per_kg = canonicalCandidates.clientById[client_id]?.negotiatedPricePerKg
        }
        const produsComandaPrev = previousUserMessage ? extractComandaProdus(previousUserMessage) : undefined
        const produsComandaNow = extractComandaProdus(effectiveMessage)
        const produsComandaCorrection = correctionPayload ? extractComandaProdus(correctionPayload) : undefined
        const produsComandaRaw = produsComandaCorrection ?? (shouldLockEntities ? (produsComandaPrev ?? produsComandaNow) : (produsComandaNow ?? produsComandaPrev))
        const produsComandaCanonical = resolveCanonicalValue(produsComandaRaw, canonicalCandidates.produseComanda)
        if (produsComandaRaw && !produsComandaCanonical.match && produsComandaCanonical.ambiguous.length > 1) {
          return jsonAmbiguityWithMemory(`Te referi la produsul ${produsComandaCanonical.ambiguous[0]} sau ${produsComandaCanonical.ambiguous[1]}?`, {
            flowSelected: 'comanda',
            missingRequiredOpenFieldsCount: 1,
            fieldsMissing: ['produs'],
          })
        }
        if (produsComandaRaw && !produsComandaCanonical.match && produsComandaCanonical.hasCandidates) {
          return jsonAnswerWithMemory('Nu găsesc produsul în datele fermei. Ce produs dorești în comandă?', {
            flowSelected: 'comanda',
            decisionMode: defaultDecisionMode,
            clarificationKind: 'missing_required',
            missingRequiredOpenFieldsCount: 1,
            fieldsMissing: ['produs'],
          })
        }
        let produs_comanda = sanitizeCanonicalEntity(produsComandaCanonical.match ?? produsComandaRaw, 'produs')
        const sursaPrev = previousUserMessage ? extractComandaSursa(previousUserMessage) : undefined
        const sursaNow = extractComandaSursa(effectiveMessage)
        const sursaCorrection = correctionPayload ? (extractComandaSursa(correctionPayload) ?? extractParcela(correctionPayload)) : undefined
        let sursaRaw = sursaCorrection ?? (shouldLockEntities ? (sursaPrev ?? sursaNow) : (sursaNow ?? sursaPrev))
        const sursaCanonical = resolveCanonicalValue(sursaRaw, canonicalCandidates.parcele)
        if (sursaRaw && !sursaCanonical.match && sursaCanonical.ambiguous.length > 1) {
          return jsonAmbiguityWithMemory(`Pentru comanda către ${nume_client ?? 'client'}, te referi la parcela ${sursaCanonical.ambiguous[0]} sau ${sursaCanonical.ambiguous[1]}?`, {
            flowSelected: 'comanda',
            fieldsMissing: ['sursa'],
          })
        }
        if (sursaRaw && !sursaCanonical.match && sursaCanonical.hasCandidates) {
          return jsonAnswerWithMemory(`Pentru comanda către ${nume_client ?? 'client'}, nu găsesc parcela în datele fermei. Ce parcelă/soi alegi?`, {
            flowSelected: 'comanda',
            decisionMode: defaultDecisionMode,
            clarificationKind: 'ambiguity',
            fieldsMissing: ['sursa'],
          })
        }
        if (clearedFields.has('telefon')) telefon = undefined
        if (clearedFields.has('produs')) produs_comanda = undefined
        if (clearedFields.has('parcela') || clearedFields.has('sursa')) sursaRaw = undefined
        const observatiiComandaExtra = extractObservatiiCandidate(effectiveMessage, [
          numeClientRaw,
          numeClientCanonical.match,
          nume_client,
          telefon,
          produsComandaRaw,
          produsComandaCanonical.match,
          produs_comanda,
          cantitate_kg,
          data,
          pret_per_kg,
          sursaRaw,
          sursaCanonical.match,
        ])
        const observatiiComandaParts = [
          sursaRaw ? `Sursa: ${sursaCanonical.match ?? sursaRaw}` : '',
          observatiiComandaExtra ?? '',
        ].filter(Boolean)
        let observatiiComanda = observatiiComandaParts.join(' | ') || undefined
        if (clearedFields.has('observatii')) observatiiComanda = undefined

        const missing = collectMissingRequired(required, {
          nume_client: Boolean(nume_client),
          cantitate_kg: Boolean(cantitate_kg),
          data_livrare: Boolean(data),
        })

        if (missing.length > 0) {
          if (missing.length === 1) {
            if (missing[0] === 'nume_client') return jsonAnswerWithMemory('Pentru ce client?', {
              flowSelected: 'comanda',
              decisionMode: defaultDecisionMode,
              clarificationKind: 'missing_required',
              missingRequiredOpenFieldsCount: missing.length,
              fieldsMissing: missing,
            })
            if (missing[0] === 'cantitate_kg') return jsonAnswerWithMemory(`Pentru comanda către ${nume_client ?? 'client'}, ce cantitate (kg)?`, {
              flowSelected: 'comanda',
              decisionMode: defaultDecisionMode,
              clarificationKind: 'missing_required',
              missingRequiredOpenFieldsCount: missing.length,
              fieldsMissing: missing,
            })
            if (missing[0] === 'data_livrare') return jsonAnswerWithMemory(`Pentru comanda către ${nume_client ?? 'client'}, pentru ce dată de livrare?`, {
              flowSelected: 'comanda',
              decisionMode: defaultDecisionMode,
              clarificationKind: 'missing_required',
              missingRequiredOpenFieldsCount: missing.length,
              fieldsMissing: missing,
            })
            return jsonAnswerWithMemory(`Pentru comanda către ${nume_client ?? 'client'}, ce detaliu mai completezi?`, {
              flowSelected: 'comanda',
              decisionMode: defaultDecisionMode,
              clarificationKind: 'missing_required',
              missingRequiredOpenFieldsCount: missing.length,
              fieldsMissing: missing,
            })
          }

          const firstTwo = missing.slice(0, 2)
          if (firstTwo.includes('nume_client') && firstTwo.includes('cantitate_kg')) {
            return jsonAnswerWithMemory('Pentru ce client și ce cantitate (kg)?', {
              flowSelected: 'comanda',
              decisionMode: defaultDecisionMode,
              clarificationKind: 'missing_required',
              missingRequiredOpenFieldsCount: missing.length,
              fieldsMissing: missing,
            })
          }
          if (firstTwo.includes('cantitate_kg') && firstTwo.includes('data_livrare')) {
            return jsonAnswerWithMemory(`Pentru comanda către ${nume_client ?? 'client'}, ce cantitate (kg) și pentru ce dată?`, {
              flowSelected: 'comanda',
              decisionMode: defaultDecisionMode,
              clarificationKind: 'missing_required',
              missingRequiredOpenFieldsCount: missing.length,
              fieldsMissing: missing,
            })
          }
          return jsonAnswerWithMemory(`Pentru comanda către ${nume_client ?? 'client'}, mai am nevoie de ${firstTwo.length === 2 ? 'încă două detalii' : 'încă un detaliu'}.`, {
            flowSelected: 'comanda',
            decisionMode: defaultDecisionMode,
            clarificationKind: 'missing_required',
            missingRequiredOpenFieldsCount: missing.length,
            fieldsMissing: missing,
          })
        }

        const deliveryDate = resolveFormDate(data)
        return jsonFormWithMemory(
          {
            form: 'comanda',
            message: buildPreparedFormMessage('comanda', {
              nume_client,
              cantitate_kg,
              data_livrare: deliveryDate,
              pret_per_kg,
            }),
            prefill: {
              client_id,
              nume_client,
              telefon,
              cantitate_kg,
              produs: produs_comanda,
              data_livrare: deliveryDate,
              pret_per_kg,
              observatii: observatiiComanda,
            },
          },
          {
            flowSelected: 'comanda',
            decisionMode: defaultDecisionMode,
            canonicalizationUsed: Boolean(
              (numeClientRaw && numeClientCanonical.match && numeClientCanonical.match !== numeClientRaw) ||
              (produsComandaRaw && produsComandaCanonical.match && produsComandaCanonical.match !== produsComandaRaw) ||
              (sursaRaw && sursaCanonical.match && sursaCanonical.match !== sursaRaw)
            ),
          }
        )
      }

      if (preferClientFlow) {
        const clientNamePrev = previousUserMessage ? extractClientName(previousUserMessage) : undefined
        const clientNameNow = extractClientName(effectiveMessage)
        const clientNameCorrection = correctionPayload ? extractClientName(correctionPayload) : undefined
        const nume_client = clientNameCorrection ?? (shouldLockEntities ? (clientNamePrev ?? clientNameNow) : (clientNameNow ?? clientNamePrev))
        const telefonPrev = previousUserMessage ? extractTelefon(previousUserMessage) : undefined
        const telefonNow = extractTelefon(effectiveMessage)
        const telefonCorrection = correctionPayload ? extractTelefon(correctionPayload) : undefined
        let telefon = telefonCorrection ?? (shouldLockEntities ? (telefonPrev ?? telefonNow) : (telefonNow ?? telefonPrev))
        let observatii = extractObservatiiCandidate(effectiveMessage, [nume_client, telefon])
        if (clearedFields.has('telefon')) telefon = undefined
        if (clearedFields.has('observatii')) observatii = undefined

        if (!nume_client) return jsonAnswerWithMemory('Pentru clientul nou, cum se numește clientul?', {
          flowSelected: 'client',
          decisionMode: defaultDecisionMode,
          clarificationKind: 'missing_required',
          missingRequiredOpenFieldsCount: 1,
          fieldsMissing: ['nume_client'],
        })

        return jsonFormWithMemory(
          {
            form: 'client',
            message: buildPreparedFormMessage('client', { nume_client, telefon }),
            prefill: { nume_client, telefon, observatii },
          },
          {
            flowSelected: 'client',
            decisionMode: defaultDecisionMode,
          }
        )
      }
    }

    // --- Keyword context queries ---
    const keywords = detectKeywordContextFlagsRo(lastMsg)

    let keywordContext = ''
    if (tenantId) {
      const queryPromises: Array<Promise<string>> = []

      if (keywords.tratament) {
        queryPromises.push(
          Promise.resolve(
            supabase
              .from('activitati_agricole')
              .select('tip_activitate, produs_utilizat, data_aplicare')
              .eq('tenant_id', tenantId)
              .order('created_at', { ascending: false })
              .limit(3)
          ).then(({ data }) =>
            data?.length
              ? `Activități: ${data.map((a) => `${a.tip_activitate} (${a.data_aplicare})`).join('; ')}`
              : ''
          ).catch(() => '')
        )
      }

      if (keywords.client) {
        const clientWordMatch = lastMsg.match(/(?:telefon|număr|numar|client)\s+(\w+)/i)
        const searchWord = clientWordMatch?.[1] || ''
        if (searchWord) {
          queryPromises.push(
            Promise.resolve(
              supabase
                .from('clienti')
                .select('nume_client, telefon')
                .eq('tenant_id', tenantId)
                .ilike('nume_client', `%${searchWord}%`)
                .limit(3)
            ).then(({ data }) =>
              data?.length
                ? `Client: ${data.map((c) => `${c.nume_client}${c.telefon ? ' tel:' + c.telefon : ''}`).join('; ')}`
                : `Niciun client "${searchWord}".`
            ).catch(() => '')
          )
        }
      }

      if (keywords.cheltuieli) {
        const startOfMonth = new Date()
        startOfMonth.setDate(1)
        startOfMonth.setHours(0, 0, 0, 0)
        queryPromises.push(
          Promise.resolve(
            supabase
              .from('cheltuieli_diverse')
              .select('suma_lei')
              .eq('tenant_id', tenantId)
              .gte('data', startOfMonth.toISOString().split('T')[0])
          ).then(({ data }) => {
            const total = data?.reduce((s, c) => s + (Number(c.suma_lei) || 0), 0) || 0
            return total > 0 ? `Cheltuieli luna: ${total} lei` : ''
          }).catch(() => '')
        )
      }

      if (keywords.recoltare) {
        const startOfMonth = new Date()
        startOfMonth.setDate(1)
        startOfMonth.setHours(0, 0, 0, 0)
        queryPromises.push(
          Promise.resolve(
            supabase
              .from('recoltari')
              .select('cantitate_kg')
              .eq('tenant_id', tenantId)
              .gte('data', startOfMonth.toISOString().split('T')[0])
          ).then(({ data }) => {
            const total = data?.reduce((s, r) => s + (Number(r.cantitate_kg) || 0), 0) || 0
            return total > 0 ? `Recoltat luna: ${total}kg` : ''
          }).catch(() => '')
        )
      }

      if (keywords.comenzi) {
        queryPromises.push(
          Promise.resolve(
            supabase
              .from('comenzi')
              .select('status')
              .eq('tenant_id', tenantId)
          ).then(({ data }) => {
            if (!data?.length) return ''
            const counts: Record<string, number> = {}
            for (const c of data) counts[c.status] = (counts[c.status] || 0) + 1
            return `Comenzi: ${Object.entries(counts)
              .map(([s, n]) => `${n} ${s}`)
              .join(', ')}`
          }).catch(() => '')
        )
      }

      if (keywords.stocuri) {
        queryPromises.push(
          Promise.resolve(
            supabase
              .from('miscari_stoc')
              .select('produs, cantitate_kg, tip_miscare')
              .eq('tenant_id', tenantId)
              .order('created_at', { ascending: false })
              .limit(3)
          ).then(({ data }) =>
            data?.length ? `Stoc: ${data.map((s) => `${s.produs} ${s.cantitate_kg}kg`).join('; ')}` : ''
          ).catch(() => '')
        )
      }

      if (queryPromises.length > 0) {
        const results = await Promise.all(queryPromises)
        keywordContext = results.filter(Boolean).join(' | ').substring(0, 400)
      }
    }

    // --- Min context (counts) ---
    let minContext = ''
    if (tenantId) {
      const [parcelaRes, comenziRes] = await Promise.allSettled([
        supabase.from('parcele').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId),
        supabase.from('comenzi').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId),
      ])
      minContext = [
        parcelaRes.status === 'fulfilled' ? `${parcelaRes.value.count ?? 0} parcele` : '',
        comenziRes.status === 'fulfilled' ? `${comenziRes.value.count ?? 0} comenzi` : '',
      ]
        .filter(Boolean)
        .join(', ')
    }

    const hasKeywordIntent =
      keywords.tratament || keywords.client || keywords.cheltuieli || keywords.recoltare || keywords.comenzi || keywords.stocuri
    const isSimpleRequest = hasCreateLikeIntent || hasKeywordIntent || lastMsg.length < 120
    const activeModel = isSimpleRequest && SIMPLE_MODEL_NAME ? SIMPLE_MODEL_NAME : MODEL_NAME
    const includeMemory = shouldUseConversationMemory(lastMsg)
    const memoryForPrompt = includeMemory
      ? await loadRecentConversationMemory({
          supabase,
          userId,
          tenantId,
          pathname,
        })
      : ''

    const context = [minContext, keywordContext].filter(Boolean).join(' | ').substring(0, 300)
    const systemPrompt = buildSystemPrompt({ today, yesterday, pathname, context, memory: memoryForPrompt })

    // --- Call LLM ---
    let text: string
    try {
      console.error('[ai-chat]', { event: 'llm_fallback', input: effectiveMessage.slice(0, 100) })
      const requestOptions = {
        model: google(activeModel),
        system: systemPrompt,
        messages: [{ role: 'user' as const, content: effectiveMessage.slice(0, MAX_MSG_CHARS) }],
        maxTokens: MAX_OUTPUT_TOKENS,
        ...(isSimpleRequest
          ? { providerOptions: { google: { thinkingConfig: { thinkingBudget: 0 } } } }
          : {}),
      }
      let result: Awaited<ReturnType<typeof generateText>>
      try {
        result = await deps.generateText(requestOptions)
      } catch (firstErr) {
        const errMsg = firstErr instanceof Error ? firstErr.message : String(firstErr)
        const likelyProviderOptionIssue =
          isSimpleRequest &&
          /(thinking|providerOptions|thinkingConfig|budget|unknown|invalid)/i.test(errMsg)

        if (!likelyProviderOptionIssue) throw firstErr

        const fallbackOptions = { ...requestOptions }
        delete fallbackOptions.providerOptions
        result = await deps.generateText(fallbackOptions)
      }

      text = result.text || ''

      if (USAGE_LOG_ENABLED) {
        const usage = extractUsageStats(result)
        console.info(
          '[chat] usage',
          JSON.stringify({
            model: activeModel,
            simpleRequest: isSimpleRequest,
            inputTokens: usage.inputTokens,
            outputTokens: usage.outputTokens,
            reasoningTokens: usage.reasoningTokens,
            totalTokens: usage.totalTokens,
          })
        )
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[chat] generateText error:', msg)
      return jsonAnswerTracked(
        'Eroare la răspuns. Încearcă din nou.',
        {
          decisionMode: 'llm_fallback',
          clarificationKind: 'generic_fallback',
          flowFinalState: 'error',
          llmUsed: true,
        },
        'failed'
      )
    }

    // --- Check if LLM returned a form JSON (handles nested objects) ---
    const { validAction, hasInvalidOpenFormPayload } = resolveOpenFormActionFromText(text)
    if (validAction) {
      return jsonFormWithMemory(
        {
          form: validAction.form,
          prefill: validAction.prefill,
          message: validAction.message,
        },
        {
          flowSelected: validAction.form,
          decisionMode: 'llm_fallback',
          flowFinalState: 'open_form',
          llmUsed: true,
        }
      )
    }

    if (hasInvalidOpenFormPayload) {
      text = 'Am înțeles cererea, dar am nevoie de detalii clare ca să pregătesc formularul corect. Verifică: suma, categorie, dată, sau alte câmpuri obligatorii.'
      return jsonAnswerWithMemory(
        text,
        {
          decisionMode: 'llm_fallback',
          clarificationKind: 'generic_fallback',
          flowFinalState: 'clarify',
          llmUsed: true,
        }
      )
    }
    return jsonAnswerWithMemory(
      text,
      {
        decisionMode: 'llm_fallback',
        flowFinalState: 'fallback',
        clarificationKind: 'none',
        llmUsed: true,
      }
    )
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : JSON.stringify(error)
    console.error('[chat] EROARE:', msg)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
}


