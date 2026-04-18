import Fuse, { type IFuseOptions } from 'fuse.js'

import type { ProdusFitosanitar } from '@/lib/supabase/queries/tratamente'
import { normalizeForSearch } from '@/lib/utils/string'

import type { ProdusMatch } from '@/lib/tratamente/import/types'

type NormalizedProdus = ProdusFitosanitar & {
  nume_comercial_normalizat: string
}

const fuseOptions: IFuseOptions<NormalizedProdus> = {
  keys: ['nume_comercial_normalizat'],
  threshold: 0.3,
  includeScore: true,
  ignoreLocation: true,
  minMatchCharLength: 3,
}

export function fuzzyMatchProdus(
  produsInput: string,
  produse: ProdusFitosanitar[]
): ProdusMatch {
  const normalizedInput = normalizeForSearch(produsInput)
  if (!normalizedInput) {
    return { tip: 'none' }
  }

  const normalizedProduse = produse.map<NormalizedProdus>((produs) => ({
    ...produs,
    nume_comercial_normalizat: normalizeForSearch(produs.nume_comercial),
  }))

  const exact = normalizedProduse.find(
    (produs) => produs.nume_comercial_normalizat === normalizedInput
  )

  if (exact) {
    return {
      tip: 'exact',
      produs_id: exact.id,
      produs_nume: exact.nume_comercial,
    }
  }

  const fuse = new Fuse(normalizedProduse, fuseOptions)
  const sugestii = fuse
    .search(normalizedInput)
    .filter((result) => typeof result.score === 'number' && result.score < 0.3)
    .slice(0, 3)
    .map((result) => ({
      produs_id: result.item.id,
      produs_nume: result.item.nume_comercial,
      scor: Math.round((1 - (result.score ?? 1)) * 100),
    }))

  if (sugestii.length === 0) {
    return { tip: 'none' }
  }

  return {
    tip: 'fuzzy',
    sugestii,
  }
}
