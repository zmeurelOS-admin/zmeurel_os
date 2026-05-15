import type { WorkBook } from 'xlsx'

import type { ProdusFitosanitar } from '@/lib/supabase/queries/tratamente'
import { fuzzyMatchProdus } from '@/lib/tratamente/import/fuzzy-match'
import {
  mapImportCohortTrigger,
  mapImportStage,
} from '@/lib/tratamente/import/template-spec'
import type {
  ParsedInterventieProdus,
  ParsedLine,
  ParsedPlan,
  ParseResult,
} from '@/lib/tratamente/import/types'
import { normalizeForSearch } from '@/lib/utils/string'

type SheetJsModule = typeof import('xlsx')

const V3_INTERVENTII_SHEET = 'Interventii'
const V3_INSTRUCTIUNI_SHEET = 'Instructiuni'

const DATA_START_ROW_INDEX = 2

const STAGE_ALIASES: Record<string, string> = {
  crestere_vegetativa: 'crestere_vegetativa',
  buton_verde: 'buton_verde',
  legare_fruct: 'legare_fruct',
  fruct_verde: 'fruct_verde',
  post_recoltare: 'post_recoltare',
}

const ZMEUR_STAGE_HINTS = new Set([
  'umflare_muguri',
  'buton_verde',
  'buton_roz',
  'inflorit',
  'scuturare_petale',
  'legare_fruct',
  'fruct_verde',
  'parga',
  'maturitate',
  'post_recoltare',
])

const ZMEUR_TIP_HINTS = new Set(['nutritie', 'foliar', 'biostimulare'])

function getCellText(rows: unknown[][], rowIndex: number, columnIndex: number): string {
  const value = rows[rowIndex]?.[columnIndex]
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number') return String(value)
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  return String(value ?? '').trim()
}

function normalizeSnakeCase(value: string): string {
  return normalizeForSearch(value)
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function normalizeStageInput(value: string): {
  raw: string
  normalized: string
  canonical: string | null
} {
  const raw = value.trim()
  const normalized = STAGE_ALIASES[normalizeSnakeCase(raw)] ?? normalizeSnakeCase(raw)
  const canonical = mapImportStage(normalized) ?? mapImportStage(raw)

  return {
    raw,
    normalized,
    canonical,
  }
}

function parsePositiveInteger(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const parsed = Number(trimmed.replace(',', '.'))
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

function parseRepeatRule(
  repeatRaw: string,
  intervalRaw: string
): {
  regula_repetare: 'fara_repetare' | 'interval'
  interval_repetare_zile: number | null
} {
  const repeat = normalizeSnakeCase(repeatRaw)
  const intervalFromColumn = parsePositiveInteger(intervalRaw)

  if (repeat === 'saptamanal') {
    return { regula_repetare: 'interval', interval_repetare_zile: 7 }
  }

  const explicitDays = repeat.match(/^la_(\d+)_zile$/)
  if (explicitDays?.[1]) {
    return {
      regula_repetare: 'interval',
      interval_repetare_zile: Number(explicitDays[1]),
    }
  }

  if (repeat === 'lunar') {
    return { regula_repetare: 'interval', interval_repetare_zile: 30 }
  }

  if (repeat === 'interval') {
    return {
      regula_repetare: 'interval',
      interval_repetare_zile: intervalFromColumn,
    }
  }

  return {
    regula_repetare: 'fara_repetare',
    interval_repetare_zile: null,
  }
}

function normalizeTipInterventie(value: string): string | null {
  const normalized = normalizeSnakeCase(value)
  return normalized || null
}

function parseCohortTrigger(value: string): 'floricane' | 'primocane' | null {
  const normalized = normalizeSnakeCase(value)
  if (!normalized || normalized === 'ambele') return null
  return mapImportCohortTrigger(normalized)
}

function isMonitoringProductName(value: string): boolean {
  const trimmed = value.trim()
  return trimmed.startsWith('—') || trimmed.startsWith('- ')
}

function buildParsedProduct(params: {
  produseBiblioteca: ProdusFitosanitar[]
  ordineProdus: number
  produsRaw: string
  dozaRaw: string
}): ParsedInterventieProdus | null {
  const produsInput = params.produsRaw.trim()
  if (!produsInput || isMonitoringProductName(produsInput)) {
    return null
  }

  const warnings: string[] = []
  const produsMatch = fuzzyMatchProdus(produsInput, params.produseBiblioteca)

  if (produsMatch.tip === 'fuzzy') {
    warnings.push('Produs detectat aproximativ. Alege explicit produsul corect la review.')
  } else if (produsMatch.tip === 'none') {
    warnings.push('Produs necunoscut. Poate fi creat în biblioteca fermei la salvarea finală.')
  }

  return {
    ordine_produs: params.ordineProdus,
    produs_input: produsInput,
    produs_match: produsMatch,
    substanta_activa: null,
    tip_produs: null,
    doza_ml_per_hl: null,
    doza_l_per_ha: null,
    phi_zile: null,
    frac_irac: null,
    salveaza_in_biblioteca: true,
    observatii: params.dozaRaw.trim() || null,
    warnings,
    errors: [],
  }
}

function buildProductsForRow(
  rows: unknown[][],
  rowIndex: number,
  produseBiblioteca: ProdusFitosanitar[]
): ParsedInterventieProdus[] {
  const productColumns = [
    [3, 4],
    [5, 6],
    [7, 8],
    [9, 10],
  ] as const

  return productColumns.flatMap(([nameColumn, doseColumn], index) => {
    const product = buildParsedProduct({
      produseBiblioteca,
      ordineProdus: index + 1,
      produsRaw: getCellText(rows, rowIndex, nameColumn),
      dozaRaw: getCellText(rows, rowIndex, doseColumn),
    })

    return product ? [product] : []
  })
}

function inferCultureTip(lines: ParsedLine[]): string | null {
  if (lines.length === 0) return null

  if (lines.some((line) => line.cohort_trigger === 'floricane' || line.cohort_trigger === 'primocane')) {
    return 'zmeur'
  }

  if (lines.some((line) => ZMEUR_STAGE_HINTS.has(line.stadiu_trigger))) {
    return 'zmeur'
  }

  const hintedTipCount = lines.filter((line) =>
    line.tip_interventie ? ZMEUR_TIP_HINTS.has(line.tip_interventie) : false
  ).length

  return hintedTipCount > lines.length / 2 ? 'zmeur' : null
}

function parseV3Workbook(
  workbook: WorkBook,
  produseBiblioteca: ProdusFitosanitar[],
  XLSX: SheetJsModule
): ParseResult {
  const interventiiSheet = workbook.Sheets[V3_INTERVENTII_SHEET]
  if (!interventiiSheet) {
    return {
      planuri: [],
      global_errors: ['Template V3 invalid: lipsește foaia „Interventii”.'],
    }
  }

  const rows = XLSX.utils.sheet_to_json<unknown[]>(interventiiSheet, {
    header: 1,
    raw: true,
    defval: null,
  }) as unknown[][]

  const globalWarnings: string[] = []
  const parsedLines: ParsedLine[] = []

  for (let rowIndex = DATA_START_ROW_INDEX; rowIndex < rows.length; rowIndex += 1) {
    const rowNumber = rowIndex + 1
    const stageRaw = getCellText(rows, rowIndex, 0)
    const scopeRaw = getCellText(rows, rowIndex, 2)

    if (!stageRaw && !scopeRaw) {
      continue
    }

    if (!stageRaw) {
      globalWarnings.push(`Rândul ${rowNumber}: fenofaza lipsă, ignorat.`)
      continue
    }

    const lineWarnings: string[] = []
    const stage = normalizeStageInput(stageRaw)
    const stadiuTrigger = stage.canonical ?? stage.normalized

    if (!stage.canonical) {
      lineWarnings.push(`Rândul ${rowNumber}: fenofaza „${stage.raw}” nu este în lista de stadii valide.`)
    }

    const scop = scopeRaw.trim() || null
    if (!scop) {
      lineWarnings.push(`Rândul ${rowNumber}: titlu intervenție lipsă.`)
    }

    const produse = buildProductsForRow(rows, rowIndex, produseBiblioteca)
    if (produse.length === 0) {
      lineWarnings.push(`Rândul ${rowNumber}: niciun produs pe această intervenție.`)
    }

    const repeat = parseRepeatRule(
      getCellText(rows, rowIndex, 11),
      getCellText(rows, rowIndex, 12)
    )
    const pragDecizional = getCellText(rows, rowIndex, 14)
    const observatiiGenerale = getCellText(rows, rowIndex, 15)
    const observatii = [pragDecizional, observatiiGenerale]
      .map((value) => value.trim())
      .filter(Boolean)
      .join(' | ')

    parsedLines.push({
      interventie_key: `v3-row-${rowNumber}`,
      ordine: parsedLines.length + 1,
      stadiu_trigger: stadiuTrigger,
      cohort_trigger: parseCohortTrigger(getCellText(rows, rowIndex, 13)),
      stadiu_input_raw: stage.raw,
      tip_interventie: normalizeTipInterventie(getCellText(rows, rowIndex, 1)),
      scop,
      regula_repetare: repeat.regula_repetare,
      interval_repetare_zile: repeat.interval_repetare_zile,
      numar_repetari_max: null,
      observatii: observatii || null,
      produse,
      warnings: lineWarnings,
      errors: [],
    })
  }

  if (parsedLines.length === 0) {
    return {
      planuri: [],
      global_errors: globalWarnings.length
        ? globalWarnings
        : ['Foaia „Interventii” nu conține nicio intervenție V3 importabilă.'],
    }
  }

  const plan: ParsedPlan = {
    foaie_nume: V3_INTERVENTII_SHEET,
    plan_metadata: {
      nume_sugerat: 'Plan de tratamente',
      cultura_tip_detectat: inferCultureTip(parsedLines),
      descriere: null,
    },
    linii: parsedLines,
    errors: [],
  }

  return {
    planuri: [plan],
    global_errors: globalWarnings,
  }
}

export async function parseImportedPlansWorkbook(
  buffer: ArrayBuffer,
  produse: ProdusFitosanitar[]
): Promise<ParseResult> {
  const XLSX = await import('xlsx')
  const workbook: WorkBook = XLSX.read(buffer, {
    type: 'array',
    cellFormula: false,
  })

  const importableSheetNames = workbook.SheetNames.filter(
    (sheetName) => sheetName !== V3_INSTRUCTIUNI_SHEET
  )

  if (!importableSheetNames.includes(V3_INTERVENTII_SHEET)) {
    return {
      planuri: [],
      global_errors: ['Template V3 invalid: lipsește foaia „Interventii”.'],
    }
  }

  return parseV3Workbook(workbook, produse, XLSX)
}
