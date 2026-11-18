// Contact primit prin „Distribuie” din aplicația Contacte (Web Share Target).
// Android trimite de obicei un fișier vCard (.vcf, adesea vCard 2.1 cu QUOTED-PRINTABLE pentru diacritice);
// unele aplicații trimit doar text. Parserul acceptă ambele.

export interface SharedContact {
  name: string
  phone: string
}

const MAX_INPUT = 64 * 1024

function decodeQuotedPrintable(value: string): string {
  const bytes: number[] = []
  for (let i = 0; i < value.length; i += 1) {
    const ch = value[i]
    if (ch === '=' && /^[0-9A-Fa-f]{2}$/.test(value.slice(i + 1, i + 3))) {
      bytes.push(parseInt(value.slice(i + 1, i + 3), 16))
      i += 2
    } else {
      bytes.push(...new TextEncoder().encode(ch))
    }
  }
  try {
    return new TextDecoder('utf-8', { fatal: false }).decode(new Uint8Array(bytes))
  } catch {
    return value
  }
}

function unescapeVcard(value: string): string {
  return value.replace(/\\n/gi, ' ').replace(/\\([,;\\])/g, '$1').trim()
}

function cleanPhone(value: string): string {
  const trimmed = value.trim().replace(/^tel:/i, '')
  const plus = trimmed.startsWith('+') ? '+' : ''
  const digits = trimmed.replace(/[^\d]/g, '')
  return digits.length >= 6 ? `${plus}${digits}` : ''
}

function parseVcard(text: string): SharedContact | null {
  // Linii continuate: QUOTED-PRINTABLE („=” la final) și pliere vCard (linie care începe cu spațiu/tab).
  const unfolded = text
    .replace(/=\r?\n/g, '')
    .replace(/\r?\n[ \t]/g, '')
    .split(/\r?\n/)

  let fn = ''
  let structured = ''
  const phones: Array<{ value: string; preferred: boolean; mobile: boolean }> = []

  for (const line of unfolded) {
    const colon = line.indexOf(':')
    if (colon <= 0) continue
    const rawKey = line.slice(0, colon)
    const rawValue = line.slice(colon + 1)
    const [prop, ...params] = rawKey.split(';')
    const key = prop.replace(/^item\d+\./i, '').toUpperCase()
    const paramText = params.join(';').toUpperCase()
    const value = paramText.includes('QUOTED-PRINTABLE') ? decodeQuotedPrintable(rawValue) : rawValue

    if (key === 'FN' && !fn) fn = unescapeVcard(value)
    else if (key === 'N' && !structured) {
      const [family = '', given = '', middle = ''] = value.split(';').map(unescapeVcard)
      structured = [given, middle, family].filter(Boolean).join(' ')
    } else if (key === 'TEL') {
      const phone = cleanPhone(value)
      if (phone) {
        phones.push({
          value: phone,
          preferred: /PREF/.test(paramText),
          mobile: /CELL|MOBILE/.test(paramText),
        })
      }
    }
  }

  const phone = (phones.find((p) => p.preferred) ?? phones.find((p) => p.mobile) ?? phones[0])?.value ?? ''
  const name = fn || structured
  if (!name && !phone) return null
  return { name: name.slice(0, 120), phone }
}

function parsePlainText(text: string): SharedContact | null {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
  let phone = ''
  const nameParts: string[] = []
  for (const line of lines) {
    const candidate = cleanPhone(line)
    if (!phone && candidate && /^[+\d\s().-]+$/.test(line.replace(/^tel:/i, ''))) phone = candidate
    else if (!/^https?:\/\//i.test(line)) nameParts.push(line)
  }
  const name = nameParts.join(' ').slice(0, 120)
  if (!name && !phone) return null
  return { name, phone }
}

export function parseSharedContact(input: string | null | undefined): SharedContact | null {
  const text = (input ?? '').slice(0, MAX_INPUT)
  if (!text.trim()) return null
  if (/BEGIN:VCARD/i.test(text)) return parseVcard(text)
  return parsePlainText(text)
}
