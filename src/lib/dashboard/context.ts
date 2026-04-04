type FarmPrimaryContext = 'solar' | 'camp' | 'mixed'

type ParcelaContextShape = {
  tip_unitate?: string | null
  rol?: string | null
}

export type FarmContext = {
  hasCommercialSolar: boolean
  hasCommercialField: boolean
  hasCommercialOrchard: boolean
  hasSolar: boolean
  hasField: boolean
  hasOrchard: boolean
  primaryContext: FarmPrimaryContext
}

function normalize(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase()
}

function hasSolar(parcele: ParcelaContextShape[]): boolean {
  return parcele.some((parcela) => normalize(parcela.tip_unitate) === 'solar')
}

function hasField(parcele: ParcelaContextShape[]): boolean {
  return parcele.some((parcela) => {
    const tip = normalize(parcela.tip_unitate)
    return tip === 'camp' || tip === 'cultura_mare'
  })
}

function hasOrchard(parcele: ParcelaContextShape[]): boolean {
  return parcele.some((parcela) => normalize(parcela.tip_unitate) === 'livada')
}

export function detectFarmContext(
  allParcele: ParcelaContextShape[],
  relevantParcele: ParcelaContextShape[] = allParcele,
): FarmContext {
  const commercialParcele = relevantParcele.filter((parcela) => normalize(parcela.rol) === 'comercial')
  const contextParcele = commercialParcele.length > 0 ? commercialParcele : allParcele

  const hasCommercialSolar = hasSolar(commercialParcele)
  const hasCommercialField = hasField(commercialParcele)
  const hasCommercialOrchard = hasOrchard(commercialParcele)

  const contextHasSolar = hasSolar(contextParcele)
  const contextHasField = hasField(contextParcele)
  const contextHasOrchard = hasOrchard(contextParcele)

  // Product rule: solar has priority only when it exists in commercial relevant parcels;
  // if there are no commercial parcels, fallback to previous all-parcels behavior.
  const primaryContext: FarmPrimaryContext = contextHasSolar ? 'solar' : 'camp'

  return {
    hasCommercialSolar,
    hasCommercialField,
    hasCommercialOrchard,
    hasSolar: contextHasSolar,
    hasField: contextHasField,
    hasOrchard: contextHasOrchard,
    primaryContext,
  }
}
