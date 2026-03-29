import type { StockAuditDataHealth, StockAuditSeverity } from './stock-audit'

export type StockDataQualityStatus = 'complete' | 'partial' | 'missing' | 'unsupported' | 'degraded'

export interface StockReportingHarvestRow {
  id: string
  parcela_id: string | null
  cultura_id: string | null
  kg_cal1: number | null
  kg_cal2: number | null
}

export interface StockReportingSaleRow {
  id: string
  cantitate_kg: number | null
}

export interface StockReportingMovementRow {
  locatie_id: string | null
  produs: string | null
  calitate: string | null
  depozit: string | null
  tip_miscare: string | null
  cantitate_kg: number | null
}

export interface StockReportingParcelRow {
  id: string
  nume_parcela: string | null
  tip_unitate: string | null
  tip_fruct: string | null
  cultura: string | null
  soi: string | null
  soi_plantat: string | null
}

export interface StockReportingCultureRow {
  id: string
  solar_id: string
  tip_planta: string
  soi: string | null
}

export type StockAggregateProvenance = 'explicit' | 'fallback' | 'mixed'

export interface StockAggregateRow {
  key: string
  product: string
  quantityKg: number
  variety: string | null
  locationName: string | null
  locationType: string | null
  scope: 'product' | 'product_location' | 'product_variety' | 'product_variety_location' | 'location_type'
  source: 'current_stock' | 'harvests' | 'sales_ledger'
  provenance: StockAggregateProvenance
  provenanceNote: string | null
}

export interface StockDataQualityIndicator {
  key: string
  label: string
  status: StockDataQualityStatus
  value: string
  description: string
}

export interface StockReportingRecommendation {
  id: string
  severity: StockAuditSeverity
  title: string
  description: string
}

export interface StockReportingModel {
  currentStockByProduct: StockAggregateRow[]
  currentStockByProductLocation: StockAggregateRow[]
  currentStockByLocationType: StockAggregateRow[]
  harvestByProductVariety: StockAggregateRow[]
  harvestByProductLocation: StockAggregateRow[]
  harvestByProductVarietyLocation: StockAggregateRow[]
  salesByProduct: StockAggregateRow[]
  salesByProductLocation: StockAggregateRow[]
  qualityIndicators: StockDataQualityIndicator[]
  recommendations: StockReportingRecommendation[]
}

interface NormalizedHarvestRow {
  quantityKg: number
  product: string | null
  variety: string | null
  locationName: string | null
  locationType: string | null
  provenance: StockAggregateProvenance
  provenanceNote: string | null
}

interface NormalizedSaleRow {
  quantityKg: number
}

interface NormalizedMovementRow {
  quantityKg: number
  product: string | null
  locationName: string | null
  locationType: string | null
  tipMiscare: string | null
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

function normalizeNumber(value: number | null | undefined): number {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

function normalizeText(value: string | null | undefined): string | null {
  const trimmed = String(value ?? '').trim()
  return trimmed ? trimmed : null
}

function severityRank(severity: StockAuditSeverity): number {
  if (severity === 'high') return 3
  if (severity === 'medium') return 2
  return 1
}

function addAggregate(
  map: Map<string, StockAggregateRow>,
  row: Omit<StockAggregateRow, 'quantityKg'> & { quantityKg: number }
) {
  const current = map.get(row.key)
  if (current) {
    current.quantityKg = round2(current.quantityKg + row.quantityKg)
    if (current.provenance !== row.provenance) {
      current.provenance = 'mixed'
    }

    const mergedNotes = new Set(
      [current.provenanceNote, row.provenanceNote]
        .filter((value): value is string => Boolean(value))
        .flatMap((value) => value.split(' | '))
    )
    current.provenanceNote = mergedNotes.size > 0 ? Array.from(mergedNotes).join(' | ') : null
    return
  }
  map.set(row.key, { ...row, quantityKg: round2(row.quantityKg) })
}

function sortAggregateRows(rows: StockAggregateRow[]): StockAggregateRow[] {
  return [...rows].sort((a, b) => b.quantityKg - a.quantityKg || a.product.localeCompare(b.product, 'ro'))
}

function createQualityIndicator(
  key: string,
  label: string,
  status: StockDataQualityStatus,
  value: string,
  description: string
): StockDataQualityIndicator {
  return { key, label, status, value, description }
}

function createRecommendation(
  id: string,
  severity: StockAuditSeverity,
  title: string,
  description: string
): StockReportingRecommendation {
  return { id, severity, title, description }
}

function createHarvestProvenance(params: {
  productSource: 'culturi.tip_planta' | 'parcele.cultura' | 'parcele.tip_fruct' | null
  varietySource: 'culturi.soi' | 'parcele.soi' | 'parcele.soi_plantat' | null
}): { provenance: StockAggregateProvenance; provenanceNote: string | null } {
  const notes: string[] = []

  if (params.productSource === 'parcele.cultura' || params.productSource === 'parcele.tip_fruct') {
    notes.push('Produs completat din metadatele parcelei')
  }

  if (params.varietySource === 'parcele.soi' || params.varietySource === 'parcele.soi_plantat') {
    notes.push('Soi completat din metadatele parcelei')
  }

  return {
    provenance: notes.length > 0 ? 'fallback' : 'explicit',
    provenanceNote: notes.length > 0 ? notes.join(' | ') : null,
  }
}

export function buildStockReportingModel(params: {
  recoltari: StockReportingHarvestRow[]
  vanzari: StockReportingSaleRow[]
  miscariStoc: StockReportingMovementRow[]
  parcele: StockReportingParcelRow[]
  culturi: StockReportingCultureRow[]
  dataHealth?: StockAuditDataHealth
}): StockReportingModel {
  const parcelaMap = new Map(params.parcele.map((row) => [row.id, row]))
  const culturaMap = new Map(params.culturi.map((row) => [row.id, row]))

  const normalizedHarvests: NormalizedHarvestRow[] = params.recoltari
    .map((row) => {
      const parcela = row.parcela_id ? parcelaMap.get(row.parcela_id) ?? null : null
      const cultura = row.cultura_id ? culturaMap.get(row.cultura_id) ?? null : null
      const quantityKg = round2(normalizeNumber(row.kg_cal1) + normalizeNumber(row.kg_cal2))
      const productSource =
        normalizeText(cultura?.tip_planta) !== null
          ? 'culturi.tip_planta'
          : normalizeText(parcela?.cultura) !== null
            ? 'parcele.cultura'
            : normalizeText(parcela?.tip_fruct) !== null
              ? 'parcele.tip_fruct'
              : null
      const varietySource =
        normalizeText(cultura?.soi) !== null
          ? 'culturi.soi'
          : normalizeText(parcela?.soi) !== null
            ? 'parcele.soi'
            : normalizeText(parcela?.soi_plantat) !== null
              ? 'parcele.soi_plantat'
              : null
      const provenance = createHarvestProvenance({ productSource, varietySource })

      return {
        quantityKg,
        product:
          normalizeText(cultura?.tip_planta) ??
          normalizeText(parcela?.cultura) ??
          normalizeText(parcela?.tip_fruct),
        variety:
          normalizeText(cultura?.soi) ??
          normalizeText(parcela?.soi) ??
          normalizeText(parcela?.soi_plantat),
        locationName: normalizeText(parcela?.nume_parcela),
        locationType: normalizeText(parcela?.tip_unitate),
        provenance: provenance.provenance,
        provenanceNote: provenance.provenanceNote,
      }
    })
    .filter((row) => row.quantityKg > 0)

  const normalizedSales: NormalizedSaleRow[] = params.vanzari
    .map((row) => ({
      quantityKg: Math.max(0, normalizeNumber(row.cantitate_kg)),
    }))
    .filter((row) => row.quantityKg > 0)

  const normalizedSaleLedger: NormalizedMovementRow[] = params.miscariStoc
    .filter((row) => row.tip_miscare === 'vanzare')
    .map((row) => {
      const parcela = row.locatie_id ? parcelaMap.get(row.locatie_id) ?? null : null
      return {
        quantityKg: Math.max(0, normalizeNumber(row.cantitate_kg)),
        product: normalizeText(row.produs),
        locationName: normalizeText(parcela?.nume_parcela),
        locationType: normalizeText(parcela?.tip_unitate),
        tipMiscare: row.tip_miscare,
      }
    })
    .filter((row) => row.quantityKg > 0)

  const normalizedCurrentStock: NormalizedMovementRow[] = params.miscariStoc
    .map((row) => {
      const parcela = row.locatie_id ? parcelaMap.get(row.locatie_id) ?? null : null
      const qty = Math.max(0, normalizeNumber(row.cantitate_kg))
      const signedQty = row.tip_miscare === 'vanzare' || row.tip_miscare === 'consum' || row.tip_miscare === 'oferit_gratuit' || row.tip_miscare === 'pierdere'
        ? -qty
        : qty

      return {
        quantityKg: signedQty,
        product: normalizeText(row.produs),
        locationName: normalizeText(parcela?.nume_parcela),
        locationType: normalizeText(parcela?.tip_unitate),
        tipMiscare: row.tip_miscare,
      }
    })
    .filter((row) => row.quantityKg !== 0)

  const currentStockByProductMap = new Map<string, StockAggregateRow>()
  const currentStockByProductLocationMap = new Map<string, StockAggregateRow>()
  const currentStockByLocationTypeMap = new Map<string, StockAggregateRow>()
  const harvestByProductVarietyMap = new Map<string, StockAggregateRow>()
  const harvestByProductLocationMap = new Map<string, StockAggregateRow>()
  const harvestByProductVarietyLocationMap = new Map<string, StockAggregateRow>()
  const salesByProductMap = new Map<string, StockAggregateRow>()
  const salesByProductLocationMap = new Map<string, StockAggregateRow>()

  for (const row of normalizedCurrentStock) {
    if (!row.product) continue

    addAggregate(currentStockByProductMap, {
      key: row.product,
      product: row.product,
      quantityKg: row.quantityKg,
      variety: null,
      locationName: null,
      locationType: null,
      scope: 'product',
      source: 'current_stock',
      provenance: 'explicit',
      provenanceNote: null,
    })

    if (row.locationName) {
      addAggregate(currentStockByProductLocationMap, {
        key: `${row.product}|${row.locationName}`,
        product: row.product,
        quantityKg: row.quantityKg,
        variety: null,
        locationName: row.locationName,
        locationType: row.locationType,
        scope: 'product_location',
        source: 'current_stock',
        provenance: 'explicit',
        provenanceNote: null,
      })
    }

    if (row.locationType) {
      addAggregate(currentStockByLocationTypeMap, {
        key: `${row.product}|${row.locationType}`,
        product: row.product,
        quantityKg: row.quantityKg,
        variety: null,
        locationName: null,
        locationType: row.locationType,
        scope: 'location_type',
        source: 'current_stock',
        provenance: 'explicit',
        provenanceNote: null,
      })
    }
  }

  for (const row of normalizedHarvests) {
    if (!row.product) continue

    if (row.variety) {
      addAggregate(harvestByProductVarietyMap, {
        key: `${row.product}|${row.variety}`,
        product: row.product,
        quantityKg: row.quantityKg,
        variety: row.variety,
        locationName: null,
        locationType: row.locationType,
        scope: 'product_variety',
        source: 'harvests',
        provenance: row.provenance,
        provenanceNote: row.provenanceNote,
      })
    }

    if (row.locationName) {
      addAggregate(harvestByProductLocationMap, {
        key: `${row.product}|${row.locationName}`,
        product: row.product,
        quantityKg: row.quantityKg,
        variety: null,
        locationName: row.locationName,
        locationType: row.locationType,
        scope: 'product_location',
        source: 'harvests',
        provenance: row.provenance,
        provenanceNote: row.provenanceNote,
      })
    }

    if (row.variety && row.locationName) {
      addAggregate(harvestByProductVarietyLocationMap, {
        key: `${row.product}|${row.variety}|${row.locationName}`,
        product: row.product,
        quantityKg: row.quantityKg,
        variety: row.variety,
        locationName: row.locationName,
        locationType: row.locationType,
        scope: 'product_variety_location',
        source: 'harvests',
        provenance: row.provenance,
        provenanceNote: row.provenanceNote,
      })
    }
  }

  for (const row of normalizedSaleLedger) {
    if (!row.product) continue

    addAggregate(salesByProductMap, {
      key: row.product,
      product: row.product,
      quantityKg: row.quantityKg,
      variety: null,
      locationName: null,
      locationType: null,
      scope: 'product',
      source: 'sales_ledger',
      provenance: 'explicit',
      provenanceNote: null,
    })

    if (row.locationName) {
      addAggregate(salesByProductLocationMap, {
        key: `${row.product}|${row.locationName}`,
        product: row.product,
        quantityKg: row.quantityKg,
        variety: null,
        locationName: row.locationName,
        locationType: row.locationType,
        scope: 'product_location',
        source: 'sales_ledger',
        provenance: 'explicit',
        provenanceNote: null,
      })
    }
  }

  const totalSalesKg = round2(normalizedSales.reduce((sum, row) => sum + row.quantityKg, 0))
  const explicitHarvestVarietyKg = round2(
    normalizedHarvests.reduce((sum, row) => sum + (row.variety ? row.quantityKg : 0), 0)
  )
  const missingHarvestVarietyKg = round2(
    normalizedHarvests.reduce((sum, row) => sum + (!row.variety ? row.quantityKg : 0), 0)
  )
  const missingHarvestLocationKg = round2(
    normalizedHarvests.reduce((sum, row) => sum + (!row.locationName ? row.quantityKg : 0), 0)
  )
  const saleLedgerWithoutLocationKg = round2(
    normalizedSaleLedger.reduce((sum, row) => sum + (!row.locationName ? row.quantityKg : 0), 0)
  )
  const saleLedgerWithoutProductKg = round2(
    normalizedSaleLedger.reduce((sum, row) => sum + (!row.product ? row.quantityKg : 0), 0)
  )

  const qualityIndicators: StockDataQualityIndicator[] = [
    createQualityIndicator(
      'harvest-variety',
      'Recoltări cu soi explicit',
      normalizedHarvests.length === 0
        ? 'missing'
        : missingHarvestVarietyKg === 0
          ? 'complete'
          : explicitHarvestVarietyKg > 0
            ? 'partial'
            : 'missing',
      `${explicitHarvestVarietyKg.toFixed(2)} kg cu soi`,
      missingHarvestVarietyKg > 0
        ? `${missingHarvestVarietyKg.toFixed(2)} kg din recoltări nu au soi explicit și rămân doar la nivel de produs sau locație.`
        : 'Toate recoltările disponibile pot fi analizate și pe soi.'
    ),
    createQualityIndicator(
      'harvest-location',
      'Recoltări cu locație explicită',
      normalizedHarvests.length === 0
        ? 'missing'
        : missingHarvestLocationKg === 0
          ? 'complete'
          : normalizedHarvests.some((row) => row.locationName)
            ? 'partial'
            : 'missing',
      `${round2(normalizedHarvests.reduce((sum, row) => sum + (row.locationName ? row.quantityKg : 0), 0)).toFixed(2)} kg cu locație`,
      missingHarvestLocationKg > 0
        ? `${missingHarvestLocationKg.toFixed(2)} kg din recoltări nu au parcelă/solar explicit și nu pot fi coborâte sub nivelul de produs.`
        : 'Toate recoltările disponibile pot fi analizate și pe locație.'
    ),
    createQualityIndicator(
      'sales-variety',
      'Vânzări cu alocare pe soi',
      totalSalesKg === 0
        ? 'missing'
        : 'partial',
      `${totalSalesKg.toFixed(2)} kg fără soi explicit`,
      totalSalesKg === 0
        ? 'Nu există vânzări în setul curent de date.'
        : 'Modelul actual de vânzări nu stochează soiul explicit. Ieșirile rămân agregate pe produs și nu sunt defalcate pe soi.'
    ),
    createQualityIndicator(
      'sales-location',
      'Vânzări cu locație explicită',
      params.dataHealth !== 'complete'
        ? 'degraded'
        : totalSalesKg === 0
          ? 'missing'
          : saleLedgerWithoutLocationKg === 0
            ? 'complete'
            : normalizedSaleLedger.length > 0
              ? 'partial'
              : 'degraded',
      `${round2(normalizedSaleLedger.reduce((sum, row) => sum + (row.locationName ? row.quantityKg : 0), 0)).toFixed(2)} kg cu locație`,
      params.dataHealth !== 'complete'
        ? 'Ledger-ul nu este complet disponibil, deci alocarea pe locație pentru ieșiri trebuie interpretată cu atenție.'
        : saleLedgerWithoutLocationKg > 0
          ? `${saleLedgerWithoutLocationKg.toFixed(2)} kg din ieșiri nu au locație explicită în ledger.`
          : 'Ieșirile din ledger pot fi urmărite pe locație fără estimări suplimentare.'
    ),
    createQualityIndicator(
      'sales-product',
      'Vânzări cu produs explicit în ledger',
      params.dataHealth !== 'complete'
        ? 'degraded'
        : totalSalesKg === 0
          ? 'missing'
          : saleLedgerWithoutProductKg === 0
            ? 'complete'
            : 'partial',
      `${round2(normalizedSaleLedger.reduce((sum, row) => sum + (row.product ? row.quantityKg : 0), 0)).toFixed(2)} kg cu produs`,
      params.dataHealth !== 'complete'
        ? 'Fără ledger complet, ieșirile nu pot fi validate integral pe produs.'
        : saleLedgerWithoutProductKg > 0
          ? `${saleLedgerWithoutProductKg.toFixed(2)} kg din ieșiri nu au produs explicit în ledger.`
          : 'Ieșirile din ledger pot fi urmărite pe produs fără estimări.'
    ),
  ]

  const recommendations = new Map<string, StockReportingRecommendation>()

  if (explicitHarvestVarietyKg > 0 && totalSalesKg > 0) {
    recommendations.set(
      'sales-without-variety',
      createRecommendation(
        'sales-without-variety',
        'medium',
        'Analiza pe soi este incompletă pe partea de ieșiri',
        'Există recoltări cu soi explicit, dar vânzările rămân doar la nivel de produs total. Nu încercăm alocări automate pe soi.'
      )
    )
  }

  if (missingHarvestLocationKg > 0) {
    recommendations.set(
      'missing-harvest-location',
      createRecommendation(
        'missing-harvest-location',
        'medium',
        'Completează locația la recoltările viitoare',
        'O parte din recoltări nu au parcelă/solar explicit și nu pot fi analizate mai jos de nivelul de produs.'
      )
    )
  }

  if (missingHarvestVarietyKg > 0) {
    recommendations.set(
      'missing-harvest-variety',
      createRecommendation(
        'missing-harvest-variety',
        'low',
        'Completează soiul acolo unde este cunoscut',
        'Când soiul este completat în recoltări sau în cultura asociată, rapoartele pot coborî sigur la nivel de soi.'
      )
    )
  }

  if (params.dataHealth !== 'complete') {
    recommendations.set(
      'degraded-ledger',
      createRecommendation(
        'degraded-ledger',
        'high',
        'Verifică disponibilitatea ledger-ului de stoc',
        'Raportarea multi-granulară a ieșirilor și a stocului curent depinde de `miscari_stoc`. În modul degradat, detaliul pe produs și locație este parțial.'
      )
    )
  }

  const sortedRecommendations = Array.from(recommendations.values()).sort(
    (a, b) => severityRank(b.severity) - severityRank(a.severity)
  )

  return {
    currentStockByProduct: sortAggregateRows(Array.from(currentStockByProductMap.values())).filter((row) => row.quantityKg !== 0),
    currentStockByProductLocation: sortAggregateRows(Array.from(currentStockByProductLocationMap.values())).filter((row) => row.quantityKg !== 0),
    currentStockByLocationType: sortAggregateRows(Array.from(currentStockByLocationTypeMap.values())).filter((row) => row.quantityKg !== 0),
    harvestByProductVariety: sortAggregateRows(Array.from(harvestByProductVarietyMap.values())),
    harvestByProductLocation: sortAggregateRows(Array.from(harvestByProductLocationMap.values())),
    harvestByProductVarietyLocation: sortAggregateRows(Array.from(harvestByProductVarietyLocationMap.values())),
    salesByProduct: sortAggregateRows(Array.from(salesByProductMap.values())),
    salesByProductLocation: sortAggregateRows(Array.from(salesByProductLocationMap.values())),
    qualityIndicators,
    recommendations: sortedRecommendations,
  }
}
