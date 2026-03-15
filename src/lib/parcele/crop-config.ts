type MaybeString = string | null | undefined
type MaybeNumber = number | null | undefined

const PARCEL_CROPS_START = '[zmeurel:parcel-crops]'
const PARCEL_CROPS_END = '[/zmeurel:parcel-crops]'
const HARVEST_CROP_START = '[zmeurel:harvest-crop]'
const HARVEST_CROP_END = '[/zmeurel:harvest-crop]'

export interface ParcelCropRow {
  id: string
  culture: string
  variety: string
  plantCount: number | null
}

export interface HarvestCropSelection {
  cropId: string
  culture: string
  variety: string
}

function normalizeText(value: MaybeString): string {
  return String(value ?? '').trim()
}

function safeJsonParse<T>(value: string): T | null {
  try {
    return JSON.parse(value) as T
  } catch {
    return null
  }
}

function extractBlock(text: string, start: string, end: string): string | null {
  const startIndex = text.indexOf(start)
  if (startIndex < 0) return null
  const contentStart = startIndex + start.length
  const endIndex = text.indexOf(end, contentStart)
  if (endIndex < 0) return null
  return text.slice(contentStart, endIndex).trim()
}

function removeBlock(text: string, start: string, end: string): string {
  const startIndex = text.indexOf(start)
  if (startIndex < 0) return text.trim()
  const endIndex = text.indexOf(end, startIndex + start.length)
  if (endIndex < 0) return text.trim()
  return `${text.slice(0, startIndex)}${text.slice(endIndex + end.length)}`.trim()
}

function normalizePlantCount(value: MaybeNumber): number | null {
  if (value === null || value === undefined) return null
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 0) return null
  return Math.round(parsed)
}

function toCropId(culture: string, variety: string, index: number): string {
  const base = `${culture}|${variety}`.trim().toLowerCase().replace(/\s+/g, '-')
  return base || `crop-${index + 1}`
}

function normalizeCropRow(row: Partial<ParcelCropRow>, index: number): ParcelCropRow | null {
  const culture = normalizeText(row.culture)
  const variety = normalizeText(row.variety)
  const plantCount = normalizePlantCount(row.plantCount)

  if (!culture && !variety && plantCount === null) return null

  return {
    id: normalizeText(row.id) || toCropId(culture, variety, index),
    culture,
    variety,
    plantCount,
  }
}

export function stripHiddenAgricultureMetadata(observatii: MaybeString): string {
  const raw = normalizeText(observatii)
  if (!raw) return ''
  return removeBlock(removeBlock(raw, PARCEL_CROPS_START, PARCEL_CROPS_END), HARVEST_CROP_START, HARVEST_CROP_END)
}

export function getParcelCropRowsFromObservatii(observatii: MaybeString): ParcelCropRow[] {
  const raw = normalizeText(observatii)
  if (!raw) return []

  const payload = extractBlock(raw, PARCEL_CROPS_START, PARCEL_CROPS_END)
  if (!payload) return []

  const parsed = safeJsonParse<Array<Partial<ParcelCropRow>>>(payload)
  if (!Array.isArray(parsed)) return []

  return parsed
    .map((row, index) => normalizeCropRow(row, index))
    .filter((row): row is ParcelCropRow => Boolean(row))
}

export function getParcelaCropRows(parcela: {
  observatii?: MaybeString
  cultura?: MaybeString
  tip_fruct?: MaybeString
  soi?: MaybeString
  soi_plantat?: MaybeString
  nr_plante?: MaybeNumber
} | null | undefined): ParcelCropRow[] {
  if (!parcela) return []

  const fromMetadata = getParcelCropRowsFromObservatii(parcela.observatii)
  if (fromMetadata.length > 0) return fromMetadata

  const fallback = normalizeCropRow(
    {
      id: 'primary',
      culture: normalizeText(parcela.cultura) || normalizeText(parcela.tip_fruct),
      variety: normalizeText(parcela.soi) || normalizeText(parcela.soi_plantat),
      plantCount: normalizePlantCount(parcela.nr_plante),
    },
    0,
  )

  return fallback ? [fallback] : []
}

export function buildParcelaObservatii(notes: MaybeString, cropRows: ParcelCropRow[]): string | null {
  const visibleNotes = stripHiddenAgricultureMetadata(notes)
  const normalizedRows = cropRows
    .map((row, index) => normalizeCropRow(row, index))
    .filter((row): row is ParcelCropRow => Boolean(row))

  if (normalizedRows.length === 0) {
    return visibleNotes || null
  }

  const metadata = `${PARCEL_CROPS_START}${JSON.stringify(normalizedRows)}${PARCEL_CROPS_END}`
  return [visibleNotes, metadata].filter(Boolean).join('\n\n').trim() || null
}

export function getPrimaryParcelCrop(parcela: {
  observatii?: MaybeString
  cultura?: MaybeString
  tip_fruct?: MaybeString
  soi?: MaybeString
  soi_plantat?: MaybeString
  nr_plante?: MaybeNumber
} | null | undefined): ParcelCropRow | null {
  return getParcelaCropRows(parcela)[0] ?? null
}

export function getHarvestCropSelection(observatii: MaybeString): HarvestCropSelection | null {
  const raw = normalizeText(observatii)
  if (!raw) return null

  const payload = extractBlock(raw, HARVEST_CROP_START, HARVEST_CROP_END)
  if (!payload) return null

  const parsed = safeJsonParse<Partial<HarvestCropSelection>>(payload)
  if (!parsed) return null

  const cropId = normalizeText(parsed.cropId)
  const culture = normalizeText(parsed.culture)
  const variety = normalizeText(parsed.variety)
  if (!cropId && !culture && !variety) return null

  return {
    cropId: cropId || toCropId(culture, variety, 0),
    culture,
    variety,
  }
}

export function buildHarvestObservatii(
  notes: MaybeString,
  cropSelection: HarvestCropSelection | null | undefined,
): string | null {
  const visibleNotes = stripHiddenAgricultureMetadata(notes)
  if (!cropSelection) return visibleNotes || null

  const normalized = {
    cropId: normalizeText(cropSelection.cropId) || toCropId(cropSelection.culture, cropSelection.variety, 0),
    culture: normalizeText(cropSelection.culture),
    variety: normalizeText(cropSelection.variety),
  }

  const metadata = `${HARVEST_CROP_START}${JSON.stringify(normalized)}${HARVEST_CROP_END}`
  return [visibleNotes, metadata].filter(Boolean).join('\n\n').trim() || null
}
