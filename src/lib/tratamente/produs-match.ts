import type { ProdusFitosanitar } from '@/lib/supabase/queries/tratamente'
import { normalizeForSearch } from '@/lib/utils/string'

export interface FuzzySuggestion {
  produs_id: string
  produs_nume: string
  scor: number
}

export type ProdusMatch =
  | { tip: 'exact'; produs_id: string; produs_nume: string }
  | { tip: 'fuzzy'; sugestii: FuzzySuggestion[] }
  | { tip: 'none' }

function buildBigrams(value: string): string[] {
  if (value.length < 2) return [value]
  const bigrams: string[] = []
  for (let index = 0; index < value.length - 1; index += 1) {
    bigrams.push(value.slice(index, index + 2))
  }
  return bigrams
}

function scoreSimilarity(input: string, candidate: string): number {
  if (!input || !candidate) return 0
  if (candidate.includes(input) || input.includes(candidate)) return 0.92

  const inputBigrams = buildBigrams(input)
  const candidateBigrams = buildBigrams(candidate)
  const candidateCounts = new Map<string, number>()

  for (const gram of candidateBigrams) {
    candidateCounts.set(gram, (candidateCounts.get(gram) ?? 0) + 1)
  }

  let intersection = 0
  for (const gram of inputBigrams) {
    const count = candidateCounts.get(gram) ?? 0
    if (count > 0) {
      intersection += 1
      candidateCounts.set(gram, count - 1)
    }
  }

  return (2 * intersection) / (inputBigrams.length + candidateBigrams.length)
}

export function fuzzyMatchProdus(
  produsInput: string,
  produse: ProdusFitosanitar[]
): ProdusMatch {
  const normalizedInput = normalizeForSearch(produsInput)
  if (!normalizedInput) {
    return { tip: 'none' }
  }

  const normalizedProduse = produse.map((produs) => ({
    produs,
    normalizedName: normalizeForSearch(produs.nume_comercial),
  }))

  const exact = normalizedProduse.find(
    (entry) => entry.normalizedName === normalizedInput
  )

  if (exact) {
    return {
      tip: 'exact',
      produs_id: exact.produs.id,
      produs_nume: exact.produs.nume_comercial,
    }
  }

  const sugestii = normalizedProduse
    .map((entry) => ({
      produs_id: entry.produs.id,
      produs_nume: entry.produs.nume_comercial,
      scor: Math.round(scoreSimilarity(normalizedInput, entry.normalizedName) * 100),
    }))
    .filter((entry) => entry.scor >= 45)
    .sort((first, second) => second.scor - first.scor)
    .slice(0, 3)

  if (sugestii.length === 0) {
    return { tip: 'none' }
  }

  return {
    tip: 'fuzzy',
    sugestii,
  }
}
