/**
 * Stadiul curent al unei parcele, ca text: „Înflorire” sau, la zmeură / mur cu doi lăstari, „An 2: Înflorit · An 1:
 * Creștere lăstari” (promptul 33; regula în `src/lib/parcele/lastari.ts`). Fără React.
 */
import type { Cohorta } from '@/lib/parcele/configurare-sezon'
import { STADIU_TAIAT, lastariMod, modLastari, stadiiPeLastari, stadiuPentruCiclu, textStadiiLastari, ultimulRandLastar, type ModLastari } from '@/lib/parcele/lastari'
import { shortDateRo } from '@/lib/format-ro'
import { getGrupBiologicForCropCod, getLabelPentruGrup, normalizeStadiu, type GrupBiologic, type StadiuCod } from '@/lib/parcele/stadii-canonic'
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
  /** `null` = niciun stadiu (nici din anul trecut). */
  text: string | null
  /** Ultima înregistrare (cea mai nouă dintre lăstari), pentru „actualizat acum 4 zile”. */
  ziua: string | null
  /** Cum lucrezi lăstarii (zmeură / mur); `null` la celelalte culturi. */
  mod: ModLastari | null
  /** Stadiul curent pe fiecare lăstar (codul și ziua notată); la culturile fără lăstari, un singur rând (`lastar: null`). */
  peLastari: Array<{ lastar: Cohorta | null; stadiu: StadiuCod | null; zi: string | null }>
  /** Stadiul pentru butoanele ciclului din foaia Stadiul (promptul 34, §1): rândurile vechi fără cohortă = an 1. */
  ciclu: Partial<Record<Cohorta, StadiuCod | null>>
}

/**
 * Stadiul curent al parcelei (promptul 33): pe fiecare lăstar al modului de lucru, ultimul rând după ziua notată,
 * indiferent de an; `taiat` = fără stadiu. Textul: „An 2: Înflorit · An 1: Creștere lăstari”, „Lăstar an 2: …” sau
 * eticheta simplă la culturile fără lăstari.
 */
export function stadiuCurentParcela(input: {
  stadii: ParcelaStadiuCanonic[]
  grup: GrupBiologic | null
  config: Pick<ConfigurareParcelaSezon, 'sistem_conducere'> | null | undefined
  /** `parcele.mod_lastari` (după migrarea 20261125110000); lipsă = calculat. */
  modSalvat?: string | null
}): StadiuCurentParcela {
  const mod = modLastari({ grup: input.grup, salvat: input.modSalvat, sistemConducere: input.config?.sistem_conducere, stadii: input.stadii })
  const pe = stadiiPeLastari(input.stadii, mod)
  const peLastari = pe.map(({ lastar, rand }) => ({
    lastar,
    stadiu: rand ? normalizeStadiu(rand.stadiu) : null,
    zi: rand ? String(rand.data_observata ?? '').slice(0, 10) || null : null,
  }))
  // Promptul 34, §2: lăstarul al cărui ultim rând e „Tăiat” apare pe card cu data, până la următorul lui stadiu.
  const etichetaLastar = (lastar: Cohorta | null, rand: (typeof pe)[number]['rand']): string | null => {
    if (rand) return formatStadiuFenologicLabel(rand, input.grup, lastar)
    if (!lastar || !mod) return null
    const ultim = ultimulRandLastar(input.stadii, lastar, mod)
    if (!ultim || normalizeStadiu(ultim.stadiu) !== STADIU_TAIAT) return null
    const zi = String(ultim.data_observata ?? '').slice(0, 10)
    return zi ? `Tăiat pe ${shortDateRo(zi)}` : 'Tăiat'
  }
  const text = textStadiiLastari(pe.map(({ lastar, rand }) => ({ lastar, eticheta: etichetaLastar(lastar, rand) })))
  const ciclu: Partial<Record<Cohorta, StadiuCod | null>> = {}
  for (const lastar of lastariMod(mod)) ciclu[lastar] = stadiuPentruCiclu(input.stadii, mod, lastar)
  // „Actualizat”: și un „Tăiat” e o notare, chiar dacă lăstarul rămâne fără stadiu.
  const zile = (mod ? lastariMod(mod) : [null])
    .map((lastar) => ultimulRandLastar(input.stadii, lastar, mod)?.data_observata ?? '')
    .concat(pe.map(({ rand }) => rand?.data_observata ?? ''))
    .map((zi) => String(zi).slice(0, 10))
    .filter(Boolean)
    .sort()
  return { text, ziua: zile.at(-1) ?? null, mod, peLastari, ciclu }
}
