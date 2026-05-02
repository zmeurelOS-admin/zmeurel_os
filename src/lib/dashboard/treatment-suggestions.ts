import type {
  AplicareCrossParcelItem,
  InterventieProdusV2,
  InterventieRelevantaV2,
} from '@/lib/supabase/queries/tratamente'
import type { MeteoZi } from '@/lib/tratamente/meteo'
const BUCHAREST_TIMEZONE = 'Europe/Bucharest'

export type DashboardTreatmentSuggestionStatus =
  | 'overdue'
  | 'today'
  | 'soon'
  | 'blocked'
  | 'weather_wait'

export type DashboardTreatmentSuggestionWarning =
  | 'phi'
  | 'pauza'
  | 'meteo'
  | 'missingStage'

export interface DashboardTreatmentSuggestion {
  parcelaId: string
  parcelaLabel: string
  aplicareId: string | null
  planLabel: string | null
  interventieLabel: string | null
  produsLabel: string
  status: DashboardTreatmentSuggestionStatus
  recommendedDate: string | null
  firstSafeWindowLabel: string | null
  reason: string
  warnings: DashboardTreatmentSuggestionWarning[]
}

export interface DashboardTreatmentSuggestionsPayload {
  primary: DashboardTreatmentSuggestion | null
  secondary: DashboardTreatmentSuggestion | null
}

type SuggestionInput = {
  now: Date
  parcelaLabels?: Map<string, string> | Record<string, string>
  aplicari: AplicareCrossParcelItem[]
  interventiiRelevante: InterventieRelevantaV2[]
  meteoByParcelaId?: Map<string, MeteoZi | null> | Record<string, MeteoZi | null>
}

type CandidateProduct = {
  produsId: string | null
  produsLabel: string
  intervalMinAplicariZile: number | null
}

type BaseCandidateKind = 'overdue' | 'today' | 'soon'

type BaseCandidate = {
  source: 'aplicare' | 'interventie'
  key: string
  parcelaId: string
  parcelaLabel: string
  aplicareId: string | null
  planLabel: string | null
  interventieLabel: string | null
  produsLabel: string
  recommendedDate: string
  kind: BaseCandidateKind
  basePriority: number
  reasonBase: string
  products: CandidateProduct[]
  phiWarning: boolean
}

function toBucharestDateKey(value: Date): string {
  return value.toLocaleDateString('en-CA', { timeZone: BUCHAREST_TIMEZONE })
}

function addUtcDays(value: Date, days: number): Date {
  const next = new Date(value)
  next.setUTCDate(next.getUTCDate() + days)
  return next
}

function addDaysToDateKey(dateKey: string, days: number): string | null {
  if (!dateKey) return null
  const parsed = new Date(`${dateKey}T12:00:00.000Z`)
  if (Number.isNaN(parsed.getTime())) return null
  parsed.setUTCDate(parsed.getUTCDate() + days)
  return parsed.toISOString().slice(0, 10)
}

function formatWindowLabel(startIso: string, endIso: string): string {
  const formatter = new Intl.DateTimeFormat('ro-RO', {
    timeZone: BUCHAREST_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
  })

  return `${formatter.format(new Date(startIso))}-${formatter.format(new Date(endIso))}`
}

function toMap<T>(value?: Map<string, T> | Record<string, T>): Map<string, T> {
  if (value instanceof Map) return value
  return new Map(Object.entries(value ?? {}))
}

function normalizePositiveNumber(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null
}

function getParcelaLabel(parcelaId: string, labels: Map<string, string>, fallback?: string | null): string {
  return labels.get(parcelaId) ?? fallback?.trim() ?? 'Parcelă'
}

function getFirstNonEmpty(...values: Array<string | null | undefined>): string | null {
  for (const value of values) {
    const normalized = value?.trim()
    if (normalized) return normalized
  }
  return null
}

function toProductLabel(firstLabel: string | null, count: number): string {
  const label = firstLabel ?? 'Produs nespecificat'
  return count > 1 ? `${label} +${count - 1}` : label
}

function getCandidateProductsFromPlanProducts(produse: InterventieProdusV2[]): CandidateProduct[] {
  return produse.map((produs) => ({
    produsId: produs.produs_id ?? null,
    produsLabel:
      getFirstNonEmpty(
        produs.produs?.nume_comercial,
        produs.produs_nume_snapshot,
        produs.produs_nume_manual,
      ) ?? 'Produs nespecificat',
    intervalMinAplicariZile: normalizePositiveNumber(produs.produs?.interval_min_aplicari_zile),
  }))
}

function getCandidateProductsFromAplicare(aplicare: AplicareCrossParcelItem): CandidateProduct[] {
  if (aplicare.produse_planificate.length > 0) {
    return getCandidateProductsFromPlanProducts(aplicare.produse_planificate)
  }

  return [
    {
      produsId: aplicare.produs_id ?? null,
      produsLabel: aplicare.produs_nume,
      intervalMinAplicariZile: null,
    },
  ]
}

function buildLastAppliedProductMap(aplicari: AplicareCrossParcelItem[]): Map<string, string> {
  const map = new Map<string, string>()

  for (const aplicare of aplicari) {
    if (aplicare.status !== 'aplicata') continue
    const appliedDate = (aplicare.data_aplicata ?? aplicare.data_planificata ?? '').slice(0, 10)
    if (!appliedDate) continue

    const productIds =
      aplicare.produse_aplicare.length > 0
        ? aplicare.produse_aplicare.map((produs) => produs.produs_id).filter(Boolean)
        : aplicare.produs_id
          ? [aplicare.produs_id]
          : []

    for (const productId of productIds) {
      const key = `${aplicare.parcela_id}:${productId}`
      const previous = map.get(key)
      if (!previous || previous < appliedDate) {
        map.set(key, appliedDate)
      }
    }
  }

  return map
}

function buildAplicareBaseReason(aplicare: AplicareCrossParcelItem, kind: BaseCandidateKind, todayKey: string): string {
  if (kind === 'overdue') {
    return `Aplicarea planificată pentru ${aplicare.data_programata ?? todayKey} este depășită.`
  }

  if (kind === 'today') {
    return 'Aplicarea este planificată azi.'
  }

  if (aplicare.data_programata === todayKey) {
    return 'Aplicarea este planificată azi.'
  }

  return `Aplicarea este planificată pentru ${aplicare.data_programata ?? 'următoarele zile'}.`
}

function collectBaseCandidates(input: SuggestionInput): BaseCandidate[] {
  const parcelaLabels = toMap(input.parcelaLabels)
  const todayKey = toBucharestDateKey(input.now)
  const sevenDayEndKey = toBucharestDateKey(addUtcDays(input.now, 7))
  const candidates: BaseCandidate[] = []

  for (const aplicare of input.aplicari) {
    if (aplicare.status !== 'planificata' && aplicare.status !== 'reprogramata') continue

    const recommendedDate = (aplicare.data_programata ?? aplicare.data_planificata ?? '').slice(0, 10)
    if (!recommendedDate) continue

    let kind: BaseCandidateKind | null = null
    let basePriority = 0

    if (recommendedDate < todayKey) {
      kind = 'overdue'
      basePriority = 0
    } else if (recommendedDate === todayKey) {
      kind = 'today'
      basePriority = 1
    } else if (recommendedDate <= sevenDayEndKey) {
      kind = 'soon'
      basePriority = 2
    }

    if (!kind) continue

    candidates.push({
      source: 'aplicare',
      key: `aplicare:${aplicare.id}`,
      parcelaId: aplicare.parcela_id,
      parcelaLabel: getParcelaLabel(aplicare.parcela_id, parcelaLabels, aplicare.parcela_nume),
      aplicareId: aplicare.id,
      planLabel: aplicare.plan_nume ?? null,
      interventieLabel:
        getFirstNonEmpty(aplicare.scop, aplicare.tip_interventie, aplicare.produs_nume) ?? 'Aplicare planificată',
      produsLabel: aplicare.produs_nume,
      recommendedDate,
      kind,
      basePriority,
      reasonBase: buildAplicareBaseReason(aplicare, kind, todayKey),
      products: getCandidateProductsFromAplicare(aplicare),
      phiWarning: aplicare.phi_warning,
    })
  }

  for (const interventie of input.interventiiRelevante) {
    if (interventie.aplicare_planificata?.id) continue
    if (!interventie.fenofaza_curenta?.stadiu) continue
    if (
      interventie.status_operational !== 'intarziata' &&
      interventie.status_operational !== 'de_facut_azi' &&
      interventie.status_operational !== 'urmeaza'
    ) {
      continue
    }

    const recommendedDate = (interventie.urmatoarea_data_estimata ?? '').slice(0, 10)
    if (!recommendedDate) continue

    let kind: BaseCandidateKind | null = null
    if (recommendedDate < todayKey) kind = 'overdue'
    else if (recommendedDate === todayKey) kind = 'today'
    else if (recommendedDate <= sevenDayEndKey) kind = 'soon'
    if (!kind) continue

    candidates.push({
      source: 'interventie',
      key: `interventie:${interventie.parcela_id}:${interventie.interventie.id}:${interventie.fenofaza_curenta.cohort ?? 'single'}`,
      parcelaId: interventie.parcela_id,
      parcelaLabel: getParcelaLabel(interventie.parcela_id, parcelaLabels, interventie.parcela_nume),
      aplicareId: null,
      planLabel: interventie.plan.nume ?? null,
      interventieLabel:
        getFirstNonEmpty(
          interventie.interventie.scop,
          interventie.interventie.tip_interventie,
        ) ?? 'Intervenție relevantă',
      produsLabel: toProductLabel(
        getFirstNonEmpty(
          interventie.produse_planificate[0]?.produs?.nume_comercial,
          interventie.produse_planificate[0]?.produs_nume_snapshot,
          interventie.produse_planificate[0]?.produs_nume_manual,
        ),
        interventie.produse_planificate.length,
      ),
      recommendedDate,
      kind,
      basePriority: 3,
      reasonBase: interventie.motiv,
      products: getCandidateProductsFromPlanProducts(interventie.produse_planificate),
      phiWarning: false,
    })
  }

  return candidates.sort((left, right) => {
    if (left.basePriority !== right.basePriority) return left.basePriority - right.basePriority
    if (left.recommendedDate !== right.recommendedDate) return left.recommendedDate.localeCompare(right.recommendedDate)
    return left.key.localeCompare(right.key)
  })
}

function buildPauseWarning(
  candidate: BaseCandidate,
  lastAppliedByProduct: Map<string, string>,
): { blocked: boolean; warning: DashboardTreatmentSuggestionWarning | null } {
  for (const product of candidate.products) {
    if (!product.produsId || !product.intervalMinAplicariZile) continue
    const lastApplied = lastAppliedByProduct.get(`${candidate.parcelaId}:${product.produsId}`)
    if (!lastApplied) continue
    const firstSafeDate = addDaysToDateKey(lastApplied, product.intervalMinAplicariZile)
    if (firstSafeDate && candidate.recommendedDate < firstSafeDate) {
      return { blocked: true, warning: 'pauza' }
    }
  }

  return { blocked: false, warning: null }
}

function buildWeatherResult(
  candidate: BaseCandidate,
  now: Date,
  meteoByParcelaId: Map<string, MeteoZi | null>,
): {
  shouldCheck: boolean
  missingWeather: boolean
  hasSafeWindow: boolean
  firstSafeWindowLabel: string | null
} {
  const todayKey = toBucharestDateKey(now)
  const twoDayEndKey = toBucharestDateKey(addUtcDays(now, 2))
  const shouldCheck = candidate.recommendedDate >= todayKey && candidate.recommendedDate <= twoDayEndKey
  if (!shouldCheck) {
    return {
      shouldCheck: false,
      missingWeather: false,
      hasSafeWindow: false,
      firstSafeWindowLabel: null,
    }
  }

  const meteoZi = meteoByParcelaId.get(candidate.parcelaId)
  if (!meteoZi) {
    return {
      shouldCheck: true,
      missingWeather: true,
      hasSafeWindow: false,
      firstSafeWindowLabel: null,
    }
  }

  const firstSafeWindow = meteoZi.ferestre_24h.find((slot) => slot.safe)
  return {
    shouldCheck: true,
    missingWeather: false,
    hasSafeWindow: Boolean(firstSafeWindow),
    firstSafeWindowLabel: firstSafeWindow
      ? formatWindowLabel(firstSafeWindow.ora_start, firstSafeWindow.ora_end)
      : null,
  }
}

function finalizeReason(params: {
  baseReason: string
  warnings: DashboardTreatmentSuggestionWarning[]
  blockedByPhi: boolean
  blockedByPause: boolean
  missingWeather: boolean
  weatherWait: boolean
  firstSafeWindowLabel: string | null
}): string {
  if (params.blockedByPhi && params.blockedByPause) {
    return `${params.baseReason} PHI-ul și pauza minimă dintre aplicări blochează intervenția.`
  }

  if (params.blockedByPhi) {
    return `${params.baseReason} PHI-ul este încă activ.`
  }

  if (params.blockedByPause) {
    return `${params.baseReason} Pauza minimă dintre aplicări este încă activă.`
  }

  if (params.weatherWait) {
    return `${params.baseReason} Nu există încă o fereastră meteo sigură în următoarele 24h.`
  }

  if (params.missingWeather) {
    return `${params.baseReason} Fereastra meteo nu poate fi confirmată acum.`
  }

  if (params.firstSafeWindowLabel) {
    return `${params.baseReason} Prima fereastră meteo sigură: ${params.firstSafeWindowLabel}.`
  }

  if (params.warnings.includes('missingStage')) {
    return `${params.baseReason} Fenofaza curentă nu este confirmată.`
  }

  return params.baseReason
}

function toStatus(kind: BaseCandidateKind): Exclude<DashboardTreatmentSuggestionStatus, 'blocked' | 'weather_wait'> {
  if (kind === 'overdue') return 'overdue'
  if (kind === 'today') return 'today'
  return 'soon'
}

function statusPenalty(status: DashboardTreatmentSuggestionStatus): number {
  if (status === 'weather_wait') return 1
  if (status === 'blocked') return 2
  return 0
}

function finalizeCandidate(
  candidate: BaseCandidate,
  input: SuggestionInput,
  lastAppliedByProduct: Map<string, string>,
): DashboardTreatmentSuggestion {
  const warnings = new Set<DashboardTreatmentSuggestionWarning>()
  if (candidate.phiWarning) warnings.add('phi')

  const pause = buildPauseWarning(candidate, lastAppliedByProduct)
  if (pause.warning) warnings.add(pause.warning)

  const weather = buildWeatherResult(candidate, input.now, toMap(input.meteoByParcelaId))
  if (weather.shouldCheck && (!weather.hasSafeWindow || weather.missingWeather)) {
    warnings.add('meteo')
  }

  const blockedByPhi = candidate.phiWarning
  const blockedByPause = pause.blocked
  const blocked = blockedByPhi || blockedByPause

  let status: DashboardTreatmentSuggestionStatus = toStatus(candidate.kind)
  if (blocked) {
    status = 'blocked'
  } else if (weather.shouldCheck && !weather.missingWeather && !weather.hasSafeWindow) {
    status = 'weather_wait'
  }

  return {
    parcelaId: candidate.parcelaId,
    parcelaLabel: candidate.parcelaLabel,
    aplicareId: candidate.aplicareId,
    planLabel: candidate.planLabel,
    interventieLabel: candidate.interventieLabel,
    produsLabel: candidate.produsLabel,
    status,
    recommendedDate: candidate.recommendedDate,
    firstSafeWindowLabel: weather.firstSafeWindowLabel,
    reason: finalizeReason({
      baseReason: candidate.reasonBase,
      warnings: [...warnings],
      blockedByPhi,
      blockedByPause,
      missingWeather: weather.missingWeather,
      weatherWait: status === 'weather_wait',
      firstSafeWindowLabel: weather.firstSafeWindowLabel,
    }),
    warnings: [...warnings],
  }
}

export function collectWeatherEligibleParcelaIds(input: SuggestionInput): string[] {
  const seen = new Set<string>()
  const todayKey = toBucharestDateKey(input.now)
  const twoDayEndKey = toBucharestDateKey(addUtcDays(input.now, 2))

  for (const candidate of collectBaseCandidates(input)) {
    if (candidate.recommendedDate < todayKey || candidate.recommendedDate > twoDayEndKey) continue
    seen.add(candidate.parcelaId)
  }

  return [...seen]
}

export function buildDashboardTreatmentSuggestions(
  input: SuggestionInput,
): DashboardTreatmentSuggestionsPayload {
  const lastAppliedByProduct = buildLastAppliedProductMap(input.aplicari)

  const suggestions = collectBaseCandidates(input)
    .map((candidate) => ({
      suggestion: finalizeCandidate(candidate, input, lastAppliedByProduct),
      basePriority: candidate.basePriority,
    }))
    .sort((left, right) => {
      if (left.basePriority !== right.basePriority) return left.basePriority - right.basePriority
      if (statusPenalty(left.suggestion.status) !== statusPenalty(right.suggestion.status)) {
        return statusPenalty(left.suggestion.status) - statusPenalty(right.suggestion.status)
      }
      if ((left.suggestion.recommendedDate ?? '') !== (right.suggestion.recommendedDate ?? '')) {
        return (left.suggestion.recommendedDate ?? '').localeCompare(right.suggestion.recommendedDate ?? '')
      }
      return left.suggestion.parcelaLabel.localeCompare(right.suggestion.parcelaLabel, 'ro')
    })
    .map((entry) => entry.suggestion)

  return {
    primary: suggestions[0] ?? null,
    secondary: suggestions[1] ?? null,
  }
}
