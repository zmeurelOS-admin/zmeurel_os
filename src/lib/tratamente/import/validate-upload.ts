export const MAX_IMPORT_XLSX_BYTES = 2 * 1024 * 1024

export const IMPORT_XLSX_MIME_TYPES = new Set([
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
])

export function hasXlsxExtension(fileName: string | null | undefined): boolean {
  return typeof fileName === 'string' && fileName.trim().toLowerCase().endsWith('.xlsx')
}

export function isAcceptedImportMimeType(mimeType: string | null | undefined): boolean {
  return typeof mimeType === 'string' && IMPORT_XLSX_MIME_TYPES.has(mimeType)
}

export function validateImportFileMeta(params: {
  fileName: string | null | undefined
  mimeType: string | null | undefined
  size: number
}): string | null {
  if (!hasXlsxExtension(params.fileName)) {
    return 'Fișierul trebuie să fie în format .xlsx.'
  }

  if (!isAcceptedImportMimeType(params.mimeType)) {
    return 'Fișierul trebuie să fie un document Excel .xlsx valid.'
  }

  if (params.size > MAX_IMPORT_XLSX_BYTES) {
    return 'Fișierul depășește limita de 2 MB.'
  }

  return null
}
