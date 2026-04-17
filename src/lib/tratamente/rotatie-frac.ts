import type { ProdusFitosanitar } from '@/lib/supabase/queries/tratamente'

export interface AplicareAplicata {
  aplicareId: string
  produsId?: string | null
  produsNume: string
  dataAplicata: Date | string
}

export interface FracTimelineItem {
  aplicareId: string
  produsId?: string | null
  produsNume: string
  dataAplicata: Date
  fracIracRaw: string | null
  coduri: string[]
  codPrincipal: string | null
}

export type FracTimeline = FracTimelineItem[]

export interface FracViolation {
  code: string
  count: number
  firstAplicareId: string
  lastAplicareId: string
}

function toDate(value: Date | string): Date {
  const parsed = value instanceof Date ? new Date(value) : new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    throw new Error('Data aplicării este invalidă.')
  }

  return parsed
}

function extractCodes(raw: string | null | undefined): string[] {
  if (!raw) return []

  const normalized = raw.toUpperCase()
  const matches = [...normalized.matchAll(/(?:FRAC|IRAC)\s*([A-Z0-9]+(?:\s*\+\s*[A-Z0-9]+)*)/g)]

  return matches
    .flatMap((match) => match[1].split('+'))
    .map((item) => item.replace(/\s+/g, '').trim())
    .filter(Boolean)
}

/**
 * Convertește istoricul de aplicări într-o cronologie FRAC/IRAC folosind produsele cunoscute.
 * Exemplu: `extractFracHistory(aplicari, produse)`
 */
export function extractFracHistory(
  aplicari: AplicareAplicata[],
  produse: ProdusFitosanitar[]
): FracTimeline {
  const produseById = new Map(produse.map((produs) => [produs.id, produs]))
  const produseByName = new Map(produse.map((produs) => [produs.nume_comercial.toLowerCase(), produs]))

  return aplicari
    .map((aplicare) => {
      const produs =
        (aplicare.produsId ? produseById.get(aplicare.produsId) : null) ??
        produseByName.get(aplicare.produsNume.toLowerCase()) ??
        null
      const coduri = extractCodes(produs?.frac_irac)

      return {
        aplicareId: aplicare.aplicareId,
        produsId: aplicare.produsId ?? null,
        produsNume: aplicare.produsNume,
        dataAplicata: toDate(aplicare.dataAplicata),
        fracIracRaw: produs?.frac_irac ?? null,
        coduri,
        codPrincipal: coduri[0] ?? null,
      }
    })
    .sort((a, b) => a.dataAplicata.getTime() - b.dataAplicata.getTime())
}

/**
 * Detectează secvențele consecutive de același cod FRAC/IRAC peste pragul permis.
 * Exemplu: `detectConsecutiveFrac(timeline, 2)`
 */
export function detectConsecutiveFrac(
  timeline: FracTimeline,
  maxConsecutive = 2
): FracViolation[] {
  const violations: FracViolation[] = []
  let currentCode: string | null = null
  let count = 0
  let firstAplicareId: string | null = null
  let lastAplicareId: string | null = null

  const flush = () => {
    if (currentCode && count > maxConsecutive && firstAplicareId && lastAplicareId) {
      violations.push({
        code: currentCode,
        count,
        firstAplicareId,
        lastAplicareId,
      })
    }
  }

  for (const item of timeline) {
    if (!item.codPrincipal) {
      flush()
      currentCode = null
      count = 0
      firstAplicareId = null
      lastAplicareId = null
      continue
    }

    if (item.codPrincipal === currentCode) {
      count += 1
      lastAplicareId = item.aplicareId
      continue
    }

    flush()
    currentCode = item.codPrincipal
    count = 1
    firstAplicareId = item.aplicareId
    lastAplicareId = item.aplicareId
  }

  flush()
  return violations
}

/**
 * Sugerează coduri alternative pentru următoarea aplicare, evitând codul recent dominant.
 * Exemplu: `suggestNextFracGroup(timeline, produseDisponibile)`
 */
export function suggestNextFracGroup(
  timeline: FracTimeline,
  produseDisponibile: ProdusFitosanitar[]
): string[] {
  const recentCodes = [...timeline]
    .sort((a, b) => b.dataAplicata.getTime() - a.dataAplicata.getTime())
    .map((item) => item.codPrincipal)
    .filter((item): item is string => Boolean(item))

  const blocked = new Set<string>()
  const lastCode = recentCodes[0] ?? null

  if (lastCode) {
    blocked.add(lastCode)
  }

  return [...new Set(
    produseDisponibile
      .flatMap((produs) => extractCodes(produs.frac_irac))
      .filter((code) => !blocked.has(code))
  )]
}
