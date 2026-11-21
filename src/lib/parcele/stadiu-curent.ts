/**
 * Stadiul curent al unei parcele, ca text: „Înflorire” sau, la zmeura remontantă (floricane + primocane),
 * „Floricane: recoltare · Primocane: înflorire”. Regula stadiului curent rămâne cea din
 * `fenofaza-curenta-parcela` (ultima înregistrare validă). Fără React.
 */
import { getCohortaLabel, type Cohorta } from '@/lib/parcele/configurare-sezon'
import {
  isParcelaRubusMixtFenologie,
  resolveStadiiFenologiceCurenteParcela,
  type StadiuFenologicCurentEntry,
} from '@/lib/parcele/fenofaza-curenta-parcela'
import { getGrupBiologicForCropCod, getLabelPentruGrup, normalizeStadiu, type GrupBiologic } from '@/lib/parcele/stadii-canonic'
import { normalizeCropCod } from '@/lib/crops/crop-codes'
import type { ConfigurareParcelaSezon, ParcelaStadiuCanonic } from '@/lib/supabase/queries/parcela-stadii'

export function formatStadiuFenologicLabel(
  stage: Pick<ParcelaStadiuCanonic, 'stadiu' | 'cohort'> | null | undefined,
  grupBiologic: GrupBiologic | null,
  cohort?: Cohorta | null,
): string {
  if (!stage?.stadiu?.trim()) return 'Fără stadiu'
  const cod = normalizeStadiu(stage.stadiu)
  if (cod) return getLabelPentruGrup(cod, grupBiologic, { cohort: cohort ?? stage.cohort })
  const normalized = stage.stadiu.replaceAll('_', ' ').trim()
  return normalized.charAt(0).toUpperCase() + normalized.slice(1)
}

export function formatStadiuFenologicCurentSummary(
  entries: StadiuFenologicCurentEntry[],
  grupBiologic: GrupBiologic | null,
  options?: { emptyLabel?: string; includeEmptyCohorts?: boolean },
): string {
  const emptyLabel = options?.emptyLabel ?? 'Fără stadiu înregistrat'
  const parts = entries
    .filter((entry) => options?.includeEmptyCohorts || entry.stage)
    .map((entry) => {
      const label = entry.stage ? formatStadiuFenologicLabel(entry.stage, grupBiologic, entry.cohort) : 'Fără stadiu'
      if (!entry.cohort) return label
      // Etichetele de zmeură spun deja cohorta („După recoltare floricane”): nu o mai scriem de două ori.
      if (label.toLocaleLowerCase('ro-RO').includes(entry.cohort)) return label
      return `${getCohortaLabel(entry.cohort)}: ${label}`
    })

  if (parts.length === 0) return emptyLabel
  return parts.join(' · ')
}

/**
 * Grupul biologic al parcelei (zmeura = `rubus`), din cultura ei. Cultura e uneori scrisă împreună cu soiul
 * („Zmeure Maravilla”): se încearcă și primul cuvânt.
 */
export function grupBiologicParcela(parcela: { cultura?: string | null; tip_fruct?: string | null }): GrupBiologic | null {
  const primulCuvant = (value: string | null | undefined) => String(value ?? '').trim().split(/\s+/)[0] ?? ''
  const cod =
    normalizeCropCod(parcela.cultura) ??
    normalizeCropCod(parcela.tip_fruct) ??
    normalizeCropCod(primulCuvant(parcela.cultura)) ??
    normalizeCropCod(primulCuvant(parcela.tip_fruct))
  return getGrupBiologicForCropCod(cod)
}

export interface StadiuCurentParcela {
  /** `null` = niciun stadiu în sezon. */
  text: string | null
  /** Ultima înregistrare (cea mai nouă dintre cohorte), pentru „actualizat acum 4 zile”. */
  ziua: string | null
  /** Soi remontant: stadiul se notează pe cohorte. */
  mixt: boolean
}

export function stadiuCurentParcela(input: {
  stadii: ParcelaStadiuCanonic[]
  grup: GrupBiologic | null
  config: Pick<ConfigurareParcelaSezon, 'sistem_conducere'> | null | undefined
}): StadiuCurentParcela {
  const mixt = isParcelaRubusMixtFenologie(input.grup, input.config, input.stadii)
  const entries = resolveStadiiFenologiceCurenteParcela(input.stadii, input.grup, mixt)
  const cu = entries.filter((entry) => entry.stage)
  if (cu.length === 0) return { text: null, ziua: null, mixt }
  const ziua = cu
    .map((entry) => entry.stage?.data_observata ?? '')
    .filter(Boolean)
    .sort()
    .at(-1) ?? null
  return { text: formatStadiuFenologicCurentSummary(entries, input.grup), ziua, mixt }
}
