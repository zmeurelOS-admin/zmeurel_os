type ErrorLike = {
  message?: string
  code?: string
  details?: string
  hint?: string
  status?: number
  statusCode?: number
}

const GENERIC_SAVE_MESSAGE = 'Nu s-a putut salva. Încearcă din nou.'
const PERMISSION_MESSAGE = 'Nu ai permisiunea pentru această operație.'
const ACCESS_DENIED_MESSAGE = 'Accesul a fost refuzat.'
const NETWORK_MESSAGE = 'Nu s-a putut conecta la server.'

function normalizeText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function getStatus(error: ErrorLike): number | undefined {
  return error.status ?? error.statusCode
}

function getRawMessage(error: ErrorLike): string {
  return String(error.message || error.details || error.hint || '').trim()
}

function isValidationMessage(normalizedMessage: string): boolean {
  return [
    'obligator',
    'camp',
    'email invalid',
    'parola',
    'cantitate',
    'pret',
    'tarif',
    'trebuie sa fie',
    'trebuie sa aiba',
    'nu coincide',
    'nu este valida',
    'nu este valid',
    'selecteaza',
    'alege',
    'tenant indisponibil',
    'tenant invalid',
    'completeaza',
    'completa',
    'invalid pentru tenantul curent',
  ].some((token) => normalizedMessage.includes(token))
}

function isNetworkError(error: ErrorLike, normalizedMessage: string): boolean {
  const status = getStatus(error)
  return (
    status === 0 ||
    normalizedMessage.includes('failed to fetch') ||
    normalizedMessage.includes('networkerror') ||
    normalizedMessage.includes('network request failed') ||
    normalizedMessage.includes('load failed') ||
    normalizedMessage.includes('fetch failed')
  )
}

function isPermissionError(error: ErrorLike, normalizedMessage: string): boolean {
  const status = getStatus(error)
  return (
    status === 403 ||
    normalizedMessage.includes('permission denied') ||
    normalizedMessage.includes('row-level security') ||
    normalizedMessage.includes('violates row-level security') ||
    normalizedMessage.includes('forbidden')
  )
}

function looksTechnical(normalizedMessage: string): boolean {
  return [
    'pgrst',
    'postgres',
    'schema cache',
    'duplicate key',
    'violates',
    'null value',
    'relation',
    'column',
    'jwt',
    'syntax error',
    'unexpected',
  ].some((token) => normalizedMessage.includes(token))
}

export function isCatalogFallbackEligible(error: unknown): boolean {
  const candidate = (error ?? {}) as ErrorLike
  const normalizedMessage = normalizeText(getRawMessage(candidate))
  return (
    candidate.code === '42501' ||
    isPermissionError(candidate, normalizedMessage) ||
    isNetworkError(candidate, normalizedMessage)
  )
}

export function toUserFacingErrorMessage(
  error: unknown,
  fallbackMessage = GENERIC_SAVE_MESSAGE
): string {
  const candidate = (error ?? {}) as ErrorLike
  const rawMessage = getRawMessage(candidate)
  if (!rawMessage) return fallbackMessage

  const normalizedMessage = normalizeText(rawMessage)

  if (candidate.code === '42501') return ACCESS_DENIED_MESSAGE
  if (isPermissionError(candidate, normalizedMessage)) return PERMISSION_MESSAGE
  if (isNetworkError(candidate, normalizedMessage)) return NETWORK_MESSAGE
  if (isValidationMessage(normalizedMessage)) return rawMessage
  if (looksTechnical(normalizedMessage)) return fallbackMessage
  if (
    normalizedMessage.includes('seed') ||
    normalizedMessage.includes('tabele:') ||
    normalizedMessage.includes('negative_stock') ||
    normalizedMessage.includes('stocul ar deveni')
  ) {
    return rawMessage
  }
  if (normalizedMessage.startsWith('error') || normalizedMessage.startsWith('eroare')) {
    return fallbackMessage
  }

  return rawMessage
}

export {
  ACCESS_DENIED_MESSAGE,
  GENERIC_SAVE_MESSAGE,
  NETWORK_MESSAGE,
  PERMISSION_MESSAGE,
}
