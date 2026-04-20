import { isValidCropCod } from '@/lib/crops/crop-codes'
import type { WorkBook, WorkSheet } from 'xlsx'

import type { ProdusFitosanitar } from '@/lib/supabase/queries/tratamente'
import { fuzzyMatchProdus } from '@/lib/tratamente/import/fuzzy-match'
import {
  mapImportCohortTrigger,
  mapImportCulture,
  mapImportStage,
  SHEET_NAMES_RESERVED,
} from '@/lib/tratamente/import/template-spec'
import type { ParsedLine, ParsedPlan, ParseResult } from '@/lib/tratamente/import/types'
import {
  getGrupBiologicForCropCod,
  isStadiuValidPentruGrup,
} from '@/lib/tratamente/stadii-canonic'
import { normalizeForSearch } from '@/lib/utils/string'

type SheetJsModule = typeof import('xlsx')

function getCellText(rows: unknown[][], rowIndex: number, columnIndex: number): string {
  const value = rows[rowIndex]?.[columnIndex]
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number') return String(value)
  return String(value ?? '').trim()
}

function isCompletelyEmpty(values: string[]) {
  return values.every((value) => value.trim().length === 0)
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

function addPlanError(
  planErrors: Array<{ row: number; message: string }>,
  row: number,
  message: string
) {
  planErrors.push({ row, message })
}

function validateHeader(rows: unknown[][]): string | null {
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
    : 'Header invalid pe rândul 4. Coloanele trebuie să înceapă cu „Ordine”, „Stadiu” și opțional „Cohortă trigger”, apoi „Produs”.'
}

function parseSheetRows(
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
  const headerError = validateHeader(rows)
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
    const produsRaw = produsRawMaybe ?? ''
    const dozaMlRaw = dozaMlRawMaybe ?? ''
    const dozaLRaw = dozaLRawMaybe ?? ''
    const observatiiRaw = observatiiRawMaybe ?? ''
    const lineErrors: string[] = []
    const lineWarnings: string[] = []

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

    const produsInput = produsRaw.trim()
    if (!produsInput) {
      lineErrors.push('Produsul este obligatoriu.')
      addPlanError(planErrors, rowNumber, 'Produsul este obligatoriu.')
    }

    const dozaMl = parseNumberCell(dozaMlRaw)
    const dozaL = parseNumberCell(dozaLRaw)
    if (dozaMl.invalid || dozaL.invalid) {
      lineErrors.push('Doza trebuie să fie un număr valid. Valorile text de tip „1.500” nu sunt acceptate.')
      addPlanError(planErrors, rowNumber, 'Doza trebuie să fie un număr valid.')
    }
    if (dozaMl.negative || dozaL.negative) {
      lineErrors.push('Doza nu poate fi negativă.')
      addPlanError(planErrors, rowNumber, 'Doza nu poate fi negativă.')
    }
    if (
      (dozaMl.value != null && dozaL.value != null) ||
      (dozaMl.value == null && dozaL.value == null)
    ) {
      lineErrors.push('Completează exact una dintre doze: ml/hl sau l/ha.')
      addPlanError(planErrors, rowNumber, 'Completează exact una dintre doze: ml/hl sau l/ha.')
    }

    const produsMatch = produsInput
      ? fuzzyMatchProdus(produsInput, produse)
      : { tip: 'none' as const }

    if (produsMatch.tip === 'fuzzy') {
      lineWarnings.push('Produs detectat aproximativ. Alege explicit produsul corect la review.')
    } else if (produsMatch.tip === 'none' && produsInput) {
      lineWarnings.push('Produs necunoscut. Va trebui ales din bibliotecă, creat sau salvat ca text liber.')
    }

    parsedLines.push({
      ordine: Number.isInteger(ordine) && ordine >= 1 ? ordine : rowNumber - 4,
      stadiu_trigger: stadiuTrigger,
      cohort_trigger: cohortTrigger,
      stadiu_input_raw: stadiuRaw,
      produs_input: produsInput,
      produs_match: produsMatch,
      doza_ml_per_hl: dozaMl.value,
      doza_l_per_ha: dozaL.value,
      observatii: observatiiRaw || null,
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

export async function parseImportedPlansWorkbook(
  buffer: ArrayBuffer,
  produse: ProdusFitosanitar[]
): Promise<ParseResult> {
  const XLSX = await import('xlsx')
  const workbook: WorkBook = XLSX.read(buffer, {
    type: 'array',
    cellFormula: false,
  })

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
    .map((item) => parseSheetRows(item.sheetName, item.sheet, produse, XLSX))

  const globalErrors: string[] = []
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
