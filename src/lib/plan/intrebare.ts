/**
 * „A început înflorirea?”: când se apropie ziua în care parcela a intrat în stadiul următor anul trecut (sau, fără
 * istoric, după culesul estimat), aplicația întreabă pe fișa parcelei și în tab-ul Plan. Stadiul îl schimbă omul
 * („Da, de azi” notează stadiul următor cu ziua de azi); „Încă nu” amână întrebarea câteva zile. Nu pleacă pe
 * telefon. Funcții pure.
 */
import { mutaInAnul } from '@/lib/analize/cules'
import { getStadiuUrmatorInGrup, type GrupBiologic, type StadiuCod } from '@/lib/parcele/stadii-canonic'
import { adaugaZile } from '@/lib/tratamente/zile'

import { eticheta, type Cohorta } from './model'
import { primaZiInStadiu, type StadiuCurent, type StadiuRand } from './stadii'

/** Cu câte zile înainte de ziua de anul trecut apare întrebarea. */
export const ZILE_INAINTE = 3
/** Cât timp după ziua de anul trecut mai întreabă (apoi tace: omul știe deja). */
export const ZILE_DUPA = 30
/** „Încă nu” amână cu atâtea zile. */
export const ZILE_AMANARE = 3

export interface IntrebareStadiu {
  parcelaId: string
  cohort: Cohorta | null
  /** Stadiul de acum. */
  stadiu: StadiuCod
  /** Stadiul despre care întreabă. */
  urmator: StadiuCod
  /** Ziua așteptată (anul trecut mutat în anul curent, sau din cules). */
  zi: string
  intrebare: string
  /** Cheia pentru „Încă nu” (parcelă, cohortă, stadiu). */
  cheie: string
}

/** Cum se spune „a început …” pentru fiecare stadiu. */
const CE_INCEPE: Partial<Record<StadiuCod, string>> = {
  repaus_vegetativ: 'repausul',
  umflare_muguri: 'pornirea în vegetație',
  buton_verde: 'apariția inflorescențelor',
  buton_roz: 'apariția bobocilor',
  inflorit: 'înflorirea',
  scuturare_petale: 'scuturarea petalelor',
  legare_fruct: 'legarea fructelor',
  fruct_verde: 'creșterea fructelor verzi',
  parga: 'coacerea',
  maturitate: 'recoltarea',
  post_recoltare: 'perioada de după recoltare',
}

export function textIntrebare(urmator: StadiuCod, cohort: Cohorta | null, culturaTip?: string | null): string {
  const ce = CE_INCEPE[urmator]
  const pe = cohort ? ` pe ${cohort}` : ''
  return ce ? `A început ${ce}${pe}?` : `A ajuns${pe} la „${eticheta(urmator, culturaTip, cohort)}”?`
}

export const cheieIntrebare = (parcelaId: string, cohort: Cohorta | null, urmator: StadiuCod) => `${parcelaId}:${cohort ?? '-'}:${urmator}`

/**
 * Întrebarea pentru o parcelă (câte una pe cohortă), sau nimic. `amanate`: cheie → ziua până la care tace.
 * `dataCules`: culesul estimat în anul curent (pentru coacere / recoltare, când anul trecut n-are stadiul notat).
 */
export function intrebariParcela(input: {
  parcelaId: string
  grup: GrupBiologic
  culturaTip?: string | null
  curente: readonly StadiuCurent[]
  stadiiAnTrecut: readonly StadiuRand[]
  an: number
  azi: string
  dataCules?: string | null
  amanate?: ReadonlyMap<string, string>
}): IntrebareStadiu[] {
  const rezultat: IntrebareStadiu[] = []
  for (const curent of input.curente) {
    const urmator = getStadiuUrmatorInGrup(curent.stadiu, input.grup)
    if (!urmator) continue
    let zi: string | null = null
    const anTrecut = primaZiInStadiu(input.stadiiAnTrecut, input.parcelaId, urmator, curent.cohort)
    if (anTrecut) zi = mutaInAnul(anTrecut, input.an)
    else if (input.dataCules && urmator === 'maturitate') zi = input.dataCules
    else if (input.dataCules && urmator === 'parga') zi = adaugaZile(input.dataCules, -7)
    if (!zi) continue
    // Ziua așteptată e înainte de intrarea în stadiul de acum: anul ăsta merge altfel, nu întrebăm.
    if (curent.din && zi < curent.din) continue
    if (input.azi < adaugaZile(zi, -ZILE_INAINTE) || input.azi > adaugaZile(zi, ZILE_DUPA)) continue
    const cheie = cheieIntrebare(input.parcelaId, curent.cohort, urmator)
    const panaLa = input.amanate?.get(cheie)
    if (panaLa && input.azi < panaLa) continue
    rezultat.push({ parcelaId: input.parcelaId, cohort: curent.cohort, stadiu: curent.stadiu, urmator, zi, intrebare: textIntrebare(urmator, curent.cohort, input.culturaTip), cheie })
  }
  return rezultat
}

/** Ziua până la care tace după „Încă nu”. */
export function ziAmanare(azi: string): string {
  return adaugaZile(azi, ZILE_AMANARE)
}
