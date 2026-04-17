import { calculeazaCupruCumulatAnual } from '@/lib/tratamente/cupru-cumulat'
import { detectConsecutiveFrac, extractFracHistory } from '@/lib/tratamente/rotatie-frac'
import { STADII_ORDINE, getStadiuOrdine } from '@/lib/tratamente/stadiu-ordering'
import type { ProdusFitosanitar } from '@/lib/supabase/queries/tratamente'

import type {
  LinieDozaUnitate,
  PlanWizardLinieDraft,
  PlanWizardWarning,
} from '@/components/tratamente/plan-wizard/types'

export const STADIU_OPTIONS = Object.entries(STADII_ORDINE)
  .sort((first, second) => first[1].ordine - second[1].ordine)
  .map(([value, meta], index) => ({
    value,
    label: meta.label,
    emoji: ['🌱', '🌿', '🫛', '🌸', '🌼', '🍃', '🫐', '🍓', '🍇', '🍂'][index] ?? '🌿',
  }))

export function getStadiuMeta(stadiu: string) {
  return STADIU_OPTIONS.find((option) => option.value === stadiu) ?? {
    value: stadiu,
    label: STADII_ORDINE[stadiu]?.label ?? stadiu,
    emoji: '🌿',
  }
}

export function getProdusDisplayName(
  linie: Pick<PlanWizardLinieDraft, 'produs_id' | 'produs_nume_manual'>,
  produse: ProdusFitosanitar[]
) {
  const produs = produse.find((item) => item.id === linie.produs_id)
  return produs?.nume_comercial ?? linie.produs_nume_manual?.trim() ?? 'Produs fără nume'
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
  const culture = normalizeText(culturaTip)
  const search = normalizeText(query)

  return produse.filter((produs) => {
    if (!produs.activ) return false

    const matchesCulture =
      showAll ||
      !culture ||
      !Array.isArray(produs.omologat_culturi) ||
      produs.omologat_culturi.length === 0 ||
      produs.omologat_culturi.some((item) => normalizeText(item) === culture)

    if (!matchesCulture) return false

    if (!search) return true

    return [produs.nume_comercial, produs.substanta_activa, produs.frac_irac]
      .map((item) => normalizeText(item))
      .some((item) => item.includes(search))
  })
}

export function sortLiniiForReview(linii: PlanWizardLinieDraft[]) {
  return [...linii].sort((first, second) => {
    const stageDiff = getStadiuOrdine(first.stadiu_trigger) - getStadiuOrdine(second.stadiu_trigger)
    if (stageDiff !== 0) return stageDiff
    return first.ordine - second.ordine
  })
}

export function buildWizardWarnings(
  linii: PlanWizardLinieDraft[],
  produse: ProdusFitosanitar[],
  an: number
): PlanWizardWarning[] {
  const sorted = sortLiniiForReview(linii)

  const fracTimeline = extractFracHistory(
    sorted.map((linie, index) => ({
      aplicareId: linie.id || `linie-${index + 1}`,
      produsId: linie.produs_id ?? null,
      produsNume: getProdusDisplayName(linie, produse),
      dataAplicata: new Date(Date.UTC(an, 0, index + 1)),
    })),
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
      descriere: `Linia ${firstIndex + 1} și ${lastIndex + 1} folosesc același grup FRAC (${violation.code}). Consideră rotația.`,
    }
  })

  const cupru = calculeazaCupruCumulatAnual(
    sorted.map((linie, index) => ({
      aplicareId: linie.id || `cupru-${index + 1}`,
      produsId: linie.produs_id ?? null,
      produsNume: getProdusDisplayName(linie, produse),
      dataAplicata: new Date(Date.UTC(an, 0, index + 1)),
      dozaMlPerHl: linie.dozaUnitate === 'ml/hl' ? linie.doza : null,
      dozaLPerHa: linie.dozaUnitate === 'l/ha' ? linie.doza : null,
    })),
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

function normalizeText(value: string | null | undefined) {
  return value
    ?.trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') ?? ''
}
