const DEFAULT_MAX_DEPTH = 4
const DEFAULT_MAX_ARRAY_LENGTH = 20
const DEFAULT_MAX_OBJECT_KEYS = 50
const DEFAULT_MAX_STRING_LENGTH = 220

const SENSITIVE_KEY_RE =
  /(token|secret|password|authorization|cookie|api[_-]?key|session|private[_-]?key|client_secret|refresh_token|access_token|id_token)/i
const TEXT_KEY_RE = /(message|prompt|input|content|text|body|payload|query)$/i

const EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi
const PHONE_RE = /(?<!\w)(?:\+?\d[\d().\s-]{7,}\d)(?!\w)/g
const BEARER_RE = /\bBearer\s+[A-Za-z0-9\-._~+/]+=*/gi
const JWT_RE = /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g
const TOKEN_ASSIGNMENT_RE =
  /\b(?:access_token|refresh_token|id_token|token|secret|api[_-]?key)\s*[:=]\s*([^\s,;]+)/gi

type Primitive = null | undefined | string | number | boolean | bigint

export type SanitizeForLogOptions = {
  maxDepth?: number
  maxArrayLength?: number
  maxObjectKeys?: number
  maxStringLength?: number
  redactTextFields?: boolean
}

type ErrorWithDetails = Error & {
  code?: unknown
  status?: unknown
  statusCode?: unknown
}

function toFinitePositiveNumber(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 1) return fallback
  return Math.floor(value)
}

function applyPatternRedactions(value: string): string {
  return value
    .replace(BEARER_RE, 'Bearer [REDACTED_TOKEN]')
    .replace(JWT_RE, '[REDACTED_JWT]')
    .replace(TOKEN_ASSIGNMENT_RE, (fullMatch) => fullMatch.replace(/[:=].+$/, '=[REDACTED]'))
    .replace(EMAIL_RE, '[REDACTED_EMAIL]')
    .replace(PHONE_RE, '[REDACTED_PHONE]')
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value
  return `${value.slice(0, maxLength)}… [TRUNCATED ${value.length - maxLength} chars]`
}

function sanitizeString(
  value: string,
  options: Required<SanitizeForLogOptions>,
  key?: string,
): string {
  const isSensitiveKey = Boolean(key && SENSITIVE_KEY_RE.test(key))
  if (isSensitiveKey) return '[REDACTED]'

  if (options.redactTextFields && key && TEXT_KEY_RE.test(key)) {
    return `[REDACTED_TEXT len=${value.length}]`
  }

  return truncate(applyPatternRedactions(value), options.maxStringLength)
}

function sanitizePrimitive(
  value: Primitive,
  options: Required<SanitizeForLogOptions>,
  key?: string,
) {
  if (typeof value === 'string') return sanitizeString(value, options, key)
  return value
}

function sanitizeInternal(
  value: unknown,
  options: Required<SanitizeForLogOptions>,
  depth: number,
  seen: WeakSet<object>,
  key?: string,
): unknown {
  if (
    value === null ||
    value === undefined ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    typeof value === 'bigint'
  ) {
    return sanitizePrimitive(value, options, key)
  }

  if (typeof value === 'symbol') {
    return String(value)
  }

  if (typeof value === 'function') {
    return `[Function ${value.name || 'anonymous'}]`
  }

  if (value instanceof Date) {
    return value.toISOString()
  }

  if (value instanceof Error) {
    return toSafeErrorContext(value)
  }

  if (typeof value !== 'object') {
    return String(value)
  }

  if (depth >= options.maxDepth) {
    return '[TRUNCATED_DEPTH]'
  }

  if (seen.has(value)) {
    return '[CIRCULAR]'
  }
  seen.add(value)

  if (Array.isArray(value)) {
    const limited = value.slice(0, options.maxArrayLength)
    const out = limited.map((entry) => sanitizeInternal(entry, options, depth + 1, seen))
    if (value.length > options.maxArrayLength) {
      out.push(`[TRUNCATED_ITEMS ${value.length - options.maxArrayLength}]`)
    }
    return out
  }

  const entries = Object.entries(value as Record<string, unknown>)
  const limitedEntries = entries.slice(0, options.maxObjectKeys)
  const out: Record<string, unknown> = {}

  for (const [entryKey, entryValue] of limitedEntries) {
    if (SENSITIVE_KEY_RE.test(entryKey)) {
      out[entryKey] = '[REDACTED]'
      continue
    }
    out[entryKey] = sanitizeInternal(entryValue, options, depth + 1, seen, entryKey)
  }

  if (entries.length > options.maxObjectKeys) {
    out.__truncated_keys = entries.length - options.maxObjectKeys
  }

  return out
}

export function sanitizeForLog(value: unknown, options: SanitizeForLogOptions = {}): unknown {
  const normalized: Required<SanitizeForLogOptions> = {
    maxDepth: toFinitePositiveNumber(options.maxDepth, DEFAULT_MAX_DEPTH),
    maxArrayLength: toFinitePositiveNumber(options.maxArrayLength, DEFAULT_MAX_ARRAY_LENGTH),
    maxObjectKeys: toFinitePositiveNumber(options.maxObjectKeys, DEFAULT_MAX_OBJECT_KEYS),
    maxStringLength: toFinitePositiveNumber(options.maxStringLength, DEFAULT_MAX_STRING_LENGTH),
    redactTextFields: options.redactTextFields === true,
  }

  return sanitizeInternal(value, normalized, 0, new WeakSet<object>())
}

function toOptionalCode(raw: unknown): string | undefined {
  if (raw === undefined || raw === null) return undefined
  const value = String(raw).trim()
  return value.length > 0 ? truncate(applyPatternRedactions(value), 64) : undefined
}

function toOptionalStatus(raw: unknown): number | undefined {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw
  if (typeof raw === 'string' && raw.trim().length > 0) {
    const parsed = Number.parseInt(raw.trim(), 10)
    if (Number.isFinite(parsed)) return parsed
  }
  return undefined
}

export function toSafeErrorContext(error: unknown): {
  name: string
  message: string
  code?: string
  status?: number
} {
  if (error instanceof Error) {
    const err = error as ErrorWithDetails
    const code = toOptionalCode(err.code)
    const status = toOptionalStatus(err.statusCode ?? err.status)
    return {
      name: sanitizeString(error.name || 'Error', {
        maxDepth: DEFAULT_MAX_DEPTH,
        maxArrayLength: DEFAULT_MAX_ARRAY_LENGTH,
        maxObjectKeys: DEFAULT_MAX_OBJECT_KEYS,
        maxStringLength: 80,
        redactTextFields: false,
      }),
      message: sanitizeString(error.message || 'Unexpected error', {
        maxDepth: DEFAULT_MAX_DEPTH,
        maxArrayLength: DEFAULT_MAX_ARRAY_LENGTH,
        maxObjectKeys: DEFAULT_MAX_OBJECT_KEYS,
        maxStringLength: DEFAULT_MAX_STRING_LENGTH,
        redactTextFields: false,
      }),
      ...(code ? { code } : {}),
      ...(status !== undefined ? { status } : {}),
    }
  }

  return {
    name: 'UnknownError',
    message: sanitizeString(String(error), {
      maxDepth: DEFAULT_MAX_DEPTH,
      maxArrayLength: DEFAULT_MAX_ARRAY_LENGTH,
      maxObjectKeys: DEFAULT_MAX_OBJECT_KEYS,
      maxStringLength: DEFAULT_MAX_STRING_LENGTH,
      redactTextFields: false,
    }),
  }
}
