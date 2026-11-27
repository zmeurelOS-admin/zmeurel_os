/**
 * Registrul de tratamente pentru o perioadă (Rapoarte → Exportă). Funcție pură.
 * Ambele surse, ca în jurnalul Tratamente:
 * - aplicările noi făcute (`aplicari_tratament`, status `aplicata`), câte un rând pe parcelă și produs;
 * - activitățile vechi de tip tratament (`activitati_agricole`, după `tipDinActivitateVeche`), câte un rând.
 * Pauza și ziua de la care se poate recolta: aceeași regulă ca peste tot (`lib/tratamente/pauza`, zile întregi).
 */
import { formatCantitate, formatKgTratament, type UnitateProdus } from '@/lib/tratamente/doze'
import { afisareSol } from '@/lib/tratamente/sol'
import {
  ETICHETA_TIP,
  tipDinActivitateVeche,
  tipDinAplicare,
  type ActivitateVeche,
  type AplicareProdusRow,
  type AplicareRow,
} from '@/lib/tratamente/model'
import { adaugaZile, ziuaRo } from '@/lib/tratamente/zile'

export interface RandRegistru {
  /** `2026-07-15` */
  data: string
  parcela: string
  metoda: string
  produs: string
  substanta: string
  doza: string
  cantitate: string
  /** Zile de pauză (0 = fără). */
  pauzaZile: number
  /** Prima zi în care se poate recolta; gol fără pauză. */
  recoltarePermisa: string
  /** Din Activități, notat înainte de modulul Tratamente. */
  importat: boolean
}

const numar = (value: unknown): number | null => {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? n : null
}
const fmt = (n: number) => new Intl.NumberFormat('ro-RO', { maximumFractionDigits: 2 }).format(n)
const zilePozitive = (value: unknown) => {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0
}

function dozaProdus(produs: Pick<AplicareProdusRow, 'doza_ml_per_hl' | 'doza_l_per_ha' | 'doza_g_per_planta' | 'unitate_cantitate'>): string {
  const parti: string[] = []
  const hl = numar(produs.doza_ml_per_hl)
  const ha = numar(produs.doza_l_per_ha)
  const gpl = numar(produs.doza_g_per_planta)
  if (hl !== null) parti.push(`${fmt(hl)} ml/hl`)
  // La ha, pulberea se scrie în kg/ha (aceeași coloană): eticheta după unitatea produsului (promptul 34, §8).
  if (ha !== null) parti.push(`${fmt(ha)} ${produs.unitate_cantitate === 'g' || produs.unitate_cantitate === 'kg' ? 'kg' : 'l'}/ha`)
  if (gpl !== null) parti.push(`${fmt(gpl)} g/plantă`)
  return parti.join(' · ')
}

function cantitateProdus(produs: Pick<AplicareProdusRow, 'cantitate_totala' | 'unitate_cantitate' | 'cantitate_text'>): string {
  const total = numar(produs.cantitate_totala)
  if (total !== null) {
    if (produs.unitate_cantitate === 'ml' || produs.unitate_cantitate === 'g') return formatCantitate(total, produs.unitate_cantitate as UnitateProdus)
    if (produs.unitate_cantitate === 'kg') return formatKgTratament(total)
    if (produs.unitate_cantitate === 'l') return `${fmt(total)} l`
    return `${fmt(total)}${produs.unitate_cantitate ? ` ${produs.unitate_cantitate}` : ''}`
  }
  return produs.cantitate_text?.trim() || ''
}

/** La sol: cantitatea și doza în unitatea aleasă la salvare (t sau kg, pe parcele sau la ha), promptul 34, §8. */
function dozaSiCantitateSol(produs: AplicareProdusRow): { doza: string; cantitate: string } {
  const sol = afisareSol({
    cantitateBaza: numar(produs.cantitate_totala),
    unitateBaza: produs.unitate_cantitate,
    cantitateText: produs.cantitate_text,
    dozaHaBaza: numar(produs.doza_l_per_ha),
  })
  return { doza: sol.doza ?? '', cantitate: sol.cantitate ?? (produs.cantitate_text?.trim() || '') }
}

/** Produsele unei aplicări; aplicările vechi din plan au produsul doar în antet. */
function produseAplicare(aplicare: AplicareRow): AplicareProdusRow[] {
  if (aplicare.produse.length > 0) return [...aplicare.produse].sort((a, b) => a.ordine - b.ordine)
  if (!aplicare.produs && !aplicare.produs_nume_manual) return []
  return [
    {
      id: aplicare.id,
      ordine: 1,
      produs_id: aplicare.produs_id,
      produs_nume_manual: aplicare.produs_nume_manual,
      produs_nume_snapshot: aplicare.produs?.nume_comercial ?? aplicare.produs_nume_manual ?? 'Produs',
      substanta_activa_snapshot: aplicare.produs?.substanta_activa ?? null,
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
}

export function registruTratamente(input: {
  aplicari: readonly AplicareRow[]
  activitati: readonly ActivitateVeche[]
  numeParcele: ReadonlyMap<string, string>
  /** Substanța activă din catalog, după `produs_id`, când rândul aplicării nu are snapshot. */
  substantePeProdus?: ReadonlyMap<string, string>
  start: string
  end: string
}): RandRegistru[] {
  const { start, end, numeParcele } = input
  const substanta = (produs: AplicareProdusRow) =>
    produs.substanta_activa_snapshot?.trim() || (produs.produs_id ? input.substantePeProdus?.get(produs.produs_id)?.trim() : '') || ''
  const parcela = (id: string | null) => (id ? (numeParcele.get(id) ?? 'Parcelă ștearsă') : 'Fără parcelă')
  const randuri: RandRegistru[] = []

  for (const aplicare of input.aplicari) {
    if (aplicare.status !== 'aplicata') continue
    const data = ziuaRo(aplicare.data_aplicata) ?? ziuaRo(aplicare.data_planificata)
    if (!data || data < start || data > end) continue
    const tip = tipDinAplicare(aplicare)
    const metoda = ETICHETA_TIP[tip]
    const produse = produseAplicare(aplicare)
    for (const produs of produse.length > 0 ? produse : [null]) {
      const pauzaZile = produs ? zilePozitive(produs.phi_zile_snapshot) : 0
      const sol = produs && tip === 'sol' ? dozaSiCantitateSol(produs) : null
      randuri.push({
        data,
        parcela: parcela(aplicare.parcela_id),
        metoda,
        produs: produs ? produs.produs_nume_snapshot?.trim() || produs.produs_nume_manual?.trim() || 'Produs' : '',
        substanta: produs ? substanta(produs) : '',
        doza: sol ? sol.doza : produs ? dozaProdus(produs) : '',
        cantitate: sol ? sol.cantitate : produs ? cantitateProdus(produs) : '',
        pauzaZile,
        recoltarePermisa: pauzaZile > 0 ? adaugaZile(data, pauzaZile) : '',
        importat: false,
      })
    }
  }

  for (const activitate of input.activitati) {
    const tip = tipDinActivitateVeche(activitate.tip_activitate)
    if (!tip) continue
    const data = ziuaRo(activitate.data_aplicare)
    if (!data || data < start || data > end) continue
    const pauzaZile = zilePozitive(activitate.timp_pauza_zile)
    randuri.push({
      data,
      parcela: parcela(activitate.parcela_id),
      metoda: ETICHETA_TIP[tip],
      produs: activitate.produs_utilizat?.trim() || activitate.tip_activitate?.trim() || '',
      substanta: '',
      doza: activitate.doza?.trim() || '',
      cantitate: '',
      pauzaZile,
      recoltarePermisa: pauzaZile > 0 ? adaugaZile(data, pauzaZile) : '',
      importat: true,
    })
  }

  return randuri.sort((a, b) => a.data.localeCompare(b.data) || a.parcela.localeCompare(b.parcela, 'ro'))
}
