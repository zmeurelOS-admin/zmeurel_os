/**
 * Formularul de tratament, fără React: ciorna (ce a ales omul), „Repetă” (ciorna dintr-un tratament
 * anterior) și rândurile de salvat în baza de date (o aplicare pe parcelă, cu produsele ei).
 */
import { citesteTextFertirigare, cantitateStropire, kgFertirigare, partiPeParcele, suprafataHa, textFertirigare, imparteProportional, type ModDoza, type UnitateProdus } from './doze'
import { METODA_DB, TIP_INTERVENTIE_DB, tipDinAplicare, type AplicareRow, type MetodaFormular, type ProdusCatalog } from './model'

export interface ProdusCiorna {
  /** Cheie locală (React). */
  key: string
  produsId: string | null
  nume: string
  substanta: string | null
  tip: string | null
  frac: string | null
  phi: number | null
  nrMaxPeSezon: number | null
  intervalMinZile: number | null
  unitate: UnitateProdus
  /** Stropire: doza în modul ales (ml/g la 100 l sau l/kg la ha). Sol: cantitatea totală (kg sau l). */
  doza: number | null
  /** Fertirigare. */
  gPePlanta: number | null
  rezervor: 'A' | 'B'
  /** Din plan (promptul 30): rândul produsului din `planuri_tratament_linie_produse` (`null` = produsul vechi de pe linie). */
  planLinieProdusId?: string | null
}

export interface CiornaTratament {
  metoda: MetodaFormular
  parcelaIds: string[]
  produse: ProdusCiorna[]
  /** Stropire. */
  mod: ModDoza
  /** `null` = încă nepus (propunerea din parcele). */
  volumL: number | null
}

export type ParcelaFormular = {
  id: string
  nume_parcela: string | null
  suprafata_m2: number | null
  nr_plante: number | null
  volum_solutie_l?: number | null
}

let contor = 0
export const cheieNoua = () => `p${Date.now().toString(36)}${(contor++).toString(36)}`

export function produsDinCatalog(produs: ProdusCatalog, unitate: UnitateProdus, rezervor: 'A' | 'B' = 'A'): ProdusCiorna {
  return {
    key: cheieNoua(),
    produsId: produs.id,
    nume: produs.nume_comercial,
    substanta: produs.substanta_activa?.trim() || null,
    tip: produs.tip,
    frac: produs.frac_irac,
    phi: produs.phi_zile,
    nrMaxPeSezon: produs.nr_max_aplicari_per_sezon,
    intervalMinZile: produs.interval_min_aplicari_zile,
    unitate,
    doza: null,
    gPePlanta: null,
    rezervor,
  }
}

/** Pauza tratamentului = cea mai lungă dintre produse. */
export function pauzaCiorna(produse: readonly ProdusCiorna[]): { zile: number; produs: string | null } {
  let best = { zile: 0, produs: null as string | null }
  for (const produs of produse) {
    const zile = Math.max(0, Math.floor(Number(produs.phi) || 0))
    if (zile > best.zile) best = { zile, produs: produs.nume }
  }
  return best
}

/**
 * „Repetă”: aceleași parcele, produse și doze ca tratamentul anterior. Parcelele șterse între timp ies.
 * Stropirea păstrează modul dozei; volumul pornește din nou din parcele.
 */
export function ciornaDinTratament(grup: readonly AplicareRow[], parcelaIdsExistente: ReadonlySet<string>, catalog: ReadonlyMap<string, ProdusCatalog>): CiornaTratament | null {
  const prima = grup[0]
  if (!prima) return null
  const tip = tipDinAplicare(prima)
  const metoda: MetodaFormular = tip === 'fertirigare' ? 'fertirigare' : tip === 'sol' ? 'sol' : 'stropire'
  const parcelaIds = [...new Set(grup.map((aplicare) => aplicare.parcela_id))].filter((id) => parcelaIdsExistente.has(id))
  const produseSursa = [...prima.produse].sort((a, b) => a.ordine - b.ordine)
  const areHa = produseSursa.some((produs) => Number(produs.doza_l_per_ha) > 0)
  const areHl = produseSursa.some((produs) => Number(produs.doza_ml_per_hl) > 0)
  const mod: ModDoza = areHa && !areHl ? 'ha' : 'hl'

  const produse: ProdusCiorna[] = produseSursa.map((produs) => {
    const dinCatalog = produs.produs_id ? catalog.get(produs.produs_id) : undefined
    const unitate: UnitateProdus = produs.unitate_cantitate === 'g' || produs.unitate_cantitate === 'kg' ? 'g' : 'ml'
    const fert = citesteTextFertirigare(produs.cantitate_text)
    // La sol se repetă cantitatea totală a lotului.
    const totalSol =
      metoda === 'sol'
        ? grup.reduce((sum, aplicare) => {
            const rand = aplicare.produse.find((item) => item.ordine === produs.ordine)
            return sum + (Number(rand?.cantitate_totala) || 0)
          }, 0)
        : 0
    return {
      key: cheieNoua(),
      produsId: produs.produs_id,
      nume: produs.produs_nume_snapshot,
      substanta: produs.substanta_activa_snapshot ?? dinCatalog?.substanta_activa ?? null,
      tip: produs.tip_snapshot ?? dinCatalog?.tip ?? null,
      frac: produs.frac_irac_snapshot ?? dinCatalog?.frac_irac ?? null,
      phi: produs.phi_zile_snapshot ?? dinCatalog?.phi_zile ?? null,
      nrMaxPeSezon: dinCatalog?.nr_max_aplicari_per_sezon ?? null,
      intervalMinZile: dinCatalog?.interval_min_aplicari_zile ?? null,
      unitate: metoda === 'sol' ? (produs.unitate_cantitate === 'l' ? 'ml' : 'g') : unitate,
      doza:
        metoda === 'stropire'
          ? (mod === 'ha' ? Number(produs.doza_l_per_ha) : Number(produs.doza_ml_per_hl)) || null
          : metoda === 'sol'
            ? totalSol || null
            : null,
      gPePlanta: Number(produs.doza_g_per_planta) || fert?.gPePlanta || null,
      rezervor: produs.rezervor === 'B' || fert?.rezervor === 'B' ? 'B' : 'A',
    }
  })

  if (produse.length === 0) return null
  return { metoda, parcelaIds, produse, mod, volumL: null }
}

// ─── Rândurile de salvat ────────────────────────────────────────────────────────

export type CandTratament =
  | { tip: 'acum' }
  | { tip: 'alta_zi'; zi: string }
  | { tip: 'planifica'; zi: string }

export interface AplicareDeSalvat {
  parcela_id: string
  status: 'aplicata' | 'planificata'
  data_aplicata: string | null
  data_planificata: string | null
  metoda_aplicare: string
  tip_interventie: string
  /** `din_plan` doar cu `plan_linie_id` (constrângerea `aplicari_tratament_sursa_plan_linie_check`). */
  sursa: 'manuala' | 'din_plan'
  plan_linie_id?: string
  produs_id: string | null
  produs_nume_manual: string | null
  meteo_snapshot: Record<string, unknown> | null
  produse: ProdusDeSalvat[]
}

export interface ProdusDeSalvat {
  ordine: number
  produs_id: string | null
  produs_nume_manual: string | null
  produs_nume_snapshot: string
  substanta_activa_snapshot: string | null
  tip_snapshot: string | null
  frac_irac_snapshot: string | null
  phi_zile_snapshot: number | null
  doza_ml_per_hl: number | null
  doza_l_per_ha: number | null
  cantitate_totala: number | null
  unitate_cantitate: string | null
  cantitate_text: string | null
  rezervor: 'A' | 'B' | null
  doza_g_per_planta: number | null
  plan_linie_produs_id?: string
}

const TIPURI_CATALOG = new Set(['fungicid', 'insecticid', 'erbicid', 'acaricid', 'foliar', 'ingrasamant', 'bioregulator', 'altul'])

const formatNr = (value: number) => new Intl.NumberFormat('ro-RO', { maximumFractionDigits: 2 }).format(value)

/** Momentul salvat ca `data_aplicata`: acum, sau la prânz (ora României, vara) în ziua aleasă. */
export function momentAplicare(cand: CandTratament, now: Date = new Date()): string | null {
  if (cand.tip === 'acum') return now.toISOString()
  if (cand.tip === 'alta_zi') return `${cand.zi}T09:00:00.000Z`
  return null
}

/** Ce lipsește ca tratamentul să poată fi salvat (`null` = nimic). */
export function ceLipseste(ciorna: CiornaTratament, parcele: readonly ParcelaFormular[]): string | null {
  if (ciorna.parcelaIds.length === 0) return 'Alege cel puțin o parcelă.'
  if (ciorna.produse.length === 0) return 'Adaugă cel puțin un produs.'
  if (ciorna.metoda === 'fertirigare') {
    if (ciorna.produse.some((produs) => !(Number(produs.gPePlanta) > 0))) return 'Scrie grame pe plantă pentru fiecare produs.'
  }
  if (ciorna.metoda === 'sol') {
    if (ciorna.produse.some((produs) => !(Number(produs.doza) > 0))) return 'Scrie cantitatea pentru fiecare produs.'
  }
  if (ciorna.metoda === 'stropire') {
    if (ciorna.produse.some((produs) => !(Number(produs.doza) > 0))) return 'Scrie doza pentru fiecare produs.'
    if (ciorna.mod === 'hl' && !(Number(ciorna.volumL) > 0)) return 'Scrie câți litri de soluție faci.'
    if (ciorna.mod === 'ha') {
      const alese = parcele.filter((parcela) => ciorna.parcelaIds.includes(parcela.id))
      if (!(suprafataHa(alese) > 0)) return 'Parcelele alese nu au suprafața completată: folosește doza la 100 l.'
    }
  }
  return null
}

/**
 * O aplicare pe parcelă, cu produsele ei. Cantitatea unei stropiri se împarte pe parcele (după volumul
 * salvat sau suprafață; la ha, exact după suprafață), ca suma rândurilor să dea cât ai pus în rezervor.
 * `cuColoaneNoi` = migrarea `20261121160000` e aplicată (rezervor, g/plantă).
 */
export function aplicariDeSalvat(input: {
  ciorna: CiornaTratament
  parcele: readonly ParcelaFormular[]
  cand: CandTratament
  meteo: Record<string, unknown> | null
  now?: Date
  /** Tratamentul vine dintr-o linie de plan: aplicările primesc `plan_linie_id` și `sursa = 'din_plan'`. */
  planLinieId?: string | null
}): AplicareDeSalvat[] {
  const { ciorna } = input
  const alese = ciorna.parcelaIds
    .map((id) => input.parcele.find((parcela) => parcela.id === id))
    .filter((parcela): parcela is ParcelaFormular => Boolean(parcela))
  const ha = suprafataHa(alese)
  const status = input.cand.tip === 'planifica' ? 'planificata' : 'aplicata'

  // Partea fiecărei parcele, pe produs.
  const partiPeProdus = ciorna.produse.map((produs) => {
    if (ciorna.metoda === 'stropire') {
      const total = cantitateStropire({ doza: produs.doza, mod: ciorna.mod, volumL: ciorna.volumL, suprafataHa: ha })
      return total === null ? alese.map(() => null) : partiPeParcele({ mod: ciorna.mod, total }, alese)
    }
    if (ciorna.metoda === 'sol') {
      const total = Number(produs.doza) || 0
      return total > 0 ? imparteProportional(total, alese.map((parcela) => Number(parcela.suprafata_m2) || 0)) : alese.map(() => null)
    }
    return alese.map((parcela) => kgFertirigare(produs.gPePlanta, parcela.nr_plante))
  })

  const primul = ciorna.produse[0]
  return alese.map((parcela, indexParcela) => ({
    parcela_id: parcela.id,
    status,
    data_aplicata: status === 'aplicata' ? momentAplicare(input.cand, input.now) : null,
    data_planificata: input.cand.tip === 'acum' ? null : input.cand.zi,
    metoda_aplicare: METODA_DB[ciorna.metoda],
    tip_interventie: TIP_INTERVENTIE_DB[ciorna.metoda],
    ...(input.planLinieId ? { sursa: 'din_plan' as const, plan_linie_id: input.planLinieId } : { sursa: 'manuala' as const }),
    // Antetul cere fie produsul din catalog, fie un nume (constrângerea `aplicari_tratament_produs_xor_check`).
    produs_id: primul?.produsId ?? null,
    produs_nume_manual: primul?.produsId ? null : primul?.nume ?? null,
    meteo_snapshot: input.cand.tip === 'acum' ? input.meteo : null,
    produse: ciorna.produse.map((produs, indexProdus) => {
      const parte = partiPeProdus[indexProdus][indexParcela]
      const base = {
        ordine: indexProdus + 1,
        produs_id: produs.produsId,
        produs_nume_manual: produs.produsId ? null : produs.nume,
        produs_nume_snapshot: produs.nume,
        substanta_activa_snapshot: produs.substanta,
        tip_snapshot: produs.tip && TIPURI_CATALOG.has(produs.tip) ? produs.tip : null,
        frac_irac_snapshot: produs.frac,
        phi_zile_snapshot: produs.phi !== null && produs.phi >= 0 ? Math.floor(produs.phi) : null,
        ...(input.planLinieId && produs.planLinieProdusId ? { plan_linie_produs_id: produs.planLinieProdusId } : {}),
      }
      if (ciorna.metoda === 'fertirigare') {
        const g = Number(produs.gPePlanta) || 0
        return {
          ...base,
          doza_ml_per_hl: null,
          doza_l_per_ha: null,
          cantitate_totala: parte,
          unitate_cantitate: parte === null ? null : 'kg',
          cantitate_text: textFertirigare(g, produs.rezervor),
          rezervor: produs.rezervor,
          doza_g_per_planta: g,
        }
      }
      if (ciorna.metoda === 'sol') {
        const unitate = produs.unitate === 'ml' ? 'l' : 'kg'
        return {
          ...base,
          doza_ml_per_hl: null,
          doza_l_per_ha: null,
          cantitate_totala: parte,
          unitate_cantitate: parte === null ? null : unitate,
          cantitate_text: parte === null ? null : `${formatNr(parte)} ${unitate}`,
          rezervor: null,
          doza_g_per_planta: null,
        }
      }
      return {
        ...base,
        doza_ml_per_hl: ciorna.mod === 'hl' ? produs.doza : null,
        doza_l_per_ha: ciorna.mod === 'ha' ? produs.doza : null,
        cantitate_totala: parte,
        unitate_cantitate: parte === null ? null : produs.unitate,
        cantitate_text: parte === null ? null : `${formatNr(parte)} ${produs.unitate}`,
        rezervor: null,
        doza_g_per_planta: null,
      }
    }),
  }))
}
