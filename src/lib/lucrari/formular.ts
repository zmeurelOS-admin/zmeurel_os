/**
 * Formularul „Lucrare nouă”, fără React: ce a ales omul și rândurile de salvat în `activitati_agricole`
 * (un rând pe parcelă, fiecare cu `client_sync_id` propriu; toate cu același lot = cheia formularului).
 */
import { VALOARE_LUCRARE_DB, type TipLucrare } from './tipuri'

export type CandLucrare = { tip: 'azi' } | { tip: 'alta_zi'; zi: string } | { tip: 'planifica'; zi: string }

/** „Cine” e opțional; proprietarul se scrie „Proprietarul” și se arată „Tu” proprietarului. */
export const CINE_PROPRIETAR = 'Proprietarul'

export interface CiornaLucrare {
  tip: TipLucrare | null
  parcelaIds: string[]
  cine: string
  nota: string
}

export const CIORNA_GOALA: CiornaLucrare = { tip: null, parcelaIds: [], cine: '', nota: '' }

export interface RandLucrareDeSalvat {
  client_sync_id: string
  parcela_id: string
  data_aplicare: string
  tip_activitate: string
  operator: string | null
  observatii: string | null
  timp_pauza_zile: 0
  /** Doar după migrare (altfel nu se trimit). */
  status?: 'planificata' | null
  lot_id?: string
}

/** Momentul salvat: „azi” = acum; o altă zi = ora 12 UTC (aceeași zi și în ora României). */
export function dataAplicare(cand: CandLucrare, now: Date = new Date()): string {
  if (cand.tip === 'azi') return now.toISOString()
  return `${cand.zi}T12:00:00.000Z`
}

export function ceLipsesteLucrare(ciorna: CiornaLucrare): 'tip' | 'parcele' | null {
  if (!ciorna.tip) return 'tip'
  if (ciorna.parcelaIds.length === 0) return 'parcele'
  return null
}

/**
 * Rândurile de inserat. `chei` = cheia fiecărei parcele, aceeași la reîncercare (altfel o reîncercare după o
 * eroare de rețea ar dubla rândurile). `cuMigrare` = coloanele `status` / `lot_id` există.
 */
export function randuriLucrareDeSalvat(input: {
  ciorna: CiornaLucrare
  cand: CandLucrare
  chei: ReadonlyMap<string, string>
  lotId: string
  cuMigrare: boolean
  now?: Date
}): RandLucrareDeSalvat[] {
  const { ciorna, cand, chei, lotId, cuMigrare } = input
  if (!ciorna.tip) return []
  if (cand.tip === 'planifica' && !cuMigrare) return []
  const data = dataAplicare(cand, input.now)
  const cine = ciorna.cine.trim() || null
  const nota = ciorna.nota.trim() || null
  return [...new Set(ciorna.parcelaIds)].map((parcelaId) => {
    const cheie = chei.get(parcelaId)
    if (!cheie) throw new Error(`Lipsește cheia pentru parcela ${parcelaId}`)
    const rand: RandLucrareDeSalvat = {
      client_sync_id: cheie,
      parcela_id: parcelaId,
      data_aplicare: data,
      tip_activitate: VALOARE_LUCRARE_DB[ciorna.tip as TipLucrare],
      operator: cine,
      observatii: nota,
      timp_pauza_zile: 0,
    }
    if (cuMigrare) {
      rand.status = cand.tip === 'planifica' ? 'planificata' : null
      rand.lot_id = lotId
    }
    return rand
  })
}

/** „Tu” pentru proprietar (doar cine nu e operator), altfel numele scris. */
export function textCine(cine: string | null | undefined, vedeProprietarul: boolean): string | null {
  const value = String(cine ?? '').trim()
  if (!value) return null
  if (value === CINE_PROPRIETAR && vedeProprietarul) return 'Tu'
  return value
}
