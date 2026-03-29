import { buildStockReportingModel } from '@/lib/calculations/stock-reporting'

declare const describe: (name: string, fn: () => void) => void
declare const it: (name: string, fn: () => void) => void
declare const expect: (value: unknown) => {
  toBe: (expected: unknown) => void
  toContain: (expected: unknown) => void
  toBeGreaterThan: (expected: number) => void
}

const PARCELE = [
  {
    id: 'solar-1',
    nume_parcela: 'Solar Sud',
    tip_unitate: 'solar',
    tip_fruct: 'rosii',
    cultura: 'rosii',
    soi: 'Inima de Bou',
    soi_plantat: 'Inima de Bou',
  },
  {
    id: 'camp-1',
    nume_parcela: 'Camp Vest',
    tip_unitate: 'camp',
    tip_fruct: 'zmeura',
    cultura: 'zmeura',
    soi: null,
    soi_plantat: 'Maravilla',
  },
]

const CULTURI = [
  {
    id: 'cult-1',
    solar_id: 'solar-1',
    tip_planta: 'rosii',
    soi: 'Inima de Bou',
  },
]

describe('stock-reporting granular model', () => {
  it('recoltari pe soi, vanzari doar pe total produs', () => {
    const model = buildStockReportingModel({
      recoltari: [
        { id: 'r1', parcela_id: 'solar-1', cultura_id: 'cult-1', kg_cal1: 10, kg_cal2: 0 },
      ],
      vanzari: [{ id: 'v1', cantitate_kg: 8 }],
      miscariStoc: [
        { locatie_id: 'solar-1', produs: 'rosii', calitate: 'cal1', depozit: 'fresh', tip_miscare: 'recoltare', cantitate_kg: 10 },
        { locatie_id: 'solar-1', produs: 'rosii', calitate: 'cal1', depozit: 'fresh', tip_miscare: 'vanzare', cantitate_kg: 8 },
      ],
      parcele: PARCELE,
      culturi: CULTURI,
      dataHealth: 'complete',
    })

    expect(model.harvestByProductVariety[0]?.variety).toBe('Inima de Bou')
    expect(model.harvestByProductVariety[0]?.provenance).toBe('explicit')
    expect(model.qualityIndicators.find((row) => row.key === 'sales-variety')?.status).toBe('partial')
  })

  it('recoltari pe parcela, vanzari fara parcela in sursa dar cu locatie reala in ledger', () => {
    const model = buildStockReportingModel({
      recoltari: [{ id: 'r1', parcela_id: 'camp-1', cultura_id: null, kg_cal1: 6, kg_cal2: 4 }],
      vanzari: [{ id: 'v1', cantitate_kg: 5 }],
      miscariStoc: [
        { locatie_id: 'camp-1', produs: 'zmeura', calitate: 'cal1', depozit: 'fresh', tip_miscare: 'recoltare', cantitate_kg: 10 },
        { locatie_id: 'camp-1', produs: 'zmeura', calitate: 'cal1', depozit: 'fresh', tip_miscare: 'vanzare', cantitate_kg: 5 },
      ],
      parcele: PARCELE,
      culturi: CULTURI,
      dataHealth: 'complete',
    })

    expect(model.harvestByProductLocation[0]?.locationName).toBe('Camp Vest')
    expect(model.salesByProductLocation[0]?.locationName).toBe('Camp Vest')
  })

  it('produs cu soi lipsa ramane doar la nivel de produs sau locatie', () => {
    const model = buildStockReportingModel({
      recoltari: [{ id: 'r1', parcela_id: 'camp-1', cultura_id: null, kg_cal1: 7, kg_cal2: 0 }],
      vanzari: [],
      miscariStoc: [{ locatie_id: 'camp-1', produs: 'zmeura', calitate: 'cal1', depozit: 'fresh', tip_miscare: 'recoltare', cantitate_kg: 7 }],
      parcele: [
        { ...PARCELE[1], soi: null, soi_plantat: null },
      ],
      culturi: [],
      dataHealth: 'complete',
    })

    expect(model.harvestByProductVariety.length).toBe(0)
    expect(model.qualityIndicators.find((row) => row.key === 'harvest-variety')?.status).toBe('missing')
  })

  it('marcheaza discret fallback-ul cand soiul vine din metadata parcelei', () => {
    const model = buildStockReportingModel({
      recoltari: [{ id: 'r1', parcela_id: 'camp-1', cultura_id: null, kg_cal1: 7, kg_cal2: 0 }],
      vanzari: [],
      miscariStoc: [{ locatie_id: 'camp-1', produs: 'zmeura', calitate: 'cal1', depozit: 'fresh', tip_miscare: 'recoltare', cantitate_kg: 7 }],
      parcele: PARCELE,
      culturi: [],
      dataHealth: 'complete',
    })

    expect(model.harvestByProductVariety[0]?.provenance).toBe('fallback')
    expect(model.harvestByProductVariety[0]?.provenanceNote).toContain('Soi completat din metadatele parcelei')
  })

  it('produs cu locatie lipsa nu inventeaza locatie', () => {
    const model = buildStockReportingModel({
      recoltari: [{ id: 'r1', parcela_id: null, cultura_id: null, kg_cal1: 12, kg_cal2: 0 }],
      vanzari: [],
      miscariStoc: [],
      parcele: PARCELE,
      culturi: CULTURI,
      dataHealth: 'complete',
    })

    expect(model.harvestByProductLocation.length).toBe(0)
    expect(model.qualityIndicators.find((row) => row.key === 'harvest-location')?.status).toBe('missing')
  })

  it('tenant fara date', () => {
    const model = buildStockReportingModel({
      recoltari: [],
      vanzari: [],
      miscariStoc: [],
      parcele: [],
      culturi: [],
      dataHealth: 'complete',
    })

    expect(model.currentStockByProduct.length).toBe(0)
    expect(model.qualityIndicators.find((row) => row.key === 'sales-variety')?.status).toBe('missing')
  })

  it('audit degradat cand ledger lipseste', () => {
    const model = buildStockReportingModel({
      recoltari: [{ id: 'r1', parcela_id: 'solar-1', cultura_id: 'cult-1', kg_cal1: 10, kg_cal2: 0 }],
      vanzari: [{ id: 'v1', cantitate_kg: 2 }],
      miscariStoc: [],
      parcele: PARCELE,
      culturi: CULTURI,
      dataHealth: 'missing_ledger_table',
    })

    expect(model.qualityIndicators.find((row) => row.key === 'sales-location')?.status).toBe('degraded')
    expect(model.recommendations.map((row) => row.id)).toContain('degraded-ledger')
  })
})
