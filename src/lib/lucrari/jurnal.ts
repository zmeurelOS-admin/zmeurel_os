/**
 * Jurnalul de lucrări: rândurile din `activitati_agricole` care nu sunt tratamente, grupate pe salvare
 * (aceeași lucrare pe mai multe parcele = un rând pe parcelă în tabel, un singur rând în jurnal).
 *
 * Gruparea:
 * - după migrarea `20261121180000`: pe `lot_id` (cheia formularului), exact;
 * - rândurile fără lot (vechi sau salvate înainte de migrare): aceeași zi, același tip, același „cine”,
 *   aceeași notă și aceeași stare, salvate la cel mult un minut unul de altul.
 * Fără React și fără Supabase.
 */
import { ziuaRo } from '@/lib/tratamente/zile'

import { textAltele, tipLucrareDin, tipOriginalPentruAltele, type TipLucrare } from './tipuri'

export type StareLucrare = 'facuta' | 'planificata'

/** Un rând din `activitati_agricole`, cât îi trebuie jurnalului. */
export interface LucrareRow {
  id: string
  parcela_id: string | null
  data_aplicare: string
  tip_activitate: string | null
  operator: string | null
  observatii: string | null
  created_at: string
  /** Doar după migrarea `20261121180000`. */
  status?: string | null
  lot_id?: string | null
}

export interface RandLucrare {
  key: string
  stare: StareLucrare
  tip: TipLucrare
  /** Textul vechi când tipul e „Altele” și rândul spune mai mult („Recoltare”). */
  tipOriginal: string | null
  /** „Altele: <text>” (promptul 34, §7): textul, care e titlul lucrării. */
  ceAiFacut: string | null
  /** Ziua lucrării (făcute) sau ziua planificată, în ora României. */
  zi: string | null
  parcelaIds: string[]
  cine: string | null
  nota: string | null
  /** Rândurile din tabel (unul pe parcelă). */
  randuri: LucrareRow[]
  lotId: string | null
  createdAt: string
}

const FEREASTRA_MS = 60_000

const text = (value: string | null | undefined) => {
  const trimmed = String(value ?? '').trim()
  return trimmed || null
}

/**
 * Starea unei lucrări. `'planificata'` după migrare; înainte (și la rândurile fără stare), o lucrare cu ziua după
 * `azi` e tot planificată (Acasă le arăta așa și înainte: „Lucrările planificate vin din Activități”).
 */
export function stareLucrare(row: Pick<LucrareRow, 'status' | 'data_aplicare'>, azi?: string | null): StareLucrare {
  if (row.status === 'planificata') return 'planificata'
  if (row.status === 'facuta') return 'facuta'
  const zi = ziuaRo(row.data_aplicare)
  return azi && zi && zi > azi ? 'planificata' : 'facuta'
}

/** Doar lucrările (tratamentele vechi ies: le arată Tratamente, „importate”). */
export function doarLucrari<T extends Pick<LucrareRow, 'tip_activitate'>>(rows: readonly T[]): T[] {
  return rows.filter((row) => tipLucrareDin(row.tip_activitate) !== null)
}

function cheieFaraTimp(row: LucrareRow, azi?: string | null): string {
  return [
    stareLucrare(row, azi),
    ziuaRo(row.data_aplicare) ?? '',
    tipLucrareDin(row.tip_activitate) ?? '',
    (row.tip_activitate ?? '').trim().toLocaleLowerCase('ro-RO'),
    (text(row.operator) ?? '').toLocaleLowerCase('ro-RO'),
    text(row.observatii) ?? '',
  ].join('|')
}

const momentul = (value: string) => {
  const time = Date.parse(String(value ?? '').replace(' ', 'T'))
  return Number.isFinite(time) ? time : 0
}

/** Grupează rândurile pe salvare. Ordinea în grup: după `created_at`. */
export function grupeazaLucrari(rows: readonly LucrareRow[], azi?: string | null): LucrareRow[][] {
  const grupuri: LucrareRow[][] = []
  const peLot = new Map<string, LucrareRow[]>()
  const fara: LucrareRow[] = []

  for (const row of rows) {
    if (row.lot_id) {
      const key = `${row.lot_id}:${stareLucrare(row, azi)}`
      const lista = peLot.get(key)
      if (lista) lista.push(row)
      else {
        const nou = [row]
        peLot.set(key, nou)
        grupuri.push(nou)
      }
    } else {
      fara.push(row)
    }
  }

  // Fără lot: după potrivire, în fereastra de un minut de la primul rând al grupului.
  const sortate = [...fara].sort((a, b) => momentul(a.created_at) - momentul(b.created_at) || a.id.localeCompare(b.id))
  const deschise = new Map<string, { start: number; rows: LucrareRow[] }>()
  for (const row of sortate) {
    const key = cheieFaraTimp(row, azi)
    const moment = momentul(row.created_at)
    const grup = deschise.get(key)
    if (grup && moment - grup.start <= FEREASTRA_MS && !grup.rows.some((item) => item.parcela_id === row.parcela_id)) {
      grup.rows.push(row)
      continue
    }
    const nou = { start: moment, rows: [row] }
    deschise.set(key, nou)
    grupuri.push(nou.rows)
  }

  return grupuri
}

export function randuriLucrari(rows: readonly LucrareRow[], azi?: string | null): RandLucrare[] {
  return grupeazaLucrari(doarLucrari(rows), azi).map((grup) => {
    const prima = [...grup].sort((a, b) => momentul(a.created_at) - momentul(b.created_at))[0]
    const tip = tipLucrareDin(prima.tip_activitate) ?? 'altele'
    return {
      key: prima.lot_id ? `lot:${prima.lot_id}:${stareLucrare(prima, azi)}` : `lucrare:${prima.id}`,
      stare: stareLucrare(prima, azi),
      tip,
      tipOriginal: tipOriginalPentruAltele(prima.tip_activitate),
      ceAiFacut: textAltele(prima.tip_activitate),
      zi: ziuaRo(prima.data_aplicare),
      parcelaIds: [...new Set(grup.map((row) => row.parcela_id).filter((id): id is string => Boolean(id)))],
      cine: text(prima.operator),
      nota: text(prima.observatii),
      randuri: grup,
      lotId: prima.lot_id ?? null,
      createdAt: prima.created_at,
    }
  })
}

/** Jurnalul întreg: făcutele de la cea mai nouă, planificatele de la cea mai apropiată. */
export function construiesteJurnalLucrari(rows: readonly LucrareRow[], azi?: string | null): { facute: RandLucrare[]; planificate: RandLucrare[] } {
  const toate = randuriLucrari(rows, azi)
  const facute = toate
    .filter((rand) => rand.stare === 'facuta')
    .sort((a, b) => (b.zi ?? '').localeCompare(a.zi ?? '') || b.createdAt.localeCompare(a.createdAt))
  const planificate = toate
    .filter((rand) => rand.stare === 'planificata')
    .sort((a, b) => (a.zi ?? '9999').localeCompare(b.zi ?? '9999') || a.createdAt.localeCompare(b.createdAt))
  return { facute, planificate }
}

/** Planificatele dintr-o zi (Acasă: „De făcut azi”). */
export function lucrariPlanificateInZi(planificate: readonly RandLucrare[], zi: string): RandLucrare[] {
  return planificate.filter((rand) => rand.zi === zi)
}

/** Planificatele rămase în urmă (ziua a trecut și n-au fost marcate făcute). */
export function lucrariIntarziate(planificate: readonly RandLucrare[], azi: string): RandLucrare[] {
  return planificate.filter((rand) => rand.zi !== null && rand.zi < azi)
}
