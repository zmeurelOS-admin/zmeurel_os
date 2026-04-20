import { readFile } from 'node:fs/promises'
import path from 'node:path'
import type { jsPDF as JsPDFClass } from 'jspdf'

import { getTenantLegalDocs } from '@/lib/legal-docs/server'
import {
  getAplicariAnualAgregate,
  getParcelaTratamenteContext,
  type AplicareAgregata,
} from '@/lib/supabase/queries/tratamente'
import { createClient } from '@/lib/supabase/server'
import { getTenantIdByUserId } from '@/lib/tenant/get-tenant'

type PdfDocument = InstanceType<typeof JsPDFClass>

interface PdfTenantContext {
  adresa: string
  cif: string
  numeFerma: string
  operatorResponsabil: string
}

export interface FisaAnsvsaDocumentRow {
  agentDaunator: string
  cantitateUtilizata: string
  dataAplicare: string
  dozaAplicata: string
  nrCrt: string
  operator: string
  phiZile: string
  produs: string
  semnatura: string
  substantaActiva: string
  suprafataTratata: string
}

export interface FisaAnsvsaDocumentData {
  an: number
  cultura: string
  generatedAt: string
  parcelaCod: string
  parcelaId: string
  parcelaNume: string
  rows: FisaAnsvsaDocumentRow[]
  suprafataHa: string
  tenant: PdfTenantContext
}

let cachedFontsPromise: Promise<{ bold: string; regular: string }> | null = null

function formatNumber(value: number, fractionDigits = 2): string {
  return new Intl.NumberFormat('ro-RO', {
    minimumFractionDigits: 0,
    maximumFractionDigits: fractionDigits,
  }).format(value)
}

function formatDate(value: string | null | undefined): string {
  if (!value) return 'N/A'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return 'N/A'
  return new Intl.DateTimeFormat('ro-RO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(parsed)
}

function formatDoza(aplicare: AplicareAgregata): string {
  if (typeof aplicare.doza_ml_per_hl === 'number') {
    return `${formatNumber(aplicare.doza_ml_per_hl)} ml/hl`
  }

  if (typeof aplicare.doza_l_per_ha === 'number') {
    return `${formatNumber(aplicare.doza_l_per_ha)} l/ha`
  }

  return 'N/A'
}

function formatCantitate(aplicare: AplicareAgregata): string {
  if (typeof aplicare.cantitate_totala_ml !== 'number' || aplicare.cantitate_totala_ml <= 0) {
    return 'N/A'
  }

  if (aplicare.cantitate_totala_ml >= 1000) {
    return `${formatNumber(aplicare.cantitate_totala_ml / 1000)} l`
  }

  return `${formatNumber(aplicare.cantitate_totala_ml)} ml`
}

function normalizeText(value: string | null | undefined): string {
  const trimmed = value?.trim()
  return trimmed && trimmed.length > 0 ? trimmed : 'N/A'
}

function buildRows(aplicari: AplicareAgregata[], suprafataHa: string): FisaAnsvsaDocumentRow[] {
  return aplicari
    .filter((aplicare) => aplicare.status === 'aplicata')
    .sort((left, right) => (left.data_aplicata ?? '').localeCompare(right.data_aplicata ?? ''))
    .map((aplicare, index) => ({
      nrCrt: String(index + 1),
      dataAplicare: formatDate(aplicare.data_aplicata),
      produs: normalizeText(aplicare.produs_nume),
      substantaActiva: normalizeText(aplicare.substanta_activa),
      dozaAplicata: formatDoza(aplicare),
      suprafataTratata: suprafataHa,
      cantitateUtilizata: formatCantitate(aplicare),
      agentDaunator: normalizeText(aplicare.observatii),
      phiZile: typeof aplicare.produs_phi_zile === 'number' ? String(aplicare.produs_phi_zile) : 'N/A',
      operator: normalizeText(aplicare.operator),
      semnatura: '',
    }))
}

async function loadFonts(): Promise<{ bold: string; regular: string }> {
  if (!cachedFontsPromise) {
    cachedFontsPromise = Promise.all([
      readFile(path.join(process.cwd(), 'public', 'fonts', 'Roboto-Regular.ttf')),
      readFile(path.join(process.cwd(), 'public', 'fonts', 'Roboto-Bold.ttf')),
    ]).then(([regular, bold]) => ({
      regular: regular.toString('base64'),
      bold: bold.toString('base64'),
    }))
  }

  return cachedFontsPromise
}

export async function createPdfDocument(): Promise<PdfDocument> {
  const [{ jsPDF }, fonts] = await Promise.all([
    import('jspdf'),
    loadFonts(),
  ])

  const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' })
  doc.addFileToVFS('Roboto-Regular.ttf', fonts.regular)
  doc.addFileToVFS('Roboto-Bold.ttf', fonts.bold)
  doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal')
  doc.addFont('Roboto-Bold.ttf', 'Roboto', 'bold')
  doc.setFont('Roboto', 'normal')
  doc.setProperties({
    title: 'FISA TRATAMENTE FITOSANITARE',
    subject: 'Fișă tratamente ANSVSA',
    author: 'Zmeurel OS',
  })
  return doc as PdfDocument
}

function writeText(
  doc: PdfDocument,
  text: string,
  x: number,
  y: number,
  options?: { align?: 'left' | 'center' | 'right'; bold?: boolean; maxWidth?: number; size?: number }
): number {
  const size = options?.size ?? 9
  doc.setFont('Roboto', options?.bold ? 'bold' : 'normal')
  doc.setFontSize(size)
  const lines = options?.maxWidth ? doc.splitTextToSize(text, options.maxWidth) : [text]
  doc.text(lines, x, y, options?.align ? { align: options.align } : undefined)
  return y + lines.length * (size >= 11 ? 5.5 : 4.2)
}

function drawKeyValueGrid(doc: PdfDocument, startY: number, data: Array<[string, string]>): number {
  const left = 12
  const right = 198
  const middle = 102
  const rowHeight = 8
  let y = startY

  doc.setDrawColor(220, 225, 230)

  for (const [label, value] of data) {
    doc.rect(left, y, middle - left, rowHeight)
    doc.rect(middle, y, right - middle, rowHeight)
    doc.setFont('Roboto', 'bold')
    doc.setFontSize(8)
    doc.text(label, left + 2, y + 5)
    doc.setFont('Roboto', 'normal')
    doc.text(value, middle + 2, y + 5)
    y += rowHeight
  }

  return y
}

function drawTableHeader(doc: PdfDocument, y: number, widths: number[]): void {
  const headers = [
    'Nr',
    'Data',
    'Produs',
    'Substanță activă',
    'Doză',
    'Suprafață',
    'Cantitate',
    'Agent / boală',
    'PHI',
    'Operator',
    'Semn.',
  ]

  let x = 10
  doc.setFillColor(240, 244, 247)
  doc.setDrawColor(220, 225, 230)
  doc.setFont('Roboto', 'bold')
  doc.setFontSize(7)

  headers.forEach((header, index) => {
    const width = widths[index] ?? 0
    doc.rect(x, y, width, 8, 'FD')
    doc.text(doc.splitTextToSize(header, width - 2), x + 1, y + 3.5)
    x += width
  })
}

function drawTableRow(doc: PdfDocument, y: number, widths: number[], row: FisaAnsvsaDocumentRow): number {
  const values = [
    row.nrCrt,
    row.dataAplicare,
    row.produs,
    row.substantaActiva,
    row.dozaAplicata,
    row.suprafataTratata,
    row.cantitateUtilizata,
    row.agentDaunator,
    row.phiZile,
    row.operator,
    row.semnatura,
  ]

  const linesByCell = values.map((value, index) => doc.splitTextToSize(value, (widths[index] ?? 0) - 2))
  const rowHeight = Math.max(8, ...linesByCell.map((lines) => Math.max(lines.length, 1) * 4.2))
  let x = 10

  doc.setDrawColor(225, 229, 233)
  doc.setFont('Roboto', 'normal')
  doc.setFontSize(7)

  linesByCell.forEach((lines, index) => {
    const width = widths[index] ?? 0
    doc.rect(x, y, width, rowHeight)
    doc.text(lines, x + 1, y + 3.5)
    x += width
  })

  return y + rowHeight
}

export function applyPageFooters(doc: PdfDocument, operatorResponsabil: string, generatedAt: string): void {
  const pageCount = doc.getNumberOfPages()

  for (let pageIndex = 1; pageIndex <= pageCount; pageIndex += 1) {
    doc.setPage(pageIndex)
    doc.setDrawColor(225, 229, 233)
    doc.line(10, 282, 200, 282)
    doc.setFont('Roboto', 'normal')
    doc.setFontSize(8)
    doc.text(`Data întocmire: ${generatedAt}`, 12, 287)
    doc.text(`Operator responsabil: ${operatorResponsabil}`, 12, 291)
    doc.text('Semnătura: ______________', 120, 287)
    doc.text(`Pagina ${pageIndex} din ${pageCount}`, 198, 291, { align: 'right' })
  }
}

export function appendFisaAnsvsaToDocument(
  doc: PdfDocument,
  data: FisaAnsvsaDocumentData,
  options?: { addNewPage?: boolean }
): void {
  if (options?.addNewPage) {
    doc.addPage()
  }

  const pageWidth = doc.internal.pageSize.getWidth()
  const tableWidths = [8, 16, 26, 22, 15, 15, 16, 28, 9, 18, 17]
  let y = 16

  doc.setFont('Roboto', 'bold')
  doc.setFontSize(16)
  doc.text('FIȘĂ TRATAMENTE FITOSANITARE', pageWidth / 2, y, { align: 'center' })
  y += 7
  doc.setFont('Roboto', 'normal')
  doc.setFontSize(10)
  doc.text(`Anul ${data.an} · Parcela: ${data.parcelaNume}`, pageWidth / 2, y, { align: 'center' })
  y += 10

  y = drawKeyValueGrid(doc, y, [
    ['Denumire exploatație', data.tenant.numeFerma],
    ['CIF', data.tenant.cif],
    ['Adresa', data.tenant.adresa],
    ['Parcelă', `${data.parcelaNume} · ${data.parcelaCod}`],
    ['Suprafață', `${data.suprafataHa} ha`],
    ['Cultură', data.cultura],
  ]) + 8

  drawTableHeader(doc, y, tableWidths)
  y += 8

  if (data.rows.length === 0) {
    doc.setFont('Roboto', 'normal')
    doc.setFontSize(9)
    doc.rect(10, y, 190, 12)
    doc.text('Nu există aplicări efectuate în anul selectat.', 12, y + 7)
    y += 12
  } else {
    for (const row of data.rows) {
      if (y > 260) {
        doc.addPage()
        y = 16
        drawTableHeader(doc, y, tableWidths)
        y += 8
      }

      y = drawTableRow(doc, y, tableWidths, row)
    }
  }
}

export async function buildFisaAnsvsaPdfDocument(data: FisaAnsvsaDocumentData): Promise<Uint8Array> {
  const doc = await createPdfDocument()
  appendFisaAnsvsaToDocument(doc, data)
  applyPageFooters(doc, data.tenant.operatorResponsabil, data.generatedAt)
  return new Uint8Array(doc.output('arraybuffer'))
}

async function loadTenantContext(): Promise<PdfTenantContext> {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user?.id) {
    throw new Error('Neautorizat')
  }

  const tenantId = await getTenantIdByUserId(supabase, user.id)
  const [{ data: tenant, error: tenantError }, legalDocs] = await Promise.all([
    supabase
      .from('tenants')
      .select('nume_ferma,localitate,contact_phone,owner_user_id')
      .eq('id', tenantId)
      .maybeSingle(),
    getTenantLegalDocs(supabase, tenantId),
  ])

  if (tenantError) throw tenantError
  if (!tenant) throw new Error('Tenantul curent nu a fost găsit.')

  let ownerName = user.user_metadata?.full_name
  if (typeof tenant.owner_user_id === 'string' && tenant.owner_user_id.length > 0) {
    const { data: ownerProfile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', tenant.owner_user_id)
      .maybeSingle()
    ownerName = ownerProfile?.full_name ?? ownerName
  }

  return {
    numeFerma: tenant.nume_ferma?.trim() || 'N/A',
    cif: legalDocs.doc?.cui?.trim() || 'N/A',
    adresa: legalDocs.doc?.locality?.trim() || tenant.localitate?.trim() || 'N/A',
    operatorResponsabil:
      legalDocs.doc?.full_name?.trim() ||
      (typeof ownerName === 'string' ? ownerName.trim() : '') ||
      'N/A',
  }
}

export async function collectFisaAnsvsaDocumentData(
  parcelaId: string,
  an: number
): Promise<FisaAnsvsaDocumentData> {
  const [tenant, parcela, aplicari] = await Promise.all([
    loadTenantContext(),
    getParcelaTratamenteContext(parcelaId),
    getAplicariAnualAgregate(parcelaId, an),
  ])

  if (!parcela) {
    throw new Error('Parcela nu a fost găsită.')
  }

  const suprafataHa =
    typeof parcela.suprafata_m2 === 'number' && parcela.suprafata_m2 > 0
      ? formatNumber(parcela.suprafata_m2 / 10000)
      : 'N/A'

  return {
    an,
    generatedAt: formatDate(new Date().toISOString()),
    tenant,
    parcelaId: parcela.id,
    parcelaCod: parcela.id_parcela?.trim() || 'N/A',
    parcelaNume: parcela.nume_parcela?.trim() || 'Parcelă',
    suprafataHa,
    cultura: parcela.cultura?.trim() || parcela.tip_fruct?.trim() || 'N/A',
    rows: buildRows(aplicari, suprafataHa),
  }
}

export async function generateFisaANSVSA(
  parcelaId: string,
  an: number
): Promise<Uint8Array> {
  const data = await collectFisaAnsvsaDocumentData(parcelaId, an)
  return buildFisaAnsvsaPdfDocument(data)
}
