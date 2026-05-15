import ExcelJS from 'exceljs'

import {
  COHORT_TRIGGER_VALUES,
  STADIU_LABELS,
  STADII_VALIDE,
  TIP_INTERVENTIE_LABELS,
  TIP_INTERVENTIE_VALUES,
} from '@/lib/tratamente/import/template-spec'

const TITLE_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F5E9' } } as const
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
  'Fenofază',
  'Tip intervenție',
  'Titlu intervenție',
  'Produs 1',
  'Doză produs 1',
  'Produs 2',
  'Doză produs 2',
  'Produs 3',
  'Doză produs 3',
  'Produs 4',
  'Doză produs 4',
  'Repetare',
  'Interval zile',
  'Cohortă zmeur',
  'Prag decizional',
  'Observații',
] as const

function styleCell(cell: ExcelJS.Cell, fill: ExcelJS.Fill = OPTIONAL_FILL) {
  cell.fill = fill
  cell.border = BORDER
  cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true }
}

function styleHeaderCell(cell: ExcelJS.Cell, fill: ExcelJS.Fill = HEADER_FILL) {
  styleCell(cell, fill)
  cell.font = { bold: true }
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

function addValidation(
  sheet: ExcelJS.Worksheet,
  column: string,
  formula: string,
  allowBlank = true
) {
  for (let row = 3; row <= 250; row += 1) {
    sheet.getCell(`${column}${row}`).dataValidation = {
      type: 'list',
      allowBlank,
      formulae: [`"${formula}"`],
    }
  }
}

function addWholeValidation(sheet: ExcelJS.Worksheet, column: string, allowBlank = true) {
  for (let row = 3; row <= 250; row += 1) {
    sheet.getCell(`${column}${row}`).dataValidation = {
      type: 'whole',
      operator: 'greaterThanOrEqual',
      allowBlank,
      formulae: ['1'],
    }
  }
}

function createInterventiiSheet(workbook: ExcelJS.Workbook) {
  const sheet = workbook.addWorksheet('Interventii')
  sheet.views = [{ state: 'frozen', ySplit: 2 }]
  sheet.columns = [
    { width: 24 },
    { width: 18 },
    { width: 34 },
    { width: 28 },
    { width: 20 },
    { width: 28 },
    { width: 20 },
    { width: 28 },
    { width: 20 },
    { width: 28 },
    { width: 20 },
    { width: 18 },
    { width: 14 },
    { width: 18 },
    { width: 34 },
    { width: 42 },
  ]

  sheet.mergeCells('A1:P1')
  const title = sheet.getCell('A1')
  title.value = 'Template import plan tratament V3 - intervenții inline'
  title.fill = TITLE_FILL
  title.font = { size: 16, bold: true, color: { argb: 'FF1B5E20' } }
  title.alignment = { vertical: 'middle', horizontal: 'center' }
  title.border = BORDER
  sheet.getRow(1).height = 28

  INTERVENTII_HEADERS.forEach((header, index) => {
    const cell = sheet.getCell(2, index + 1)
    cell.value = header
    styleHeaderCell(cell, index <= 3 ? HEADER_FILL : OPTIONAL_FILL)
  })

  for (let row = 3; row <= 32; row += 1) {
    for (let column = 1; column <= INTERVENTII_HEADERS.length; column += 1) {
      styleCell(sheet.getCell(row, column))
    }
  }

  addValidation(sheet, 'A', STADII_VALIDE.join(','), false)
  addValidation(sheet, 'B', TIP_INTERVENTIE_VALUES.join(','), false)
  addValidation(sheet, 'L', 'saptamanal,la 10 zile,la 14 zile,la 21 zile,lunar,interval,o singura data')
  addWholeValidation(sheet, 'M')
  addValidation(sheet, 'N', [...COHORT_TRIGGER_VALUES, 'ambele'].join(','))

  sheet.autoFilter = {
    from: 'A2',
    to: 'P2',
  }
}

async function createInstructionsSheet(workbook: ExcelJS.Workbook) {
  const sheet = workbook.addWorksheet('Instructiuni')
  sheet.columns = [
    { width: 30 },
    { width: 100 },
  ]

  sheet.mergeCells('A1:B1')
  const title = sheet.getCell('A1')
  title.value = 'Ghid completare template V3'
  title.font = { size: 16, bold: true }
  title.fill = TITLE_FILL
  title.alignment = { vertical: 'middle', horizontal: 'center' }

  const lines: Array<[string, string]> = [
    ['Structură', 'Completează doar foaia „Interventii”. Foaia „Instructiuni” este ignorată la import.'],
    ['Rânduri', 'Rândul 1 este titlu decorativ, rândul 2 este header, iar datele încep de la rândul 3.'],
    ['Produse inline', 'Produsele se trec pe același rând cu intervenția: Produs 1 + Doză produs 1, până la Produs 4.'],
    ['Doze', 'Doza este text liber, de exemplu „1.5g/pl/sapt”; importul o păstrează în observațiile produsului.'],
    ['Monitorizare', 'Pentru o intervenție fără produs, scrie în Produs 1 „— fara produs” sau lasă produsele goale.'],
    ['Repetare', 'Valori utile: saptamanal, la 10 zile, la 14 zile, la 21 zile, lunar, interval, o singura data.'],
    ['Cohortă zmeur', 'Folosește floricane, primocane sau ambele. „ambele” se importă fără cohortă specifică.'],
    ['Fenofaze valide', STADII_VALIDE.map((stadiu) => `${stadiu} (${STADIU_LABELS[stadiu]})`).join(', ')],
    ['Tipuri intervenție', TIP_INTERVENTIE_VALUES.map((tip) => `${tip} (${TIP_INTERVENTIE_LABELS[tip]})`).join(', ')],
  ]

  lines.forEach(([label, description], index) => {
    const rowNumber = index + 3
    sheet.getCell(`A${rowNumber}`).value = label
    sheet.getCell(`B${rowNumber}`).value = description
    styleHeaderCell(sheet.getCell(`A${rowNumber}`), META_FILL)
    styleCell(sheet.getCell(`B${rowNumber}`))
  })

  await protectWorksheet(sheet)
}

export async function generateTratamentTemplateWorkbook(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Zmeurel OS'
  workbook.company = 'Zmeurel OS'
  workbook.created = new Date()

  createInterventiiSheet(workbook)
  await createInstructionsSheet(workbook)

  return Buffer.from(await workbook.xlsx.writeBuffer())
}
