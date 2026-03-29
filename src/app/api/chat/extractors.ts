import { getShiftedDayInBucharest } from './date-helpers'
import { escapeRegexLiteral } from './utils'

export interface ExtractCleanTextCandidateParams {
  consumedValues?: Array<string | number | undefined | null>
  stopWords?: RegExp
  minLength?: number
  maxLength?: number
  preferAfterComma?: boolean
}

function hasTooManySingleLetterTokens(value: string): boolean {
  const matches = value.match(/(?:^|\s)[a-zăâîșşțţ](?=\s|$)/giu)
  return (matches?.length ?? 0) >= 2
}

export function extractCorrectionPayload(message: string): string | undefined {
  const trimmed = message.trim()
  const withComma = trimmed.match(/^nu\s+[^,]+,\s*(.+)$/i)
  if (withComma?.[1]) return withComma[1].trim()
  const shortNu = trimmed.match(/^nu\s*,\s*(.+)$/i)
  if (shortNu?.[1]) return shortNu[1].trim()
  const prefixed = trimmed.match(/^(?:de fapt|mai bine|corect este|rectific)\s+(.+)$/i)
  if (prefixed?.[1]) return prefixed[1].trim()
  return undefined
}

export function extractDateRo(message: string, today: string, yesterday: string): string | undefined {
  if (/\b(?:alalt[aă]ieri|acum 2 zile|acum dou[aă] zile)\b/i.test(message)) return getShiftedDayInBucharest(-2)
  if (/\b(?:azi|ast[aă]zi)\b/i.test(message)) return today
  if (/\b(?:ieri|de ieri)\b/i.test(message)) return yesterday
  if (/\bpoim[aâ]ine\b/i.test(message)) return getShiftedDayInBucharest(2)
  if (/\bm[aâ]ine\b/i.test(message)) return getShiftedDayInBucharest(1)

  const m = message.match(/(\d{1,2})[./](\d{1,2})(?:[./](\d{2,4}))?/)
  if (!m) return undefined
  const year = m[3] ? (m[3].length === 2 ? `20${m[3]}` : m[3]) : today.slice(0, 4)
  return `${year}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
}

export function extractSuma(message: string): number | undefined {
  const m = message.match(/(\d+(?:[.,]\d+)?)\s*(?:de\s+)?(?:lei|ron)\b/i)
  return m ? parseFloat(m[1].replace(',', '.')) : undefined
}

export function extractPretPerKg(message: string): number | undefined {
  const m = message.match(/(\d+(?:[.,]\d+)?)\s*(?:de\s+)?(?:lei|ron)\s*(?:\/|pe\s*)\s*kg\b/i)
  return m ? parseFloat(m[1].replace(',', '.')) : undefined
}

export function extractCantitateKg(message: string): number | undefined {
  const m = message.match(/(\d+(?:[.,]\d+)?)\s*(?:de\s+)?(?:kg|kile|kilograme?)\b/i)
  return m ? parseFloat(m[1].replace(',', '.')) : undefined
}

export function extractDoza(message: string): string | undefined {
  if (/\b(o\s+)?jum[aă]tate\s+de\s+litru\b|\bjumate\s+de\s+litru\b/i.test(message)) {
    return '0.5L'
  }

  const m = message.match(/(\d+(?:[.,]\d+)?)\s*(?:de\s+)?(ml|l|kg|g)\b/i)
  if (!m) return undefined

  const value = parseFloat(m[1].replace(',', '.'))
  const unit = m[2].toLowerCase()
  if (!Number.isFinite(value)) return undefined

  if (unit === 'ml') {
    const liters = value / 1000
    const normalized = Number.isInteger(liters) ? String(liters) : String(Number(liters.toFixed(3)))
    return `${normalized}L`
  }

  return `${m[1].replace(',', '.')}${unit.toUpperCase()}`
}

export function extractParcela(message: string): string | undefined {
  const parcelaNamedMatch = message.match(
    /\bparcela\s+([a-z0-9ăâîșşțţ\-\s]{2,60}?)(?=(?:\s+(?:cu|si|și|din|pentru|azi|ast[aă]zi|ieri|m[aâ]ine|poim[aâ]ine|in|în)\b|[,.!?]|$))/i
  )
  // BUG-FOUND: formulările de recoltare de tip "azi din Delniwa" nu erau extrase,
  // fiindcă matcher-ul accepta doar "la / pe / de pe", nu și "din".
  const match = message.match(
    /\b(?:de pe|pe|la|din)\s+([a-z0-9ăâîșşțţ\-\s]{2,60}?)(?=(?:\s+(?:cu|si|și|din|pentru|azi|ast[aă]zi|ieri|m[aâ]ine|poim[aâ]ine|in|în)\b|[,.!?]|$))/i
  )
  const fallbackMatch = parcelaNamedMatch?.[1] || match?.[1]
    ? null
    : message.match(
        /\b(?:recoltare|recoltat|am recoltat|am cules|stropit|stropire|irigat|irigare|erbicidat)\s+([a-zăâîșşțţ][a-z0-9ăâîșşțţ\-\s]{1,60}?)(?=(?:\s+\d+(?:[.,]\d+)?\s*(?:kg|kile|kilograme?|ml|l|g)\b|\s+(?:cu|azi|ast[aă]zi|ieri|m[aâ]ine|poim[aâ]ine|de fapt|in|în)\b|[,.!?]|$))/i
      )
  const value = (parcelaNamedMatch?.[1] ?? match?.[1] ?? fallbackMatch?.[1] ?? '').trim().replace(/\s+/g, ' ')
  if (/^(azi|ast[aă]zi|ieri|m[aâ]ine|poim[aâ]ine|alalt[aă]ieri)$/i.test(value)) return undefined
  return value.length >= 2 ? value : undefined
}

export function extractProdus(message: string): string | undefined {
  const match = message.match(
    /\bcu\s+([a-z0-9ăâîșşțţ\-\s]{2,60}?)(?=(?:\s+\d+(?:[.,]\d+)?\s*(?:ml|l|kg|g)\b|\s+(?:azi|ast[aă]zi|ieri|m[aâ]ine|poim[aâ]ine|la|pe|in|în)\b|[,.!?]|$))/i
  )
  if (!match?.[1]) return undefined
  const value = match[1].trim().replace(/\s+/g, ' ')
  return value.length >= 2 ? value : undefined
}

export function extractActivitateTip(message: string): string | undefined {
  if (/(stropit|stropire|tratat|tratament)/i.test(message)) return 'tratament'
  if (/(irigat|irigare)/i.test(message)) return 'irigare'
  if (/(erbicidat|erbicidare)/i.test(message)) return 'erbicidat'
  if (/(fertirigat|fertigare)/i.test(message)) return 'fertirigare'
  if (/(fertilizat|fertilizare)/i.test(message)) return 'fertilizare'
  if (/(plantat|plantare)/i.test(message)) return 'plantare'
  if (/(t[ăa]iat|taiere)/i.test(message)) return 'tăiere'
  if (/(cosit|cosire)/i.test(message)) return 'cosit'
  if (/(pr[aă][șs]it|prasire)/i.test(message)) return 'prășit'
  if (/(legat|legare)/i.test(message)) return 'legat'
  if (/palisat/i.test(message)) return 'palisat'
  if (/copilit/i.test(message)) return 'copilit'
  return undefined
}

export function extractNumeClient(message: string): string | undefined {
  // BUG-FOUND: comenzile formulate cu abrevierea uzuală "pt" (ex. "Fă o comandă pt Matia 5 kg azi")
  // nu extrăgeau clientul, deoarece regex-ul accepta doar forma completă "pentru".
  const match = message.match(/\b(?:pentru|pt)\s+([a-zăâîșşțţ][a-z0-9ăâîșşțţ\- ]{1,60}?)(?=(?:\s+\d+(?:[.,]\d+)?\s*(?:kg|kile|kilograme?)\b|\s+(?:de|din|la|cu|azi|ieri|m[aâ]ine|poim[aâ]ine)\b|[,.!?]|$))/i)
  const fallbackMatch = match?.[1]
    ? null
    : message.match(/\bcomand[aă]?\s+([a-zăâîșşțţ][a-z0-9ăâîșşțţ\- ]{1,60}?)(?=(?:\s+\d+(?:[.,]\d+)?\s*(?:kg|kile|kilograme?)\b|\s+(?:azi|ieri|m[aâ]ine|poim[aâ]ine|la|cu|din)\b|[,.!?]|$))/i)
  const value = (match?.[1] ?? fallbackMatch?.[1] ?? '').trim().replace(/\s+/g, ' ')
  return value.length >= 2 ? value : undefined
}

export function extractClientName(message: string): string | undefined {
  const fromIntent = message.match(/(?:client nou|client[aă] nou)\s+([a-zăâîșşțţ][a-zăâîșşțţ\- ]{1,60}?)(?=(?:\s+(?:\+?4[\s-]?)?0\d|[,.!?]|$))/i)
  if (fromIntent?.[1]) return fromIntent[1].trim().replace(/\s+/g, ' ')
  const bare = message.trim()
  if (/^client(?:\s+nou)?$/i.test(bare)) return undefined
  if (/^[a-zăâîșşțţ][a-z0-9ăâîșşțţ\- ]{1,40}$/i.test(bare) && !/\d/.test(bare)) {
    return bare.replace(/\s+/g, ' ')
  }
  return undefined
}

function normalizeTelefon(value: string): string | undefined {
  const digits = value.replace(/\D+/g, '')
  if (/^0\d{9}$/.test(digits)) return digits
  if (/^40\d{9}$/.test(digits)) return `0${digits.slice(2)}`
  if (/^4\d{9}$/.test(digits)) return `0${digits.slice(1)}`
  return undefined
}

export function extractTelefon(message: string): string | undefined {
  const match = message.match(/(?:\+?4[\s-]?)?0\d(?:[\s-]?\d){8,12}/)
  if (!match?.[0]) return undefined
  return normalizeTelefon(match[0])
}

export function extractComandaProdus(message: string): string | undefined {
  const byKg = message.match(/\b\d+(?:[.,]\d+)?\s*kg\s+de\s+([a-zăâîșşțţ][a-z0-9ăâîșşțţ\- ]{1,60}?)(?=(?:\s+(?:azi|ieri|m[aâ]ine|poim[aâ]ine|pentru|din|la)\b|[,.!?]|$))/i)
  if (byKg?.[1]) {
    const value = byKg[1].trim().replace(/\s+/g, ' ')
    if (!/^(azi|ieri|m[aâ]ine|poim[aâ]ine)$/i.test(value)) return value
  }

  const byFruit = message.match(/\b(zmeur[aă]?|mure|afine|c[aă]pșuni|capsuni)\b/i)
  if (byFruit?.[1]) return byFruit[1].trim().replace(/\s+/g, ' ')
  return undefined
}

export function extractComandaSursa(message: string): string | undefined {
  const match = message.match(/\b(?:din|de pe)\s+(?:parcela|soiul?|soi)\s+([a-z0-9ăâîșşțţ\- ]{1,60}?)(?=(?:\s+(?:azi|ieri|m[aâ]ine|poim[aâ]ine|pentru|cu)\b|[,.!?]|$))/i)
  if (!match?.[1]) return undefined
  const value = match[1].trim().replace(/\s+/g, ' ')
  return value.length >= 2 ? value : undefined
}

export function extractCleanTextCandidate(
  message: string,
  params: ExtractCleanTextCandidateParams = {}
): string | undefined {
  const {
    consumedValues = [],
    stopWords,
    minLength = 4,
    maxLength = 200,
    preferAfterComma = false,
  } = params

  const source = preferAfterComma && message.includes(',') ? message.split(',').slice(1).join(',') : message
  let cleaned = source
    .replace(/(adaugă|adauga|creează|creeaza|înregistrează|inregistreaza|pune|bagă|baga|fa|fă|noteaza|notează|inscrie|înscrie|te rog|rog|please)/gi, ' ')
    .replace(/\btrece\b/gi, ' ')
    .replace(/\b(?:am|sa|să|mi|m[ia]-?o|o)\b/gi, ' ')
    .replace(/\d+(?:[.,]\d+)?\s*(?:de\s+)?(?:lei|ron)\b/gi, ' ')
    .replace(/\d{1,2}[./]\d{1,2}(?:[./]\d{2,4})?/g, ' ')
    .replace(/\b(?:azi|astăzi|astazi|ieri|alalt[aă]ieri|acum 2 zile|acum dou[aă] zile|m[âa]ine|poim[âa]ine|data|pentru data|in data de|în data de)\b/gi, ' ')
    .replace(/\b\d+(?:[.,]\d+)?\s*(?:kg|kile|kilograme?|ml|l|g)\b/gi, ' ')
    .replace(/\b(?:te|rog|vă|va|pls)\b/gi, ' ')

  if (stopWords) cleaned = cleaned.replace(stopWords, ' ')

  for (const raw of consumedValues) {
    const value = String(raw ?? '').trim()
    if (value.length < 2) continue
    cleaned = cleaned.replace(new RegExp(`\\b${escapeRegexLiteral(value)}\\b`, 'gi'), ' ')
  }

  cleaned = cleaned
    .replace(/\s+/g, ' ')
    .replace(/^[,;:.!?'"`\-\s]+/, '')
    .replace(/^(?:(?:de|cu|pentru|la|din|pe|și|si|in|în|catre|către|o|un|una)\b[\s,;:.!?'"`\-]*)+/i, '')
    .replace(/(?:[\s,;:.!?'"`\-]+(?:de|cu|pentru|la|din|pe|și|si|in|în|catre|către)\b)+[\s,;:.!?'"`\-]*$/i, '')
    .replace(/^[,;:.!?'"`\-\s]+|[,;:.!?'"`\-\s]+$/g, '')
    .trim()

  if (!cleaned || cleaned.length < minLength || cleaned.length > maxLength) return undefined
  if (/^(de|cu|pentru|la|din|pe|și|si|in|în|te|rog)$/i.test(cleaned)) return undefined

  const tokens = cleaned.split(/\s+/).filter(Boolean)
  const usefulTokens = tokens.filter((token) => token.length >= 3 || /\d/.test(token))
  if (tokens.length === 1 && usefulTokens.length === 0) return undefined
  if (tokens.length > 1 && usefulTokens.length === 0) return undefined
  if (hasTooManySingleLetterTokens(cleaned)) return undefined

  return cleaned.substring(0, maxLength)
}

export function extractDescriere(
  message: string,
  stopWords: RegExp,
  consumedValues: Array<string | undefined> = []
): string | undefined {
  const cleaned = extractCleanTextCandidate(message, {
    consumedValues,
    stopWords,
    minLength: 5,
    maxLength: 200,
  })
  if (!cleaned) return undefined

  const tokens = cleaned.split(/\s+/).filter(Boolean)
  const usefulTokens = tokens.filter((token) => token.length >= 3)
  const vowels = tokens.filter((token) => /[aeiouăâî]/i.test(token))
  const isSingleMeaningfulToken =
    tokens.length === 1 &&
    usefulTokens.length === 1 &&
    tokens[0].length >= 4 &&
    vowels.length === 1
  if (!isSingleMeaningfulToken && tokens.length < 2) return undefined
  if (!isSingleMeaningfulToken && usefulTokens.length < 2) return undefined
  if (vowels.length < Math.ceil(tokens.length / 2)) return undefined
  if (/^(de|cu|pentru|la|din|pe|și|si|in|în)$/i.test(tokens[tokens.length - 1] ?? '')) return undefined
  if (hasTooManySingleLetterTokens(cleaned)) return undefined

  return cleaned.substring(0, 200)
}

export function extractObservatiiCandidate(
  message: string,
  consumedValues: Array<string | number | undefined | null> = []
): string | undefined {
  const hasComma = message.includes(',')
  const commonNoiseRegex = /\b(?:recoltare|recoltat|am recoltat|activitate|stropit|stropire|comand[aă]?|client(?:ul)?|pentru|de|la|cu|kg|kile|kilograme?|ml|l|g)\b/gi
  const baseCandidate = extractCleanTextCandidate(message, {
    consumedValues,
    stopWords: commonNoiseRegex,
    minLength: 4,
    maxLength: 180,
    preferAfterComma: hasComma,
  })
  if (!baseCandidate) return undefined
  const candidate = baseCandidate.trim()
  if (!candidate) return undefined
  if (/\b(?:recoltare|activitate|comand[aă]?|client)\b/i.test(candidate)) return undefined
  if (/^(?:de|la|cu|si|și|pentru|te rog|rog)$/i.test(candidate)) return undefined

  const tokens = candidate.split(/\s+/).filter(Boolean)
  const hasTimeNote = /\b(?:dup[aă]|inainte|înainte)\b\s*\d+/i.test(candidate)
  const hasQualityNote = /\b(?:moale|zdrobit|ferm|calitate|platit|pl[aă]tit|partial|par[țt]ial|sun[aă]|urgent)\b/i.test(candidate)
  if (!hasComma && !hasTimeNote && !hasQualityNote && tokens.length < 3) return undefined

  return candidate
}
