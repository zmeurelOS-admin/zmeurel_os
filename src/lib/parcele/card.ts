/**
 * Textele de pe cardul și din antetul unei parcele. Fără React.
 */
import { formatNumber, searchKey } from '@/lib/format-ro'
import { coerceParcelaScopFromDb } from '@/lib/parcele/dashboard-relevance'
import { parseParcelCropValues } from '@/lib/parcele/parcel-form-options'
import { normalizeUnitateTip, type UnitateTip } from '@/lib/parcele/unitate'

export type ParcelaCard = {
  nume_parcela?: string | null
  tip_unitate?: string | null
  cultura?: string | null
  soi?: string | null
  soi_plantat?: string | null
  tip_fruct?: string | null
  nr_plante?: number | null
  suprafata_m2?: number | null
  an_plantare?: number | null
  rol?: string | null
}

export const ETICHETA_TIP_UNITATE: Record<UnitateTip, string> = {
  camp: 'Câmp',
  solar: 'Solar',
  livada: 'Livadă',
  cultura_mare: 'Cultură mare',
}

export const ORDINE_TIP_UNITATE: readonly UnitateTip[] = ['camp', 'solar', 'livada', 'cultura_mare']

/** „Personal” = fără kg, venit și stoc (rămâne la tratamente și lucrări). */
export function esteParcelaPersonala(parcela: Pick<ParcelaCard, 'rol'>): boolean {
  return coerceParcelaScopFromDb(parcela.rol) === 'personal'
}

/** „Zmeură Maravilla” (cultura + soiul), `null` dacă nu e niciuna. */
export function culturaSoi(parcela: ParcelaCard): string | null {
  const { cultura, soi } = parseParcelCropValues({
    cultura: parcela.cultura,
    soi: parcela.soi,
    soi_plantat: parcela.soi_plantat,
    tip_fruct: parcela.tip_fruct,
  })
  // „Mur” + „Mure”, „Afin” + „Afine”: soiul doar repetă cultura, nu se scrie de două ori.
  const repeta = Boolean(cultura && soi) && searchKey(soi).slice(0, 3) === searchKey(cultura).slice(0, 3)
  const text = [cultura, repeta ? null : soi].filter(Boolean).join(' ').trim()
  return text || null
}

export function formatSuprafata(m2: number | null | undefined): string | null {
  const value = Number(m2)
  if (!Number.isFinite(value) || value <= 0) return null
  return `${formatNumber(value, 0)} m²`
}

export function formatPlante(nr: number | null | undefined): string | null {
  const value = Number(nr)
  if (!Number.isFinite(value) || value <= 0) return null
  return `${formatNumber(value, 0)} ${value === 1 ? 'plantă' : 'plante'}`
}

/** „Zmeură Maravilla · 500 plante · 700 m²” (ce lipsește se sare). */
export function liniaParcelei(parcela: ParcelaCard): string {
  return [culturaSoi(parcela), formatPlante(parcela.nr_plante), formatSuprafata(parcela.suprafata_m2)].filter(Boolean).join(' · ') || ETICHETA_TIP_UNITATE[normalizeUnitateTip(parcela.tip_unitate)]
}

/** Antetul fișei: „Zmeură Maravilla · 500 plante · 700 m² · plantată 2024”. */
export function antetParcela(parcela: ParcelaCard): string {
  const an = Number(parcela.an_plantare)
  return [liniaParcelei(parcela), Number.isFinite(an) && an > 1900 ? `plantată ${an}` : null].filter(Boolean).join(' · ')
}
