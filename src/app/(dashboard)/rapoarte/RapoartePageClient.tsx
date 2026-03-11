'use client'

import { useEffect, useMemo, useState } from 'react'
import { BarChart3, Download, FileSpreadsheet, FileText, Filter } from 'lucide-react'
import { toast } from '@/lib/ui/toast'

import { AppShell } from '@/components/app/AppShell'
import { EmptyState } from '@/components/app/EmptyState'
import { PageHeader } from '@/components/app/PageHeader'
import { PerformanceTable, type PerformanceRow } from '@/components/app/PerformanceTable'
import MiniCard from '@/components/ui/MiniCard'
import TrendBadge from '@/components/ui/TrendBadge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { calculateProfit } from '@/lib/calculations/profit'
import { trackEvent } from '@/lib/analytics/trackEvent'
import { calculatePauseStatus } from '@/lib/supabase/queries/activitati-agricole'
import { colors, radius, shadows, spacing } from '@/lib/design-tokens'

type PeriodType = 'zi' | 'luna' | 'sezon' | 'custom'
type ReportType =
  | 'productie_totala'
  | 'venit_total'
  | 'costuri_totale'
  | 'profit_estimat'
  | 'productivitate_parcela'
  | 'productivitate_culegator'
  | 'vanzari_client'

interface RecoltareLite {
  id: string
  id_recoltare: string
  data: string
  parcela_id: string | null
  culegator_id: string | null
  kg_cal1: number
  kg_cal2: number
}

interface VanzareLite {
  id: string
  id_vanzare: string
  data: string
  client_id: string | null
  cantitate_kg: number
  pret_lei_kg: number
}

interface CheltuialaLite {
  id: string
  id_cheltuiala: string
  data: string
  categorie: string | null
  suma_lei: number
}

interface ParcelaLite {
  id: string
  id_parcela: string | null
  nume_parcela: string | null
  soi_plantat: string | null
}

interface CulegatorLite {
  id: string
  id_culegator: string | null
  nume_prenume: string | null
}

interface ClientLite {
  id: string
  id_client: string | null
  nume_client: string | null
}

interface ActivitateLite {
  id: string
  data_aplicare: string
  parcela_id: string | null
  tip_activitate: string | null
  produs_utilizat: string | null
  doza: string | null
  timp_pauza_zile: number
  observatii: string | null
}

interface RapoartePageClientProps {
  initialRecoltari: RecoltareLite[]
  initialVanzari: VanzareLite[]
  initialCheltuieli: CheltuialaLite[]
  initialParcele: ParcelaLite[]
  initialCulegatori: CulegatorLite[]
  initialClienți: ClientLite[]
  initialActivitati: ActivitateLite[]
}

interface DetailRow {
  label: string
  value: number
  secondary?: string
}

function recoltareTotalKg(row: RecoltareLite): number {
  return Number(row.kg_cal1 || 0) + Number(row.kg_cal2 || 0)
}

function toInputDate(date: Date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function downloadFile(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function trendPercent(current: number, previous: number): number {
  if (previous > 0) return ((current - previous) / previous) * 100
  return current > 0 ? 100 : 0
}

export function RapoartePageClient({
  initialRecoltari,
  initialVanzari,
  initialCheltuieli,
  initialParcele,
  initialCulegatori,
  initialClienți,
  initialActivitati,
}: RapoartePageClientProps) {
  const today = useMemo(() => new Date(), [])
  const seasonStart = useMemo(() => new Date(today.getFullYear(), 2, 1), [today])

  const [periodType, setPeriodType] = useState<PeriodType>('luna')
  const [selectedParcelaId, setSelectedParcelaId] = useState<string>('all')
  const [selectedCultura, setSelectedCultura] = useState<string>('all')
  const [reportType, setReportType] = useState<ReportType>('productie_totala')
  const [customFrom, setCustomFrom] = useState<string>(toInputDate(seasonStart))
  const [customTo, setCustomTo] = useState<string>(toInputDate(today))

  useEffect(() => {
    trackEvent('view_rapoarte', { source: 'RapoartePageClient' })
  }, [])

  const parcelaMap = useMemo(
    () => Object.fromEntries(initialParcele.map((p) => [p.id, p])),
    [initialParcele]
  )
  const culegatorMap = useMemo(
    () => Object.fromEntries(initialCulegatori.map((c) => [c.id, c])),
    [initialCulegatori]
  )
  const clientMap = useMemo(
    () => Object.fromEntries(initialClienți.map((c) => [c.id, c])),
    [initialClienți]
  )

  const cultures = useMemo(
    () =>
      Array.from(
        new Set(
          initialParcele
            .map((p) => p.soi_plantat?.trim())
            .filter((v): v is string => Boolean(v))
        )
      ),
    [initialParcele]
  )

  const range = useMemo(() => {
    const end = new Date(today)
    end.setHours(23, 59, 59, 999)

    if (periodType === 'zi') {
      const start = new Date(today)
      start.setHours(0, 0, 0, 0)
      return { start, end }
    }

    if (periodType === 'luna') {
      const start = new Date(today.getFullYear(), today.getMonth(), 1)
      start.setHours(0, 0, 0, 0)
      return { start, end }
    }

    if (periodType === 'sezon') {
      const start = new Date(today.getFullYear(), 2, 1)
      start.setHours(0, 0, 0, 0)
      return { start, end }
    }

    const start = new Date(customFrom || toInputDate(seasonStart))
    start.setHours(0, 0, 0, 0)
    const customEnd = new Date(customTo || toInputDate(today))
    customEnd.setHours(23, 59, 59, 999)
    return { start, end: customEnd }
  }, [customFrom, customTo, periodType, seasonStart, today])

  const filteredRecoltari = useMemo(() => {
    return initialRecoltari.filter((r) => {
      const date = new Date(r.data)
      const inRange = date >= range.start && date <= range.end
      if (!inRange) return false

      if (selectedParcelaId !== 'all' && r.parcela_id !== selectedParcelaId) return false

      if (selectedCultura !== 'all') {
        const parcela = r.parcela_id ? parcelaMap[r.parcela_id] : null
        const cultura = parcela?.soi_plantat?.trim() || ''
        if (cultura !== selectedCultura) return false
      }

      return true
    })
  }, [initialRecoltari, parcelaMap, range.end, range.start, selectedCultura, selectedParcelaId])

  const filteredVanzari = useMemo(() => {
    return initialVanzari.filter((v) => {
      const date = new Date(v.data)
      return date >= range.start && date <= range.end
    })
  }, [initialVanzari, range.end, range.start])

  const filteredCheltuieli = useMemo(() => {
    return initialCheltuieli.filter((c) => {
      const date = new Date(c.data)
      return date >= range.start && date <= range.end
    })
  }, [initialCheltuieli, range.end, range.start])

  const previousRange = useMemo(() => {
    const lengthMs = Math.max(24 * 60 * 60 * 1000, range.end.getTime() - range.start.getTime() + 1)
    const prevEnd = new Date(range.start.getTime() - 1)
    const prevStart = new Date(prevEnd.getTime() - lengthMs + 1)
    return { start: prevStart, end: prevEnd }
  }, [range.end, range.start])

  const previousFilteredRecoltari = useMemo(() => {
    return initialRecoltari.filter((r) => {
      const date = new Date(r.data)
      const inRange = date >= previousRange.start && date <= previousRange.end
      if (!inRange) return false

      if (selectedParcelaId !== 'all' && r.parcela_id !== selectedParcelaId) return false

      if (selectedCultura !== 'all') {
        const parcela = r.parcela_id ? parcelaMap[r.parcela_id] : null
        const cultura = parcela?.soi_plantat?.trim() || ''
        if (cultura !== selectedCultura) return false
      }

      return true
    })
  }, [initialRecoltari, parcelaMap, previousRange.end, previousRange.start, selectedCultura, selectedParcelaId])

  const previousFilteredVanzari = useMemo(() => {
    return initialVanzari.filter((v) => {
      const date = new Date(v.data)
      return date >= previousRange.start && date <= previousRange.end
    })
  }, [initialVanzari, previousRange.end, previousRange.start])

  const previousFilteredCheltuieli = useMemo(() => {
    return initialCheltuieli.filter((c) => {
      const date = new Date(c.data)
      return date >= previousRange.start && date <= previousRange.end
    })
  }, [initialCheltuieli, previousRange.end, previousRange.start])

  const kpi = useMemo(() => {
    const productieKg = filteredRecoltari.reduce((sum, row) => sum + recoltareTotalKg(row), 0)
    const venitLei = filteredVanzari.reduce(
      (sum, row) => sum + Number(row.cantitate_kg || 0) * Number(row.pret_lei_kg || 0),
      0
    )
    const costLei = filteredCheltuieli.reduce((sum, row) => sum + Number(row.suma_lei || 0), 0)
    return {
      productieKg,
      ...calculateProfit(venitLei, costLei),
    }
  }, [filteredCheltuieli, filteredRecoltari, filteredVanzari])

  const previousKpi = useMemo(() => {
    const productieKg = previousFilteredRecoltari.reduce((sum, row) => sum + recoltareTotalKg(row), 0)
    const venitLei = previousFilteredVanzari.reduce(
      (sum, row) => sum + Number(row.cantitate_kg || 0) * Number(row.pret_lei_kg || 0),
      0
    )
    const costLei = previousFilteredCheltuieli.reduce((sum, row) => sum + Number(row.suma_lei || 0), 0)
    return {
      productieKg,
      revenue: venitLei,
      cost: costLei,
      profit: venitLei - costLei,
    }
  }, [previousFilteredCheltuieli, previousFilteredRecoltari, previousFilteredVanzari])

  const kpiTrend = useMemo(
    () => ({
      venit: trendPercent(kpi.revenue, previousKpi.revenue),
      cheltuieli: trendPercent(kpi.cost, previousKpi.cost),
      productie: trendPercent(kpi.productieKg, previousKpi.productieKg),
    }),
    [kpi.cost, kpi.productieKg, kpi.revenue, previousKpi.cost, previousKpi.productieKg, previousKpi.revenue]
  )

  const monthlyFinancialRows = useMemo(() => {
    const grouped = new Map<string, { venit: number; cheltuieli: number }>()
    filteredVanzari.forEach((row) => {
      const date = new Date(row.data)
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      const current = grouped.get(key) ?? { venit: 0, cheltuieli: 0 }
      current.venit += Number(row.cantitate_kg || 0) * Number(row.pret_lei_kg || 0)
      grouped.set(key, current)
    })
    filteredCheltuieli.forEach((row) => {
      const date = new Date(row.data)
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      const current = grouped.get(key) ?? { venit: 0, cheltuieli: 0 }
      current.cheltuieli += Number(row.suma_lei || 0)
      grouped.set(key, current)
    })

    return Array.from(grouped.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-6)
      .map(([key, value]) => ({
        key,
        label: key.slice(5),
        venit: value.venit,
        cheltuieli: value.cheltuieli,
      }))
  }, [filteredCheltuieli, filteredVanzari])

  const financialChartMax = useMemo(() => {
    return Math.max(
      1,
      ...monthlyFinancialRows.flatMap((row) => [row.venit, row.cheltuieli])
    )
  }, [monthlyFinancialRows])

  const reportRows = useMemo<DetailRow[]>(() => {
    if (reportType === 'productie_totala') {
      const grouped = new Map<string, number>()
      filteredRecoltari.forEach((row) => {
        const key = new Date(row.data).toLocaleDateString('ro-RO')
        grouped.set(key, (grouped.get(key) ?? 0) + recoltareTotalKg(row))
      })
      return Array.from(grouped.entries())
        .map(([label, value]) => ({ label, value, secondary: 'kg' }))
        .sort((a, b) => b.value - a.value)
    }

    if (reportType === 'venit_total') {
      const grouped = new Map<string, number>()
      filteredVanzari.forEach((row) => {
        const key = row.client_id ? clientMap[row.client_id]?.nume_client || 'Client necunoscut' : 'Fără client'
        grouped.set(key, (grouped.get(key) ?? 0) + Number(row.cantitate_kg || 0) * Number(row.pret_lei_kg || 0))
      })
      return Array.from(grouped.entries())
        .map(([label, value]) => ({ label, value, secondary: 'lei' }))
        .sort((a, b) => b.value - a.value)
    }

    if (reportType === 'costuri_totale') {
      const grouped = new Map<string, number>()
      filteredCheltuieli.forEach((row) => {
        const key = row.categorie || 'Fără categorie'
        grouped.set(key, (grouped.get(key) ?? 0) + Number(row.suma_lei || 0))
      })
      return Array.from(grouped.entries())
        .map(([label, value]) => ({ label, value, secondary: 'lei' }))
        .sort((a, b) => b.value - a.value)
    }

    if (reportType === 'profit_estimat') {
      return [
        { label: 'Venit total', value: kpi.revenue, secondary: 'lei' },
        { label: 'Costuri totale', value: kpi.cost, secondary: 'lei' },
        { label: 'Profit estimat', value: kpi.profit, secondary: 'lei' },
      ]
    }

    if (reportType === 'productivitate_parcela') {
      const grouped = new Map<string, number>()
      filteredRecoltari.forEach((row) => {
        const parcela = row.parcela_id ? parcelaMap[row.parcela_id] : null
        const key = parcela?.nume_parcela || 'Parcela necunoscuta'
        grouped.set(key, (grouped.get(key) ?? 0) + recoltareTotalKg(row))
      })
      return Array.from(grouped.entries())
        .map(([label, value]) => ({ label, value, secondary: 'kg' }))
        .sort((a, b) => b.value - a.value)
    }

    if (reportType === 'productivitate_culegator') {
      const grouped = new Map<string, number>()
      filteredRecoltari.forEach((row) => {
        const culegator = row.culegator_id ? culegatorMap[row.culegator_id] : null
        const key = culegator?.nume_prenume || culegator?.id_culegator || 'Culegator necunoscut'
        grouped.set(key, (grouped.get(key) ?? 0) + recoltareTotalKg(row))
      })
      return Array.from(grouped.entries())
        .map(([label, value]) => ({ label, value, secondary: 'kg' }))
        .sort((a, b) => b.value - a.value)
    }

    const grouped = new Map<string, number>()
    filteredVanzari.forEach((row) => {
      const key = row.client_id ? clientMap[row.client_id]?.nume_client || 'Client necunoscut' : 'Fără client'
      grouped.set(key, (grouped.get(key) ?? 0) + Number(row.cantitate_kg || 0) * Number(row.pret_lei_kg || 0))
    })
    return Array.from(grouped.entries())
      .map(([label, value]) => ({ label, value, secondary: 'lei' }))
      .sort((a, b) => b.value - a.value)
  }, [
    clientMap,
    culegatorMap,
    filteredCheltuieli,
    filteredRecoltari,
    filteredVanzari,
    kpi.cost,
    kpi.profit,
    kpi.revenue,
    parcelaMap,
    reportType,
  ])

  const chartRows = useMemo(() => reportRows.slice(0, 8), [reportRows])
  const maxChartValue = useMemo(
    () => Math.max(...chartRows.map((row) => row.value), 1),
    [chartRows]
  )

  const parcelaPerformance = useMemo<PerformanceRow[]>(() => {
    const grouped = new Map<string, { name: string; kgTotal: number; days: Set<string> }>()

    filteredRecoltari.forEach((row) => {
      const parcela = row.parcela_id ? parcelaMap[row.parcela_id] : null
      const key = row.parcela_id ?? 'unknown'
      const name = parcela?.nume_parcela || 'Parcela necunoscuta'
      const dayKey = new Date(row.data).toISOString().slice(0, 10)

      if (!grouped.has(key)) {
        grouped.set(key, { name, kgTotal: 0, days: new Set<string>() })
      }

      const item = grouped.get(key)!
      item.kgTotal += recoltareTotalKg(row)
      item.days.add(dayKey)
    })

    return Array.from(grouped.entries()).map(([id, item]) => ({
      id,
      name: item.name,
      kgTotal: item.kgTotal,
      kgPerDay: item.days.size > 0 ? item.kgTotal / item.days.size : 0,
      kgPerHour: null,
    }))
  }, [filteredRecoltari, parcelaMap])

  const culegatorPerformance = useMemo<PerformanceRow[]>(() => {
    const grouped = new Map<string, { name: string; kgTotal: number; days: Set<string> }>()

    filteredRecoltari.forEach((row) => {
      const culegator = row.culegator_id ? culegatorMap[row.culegator_id] : null
      const key = row.culegator_id ?? 'unknown'
      const name = culegator?.nume_prenume || culegator?.id_culegator || 'Culegator necunoscut'
      const dayKey = new Date(row.data).toISOString().slice(0, 10)

      if (!grouped.has(key)) {
        grouped.set(key, { name, kgTotal: 0, days: new Set<string>() })
      }

      const item = grouped.get(key)!
      item.kgTotal += recoltareTotalKg(row)
      item.days.add(dayKey)
    })

    return Array.from(grouped.entries()).map(([id, item]) => ({
      id,
      name: item.name,
      kgTotal: item.kgTotal,
      kgPerDay: item.days.size > 0 ? item.kgTotal / item.days.size : 0,
      kgPerHour: null,
    }))
  }, [culegatorMap, filteredRecoltari])

  const monthlyEvolution = useMemo(() => {
    const grouped = new Map<string, number>()
    filteredRecoltari.forEach((row) => {
      const date = new Date(row.data)
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      grouped.set(key, (grouped.get(key) ?? 0) + recoltareTotalKg(row))
    })

    return Array.from(grouped.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, value]) => ({
        key,
        label: key,
        value,
      }))
  }, [filteredRecoltari])

  const parcelaChart = useMemo(
    () =>
      [...parcelaPerformance]
        .sort((a, b) => b.kgTotal - a.kgTotal)
        .slice(0, 8)
        .map((row) => ({ label: row.name, value: row.kgTotal })),
    [parcelaPerformance]
  )

  const culegatorChart = useMemo(
    () =>
      [...culegatorPerformance]
        .sort((a, b) => b.kgTotal - a.kgTotal)
        .slice(0, 8)
        .map((row) => ({ label: row.name, value: row.kgTotal })),
    [culegatorPerformance]
  )

  const maxParcelaChart = useMemo(
    () => Math.max(...parcelaChart.map((row) => row.value), 1),
    [parcelaChart]
  )
  const maxCulegatorChart = useMemo(
    () => Math.max(...culegatorChart.map((row) => row.value), 1),
    [culegatorChart]
  )
  const maxMonthlyChart = useMemo(
    () => Math.max(...monthlyEvolution.map((row) => row.value), 1),
    [monthlyEvolution]
  )

  const numberFormatter = useMemo(
    () =>
      new Intl.NumberFormat('ro-RO', {
        maximumFractionDigits: 2,
      }),
    []
  )

  const currencyFormatter = useMemo(
    () =>
      new Intl.NumberFormat('ro-RO', {
        style: 'currency',
        currency: 'RON',
        maximumFractionDigits: 0,
      }),
    []
  )

  const reportLabel = {
    productie_totala: 'Producție totala (kg)',
    venit_total: 'Venit total',
    costuri_totale: 'Costuri totale',
    profit_estimat: 'Profit estimat',
    productivitate_parcela: 'Productivitate per parcelă',
    productivitate_culegator: 'Productivitate per culegator',
    vanzari_client: 'Vânzări per client',
  }[reportType]

  const exportRows = reportRows.map((row) => ({
    Indicator: row.label,
    Valoare: numberFormatter.format(row.value),
    Unitate: row.secondary ?? '',
  }))

  const exportCsv = () => {
    const headers = ['Indicator', 'Valoare', 'Unitate']
    const lines = [headers.join(',')]
    exportRows.forEach((row) => {
      lines.push(
        [row.Indicator, row.Valoare, row.Unitate]
          .map((v) => `"${String(v).replaceAll('"', '""')}"`)
          .join(',')
      )
    })
    downloadFile(
      `raport-${reportType}-${toInputDate(new Date())}.csv`,
      `\uFEFF${lines.join('\n')}`,
      'text/csv;charset=utf-8;'
    )
    trackEvent('export_raport', { format: 'csv', reportType, rows: exportRows.length })
  }

  const exportExcel = () => {
    const rowsHtml = exportRows
      .map(
        (row) =>
          `<tr><td>${row.Indicator}</td><td>${row.Valoare}</td><td>${row.Unitate}</td></tr>`
      )
      .join('')

    const html = `<!doctype html><html><head><meta charset="utf-8" /></head><body><h2>${reportLabel}</h2><table border="1"><thead><tr><th>Indicator</th><th>Valoare</th><th>Unitate</th></tr></thead><tbody>${rowsHtml}</tbody></table></body></html>`
    downloadFile(
      `raport-${reportType}-${toInputDate(new Date())}.xls`,
      html,
      'application/vnd.ms-excel'
    )
    trackEvent('export_raport', { format: 'excel', reportType, rows: exportRows.length })
  }

  const exportPdf = () => {
    const rowsHtml = exportRows
      .map((row) => `<tr><td>${row.Indicator}</td><td>${row.Valoare}</td><td>${row.Unitate}</td></tr>`)
      .join('')

    const html = `<!doctype html><html><head><meta charset="utf-8" /><title>${reportLabel}</title><style>body{font-family:Arial,sans-serif;padding:24px;color:#111}h1{margin:0 0 12px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #333;padding:8px;text-align:left}th{background:#e5e7eb}</style></head><body><h1>${reportLabel}</h1><p>Perioada: ${range.start.toLocaleDateString('ro-RO')} - ${range.end.toLocaleDateString('ro-RO')}</p><table><thead><tr><th>Indicator</th><th>Valoare</th><th>Unitate</th></tr></thead><tbody>${rowsHtml}</tbody></table></body></html>`

    const printWindow = window.open('', '_blank', 'width=960,height=720')
    if (!printWindow) return
    printWindow.document.write(html)
    printWindow.document.close()
    printWindow.focus()
    printWindow.print()
    trackEvent('export_raport', { format: 'pdf', reportType, rows: exportRows.length })
  }

  const exportSeasonCsv = () => {
    const seasonEnd = new Date(today)
    seasonEnd.setHours(23, 59, 59, 999)
    const seasonRows = initialRecoltari
      .filter((row) => {
        const date = new Date(row.data)
        return date >= seasonStart && date <= seasonEnd
      })
      .map((row) => {
        const parcela = row.parcela_id ? parcelaMap[row.parcela_id] : null
        const culegator = row.culegator_id ? culegatorMap[row.culegator_id] : null
        return {
          Data: new Date(row.data).toLocaleDateString('ro-RO'),
          Parcela: parcela?.nume_parcela || '-',
          Culegator: culegator?.nume_prenume || culegator?.id_culegator || '-',
          Kg: recoltareTotalKg(row).toFixed(2),
        }
      })

    const header = ['Data', 'Parcela', 'Culegator', 'Kg']
    const csvLines = [header.join(',')]
    seasonRows.forEach((row) => {
      csvLines.push(
        [row.Data, row.Parcela, row.Culegator, row.Kg]
          .map((cell) => `"${String(cell).replaceAll('"', '""')}"`)
          .join(',')
      )
    })

    downloadFile(
      `raport-sezon-complet-${toInputDate(today)}.csv`,
      `\uFEFF${csvLines.join('\n')}`,
      'text/csv;charset=utf-8;'
    )
    trackEvent('export_raport', { format: 'season_csv', reportType: 'sezon_complet', rows: seasonRows.length })
  }

  const exportTratamenteCsv = () => {
    const rows = initialActivitati
      .filter(
        (activitate) =>
          !!activitate.parcela_id &&
          (!!activitate.produs_utilizat ||
            !!activitate.tip_activitate ||
            Number(activitate.timp_pauza_zile || 0) > 0)
      )
      .map((activitate) => {
        const parcela = activitate.parcela_id ? parcelaMap[activitate.parcela_id] : null
        const pause = calculatePauseStatus(
          activitate.data_aplicare,
          Number(activitate.timp_pauza_zile || 0)
        )

        return {
          DataAplicare: new Date(activitate.data_aplicare).toLocaleDateString('ro-RO'),
          Parcela: parcela?.nume_parcela || 'Parcela necunoscuta',
          TipActivitate: activitate.tip_activitate || '',
          Produs: activitate.produs_utilizat || '',
          Doza: activitate.doza || '',
          TimpPauzaZile: String(activitate.timp_pauza_zile ?? 0),
          DataRecoltarePermisa: pause.dataRecoltarePermisa,
          StatusPauza: pause.status,
          Observatii: activitate.observatii || '',
        }
      })

    if (rows.length === 0) {
      toast.info('Nu exist? tratamente pentru export.')
      return
    }

    const headers = [
      'Data aplicare',
      'Parcela',
      'Tip activitate',
      'Produs',
      'Doza',
      'Timp pauza (zile)',
      'Data recoltare permisa',
      'Status pauza',
      'Observatii',
    ]

    const csvLines = [headers.join(',')]
    rows.forEach((row) => {
      csvLines.push(
        [
          row.DataAplicare,
          row.Parcela,
          row.TipActivitate,
          row.Produs,
          row.Doza,
          row.TimpPauzaZile,
          row.DataRecoltarePermisa,
          row.StatusPauza,
          row.Observatii,
        ]
          .map((cell) => `"${String(cell).replaceAll('"', '""')}"`)
          .join(',')
      )
    })

    downloadFile(
      `tratamente-parcele-${toInputDate(today)}.csv`,
      `\uFEFF${csvLines.join('\n')}`,
      'text/csv;charset=utf-8;'
    )
    trackEvent('export_raport', {
      format: 'tratamente_csv',
      reportType: 'tratamente_parcele',
      rows: rows.length,
    })
    toast.success('Export tratamente generat.')
  }

  return (
    <AppShell
      header={
        <PageHeader
          title="Rapoarte"
          subtitle="Analiza comerciala ți operationala"
          rightSlot={<BarChart3 className="h-5 w-5" />}
        />
      }
    >
      <div className="mx-auto mt-4 w-full max-w-5xl space-y-4 py-4 sm:mt-0">
        <section className="agri-card space-y-4 p-4">
          <div className="flex items-center gap-2 text-[var(--agri-text)]">
            <Filter className="h-4 w-4" />
            <h2 className="text-sm font-bold uppercase tracking-wide">Filtre raport</h2>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase text-[var(--agri-text-muted)]">Perioada</p>
            <div className="flex flex-wrap gap-2">
              {([
                ['zi', 'Zi'],
                ['luna', 'Luna'],
                ['sezon', 'Sezon'],
                ['custom', 'Custom'],
              ] as Array<[PeriodType, string]>).map(([value, label]) => {
                const active = periodType === value
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setPeriodType(value)}
                    style={{
                      minHeight: 34,
                      borderRadius: 20,
                      border: active ? 'none' : `1px solid ${colors.grayLight}`,
                      background: active ? colors.primary : colors.white,
                      color: active ? colors.white : colors.gray,
                      padding: '0 12px',
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase text-[var(--agri-text-muted)]">Cultura</p>
              <Select value={selectedCultura} onValueChange={setSelectedCultura}>
                <SelectTrigger className="agri-control h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toate culturile</SelectItem>
                  {cultures.map((culture) => (
                    <SelectItem key={culture} value={culture}>
                      {culture}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase text-[var(--agri-text-muted)]">Parcelă</p>
              <Select value={selectedParcelaId} onValueChange={setSelectedParcelaId}>
                <SelectTrigger className="agri-control h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toate parcelele</SelectItem>
                  {initialParcele.map((parcela) => (
                    <SelectItem key={parcela.id} value={parcela.id}>
                      {parcela.nume_parcela || 'Parcela'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase text-[var(--agri-text-muted)]">Tip raport</p>
              <Select value={reportType} onValueChange={(value) => setReportType(value as ReportType)}>
                <SelectTrigger className="agri-control h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="productie_totala">Producție totala (kg)</SelectItem>
                  <SelectItem value="venit_total">Venit total</SelectItem>
                  <SelectItem value="costuri_totale">Costuri totale</SelectItem>
                  <SelectItem value="profit_estimat">Profit estimat</SelectItem>
                  <SelectItem value="productivitate_parcela">Productivitate per parcelă</SelectItem>
                  <SelectItem value="productivitate_culegator">Productivitate per culegator</SelectItem>
                  <SelectItem value="vanzari_client">Vânzări per client</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {periodType === 'custom' ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase text-[var(--agri-text-muted)]">Data inceput</p>
                <Input
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="agri-control h-11"
                />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase text-[var(--agri-text-muted)]">Data sfarsit</p>
                <Input
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="agri-control h-11"
                />
              </div>
            </div>
          ) : null}
        </section>

        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MiniCard
            icon="💰"
            label="Venit total"
            value={currencyFormatter.format(kpi.revenue)}
            sub="RON"
            trend={{ value: Number(Math.abs(kpiTrend.venit).toFixed(0)), positive: kpiTrend.venit >= 0 }}
          />
          <div style={{ border: `1px solid ${colors.coral}`, borderRadius: radius.xl }}>
            <MiniCard
              icon="📉"
              label="Cheltuieli"
              value={currencyFormatter.format(kpi.cost)}
              sub="RON"
              trend={{ value: Number(Math.abs(kpiTrend.cheltuieli).toFixed(0)), positive: kpiTrend.cheltuieli <= 0 }}
            />
          </div>
          <div
            style={{
              background: colors.white,
              borderRadius: radius.xl,
              boxShadow: shadows.card,
              padding: `${spacing.lg}px`,
              minHeight: 110,
            }}
          >
            <div style={{ fontSize: 16, marginBottom: spacing.sm }}>📊</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: kpi.profit >= 0 ? colors.green : colors.coral }}>
              {currencyFormatter.format(kpi.profit)}
            </div>
            <div style={{ fontSize: 10, color: colors.gray, marginTop: spacing.xs }}>Profit</div>
          </div>
          <MiniCard
            icon="🫐"
            label="Producție"
            value={`${numberFormatter.format(kpi.productieKg)} kg`}
            sub="kg recoltat"
            trend={{ value: Number(Math.abs(kpiTrend.productie).toFixed(0)), positive: kpiTrend.productie >= 0 }}
          />
        </section>

        {monthlyFinancialRows.length > 0 ? (
          <section className="agri-card space-y-3 p-4">
            <h3 className="text-base font-semibold text-[var(--agri-text)]">Venit vs cheltuieli (max 6 luni)</h3>
            <svg width="100%" height="170" viewBox="0 0 600 170" role="img" aria-label="Grafic venit ți cheltuieli per luna">
              {monthlyFinancialRows.map((row, index) => {
                const groupWidth = 600 / monthlyFinancialRows.length
                const xBase = index * groupWidth + 18
                const chartHeight = 110
                const venitHeight = (row.venit / financialChartMax) * chartHeight
                const cheltHeight = (row.cheltuieli / financialChartMax) * chartHeight
                return (
                  <g key={row.key}>
                    <rect x={xBase} y={125 - venitHeight} width={20} height={Math.max(2, venitHeight)} fill={colors.green} rx={4} />
                    <rect x={xBase + 24} y={125 - cheltHeight} width={20} height={Math.max(2, cheltHeight)} fill={colors.coral} rx={4} />
                    <text x={xBase + 22} y={150} textAnchor="middle" fontSize="10" fill={colors.gray}>
                      {row.label}
                    </text>
                  </g>
                )
              })}
            </svg>
          </section>
        ) : null}

        <section className="agri-card space-y-4 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-base font-semibold text-[var(--agri-text)]">{reportLabel}</h3>
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="outline" className="h-10 rounded-[10px] border-[var(--agri-border)] bg-[var(--agri-surface-muted)] text-[var(--agri-text)]" onClick={exportCsv}>
                📥 CSV
              </Button>
              <Button type="button" variant="outline" className="h-10 rounded-[10px] border-[var(--agri-border)] bg-[var(--agri-surface-muted)] text-[var(--agri-text)]" onClick={exportExcel}>
                📥 Excel
              </Button>
              <Button type="button" variant="outline" className="agri-control h-11" onClick={exportPdf}>
                <FileText className="mr-1 h-4 w-4" />
                Export PDF
              </Button>
              <Button type="button" variant="outline" className="agri-control h-11" onClick={exportSeasonCsv}>
                <Download className="mr-1 h-4 w-4" />
                Export sezon complet
              </Button>
              <Button type="button" variant="outline" className="agri-control h-11" onClick={exportTratamenteCsv}>
                <Download className="mr-1 h-4 w-4" />
                Export tratamente
              </Button>
            </div>
          </div>

          {reportRows.length === 0 ? (
            <EmptyState
              title="Fără rezultate pentru filtrele curente"
              description="Ajusteaza perioada sau selectorii de cultura/parcelă."
            />
          ) : (
            <>
              <div className="space-y-2">
                {chartRows.map((row, index) => (
                  <div key={`${row.label}-${row.value}-${index}`} className="space-y-1">
                    <div className="flex items-center justify-between text-xs font-semibold text-[var(--agri-text-muted)]">
                      <span className="truncate pr-2">{row.label}</span>
                      <span>{numberFormatter.format(row.value)}</span>
                    </div>
                    <div className="h-3 rounded-full bg-[var(--agri-surface-muted)]">
                      <div
                        className="h-3 rounded-full bg-[var(--agri-primary)]"
                        style={{ width: `${Math.max((row.value / maxChartValue) * 100, 4)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="rounded-2xl border border-[var(--agri-border)]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Indicator</TableHead>
                      <TableHead className="text-right">Valoare</TableHead>
                      <TableHead className="text-right">Unitate</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reportRows.map((row) => (
                      <TableRow key={`${row.label}-${row.value}`}>
                        <TableCell className="font-medium text-[var(--agri-text)]">{row.label}</TableCell>
                        <TableCell className="text-right font-semibold text-[var(--agri-text)]">
                          {numberFormatter.format(row.value)}
                        </TableCell>
                        <TableCell className="text-right text-[var(--agri-text-muted)]">
                          {row.secondary ?? '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </section>
          <section className="agri-card space-y-4 p-4">
            <h3 className="text-base font-semibold text-[var(--agri-text)]">Analiza productivitate</h3>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <div className="space-y-2">
                <p className="text-sm font-semibold text-[var(--agri-text)]">Producție per parcelă</p>
                {parcelaChart.length === 0 ? (
                  <p className="text-sm text-[var(--agri-text-muted)]">Fără date.</p>
                ) : (
                  parcelaChart.map((row, index) => (
                    <div key={`${row.label}-${row.value}-${index}`} className="space-y-1">
                      <div className="flex items-center justify-between text-xs font-semibold text-[var(--agri-text-muted)]">
                        <span className="truncate pr-2">{row.label}</span>
                        <span>{numberFormatter.format(row.value)} kg</span>
                      </div>
                      <div className="h-3 rounded-full bg-[var(--agri-surface-muted)]">
                        <div
                          className="h-3 rounded-full bg-[var(--agri-primary)]"
                          style={{ width: `${Math.max((row.value / maxParcelaChart) * 100, 4)}%` }}
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="space-y-2">
                <p className="text-sm font-semibold text-[var(--agri-text)]">Producție per culegator</p>
                {culegatorChart.length === 0 ? (
                  <p className="text-sm text-[var(--agri-text-muted)]">Fără date.</p>
                ) : (
                  culegatorChart.map((row, index) => (
                    <div key={`${row.label}-${row.value}-${index}`} className="space-y-1">
                      <div className="flex items-center justify-between text-xs font-semibold text-[var(--agri-text-muted)]">
                        <span className="truncate pr-2">{row.label}</span>
                        <span>{numberFormatter.format(row.value)} kg</span>
                      </div>
                      <div className="h-3 rounded-full bg-[var(--agri-surface-muted)]">
                        <div
                          className="h-3 rounded-full bg-[var(--agri-primary)]"
                          style={{ width: `${Math.max((row.value / maxCulegatorChart) * 100, 4)}%` }}
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="space-y-2">
                <p className="text-sm font-semibold text-[var(--agri-text)]">Evolutie lunara</p>
                {monthlyEvolution.length === 0 ? (
                  <p className="text-sm text-[var(--agri-text-muted)]">Fără date.</p>
                ) : (
                  monthlyEvolution.map((row) => (
                    <div key={row.key} className="space-y-1">
                      <div className="flex items-center justify-between text-xs font-semibold text-[var(--agri-text-muted)]">
                        <span>{row.label}</span>
                        <span>{numberFormatter.format(row.value)} kg</span>
                      </div>
                      <div className="h-3 rounded-full bg-[var(--agri-surface-muted)]">
                        <div
                          className="h-3 rounded-full bg-[var(--agri-primary)]"
                          style={{ width: `${Math.max((row.value / maxMonthlyChart) * 100, 4)}%` }}
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <PerformanceTable title="Top parcele" rows={parcelaPerformance} />
            <PerformanceTable title="Top culegători" rows={culegatorPerformance} />
          </div>
      </div>
    </AppShell>
  )
}
