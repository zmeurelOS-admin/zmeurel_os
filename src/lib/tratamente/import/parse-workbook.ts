import { isValidCropCod } from '@/lib/crops/crop-codes'
import type { WorkBook, WorkSheet } from 'xlsx'

import type { ProdusFitosanitar } from '@/lib/supabase/queries/tratamente'
import { fuzzyMatchProdus } from '@/lib/tratamente/import/fuzzy-match'
import {
  mapImportCohortTrigger,
  mapImportCulture,
  mapImportRegulaRepetare,
  mapImportStage,
  mapImportTipInterventie,
  SHEET_NAMES_RESERVED,
  TIP_PRODUS_VALUES,
} from '@/lib/tratamente/import/template-spec'
import type {
  ParsedInterventieProdus,
  ParsedLine,
  ParsedPlan,
  ParseResult,
} from '@/lib/tratamente/import/types'
import {
  getGrupBiologicForCropCod,
  isStadiuValidPentruGrup,
} from '@/lib/tratamente/stadii-canonic'
import { normalizeForSearch } from '@/lib/utils/string'

type SheetJsModule = typeof import('xlsx')

const V2_INTERVENTII_SHEET = 'Interventii'
const V2_PRODUSE_SHEET = 'Produse interventii'

function getCellText(rows: unknown[][], rowIndex: number, columnIndex: number): string {
  const value = rows[rowIndex]?.[columnIndex]
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number') return String(value)
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  return String(value ?? '').trim()
}

function isCompletelyEmpty(values: string[]) {
  return values.every((value) => value.trim().length === 0)
}

function canonicalHeader(value: string): string {
  return normalizeForSearch(value).replace(/\s+/g, '_')
}

function buildHeaderMap(rows: unknown[][]): Map<string, number> {
  const headerRow = rows[0] ?? []
  const map = new Map<string, number>()
  headerRow.forEach((value, index) => {
    const header = canonicalHeader(String(value ?? ''))
    if (header) map.set(header, index)
  })
  return map
}

function getByHeader(rows: unknown[][], headers: Map<string, number>, rowIndex: number, key: string): string {
  const index = headers.get(key)
  return typeof index === 'number' ? getCellText(rows, rowIndex, index) : ''
}

function parseNumberCell(value: string): { value: number | null; invalid: boolean; negative: boolean } {
  const trimmed = value.trim()
  if (!trimmed) {
    return { value: null, invalid: false, negative: false }
  }

  if (/^\d{1,3}(\.\d{3})+$/.test(trimmed)) {
    return { value: null, invalid: true, negative: false }
  }

  const parsed = Number(trimmed.replace(',', '.'))
  if (!Number.isFinite(parsed)) {
    return { value: null, invalid: true, negative: false }
  }

  if (parsed < 0) {
    return { value: parsed, invalid: false, negative: true }
  }

  return { value: parsed, invalid: false, negative: false }
}

function parseIntegerCell(value: string): { value: number | null; invalid: boolean } {
  const trimmed = value.trim()
  if (!trimmed) return { value: null, invalid: false }
  const parsed = Number(trimmed)
  return Number.isInteger(parsed) ? { value: parsed, invalid: false } : { value: null, invalid: true }
}

function parseBooleanCell(value: string): boolean {
  const normalized = normalizeForSearch(value)
  return normalized === 'da' || normalized === 'true' || normalized === '1' || normalized === 'yes'
}

function addPlanError(
  planErrors: Array<{ row: number; message: string }>,
  row: number,
  message: string
) {
  planErrors.push({ row, message })
}

function validateLegacyHeader(rows: unknown[][]): string | null {
  const actual = [0, 1, 2, 3].map((columnIndex) =>
    normalizeForSearch(getCellText(rows, 3, columnIndex))
  )
  const isLegacy = actual[0] === 'ordine' && actual[1] === 'stadiu' && actual[2] === 'produs'
  const isExtended =
    actual[0] === 'ordine' &&
    actual[1] === 'stadiu' &&
    actual[2] === 'cohorta trigger' &&
    actual[3] === 'produs'

  return isLegacy || isExtended
    ? null
    : 'Header invalid pe rândul 4. Pentru V2 folosește foile „Interventii” și „Produse interventii”; pentru legacy, coloanele trebuie să înceapă cu „Ordine”, „Stadiu” și opțional „Cohortă trigger”, apoi „Produs”.'
}

function buildParsedProduct(params: {
  produse: ProdusFitosanitar[]
  ordineProdus: number
  produsRaw: string
  substantaActiva?: string | null
  tipProdus?: string | null
  dozaMlRaw: string
  dozaLRaw: string
  phiRaw?: string
  fracRaw?: string
  salveazaInBiblioteca?: boolean
  observatii?: string | null
  rowNumber: number
  planErrors: Array<{ row: number; message: string }>
}): ParsedInterventieProdus {
  const errors: string[] = []
  const warnings: string[] = []
  const produsInput = params.produsRaw.trim()

  if (!Number.isInteger(params.ordineProdus) || params.ordineProdus < 1) {
    errors.push('Ordinea produsului trebuie să fie un număr întreg mai mare sau egal cu 1.')
    addPlanError(params.planErrors, params.rowNumber, 'Ordinea produsului este invalidă.')
  }

  if (!produsInput) {
    errors.push('Produsul este obligatoriu.')
    addPlanError(params.planErrors, params.rowNumber, 'Produsul este obligatoriu.')
  }

  const dozaMl = parseNumberCell(params.dozaMlRaw)
  const dozaL = parseNumberCell(params.dozaLRaw)
  if (dozaMl.invalid || dozaL.invalid) {
    errors.push('Doza trebuie să fie un număr valid. Valorile text de tip „1.500” nu sunt acceptate.')
    addPlanError(params.planErrors, params.rowNumber, 'Doza trebuie să fie un număr valid.')
  }
  if (dozaMl.negative || dozaL.negative) {
    errors.push('Doza nu poate fi negativă.')
    addPlanError(params.planErrors, params.rowNumber, 'Doza nu poate fi negativă.')
  }

  const phi = parseIntegerCell(params.phiRaw ?? '')
  if (phi.invalid || (typeof phi.value === 'number' && phi.value < 0)) {
    errors.push('PHI zile trebuie să fie un număr întreg mai mare sau egal cu 0.')
    addPlanError(params.planErrors, params.rowNumber, 'PHI zile este invalid.')
  }

  const tipProdusRaw = params.tipProdus?.trim() ?? ''
  const tipProdus = TIP_PRODUS_VALUES.includes(tipProdusRaw as (typeof TIP_PRODUS_VALUES)[number])
    ? (tipProdusRaw as ProdusFitosanitar['tip'])
    : null
  if (tipProdusRaw && !tipProdus) {
    warnings.push('Tip produs necunoscut. Va fi păstrat doar ca produs manual dacă nu alegi din bibliotecă.')
  }

  const produsMatch = produsInput
    ? fuzzyMatchProdus(produsInput, params.produse)
    : { tip: 'none' as const }

  if (produsMatch.tip === 'fuzzy') {
    warnings.push('Produs detectat aproximativ. Alege explicit produsul corect la review.')
  } else if (produsMatch.tip === 'none' && produsInput) {
    warnings.push('Produs necunoscut. Poate rămâne manual sau poate fi creat în biblioteca fermei la review.')
  }

  return {
    ordine_produs: params.ordineProdus,
    produs_input: produsInput,
    produs_match: produsMatch,
    substanta_activa: params.substantaActiva?.trim() || null,
    tip_produs: tipProdus,
    doza_ml_per_hl: dozaMl.value,
    doza_l_per_ha: dozaL.value,
    phi_zile: phi.value,
    frac_irac: params.fracRaw?.trim() || null,
    salveaza_in_biblioteca: params.salveazaInBiblioteca ?? false,
    observatii: params.observatii?.trim() || null,
    warnings,
    errors,
  }
}

function parseLegacySheetRows(
  sheetName: string,
  sheet: WorkSheet,
  produse: ProdusFitosanitar[],
  XLSX: SheetJsModule
): ParsedPlan {
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    raw: true,
    defval: null,
  }) as unknown[][]
  const culturaDetectata = mapImportCulture(getCellText(rows, 0, 1))
  const grupBiologic =
    culturaDetectata && isValidCropCod(culturaDetectata)
      ? getGrupBiologicForCropCod(culturaDetectata)
      : null

  const planErrors: Array<{ row: number; message: string }> = []
  const headerError = validateLegacyHeader(rows)
  if (headerError) {
    addPlanError(planErrors, 4, headerError)
    return {
      foaie_nume: sheetName,
      plan_metadata: {
        nume_sugerat: sheetName,
        cultura_tip_detectat: culturaDetectata,
        descriere: getCellText(rows, 1, 1) || null,
      },
      linii: [],
      errors: planErrors,
    }
  }

  const parsedLines: ParsedLine[] = []

  for (let rowIndex = 4; rowIndex < rows.length; rowIndex += 1) {
    const rowNumber = rowIndex + 1
    const hasExtendedHeader = normalizeForSearch(getCellText(rows, 3, 2)) === 'cohorta trigger'
    const rowValues = (hasExtendedHeader ? [0, 1, 2, 3, 4, 5, 6] : [0, 1, 2, 3, 4, 5]).map((columnIndex) =>
      getCellText(rows, rowIndex, columnIndex)
    )

    if (isCompletelyEmpty(rowValues)) {
      break
    }

    const [ordineRaw, stadiuRaw, cohortRaw, produsRawMaybe, dozaMlRawMaybe, dozaLRawMaybe, observatiiRawMaybe] = hasExtendedHeader
      ? rowValues
      : [rowValues[0], rowValues[1], '', rowValues[2], rowValues[3], rowValues[4], rowValues[5]]
    const lineErrors: string[] = []
    const lineWarnings: string[] = ['Format legacy detectat: linia a fost convertită intern în intervenție V2 cu un singur produs.']

    const ordine = Number.parseInt(ordineRaw, 10)
    if (!ordineRaw || !Number.isInteger(ordine) || ordine < 1) {
      lineErrors.push('Ordinea trebuie să fie un număr întreg mai mare sau egal cu 1.')
      addPlanError(planErrors, rowNumber, 'Ordinea trebuie să fie un număr întreg mai mare sau egal cu 1.')
    }

    const stadiuTrigger = mapImportStage(stadiuRaw) ?? ''
    if (!stadiuTrigger) {
      lineErrors.push('Stadiul nu este valid. Folosește una dintre valorile din template.')
      addPlanError(planErrors, rowNumber, 'Stadiul nu este valid.')
    } else if (grupBiologic && !isStadiuValidPentruGrup(stadiuTrigger, grupBiologic)) {
      lineWarnings.push(
        'Stadiul nu este tipic pentru cultura detectată în această foaie. Verifică profilul biologic înainte de import.'
      )
    }

    const cohortTrigger = mapImportCohortTrigger(cohortRaw)
    if (cohortRaw.trim() && !cohortTrigger) {
      lineWarnings.push('Cohortă trigger invalidă. Valorile acceptate sunt doar "floricane" sau "primocane".')
    } else if (cohortTrigger && grupBiologic !== 'rubus') {
      lineWarnings.push('Cohorta este relevantă doar pentru Rubus. Verifică dacă foaia țintește o cultură Rubus mixtă.')
    }

    const product = buildParsedProduct({
      produse,
      ordineProdus: 1,
      produsRaw: produsRawMaybe ?? '',
      dozaMlRaw: dozaMlRawMaybe ?? '',
      dozaLRaw: dozaLRawMaybe ?? '',
      observatii: observatiiRawMaybe ?? '',
      rowNumber,
      planErrors,
    })

    parsedLines.push({
      interventie_key: `${sheetName}-${ordine || rowNumber}`,
      ordine: Number.isInteger(ordine) && ordine >= 1 ? ordine : rowNumber - 4,
      stadiu_trigger: stadiuTrigger,
      cohort_trigger: cohortTrigger,
      stadiu_input_raw: stadiuRaw,
      tip_interventie: null,
      scop: null,
      regula_repetare: 'fara_repetare',
      interval_repetare_zile: null,
      numar_repetari_max: null,
      observatii: observatiiRawMaybe || null,
      produse: [product],
      warnings: lineWarnings,
      errors: lineErrors,
    })
  }

  return {
    foaie_nume: sheetName,
    plan_metadata: {
      nume_sugerat: sheetName,
      cultura_tip_detectat: culturaDetectata,
      descriere: getCellText(rows, 1, 1) || null,
    },
    linii: parsedLines,
    errors: planErrors,
  }
}

function parseV2Workbook(
  workbook: WorkBook,
  produse: ProdusFitosanitar[],
  XLSX: SheetJsModule
): ParseResult {
  const interventiiSheet = workbook.Sheets[V2_INTERVENTII_SHEET]
  const produseSheet = workbook.Sheets[V2_PRODUSE_SHEET]
  if (!interventiiSheet || !produseSheet) {
    return {
      planuri: [],
      global_errors: ['Template V2 invalid: lipsesc foile „Interventii” și/sau „Produse interventii”.'],
    }
  }

  const interventiiRows = XLSX.utils.sheet_to_json<unknown[]>(interventiiSheet, {
    header: 1,
    raw: true,
    defval: null,
  }) as unknown[][]
  const produseRows = XLSX.utils.sheet_to_json<unknown[]>(produseSheet, {
    header: 1,
    raw: true,
    defval: null,
  }) as unknown[][]

  const interventiiHeaders = buildHeaderMap(interventiiRows)
  const produseHeaders = buildHeaderMap(produseRows)
  const globalErrors: string[] = []
  const requiredInterventii = ['plan_nume', 'cultura', 'interventie_key', 'ordine', 'stadiu']
  const requiredProduse = ['interventie_key', 'ordine_produs', 'produs']
  const missingInterventii = requiredInterventii.filter((key) => !interventiiHeaders.has(key))
  const missingProduse = requiredProduse.filter((key) => !produseHeaders.has(key))

  if (missingInterventii.length > 0) {
    globalErrors.push(`Foaia «Interventii» nu are coloanele obligatorii: ${missingInterventii.join(', ')}.`)
  }
  if (missingProduse.length > 0) {
    globalErrors.push(`Foaia «Produse interventii» nu are coloanele obligatorii: ${missingProduse.join(', ')}.`)
  }
  if (globalErrors.length > 0) {
    return { planuri: [], global_errors: globalErrors }
  }

  const planErrorsByName = new Map<string, Array<{ row: number; message: string }>>()
  const planMeta = new Map<string, { cultura: string | null; descriere: string | null }>()
  const seenKeys = new Map<string, number>()
  const interventions = new Map<string, ParsedLine & { plan_nume: string }>()

  for (let rowIndex = 1; rowIndex < interventiiRows.length; rowIndex += 1) {
    const rowNumber = rowIndex + 1
    const rowValues = Array.from(interventiiHeaders.values()).map((columnIndex) => getCellText(interventiiRows, rowIndex, columnIndex))
    if (isCompletelyEmpty(rowValues)) continue

    const planName = getByHeader(interventiiRows, interventiiHeaders, rowIndex, 'plan_nume').trim()
    const culturaRaw = getByHeader(interventiiRows, interventiiHeaders, rowIndex, 'cultura')
    const interventieKey = getByHeader(interventiiRows, interventiiHeaders, rowIndex, 'interventie_key').trim()
    const errors = planName ? (planErrorsByName.get(planName) ?? []) : []
    if (planName && !planErrorsByName.has(planName)) planErrorsByName.set(planName, errors)

    if (!planName) {
      globalErrors.push(`Rândul ${rowNumber} din «Interventii»: plan_nume este obligatoriu.`)
      continue
    }
    if (!interventieKey) {
      addPlanError(errors, rowNumber, 'interventie_key este obligatorie.')
      continue
    }
    if (seenKeys.has(interventieKey)) {
      addPlanError(errors, rowNumber, `interventie_key duplicată: ${interventieKey}. Prima apariție este pe rândul ${seenKeys.get(interventieKey)}.`)
      continue
    }
    seenKeys.set(interventieKey, rowNumber)

    const cultura = mapImportCulture(culturaRaw)
    if (!cultura) {
      addPlanError(errors, rowNumber, 'Cultura nu este validă.')
    }
    const existingMeta = planMeta.get(planName)
    if (!existingMeta) {
      planMeta.set(planName, {
        cultura,
        descriere: getByHeader(interventiiRows, interventiiHeaders, rowIndex, 'observatii_plan') || null,
      })
    } else if (existingMeta.cultura && cultura && existingMeta.cultura !== cultura) {
      addPlanError(errors, rowNumber, 'Același plan are culturi diferite pe rânduri diferite.')
    }

    const grupBiologic = cultura && isValidCropCod(cultura) ? getGrupBiologicForCropCod(cultura) : null
    const ordineRaw = getByHeader(interventiiRows, interventiiHeaders, rowIndex, 'ordine')
    const ordine = Number.parseInt(ordineRaw, 10)
    const lineErrors: string[] = []
    const lineWarnings: string[] = []
    if (!ordineRaw || !Number.isInteger(ordine) || ordine < 1) {
      lineErrors.push('Ordinea trebuie să fie un număr întreg mai mare sau egal cu 1.')
      addPlanError(errors, rowNumber, 'Ordinea trebuie să fie un număr întreg mai mare sau egal cu 1.')
    }

    const stadiuRaw = getByHeader(interventiiRows, interventiiHeaders, rowIndex, 'stadiu')
    const stadiuTrigger = mapImportStage(stadiuRaw) ?? ''
    if (!stadiuTrigger) {
      lineErrors.push('Stadiul nu este valid.')
      addPlanError(errors, rowNumber, 'Stadiul nu este valid.')
    } else if (grupBiologic && !isStadiuValidPentruGrup(stadiuTrigger, grupBiologic)) {
      lineWarnings.push('Stadiul nu este tipic pentru cultura detectată în acest plan.')
    }

    const cohortRaw = getByHeader(interventiiRows, interventiiHeaders, rowIndex, 'cohorta_trigger')
    const cohortTrigger = mapImportCohortTrigger(cohortRaw)
    if (cohortRaw.trim() && !cohortTrigger) {
      lineErrors.push('Cohorta trigger este invalidă.')
      addPlanError(errors, rowNumber, 'Cohorta trigger este invalidă.')
    } else if (cohortTrigger && grupBiologic !== 'rubus') {
      lineWarnings.push('Cohorta este relevantă doar pentru Rubus.')
    }

    const tipRaw = getByHeader(interventiiRows, interventiiHeaders, rowIndex, 'tip_interventie')
    const tipInterventie = tipRaw.trim() ? mapImportTipInterventie(tipRaw) : null
    if (tipRaw.trim() && !tipInterventie) {
      lineErrors.push('Tipul intervenției nu este valid.')
      addPlanError(errors, rowNumber, 'Tipul intervenției nu este valid.')
    }

    const regulaRaw = getByHeader(interventiiRows, interventiiHeaders, rowIndex, 'regula_repetare')
    const regulaRepetare = mapImportRegulaRepetare(regulaRaw)
    if (!regulaRepetare) {
      lineErrors.push('Regula de repetare nu este validă.')
      addPlanError(errors, rowNumber, 'Regula de repetare nu este validă.')
    }
    const interval = parseIntegerCell(getByHeader(interventiiRows, interventiiHeaders, rowIndex, 'interval_repetare_zile'))
    const repeatMax = parseIntegerCell(getByHeader(interventiiRows, interventiiHeaders, rowIndex, 'numar_repetari_max'))
    if (interval.invalid || (typeof interval.value === 'number' && interval.value < 1)) {
      lineErrors.push('Intervalul de repetare trebuie să fie un număr întreg >= 1.')
      addPlanError(errors, rowNumber, 'Intervalul de repetare este invalid.')
    }
    if (repeatMax.invalid || (typeof repeatMax.value === 'number' && repeatMax.value < 1)) {
      lineErrors.push('Numărul maxim de repetări trebuie să fie un număr întreg >= 1.')
      addPlanError(errors, rowNumber, 'Numărul maxim de repetări este invalid.')
    }
    if (regulaRepetare === 'interval' && interval.value == null) {
      lineErrors.push('Pentru regula interval, interval_repetare_zile este obligatoriu.')
      addPlanError(errors, rowNumber, 'Pentru regula interval, interval_repetare_zile este obligatoriu.')
    }

    interventions.set(interventieKey, {
      plan_nume: planName,
      interventie_key: interventieKey,
      ordine: Number.isInteger(ordine) && ordine >= 1 ? ordine : rowNumber - 1,
      stadiu_trigger: stadiuTrigger,
      cohort_trigger: cohortTrigger,
      stadiu_input_raw: stadiuRaw,
      tip_interventie: tipInterventie,
      scop: getByHeader(interventiiRows, interventiiHeaders, rowIndex, 'scop') || null,
      regula_repetare: regulaRepetare ?? 'fara_repetare',
      interval_repetare_zile: interval.value,
      numar_repetari_max: repeatMax.value,
      observatii: getByHeader(interventiiRows, interventiiHeaders, rowIndex, 'observatii') || null,
      produse: [],
      warnings: lineWarnings,
      errors: lineErrors,
    })
  }

  for (let rowIndex = 1; rowIndex < produseRows.length; rowIndex += 1) {
    const rowNumber = rowIndex + 1
    const rowValues = Array.from(produseHeaders.values()).map((columnIndex) => getCellText(produseRows, rowIndex, columnIndex))
    if (isCompletelyEmpty(rowValues)) continue

    const interventieKey = getByHeader(produseRows, produseHeaders, rowIndex, 'interventie_key').trim()
    const intervention = interventions.get(interventieKey)
    if (!interventieKey || !intervention) {
      globalErrors.push(`Rândul ${rowNumber} din «Produse interventii»: interventie_key lipsește sau nu există în foaia «Interventii».`)
      continue
    }

    const errors = planErrorsByName.get(intervention.plan_nume) ?? []
    const ordineProdusRaw = getByHeader(produseRows, produseHeaders, rowIndex, 'ordine_produs')
    const ordineProdus = Number.parseInt(ordineProdusRaw, 10)
    const product = buildParsedProduct({
      produse,
      ordineProdus: Number.isInteger(ordineProdus) ? ordineProdus : intervention.produse.length + 1,
      produsRaw: getByHeader(produseRows, produseHeaders, rowIndex, 'produs'),
      substantaActiva: getByHeader(produseRows, produseHeaders, rowIndex, 'substanta_activa'),
      tipProdus: getByHeader(produseRows, produseHeaders, rowIndex, 'tip_produs'),
      dozaMlRaw: getByHeader(produseRows, produseHeaders, rowIndex, 'doza_ml_per_hl'),
      dozaLRaw: getByHeader(produseRows, produseHeaders, rowIndex, 'doza_l_per_ha'),
      phiRaw: getByHeader(produseRows, produseHeaders, rowIndex, 'phi_zile'),
      fracRaw: getByHeader(produseRows, produseHeaders, rowIndex, 'frac_irac'),
      salveazaInBiblioteca: parseBooleanCell(getByHeader(produseRows, produseHeaders, rowIndex, 'salveaza_in_biblioteca')),
      observatii: getByHeader(produseRows, produseHeaders, rowIndex, 'observatii'),
      rowNumber,
      planErrors: errors,
    })
    if (intervention.produse.some((existingProduct) => existingProduct.ordine_produs === product.ordine_produs)) {
      product.errors.push('Ordinea produsului este duplicată în aceeași intervenție.')
      addPlanError(errors, rowNumber, 'Ordinea produsului este duplicată în aceeași intervenție.')
    }
    intervention.produse.push(product)
  }

  const plans = new Map<string, ParsedPlan>()
  for (const intervention of interventions.values()) {
    const planName = intervention.plan_nume
    const errors = planErrorsByName.get(planName) ?? []
    if (intervention.produse.length === 0) {
      intervention.errors.push('Intervenția trebuie să aibă minimum un produs în foaia «Produse interventii».')
      addPlanError(errors, intervention.ordine + 1, `Intervenția ${intervention.interventie_key} nu are produse.`)
    }

    const meta = planMeta.get(planName)
    if (!plans.has(planName)) {
      plans.set(planName, {
        foaie_nume: V2_INTERVENTII_SHEET,
        plan_metadata: {
          nume_sugerat: planName,
          cultura_tip_detectat: meta?.cultura ?? null,
          descriere: meta?.descriere ?? null,
        },
        linii: [],
        errors,
      })
    }
    plans.get(planName)?.linii.push(intervention)
  }

  return {
    planuri: Array.from(plans.values()).map((plan) => ({
      ...plan,
      linii: plan.linii.sort((first, second) => first.ordine - second.ordine),
    })),
    global_errors: globalErrors,
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

  if (workbook.SheetNames.includes(V2_INTERVENTII_SHEET) || workbook.SheetNames.includes(V2_PRODUSE_SHEET)) {
    return parseV2Workbook(workbook, produse, XLSX)
  }

  const importableSheets = workbook.SheetNames.filter(
    (sheetName) => !SHEET_NAMES_RESERVED.includes(sheetName as (typeof SHEET_NAMES_RESERVED)[number])
  )

  if (importableSheets.length === 0) {
    return {
      planuri: [],
      global_errors: ['Nu am găsit nicio foaie de plan importabilă în fișier.'],
    }
  }

  const parsedPlans = importableSheets
    .map((sheetName) => ({
      sheetName,
      sheet: workbook.Sheets[sheetName],
    }))
    .filter((item) => Boolean(item.sheet))
    .map((item) => parseLegacySheetRows(item.sheetName, item.sheet, produse, XLSX))

  const globalErrors: string[] = [
    'Format legacy detectat. Importul este păstrat temporar, dar template-ul oficial Zmeurel este V2.',
  ]
  const filteredPlans = parsedPlans.filter((plan) => {
    const hasNoMetadata =
      !plan.plan_metadata.cultura_tip_detectat && !plan.plan_metadata.descriere
    const isUntouchedTemplate =
      plan.linii.length === 0 && plan.errors.length === 0 && hasNoMetadata

    if (!isUntouchedTemplate) {
      if (plan.linii.length === 0 && plan.errors.length === 0) {
        globalErrors.push(
          `Foaia «${plan.foaie_nume}» nu conține nicio linie de tratament și va necesita completare în review.`
        )
      }
      return true
    }

    if (plan.foaie_nume === 'Plan') {
      globalErrors.push('Foaia «Plan» a fost lăsată goală și a fost ignorată.')
      return false
    }

    globalErrors.push(
      `Foaia «${plan.foaie_nume}» nu conține nicio linie de tratament și va necesita completare în review.`
    )
    return true
  })

  return {
    planuri: filteredPlans,
    global_errors: globalErrors,
  }
}
