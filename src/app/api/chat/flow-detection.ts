import { detectCreationIntentRo } from './contract-helpers'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Tables } from '@/types/supabase'
import {
  hasActivitySignalRo,
  hasClientSignalRo,
  hasFinancialCostSignalRo,
  hasHarvestSignalRo,
  hasInvestmentSignalRo,
  hasOrderSignalRo,
} from './signal-detectors'
import {
  levenshteinDistance,
  normalizeForMatch,
} from './utils'

export type ActiveFlow = 'recoltare' | 'activitate' | 'cheltuiala' | 'investitie' | 'comanda' | 'client' | null
export type FlowKey = Exclude<ActiveFlow, null>

export interface CanonicalCandidates {
  parcele: string[]
  parcelaAliasToCanonical: Record<string, string[]>
  parcelaById: Record<string, { id: string; label: string; aliases: string[] }>
  parcelaOptions: Array<{ id: string; label: string; aliases: string[] }>
  clienti: string[]
  clientNameToId: Record<string, string>
  clientNameToPhone: Record<string, string>
  clientById: Record<string, { id: string; label: string; phone?: string; negotiatedPricePerKg?: number }>
  clientOptions: Array<{ id: string; label: string }>
  produseComanda: string[]
  produseActivitate: string[]
}

type CanonicalCandidatesSupabaseClient = SupabaseClient<Database>

export const FLOW_KEYS: readonly FlowKey[] = ['recoltare', 'activitate', 'cheltuiala', 'investitie', 'comanda', 'client']

export const REQUIRED_FIELDS_FOR_OPEN: Record<FlowKey, readonly string[]> = {
  activitate: ['tip', 'data'],
  recoltare: ['parcela', 'data'],
  cheltuiala: ['suma', 'data', 'categorie'],
  investitie: ['suma', 'data', 'categorie'],
  comanda: ['nume_client', 'cantitate_kg', 'data_livrare'],
  client: ['nume_client'],
}

export const REQUIRED_FIELDS_FOR_SAVE_HINT: Record<FlowKey, readonly string[]> = {
  activitate: [],
  recoltare: ['culegator_id'],
  cheltuiala: [],
  investitie: [],
  comanda: ['pret_per_kg'],
  client: [],
}

function isFlowKey(value: string): value is FlowKey {
  return FLOW_KEYS.includes(value as FlowKey)
}

function isPositiveNumber(value: unknown): boolean {
  if (typeof value === 'number') return Number.isFinite(value) && value > 0
  if (typeof value === 'string') {
    const parsed = Number(value.replace(',', '.'))
    return Number.isFinite(parsed) && parsed > 0
  }
  return false
}

export function isStructuredTargetedFlow(value: string | null | undefined): value is 'recoltare' | 'activitate' | 'comanda' {
  return value === 'recoltare' || value === 'activitate' || value === 'comanda'
}

export function detectActiveFlow(text: string): ActiveFlow {
  const t = text.toLowerCase()
  if (/(recoltare|recoltat|am recoltat|am cules|culegere)/i.test(t)) return 'recoltare'
  if (/(activitate|stropit|erbicidat|fertirigat|fertilizat|irigat|copilit|palisat|t[ăa]iat|tratat)/i.test(t)) return 'activitate'
  if (/(cheltuial|am pl[ăa]tit|factur[aă]|bon|sum[aă].*lei|motorin[aă])/i.test(t)) return 'cheltuiala'
  if (/(investi[țt]ie|investitie|capex|utilaj|instala[țt]ie|sistem)/i.test(t)) return 'investitie'
  if (/(comand[aă]|livrare|data_livrare)/i.test(t)) return 'comanda'
  if (/(client nou|clientul nou|nume_client|cum se nume[șs]te clientul|formularul de client|\bclient\b)/i.test(t)) return 'client'
  return null
}

export function detectStrongFlowIntent(message: string): ActiveFlow {
  const msg = message.trim()
  if (!msg) return null

  const hasCreationIntent = detectCreationIntentRo(msg)
  const harvestIntent = hasHarvestSignalRo(msg)
  const activityIntent = hasActivitySignalRo(msg)
  const orderIntent = hasOrderSignalRo(msg)
  const clientIntent = hasClientSignalRo(msg)
  const investmentIntent = hasInvestmentSignalRo(msg)
  const costIntent = hasFinancialCostSignalRo(msg)

  if (orderIntent && (hasCreationIntent || /\bcomand[aă]\b/i.test(msg))) return 'comanda'
  if (clientIntent && (hasCreationIntent || /\bclient\b/i.test(msg))) return 'client'
  if (investmentIntent && (hasCreationIntent || /\binvesti[țt]ie\b/i.test(msg))) return 'investitie'
  if (harvestIntent && (hasCreationIntent || /\brecoltare|recoltat|cules\b/i.test(msg))) return 'recoltare'
  if (activityIntent && (hasCreationIntent || /\bactivitat|stropit|irigat|erbicidat|tratament\b/i.test(msg))) return 'activitate'
  if (costIntent && (hasCreationIntent || /\bcheltuial[aă]\b/i.test(msg))) return 'cheltuiala'

  return null
}

export function getRequiredSaveHintFields(form: string): readonly string[] {
  if (!isFlowKey(form)) return REQUIRED_FIELDS_FOR_SAVE_HINT.client
  return REQUIRED_FIELDS_FOR_SAVE_HINT[form]
}

export function getFlowFriendlyMessage(form: FlowKey, prefill: Record<string, unknown>): string {
  if (form === 'recoltare') {
    const hasParcela =
      (typeof prefill.parcela_label === 'string' && prefill.parcela_label.trim().length > 0) ||
      (typeof prefill.parcela === 'string' && prefill.parcela.trim().length > 0)
    const hasData = typeof prefill.data === 'string' && prefill.data.trim().length > 0
    const context =
      hasParcela && hasData
        ? ' cu parcela și data'
        : hasParcela
          ? ' cu parcela'
          : hasData
            ? ' cu data'
            : ''

    if (REQUIRED_FIELDS_FOR_SAVE_HINT.recoltare.includes('culegator_id')) {
      return `Am înțeles, îți pregătesc formularul de recoltare${context}. Mai trebuie doar să alegi culegătorul înainte de salvare.`
    }
    return `Am înțeles, îți pregătesc formularul de recoltare${context}. Verifică și salvează.`
  }

  if (form === 'comanda') {
    const clientLabel =
      typeof prefill.client_label === 'string' && prefill.client_label.trim().length > 0
        ? prefill.client_label
        : typeof prefill.nume_client === 'string' && prefill.nume_client.trim().length > 0
          ? prefill.nume_client
          : ''
    const client = clientLabel ? ` pentru ${clientLabel}` : ''
    if (REQUIRED_FIELDS_FOR_SAVE_HINT.comanda.includes('pret_per_kg') && !isPositiveNumber(prefill.pret_per_kg)) {
      return `Am înțeles, îți pregătesc formularul de comandă${client}. Mai completează prețul/kg înainte de salvare.`
    }
    return `Am înțeles, îți pregătesc formularul de comandă${client}. Verifică și salvează.`
  }

  if (form === 'activitate') return 'Am înțeles, îți pregătesc formularul de activitate agricolă. Verifică și salvează.'
  if (form === 'cheltuiala') return 'Am înțeles, îți pregătesc formularul de cheltuială. Verifică și salvează.'
  if (form === 'investitie') return 'Am înțeles, îți pregătesc formularul de investiție. Verifică și salvează.'
  return 'Am înțeles, îți pregătesc formularul de client. Verifică și salvează.'
}

export function resolveCanonicalValue(
  raw: string | undefined,
  candidates: string[]
): { match: string | null; ambiguous: string[]; hasCandidates: boolean } {
  const value = (raw ?? '').trim()
  if (!value) return { match: null, ambiguous: [], hasCandidates: candidates.length > 0 }

  const normalizedRaw = normalizeForMatch(value)
  const uniqueByNormalized = new Map<string, string>()
  for (const candidate of candidates.map((c) => c.trim()).filter(Boolean)) {
    const normalized = normalizeForMatch(candidate)
    if (!normalized) continue
    if (!uniqueByNormalized.has(normalized)) {
      uniqueByNormalized.set(normalized, candidate)
    }
  }
  const uniqueCandidates = Array.from(uniqueByNormalized.values())
  if (!uniqueCandidates.length) return { match: null, ambiguous: [], hasCandidates: false }

  const exact = uniqueCandidates.find((candidate) => normalizeForMatch(candidate) === normalizedRaw)
  if (exact) return { match: exact, ambiguous: [], hasCandidates: true }

  const prefixMatches = uniqueCandidates.filter((candidate) => {
    const n = normalizeForMatch(candidate)
    return n.startsWith(normalizedRaw) || normalizedRaw.startsWith(n)
  })
  if (prefixMatches.length === 1) return { match: prefixMatches[0], ambiguous: [], hasCandidates: true }
  if (prefixMatches.length > 1) return { match: null, ambiguous: prefixMatches.slice(0, 2), hasCandidates: true }

  const scored = uniqueCandidates
    .map((candidate) => ({ candidate, score: levenshteinDistance(normalizedRaw, normalizeForMatch(candidate)) }))
    .filter((x) => x.score <= 2)
    .sort((a, b) => a.score - b.score)

  if (!scored.length) return { match: null, ambiguous: [], hasCandidates: true }
  if (scored.length === 1) return { match: scored[0].candidate, ambiguous: [], hasCandidates: true }
  if (scored[0].score < scored[1].score) return { match: scored[0].candidate, ambiguous: [], hasCandidates: true }

  return {
    match: null,
    ambiguous: scored.filter((x) => x.score === scored[0].score).map((x) => x.candidate).slice(0, 2),
    hasCandidates: true,
  }
}

export function resolveCanonicalProduct(raw: string | null | undefined, candidates: string[]): string | undefined {
  const normalized = normalizeForMatch(raw ?? '')
  if (!normalized) return undefined
  return candidates.find((candidate) => normalizeForMatch(candidate) === normalized)?.trim()
}

export async function loadCanonicalCandidates(params: {
  supabase: CanonicalCandidatesSupabaseClient
  tenantId: string | null
}): Promise<CanonicalCandidates> {
  const { supabase, tenantId } = params
  if (!tenantId) {
    return {
      parcele: [],
      parcelaAliasToCanonical: {},
      parcelaById: {},
      parcelaOptions: [],
      clienti: [],
      clientNameToId: {},
      clientNameToPhone: {},
      clientById: {},
      clientOptions: [],
      produseComanda: [],
      produseActivitate: [],
    }
  }

  try {
    const [parceleRes, clientiRes, activitatiRes, miscariStocRes] = await Promise.all([
      supabase.from('parcele').select('id,nume,nume_parcela,soi,soi_plantat,cultura,tip_fruct').eq('tenant_id', tenantId).limit(200),
      supabase.from('clienti').select('id,nume_client').eq('tenant_id', tenantId).limit(200),
      supabase.from('activitati_agricole').select('produs_utilizat').eq('tenant_id', tenantId).limit(200),
      supabase.from('miscari_stoc').select('produs').eq('tenant_id', tenantId).limit(200),
    ])

    const parcelaAliasToCanonical: Record<string, string[]> = {}
    const parcelaById: Record<string, { id: string; label: string; aliases: string[] }> = {}
    const parcelaOptions: Array<{ id: string; label: string; aliases: string[] }> = []
    const parcelaCandidates = new Set<string>()
    const decorateRegex = /\s*\((camp|c[aâ]mp|solar|solariu|sera|livada|livad[aă]|cultura(?:\s+mare)?)\)\s*$/i

    for (const row of (parceleRes.data ?? []) as Array<{
      id?: string | null
      nume?: string | null
      nume_parcela?: string | null
      soi?: string | null
      soi_plantat?: string | null
      cultura?: string | null
      tip_fruct?: string | null
    }>) {
      const id = (row.id ?? '').trim()
      const canonical = (row.nume_parcela ?? row.nume ?? '').trim()
      if (!canonical || !id) continue

      const aliases = new Set<string>()
      aliases.add(canonical)
      aliases.add(canonical.replace(decorateRegex, '').trim())
      for (const extra of [row.soi_plantat, row.soi, row.cultura, row.tip_fruct]) {
        const value = (extra ?? '').trim()
        if (value) aliases.add(value)
      }

      for (const alias of aliases) {
        const cleaned = alias.trim()
        if (!cleaned) continue
        parcelaCandidates.add(cleaned)
        if (!parcelaAliasToCanonical[cleaned]) parcelaAliasToCanonical[cleaned] = []
        if (!parcelaAliasToCanonical[cleaned].includes(canonical)) {
          parcelaAliasToCanonical[cleaned].push(canonical)
        }
      }

      const aliasList = Array.from(aliases).map((value) => value.trim()).filter(Boolean)
      parcelaById[id] = { id, label: canonical, aliases: aliasList }
      parcelaOptions.push({ id, label: canonical, aliases: aliasList })
    }

    const clientiRows = (clientiRes.data ?? []) as Array<{
      id?: string | null
      nume_client?: string | null
    }>
    const clientNameToId: Record<string, string> = {}
    const clientNameToPhone: Record<string, string> = {}
    const clientById: Record<string, { id: string; label: string; phone?: string; negotiatedPricePerKg?: number }> = {}
    const clientOptions: Array<{ id: string; label: string }> = []
    for (const row of clientiRows) {
      const name = (row.nume_client ?? '').trim()
      const id = (row.id ?? '').trim()
      if (!name || !id) continue
      clientNameToId[name] = id
      clientById[id] = {
        id,
        label: name,
      }
      clientOptions.push({ id, label: name })
    }

    return {
      parcele: Array.from(parcelaCandidates),
      parcelaAliasToCanonical,
      parcelaById,
      parcelaOptions,
      clienti: clientiRows.map((r) => r.nume_client ?? '').filter(Boolean),
      clientNameToId,
      clientNameToPhone,
      clientById,
      clientOptions,
      produseComanda: Array.from(
        new Set(
          [
            ...((miscariStocRes.data ?? []) as Array<Pick<Tables<'miscari_stoc'>, 'produs'>>).map((r) => r.produs ?? ''),
          ].map((v) => v.trim()).filter(Boolean)
        )
      ),
      produseActivitate: Array.from(
        new Set(
          [
            ...((activitatiRes.data ?? []) as Array<Pick<Tables<'activitati_agricole'>, 'produs_utilizat'>>).map((r) => r.produs_utilizat ?? ''),
            ...((miscariStocRes.data ?? []) as Array<Pick<Tables<'miscari_stoc'>, 'produs'>>).map((r) => r.produs ?? ''),
          ].map((v) => v.trim()).filter(Boolean)
        )
      ),
    }
  } catch {
    return {
      parcele: [],
      parcelaAliasToCanonical: {},
      parcelaById: {},
      parcelaOptions: [],
      clienti: [],
      clientNameToId: {},
      clientNameToPhone: {},
      clientById: {},
      clientOptions: [],
      produseComanda: [],
      produseActivitate: [],
    }
  }
}
