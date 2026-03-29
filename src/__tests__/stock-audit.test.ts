import { buildStockAuditReport } from '@/lib/calculations/stock-audit'

declare const describe: (name: string, fn: () => void) => void
declare const it: (name: string, fn: () => void) => void
declare const expect: (value: unknown) => {
  toBe: (expected: unknown) => void
  toContain: (expected: unknown) => void
  toBeGreaterThan: (expected: number) => void
}

const PARCELE = [{ id: 'p1', nume_parcela: 'Solar Nord' }]

describe('stock-audit rules', () => {
  it('recoltari fara vanzari', () => {
    const report = buildStockAuditReport({
      recoltari: [{ parcela_id: 'p1', kg_cal1: 30, kg_cal2: 20 }],
      vanzari: [],
      miscariStoc: [{ locatie_id: 'p1', produs: 'Rosii', calitate: 'cal1', depozit: 'fresh', tip_miscare: 'recoltare', cantitate_kg: 50 }],
      parcele: PARCELE,
    })

    expect(report.summary.operationalBalanceKg).toBe(50)
    expect(report.anomalies.length).toBe(0)
  })

  it('vanzari fara recoltari', () => {
    const report = buildStockAuditReport({
      recoltari: [],
      vanzari: [{ cantitate_kg: 30 }],
      miscariStoc: [{ locatie_id: 'p1', produs: 'Rosii', calitate: 'cal1', depozit: 'fresh', tip_miscare: 'vanzare', cantitate_kg: 30 }],
      parcele: PARCELE,
    })

    expect(report.anomalies.map((row) => row.id)).toContain('operational-balance-negative')
  })

  it('stoc negativ', () => {
    const report = buildStockAuditReport({
      recoltari: [],
      vanzari: [{ cantitate_kg: 5 }],
      miscariStoc: [{ locatie_id: 'p1', produs: 'Rosii', calitate: 'cal1', depozit: 'fresh', tip_miscare: 'vanzare', cantitate_kg: 5 }],
      parcele: PARCELE,
    })

    expect(report.summary.negativeStockBucketsCount).toBeGreaterThan(0)
    expect(report.anomalies.map((row) => row.id)).toContain('negative-stock')
  })

  it('stoc scazut', () => {
    const report = buildStockAuditReport({
      recoltari: [{ parcela_id: 'p1', kg_cal1: 12, kg_cal2: 0 }],
      vanzari: [],
      miscariStoc: [{ locatie_id: 'p1', produs: 'Rosii', calitate: 'cal1', depozit: 'fresh', tip_miscare: 'recoltare', cantitate_kg: 12 }],
      parcele: PARCELE,
    })

    expect(report.summary.lowStockBucketsCount).toBeGreaterThan(0)
    expect(report.anomalies.map((row) => row.id)).toContain('low-stock')
  })

  it('mismatch recoltari vs ledger', () => {
    const report = buildStockAuditReport({
      recoltari: [{ parcela_id: 'p1', kg_cal1: 50, kg_cal2: 0 }],
      vanzari: [],
      miscariStoc: [{ locatie_id: 'p1', produs: 'Rosii', calitate: 'cal1', depozit: 'fresh', tip_miscare: 'recoltare', cantitate_kg: 40 }],
      parcele: PARCELE,
    })

    expect(report.summary.harvestSyncDeltaKg).toBe(10)
    expect(report.anomalies.map((row) => row.id)).toContain('harvest-sync-delta')
  })

  it('mismatch vanzari vs ledger', () => {
    const report = buildStockAuditReport({
      recoltari: [],
      vanzari: [{ cantitate_kg: 20 }],
      miscariStoc: [{ locatie_id: 'p1', produs: 'Rosii', calitate: 'cal1', depozit: 'fresh', tip_miscare: 'vanzare', cantitate_kg: 12 }],
      parcele: PARCELE,
    })

    expect(report.summary.salesSyncDeltaKg).toBe(8)
    expect(report.anomalies.map((row) => row.id)).toContain('sales-sync-delta')
  })

  it('audit fara miscari_stoc este marcat degradat', () => {
    const report = buildStockAuditReport({
      recoltari: [{ parcela_id: 'p1', kg_cal1: 20, kg_cal2: 0 }],
      vanzari: [],
      miscariStoc: [],
      parcele: PARCELE,
    })

    expect(report.summary.isDegraded).toBe(true)
    expect(report.summary.degradedReason).toBe('ledger_empty_with_transactions')
  })

  it('lipsa tabelei miscari_stoc este marcată explicit', () => {
    const report = buildStockAuditReport({
      recoltari: [{ parcela_id: 'p1', kg_cal1: 20, kg_cal2: 0 }],
      vanzari: [],
      miscariStoc: [],
      parcele: PARCELE,
      dataHealth: 'missing_ledger_table',
    })

    expect(report.summary.isDegraded).toBe(true)
    expect(report.summary.degradedReason).toBe('missing_ledger_table')
  })

  it('tenant fara date', () => {
    const report = buildStockAuditReport({
      recoltari: [],
      vanzari: [],
      miscariStoc: [],
      parcele: [],
    })

    expect(report.summary.status).toBe('ok')
    expect(report.summary.isDegraded).toBe(false)
    expect(report.summary.anomaliesCount).toBe(0)
  })
})
