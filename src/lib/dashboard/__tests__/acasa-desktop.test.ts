import { describe, expect, it } from 'vitest'

import {
  aceeasiZiAnulTrecut,
  cifreSezon,
  comenziPeZile,
  perioadeSezon,
  procent,
  recoltaPeSaptamani,
  saptamanaIso,
  ultimeleInregistrari,
  type Inregistrare,
} from '@/lib/dashboard/acasa-desktop'
import type { DateRaport } from '@/lib/rapoarte/raport'

const AZI = '2026-08-15'

const rec = (data: string, kg1: number, parcela = 'p1') => ({ id: `${data}-${parcela}-${kg1}`, data, parcela_id: parcela, culegator_id: null, kg_cal1: kg1, kg_cal2: 0 })

const date = (extra: Partial<DateRaport> = {}): DateRaport => ({
  recoltari: [],
  vanzari: [],
  cheltuieli: [],
  butasi: [],
  investitii: [],
  parcele: [{ id: 'p1', nume_parcela: 'Maravilla', nr_plante: 100 }, { id: 'pp', nume_parcela: 'Grădina', rol: 'personal' }],
  culegatori: [],
  clienti: [],
  ...extra,
})

describe('Acasă pe desktop (promptul 35, §3)', () => {
  it('sezonul începe la prima recoltare din an; fără recoltări anul acesta, la 1 ianuarie', () => {
    expect(perioadeSezon(AZI, [rec('2026-06-20', 1), rec('2025-06-01', 1)]).curent).toEqual({ start: '2026-06-20', end: AZI })
    expect(perioadeSezon(AZI, [rec('2025-06-01', 1)]).curent.start).toBe('2026-01-01')
    expect(perioadeSezon(AZI, [rec('2025-06-01', 1), rec('2025-09-01', 1)]).anTrecut).toEqual({ start: '2025-06-01', end: '2025-08-15' })
    expect(aceeasiZiAnulTrecut('2028-02-29')).toBe('2027-02-28')
  })

  it('comparația doar când anul trecut are date', () => {
    expect(procent(118, 100)).toBe(18)
    expect(procent(50, 0)).toBeNull()
  })

  it('cifrele: recoltatul fără parcelele personale, venitul la încasare, de încasat din vânzări, comandatul din comenzile deschise', () => {
    const cifre = cifreSezon({
      todayIso: AZI,
      date: date({
        recoltari: [rec('2026-06-20', 100), rec('2026-07-01', 50, 'pp'), rec('2025-06-25', 80), rec('2025-09-01', 500)],
        vanzari: [
          { id: 'v1', data: '2026-07-01', client_id: null, cantitate_kg: 10, pret_lei_kg: 30, status_plata: 'platit', data_incasare: '2026-07-02' },
          { id: 'v0', data: '2025-07-01', client_id: null, cantitate_kg: 10, pret_lei_kg: 25, status_plata: 'platit', data_incasare: '2025-07-01' },
        ],
        cheltuieli: [{ id: 'c1', data: '2026-07-10', categorie: 'Tratamente', suma_lei: 100 }],
      }),
      vanzari: [
        { cantitate_kg: 10, pret_lei_kg: 30, status_plata: 'neplatit', suma_incasata_partial_lei: 50 },
        { cantitate_kg: 5, pret_lei_kg: 20, status_plata: 'platit', suma_incasata_partial_lei: null },
      ],
      comenzi: [
        { status: 'programata', cantitate_kg: 12 },
        { status: 'in_livrare', cantitate_kg: 3 },
        { status: 'livrata', cantitate_kg: 99 },
      ],
      peste30: 1,
    })
    expect(cifre.sumar.recoltatKg).toBe(100)
    expect(cifre.anTrecut.recoltatKg).toBe(80)
    expect(cifre.recoltatProcent).toBe(25)
    expect(cifre.sumar.incasat).toBe(300)
    expect(cifre.venitProcent).toBe(20)
    expect(cifre.sumar.cheltuieli).toBe(100)
    expect(cifre.sumar.profit).toBe(200)
    expect(cifre.deIncasatLei).toBe(250)
    expect(cifre.deIncasatPeste30).toBe(1)
    expect(cifre.comandatKg).toBe(15)
  })

  it('săptămânile ISO, inclusiv peste schimbarea anului', () => {
    expect(saptamanaIso('2026-01-01')).toEqual({ an: 2026, saptamana: 1 })
    expect(saptamanaIso('2027-01-01')).toEqual({ an: 2026, saptamana: 53 })
    expect(saptamanaIso('2026-08-15')).toEqual({ an: 2026, saptamana: 33 })
  })

  it('recolta pe săptămâni: de la prima până la cea de azi, cu anul trecut alături; pe o parcelă', () => {
    const recoltari = [rec('2026-08-03', 10), rec('2026-08-04', 5), rec('2026-08-14', 7, 'p2'), rec('2025-08-05', 3)]
    const toate = recoltaPeSaptamani(recoltari, AZI)
    expect(toate.map((s) => [s.eticheta, s.kg, s.kgAnTrecut])).toEqual([
      ['S32', 15, 3],
      ['S33', 7, 0],
    ])
    expect(recoltaPeSaptamani(recoltari, AZI, 'p2').map((s) => s.kg)).toEqual([0, 7])
    expect(recoltaPeSaptamani([rec('2025-08-05', 3)], AZI)).toEqual([])
    expect(recoltaPeSaptamani([rec('2026-08-03', 1)], AZI)[0].kgAnTrecut).toBeNull()
  })

  it('comenzile pe zile: azi cu restantele și cele în livrare, apoi zilele următoare', () => {
    const zile = comenziPeZile(
      [
        { status: 'programata', data_livrare: '2026-08-10', cantitate_kg: 4 },
        { status: 'in_livrare', data_livrare: '2026-08-15', cantitate_kg: 6 },
        { status: 'programata', data_livrare: '2026-08-16', cantitate_kg: 12 },
        { status: 'livrata', data_livrare: '2026-08-16', cantitate_kg: 99 },
      ],
      AZI,
      3,
    )
    expect(zile).toEqual([
      { ziua: '2026-08-15', count: 2, kg: 10 },
      { ziua: '2026-08-16', count: 1, kg: 12 },
      { ziua: '2026-08-17', count: 0, kg: 0 },
    ])
  })

  it('ultimele înregistrări: cele mai noi primele; operatorul nu vede încasări și cheltuieli', () => {
    const r = (tip: Inregistrare['tip'], ziua: string, creat = ''): Inregistrare => ({ tip, id: `${tip}${ziua}`, ziua, creat, titlu: tip, detaliu: '', href: '/' })
    const toate = [r('recoltare', '2026-08-10'), r('incasare', '2026-08-14'), r('tratament', '2026-08-12'), r('cheltuiala', '2026-08-13'), r('lucrare', '2026-08-12', 'z')]
    expect(ultimeleInregistrari({ proprietar: true, inregistrari: toate }, 3).map((i) => i.tip)).toEqual(['incasare', 'cheltuiala', 'lucrare'])
    expect(ultimeleInregistrari({ proprietar: false, inregistrari: toate }).map((i) => i.tip)).toEqual(['lucrare', 'tratament', 'recoltare'])
  })
})
