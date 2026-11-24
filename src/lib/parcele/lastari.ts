/**
 * Lăstarii la zmeură și mur (promptul 33): lăstar de an 1 (primocane) și lăstar de an 2 (floricane).
 *
 * Stadiul îl pune doar omul; aplicația nu-l schimbă singură. Cheile stadiilor din Planul pe stadii (30) rămân aceleași;
 * se adaugă doar `pastrat` (lăstarii de an 1 păstrați pentru anul viitor: lăstarul de an 2 e „Floricane în repaus”) și
 * `taiat` (lăstarul a fost scos: rămâne fără stadiu până la următorul stadiu notat).
 *
 * - Modul de lucru al parcelei (`parcele.mod_lastari`, migrarea 20261125110000): `an1` (tai tot toamna), `an1_an2`
 *   (păstrez o parte, două recolte), `an2` (soiuri floricane). Fără valoare: `an1_an2` dacă parcela are deja un stadiu pe
 *   floricane (sau sezonul e notat „mixt”), altfel `an1`. Se calculează la citire, fără `update`.
 * - Stadiul curent al unui lăstar = ultimul rând al cohortei după `data_observata`, iar la aceeași zi, ultimul înregistrat;
 *   indiferent de an (un „Păstrez” din noiembrie se vede și în martie). Un `taiat` ca ultim rând = fără stadiu.
 * - Rândurile vechi fără cohortă: în modurile cu un singur lăstar sunt ale acelui lăstar; în `an1_an2` se citesc ca
 *   până acum (nu intră pe niciun lăstar).
 *
 * Funcții pure.
 */
import type { Cohorta } from '@/lib/parcele/configurare-sezon'
import { normalizeStadiu, type GrupBiologic, type StadiuCod } from '@/lib/parcele/stadii-canonic'

export type ModLastari = 'an1' | 'an1_an2' | 'an2'

export const MODURI_LASTARI: readonly ModLastari[] = ['an1', 'an1_an2', 'an2']

export const ETICHETA_MOD_LASTARI: Record<ModLastari, { titlu: string; detaliu: string }> = {
  an1: { titlu: 'Doar lăstari de an 1', detaliu: 'Tai tot toamna' },
  an1_an2: { titlu: 'An 1 + an 2', detaliu: 'Păstrez o parte, două recolte' },
  an2: { titlu: 'Doar lăstari de an 2', detaliu: 'Soiuri floricane' },
}

/** Stadiile noi, doar ale ciclului (nu apar ca plăci în lista de stadii). */
export const STADIU_PASTRAT = 'pastrat' as const
export const STADIU_TAIAT = 'taiat' as const

/** Un rând de stadiu, cât îi trebuie calculului (rândul din bază sau cel din plan / cron). */
export interface RandStadiuLastar {
  id?: string
  stadiu: string | null
  cohort?: string | null
  data_observata: string | null
  created_at?: string | null
  updated_at?: string | null
  an?: number | null
}

export function esteModLastari(value: unknown): value is ModLastari {
  return typeof value === 'string' && (MODURI_LASTARI as readonly string[]).includes(value)
}

const cohorta = (value: unknown): Cohorta | null => (value === 'floricane' || value === 'primocane' ? value : null)

/**
 * Modul de lucru al parcelei, sau `null` dacă nu e o cultură cu lăstari (grupul `rubus`). Valoarea salvată câștigă;
 * altfel `an1_an2` dacă există un stadiu pe floricane sau sezonul e notat „mixt”, altfel `an1`.
 */
export function modLastari(input: {
  grup: GrupBiologic | null | undefined
  salvat?: string | null
  sistemConducere?: string | null
  stadii: readonly Pick<RandStadiuLastar, 'cohort'>[]
}): ModLastari | null {
  if (input.grup !== 'rubus') return null
  if (esteModLastari(input.salvat)) return input.salvat
  if (input.sistemConducere === 'mixt_floricane_primocane') return 'an1_an2'
  if (input.stadii.some((rand) => cohorta(rand.cohort) === 'floricane')) return 'an1_an2'
  return 'an1'
}

/** Lăstarii pe care se notează stadiul, în ordinea de pe card (an 2 întâi). */
export function lastariMod(mod: ModLastari | null): Cohorta[] {
  if (mod === 'an1') return ['primocane']
  if (mod === 'an2') return ['floricane']
  if (mod === 'an1_an2') return ['floricane', 'primocane']
  return []
}

const timp = (value: string | null | undefined): number => {
  const ms = Date.parse(String(value ?? ''))
  return Number.isFinite(ms) ? ms : 0
}

/** Momentul înregistrării (cel mai nou dintre `created_at` și `updated_at`: upsert-ul aceluiași stadiu). */
export function momentInregistrare(rand: Pick<RandStadiuLastar, 'created_at' | 'updated_at'>): number {
  return Math.max(timp(rand.created_at), timp(rand.updated_at))
}

/**
 * Ordinea rândurilor, cel mai nou întâi: după `data_observata`; la aceeași zi, ultimul înregistrat; apoi după id
 * (ordine stabilă). Promptul 33: „ultimul după dată”.
 */
export function comparaRanduri(a: RandStadiuLastar, b: RandStadiuLastar): number {
  const zi = String(b.data_observata ?? '').slice(0, 10).localeCompare(String(a.data_observata ?? '').slice(0, 10))
  if (zi !== 0) return zi
  const moment = momentInregistrare(b) - momentInregistrare(a)
  if (moment !== 0) return moment
  return String(b.id ?? '').localeCompare(String(a.id ?? ''))
}

/** Rândurile care contează pentru lăstarul dat, în modul dat (cum se citesc rândurile vechi fără cohortă). */
export function randuriLastar<T extends RandStadiuLastar>(stadii: readonly T[], lastar: Cohorta | null, mod: ModLastari | null): T[] {
  return stadii.filter((rand) => {
    if (normalizeStadiu(String(rand.stadiu ?? '')) === null) return false
    const c = cohorta(rand.cohort)
    if (lastar === null) return true
    if (c === lastar) return true
    // Un singur lăstar: rândurile fără cohortă sunt ale lui. În an1_an2 se citesc ca până acum (pe niciun lăstar).
    return c === null && mod !== null && mod !== 'an1_an2'
  })
}

/**
 * Stadiul curent al lăstarului (`null` = parcelă fără lăstari: toate rândurile), sau `null` dacă nu are: niciun rând,
 * ori ultimul rând e `taiat`.
 */
export function stadiuCurentLastar<T extends RandStadiuLastar>(stadii: readonly T[], lastar: Cohorta | null, mod: ModLastari | null): T | null {
  const ultim = [...randuriLastar(stadii, lastar, mod)].sort(comparaRanduri)[0] ?? null
  if (!ultim) return null
  return normalizeStadiu(String(ultim.stadiu ?? '')) === STADIU_TAIAT ? null : ultim
}

/** Ultimul rând al lăstarului, chiar dacă e `taiat` (pentru „actualizat acum…” și ce oferă foaia după „Tăiat”). */
export function ultimulRandLastar<T extends RandStadiuLastar>(stadii: readonly T[], lastar: Cohorta | null, mod: ModLastari | null): T | null {
  return [...randuriLastar(stadii, lastar, mod)].sort(comparaRanduri)[0] ?? null
}

export interface StadiuPeLastar<T extends RandStadiuLastar = RandStadiuLastar> {
  /** `null` = parcelă fără lăstari (sau rândurile vechi în an1_an2, citite ca până acum). */
  lastar: Cohorta | null
  rand: T | null
}

/**
 * Stadiul curent pe fiecare lăstar al modului; la culturile fără lăstari, un singur rezultat (`lastar: null`).
 * În `an1_an2`, dacă parcela are doar rânduri vechi fără cohortă, le citește ca până acum (un rezultat fără lăstar).
 */
export function stadiiPeLastari<T extends RandStadiuLastar>(stadii: readonly T[], mod: ModLastari | null): StadiuPeLastar<T>[] {
  if (mod === null) return [{ lastar: null, rand: stadiuCurentLastar(stadii, null, null) }]
  const pe = lastariMod(mod).map((lastar) => ({ lastar, rand: stadiuCurentLastar(stadii, lastar, mod) }))
  if (mod === 'an1_an2' && pe.every((item) => item.rand === null)) {
    const vechi = stadii.filter((rand) => cohorta(rand.cohort) === null)
    const curent = stadiuCurentLastar(vechi, null, null)
    if (curent) return [{ lastar: null, rand: curent }]
  }
  return pe
}

// ─── Etichete ─────────────────────────────────────────────────────────────────

/** Comutatorul „Pentru” din foaia Stadiul. */
export function etichetaComutatorLastar(lastar: Cohorta): string {
  return lastar === 'floricane' ? 'Floricane · lăstar an 2' : 'Primocane · lăstar an 1'
}

/** „Lăstar an 2” (un singur lăstar pe card) / „An 2” (amândoi pe card). */
export function etichetaLastar(lastar: Cohorta, forma: 'lung' | 'scurt' = 'lung'): string {
  const an = lastar === 'floricane' ? 'an 2' : 'an 1'
  return forma === 'lung' ? `Lăstar ${an}` : `An ${an.slice(3)}`
}

/**
 * Eticheta stadiului fără cuvântul lăstarului, pentru card („Înflorit pe floricane” → „Înflorit”, „Floricane în
 * repaus” → „În repaus”, „După recoltare primocane” → „După recoltare”), ca lăstarul să nu fie scris de două ori.
 */
export function etichetaFaraLastar(eticheta: string): string {
  const fara = eticheta
    .replace(/\s+pe\s+(floricane|primocane)\b/gi, '')
    .replace(/\s+(floricane|primocane)\b/gi, '')
    .replace(/^(floricane|primocane)\s+/i, '')
    .trim()
  if (!fara) return eticheta
  return fara.charAt(0).toLocaleUpperCase('ro-RO') + fara.slice(1)
}

/**
 * Textul stadiului pe card și pe fișă: „An 2: Înflorit · An 1: Creștere lăstari” (amândoi lăstarii au stadiu),
 * „Lăstar an 2: Primele fructe colorate” (unul), sau eticheta simplă la culturile fără lăstari. `null` = niciun stadiu.
 */
export function textStadiiLastari(intrari: readonly { lastar: Cohorta | null; eticheta: string | null }[]): string | null {
  const cu = intrari.filter((intrare): intrare is { lastar: Cohorta | null; eticheta: string } => Boolean(intrare.eticheta))
  if (cu.length === 0) return null
  const peLastari = cu.filter((intrare) => intrare.lastar !== null)
  if (peLastari.length === 0) return cu[0].eticheta
  if (peLastari.length === 1) {
    const [unu] = peLastari
    return `${etichetaLastar(unu.lastar as Cohorta, 'lung')}: ${etichetaFaraLastar(unu.eticheta)}`
  }
  return peLastari.map((intrare) => `${etichetaLastar(intrare.lastar as Cohorta, 'scurt')}: ${etichetaFaraLastar(intrare.eticheta)}`).join(' · ')
}

// ─── Ciclul (an 1 + an 2) ─────────────────────────────────────────────────────

export type ActiuneCiclu = 'tai_tot' | 'pastrez' | 'taiat_an2'

export const ETICHETA_ACTIUNE_CICLU: Record<ActiuneCiclu, string> = {
  tai_tot: 'Tai tot',
  pastrez: 'Păstrez o parte pentru anul viitor',
  taiat_an2: 'Tăiat (lăstarii de an 2 au fost scoși)',
}

/**
 * Ce oferă foaia Stadiul după recoltare, în modul `an1_an2`: pe lăstarul de an 1, după „După recoltare primocane”,
 * „Tai tot” sau „Păstrez o parte”; pe lăstarul de an 2, după „După recoltare floricane”, „Tăiat”.
 */
export function actiuniCiclu(mod: ModLastari | null, lastar: Cohorta, stadiuCurent: StadiuCod | null): ActiuneCiclu[] {
  if (mod !== 'an1_an2' || stadiuCurent !== 'post_recoltare') return []
  return lastar === 'primocane' ? ['tai_tot', 'pastrez'] : ['taiat_an2']
}

/**
 * Rândurile de scris pentru o acțiune, toate în aceeași zi:
 * - „Tai tot”: lăstarul de an 1 tăiat (nu creează lăstar de an 2);
 * - „Păstrez”: lăstarul de an 2 pe „Floricane în repaus” (`pastrat`) și lăstarul de an 1 tăiat (lăstarii din toamnă
 *   devin lăstari de an 2; an 1 rămâne fără stadiu până la „Pornire lăstari noi”);
 * - „Tăiat” pe an 2: lăstarul de an 2 fără stadiu până la următorul „Păstrez”.
 */
export function randuriActiuneCiclu(actiune: ActiuneCiclu): Array<{ stadiu: typeof STADIU_PASTRAT | typeof STADIU_TAIAT; cohort: Cohorta }> {
  if (actiune === 'tai_tot') return [{ stadiu: STADIU_TAIAT, cohort: 'primocane' }]
  if (actiune === 'pastrez') {
    return [
      { stadiu: STADIU_PASTRAT, cohort: 'floricane' },
      { stadiu: STADIU_TAIAT, cohort: 'primocane' },
    ]
  }
  return [{ stadiu: STADIU_TAIAT, cohort: 'floricane' }]
}

// ─── Planul (promptul 30) ─────────────────────────────────────────────────────

/** Stadiile din anul trecut pe care planul și „E timpul pentru…” le folosesc și în anul nou (promptul 33). */
const STADII_PESTE_AN: ReadonlySet<StadiuCod> = new Set<StadiuCod>(['pastrat', 'repaus_vegetativ'])

/**
 * Stadiul cu care lucrează planul: `pastrat` contează ca `repaus_vegetativ` (cheile planului nu se schimbă), `taiat`
 * nu e un stadiu. Un stadiu notat în alt an decât `an` contează doar dacă e `pastrat` sau `repaus_vegetativ`
 * (o parcelă rămasă pe „După recoltare” din vară nu pornește planul pe 1 ianuarie).
 */
export function stadiuPentruPlan(cod: StadiuCod | null, ziNotata: string | null, an: number | null): StadiuCod | null {
  if (!cod || cod === STADIU_TAIAT) return null
  const anNotat = Number(String(ziNotata ?? '').slice(0, 4))
  if (an !== null && Number.isFinite(anNotat) && anNotat > 0 && anNotat !== an && !STADII_PESTE_AN.has(cod)) return null
  return cod === STADIU_PASTRAT ? 'repaus_vegetativ' : cod
}
