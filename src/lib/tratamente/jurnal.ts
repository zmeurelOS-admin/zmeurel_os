/**
 * Jurnalul de tratamente: aplicările noi, grupate pe lot (salvate împreună pe mai multe parcele), plus
 * activitățile vechi de tip tratament, „Importat”, doar citire, netransformate.
 */
import { afisareSol } from './sol'
import { citesteTextFertirigare, formatCantitate, formatKgTratament, type UnitateProdus } from './doze'
import {
  tipDinActivitateVeche,
  tipDinAplicare,
  type ActivitateVeche,
  type AplicareProdusRow,
  type AplicareRow,
  type TipJurnal,
} from './model'
import { pauzaAplicarii } from './pauza'
import { adaugaZile, ziuaRo } from './zile'

export type StareJurnal = 'facut' | 'planificat'

export interface ProdusJurnal {
  nume: string
  /** „110 g”, „2 g/pl (A)”, textul vechi („4ml /16 l apa”) sau `null`. */
  cantitate: string | null
}

export interface RandJurnal {
  key: string
  stare: StareJurnal
  tip: TipJurnal
  /** Ziua aplicării (făcute) sau ziua planificată. `null` = fără dată. */
  zi: string | null
  parcelaIds: string[]
  produse: ProdusJurnal[]
  /** Pauza aplicării (cea mai lungă dintre produse); `null` = fără pauză. */
  pauza: { zile: number; produs: string | null; panaLa: string | null } | null
  importat: boolean
  /** Aplicările din rând (gol la cele importate). */
  aplicari: AplicareRow[]
  lotId: string | null
  createdAt: string
}

const numar = (value: unknown): number | null => {
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

const formatG = (g: number) => new Intl.NumberFormat('ro-RO', { maximumFractionDigits: 2 }).format(g)

/** Produsele unui lot: același produs (după ordine și nume) se adună de pe toate parcelele. */
export function produseLot(aplicari: readonly AplicareRow[], tip: TipJurnal): ProdusJurnal[] {
  type Acc = { nume: string; unitate: string | null; total: number | null; text: string | null; g: number | null; rezervor: string | null; dozaHa: number | null }
  const map = new Map<string, Acc>()

  for (const aplicare of aplicari) {
    const produse: AplicareProdusRow[] =
      aplicare.produse.length > 0
        ? [...aplicare.produse].sort((a, b) => a.ordine - b.ordine)
        : aplicare.produs || aplicare.produs_nume_manual
          ? [
              {
                id: aplicare.id,
                ordine: 1,
                produs_id: aplicare.produs_id,
                produs_nume_manual: aplicare.produs_nume_manual,
                produs_nume_snapshot: aplicare.produs?.nume_comercial ?? aplicare.produs_nume_manual ?? 'Produs',
                substanta_activa_snapshot: null,
                tip_snapshot: aplicare.produs?.tip ?? null,
                frac_irac_snapshot: aplicare.produs?.frac_irac ?? null,
                phi_zile_snapshot: aplicare.produs?.phi_zile ?? null,
                doza_ml_per_hl: aplicare.doza_ml_per_hl,
                doza_l_per_ha: aplicare.doza_l_per_ha,
                cantitate_totala: null,
                unitate_cantitate: null,
                cantitate_text: null,
              },
            ]
          : []

    for (const produs of produse) {
      const nume = produs.produs_nume_snapshot?.trim() || produs.produs_nume_manual?.trim() || 'Produs'
      const key = `${produs.ordine}:${nume.toLocaleLowerCase('ro-RO')}`
      const fert = tip === 'fertirigare' ? citesteTextFertirigare(produs.cantitate_text) : null
      const g = numar(produs.doza_g_per_planta) ?? fert?.gPePlanta ?? null
      const rezervor = produs.rezervor ?? fert?.rezervor ?? null
      const cantitate = numar(produs.cantitate_totala)
      const acc = map.get(key)
      if (!acc) {
        map.set(key, {
          nume,
          unitate: produs.unitate_cantitate,
          total: cantitate,
          text: produs.cantitate_text?.trim() || null,
          g,
          rezervor,
          dozaHa: numar(produs.doza_l_per_ha),
        })
      } else {
        acc.total = acc.total !== null && cantitate !== null && acc.unitate === produs.unitate_cantitate ? acc.total + cantitate : acc.total
      }
    }
  }

  return [...map.values()].map((acc) => {
    if (tip === 'fertirigare' && acc.g !== null) {
      return { nume: acc.nume, cantitate: `${formatG(acc.g)} g/pl${acc.rezervor ? ` (${acc.rezervor})` : ''}` }
    }
    // La sol, în unitatea aleasă la salvare (t sau kg, pe parcele sau la ha), promptul 34, §8.
    if (tip === 'sol') {
      const sol = afisareSol({ cantitateBaza: acc.total, unitateBaza: acc.unitate, cantitateText: acc.text, dozaHaBaza: acc.dozaHa })
      if (sol.cantitate) return { nume: acc.nume, cantitate: sol.doza ? `${sol.cantitate} (${sol.doza})` : sol.cantitate }
    }
    if (acc.total !== null && acc.total > 0) {
      if (acc.unitate === 'ml' || acc.unitate === 'g') return { nume: acc.nume, cantitate: formatCantitate(acc.total, acc.unitate as UnitateProdus) }
      if (acc.unitate === 'kg') return { nume: acc.nume, cantitate: formatKgTratament(acc.total) }
      if (acc.unitate === 'l') return { nume: acc.nume, cantitate: `${formatG(acc.total)} l` }
    }
    return { nume: acc.nume, cantitate: acc.text }
  })
}

/** Ziua din jurnal: aplicarea pentru cele făcute, data planificată pentru celelalte. */
function ziuaAplicarii(aplicare: AplicareRow): string | null {
  if (aplicare.status === 'aplicata') return ziuaRo(aplicare.data_aplicata) ?? ziuaRo(aplicare.data_planificata)
  return ziuaRo(aplicare.data_planificata) ?? ziuaRo(aplicare.data_aplicata)
}

/** Grupează aplicările pe lot (`lot_id`); cele fără lot (vechi sau salvate înainte de migrare) apar câte una. */
export function grupeazaAplicari(aplicari: readonly AplicareRow[]): AplicareRow[][] {
  const grupuri = new Map<string, AplicareRow[]>()
  for (const aplicare of aplicari) {
    const key = aplicare.lot_id ? `lot:${aplicare.lot_id}:${aplicare.status}` : `id:${aplicare.id}`
    const lista = grupuri.get(key) ?? []
    lista.push(aplicare)
    grupuri.set(key, lista)
  }
  return [...grupuri.values()]
}

const STARI_IN_JURNAL: Record<string, StareJurnal> = { aplicata: 'facut', planificata: 'planificat' }

export function randuriDinAplicari(aplicari: readonly AplicareRow[]): RandJurnal[] {
  const randuri: RandJurnal[] = []
  for (const grup of grupeazaAplicari(aplicari)) {
    const prima = grup[0]
    const stare = STARI_IN_JURNAL[prima.status]
    if (!stare) continue // anulate, omise, ciorne
    const tip = tipDinAplicare(prima)
    const zi = ziuaAplicarii(prima)
    const { zile, produs } = grup
      .map((aplicare) => pauzaAplicarii(aplicare))
      .reduce((best, item) => (item.zile > best.zile ? item : best), { zile: 0, produs: null as string | null })
    randuri.push({
      key: prima.lot_id ? `lot:${prima.lot_id}:${prima.status}` : `aplicare:${prima.id}`,
      stare,
      tip,
      zi,
      parcelaIds: [...new Set(grup.map((aplicare) => aplicare.parcela_id))],
      produse: produseLot(grup, tip),
      pauza: zile > 0 ? { zile, produs, panaLa: stare === 'facut' && zi ? adaugaZile(zi, zile) : null } : null,
      importat: false,
      aplicari: grup,
      lotId: prima.lot_id ?? null,
      createdAt: prima.created_at,
    })
  }
  return randuri
}

export function randuriDinActivitati(activitati: readonly ActivitateVeche[]): RandJurnal[] {
  const randuri: RandJurnal[] = []
  for (const activitate of activitati) {
    const tip = tipDinActivitateVeche(activitate.tip_activitate)
    if (!tip) continue
    const zi = ziuaRo(activitate.data_aplicare)
    const zile = Math.max(0, Math.floor(Number(activitate.timp_pauza_zile) || 0))
    const nume = activitate.produs_utilizat?.trim() || activitate.tip_activitate?.trim() || 'Tratament'
    randuri.push({
      key: `activitate:${activitate.id}`,
      stare: 'facut',
      tip,
      zi,
      parcelaIds: activitate.parcela_id ? [activitate.parcela_id] : [],
      produse: [{ nume, cantitate: activitate.doza?.trim() || null }],
      pauza: zile > 0 ? { zile, produs: activitate.produs_utilizat?.trim() || null, panaLa: zi ? adaugaZile(zi, zile) : null } : null,
      importat: true,
      aplicari: [],
      lotId: null,
      createdAt: activitate.data_aplicare,
    })
  }
  return randuri
}

export type FiltruJurnal = 'toate' | 'stropire' | 'fertirigare' | 'altele'

export function potrivesteFiltru(rand: RandJurnal, filtru: FiltruJurnal): boolean {
  if (filtru === 'toate') return true
  if (filtru === 'altele') return rand.tip === 'sol' || rand.tip === 'altele'
  return rand.tip === filtru
}

/** Jurnalul întreg, ordonat: făcutele de la cea mai nouă, planificatele de la cea mai apropiată. */
export function construiesteJurnal(input: {
  aplicari: readonly AplicareRow[]
  activitati: readonly ActivitateVeche[]
}): { facute: RandJurnal[]; planificate: RandJurnal[] } {
  const toate = [...randuriDinAplicari(input.aplicari), ...randuriDinActivitati(input.activitati)]
  const facute = toate
    .filter((rand) => rand.stare === 'facut')
    .sort((a, b) => (b.zi ?? '').localeCompare(a.zi ?? '') || b.createdAt.localeCompare(a.createdAt))
  const planificate = toate
    .filter((rand) => rand.stare === 'planificat')
    .sort((a, b) => (a.zi ?? '9999').localeCompare(b.zi ?? '9999') || a.createdAt.localeCompare(b.createdAt))
  return { facute, planificate }
}

/** Planificatele dintr-o zi (Acasă: „De făcut azi”). */
export function planificateInZi(planificate: readonly RandJurnal[], zi: string): RandJurnal[] {
  return planificate.filter((rand) => rand.zi === zi)
}

/** „Scala · Calciu foliar” sau „Switch 110 g · Calciu foliar 275 ml”. */
export function textProduse(produse: readonly ProdusJurnal[], cuCantitati = true): string {
  return produse.map((produs) => (cuCantitati && produs.cantitate ? `${produs.nume} ${produs.cantitate}` : produs.nume)).join(' · ')
}

/** „Maravilla 1, Maravilla 2” (până la 3 nume, apoi „+2”). */
export function textParcele(ids: readonly string[], nume: ReadonlyMap<string, string>, totalParcele?: number): string {
  if (ids.length === 0) return 'Fără parcelă'
  if (totalParcele && totalParcele > 1 && ids.length === totalParcele) return 'Toate parcelele'
  const names = ids.map((id) => nume.get(id) ?? 'Parcelă ștearsă')
  return names.length <= 3 ? names.join(', ') : `${names.slice(0, 2).join(', ')} +${names.length - 2}`
}
