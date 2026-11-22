/**
 * Tratamentele din cele 30 de zile dinainte de prelevare, pe parcelele analizei, din registrul de tratamente
 * (aplicările noi + tratamentele vechi din Activități). Pentru fiecare: „pauza respectată ✓” sau avertizare.
 * Funcție pură: o folosesc fișa analizei, raportul din aplicație și pagina publică.
 */
import { ETICHETA_TIP, tipDinActivitateVeche, tipDinAplicare, type AplicareProdusRow } from '@/lib/tratamente/model'
import { pauzaAplicarii } from '@/lib/tratamente/pauza'
import { adaugaZile, ziuaRo } from '@/lib/tratamente/zile'

export const ZILE_INAINTE_DE_PRELEVARE = 30

export type AplicarePentruAnaliza = {
  id: string
  parcela_id: string
  status: string
  data_aplicata: string | null
  metoda_aplicare: string | null
  lot_id?: string | null
  produs_nume_manual?: string | null
  produs?: { nume_comercial?: string | null; phi_zile?: number | null; tip?: string | null } | null
  produse?: ReadonlyArray<Pick<AplicareProdusRow, 'produs_nume_snapshot' | 'phi_zile_snapshot' | 'tip_snapshot'>> | null
}

export type ActivitatePentruAnaliza = {
  id: string
  parcela_id: string | null
  data_aplicare: string
  tip_activitate: string | null
  produs_utilizat: string | null
  timp_pauza_zile: number | null
}

export interface TratamentInainte {
  key: string
  zi: string
  /** „Switch 62.5 WG” sau „Switch 62.5 WG, Karate Zeon”; fără produse, metoda („Fertirigare”). */
  nume: string
  parcelaIds: string[]
  pauzaZile: number
  /** Prima zi de recoltare permisă după tratament (`null` fără pauză). */
  pauzaPanaLa: string | null
  /** Pauza s-a încheiat până în ziua prelevării (sau nu există pauză). */
  respectata: boolean
}

/** „pauza de 7 zile respectată”, „fără pauză”, „pauza de 14 zile NU era încheiată la prelevare”. */
export function textPauzaInainte(tratament: Pick<TratamentInainte, 'pauzaZile' | 'respectata'>): string {
  if (tratament.pauzaZile <= 0) return 'fără pauză'
  const zile = tratament.pauzaZile === 1 ? '1 zi' : tratament.pauzaZile >= 20 ? `${tratament.pauzaZile} de zile` : `${tratament.pauzaZile} zile`
  return tratament.respectata ? `pauza de ${zile} respectată` : `pauza de ${zile} nu era încheiată la prelevare`
}

export function tratamenteInaintePrelevare(input: {
  aplicari: readonly AplicarePentruAnaliza[]
  activitati?: readonly ActivitatePentruAnaliza[]
  parcelaIds: readonly string[]
  dataPrelevare: string
  zile?: number
}): TratamentInainte[] {
  const parcele = new Set(input.parcelaIds)
  const de = adaugaZile(input.dataPrelevare, -(input.zile ?? ZILE_INAINTE_DE_PRELEVARE))
  const pana = input.dataPrelevare
  const grupuri = new Map<string, TratamentInainte>()

  const adauga = (cheieGrup: string, zi: string, nume: string, parcelaId: string, pauzaZile: number) => {
    const existent = grupuri.get(cheieGrup)
    if (existent) {
      if (!existent.parcelaIds.includes(parcelaId)) existent.parcelaIds.push(parcelaId)
      return
    }
    const pauzaPanaLa = pauzaZile > 0 ? adaugaZile(zi, pauzaZile) : null
    grupuri.set(cheieGrup, {
      key: cheieGrup,
      zi,
      nume,
      parcelaIds: [parcelaId],
      pauzaZile,
      pauzaPanaLa,
      respectata: pauzaPanaLa === null || pauzaPanaLa <= pana,
    })
  }

  for (const aplicare of input.aplicari) {
    if (aplicare.status !== 'aplicata' || !parcele.has(aplicare.parcela_id)) continue
    const zi = ziuaRo(aplicare.data_aplicata)
    if (!zi || zi < de || zi > pana) continue
    const produse = aplicare.produse ?? []
    const numeProduse = produse.length
      ? produse.map((produs) => produs.produs_nume_snapshot?.trim()).filter(Boolean)
      : [aplicare.produs?.nume_comercial?.trim() || aplicare.produs_nume_manual?.trim()].filter(Boolean)
    const nume =
      (numeProduse as string[]).join(', ') ||
      ETICHETA_TIP[tipDinAplicare({ metoda_aplicare: aplicare.metoda_aplicare, produs: (aplicare.produs ?? null) as never, produse: produse as never })]
    const { zile } = pauzaAplicarii({ produse: produse as never, produs: aplicare.produs ?? null, produs_nume_manual: aplicare.produs_nume_manual ?? null })
    adauga(aplicare.lot_id ? `lot:${aplicare.lot_id}` : `ap:${zi}:${nume}`, zi, nume, aplicare.parcela_id, zile)
  }

  for (const activitate of input.activitati ?? []) {
    if (!activitate.parcela_id || !parcele.has(activitate.parcela_id)) continue
    const tip = tipDinActivitateVeche(activitate.tip_activitate)
    if (!tip) continue
    const zi = ziuaRo(activitate.data_aplicare)
    if (!zi || zi < de || zi > pana) continue
    const nume = activitate.produs_utilizat?.trim() || ETICHETA_TIP[tip]
    const zile = Math.max(0, Math.floor(Number(activitate.timp_pauza_zile) || 0))
    adauga(`act:${zi}:${nume}`, zi, nume, activitate.parcela_id, zile)
  }

  return [...grupuri.values()].sort((a, b) => b.zi.localeCompare(a.zi) || a.nume.localeCompare(b.nume, 'ro'))
}
