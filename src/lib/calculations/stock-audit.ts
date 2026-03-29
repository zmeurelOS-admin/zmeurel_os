import {
  STOCK_AUDIT_ADJUSTMENT_SHARE_THRESHOLD,
  STOCK_AUDIT_LOW_STOCK_THRESHOLD_KG,
  STOCK_AUDIT_MIN_ADJUSTMENT_ABS_THRESHOLD_KG,
  STOCK_AUDIT_NEGATIVE_STOCK_EPSILON_KG,
  STOCK_AUDIT_SYNC_DELTA_THRESHOLD_KG,
} from './stock-audit-thresholds'

export {
  STOCK_AUDIT_ADJUSTMENT_SHARE_THRESHOLD,
  STOCK_AUDIT_LOW_STOCK_THRESHOLD_KG,
  STOCK_AUDIT_MIN_ADJUSTMENT_ABS_THRESHOLD_KG,
  STOCK_AUDIT_NEGATIVE_STOCK_EPSILON_KG,
  STOCK_AUDIT_SYNC_DELTA_THRESHOLD_KG,
}

export type StockAuditSeverity = 'low' | 'medium' | 'high'
export type StockAuditDataHealth = 'complete' | 'missing_ledger_table' | 'ledger_query_failed'
export type StockAuditDegradedReason = 'missing_ledger_table' | 'ledger_query_failed' | 'ledger_empty_with_transactions' | null

export interface StockAuditRecoltareRow {
  parcela_id: string | null
  kg_cal1: number | null
  kg_cal2: number | null
}

export interface StockAuditVanzareRow {
  cantitate_kg: number | null
}

export interface StockAuditParcelaRow {
  id: string
  nume_parcela: string | null
}

export interface StockAuditMovementRow {
  locatie_id: string | null
  produs: string | null
  calitate: string | null
  depozit: string | null
  tip_miscare: string | null
  cantitate_kg: number | null
}

export interface StockAuditMetricRow {
  label: string
  value: number
  unit: string
  note: string
}

export interface StockAuditBucketIssue {
  key: string
  locatie: string
  produs: string
  calitate: string
  depozit: string
  currentKg: number
}

export interface StockAuditAnomaly {
  id: string
  severity: StockAuditSeverity
  title: string
  value: string
  description: string
}

export interface StockAuditRecommendation {
  id: string
  severity: StockAuditSeverity
  title: string
  description: string
}

export interface StockAuditSummary {
  status: 'ok' | 'warning' | 'critical'
  isDegraded: boolean
  degradedReason: StockAuditDegradedReason
  summary: string
  currentStockKg: number
  operationalBalanceKg: number
  harvestSyncDeltaKg: number
  salesSyncDeltaKg: number
  nonCoreMovementNetKg: number
  lowStockBucketsCount: number
  negativeStockBucketsCount: number
  anomaliesCount: number
  recommendationsCount: number
}

export interface StockAuditReport {
  summary: StockAuditSummary
  metrics: StockAuditMetricRow[]
  anomalies: StockAuditAnomaly[]
  recommendations: StockAuditRecommendation[]
  lowStockBuckets: StockAuditBucketIssue[]
  negativeStockBuckets: StockAuditBucketIssue[]
}

type StockMovementType =
  | 'recoltare'
  | 'vanzare'
  | 'consum'
  | 'oferit_gratuit'
  | 'procesare'
  | 'congelare'
  | 'pierdere'
  | 'ajustare'

const OUTFLOW_MOVEMENT_TYPES: ReadonlySet<StockMovementType> = new Set([
  'vanzare',
  'consum',
  'oferit_gratuit',
  'pierdere',
])

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

function normalizeNumber(value: number | null | undefined): number {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

function recoltareKg(row: StockAuditRecoltareRow): number {
  return round2(normalizeNumber(row.kg_cal1) + normalizeNumber(row.kg_cal2))
}

function signedMovementQty(row: StockAuditMovementRow): number {
  const qty = Math.max(0, normalizeNumber(row.cantitate_kg))
  const tip = (row.tip_miscare ?? '') as StockMovementType
  return OUTFLOW_MOVEMENT_TYPES.has(tip) ? -qty : qty
}

function severityRank(severity: StockAuditSeverity): number {
  if (severity === 'high') return 3
  if (severity === 'medium') return 2
  return 1
}

function formatSignedKg(value: number): string {
  const rounded = round2(value)
  if (rounded > 0) return `+${rounded.toFixed(2)} kg`
  return `${rounded.toFixed(2)} kg`
}

function createRecommendation(
  id: string,
  severity: StockAuditSeverity,
  title: string,
  description: string
): StockAuditRecommendation {
  return { id, severity, title, description }
}

export function buildStockAuditReport(params: {
  recoltari: StockAuditRecoltareRow[]
  vanzari: StockAuditVanzareRow[]
  miscariStoc: StockAuditMovementRow[]
  parcele: StockAuditParcelaRow[]
  dataHealth?: StockAuditDataHealth
}): StockAuditReport {
  const parcelaMap = new Map(params.parcele.map((parcela) => [parcela.id, parcela.nume_parcela?.trim() || 'Locație necunoscută']))

  const harvestRecordsKg = round2(params.recoltari.reduce((sum, row) => sum + recoltareKg(row), 0))
  const salesRecordsKg = round2(params.vanzari.reduce((sum, row) => sum + Math.max(0, normalizeNumber(row.cantitate_kg)), 0))

  const buckets = new Map<string, StockAuditBucketIssue>()
  let harvestLedgerKg = 0
  let salesLedgerKg = 0
  let nonCoreMovementNetKg = 0

  for (const row of params.miscariStoc) {
    const signedQty = signedMovementQty(row)
    const tip = row.tip_miscare ?? ''

    if (tip === 'recoltare') {
      harvestLedgerKg += Math.max(0, signedQty)
    } else if (tip === 'vanzare') {
      salesLedgerKg += Math.abs(Math.min(0, signedQty))
    } else {
      nonCoreMovementNetKg += signedQty
    }

    const locatieId = row.locatie_id ?? 'fara-locatie'
    const key = [
      locatieId,
      row.produs?.trim() || 'Fără produs',
      row.calitate?.trim() || 'neprecizata',
      row.depozit?.trim() || 'neprecizat',
    ].join('|')

    const current = buckets.get(key) ?? {
      key,
      locatie: row.locatie_id ? parcelaMap.get(row.locatie_id) || 'Locație necunoscută' : 'Fără locație',
      produs: row.produs?.trim() || 'Fără produs',
      calitate: row.calitate?.trim() || 'neprecizata',
      depozit: row.depozit?.trim() || 'neprecizat',
      currentKg: 0,
    }

    current.currentKg = round2(current.currentKg + signedQty)
    buckets.set(key, current)
  }

  harvestLedgerKg = round2(harvestLedgerKg)
  salesLedgerKg = round2(salesLedgerKg)
  nonCoreMovementNetKg = round2(nonCoreMovementNetKg)

  const currentStockKg = round2(Array.from(buckets.values()).reduce((sum, bucket) => sum + bucket.currentKg, 0))
  const operationalBalanceKg = round2(harvestRecordsKg - salesRecordsKg)
  const harvestSyncDeltaKg = round2(harvestRecordsKg - harvestLedgerKg)
  const salesSyncDeltaKg = round2(salesRecordsKg - salesLedgerKg)
  const balanceGapKg = round2(currentStockKg - operationalBalanceKg)

  const lowStockBuckets = Array.from(buckets.values())
    .filter((bucket) => bucket.currentKg > 0 && bucket.currentKg < STOCK_AUDIT_LOW_STOCK_THRESHOLD_KG)
    .sort((a, b) => a.currentKg - b.currentKg)

  const negativeStockBuckets = Array.from(buckets.values())
    .filter((bucket) => bucket.currentKg < -STOCK_AUDIT_NEGATIVE_STOCK_EPSILON_KG)
    .sort((a, b) => a.currentKg - b.currentKg)

  const anomalies: StockAuditAnomaly[] = []
  const recommendations = new Map<string, StockAuditRecommendation>()

  if (negativeStockBuckets.length > 0) {
    const sample = negativeStockBuckets[0]
    anomalies.push({
      id: 'negative-stock',
      severity: 'high',
      title: 'Există stocuri negative în registru',
      value: `${negativeStockBuckets.length} poziții`,
      description: `Cel mai sever caz este ${sample.locatie} / ${sample.produs} (${sample.calitate}, ${sample.depozit}) cu ${sample.currentKg.toFixed(2)} kg.`,
    })
    recommendations.set(
      'negative-stock',
      createRecommendation(
        'negative-stock',
        'high',
        'Verifică imediat pozițiile cu stoc negativ',
        'Revizuiește ultimele vânzări, pierderi și ajustări pentru locațiile afectate și reconciliază mișcările înainte de noi livrări.'
      )
    )
  }

  if (Math.abs(harvestSyncDeltaKg) > STOCK_AUDIT_SYNC_DELTA_THRESHOLD_KG) {
    anomalies.push({
      id: 'harvest-sync-delta',
      severity: 'high',
      title: 'Recoltările și intrările în stoc nu sunt sincronizate',
      value: formatSignedKg(harvestSyncDeltaKg),
      description: 'Cantitatea totală din recoltări diferă de mișcările de stoc de tip recoltare. Este posibil să existe recoltări salvate fără efect complet în registrul de stoc.',
    })
    recommendations.set(
      'harvest-sync-delta',
      createRecommendation(
        'harvest-sync-delta',
        'high',
        'Reverifică recoltările editate sau migrate recent',
        'Compară ultimele recoltări cu registrul `miscari_stoc` și reprocesează înregistrările care lipsesc din stoc.'
      )
    )
  }

  if (Math.abs(salesSyncDeltaKg) > STOCK_AUDIT_SYNC_DELTA_THRESHOLD_KG) {
    anomalies.push({
      id: 'sales-sync-delta',
      severity: 'high',
      title: 'Vânzările și ieșirile din stoc nu sunt sincronizate',
      value: formatSignedKg(salesSyncDeltaKg),
      description: 'Cantitatea totală din vânzări diferă de mișcările de stoc de tip vânzare. Verifică editările sau ștergerile de vânzări și livrări de comenzi.',
    })
    recommendations.set(
      'sales-sync-delta',
      createRecommendation(
        'sales-sync-delta',
        'high',
        'Controlează ultimele vânzări și livrări',
        'Validează fluxurile de livrare comandă și editare vânzare pentru a confirma că stocul a fost dedus corect.'
      )
    )
  }

  const adjustmentThresholdKg = Math.max(
    STOCK_AUDIT_MIN_ADJUSTMENT_ABS_THRESHOLD_KG,
    harvestRecordsKg * STOCK_AUDIT_ADJUSTMENT_SHARE_THRESHOLD
  )

  if (Math.abs(nonCoreMovementNetKg) > adjustmentThresholdKg) {
    anomalies.push({
      id: 'non-core-movements',
      severity: 'medium',
      title: 'Mișcările auxiliare au impact mare în soldul final',
      value: formatSignedKg(nonCoreMovementNetKg),
      description: 'Consumurile, pierderile, congelările, procesările sau ajustările manuale influențează semnificativ stocul final și merită revizuite.',
    })
    recommendations.set(
      'non-core-movements',
      createRecommendation(
        'non-core-movements',
        'medium',
        'Auditează ajustările și pierderile mari',
        'Dacă diferența este justificată, documentează procesarea sau pierderea. Dacă nu, revizuiește ajustările manuale și cauzele operaționale.'
      )
    )
  }

  if (lowStockBuckets.length > 0) {
    const sample = lowStockBuckets[0]
    anomalies.push({
      id: 'low-stock',
      severity: 'medium',
      title: 'Există poziții cu stoc scăzut',
      value: `${lowStockBuckets.length} poziții`,
      description: `Cea mai mică rezervă este ${sample.locatie} / ${sample.produs} (${sample.calitate}, ${sample.depozit}) cu ${sample.currentKg.toFixed(2)} kg.`,
    })
    recommendations.set(
      'low-stock',
      createRecommendation(
        'low-stock',
        'medium',
        'Planifică reaprovizionarea sau protejează promisiunile comerciale',
        `Pozițiile sub ${STOCK_AUDIT_LOW_STOCK_THRESHOLD_KG} kg ar trebui verificate înainte de a confirma noi livrări.`
      )
    )
  }

  if (operationalBalanceKg < -STOCK_AUDIT_NEGATIVE_STOCK_EPSILON_KG) {
    anomalies.push({
      id: 'operational-balance-negative',
      severity: 'high',
      title: 'Vânzările depășesc cantitatea recoltată înregistrată',
      value: formatSignedKg(operationalBalanceKg),
      description: 'La nivel agregat, cantitatea vândută este mai mare decât cantitatea recoltată. Verifică importurile istorice sau ajustările pozitive lipsă.',
    })
    recommendations.set(
      'operational-balance-negative',
      createRecommendation(
        'operational-balance-negative',
        'high',
        'Reconciliază baza istorică de recoltări',
        'Situația indică lipsă de recoltări istorice sau vânzări introduse peste stocul suportat. Verifică importurile și corecțiile de stoc.'
      )
    )
  }

  if (anomalies.length === 0) {
    recommendations.set(
      'healthy-stock',
      createRecommendation(
        'healthy-stock',
        'low',
        'Continuă auditul periodic',
        'Nu s-au găsit diferențe semnificative. Menține verificarea săptămânală pentru recoltări, vânzări și ajustări.'
      )
    )
  }

  const sortedAnomalies = anomalies.sort((a, b) => severityRank(b.severity) - severityRank(a.severity))
  const sortedRecommendations = Array.from(recommendations.values()).sort(
    (a, b) => severityRank(b.severity) - severityRank(a.severity)
  )

  const hasOperationalData = harvestRecordsKg > 0 || salesRecordsKg > 0
  const degradedReason: StockAuditDegradedReason =
    params.dataHealth === 'missing_ledger_table'
      ? 'missing_ledger_table'
      : params.dataHealth === 'ledger_query_failed'
        ? 'ledger_query_failed'
        : params.miscariStoc.length === 0 && hasOperationalData
          ? 'ledger_empty_with_transactions'
          : null
  const isDegraded = degradedReason !== null

  const status: StockAuditSummary['status'] =
    sortedAnomalies.some((anomaly) => anomaly.severity === 'high')
      ? 'critical'
      : sortedAnomalies.some((anomaly) => anomaly.severity === 'medium')
        ? 'warning'
        : 'ok'

  const summaryText =
    !hasOperationalData && params.miscariStoc.length === 0
      ? 'Auditul nu are încă date operaționale pentru această fermă.'
      : isDegraded
        ? 'Auditul rulează în mod degradat deoarece registrul de stoc nu este complet disponibil. Interpretează rezultatele cu atenție.'
        : status === 'critical'
          ? 'Auditul a găsit discrepanțe critice între stoc, recoltări și vânzări. Recomandarea este să reconciliezi datele înainte de următoarele livrări.'
          : status === 'warning'
            ? 'Auditul a identificat atenționări care merită verificate, dar nu există semne de blocaj critic la nivel global.'
            : 'Auditul nu a găsit discrepanțe semnificative. Stocurile par coerente cu recoltările, vânzările și mișcările auxiliare.'

  const metrics: StockAuditMetricRow[] = [
    {
      label: 'Recoltări înregistrate',
      value: harvestRecordsKg,
      unit: 'kg',
      note: 'Suma kg_cal1 + kg_cal2 din modulul Recoltări.',
    },
    {
      label: 'Intrări stoc din recoltări',
      value: harvestLedgerKg,
      unit: 'kg',
      note: 'Mișcări `miscari_stoc` cu tipul `recoltare`.',
    },
    {
      label: 'Diferență sincronizare recoltări',
      value: harvestSyncDeltaKg,
      unit: 'kg',
      note: `Valori peste ${STOCK_AUDIT_SYNC_DELTA_THRESHOLD_KG} kg indică posibilă lipsă de sincronizare.`,
    },
    {
      label: 'Vânzări înregistrate',
      value: salesRecordsKg,
      unit: 'kg',
      note: 'Cantitatea totală din modulul Vânzări.',
    },
    {
      label: 'Ieșiri stoc din vânzări',
      value: salesLedgerKg,
      unit: 'kg',
      note: 'Mișcări `miscari_stoc` cu tipul `vanzare`.',
    },
    {
      label: 'Diferență sincronizare vânzări',
      value: salesSyncDeltaKg,
      unit: 'kg',
      note: `Valori peste ${STOCK_AUDIT_SYNC_DELTA_THRESHOLD_KG} kg indică editări sau ștergeri de vânzări de verificat.`,
    },
    {
      label: 'Mișcări auxiliare nete',
      value: nonCoreMovementNetKg,
      unit: 'kg',
      note: 'Consum, pierdere, procesare, congelare sau ajustări manuale.',
    },
    {
      label: 'Sold operațional estimat',
      value: operationalBalanceKg,
      unit: 'kg',
      note: 'Recoltări minus vânzări, înainte de alte mișcări.',
    },
    {
      label: 'Stoc curent calculat',
      value: currentStockKg,
      unit: 'kg',
      note: 'Soldul curent rezultat din registrul de stoc.',
    },
    {
      label: 'Gap stoc vs sold operațional',
      value: balanceGapKg,
      unit: 'kg',
      note: 'Ar trebui explicat de mișcările auxiliare și de eventualele diferențe de sincronizare.',
    },
  ]

  return {
    summary: {
      status,
      isDegraded,
      degradedReason,
      summary: summaryText,
      currentStockKg,
      operationalBalanceKg,
      harvestSyncDeltaKg,
      salesSyncDeltaKg,
      nonCoreMovementNetKg,
      lowStockBucketsCount: lowStockBuckets.length,
      negativeStockBucketsCount: negativeStockBuckets.length,
      anomaliesCount: sortedAnomalies.length,
      recommendationsCount: sortedRecommendations.length,
    },
    metrics,
    anomalies: sortedAnomalies,
    recommendations: sortedRecommendations,
    lowStockBuckets,
    negativeStockBuckets,
  }
}
