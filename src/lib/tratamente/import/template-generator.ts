import ExcelJS from 'exceljs'

import type { ProdusFitosanitar } from '@/lib/supabase/queries/tratamente'
import {
  COHORT_TRIGGER_VALUES,
  CULTURA_LABELS,
  CULTURI_ACCEPTATE,
  REGULA_REPETARE_LABELS,
  REGULA_REPETARE_VALUES,
  STADIU_LABELS,
  STADII_VALIDE,
  TIP_INTERVENTIE_LABELS,
  TIP_INTERVENTIE_VALUES,
  TIP_PRODUS_VALUES,
} from '@/lib/tratamente/import/template-spec'

const HEADER_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF9C4' } } as const
const OPTIONAL_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } } as const
const META_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEEEEE' } } as const
const BORDER = {
  top: { style: 'thin' as const, color: { argb: 'FFD9D9D9' } },
  left: { style: 'thin' as const, color: { argb: 'FFD9D9D9' } },
  bottom: { style: 'thin' as const, color: { argb: 'FFD9D9D9' } },
  right: { style: 'thin' as const, color: { argb: 'FFD9D9D9' } },
}

const INTERVENTII_HEADERS = [
  'plan_nume',
  'cultura',
  'interventie_key',
  'ordine',
  'stadiu',
  'cohorta_trigger',
  'tip_interventie',
  'scop',
  'regula_repetare',
  'interval_repetare_zile',
  'numar_repetari_max',
  'observatii',
] as const

const PRODUSE_HEADERS = [
  'interventie_key',
  'ordine_produs',
  'produs',
  'substanta_activa',
  'tip_produs',
  'doza_ml_per_hl',
  'doza_l_per_ha',
  'phi_zile',
  'frac_irac',
  'salveaza_in_biblioteca',
  'observatii',
] as const

function styleHeaderCell(cell: ExcelJS.Cell, fill: ExcelJS.Fill = HEADER_FILL) {
  cell.fill = fill
  cell.font = { bold: true }
  cell.border = BORDER
  cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true }
}

async function protectWorksheet(worksheet: ExcelJS.Worksheet) {
  await worksheet.protect('zmeurel-template', {
    selectLockedCells: true,
    selectUnlockedCells: true,
    formatCells: false,
    formatColumns: false,
    formatRows: false,
    insertColumns: false,
    insertRows: false,
    insertHyperlinks: false,
    deleteColumns: false,
    deleteRows: false,
    sort: false,
    autoFilter: false,
    pivotTables: false,
  })
}

function addValidation(sheet: ExcelJS.Worksheet, range: string, formula: string, allowBlank = true) {
  for (let row = 2; row <= 250; row += 1) {
    sheet.getCell(`${range}${row}`).dataValidation = {
      type: 'list',
      allowBlank,
      formulae: [`"${formula}"`],
    }
  }
}

function addDecimalValidation(sheet: ExcelJS.Worksheet, column: string) {
  for (let row = 2; row <= 250; row += 1) {
    sheet.getCell(`${column}${row}`).dataValidation = {
      type: 'decimal',
      operator: 'greaterThanOrEqual',
      allowBlank: true,
      formulae: ['0'],
    }
  }
}

function addWholeValidation(sheet: ExcelJS.Worksheet, column: string, allowBlank = false) {
  for (let row = 2; row <= 250; row += 1) {
    sheet.getCell(`${column}${row}`).dataValidation = {
      type: 'whole',
      operator: 'greaterThanOrEqual',
      allowBlank,
      formulae: ['1'],
    }
  }
}

async function createInstructionsSheet(workbook: ExcelJS.Workbook) {
  const sheet = workbook.addWorksheet('Instructions')
  sheet.columns = [
    { width: 28 },
    { width: 96 },
  ]

  sheet.mergeCells('A1:B1')
  const title = sheet.getCell('A1')
  title.value = 'Template import plan tratament V2'
  title.font = { size: 16, bold: true }

  const lines: Array<[string, string]> = [
    ['1. Structură', 'Completează foaia „Interventii” pentru intervențiile planificate și foaia „Produse interventii” pentru produsele fiecărei intervenții.'],
    ['2. Cheie legătură', 'interventie_key trebuie să fie unic în „Interventii” și folosit identic în „Produse interventii”. Exemplu: zmeur-inflorit-01.'],
    ['3. Planuri multiple', 'Poți importa mai multe planuri în același fișier: schimbă plan_nume și cultura pe rândurile din „Interventii”.'],
    ['4. Produse multiple', 'Pentru aceeași intervenție, adaugă mai multe rânduri în „Produse interventii” cu aceeași interventie_key și ordine_produs diferită.'],
    ['5. Produse necunoscute', 'Dacă produsul nu există în biblioteca fermei, importul îl va marca pentru review. Poate rămâne manual sau poate fi creat la salvarea finală.'],
    ['6. Repetare', 'Folosește regula_repetare = fara_repetare sau interval. Pentru interval, completează interval_repetare_zile.'],
    ['7. Fallback legacy', 'Fișierele vechi pot fi citite temporar, dar template-ul oficial este V2.'],
  ]

  lines.forEach(([label, description], index) => {
    const rowNumber = index + 3
    sheet.getCell(`A${rowNumber}`).value = label
    sheet.getCell(`B${rowNumber}`).value = description
    sheet.getCell(`A${rowNumber}`).font = { bold: true }
    sheet.getCell(`B${rowNumber}`).alignment = { wrapText: true, vertical: 'top' }
  })

  await protectWorksheet(sheet)
}

function createInterventiiSheet(workbook: ExcelJS.Workbook) {
  const sheet = workbook.addWorksheet('Interventii')
  sheet.views = [{ state: 'frozen', ySplit: 1 }]
  sheet.columns = [
    { width: 28 },
    { width: 16 },
    { width: 26 },
    { width: 10 },
    { width: 24 },
    { width: 18 },
    { width: 18 },
    { width: 34 },
    { width: 18 },
    { width: 18 },
    { width: 18 },
    { width: 42 },
  ]

  INTERVENTII_HEADERS.forEach((header, index) => {
    const cell = sheet.getCell(1, index + 1)
    cell.value = header
    styleHeaderCell(cell, index <= 4 ? HEADER_FILL : OPTIONAL_FILL)
  })

  addValidation(sheet, 'B', CULTURI_ACCEPTATE.join(','), false)
  addWholeValidation(sheet, 'D')
  addValidation(sheet, 'E', STADII_VALIDE.join(','), false)
  addValidation(sheet, 'F', COHORT_TRIGGER_VALUES.join(','))
  addValidation(sheet, 'G', TIP_INTERVENTIE_VALUES.join(','))
  addValidation(sheet, 'I', REGULA_REPETARE_VALUES.join(','), false)
  addWholeValidation(sheet, 'J', true)
  addWholeValidation(sheet, 'K', true)

  const exampleRows = [
    ['Plan zmeur 2026', 'zmeur', 'zmeur-buton-verde-01', 1, 'buton_verde', '', 'protectie', 'Protecție preventivă', 'fara_repetare', null, null, 'Exemplu intervenție cu un produs'],
    ['Plan zmeur 2026', 'zmeur', 'zmeur-inflorit-01', 2, 'inflorit', 'floricane', 'protectie', 'Protecție înflorit', 'interval', 7, 2, 'Exemplu intervenție cu două produse'],
  ] as const

  exampleRows.forEach((rowValues, index) => {
    const row = sheet.getRow(index + 2)
    row.values = [...rowValues]
  })
}

function createProduseInterventiiSheet(workbook: ExcelJS.Workbook) {
  const sheet = workbook.addWorksheet('Produse interventii')
  sheet.views = [{ state: 'frozen', ySplit: 1 }]
  sheet.columns = [
    { width: 26 },
    { width: 14 },
    { width: 30 },
    { width: 30 },
    { width: 18 },
    { width: 15 },
    { width: 15 },
    { width: 12 },
    { width: 14 },
    { width: 22 },
    { width: 42 },
  ]

  PRODUSE_HEADERS.forEach((header, index) => {
    const cell = sheet.getCell(1, index + 1)
    cell.value = header
    styleHeaderCell(cell, index <= 2 ? HEADER_FILL : OPTIONAL_FILL)
  })

  addWholeValidation(sheet, 'B')
  addValidation(sheet, 'E', TIP_PRODUS_VALUES.join(','))
  addDecimalValidation(sheet, 'F')
  addDecimalValidation(sheet, 'G')
  addWholeValidation(sheet, 'H', true)
  addValidation(sheet, 'J', 'da,nu', true)

  const exampleRows = [
    ['zmeur-buton-verde-01', 1, 'Thiovit Jet', 'sulf', 'fungicid', 500, null, 0, 'M02', 'nu', 'Produs exemplu'],
    ['zmeur-inflorit-01', 1, 'Signum', 'boscalid + piraclostrobin', 'fungicid', 50, null, 7, '7+11', 'nu', 'Primul produs'],
    ['zmeur-inflorit-01', 2, 'Aminoacizi', 'aminoacizi liberi', 'foliar', 150, null, null, '', 'da', 'Produs manual de salvat în bibliotecă'],
  ] as const

  exampleRows.forEach((rowValues, index) => {
    const row = sheet.getRow(index + 2)
    row.values = [...rowValues]
  })
}

async function createStageReferenceSheet(workbook: ExcelJS.Workbook) {
  const sheet = workbook.addWorksheet('Stadii valide')
  sheet.columns = [{ width: 24 }, { width: 30 }]
  styleHeaderCell(sheet.getCell('A1'), META_FILL)
  styleHeaderCell(sheet.getCell('B1'), META_FILL)
  sheet.getCell('A1').value = 'Cod'
  sheet.getCell('B1').value = 'Label română'

  STADII_VALIDE.forEach((stadiu, index) => {
    sheet.getCell(`A${index + 2}`).value = stadiu
    sheet.getCell(`B${index + 2}`).value = STADIU_LABELS[stadiu]
  })

  await protectWorksheet(sheet)
}

async function createCultureReferenceSheet(workbook: ExcelJS.Workbook) {
  const sheet = workbook.addWorksheet('Culturi acceptate')
  sheet.columns = [{ width: 18 }, { width: 18 }]
  styleHeaderCell(sheet.getCell('A1'), META_FILL)
  styleHeaderCell(sheet.getCell('B1'), META_FILL)
  sheet.getCell('A1').value = 'Cod'
  sheet.getCell('B1').value = 'Label română'

  CULTURI_ACCEPTATE.forEach((cultura, index) => {
    sheet.getCell(`A${index + 2}`).value = cultura
    sheet.getCell(`B${index + 2}`).value = CULTURA_LABELS[cultura]
  })

  await protectWorksheet(sheet)
}

async function createSimpleReferenceSheet(
  workbook: ExcelJS.Workbook,
  name: string,
  rows: Array<[string, string]>
) {
  const sheet = workbook.addWorksheet(name)
  sheet.columns = [{ width: 24 }, { width: 30 }]
  sheet.getCell('A1').value = 'Valoare'
  sheet.getCell('B1').value = 'Label'
  styleHeaderCell(sheet.getCell('A1'), META_FILL)
  styleHeaderCell(sheet.getCell('B1'), META_FILL)
  rows.forEach(([value, label], index) => {
    sheet.getCell(index + 2, 1).value = value
    sheet.getCell(index + 2, 2).value = label
  })
  await protectWorksheet(sheet)
}

async function createStandardProductsSheet(
  workbook: ExcelJS.Workbook,
  produse: ProdusFitosanitar[]
) {
  const sheet = workbook.addWorksheet('Produse standard')
  sheet.columns = [
    { width: 28 },
    { width: 34 },
    { width: 14 },
    { width: 14 },
    { width: 12 },
    { width: 15 },
    { width: 15 },
    { width: 15 },
    { width: 15 },
    { width: 28 },
  ]

  const headers = [
    'Nume comercial',
    'Substanța activă',
    'Tip',
    'FRAC/IRAC',
    'PHI (zile)',
    'Doză min ml/hl',
    'Doză max ml/hl',
    'Doză min l/ha',
    'Doză max l/ha',
    'Culturi omologate',
  ]

  headers.forEach((header, index) => {
    const cell = sheet.getCell(1, index + 1)
    cell.value = header
    styleHeaderCell(cell, META_FILL)
  })

  produse
    .slice()
    .sort((first, second) => first.nume_comercial.localeCompare(second.nume_comercial, 'ro'))
    .forEach((produs, index) => {
      const row = sheet.getRow(index + 2)
      row.values = [
        produs.nume_comercial,
        produs.substanta_activa,
        produs.tip,
        produs.frac_irac ?? '',
        produs.phi_zile ?? '',
        produs.doza_min_ml_per_hl ?? '',
        produs.doza_max_ml_per_hl ?? '',
        produs.doza_min_l_per_ha ?? '',
        produs.doza_max_l_per_ha ?? '',
        (produs.omologat_culturi ?? []).join(', '),
      ]
    })

  await protectWorksheet(sheet)
}

export async function generateTratamentTemplateWorkbook(
  produse: ProdusFitosanitar[]
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Zmeurel OS'
  workbook.company = 'Zmeurel OS'
  workbook.created = new Date()

  await createInstructionsSheet(workbook)
  createInterventiiSheet(workbook)
  createProduseInterventiiSheet(workbook)
  await createStageReferenceSheet(workbook)
  await createCultureReferenceSheet(workbook)
  await createSimpleReferenceSheet(
    workbook,
    'Cohorte valide',
    COHORT_TRIGGER_VALUES.map((value) => [value, value])
  )
  await createSimpleReferenceSheet(
    workbook,
    'Tipuri interventie',
    TIP_INTERVENTIE_VALUES.map((value) => [value, TIP_INTERVENTIE_LABELS[value]])
  )
  await createSimpleReferenceSheet(
    workbook,
    'Reguli repetare',
    REGULA_REPETARE_VALUES.map((value) => [value, REGULA_REPETARE_LABELS[value]])
  )
  await createStandardProductsSheet(workbook, produse)

  return Buffer.from(await workbook.xlsx.writeBuffer())
}
