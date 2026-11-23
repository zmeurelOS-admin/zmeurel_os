/**
 * Planul pe stadii (promptul 30): forma planurilor, a liniilor și a produselor, așa cum le folosește aplicația.
 * Refolosește tabelele existente (`planuri_tratament`, `planuri_tratament_linii`, `planuri_tratament_linie_produse`,
 * `parcele_planuri`). Liniile vechi țin produsul pe linie (`produs_id` / `produs_nume_manual`, fără rânduri de
 * produse): `produseLinie` îl citește de acolo. Fără React și fără Supabase.
 */
import { normalizeCropCod } from '@/lib/crops/crop-codes'
import {
  getGrupBiologicForCropCod,
  getLabelPentruGrup,
  getOrdine,
  listStadiiPentruGrup,
  normalizeStadiu,
  type GrupBiologic,
  type StadiuCod,
} from '@/lib/parcele/stadii-canonic'

export type MetodaLinie = 'foliar' | 'fertirigare' | 'fertilizare_baza' | 'granulat_sol' | 'altul'
export type Cohorta = 'floricane' | 'primocane'

export interface ProdusLinie {
  /** Rândul din `planuri_tratament_linie_produse`; `null` = produsul vechi ținut pe linie. */
  id: string | null
  ordine: number
  produs_id: string | null
  nume: string
  tip: string | null
  phi: number | null
  doza_ml_per_hl: number | null
  doza_l_per_ha: number | null
  /** Fertirigare: „2 g/plantă · A” (același text ca la aplicări). */
  cantitate_text: string | null
}

export interface LiniePlan {
  id: string
  plan_id: string
  ordine: number
  stadiu: StadiuCod
  /** Textul din bază, dacă nu e un stadiu cunoscut (se păstrează la salvare). */
  stadiu_brut: string
  cohort: Cohorta | null
  scop: string | null
  tip_interventie: string | null
  metoda: MetodaLinie | null
  /** `null` = fără repetare. */
  repetare: { zile: number; ori: number | null } | null
  observatii: string | null
  produse: ProdusLinie[]
}

export interface PlanTratament {
  id: string
  nume: string
  cultura_tip: string
  descriere: string | null
  activ: boolean
  arhivat: boolean
  linii: LiniePlan[]
}

export interface ParcelaPlan {
  plan_id: string
  parcela_id: string
  an: number
  activ: boolean
}

// ─── Din rândurile bazei ─────────────────────────────────────────────────────────────────────────────────────────

const num = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}
const text = (value: unknown): string | null => {
  const s = typeof value === 'string' ? value.trim() : ''
  return s ? s : null
}

const METODE: ReadonlySet<string> = new Set(['foliar', 'fertirigare', 'fertilizare_baza', 'granulat_sol', 'altul'])

export type RandLinie = Record<string, unknown> & {
  produs?: Record<string, unknown> | Array<Record<string, unknown>> | null
  produse?: Array<Record<string, unknown>> | null
}

/** Produsele unei linii: rândurile copil, altfel produsul vechi de pe linie. */
export function produseLinie(row: RandLinie): ProdusLinie[] {
  const copii = Array.isArray(row.produse) ? row.produse : []
  if (copii.length > 0) {
    return [...copii]
      .map((p) => ({
        id: text(p.id),
        ordine: num(p.ordine) ?? 1,
        produs_id: text(p.produs_id),
        nume: text(p.produs_nume_snapshot) ?? text(p.produs_nume_manual) ?? 'Produs',
        tip: text(p.tip_snapshot),
        phi: num(p.phi_zile_snapshot),
        doza_ml_per_hl: num(p.doza_ml_per_hl),
        doza_l_per_ha: num(p.doza_l_per_ha),
        cantitate_text: text(p.cantitate_text),
      }))
      .sort((a, b) => a.ordine - b.ordine)
  }
  const produs = Array.isArray(row.produs) ? (row.produs[0] ?? null) : (row.produs ?? null)
  const nume = text(produs?.nume_comercial) ?? text(row.produs_nume_manual)
  if (!nume) return []
  return [
    {
      id: null,
      ordine: 1,
      produs_id: text(row.produs_id),
      nume,
      tip: text(produs?.tip),
      phi: num(produs?.phi_zile),
      doza_ml_per_hl: num(row.doza_ml_per_hl),
      doza_l_per_ha: num(row.doza_l_per_ha),
      cantitate_text: null,
    },
  ]
}

export function linieDinRand(row: RandLinie): LiniePlan {
  const brut = String(row.stadiu_trigger ?? '')
  const stadiu = normalizeStadiu(brut) ?? 'repaus_vegetativ'
  const cohort = row.cohort_trigger === 'floricane' || row.cohort_trigger === 'primocane' ? row.cohort_trigger : null
  const metoda = typeof row.metoda_aplicare === 'string' && METODE.has(row.metoda_aplicare) ? (row.metoda_aplicare as MetodaLinie) : null
  const zile = num(row.interval_repetare_zile)
  const repetare = row.regula_repetare === 'interval' && zile && zile > 0 ? { zile, ori: num(row.numar_repetari_max) } : null
  return {
    id: String(row.id),
    plan_id: String(row.plan_id),
    ordine: num(row.ordine) ?? 0,
    stadiu,
    stadiu_brut: brut,
    cohort,
    scop: text(row.scop),
    tip_interventie: text(row.tip_interventie),
    metoda,
    repetare,
    observatii: text(row.observatii),
    produse: produseLinie(row),
  }
}

export function planDinRand(row: Record<string, unknown>, linii: LiniePlan[]): PlanTratament {
  return {
    id: String(row.id),
    nume: text(row.nume) ?? 'Plan',
    cultura_tip: text(row.cultura_tip) ?? 'zmeur',
    descriere: text(row.descriere),
    activ: row.activ !== false,
    arhivat: row.arhivat === true,
    linii: ordoneazaLinii(linii.filter((linie) => linie.plan_id === String(row.id))),
  }
}

/** Liniile în ordinea stadiilor, apoi după `ordine`. */
export function ordoneazaLinii<T extends Pick<LiniePlan, 'stadiu' | 'ordine'>>(linii: readonly T[]): T[] {
  return [...linii].sort((a, b) => getOrdine(a.stadiu) - getOrdine(b.stadiu) || a.ordine - b.ordine)
}

// ─── Stadiile planului ──────────────────────────────────────────────────────────────────────────────────────────

/** Grupul biologic al planului din `cultura_tip` („zmeur”, „capsun”…); necunoscut = zmeură. */
export function grupPlan(culturaTip: string | null | undefined): GrupBiologic {
  const primul = String(culturaTip ?? '').trim().split(/\s+/)[0] ?? ''
  return getGrupBiologicForCropCod(normalizeCropCod(culturaTip) ?? normalizeCropCod(primul)) ?? 'rubus'
}

/** Stadiile afișate în plan: ale culturii, plus orice stadiu folosit de linii, în ordinea fenologică. */
export function stadiiPlan(plan: Pick<PlanTratament, 'cultura_tip' | 'linii'>): StadiuCod[] {
  const grup = grupPlan(plan.cultura_tip)
  const lista = new Set<StadiuCod>(listStadiiPentruGrup(grup))
  for (const linie of plan.linii) lista.add(linie.stadiu)
  const profil = listStadiiPentruGrup(grup)
  return [...lista].sort((a, b) => {
    const ia = profil.indexOf(a)
    const ib = profil.indexOf(b)
    if (ia >= 0 && ib >= 0) return ia - ib
    return getOrdine(a) - getOrdine(b)
  })
}

/** „Înflorit”, „Pornire în vegetație” (zmeura are etichetele ei). */
export function eticheta(stadiu: StadiuCod, culturaTip?: string | null, cohort?: Cohorta | null): string {
  return getLabelPentruGrup(stadiu, grupPlan(culturaTip ?? 'zmeur'), { cohort })
}

// ─── Texte ───────────────────────────────────────────────────────────────────────────────────────────────────────

export const ETICHETA_METODA: Record<MetodaLinie, string> = {
  foliar: 'foliar',
  fertirigare: 'fertirigare',
  fertilizare_baza: 'la sol',
  granulat_sol: 'la sol',
  altul: 'altă metodă',
}

const nr = (value: number) => new Intl.NumberFormat('ro-RO', { maximumFractionDigits: 2 }).format(value)

/** „1,5 l/ha”, „250 ml/100 l”, „2 g/plantă · A”. */
export function textDoza(produs: Pick<ProdusLinie, 'doza_ml_per_hl' | 'doza_l_per_ha' | 'cantitate_text' | 'tip'>): string | null {
  if (produs.cantitate_text) return produs.cantitate_text
  const solid = produs.tip === 'ingrasamant'
  if (produs.doza_l_per_ha !== null && produs.doza_l_per_ha > 0) return `${nr(produs.doza_l_per_ha)} ${solid ? 'kg' : 'l'}/ha`
  if (produs.doza_ml_per_hl !== null && produs.doza_ml_per_hl > 0) return `${nr(produs.doza_ml_per_hl)} ${solid ? 'g' : 'ml'}/100 l`
  return null
}

/** „Borofol + Atonik”. */
type ProdusText = Pick<ProdusLinie, 'nume' | 'doza_ml_per_hl' | 'doza_l_per_ha' | 'cantitate_text' | 'tip'>

export function textProduseLinie(linie: { produse: readonly Pick<ProdusLinie, 'nume'>[] }): string {
  return linie.produse.map((produs) => produs.nume).join(' + ') || 'Fără produs'
}

/** Titlul liniei: „Borofol · bor la înflorire”. */
export function titluLinie(linie: { produse: readonly Pick<ProdusLinie, 'nume'>[]; scop: string | null }): string {
  return linie.scop ? `${textProduseLinie(linie)} · ${linie.scop}` : textProduseLinie(linie)
}

/** „repetă la 7 zile, de 3 ori”. */
export function textRepetare(repetare: LiniePlan['repetare']): string | null {
  if (!repetare) return null
  const zile = repetare.zile === 1 ? 'în fiecare zi' : `la ${repetare.zile} zile`
  if (!repetare.ori || repetare.ori <= 1) return `repetă ${zile}`
  return `repetă ${zile}, de ${repetare.ori} ori`
}

/** Detaliul liniei: „foliar · 1,5 l/ha · repetă la 10 zile, de 2 ori”. */
export function detaliuLinie(linie: Pick<LiniePlan, 'metoda' | 'repetare'> & { produse: readonly ProdusText[] }): string {
  const doze = linie.produse.map(textDoza).filter((d): d is string => Boolean(d))
  return [linie.metoda ? ETICHETA_METODA[linie.metoda] : null, doze.length === 1 ? doze[0] : doze.length > 1 ? doze.join(' + ') : null, textRepetare(linie.repetare)]
    .filter(Boolean)
    .join(' · ')
}

/** Numele propus pentru un plan nou: „Zmeură 2027”. */
export function numePlanPropus(an: number, cultura = 'Zmeură'): string {
  return `${cultura} ${an}`
}

/** „1 intervenție”, „3 intervenții”, „20 de intervenții”. */
export function interventiiText(n: number): string {
  if (n === 1) return '1 intervenție'
  const rest = Math.abs(n) % 100
  return `${n} ${n !== 0 && (rest === 0 || rest >= 20) ? 'de ' : ''}intervenții`
}

/**
 * Anul pentru care se face un plan nou: toamna și iarna (septembrie–decembrie) se pregătește sezonul următor
 * („Zmeură 2027”, din ce s-a aplicat în 2026); de la ianuarie, anul curent.
 */
export function anPlanNou(azi: string): number {
  const an = Number(azi.slice(0, 4))
  return Number(azi.slice(5, 7)) >= 9 ? an + 1 : an
}

/** Cultura planului din cultura parcelei („Zmeure Delniwa” → `zmeur`); necunoscut = zmeură. */
export function culturaDinParcela(cultura: string | null | undefined): string {
  const primul = String(cultura ?? '').trim().split(/\s+/)[0] ?? ''
  return normalizeCropCod(cultura) ?? normalizeCropCod(primul) ?? 'zmeur'
}

/** Stadiile din care se alege la o linie nouă (ale culturii planului). */
export function listaStadiiPlanNou(culturaTip: string | null | undefined): StadiuCod[] {
  return listStadiiPentruGrup(grupPlan(culturaTip))
}
