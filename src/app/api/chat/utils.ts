export interface StructuredExtractionErrorSummary {
  name: string
  message: string
  kind: 'validation' | 'json_parse' | 'provider_runtime' | 'unknown'
  validationSummary?: string
}

export function toNumberOrNull(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  return value
}

export function summarizeStructuredExtractionError(error: unknown): StructuredExtractionErrorSummary {
  const fallback: StructuredExtractionErrorSummary = {
    name: 'UnknownError',
    message: 'Unknown structured extraction error',
    kind: 'unknown',
  }

  if (!(error instanceof Error)) return fallback

  const name = error.name || 'Error'
  const message = error.message || 'Structured extraction failed'
  const normalized = `${name} ${message}`.toLowerCase()

  let kind: StructuredExtractionErrorSummary['kind'] = 'unknown'
  if (
    normalized.includes('zod') ||
    normalized.includes('schema') ||
    normalized.includes('validation') ||
    normalized.includes('invalid_type')
  ) {
    kind = 'validation'
  } else if (
    normalized.includes('json') ||
    normalized.includes('parse') ||
    normalized.includes('unexpected token')
  ) {
    kind = 'json_parse'
  } else if (
    normalized.includes('network') ||
    normalized.includes('provider') ||
    normalized.includes('fetch') ||
    normalized.includes('timeout') ||
    normalized.includes('gateway') ||
    normalized.includes('model')
  ) {
    kind = 'provider_runtime'
  }

  const errorWithIssues = error as Error & {
    issues?: Array<{ path?: Array<string | number>; message?: string }>
    cause?: unknown
  }
  const directIssues = Array.isArray(errorWithIssues.issues) ? errorWithIssues.issues : []
  const causeIssues = Array.isArray((errorWithIssues.cause as { issues?: unknown })?.issues)
    ? ((errorWithIssues.cause as { issues?: Array<{ path?: Array<string | number>; message?: string }> }).issues ?? [])
    : []
  const issues = directIssues.length > 0 ? directIssues : causeIssues

  const validationSummary = issues.length > 0
    ? issues
      .slice(0, 3)
      .map((issue) => {
        const path = Array.isArray(issue.path) && issue.path.length > 0 ? issue.path.join('.') : 'root'
        const text = issue.message?.trim() || 'invalid'
        return `${path}: ${text}`
      })
      .join(' | ')
    : undefined

  return { name, message, kind, validationSummary }
}

export function escapeRegexLiteral(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function detectClearedFields(message: string): Set<string> {
  const msg = message.toLowerCase()
  const cleared = new Set<string>()
  if (/(f[aă]r[aă]\s+telefon|nu am telefon|las[aă]\s+telefonul\s+gol|scoate telefon|[șs]terge telefon)/i.test(msg)) cleared.add('telefon')
  if (/(f[aă]r[aă]\s+parcel[aă]|f[aă]r[aă]\s+surs[aă]|scoate parcela|scoate sursa|[șs]terge parcela|[șs]terge sursa)/i.test(msg)) {
    cleared.add('parcela')
    cleared.add('sursa')
  }
  if (/(nu [șs]tiu data|f[aă]r[aă]\s+dat[aă]|scoate data|[șs]terge data)/i.test(msg)) cleared.add('data')
  if (/(f[aă]r[aă]\s+observa[țt]ii|scoate observa[țt]iile|[șs]terge observa[țt]iile)/i.test(msg)) cleared.add('observatii')
  if (/(nu mai pune produsul|f[aă]r[aă]\s+produs|scoate produsul|[șs]terge produsul)/i.test(msg)) cleared.add('produs')
  if (/(scoate cantitatea|[șs]terge cantitatea|f[aă]r[aă]\s+cantitate)/i.test(msg)) cleared.add('cantitate')
  if (/(scoate doza|[șs]terge doza|f[aă]r[aă]\s+doz[aă])/i.test(msg)) cleared.add('doza')
  if (/(scoate suma|[șs]terge suma|f[aă]r[aă]\s+sum[aă])/i.test(msg)) cleared.add('suma')
  return cleared
}

export function normalizeForMatch(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

export function levenshteinDistance(a: string, b: string): number {
  const m = a.length
  const n = b.length
  if (!m) return n
  if (!n) return m

  const dp = Array.from({ length: m + 1 }, (_, i) => [i])
  for (let j = 1; j <= n; j++) dp[0][j] = j

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      )
    }
  }
  return dp[m][n]
}

export function sanitizeCanonicalEntity(
  raw: string | undefined,
  type: 'parcela' | 'produs' | 'client'
): string | undefined {
  const value = (raw ?? '').trim().replace(/\s+/g, ' ')
  if (!value) return undefined
  let cleaned = value

  if (type === 'parcela') {
    cleaned = cleaned.replace(/^(?:parcela|de pe|pe|la|din)\s+/i, '').trim()
    if (/\b(?:kg|kile|kilograme?|ml|l|g|azi|ast[aă]zi|ieri|m[aâ]ine|poim[aâ]ine|ora)\b/i.test(cleaned)) return undefined
  }
  if (type === 'produs') {
    cleaned = cleaned.replace(/^(?:produsul|produs)\s+/i, '').trim()
    if (/\b(?:azi|ast[aă]zi|ieri|m[aâ]ine|poim[aâ]ine|dup[aă]|ora)\b/i.test(cleaned)) return undefined
  }
  if (type === 'client') {
    cleaned = cleaned.replace(/^(?:clientul|client)\s+/i, '').trim()
    if (/\b(?:kg|kile|kilograme?|ml|l|g|azi|ast[aă]zi|ieri|m[aâ]ine|poim[aâ]ine|ora)\b/i.test(cleaned)) return undefined
  }

  return cleaned.length >= 2 ? cleaned : undefined
}
