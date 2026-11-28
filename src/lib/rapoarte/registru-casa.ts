/**
 * Registrul de încasări și plăți pe o lună (promptul 35, §8). Încasările urmează regula de venit a Rapoartelor (suma
 * întreagă a vânzării la `data_incasare`, materialul săditor la data livrării); plățile = cheltuielile și investițiile.
 * Fără sold (nu știm casa de la început) și fără număr de document (nu există în caiet). Pur, testat.
 */
import { round2 } from '@/lib/format-ro'
import { butasiRevenueDate, type ButasiRevenueSource } from '@/lib/vanzari-butasi/revenue'
import { isVanzareIncasata, vanzareTotal } from '@/lib/vanzari/incasari'

import type { CheltuialaRaport, VanzareRaport } from './raport'
import type { InvestitieRaport } from './investitii'

export interface RandRegistruCasa {
  id: string
  data: string
  tip: 'incasare' | 'cheltuiala' | 'investitie'
  explicatie: string
  incasare: number
  plata: number
  /** Poza bonului / documentului, dacă există. */
  document: string | null
}

export interface RegistruCasa {
  luna: string
  randuri: RandRegistruCasa[]
  totalIncasari: number
  totalPlati: number
  diferenta: number
}

const zi = (value: string | null | undefined) => String(value ?? '').slice(0, 10)

type CheltuialaRegistru = CheltuialaRaport & { furnizor?: string | null; descriere?: string | null; document_url?: string | null }
type InvestitieRegistru = InvestitieRaport & { id?: string; furnizor?: string | null; descriere?: string | null; document_url?: string | null }
type ButasiRegistru = ButasiRevenueSource & { id?: string }

/** `2026-11` → înregistrările lunii, în ordinea zilelor (încasările înaintea plăților în aceeași zi). */
export function registruCasa(input: {
  luna: string
  vanzari: readonly VanzareRaport[]
  butasi: readonly ButasiRegistru[]
  cheltuieli: readonly CheltuialaRegistru[]
  investitii: readonly InvestitieRegistru[]
  numeClient: (clientId: string | null) => string
}): RegistruCasa {
  const randuri: RandRegistruCasa[] = []
  for (const vanzare of input.vanzari) {
    if (!isVanzareIncasata(vanzare.status_plata)) continue
    const ziua = zi(vanzare.data_incasare) || zi(vanzare.data)
    if (!ziua.startsWith(input.luna)) continue
    randuri.push({
      id: `v-${vanzare.id}`,
      data: ziua,
      tip: 'incasare',
      explicatie: `${input.numeClient(vanzare.client_id)} · ${Number(vanzare.cantitate_kg) || 0} kg`,
      incasare: vanzareTotal({ cantitate_kg: Number(vanzare.cantitate_kg) || 0, pret_lei_kg: Number(vanzare.pret_lei_kg) || 0 }),
      plata: 0,
      document: null,
    })
  }
  input.butasi.forEach((comanda, index) => {
    const ziua = butasiRevenueDate(comanda)
    if (!ziua || !ziua.startsWith(input.luna)) return
    randuri.push({ id: `b-${comanda.id ?? index}`, data: ziua, tip: 'incasare', explicatie: 'Material săditor livrat', incasare: round2(Number(comanda.total_lei) || 0), plata: 0, document: null })
  })
  for (const cheltuiala of input.cheltuieli) {
    if (!zi(cheltuiala.data).startsWith(input.luna)) continue
    randuri.push({
      id: `c-${cheltuiala.id}`,
      data: zi(cheltuiala.data),
      tip: 'cheltuiala',
      explicatie: [cheltuiala.furnizor?.trim() || cheltuiala.descriere?.trim(), cheltuiala.categorie].filter(Boolean).join(' · ') || 'Cheltuială',
      incasare: 0,
      plata: round2(Number(cheltuiala.suma_lei) || 0),
      document: cheltuiala.document_url ?? null,
    })
  }
  input.investitii.forEach((investitie, index) => {
    if (!zi(investitie.data).startsWith(input.luna)) return
    randuri.push({
      id: `i-${investitie.id ?? index}`,
      data: zi(investitie.data),
      tip: 'investitie',
      explicatie: ['Investiție', investitie.furnizor?.trim() || investitie.descriere?.trim(), investitie.categorie].filter(Boolean).join(' · '),
      incasare: 0,
      plata: round2(Number(investitie.suma_lei) || 0),
      document: investitie.document_url ?? null,
    })
  })
  randuri.sort((a, b) => a.data.localeCompare(b.data) || Number(a.tip !== 'incasare') - Number(b.tip !== 'incasare'))
  const totalIncasari = round2(randuri.reduce((sum, rand) => sum + rand.incasare, 0))
  const totalPlati = round2(randuri.reduce((sum, rand) => sum + rand.plata, 0))
  return { luna: input.luna, randuri, totalIncasari, totalPlati, diferenta: round2(totalIncasari - totalPlati) }
}

/** Lunile cu mișcări, de la cea mai nouă (pentru alegerea lunii), cu luna curentă mereu prima. */
export function luniCuMiscari(aziIso: string, zile: readonly (string | null | undefined)[]): string[] {
  const luni = new Set<string>([aziIso.slice(0, 7)])
  for (const ziua of zile) {
    const luna = zi(ziua).slice(0, 7)
    if (/^\d{4}-\d{2}$/.test(luna)) luni.add(luna)
  }
  return [...luni].sort((a, b) => b.localeCompare(a))
}
