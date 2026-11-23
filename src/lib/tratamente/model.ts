/**
 * Rândurile citite din baza de date pentru modulul Tratamente (forma din query) și metodele de aplicare.
 */

export type MetodaFormular = 'stropire' | 'fertirigare' | 'sol'

/** Tipul afișat în jurnal (și filtrele lui). */
export type TipJurnal = 'stropire' | 'fertirigare' | 'sol' | 'altele'

/** `metoda_aplicare` salvată pentru fiecare metodă din formular. */
export const METODA_DB: Record<MetodaFormular, string> = {
  stropire: 'foliar',
  fertirigare: 'fertirigare',
  sol: 'fertilizare_baza',
}

export const TIP_INTERVENTIE_DB: Record<MetodaFormular, string> = {
  stropire: 'protectie',
  fertirigare: 'nutritie',
  sol: 'nutritie',
}

export interface ProdusCatalog {
  id: string
  tenant_id: string | null
  nume_comercial: string
  substanta_activa: string
  tip: string
  frac_irac: string | null
  doza_min_ml_per_hl: number | null
  doza_max_ml_per_hl: number | null
  doza_min_l_per_ha: number | null
  doza_max_l_per_ha: number | null
  phi_zile: number | null
  nr_max_aplicari_per_sezon: number | null
  interval_min_aplicari_zile: number | null
  omologat_culturi: string[] | null
  activ: boolean
}

export interface AplicareProdusRow {
  id: string
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
  /** Doar după migrarea `20261121160000`. */
  rezervor?: string | null
  doza_g_per_planta?: number | null
}

export interface AplicareRow {
  id: string
  parcela_id: string
  status: string
  data_planificata: string | null
  data_aplicata: string | null
  metoda_aplicare: string | null
  tip_interventie: string | null
  sursa: string
  observatii: string | null
  created_at: string
  produs_id: string | null
  produs_nume_manual: string | null
  doza_ml_per_hl: number | null
  doza_l_per_ha: number | null
  meteo_snapshot: unknown
  /** Linia de plan din care vine aplicarea (planul pe stadii, promptul 30). */
  plan_linie_id?: string | null
  /** Doar după migrarea `20261121160000`. */
  lot_id?: string | null
  /** Produsul din antet (aplicările vechi din plan). */
  produs: {
    id: string
    nume_comercial: string | null
    substanta_activa: string | null
    tip: string | null
    frac_irac: string | null
    phi_zile: number | null
  } | null
  produse: AplicareProdusRow[]
}

/** O activitate veche (`activitati_agricole`), cât îi trebuie jurnalului. */
export interface ActivitateVeche {
  id: string
  parcela_id: string | null
  data_aplicare: string
  tip_activitate: string | null
  produs_utilizat: string | null
  doza: string | null
  timp_pauza_zile: number | null
  observatii?: string | null
}

const TIPURI_PROTECTIE = new Set(['fungicid', 'insecticid', 'acaricid', 'erbicid'])

/** Tipul din jurnal pentru o aplicare nouă. Aplicările vechi din plan (fără metodă) se ghicesc din produs. */
export function tipDinAplicare(aplicare: Pick<AplicareRow, 'metoda_aplicare' | 'produs' | 'produse'>): TipJurnal {
  switch (aplicare.metoda_aplicare) {
    case 'foliar':
      return 'stropire'
    case 'fertirigare':
      return 'fertirigare'
    case 'fertilizare_baza':
    case 'granulat_sol':
      return 'sol'
    case null:
    case undefined: {
      const tip = aplicare.produse[0]?.tip_snapshot ?? aplicare.produs?.tip ?? null
      return tip && (TIPURI_PROTECTIE.has(tip) || tip === 'foliar') ? 'stropire' : 'altele'
    }
    default:
      return 'altele'
  }
}

const fara = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()

/**
 * Tipurile de activitate veche care sunt tratamente (verificate cu `select distinct` pe 21.11.2026:
 * „Fungicide/Pesticide”, „Fertirigare”, „Fertilizare foliară”, „tratament”, „fertigare”, „Stropire”,
 * „Fertilizare de bază”, „Fertilizare”). Prășitul, tăierile și restul nu apar în jurnal.
 */
export function tipDinActivitateVeche(tipActivitate: string | null | undefined): TipJurnal | null {
  const tip = fara(tipActivitate ?? '')
  if (!tip) return null
  if (tip === 'fertirigare' || tip === 'fertigare') return 'fertirigare'
  if (tip === 'fertilizare de baza' || tip === 'fertilizare') return 'sol'
  if (
    tip === 'fungicide/pesticide' ||
    tip === 'fertilizare foliara' ||
    tip === 'tratament' ||
    tip === 'stropire' ||
    tip.startsWith('tratament')
  ) {
    return 'stropire'
  }
  return null
}

export const ETICHETA_TIP: Record<TipJurnal, string> = {
  stropire: 'Stropire',
  fertirigare: 'Fertirigare',
  sol: 'La sol',
  altele: 'Tratament',
}
