/**
 * Formularele planului, fără React:
 *   - formularul de tratament completat dintr-o linie (parcele, produse, doze, metodă, `plan_linie_id`);
 *   - rândurile pentru un plan nou și pentru o linie (în tabelele existente), cu id-uri derivate din cheia
 *     formularului: „Salvează” apăsat din nou după o eroare nu dublează nimic (fără migrare).
 */
import { cheieNoua, type CiornaTratament, type ProdusCiorna } from '@/lib/tratamente/formular'
import { citesteTextFertirigare, unitateImplicita, type ModDoza, type UnitateProdus } from '@/lib/tratamente/doze'
import type { MetodaFormular, ProdusCatalog } from '@/lib/tratamente/model'
import type { StadiuCod } from '@/lib/parcele/stadii-canonic'

import type { Cohorta, LiniePlan, MetodaLinie, ProdusLinie } from './model'

// ─── Linie → formularul de tratament ─────────────────────────────────────────────────────────────────────────────

export function metodaFormularDinLinie(linie: Pick<LiniePlan, 'metoda' | 'produse'>): MetodaFormular {
  if (linie.metoda === 'fertirigare') return 'fertirigare'
  if (linie.metoda === 'fertilizare_baza' || linie.metoda === 'granulat_sol') return 'sol'
  if (!linie.metoda && linie.produse.some((p) => citesteTextFertirigare(p.cantitate_text))) return 'fertirigare'
  return 'stropire'
}

export const METODA_LINIE_DIN_FORMULAR: Record<MetodaFormular, MetodaLinie> = {
  stropire: 'foliar',
  fertirigare: 'fertirigare',
  sol: 'fertilizare_baza',
}

/**
 * Ciorna formularului de tratament dintr-o linie de plan. Dozele trec cum sunt în plan; la fertirigare, grame pe
 * plantă din „2 g/plantă · rezervor A”. Produsele păstrează legătura cu rândul din plan (`planLinieProdusId`).
 */
export function ciornaDinLinie(linie: LiniePlan, parcelaIds: readonly string[], catalog: ReadonlyMap<string, ProdusCatalog>): CiornaTratament {
  const metoda = metodaFormularDinLinie(linie)
  const areHa = linie.produse.some((p) => Number(p.doza_l_per_ha) > 0)
  const areHl = linie.produse.some((p) => Number(p.doza_ml_per_hl) > 0)
  const mod: ModDoza = areHa && !areHl ? 'ha' : 'hl'
  const produse: ProdusCiorna[] = linie.produse.map((produs) => {
    const dinCatalog = produs.produs_id ? catalog.get(produs.produs_id) : undefined
    const fert = citesteTextFertirigare(produs.cantitate_text)
    const tip = dinCatalog?.tip ?? produs.tip
    const unitate: UnitateProdus = dinCatalog ? unitateImplicita(dinCatalog) : tip === 'ingrasamant' ? 'g' : 'ml'
    return {
      key: cheieNoua(),
      produsId: produs.produs_id,
      nume: dinCatalog?.nume_comercial ?? produs.nume,
      substanta: dinCatalog?.substanta_activa?.trim() || null,
      tip: tip ?? null,
      frac: dinCatalog?.frac_irac ?? null,
      phi: dinCatalog?.phi_zile ?? produs.phi,
      nrMaxPeSezon: dinCatalog?.nr_max_aplicari_per_sezon ?? null,
      intervalMinZile: dinCatalog?.interval_min_aplicari_zile ?? null,
      unitate: metoda === 'sol' ? (tip === 'ingrasamant' ? 'g' : unitate) : unitate,
      doza: metoda === 'stropire' ? (mod === 'ha' ? Number(produs.doza_l_per_ha) : Number(produs.doza_ml_per_hl)) || null : null,
      gPePlanta: fert?.gPePlanta ?? null,
      rezervor: fert?.rezervor === 'B' ? 'B' : 'A',
      planLinieProdusId: produs.id,
    }
  })
  return { metoda, parcelaIds: [...parcelaIds], produse, mod, volumL: null }
}

// ─── Id-uri derivate din cheia formularului ──────────────────────────────────────────────────────────────────────

/** Un UUID derivat din `cheie` (n = 0 → cheia însăși). Doar ultimele 8 cifre se schimbă, deterministic. */
export function idDerivat(cheie: string, n: number): string {
  if (n === 0) return cheie
  const coada = cheie.slice(-8)
  const valoare = (parseInt(coada, 16) + n) % 0x100000000
  return `${cheie.slice(0, -8)}${valoare.toString(16).padStart(8, '0')}`
}

// ─── Plan nou și linii ───────────────────────────────────────────────────────────────────────────────────────────

export interface ProdusLinieNou {
  produs_id: string | null
  nume: string
  tip: string | null
  phi: number | null
  doza_ml_per_hl: number | null
  doza_l_per_ha: number | null
  cantitate_text: string | null
}

export interface LinieNoua {
  stadiu: StadiuCod
  cohort: Cohorta | null
  scop: string | null
  metoda: MetodaLinie | null
  repetare: { zile: number; ori: number | null } | null
  observatii?: string | null
  produse: ProdusLinieNou[]
}

const TIPURI_CATALOG = new Set(['fungicid', 'insecticid', 'erbicid', 'acaricid', 'foliar', 'ingrasamant', 'bioregulator', 'altul'])

const TIP_INTERVENTIE: Record<string, string> = {
  fungicid: 'protectie',
  insecticid: 'protectie',
  acaricid: 'protectie',
  erbicid: 'erbicidare',
  foliar: 'nutritie',
  ingrasamant: 'nutritie',
  bioregulator: 'biostimulare',
}

/** Tipul intervenției liniei, din primul produs (`tip_interventie` are valori fixe în bază). */
export function tipInterventie(linie: Pick<LinieNoua, 'produse' | 'metoda'>): string {
  if (linie.metoda === 'fertirigare' || linie.metoda === 'fertilizare_baza' || linie.metoda === 'granulat_sol') return 'nutritie'
  return TIP_INTERVENTIE[linie.produse[0]?.tip ?? ''] ?? 'altul'
}

/** Rândul liniei (fără `id`, `tenant_id`, `plan_id`, `ordine`): produsul vechi de pe linie e primul produs. */
export function campuriLinie(linie: LinieNoua): Record<string, unknown> {
  const primul = linie.produse[0]
  return {
    stadiu_trigger: linie.stadiu,
    cohort_trigger: linie.cohort,
    scop: linie.scop?.trim() || null,
    tip_interventie: tipInterventie(linie),
    metoda_aplicare: linie.metoda,
    regula_repetare: linie.repetare ? 'interval' : 'fara_repetare',
    interval_repetare_zile: linie.repetare ? Math.max(1, Math.round(linie.repetare.zile)) : null,
    numar_repetari_max: linie.repetare?.ori && linie.repetare.ori >= 1 ? Math.round(linie.repetare.ori) : null,
    // Constrângerea `planuri_tratament_linii_produs_xor_check`: produsul din catalog sau un nume.
    produs_id: primul?.produs_id ?? null,
    produs_nume_manual: primul?.produs_id ? null : (primul?.nume?.trim() || 'Produs'),
    doza_ml_per_hl: primul?.doza_ml_per_hl ?? null,
    doza_l_per_ha: primul?.doza_l_per_ha ?? null,
    observatii: linie.observatii?.trim() || null,
  }
}

export function randProdusLinie(produs: ProdusLinieNou, ordine: number): Record<string, unknown> {
  return {
    ordine,
    produs_id: produs.produs_id,
    produs_nume_manual: produs.produs_id ? null : produs.nume.trim() || 'Produs',
    produs_nume_snapshot: produs.nume.trim() || 'Produs',
    tip_snapshot: produs.tip && TIPURI_CATALOG.has(produs.tip) ? produs.tip : null,
    phi_zile_snapshot: produs.phi !== null && produs.phi >= 0 ? Math.floor(produs.phi) : null,
    doza_ml_per_hl: produs.doza_ml_per_hl,
    doza_l_per_ha: produs.doza_l_per_ha,
    cantitate_text: produs.cantitate_text,
  }
}

export interface RanduriPlanNou {
  plan: Record<string, unknown>
  linii: Array<Record<string, unknown>>
  produse: Array<Record<string, unknown>>
  parcele: Array<Record<string, unknown>>
}

/**
 * Tot ce se scrie pentru un plan nou: planul (id = cheia formularului), liniile, produsele lor și parcelele pe anul
 * `an`. Id-urile derivate fac reîncercarea sigură.
 */
export function randuriPlanNou(input: {
  cheie: string
  tenantId: string
  userId: string | null
  nume: string
  culturaTip: string
  descriere?: string | null
  linii: readonly LinieNoua[]
  parcelaIds: readonly string[]
  an: number
}): RanduriPlanNou {
  const planId = input.cheie
  const linii: Array<Record<string, unknown>> = []
  const produse: Array<Record<string, unknown>> = []
  input.linii.forEach((linie, i) => {
    const linieId = idDerivat(input.cheie, i + 1)
    linii.push({ id: linieId, tenant_id: input.tenantId, plan_id: planId, ordine: i + 1, ...campuriLinie(linie) })
    linie.produse.forEach((produs, j) => {
      produse.push({ id: idDerivat(input.cheie, 10_000 + i * 100 + j), tenant_id: input.tenantId, plan_linie_id: linieId, ...randProdusLinie(produs, j + 1) })
    })
  })
  return {
    plan: {
      id: planId,
      tenant_id: input.tenantId,
      nume: input.nume.trim() || 'Plan',
      cultura_tip: input.culturaTip,
      descriere: input.descriere ?? null,
      activ: true,
      arhivat: false,
      created_by: input.userId,
      updated_by: input.userId,
    },
    linii,
    produse,
    parcele: input.parcelaIds.map((parcelaId, k) => ({
      id: idDerivat(input.cheie, 50_000 + k),
      tenant_id: input.tenantId,
      parcela_id: parcelaId,
      plan_id: planId,
      an: input.an,
      activ: true,
    })),
  }
}

/** Produsele unei linii existente, ca intrare pentru editare. */
export function produseNoiDinLinie(produse: readonly ProdusLinie[]): ProdusLinieNou[] {
  return produse.map((p) => ({
    produs_id: p.produs_id,
    nume: p.nume,
    tip: p.tip,
    phi: p.phi,
    doza_ml_per_hl: p.doza_ml_per_hl,
    doza_l_per_ha: p.doza_l_per_ha,
    cantitate_text: p.cantitate_text,
  }))
}

/** O linie existentă ca intrare pentru editare. */
export function linieNouaDin(linie: LiniePlan): LinieNoua {
  return {
    stadiu: linie.stadiu,
    cohort: linie.cohort,
    scop: linie.scop,
    metoda: linie.metoda,
    repetare: linie.repetare,
    observatii: linie.observatii,
    produse: produseNoiDinLinie(linie.produse),
  }
}

/** Ce lipsește ca linia să poată fi salvată. */
export function ceLipsesteLinie(linie: LinieNoua): string | null {
  if (linie.produse.length === 0) return 'Adaugă cel puțin un produs.'
  if (linie.repetare && !(linie.repetare.zile >= 1)) return 'Scrie la câte zile se repetă.'
  return null
}
