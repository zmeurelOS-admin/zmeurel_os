/**
 * Rapoarte (prompt 19): perioada, profitul, plăcile, graficul pe luni și listele pe parcele, culegători, clienți.
 * Funcții pure. Banii trec doar prin regulile existente: `ziuaVenitului` + `vanzareTotal` (venitul încasat),
 * `butasiRevenueDate` (material săditor livrat), `calculateProfit` (încasat − cheltuieli) și
 * `investitiiInPerioada` (separat, nu scade din profit).
 */
import { calculateProfit } from '@/lib/calculations/profit'
import { resolveCheltuialaCategorie } from '@/lib/financial/categories'
import { round2 } from '@/lib/format-ro'
import { normalizeParcelaRol } from '@/lib/parcele/dashboard-relevance'
import { investitiiInPerioada, type InvestitieRaport, type InvestitiiPerioada } from '@/lib/rapoarte/investitii'
import { inceputSezon } from '@/lib/sezon'
import { butasiRevenueDate, type ButasiRevenueSource } from '@/lib/vanzari-butasi/revenue'
import { vanzareTotal, ziuaVenitului } from '@/lib/vanzari/incasari'

export type TipPerioada = 'luna' | 'sezon' | 'an'

export interface RecoltareRaport {
  id: string
  data: string
  parcela_id: string | null
  culegator_id: string | null
  kg_cal1: number | null
  kg_cal2: number | null
  valoare_munca_lei?: number | null
}

export interface VanzareRaport {
  id: string
  data: string
  client_id: string | null
  cantitate_kg: number | null
  pret_lei_kg: number | null
  status_plata?: string | null
  data_incasare?: string | null
}

export interface CheltuialaRaport {
  id: string
  data: string
  categorie: string | null
  suma_lei: number | null
}

export interface ParcelaRaport {
  id: string
  nume_parcela: string | null
  nr_plante?: number | null
  rol?: string | null
}

export interface DateRaport {
  recoltari: readonly RecoltareRaport[]
  vanzari: readonly VanzareRaport[]
  cheltuieli: readonly CheltuialaRaport[]
  butasi: readonly ButasiRevenueSource[]
  investitii: readonly InvestitieRaport[]
  parcele: readonly ParcelaRaport[]
  culegatori: readonly { id: string; nume_prenume: string | null }[]
  clienti: readonly { id: string; nume_client: string | null }[]
}

const LUNI = ['ianuarie', 'februarie', 'martie', 'aprilie', 'mai', 'iunie', 'iulie', 'august', 'septembrie', 'octombrie', 'noiembrie', 'decembrie']
const LUNI_SCURT = ['ian', 'feb', 'mar', 'apr', 'mai', 'iun', 'iul', 'aug', 'sep', 'oct', 'nov', 'dec']

const zi = (value: string | null | undefined) => String(value ?? '').slice(0, 10)
const inInterval = (day: string, start: string, end: string) => Boolean(day) && day >= start && day <= end

export interface Perioada {
  tip: TipPerioada
  start: string
  end: string
  /** „în noiembrie 2026”, „în sezonul 2026”, „în 2026”. */
  eticheta: string
}

/** Luna curentă, sezonul curent (regula unică `inceputSezon`) sau anul curent, până azi inclusiv. */
export function perioadaRaport(tip: TipPerioada, azi: string, recoltari: readonly { data: string | null }[]): Perioada {
  const an = azi.slice(0, 4)
  if (tip === 'luna') {
    return { tip, start: `${azi.slice(0, 7)}-01`, end: azi, eticheta: `în ${LUNI[Number(azi.slice(5, 7)) - 1]} ${an}` }
  }
  if (tip === 'sezon') return { tip, start: inceputSezon(azi, recoltari), end: azi, eticheta: `în sezonul ${an}` }
  return { tip, start: `${an}-01-01`, end: azi, eticheta: `în ${an}` }
}

export const esteParcelaPersonala = (parcela: Pick<ParcelaRaport, 'rol'> | null | undefined) =>
  normalizeParcelaRol(parcela?.rol) === 'personal'

const kgRecoltare = (recoltare: RecoltareRaport) => (Number(recoltare.kg_cal1) || 0) + (Number(recoltare.kg_cal2) || 0)

/** Venitul încasat al unei vânzări în interval, sau 0 (aceeași regulă ca Acasă, Vânzări, Clienți). */
function incasatVanzare(vanzare: VanzareRaport, start: string, end: string): number {
  const ziua = ziuaVenitului({ status_plata: vanzare.status_plata ?? '', data_incasare: vanzare.data_incasare ?? null, data: vanzare.data })
  if (!ziua || !inInterval(ziua, start, end)) return 0
  return vanzareTotal({ cantitate_kg: Number(vanzare.cantitate_kg) || 0, pret_lei_kg: Number(vanzare.pret_lei_kg) || 0 })
}

export interface SumarRaport {
  incasat: number
  cheltuieli: number
  profit: number
  /** Kg recoltate (cal. I + cal. II), fără parcelele personale. */
  recoltatKg: number
  investitii: InvestitiiPerioada
}

export function sumarRaport(date: DateRaport, perioada: Pick<Perioada, 'start' | 'end'>): SumarRaport {
  const { start, end } = perioada
  const personale = new Set(date.parcele.filter(esteParcelaPersonala).map((parcela) => parcela.id))
  let incasat = 0
  for (const vanzare of date.vanzari) incasat += incasatVanzare(vanzare, start, end)
  for (const comanda of date.butasi) {
    const ziua = butasiRevenueDate(comanda)
    if (ziua && inInterval(ziua, start, end)) incasat += Number(comanda.total_lei) || 0
  }
  let cheltuieli = 0
  for (const cheltuiala of date.cheltuieli) if (inInterval(zi(cheltuiala.data), start, end)) cheltuieli += Number(cheltuiala.suma_lei) || 0
  let recoltatKg = 0
  for (const recoltare of date.recoltari) {
    if (!inInterval(zi(recoltare.data), start, end)) continue
    if (recoltare.parcela_id && personale.has(recoltare.parcela_id)) continue
    recoltatKg += kgRecoltare(recoltare)
  }
  const profit = calculateProfit(round2(incasat), round2(cheltuieli))
  return {
    incasat: round2(profit.revenue),
    cheltuieli: round2(profit.cost),
    profit: round2(profit.profit),
    recoltatKg: round2(recoltatKg),
    investitii: investitiiInPerioada(date.investitii, start, end),
  }
}

export interface LunaRaport {
  /** `2026-07` */
  luna: string
  eticheta: string
  incasat: number
  cheltuieli: number
}

/** Fiecare lună din perioadă (și cele fără mișcări), cu încasatul și cheltuielile ei. */
export function luniRaport(date: DateRaport, perioada: Pick<Perioada, 'start' | 'end'>): LunaRaport[] {
  const luni: LunaRaport[] = []
  let [an, luna] = perioada.start.slice(0, 7).split('-').map(Number)
  const [anFinal, lunaFinala] = perioada.end.slice(0, 7).split('-').map(Number)
  while (an < anFinal || (an === anFinal && luna <= lunaFinala)) {
    const cheie = `${an}-${String(luna).padStart(2, '0')}`
    const start = cheie === perioada.start.slice(0, 7) ? perioada.start : `${cheie}-01`
    const end = cheie === perioada.end.slice(0, 7) ? perioada.end : `${cheie}-31`
    const sumar = sumarRaport({ ...date, investitii: [] }, { start, end })
    luni.push({ luna: cheie, eticheta: LUNI_SCURT[luna - 1], incasat: sumar.incasat, cheltuieli: sumar.cheltuieli })
    luna += 1
    if (luna > 12) {
      luna = 1
      an += 1
    }
  }
  return luni
}

export interface RandParcela {
  id: string
  nume: string
  kg: number
  nrPlante: number | null
  kgPePlanta: number | null
  personal: boolean
}

/** Kg pe parcelă, cu kg/plantă din `nr_plante`. Parcelele personale vin la sfârșit, marcate. */
export function peParcele(date: Pick<DateRaport, 'recoltari' | 'parcele'>, perioada: Pick<Perioada, 'start' | 'end'>): RandParcela[] {
  const parcele = new Map(date.parcele.map((parcela) => [parcela.id, parcela]))
  const kg = new Map<string, number>()
  for (const recoltare of date.recoltari) {
    if (!inInterval(zi(recoltare.data), perioada.start, perioada.end)) continue
    const cheie = recoltare.parcela_id && parcele.has(recoltare.parcela_id) ? recoltare.parcela_id : 'fara'
    kg.set(cheie, (kg.get(cheie) ?? 0) + kgRecoltare(recoltare))
  }
  return [...kg.entries()]
    .map(([id, total]) => {
      const parcela = parcele.get(id)
      const plante = Number(parcela?.nr_plante) || 0
      return {
        id,
        nume: parcela?.nume_parcela?.trim() || (id === 'fara' ? 'Fără parcelă' : 'Parcelă'),
        kg: round2(total),
        nrPlante: plante > 0 ? plante : null,
        kgPePlanta: plante > 0 ? Math.round((total / plante) * 10) / 10 : null,
        personal: esteParcelaPersonala(parcela),
      }
    })
    .sort((a, b) => Number(a.personal) - Number(b.personal) || b.kg - a.kg)
}

export interface RandCulegator {
  id: string
  nume: string
  kg: number
  /** Suma `valoare_munca_lei` (tariful salvat pe fiecare recoltare, ca în Culegători). */
  plata: number
}

export function peCulegatori(date: Pick<DateRaport, 'recoltari' | 'culegatori'>, perioada: Pick<Perioada, 'start' | 'end'>): RandCulegator[] {
  const nume = new Map(date.culegatori.map((culegator) => [culegator.id, culegator.nume_prenume?.trim() || 'Culegător']))
  const acc = new Map<string, { kg: number; plata: number }>()
  for (const recoltare of date.recoltari) {
    if (!inInterval(zi(recoltare.data), perioada.start, perioada.end)) continue
    const cheie = recoltare.culegator_id ?? 'fara'
    const curent = acc.get(cheie) ?? { kg: 0, plata: 0 }
    curent.kg += kgRecoltare(recoltare)
    curent.plata += Number(recoltare.valoare_munca_lei) || 0
    acc.set(cheie, curent)
  }
  return [...acc.entries()]
    .map(([id, valori]) => ({
      id,
      nume: id === 'fara' ? 'Fără culegător' : (nume.get(id) ?? 'Culegător șters'),
      kg: round2(valori.kg),
      plata: round2(valori.plata),
    }))
    .sort((a, b) => b.kg - a.kg)
}

export interface RandClient {
  id: string
  nume: string
  incasat: number
}

export function peClienti(date: Pick<DateRaport, 'vanzari' | 'clienti'>, perioada: Pick<Perioada, 'start' | 'end'>): RandClient[] {
  const nume = new Map(date.clienti.map((client) => [client.id, client.nume_client?.trim() || 'Client']))
  const acc = new Map<string, number>()
  for (const vanzare of date.vanzari) {
    const suma = incasatVanzare(vanzare, perioada.start, perioada.end)
    if (suma <= 0) continue
    const cheie = vanzare.client_id ?? 'fara'
    acc.set(cheie, (acc.get(cheie) ?? 0) + suma)
  }
  return [...acc.entries()]
    .map(([id, incasat]) => ({ id, nume: id === 'fara' ? 'Fără client' : (nume.get(id) ?? 'Client șters'), incasat: round2(incasat) }))
    .sort((a, b) => b.incasat - a.incasat)
}

/** Cheltuielile pe categorii (numele vechi aduse la cele noi), pentru export. */
export function cheltuieliPeCategorii(cheltuieli: readonly CheltuialaRaport[], perioada: Pick<Perioada, 'start' | 'end'>) {
  const acc = new Map<string, number>()
  for (const cheltuiala of cheltuieli) {
    if (!inInterval(zi(cheltuiala.data), perioada.start, perioada.end)) continue
    const categorie = cheltuiala.categorie ? resolveCheltuialaCategorie(cheltuiala.categorie) : 'Fără categorie'
    acc.set(categorie, (acc.get(categorie) ?? 0) + (Number(cheltuiala.suma_lei) || 0))
  }
  return [...acc.entries()].map(([categorie, lei]) => ({ categorie, lei: round2(lei) })).sort((a, b) => b.lei - a.lei)
}
