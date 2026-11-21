/**
 * Pauza până la recoltare: o singură sursă pentru tot ce o arată (Recoltări, Acasă, Mai mult, jurnalul
 * Tratamente, Rapoarte).
 *
 * Combină:
 * - aplicările noi (`aplicari_tratament`) cu `status = 'aplicata'`: pauza = cea mai lungă `phi_zile_snapshot`
 *   dintre produsele aplicării (la aplicările vechi din plan, fără produse, pauza produsului din antet);
 * - activitățile vechi (`activitati_agricole`) cu `timp_pauza_zile > 0`.
 *
 * Pauza se socotește pe zile, de la ziua aplicării în ora României: stropit marți 15.07 cu pauză 3 zile
 * → nu se recoltează până vineri 18.07 (vinerea e prima zi permisă). Aceeași regulă ca până acum
 * (`computeActivityRemainingDays`): rămase = pauza − zilele trecute.
 */
import { adaugaZile, zileIntre, ziuaRo } from './zile'

export type SursaPauzaTip = 'aplicare' | 'activitate'

export interface SursaPauza {
  parcelaId: string
  /** Ziua aplicării, în ora României. */
  ziAplicare: string
  zilePauza: number
  /** Produsul care dă pauza (cel cu pauza cea mai lungă). */
  produs: string | null
  tip: SursaPauzaTip
}

export interface PauzaParcela {
  parcelaId: string
  /** Prima zi în care se poate recolta din nou. */
  panaLa: string
  /** Câte zile mai sunt până la `panaLa` (≥ 1 cât pauza e activă). */
  zileRamase: number
  /** Ziua aplicării care ține pauza cel mai mult. */
  ziAplicare: string
  zilePauza: number
  /** Produsul care ține pauza cel mai mult. */
  produs: string | null
  /** Toate produsele cu pauza încă activă pe parcelă. */
  produse: string[]
}

type ProdusCuPauza = {
  phi_zile_snapshot?: number | null
  produs_nume_snapshot?: string | null
}

export type AplicarePentruPauza = {
  parcela_id: string
  status: string
  data_aplicata: string | null
  produse?: readonly ProdusCuPauza[] | null
  /** Produsul din antet (aplicările vechi din plan, fără rânduri de produse). */
  produs?: { nume_comercial?: string | null; phi_zile?: number | null } | null
  produs_nume_manual?: string | null
}

export type ActivitatePentruPauza = {
  parcela_id: string | null
  data_aplicare: string | null
  timp_pauza_zile: number | null
  produs_utilizat?: string | null
}

const pozitiv = (value: unknown): number => {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0
}

/** Cea mai lungă pauză dintre produsele aplicării și produsul care o dă. */
export function pauzaAplicarii(aplicare: Pick<AplicarePentruPauza, 'produse' | 'produs' | 'produs_nume_manual'>): {
  zile: number
  produs: string | null
} {
  const produse = aplicare.produse ?? []
  if (produse.length > 0) {
    let best: { zile: number; produs: string | null } = { zile: 0, produs: null }
    for (const item of produse) {
      const zile = pozitiv(item.phi_zile_snapshot)
      if (zile > best.zile) best = { zile, produs: item.produs_nume_snapshot?.trim() || null }
    }
    return best
  }
  const zile = pozitiv(aplicare.produs?.phi_zile)
  return {
    zile,
    produs: zile > 0 ? aplicare.produs?.nume_comercial?.trim() || aplicare.produs_nume_manual?.trim() || null : null,
  }
}

export function surseDinAplicari(aplicari: readonly AplicarePentruPauza[]): SursaPauza[] {
  const surse: SursaPauza[] = []
  for (const aplicare of aplicari) {
    if (aplicare.status !== 'aplicata' || !aplicare.parcela_id) continue
    const zi = ziuaRo(aplicare.data_aplicata)
    if (!zi) continue
    const { zile, produs } = pauzaAplicarii(aplicare)
    if (zile <= 0) continue
    surse.push({ parcelaId: aplicare.parcela_id, ziAplicare: zi, zilePauza: zile, produs, tip: 'aplicare' })
  }
  return surse
}

export function surseDinActivitati(activitati: readonly ActivitatePentruPauza[]): SursaPauza[] {
  const surse: SursaPauza[] = []
  for (const activitate of activitati) {
    if (!activitate.parcela_id) continue
    const zile = pozitiv(activitate.timp_pauza_zile)
    if (zile <= 0) continue
    const zi = ziuaRo(activitate.data_aplicare)
    if (!zi) continue
    surse.push({
      parcelaId: activitate.parcela_id,
      ziAplicare: zi,
      zilePauza: zile,
      produs: activitate.produs_utilizat?.trim() || null,
      tip: 'activitate',
    })
  }
  return surse
}

/**
 * Pauzele active în ziua `ziua`, pe parcele. Se socotesc doar aplicările făcute până în acea zi inclusiv
 * (o recoltare din trecut nu e în pauză din cauza unui tratament de după ea).
 */
export function pauzePeParcela(surse: readonly SursaPauza[], ziua: string): Map<string, PauzaParcela> {
  const result = new Map<string, PauzaParcela>()
  for (const sursa of surse) {
    if (sursa.ziAplicare > ziua) continue
    const panaLa = adaugaZile(sursa.ziAplicare, sursa.zilePauza)
    if (panaLa <= ziua) continue

    const existing = result.get(sursa.parcelaId)
    const produse = existing ? existing.produse : []
    if (sursa.produs && !produse.includes(sursa.produs)) produse.push(sursa.produs)

    if (!existing || panaLa > existing.panaLa) {
      result.set(sursa.parcelaId, {
        parcelaId: sursa.parcelaId,
        panaLa,
        zileRamase: zileIntre(ziua, panaLa),
        ziAplicare: sursa.ziAplicare,
        zilePauza: sursa.zilePauza,
        produs: sursa.produs,
        produse,
      })
    } else {
      existing.produse = produse
    }
  }
  return result
}

/** Totul într-un apel: aplicările noi + activitățile vechi → pauzele active în ziua `ziua`. */
export function pauzeActive(input: {
  aplicari: readonly AplicarePentruPauza[]
  activitati: readonly ActivitatePentruPauza[]
  ziua: string
}): Map<string, PauzaParcela> {
  return pauzePeParcela([...surseDinAplicari(input.aplicari), ...surseDinActivitati(input.activitati)], input.ziua)
}

/** Pauzele ordonate: cea care ține cel mai mult întâi. */
export function pauzeOrdonate(pauze: ReadonlyMap<string, PauzaParcela>): PauzaParcela[] {
  return [...pauze.values()].sort((a, b) => b.panaLa.localeCompare(a.panaLa) || a.parcelaId.localeCompare(b.parcelaId))
}
