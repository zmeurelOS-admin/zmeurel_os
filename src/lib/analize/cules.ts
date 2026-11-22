/**
 * Când începe culesul pe o parcelă, în sezonul `an`. Ordinea surselor:
 *   1. data pusă de mână pe fișa parcelei (`configurari_parcela_sezon.data_inceput_cules`, pe sezon);
 *   2. ziua primei recoltări de anul trecut pe parcelă, mutată în anul curent;
 *   3. nimic: fișa cere „Pune data culesului”.
 *
 * Ajustarea după stadiul fenologic NU se face: `stadii_fenologice_parcela` ține doar stadiul și ziua observată,
 * fără durate pe soi, deci nu există o regulă clară (notat în raportul promptului 26).
 * Funcții pure.
 */

export type SursaCules = 'manual' | 'anul_trecut'

export interface EstimareCules {
  parcelaId: string
  /** Ziua estimată (`YYYY-MM-DD`) sau `null` (nu știm: „Pune data culesului”). */
  data: string | null
  sursa: SursaCules | null
  /** Pentru textul „din prima recoltare din 2025 (24 iun.)”. */
  primaRecoltareAnTrecut: string | null
}

/** `2025-06-24` → `2026-06-24`; 29 februarie → 28 februarie într-un an fără zi bisectă. */
export function mutaInAnul(ziua: string, an: number): string {
  const luna = Number(ziua.slice(5, 7))
  let zi = Number(ziua.slice(8, 10))
  if (luna === 2 && zi === 29) {
    const bisect = (an % 4 === 0 && an % 100 !== 0) || an % 400 === 0
    if (!bisect) zi = 28
  }
  return `${an}-${String(luna).padStart(2, '0')}-${String(zi).padStart(2, '0')}`
}

/** Prima recoltare a parcelei în anul `an` (sau `null`). */
export function primaRecoltareInAn(recoltari: ReadonlyArray<{ parcela_id: string | null; data: string }>, parcelaId: string, an: number): string | null {
  const prefix = `${an}-`
  let prima: string | null = null
  for (const recoltare of recoltari) {
    if (recoltare.parcela_id !== parcelaId) continue
    const zi = String(recoltare.data ?? '').slice(0, 10)
    if (!zi.startsWith(prefix)) continue
    if (prima === null || zi < prima) prima = zi
  }
  return prima
}

export function estimeazaCules(input: {
  parcelaId: string
  an: number
  /** Data pusă de mână pentru sezonul `an`. */
  manual?: string | null
  recoltari: ReadonlyArray<{ parcela_id: string | null; data: string }>
}): EstimareCules {
  const primaRecoltareAnTrecut = primaRecoltareInAn(input.recoltari, input.parcelaId, input.an - 1)
  const manual = input.manual?.trim().slice(0, 10) || null
  if (manual && /^\d{4}-\d{2}-\d{2}$/.test(manual)) {
    return { parcelaId: input.parcelaId, data: manual, sursa: 'manual', primaRecoltareAnTrecut }
  }
  if (primaRecoltareAnTrecut) {
    return { parcelaId: input.parcelaId, data: mutaInAnul(primaRecoltareAnTrecut, input.an), sursa: 'anul_trecut', primaRecoltareAnTrecut }
  }
  return { parcelaId: input.parcelaId, data: null, sursa: null, primaRecoltareAnTrecut: null }
}

/** Estimările pentru mai multe parcele (cheia: `parcelaId`). */
export function estimeazaCulesParcele(input: {
  parcelaIds: readonly string[]
  an: number
  manuale: ReadonlyMap<string, string | null>
  recoltari: ReadonlyArray<{ parcela_id: string | null; data: string }>
}): Map<string, EstimareCules> {
  const rezultat = new Map<string, EstimareCules>()
  for (const parcelaId of input.parcelaIds) {
    rezultat.set(parcelaId, estimeazaCules({ parcelaId, an: input.an, manual: input.manuale.get(parcelaId) ?? null, recoltari: input.recoltari }))
  }
  return rezultat
}
