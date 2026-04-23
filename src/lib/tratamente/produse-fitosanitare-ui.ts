import type { ProdusFitosanitar } from '@/lib/supabase/queries/tratamente'

export function normalizeProdusFitosanitarSearch(value: string | null | undefined) {
  return (value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

export function getProdusFitosanitarLibrarySortRank(produs: ProdusFitosanitar) {
  return {
    activRank: produs.activ ? 0 : 1,
    tenantRank: produs.tenant_id === null ? 1 : 0,
    nume: normalizeProdusFitosanitarSearch(produs.nume_comercial),
    substanta: normalizeProdusFitosanitarSearch(produs.substanta_activa),
  }
}

export function sortProduseFitosanitareForLibrary(produse: ProdusFitosanitar[]) {
  return [...produse].sort((first, second) => {
    const firstRank = getProdusFitosanitarLibrarySortRank(first)
    const secondRank = getProdusFitosanitarLibrarySortRank(second)

    if (firstRank.activRank !== secondRank.activRank) return firstRank.activRank - secondRank.activRank
    if (firstRank.tenantRank !== secondRank.tenantRank) return firstRank.tenantRank - secondRank.tenantRank
    if (firstRank.nume !== secondRank.nume) return firstRank.nume.localeCompare(secondRank.nume, 'ro')
    return firstRank.substanta.localeCompare(secondRank.substanta, 'ro')
  })
}

export function findProdusFitosanitarLibraryMatch(
  produse: ProdusFitosanitar[],
  numeComercial: string,
  substantaActiva: string
) {
  const targetName = normalizeProdusFitosanitarSearch(numeComercial)
  const targetSubstanta = normalizeProdusFitosanitarSearch(substantaActiva)

  return sortProduseFitosanitareForLibrary(produse).find((produs) => {
    const name = normalizeProdusFitosanitarSearch(produs.nume_comercial)
    const substanta = normalizeProdusFitosanitarSearch(produs.substanta_activa)
    if (!targetName) return false
    if (name !== targetName) return false
    if (!targetSubstanta) return true
    return substanta === targetSubstanta
  })
}

export function filterProduseFitosanitareForLibrary(
  produse: ProdusFitosanitar[],
  query: string,
  includeInactive: boolean
) {
  const search = normalizeProdusFitosanitarSearch(query)
  return sortProduseFitosanitareForLibrary(produse).filter((produs) => {
    if (!includeInactive && !produs.activ) return false
    if (!search) return true

    return [
      produs.nume_comercial,
      produs.substanta_activa,
      produs.frac_irac,
      produs.tip,
    ]
      .map((value) => normalizeProdusFitosanitarSearch(value))
      .some((value) => value.includes(search))
  })
}
