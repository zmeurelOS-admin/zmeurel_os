import ExcelJS from 'exceljs'

import type { ProdusFitosanitar } from '@/lib/supabase/queries/tratamente'
import {
  CULTURA_LABELS,
  CULTURI_ACCEPTATE,
  STADIU_LABELS,
  STADII_VALIDE,
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

function styleHeaderCell(cell: ExcelJS.Cell, fill: ExcelJS.Fill = HEADER_FILL) {
  cell.fill = fill
  cell.font = { bold: true }
  cell.border = BORDER
  cell.alignment = { vertical: 'middle', horizontal: 'left' }
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

async function createInstructionsSheet(workbook: ExcelJS.Workbook) {
  const sheet = workbook.addWorksheet('Instructions')
  sheet.columns = [
    { width: 24 },
    { width: 90 },
  ]

  sheet.mergeCells('A1:B1')
  const title = sheet.getCell('A1')
  title.value = 'Template import plan de tratament'
  title.font = { size: 16, bold: true }

  const lines: Array<[string, string]> = [
    ['1. Cum completezi planul', 'Redenumește tabul foii „Plan” cu un nume descriptiv (ex. „Zmeur 2026”) — acesta devine numele planului.'],
    ['', 'Selectează cultura din dropdown-ul din celula B1.'],
    ['', 'Opțional, adaugă o descriere în B2.'],
    ['', 'Completează liniile începând de pe rândul 5.'],
    ['', 'Pentru fiecare linie: Ordine, Stadiu (dropdown), Produs (nume comercial), doză (ml/hl SAU l/ha, NU ambele), observații.'],
    ['2. Cum se interpretează coloanele', 'A = Ordine, B = Stadiu, C = Produs, D = Doză ml/hl, E = Doză l/ha, F = Observații.'],
    ['3. Doze', 'Exact una dintre ml/hl sau l/ha trebuie completată pentru fiecare linie.'],
    ['4. Produse necunoscute', 'Produsele necunoscute sunt detectate automat — le vei putea rezolva în ecranul de review.'],
    ['5. Mai multe planuri', 'Poți adăuga foi noi pentru mai multe planuri: copiază foaia „Plan”, apoi redenumește-o.'],
    ['6. Foi ignorate la import', 'Stadii valide, Culturi acceptate, Produse standard și Exemplu zmeur sunt foi de referință și nu sunt importate.'],
    ['7. Erori comune', 'Stadiu scris greșit → folosește dropdown-ul din coloană.'],
    ['', 'Ambele doze completate → doar una este permisă.'],
    ['', 'Produs gol → linia va fi respinsă la import.'],
  ]

  lines.forEach(([label, description], index) => {
    const rowNumber = index + 3
    sheet.getCell(`A${rowNumber}`).value = label
    sheet.getCell(`B${rowNumber}`).value = description
    if (label) {
      sheet.getCell(`A${rowNumber}`).font = { bold: true }
    }
    sheet.getCell(`B${rowNumber}`).alignment = { wrapText: true, vertical: 'top' }
  })

  await protectWorksheet(sheet)
}

function createPlanSheet(workbook: ExcelJS.Workbook) {
  const sheet = workbook.addWorksheet('Plan')
  sheet.views = [{ state: 'frozen', xSplit: 1, ySplit: 4 }]
  sheet.columns = [
    { width: 8 },
    { width: 25 },
    { width: 35 },
    { width: 14 },
    { width: 14 },
    { width: 45 },
  ]

  sheet.getCell('A1').value = 'Cultură'
  sheet.getCell('A2').value = 'Descriere'
  styleHeaderCell(sheet.getCell('A1'), META_FILL)
  styleHeaderCell(sheet.getCell('A2'), META_FILL)
  sheet.getCell('B1').dataValidation = {
    type: 'list',
    allowBlank: false,
    formulae: [`"${CULTURI_ACCEPTATE.map((item) => CULTURA_LABELS[item]).join(',')}"`],
  }

  ;([
    ['A4', 'Ordine', HEADER_FILL],
    ['B4', 'Stadiu', HEADER_FILL],
    ['C4', 'Produs', HEADER_FILL],
    ['D4', 'Doză ml/hl', OPTIONAL_FILL],
    ['E4', 'Doză l/ha', OPTIONAL_FILL],
    ['F4', 'Observații', OPTIONAL_FILL],
  ] as const).forEach(([cellRef, label, fill]) => {
    const cell = sheet.getCell(cellRef)
    cell.value = label
    styleHeaderCell(cell, fill)
  })

  for (let row = 5; row <= 100; row += 1) {
    sheet.getCell(`A${row}`).dataValidation = {
      type: 'whole',
      operator: 'greaterThanOrEqual',
      allowBlank: false,
      formulae: ['1'],
    }
    sheet.getCell(`B${row}`).dataValidation = {
      type: 'list',
      allowBlank: false,
      formulae: [`"${STADII_VALIDE.map((item) => STADIU_LABELS[item]).join(',')}"`],
    }
    sheet.getCell(`D${row}`).dataValidation = {
      type: 'decimal',
      operator: 'greaterThanOrEqual',
      allowBlank: true,
      formulae: ['0'],
    }
    sheet.getCell(`E${row}`).dataValidation = {
      type: 'decimal',
      operator: 'greaterThanOrEqual',
      allowBlank: true,
      formulae: ['0'],
    }
  }
}

async function createStageReferenceSheet(workbook: ExcelJS.Workbook) {
  const sheet = workbook.addWorksheet('Stadii valide')
  sheet.columns = [{ width: 24 }, { width: 28 }]
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
        undefined,
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

async function createExampleSheet(workbook: ExcelJS.Workbook) {
  const sheet = workbook.addWorksheet('Exemplu zmeur')
  sheet.views = [{ state: 'frozen', xSplit: 1, ySplit: 4 }]
  sheet.columns = [
    { width: 8 },
    { width: 25 },
    { width: 35 },
    { width: 14 },
    { width: 14 },
    { width: 45 },
  ]

  sheet.getCell('A1').value = 'Cultură'
  sheet.getCell('A2').value = 'Descriere'
  styleHeaderCell(sheet.getCell('A1'), META_FILL)
  styleHeaderCell(sheet.getCell('A2'), META_FILL)
  sheet.getCell('B1').value = CULTURA_LABELS.zmeur
  sheet.getCell('B2').value = 'Exemplu — copiază foaia și redenumește-o'

  ;([
    ['A4', 'Ordine', HEADER_FILL],
    ['B4', 'Stadiu', HEADER_FILL],
    ['C4', 'Produs', HEADER_FILL],
    ['D4', 'Doză ml/hl', OPTIONAL_FILL],
    ['E4', 'Doză l/ha', OPTIONAL_FILL],
    ['F4', 'Observații', OPTIONAL_FILL],
  ] as const).forEach(([cellRef, label, fill]) => {
    const cell = sheet.getCell(cellRef)
    cell.value = label
    styleHeaderCell(cell, fill)
  })

  const exampleRows = [
    {
      ordine: 1,
      stadiu: STADIU_LABELS.umflare_muguri,
      produs: 'Thiovit Jet',
      dozaMlPerHl: 500,
      dozaLPerHa: null,
      observatii: 'Prevenție făinare',
    },
    {
      ordine: 2,
      stadiu: STADIU_LABELS.prefloral,
      produs: 'Mospilan 20 SG',
      dozaMlPerHl: 20,
      dozaLPerHa: null,
      observatii: 'Afide',
    },
    {
      ordine: 3,
      stadiu: STADIU_LABELS.cadere_petale,
      produs: 'Signum',
      dozaMlPerHl: 50,
      dozaLPerHa: null,
      observatii: 'Putregai gri Botrytis',
    },
    {
      ordine: 4,
      stadiu: STADIU_LABELS.parguire,
      produs: 'Kocide 2000',
      dozaMlPerHl: null,
      dozaLPerHa: 3,
      observatii: 'PHI 3 zile',
    },
  ]

  exampleRows.forEach((rowData, index) => {
    const rowNumber = index + 5
    sheet.getCell(`A${rowNumber}`).value = rowData.ordine
    sheet.getCell(`B${rowNumber}`).value = rowData.stadiu
    sheet.getCell(`C${rowNumber}`).value = rowData.produs
    sheet.getCell(`D${rowNumber}`).value = rowData.dozaMlPerHl
    sheet.getCell(`E${rowNumber}`).value = rowData.dozaLPerHa
    sheet.getCell(`F${rowNumber}`).value = rowData.observatii
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
  createPlanSheet(workbook)
  await createStageReferenceSheet(workbook)
  await createCultureReferenceSheet(workbook)
  await createStandardProductsSheet(workbook, produse)
  await createExampleSheet(workbook)

  return Buffer.from(await workbook.xlsx.writeBuffer())
}
