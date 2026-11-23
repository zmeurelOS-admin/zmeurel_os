/**
 * „Ce urmează” în plan (promptul 30). Pentru fiecare parcelă cu plan activ în anul curent: stadiul de acum (de pe
 * fișă) → liniile acelui stadiu → „E timpul pentru…”, dacă linia n-a fost făcută (o aplicare cu `plan_linie_id` pe
 * parcelă, în sezon), nici sărită, nici scoasă de pe parcelă (excepție).
 *
 * „Repetă la N zile, de M ori”: după o aplicare, linia reapare peste N zile, cât timp parcela e tot în acel stadiu,
 * până la M aplicări în total (fără M: cât ține stadiul). Funcții pure, folosite și de cron, și de ecrane.
 */
import { adaugaZile } from '@/lib/tratamente/zile'
import type { StadiuCod } from '@/lib/parcele/stadii-canonic'

import { ordoneazaLinii, stadiiPlan, type LiniePlan, type ParcelaPlan, type PlanTratament } from './model'
import type { StadiuCurent } from './stadii'

export interface AplicarePlan {
  id: string
  parcela_id: string
  plan_linie_id: string | null
  /** 'aplicata' / 'planificata' / altele (anulate, ciorne: nu contează). */
  status: string
  /** Ziua aplicării (făcut) sau ziua planificată, în ora României. */
  zi: string | null
}

export interface SarireLinie {
  plan_linie_id: string
  parcela_id: string
  an: number
  motiv: string | null
}

export interface ExceptieLinie {
  plan_linie_id: string
  parcela_id: string
}

export type StareLinie = 'acum' | 'facut' | 'planificat' | 'urmeaza' | 'sarit' | 'nefacut' | 'exceptie' | 'fara_stadiu'

export interface StareLinieParcela {
  linieId: string
  parcelaId: string
  stare: StareLinie
  /** Câte aplicări făcute are linia pe parcelă în sezon. */
  facute: number
  /** Aplicarea care urmează (1 = prima, 2 = prima repetare…), când `stare = 'acum'`. */
  repetare: number
  /** Ultima aplicare făcută. */
  ultima: string | null
  /** Repetarea următoare (când linia e făcută și se repetă). */
  urmatoarea: string | null
  motiv: string | null
}

export interface ContextPlan {
  azi: string
  an: number
  /** Stadiile de acum, pe parcele (`stadiiCurentePeParcele`). */
  stadii: ReadonlyMap<string, StadiuCurent[]>
  aplicari: readonly AplicarePlan[]
  sarite: readonly SarireLinie[]
  exceptii: readonly ExceptieLinie[]
}

const indexStadiu = (lista: readonly StadiuCod[], stadiu: StadiuCod) => {
  const i = lista.indexOf(stadiu)
  return i >= 0 ? i : Number.MAX_SAFE_INTEGER
}

/**
 * Unde e parcela față de stadiul liniei: 'in' (e chiar în stadiu), 'inainte' (încă n-a ajuns), 'dupa' (l-a trecut)
 * sau `null` (niciun stadiu notat). La cohorte: linia cu cohortă se uită doar la cohorta ei; linia fără cohortă
 * e „în stadiu” dacă oricare cohortă e acolo.
 */
export function pozitieFataDeLinie(
  linie: Pick<LiniePlan, 'stadiu' | 'cohort'>,
  curente: readonly StadiuCurent[],
  ordine: readonly StadiuCod[],
): { pozitie: 'in' | 'inainte' | 'dupa'; din: string } | null {
  const relevante = linie.cohort ? curente.filter((c) => c.cohort === linie.cohort || c.cohort === null) : curente
  if (relevante.length === 0) return null
  const tinta = indexStadiu(ordine, linie.stadiu)
  const exact = relevante.find((c) => c.stadiu === linie.stadiu)
  if (exact) return { pozitie: 'in', din: exact.din }
  const inainte = relevante.find((c) => indexStadiu(ordine, c.stadiu) < tinta)
  if (inainte) return { pozitie: 'inainte', din: inainte.din }
  return { pozitie: 'dupa', din: relevante[0].din }
}

/** Starea unei linii pe o parcelă, în anul `ctx.an`. */
export function stareLinieParcela(linie: LiniePlan, parcelaId: string, ordine: readonly StadiuCod[], ctx: ContextPlan): StareLinieParcela {
  const baza = { linieId: linie.id, parcelaId, facute: 0, repetare: 1, ultima: null, urmatoarea: null, motiv: null }
  if (ctx.exceptii.some((e) => e.plan_linie_id === linie.id && e.parcela_id === parcelaId)) return { ...baza, stare: 'exceptie' }

  const prefix = `${ctx.an}-`
  const aleLiniei = ctx.aplicari.filter((a) => a.plan_linie_id === linie.id && a.parcela_id === parcelaId && a.zi?.startsWith(prefix))
  const facuteZile = aleLiniei
    .filter((a) => a.status === 'aplicata')
    .map((a) => a.zi as string)
    .sort()
  const facute = facuteZile.length
  const ultima = facuteZile.at(-1) ?? null
  const planificata = aleLiniei.some((a) => a.status === 'planificata' && (!ultima || (a.zi as string) >= ultima))

  const sarita = ctx.sarite.find((s) => s.plan_linie_id === linie.id && s.parcela_id === parcelaId && s.an === ctx.an)
  if (sarita) return { ...baza, facute, ultima, stare: 'sarit', motiv: sarita.motiv }

  const pozitie = pozitieFataDeLinie(linie, ctx.stadii.get(parcelaId) ?? [], ordine)
  const max = linie.repetare ? (linie.repetare.ori && linie.repetare.ori > 0 ? linie.repetare.ori : Number.POSITIVE_INFINITY) : 1
  const urmatoarea = linie.repetare && ultima && facute < max ? adaugaZile(ultima, linie.repetare.zile) : null

  if (planificata) return { ...baza, facute, ultima, urmatoarea, stare: 'planificat' }
  if (!pozitie) return { ...baza, facute, ultima, stare: facute > 0 ? 'facut' : 'fara_stadiu' }
  if (pozitie.pozitie === 'inainte') return { ...baza, facute, ultima, stare: facute > 0 ? 'facut' : 'urmeaza' }
  if (pozitie.pozitie === 'dupa') return { ...baza, facute, ultima, stare: facute > 0 ? 'facut' : 'nefacut' }

  // În stadiu.
  if (facute === 0) return { ...baza, stare: 'acum' }
  // Aplicările dinaintea intrării în stadiu (alt an, altă cohortă) nu opresc repetarea; în stadiu, repetăm.
  if (urmatoarea && ctx.azi >= urmatoarea) return { ...baza, facute, ultima, urmatoarea, stare: 'acum', repetare: facute + 1 }
  return { ...baza, facute, ultima, urmatoarea: facute < max ? urmatoarea : null, stare: 'facut' }
}

export interface InterventieDeFacut {
  planId: string
  linie: LiniePlan
  parcelaId: string
  repetare: number
}

export interface CalculPlan {
  /** Starea fiecărei linii pe fiecare parcelă a planului (cheia: `linie:parcela`). */
  stari: Map<string, StareLinieParcela>
  /** Ce e de făcut acum (linie × parcelă). */
  deFacut: InterventieDeFacut[]
  /** Parcelele planului în anul curent. */
  parcelaIds: string[]
}

export const cheieStare = (linieId: string, parcelaId: string) => `${linieId}:${parcelaId}`

/** Parcelele cu planul activ în anul `an` (ultima asociere activă pe parcelă câștigă). */
export function parcelePlan(planId: string, asocieri: readonly ParcelaPlan[], an: number): string[] {
  return [...new Set(asocieri.filter((a) => a.plan_id === planId && a.an === an && a.activ).map((a) => a.parcela_id))]
}

export function calculeazaPlan(plan: PlanTratament, asocieri: readonly ParcelaPlan[], ctx: ContextPlan): CalculPlan {
  const ordine = stadiiPlan(plan)
  const parcelaIds = plan.arhivat ? [] : parcelePlan(plan.id, asocieri, ctx.an)
  const stari = new Map<string, StareLinieParcela>()
  const deFacut: InterventieDeFacut[] = []
  for (const linie of ordoneazaLinii(plan.linii)) {
    for (const parcelaId of parcelaIds) {
      const stare = stareLinieParcela(linie, parcelaId, ordine, ctx)
      stari.set(cheieStare(linie.id, parcelaId), stare)
      if (stare.stare === 'acum') deFacut.push({ planId: plan.id, linie, parcelaId, repetare: stare.repetare })
    }
  }
  return { stari, deFacut, parcelaIds }
}

// ─── Gruparea pentru ecran ───────────────────────────────────────────────────────────────────────────────────────

export interface LinieDeFacut {
  linie: LiniePlan
  parcelaIds: string[]
  /** Cea mai mare repetare dintre parcele (1 = prima aplicare). */
  repetare: number
}

export interface GrupDeFacut {
  planId: string
  stadiu: StadiuCod
  parcelaIds: string[]
  linii: LinieDeFacut[]
}

/** „E timpul pentru”: ce e de făcut, pe stadii (în ordinea stadiilor), cu liniile și parcelele lor. */
export function grupeazaDeFacut(plan: PlanTratament, deFacut: readonly InterventieDeFacut[]): GrupDeFacut[] {
  const ordine = stadiiPlan(plan)
  const grupuri = new Map<StadiuCod, GrupDeFacut>()
  for (const item of deFacut) {
    if (item.planId !== plan.id) continue
    const grup = grupuri.get(item.linie.stadiu) ?? { planId: plan.id, stadiu: item.linie.stadiu, parcelaIds: [], linii: [] }
    if (!grup.parcelaIds.includes(item.parcelaId)) grup.parcelaIds.push(item.parcelaId)
    const linie = grup.linii.find((l) => l.linie.id === item.linie.id)
    if (linie) {
      if (!linie.parcelaIds.includes(item.parcelaId)) linie.parcelaIds.push(item.parcelaId)
      linie.repetare = Math.max(linie.repetare, item.repetare)
    } else {
      grup.linii.push({ linie: item.linie, parcelaIds: [item.parcelaId], repetare: item.repetare })
    }
    grupuri.set(item.linie.stadiu, grup)
  }
  return [...grupuri.values()].sort((a, b) => indexStadiu(ordine, a.stadiu) - indexStadiu(ordine, b.stadiu))
}

export interface StadiuUrmator {
  stadiu: StadiuCod
  linii: LiniePlan[]
  /** Parcelele care încă n-au ajuns în stadiul ăsta (cu stadiul lor de acum). */
  parcele: Array<{ parcelaId: string; stadiu: StadiuCod | null }>
}

/** „Urmează”: stadiile de după cel de acum care au linii încă de făcut, pe scurt (cel mult `limita`). */
export function stadiiUrmatoare(plan: PlanTratament, calcul: CalculPlan, stadii: ReadonlyMap<string, StadiuCurent[]>, limita = 3): StadiuUrmator[] {
  const ordine = stadiiPlan(plan)
  const rezultat: StadiuUrmator[] = []
  for (const stadiu of ordine) {
    const linii = plan.linii.filter(
      (linie) =>
        linie.stadiu === stadiu &&
        calcul.parcelaIds.some((parcelaId) => {
          const stare = calcul.stari.get(cheieStare(linie.id, parcelaId))?.stare
          return stare === 'urmeaza' || stare === 'fara_stadiu'
        }),
    )
    if (linii.length === 0) continue
    const parcele = calcul.parcelaIds
      .filter((parcelaId) => linii.some((linie) => {
        const stare = calcul.stari.get(cheieStare(linie.id, parcelaId))?.stare
        return stare === 'urmeaza' || stare === 'fara_stadiu'
      }))
      .map((parcelaId) => {
        const curente = stadii.get(parcelaId) ?? []
        const cel = [...curente].sort((a, b) => indexStadiu(ordine, b.stadiu) - indexStadiu(ordine, a.stadiu))[0]
        return { parcelaId, stadiu: cel?.stadiu ?? null }
      })
    rezultat.push({ stadiu, linii: ordoneazaLinii(linii), parcele })
    if (rezultat.length >= limita) break
  }
  return rezultat
}

export type StareAn = 'acum' | 'planificat' | 'facut' | 'sarit' | 'urmeaza' | 'nefacut' | 'fara_parcele'

/**
 * Starea unei linii pe anul curent, pe toate parcelele planului (pentru „Planul întreg”): acum > planificat >
 * urmează > făcut > sărit > nefăcut. Parcelele cu excepție nu contează.
 */
export function stareLinieAn(linie: LiniePlan, calcul: CalculPlan): { stare: StareAn; facute: number; total: number } {
  const stari = calcul.parcelaIds
    .map((parcelaId) => calcul.stari.get(cheieStare(linie.id, parcelaId)))
    .filter((s): s is StareLinieParcela => Boolean(s) && s?.stare !== 'exceptie')
  const total = stari.length
  const facute = stari.filter((s) => s.facute > 0).length
  if (total === 0) return { stare: 'fara_parcele', facute, total }
  const are = (stare: StareLinie) => stari.some((s) => s.stare === stare)
  if (are('acum')) return { stare: 'acum', facute, total }
  if (are('planificat')) return { stare: 'planificat', facute, total }
  if (are('urmeaza') || are('fara_stadiu')) return { stare: 'urmeaza', facute, total }
  if (are('facut')) return { stare: 'facut', facute, total }
  if (stari.every((s) => s.stare === 'sarit')) return { stare: 'sarit', facute, total }
  if (are('sarit') && !are('nefacut')) return { stare: 'sarit', facute, total }
  return { stare: 'nefacut', facute, total }
}

export const ETICHETA_STARE_AN: Record<StareAn, string> = {
  acum: 'acum',
  planificat: 'planificat',
  facut: 'făcut',
  sarit: 'sărit',
  urmeaza: 'urmează',
  nefacut: 'nefăcut',
  fara_parcele: 'fără parcele',
}
