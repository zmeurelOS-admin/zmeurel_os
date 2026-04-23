import { normalizeCropCod } from '@/lib/crops/crop-codes'
import { calculeazaCupruCumulatAnual } from '@/lib/tratamente/cupru-cumulat'
import { detectConsecutiveFrac, extractFracHistory } from '@/lib/tratamente/rotatie-frac'
import {
  getGrupBiologicForCropCod,
  getLabelPentruGrup,
  getOrdine,
  getOrdineInGrup,
  listAllStadiiCanonice,
  listStadiiPentruGrup,
  normalizeStadiu,
  type GrupBiologic,
  type StadiuCod,
} from '@/lib/tratamente/stadii-canonic'
import type { ProdusFitosanitar } from '@/lib/supabase/queries/tratamente'

import type {
  LinieDozaUnitate,
  PlanWizardLinieDraft,
  PlanWizardWarning,
} from '@/components/tratamente/plan-wizard/types'

const STADIU_EMOJI: Partial<Record<StadiuCod, string>> = {
  rasad: '🌱',
  semanat: '🌾',
  repaus_vegetativ: '🌙',
  transplant: '🪴',
  umflare_muguri: '🌿',
  crestere_vegetativa: '🍃',
  formare_rozeta: '🥬',
  buton_verde: '🫛',
  etaj_floral: '🌸',
  buton_roz: '🌺',
  inflorit: '🌼',
  scuturare_petale: '🍃',
  legare_fruct: '🫐',
  fruct_verde: '🍏',
  formare_capatana: '🥗',
  bulbificare: '🧅',
  umplere_pastaie: '🫛',
  ingrosare_radacina: '🥕',
  parga: '🍓',
  maturitate: '🍇',
  bolting: '🌾',
  post_recoltare: '🍂',
}

export function getGrupBiologicDinCultura(culturaTip: string | null | undefined): GrupBiologic | null {
  return getGrupBiologicForCropCod(normalizeCropCod(culturaTip))
}

export function getStadiuOptions(grupBiologic?: GrupBiologic | null) {
  return listStadiiPentruGrup(grupBiologic).map((value) => ({
    value,
    label: getLabelPentruGrup(value, grupBiologic),
    emoji: STADIU_EMOJI[value] ?? '🌿',
  }))
}

export function getStadiuMeta(
  stadiu: string,
  grupBiologic?: GrupBiologic | null,
  cohort?: string | null
) {
  const cod = normalizeStadiu(stadiu)

  if (cod) {
    return {
      value: cod,
      label: getLabelPentruGrup(cod, grupBiologic, { cohort }),
      emoji: STADIU_EMOJI[cod] ?? '🌿',
    }
  }

  return {
    value: stadiu as StadiuCod,
    label: stadiu,
    emoji: '🌿',
  }
}

export function getProdusDisplayName(
  linie: Pick<PlanWizardLinieDraft, 'produs_id' | 'produs_nume_manual' | 'produse'>,
  produse: ProdusFitosanitar[]
) {
  const firstProdus = linie.produse[0]
  const produsId = firstProdus?.produs_id ?? linie.produs_id
  const produs = produse.find((item) => item.id === produsId)
  const firstName =
    produs?.nume_comercial ??
    firstProdus?.produs_nume_manual?.trim() ??
    firstProdus?.produs_nume_snapshot?.trim() ??
    linie.produs_nume_manual?.trim() ??
    'Produs fără nume'

  return linie.produse.length > 1 ? `${firstName} +${linie.produse.length - 1}` : firstName
}

export function getProdusDraftDisplayName(
  produsDraft: PlanWizardLinieDraft['produse'][number],
  produse: ProdusFitosanitar[]
) {
  const produs = produse.find((item) => item.id === produsDraft.produs_id)
  return produs?.nume_comercial ?? produsDraft.produs_nume_manual?.trim() ?? produsDraft.produs_nume_snapshot?.trim() ?? 'Produs fără nume'
}

export function formatDoza(doza: number | null | undefined, unitate: LinieDozaUnitate) {
  if (typeof doza !== 'number' || !Number.isFinite(doza) || doza <= 0) {
    return 'Doză necompletată'
  }

  return `${stripTrailingZeros(doza)} ${unitate}`
}

export function stripTrailingZeros(value: number) {
  return value.toLocaleString('ro-RO', {
    maximumFractionDigits: 3,
    minimumFractionDigits: Number.isInteger(value) ? 0 : 1,
  })
}

export function inferDoseUnitFromProduct(produs: ProdusFitosanitar | null): LinieDozaUnitate {
  if (!produs) return 'ml/hl'
  if (typeof produs.doza_min_l_per_ha === 'number' || typeof produs.doza_max_l_per_ha === 'number') {
    return 'l/ha'
  }
  return 'ml/hl'
}

export function suggestDoseFromProduct(
  produs: ProdusFitosanitar | null,
  unitate: LinieDozaUnitate
): number | null {
  if (!produs) return null

  const range =
    unitate === 'l/ha'
      ? [produs.doza_min_l_per_ha, produs.doza_max_l_per_ha]
      : [produs.doza_min_ml_per_hl, produs.doza_max_ml_per_hl]

  const values = range.filter((value): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0)
  if (values.length === 0) return null
  if (values.length === 1) return values[0]

  return Math.round((((values[0] + values[1]) / 2) * 1000)) / 1000
}

export function filterProduseForCulture(
  produse: ProdusFitosanitar[],
  culturaTip: string,
  showAll: boolean,
  query: string
) {
  const culture = normalizeCropCod(culturaTip) ?? normalizeText(culturaTip)
  const search = normalizeText(query)

  return produse.filter((produs) => {
    if (!produs.activ) return false

    const matchesCulture =
      showAll ||
      !culture ||
      !Array.isArray(produs.omologat_culturi) ||
      produs.omologat_culturi.length === 0 ||
      produs.omologat_culturi.some((item) => (normalizeCropCod(item) ?? normalizeText(item)) === culture)

    if (!matchesCulture) return false

    if (!search) return true

    return [produs.nume_comercial, produs.substanta_activa, produs.frac_irac]
      .map((item) => normalizeText(item))
      .some((item) => item.includes(search))
  })
}

export function sortLiniiForReview(
  linii: PlanWizardLinieDraft[],
  grupBiologic?: GrupBiologic | null
) {
  return [...linii].sort((first, second) => {
    const firstCod = normalizeStadiu(first.stadiu_trigger)
    const secondCod = normalizeStadiu(second.stadiu_trigger)

    const stageDiff =
      resolveStadiuSortIndex(firstCod, grupBiologic) - resolveStadiuSortIndex(secondCod, grupBiologic)
    if (stageDiff !== 0) return stageDiff
    return first.ordine - second.ordine
  })
}

export function buildWizardWarnings(
  linii: PlanWizardLinieDraft[],
  produse: ProdusFitosanitar[],
  an: number,
  grupBiologic?: GrupBiologic | null
): PlanWizardWarning[] {
  const sorted = sortLiniiForReview(linii, grupBiologic)

  const fracTimeline = extractFracHistory(
    sorted.flatMap((linie, index) =>
      linie.produse.map((produs, produsIndex) => ({
        aplicareId: `${linie.id || `linie-${index + 1}`}-produs-${produsIndex + 1}`,
        produsId: produs.produs_id ?? null,
        produsNume: getProdusDraftDisplayName(produs, produse),
        dataAplicata: new Date(Date.UTC(an, 0, index + 1)),
      }))
    ),
    produse
  )

  const fracViolations = detectConsecutiveFrac(fracTimeline, 1)
  const warnings: PlanWizardWarning[] = fracViolations.map((violation, index) => {
    const firstIndex = sorted.findIndex((linie) => linie.id === violation.firstAplicareId)
    const lastIndex = sorted.findIndex((linie) => linie.id === violation.lastAplicareId)

    return {
      id: `frac-${violation.firstAplicareId}-${index}`,
      tip: 'frac',
      titlu: 'Rotație FRAC repetată',
      descriere: `Intervenția ${firstIndex + 1} și ${lastIndex + 1} folosesc același grup FRAC (${violation.code}). Consideră rotația.`,
    }
  })

  const cupru = calculeazaCupruCumulatAnual(
    sorted.flatMap((linie, index) =>
      linie.produse.map((produs, produsIndex) => ({
        aplicareId: `${linie.id || `cupru-${index + 1}`}-produs-${produsIndex + 1}`,
        produsId: produs.produs_id ?? null,
        produsNume: getProdusDraftDisplayName(produs, produse),
        dataAplicata: new Date(Date.UTC(an, 0, index + 1)),
        dozaMlPerHl: produs.doza_ml_per_hl ?? null,
        dozaLPerHa: produs.doza_l_per_ha ?? null,
      }))
    ),
    produse,
    an
  )

  if (cupru.alertLevel === 'exceeded') {
    warnings.push({
      id: 'cupru-exceeded',
      tip: 'cupru',
      titlu: 'Limită anuală de cupru depășită',
      descriere: `Atenție: cumulul anual estimat de cupru este ${stripTrailingZeros(cupru.totalKgHa)} kg/ha și depășește recomandarea de ${cupru.limitaUE} kg/ha/an.`,
    })
  }

  return warnings
}

function resolveStadiuSortIndex(cod: StadiuCod | null, grupBiologic?: GrupBiologic | null): number {
  if (!cod) return Number.MAX_SAFE_INTEGER
  if (grupBiologic) {
    const indexInGroup = getOrdineInGrup(cod, grupBiologic)
    if (indexInGroup >= 0) return indexInGroup
  }

  const globalIndex = listAllStadiiCanonice().indexOf(cod)
  if (globalIndex >= 0) return globalIndex + 100
  return getOrdine(cod) + 100
}

function normalizeText(value: string | null | undefined) {
  return value
    ?.trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') ?? ''
}
