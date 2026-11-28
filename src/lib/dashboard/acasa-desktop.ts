/**
 * Acasă pe desktop (promptul 35, §3): cifrele sezonului cu comparația față de anul trecut, recolta pe săptămâni,
 * comenzile pe zilele următoare și ultimele înregistrări. Funcții pure, testate. Regulile vin din locurile lor:
 * sezonul din `lib/sezon` (prima recoltare din an), venitul și cheltuielile din `sumarRaport` (Rapoarte).
 */
import { bucketOfComanda, isComandaDeschisa } from '@/lib/comenzi/day-view'
import { round2 } from '@/lib/format-ro'
import { sumarRaport, type DateRaport, type SumarRaport } from '@/lib/rapoarte/raport'
import { inceputSezon, inceputSezonAn } from '@/lib/sezon'
import type { Comanda } from '@/lib/supabase/queries/comenzi'
import { vanzareRest } from '@/lib/vanzari/incasari'
import type { Vanzare } from '@/lib/supabase/queries/vanzari'

const zi = (value: string | null | undefined) => String(value ?? '').slice(0, 10)

/** Aceeași zi cu un an în urmă (29 februarie → 28 februarie). */
export function aceeasiZiAnulTrecut(iso: string): string {
  const an = Number(iso.slice(0, 4)) - 1
  const lunaZi = iso.slice(5) === '02-29' ? '02-28' : iso.slice(5)
  return `${an}-${lunaZi}`
}

export interface PerioadaSezon {
  start: string
  end: string
}

/** Sezonul curent (prima recoltare din an → azi) și aceeași bucată din sezonul de anul trecut. */
export function perioadeSezon(todayIso: string, recoltari: readonly { data: string | null }[]): { curent: PerioadaSezon; anTrecut: PerioadaSezon } {
  const endTrecut = aceeasiZiAnulTrecut(todayIso)
  return {
    curent: { start: inceputSezon(todayIso, recoltari), end: todayIso },
    anTrecut: { start: inceputSezonAn(Number(todayIso.slice(0, 4)) - 1, recoltari, endTrecut), end: endTrecut },
  }
}

/** Schimbarea procentuală; `null` dacă anul trecut n-are date (nu comparăm cu zero). */
export function procent(curent: number, trecut: number): number | null {
  if (!(trecut > 0)) return null
  return Math.round(((curent - trecut) / trecut) * 100)
}

export interface CifreSezon {
  sumar: SumarRaport
  anTrecut: SumarRaport
  venitProcent: number | null
  recoltatProcent: number | null
  /** De încasat: restul vânzărilor neîncasate (comenzile livrate au vânzarea lor). */
  deIncasatLei: number
  deIncasatPeste30: number
  /** Kg în comenzile deschise. */
  comandatKg: number
}

export function cifreSezon(input: {
  todayIso: string
  date: DateRaport
  vanzari: readonly Pick<Vanzare, 'cantitate_kg' | 'pret_lei_kg' | 'status_plata' | 'suma_incasata_partial_lei'>[]
  comenzi: readonly Pick<Comanda, 'status' | 'cantitate_kg'>[]
  /** Câte comenzi sunt neîncasate de peste 30 de zile (din `neincasatePeste30`). */
  peste30: number
}): CifreSezon {
  const { curent, anTrecut } = perioadeSezon(input.todayIso, input.date.recoltari)
  const sumar = sumarRaport(input.date, curent)
  const trecut = sumarRaport(input.date, anTrecut)
  return {
    sumar,
    anTrecut: trecut,
    venitProcent: procent(sumar.incasat, trecut.incasat),
    recoltatProcent: procent(sumar.recoltatKg, trecut.recoltatKg),
    deIncasatLei: round2(input.vanzari.reduce((sum, vanzare) => sum + vanzareRest(vanzare), 0)),
    deIncasatPeste30: input.peste30,
    comandatKg: round2(input.comenzi.filter(isComandaDeschisa).reduce((sum, comanda) => sum + (Number(comanda.cantitate_kg) || 0), 0)),
  }
}

// ─── Săptămânile ────────────────────────────────────────────────────────────────

/** Săptămâna ISO (luni–duminică) a unei zile: anul săptămânii și numărul ei. */
export function saptamanaIso(iso: string): { an: number; saptamana: number } {
  const [an, luna, z] = iso.split('-').map(Number)
  const data = new Date(Date.UTC(an, luna - 1, z))
  const ziSapt = data.getUTCDay() || 7
  data.setUTCDate(data.getUTCDate() + 4 - ziSapt)
  const inceputAn = new Date(Date.UTC(data.getUTCFullYear(), 0, 1))
  return { an: data.getUTCFullYear(), saptamana: Math.ceil(((data.getTime() - inceputAn.getTime()) / 86_400_000 + 1) / 7) }
}

export interface SaptamanaRecolta {
  /** `2026-S24` */
  cheie: string
  /** `S24` */
  eticheta: string
  kg: number
  /** Aceeași săptămână de anul trecut; `null` = anul trecut n-a avut deloc recoltări în perioada lui. */
  kgAnTrecut: number | null
}

type RecoltareKg = { data: string | null; parcela_id?: string | null; kg_cal1?: number | null; kg_cal2?: number | null }
const kg = (recoltare: RecoltareKg) => (Number(recoltare.kg_cal1) || 0) + (Number(recoltare.kg_cal2) || 0)

/**
 * Kg pe săptămânile sezonului curent (de la săptămâna primei recoltări până la cea de azi), cu aceeași săptămână de
 * anul trecut alături. `parcelaId` = doar o parcelă. Fără recoltări în sezon: listă goală.
 */
export function recoltaPeSaptamani(recoltari: readonly RecoltareKg[], todayIso: string, parcelaId?: string): SaptamanaRecolta[] {
  const ale = parcelaId ? recoltari.filter((recoltare) => recoltare.parcela_id === parcelaId) : recoltari
  const { curent, anTrecut } = perioadeSezon(todayIso, recoltari)
  const anCurent = Number(todayIso.slice(0, 4))
  const peSaptamana = (start: string, end: string) => {
    const harta = new Map<number, number>()
    for (const recoltare of ale) {
      const ziua = zi(recoltare.data)
      if (!ziua || ziua < start || ziua > end) continue
      const { saptamana } = saptamanaIso(ziua)
      harta.set(saptamana, (harta.get(saptamana) ?? 0) + kg(recoltare))
    }
    return harta
  }
  const acum = peSaptamana(curent.start, curent.end)
  if (acum.size === 0) return []
  const trecut = peSaptamana(`${anCurent - 1}-01-01`, `${anCurent - 1}-12-31`)
  const areTrecut = [...peSaptamana(anTrecut.start, `${anCurent - 1}-12-31`).values()].some((valoare) => valoare > 0)
  // Începutul e săptămâna începutului de sezon al fermei (și pentru o parcelă care a început mai târziu).
  const prima = Math.min(saptamanaIso(curent.start).saptamana, ...acum.keys())
  const ultima = saptamanaIso(todayIso).an === anCurent ? saptamanaIso(todayIso).saptamana : Math.max(...acum.keys())
  const rezultat: SaptamanaRecolta[] = []
  for (let s = prima; s <= Math.max(prima, ultima); s += 1) {
    rezultat.push({
      cheie: `${anCurent}-S${s}`,
      eticheta: `S${s}`,
      kg: round2(acum.get(s) ?? 0),
      kgAnTrecut: areTrecut ? round2(trecut.get(s) ?? 0) : null,
    })
  }
  return rezultat
}

// ─── Comenzile pe zile ──────────────────────────────────────────────────────────

export interface ZiComenzi {
  ziua: string
  count: number
  kg: number
}

/** Comenzile deschise pe azi + următoarele `zile − 1` zile (pe „azi” și restantele, ca pe telefon). */
export function comenziPeZile(comenzi: readonly Pick<Comanda, 'status' | 'data_livrare' | 'cantitate_kg'>[], todayIso: string, zile = 7): ZiComenzi[] {
  const rezultat: ZiComenzi[] = []
  const [an, luna, z] = todayIso.split('-').map(Number)
  for (let i = 0; i < zile; i += 1) {
    const ziua = new Date(Date.UTC(an, luna - 1, z + i)).toISOString().slice(0, 10)
    const aleZilei = comenzi.filter((comanda) =>
      i === 0 ? bucketOfComanda(comanda, todayIso) === 'azi' : isComandaDeschisa(comanda) && comanda.status !== 'in_livrare' && zi(comanda.data_livrare) === ziua,
    )
    rezultat.push({ ziua, count: aleZilei.length, kg: round2(aleZilei.reduce((sum, comanda) => sum + (Number(comanda.cantitate_kg) || 0), 0)) })
  }
  return rezultat
}

// ─── Ultimele înregistrări ──────────────────────────────────────────────────────

export type TipInregistrare = 'recoltare' | 'tratament' | 'lucrare' | 'incasare' | 'cheltuiala'

export interface Inregistrare {
  tip: TipInregistrare
  id: string
  ziua: string
  /** Pentru ordinea în aceeași zi. */
  creat: string
  titlu: string
  detaliu: string
  href: string
}

/**
 * Ultimele `n` înregistrări din recoltări, tratamente, lucrări și — doar la proprietar — încasări și cheltuieli.
 * Ordinea: ziua, apoi momentul notării, cele mai noi primele.
 */
export function ultimeleInregistrari(surse: { proprietar: boolean; inregistrari: readonly Inregistrare[] }, n = 6): Inregistrare[] {
  return surse.inregistrari
    .filter((item) => surse.proprietar || (item.tip !== 'incasare' && item.tip !== 'cheltuiala'))
    .filter((item) => Boolean(item.ziua))
    .sort((a, b) => b.ziua.localeCompare(a.ziua) || b.creat.localeCompare(a.creat))
    .slice(0, n)
}
