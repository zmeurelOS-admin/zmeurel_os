/**
 * Acasă pe telefon: în ce perioadă e ferma (sezon / extrasezon), cifrele cardurilor și lista „De făcut”.
 * Funcții pure, peste datele pe care dashboardul le încarcă deja.
 */
import { bucketOfComanda, isComandaDeschisa } from '@/lib/comenzi/day-view'
import type { FarmSettings } from '@/lib/farm-settings'
import { daysBetween, round2, shiftIso } from '@/lib/format-ro'
import type { ParcelDashboardState } from '@/lib/dashboard/engine'
import type { ActivitateAgricola } from '@/lib/supabase/queries/activitati-agricole'
import type { Comanda } from '@/lib/supabase/queries/comenzi'
import { getRecoltareTotalKg, type Recoltare } from '@/lib/supabase/queries/recoltari'
import type { Vanzare } from '@/lib/supabase/queries/vanzari'
import type { VanzareButasi } from '@/lib/supabase/queries/vanzari-butasi'
import { restDeIncasat, venitIncasat } from '@/lib/vanzari/incasari'

export type Perioada = 'sezon' | 'extrasezon'

const dayOf = (value: string | null | undefined) => String(value ?? '').slice(0, 10)

// ─── Perioada ──────────────────────────────────────────────────────────────────

export interface PerioadaAcasa {
  perioada: Perioada
  /** Cardul „Începem extrasezonul?” apare. */
  intreaba: boolean
  /** Ultima recoltare din an (afișată în card). */
  ultimaRecoltare: string | null
}

type PerioadaSettings = Pick<
  FarmSettings,
  'acasaConfigurabil' | 'acasaPerioadaMod' | 'extrasezonInceputLa' | 'extrasezonAmanatPana' | 'extrasezonIntrebareDin'
>

/**
 * - Sezonul începe singur, la prima recoltare din an (de după ultima trecere pe extrasezon).
 * - Extrasezonul NU pornește singur: din 25 octombrie (setare) Acasă întreabă; „Da, începem” îl pornește,
 *   „Mai am de cules” amână întrebarea 7 zile.
 * - Fără setări în baza de date (migrarea nerulată): sezon dacă există o recoltare în anul curent și e
 *   înainte de 1 noiembrie, altfel extrasezon; fără întrebare.
 */
export function resolvePerioada(
  settings: PerioadaSettings,
  todayIso: string,
  recoltari: readonly Pick<Recoltare, 'data'>[],
): PerioadaAcasa {
  const year = todayIso.slice(0, 4)
  const thisYear = recoltari.map((recoltare) => dayOf(recoltare.data)).filter((day) => day.startsWith(year) && day <= todayIso)
  const ultimaRecoltare = thisYear.length > 0 ? thisYear.reduce((latest, day) => (day > latest ? day : latest)) : null

  if (!settings.acasaConfigurabil) {
    const sezon = ultimaRecoltare !== null && todayIso < `${year}-11-01`
    return { perioada: sezon ? 'sezon' : 'extrasezon', intreaba: false, ultimaRecoltare }
  }

  if (settings.acasaPerioadaMod !== 'auto') {
    return { perioada: settings.acasaPerioadaMod, intreaba: false, ultimaRecoltare }
  }

  const inceput = settings.extrasezonInceputLa
  // Sezon = a existat o recoltare anul acesta, după ultima confirmare a extrasezonului.
  const sezon = thisYear.some((day) => !inceput || day > inceput)
  if (!sezon) return { perioada: 'extrasezon', intreaba: false, ultimaRecoltare }

  const intrebareDin = `${year}-${settings.extrasezonIntrebareDin}`
  const amanat = settings.extrasezonAmanatPana
  const intreaba = todayIso >= intrebareDin && !(amanat && todayIso <= amanat)
  return { perioada: 'sezon', intreaba, ultimaRecoltare }
}

/** „Mai am de cules”: întrebarea revine după 7 zile. */
export function amanaIntrebarea(todayIso: string): string {
  return shiftIso(todayIso, 7)
}

// ─── Meteo, pe scurt ───────────────────────────────────────────────────────────

export interface MeteoScurt {
  temp: number | null
  /** O singură notă: ploaie / vânt în sezon, îngheț / brumă în extrasezon. `null` = nimic de spus. */
  nota: string | null
  tone: 'neutral' | 'warning'
}

type MeteoInput = {
  current?: { temp: number | null; windSpeed: number | null } | null
  forecastTomorrow?: { tempMin: number | null; pop: number | null } | null
} | null

export function meteoScurt(meteo: MeteoInput, perioada: Perioada): MeteoScurt {
  const temp = meteo?.current?.temp ?? null
  const tempMin = meteo?.forecastTomorrow?.tempMin ?? null
  const pop = meteo?.forecastTomorrow?.pop ?? null
  const wind = meteo?.current?.windSpeed ?? null

  if (perioada === 'extrasezon') {
    if (tempMin !== null && tempMin <= 0) return { temp, nota: `îngheț mâine (${Math.round(tempMin)}°)`, tone: 'warning' }
    if (tempMin !== null && tempMin <= 3) return { temp, nota: `brumă posibilă (${Math.round(tempMin)}°)`, tone: 'warning' }
    return { temp, nota: null, tone: 'neutral' }
  }

  if (pop !== null && pop >= 0.5) return { temp, nota: `ploaie mâine (${Math.round(pop * 100)}%)`, tone: 'warning' }
  // Viteza vine în m/s; peste ~6 m/s (22 km/h) stropitul și culesul sunt incomode.
  if (wind !== null && wind >= 6) return { temp, nota: `vânt ${Math.round(wind * 3.6)} km/h`, tone: 'warning' }
  return { temp, nota: null, tone: 'neutral' }
}

// ─── Sezon ─────────────────────────────────────────────────────────────────────

export interface AcasaSezon {
  deLivratKg: number
  deLivratCount: number
  prioritareCount: number
  /** `null` = stocul nu s-a încărcat încă. */
  stocKg: number | null
  /** Câte kg lipsesc ca stocul să acopere ce nu e încă în livrare. 0 = ajunge. */
  lipsaKg: number
  inLivrareCount: number
  dePusInLivrareCount: number
  recoltatAziKg: number
  parcelePauza: Array<{ id: string; name: string; zile: number }>
  parceleTratament: Array<{ id: string; name: string; intarziat: boolean }>
}

export function buildAcasaSezon(input: {
  todayIso: string
  comenzi: readonly Comanda[]
  recoltari: readonly Recoltare[]
  stocDisponibilKg: number | null
  parcelStates: readonly ParcelDashboardState[]
}): AcasaSezon {
  const azi = input.comenzi.filter((comanda) => bucketOfComanda(comanda, input.todayIso) === 'azi')
  const inLivrare = azi.filter((comanda) => comanda.status === 'in_livrare')
  const dePus = azi.filter((comanda) => comanda.status !== 'in_livrare')
  const dePusKg = dePus.reduce((sum, comanda) => sum + (Number(comanda.cantitate_kg) || 0), 0)

  // Comenzile deja în livrare au stocul pus deoparte: lipsa se judecă doar pe cele nepuse încă.
  const lipsaKg = input.stocDisponibilKg === null ? 0 : round2(Math.max(0, dePusKg - Math.max(0, input.stocDisponibilKg)))

  return {
    deLivratKg: round2(azi.reduce((sum, comanda) => sum + (Number(comanda.cantitate_kg) || 0), 0)),
    deLivratCount: azi.length,
    prioritareCount: azi.filter((comanda) => comanda.prioritara === true).length,
    stocKg: input.stocDisponibilKg === null ? null : round2(Math.max(0, input.stocDisponibilKg)),
    lipsaKg,
    inLivrareCount: inLivrare.length,
    dePusInLivrareCount: dePus.length,
    recoltatAziKg: round2(
      input.recoltari
        .filter((recoltare) => dayOf(recoltare.data) === input.todayIso)
        .reduce((sum, recoltare) => sum + getRecoltareTotalKg(recoltare), 0),
    ),
    parcelePauza: input.parcelStates
      .filter((parcel) => parcel.pauseStatus === 'active' || parcel.pauseStatus === 'urgent')
      .map((parcel) => ({ id: parcel.parcelaId, name: parcel.displayName, zile: parcel.pauseDaysRemaining })),
    parceleTratament: input.parcelStates
      .filter((parcel) => parcel.treatmentAttention !== 'none')
      .map((parcel) => ({ id: parcel.parcelaId, name: parcel.displayName, intarziat: parcel.treatmentAttention === 'overdue' })),
  }
}

// ─── Extrasezon ────────────────────────────────────────────────────────────────

export interface AcasaExtrasezon {
  butasiSaptamanaBuc: number
  butasiSaptamanaCount: number
  /** Prima zi de livrare din săptămâna asta. */
  butasiPrimaData: string | null
  /** Comenzi de butași deschise, în total (de pregătit). */
  butasiDeschiseCount: number
  /** Bucăți de pregătit, pe soiuri, din comenzile deschise. */
  butasiPeSoiuri: Array<{ soi: string; buc: number }>
  restLei: number
  restCount: number
  lucrari: Array<{ id: string; data: string; titlu: string }>
}

const BUTASI_DESCHISE = new Set(['noua', 'confirmata', 'pregatita'])

/** Ultima zi (duminică) a săptămânii în care cade `todayIso`. */
export function endOfWeekIso(todayIso: string): string {
  const [year, month, day] = todayIso.split('-').map(Number)
  const weekday = new Date(year, month - 1, day, 12).getDay() // 0 = duminică
  return shiftIso(todayIso, weekday === 0 ? 0 : 7 - weekday)
}

export function buildAcasaExtrasezon(input: {
  todayIso: string
  vanzariButasi: readonly VanzareButasi[]
  vanzari: readonly Vanzare[]
  activitati: readonly ActivitateAgricola[]
}): AcasaExtrasezon {
  const weekEnd = endOfWeekIso(input.todayIso)
  const deschise = input.vanzariButasi.filter((order) => BUTASI_DESCHISE.has(order.status))
  // Săptămâna asta: și comenzile rămase din urmă (data trecută, încă nelivrate).
  const saptamana = deschise.filter((order) => {
    const day = dayOf(order.data_livrare_estimata)
    return day !== '' && day <= weekEnd
  })

  const bucOf = (order: VanzareButasi) =>
    order.items.length > 0
      ? order.items.reduce((sum, item) => sum + (Number(item.cantitate) || 0), 0)
      : Number(order.cantitate_butasi) || 0

  const peSoiuri = new Map<string, number>()
  for (const order of deschise) {
    if (order.items.length > 0) {
      for (const item of order.items) {
        const soi = item.soi?.trim() || 'Fără soi'
        peSoiuri.set(soi, (peSoiuri.get(soi) ?? 0) + (Number(item.cantitate) || 0))
      }
    } else if ((Number(order.cantitate_butasi) || 0) > 0) {
      const soi = order.soi_butasi?.trim() || 'Fără soi'
      peSoiuri.set(soi, (peSoiuri.get(soi) ?? 0) + Number(order.cantitate_butasi))
    }
  }

  const rest = restDeIncasat(input.vanzari)
  const days = saptamana.map((order) => dayOf(order.data_livrare_estimata)).sort()

  return {
    butasiSaptamanaBuc: saptamana.reduce((sum, order) => sum + bucOf(order), 0),
    butasiSaptamanaCount: saptamana.length,
    butasiPrimaData: days[0] ?? null,
    butasiDeschiseCount: deschise.length,
    butasiPeSoiuri: [...peSoiuri.entries()]
      .map(([soi, buc]) => ({ soi, buc }))
      .sort((left, right) => right.buc - left.buc),
    restLei: rest.lei,
    restCount: rest.count,
    lucrari: lucrariPlanificate(input.activitati, input.todayIso),
  }
}

/** Lucrările planificate vin din Activități: înregistrările cu dată în viitor, cele mai apropiate întâi. */
export function lucrariPlanificate(
  activitati: readonly ActivitateAgricola[],
  todayIso: string,
  limit = 4,
): Array<{ id: string; data: string; titlu: string }> {
  return activitati
    .filter((activitate) => dayOf(activitate.data_aplicare) > todayIso)
    .sort((left, right) => dayOf(left.data_aplicare).localeCompare(dayOf(right.data_aplicare)))
    .slice(0, limit)
    .map((activitate) => ({
      id: activitate.id,
      data: dayOf(activitate.data_aplicare),
      titlu:
        [activitate.tip_activitate?.trim(), activitate.produs_utilizat?.trim()].filter(Boolean).join(' · ') || 'Lucrare planificată',
    }))
}

// ─── Sezonul, pe scurt (jos) ───────────────────────────────────────────────────

export interface SezonPeScurt {
  an: number
  recoltatKg: number
  incasatLei: number
}

/** Recoltat și încasat (fructe) de la 1 ianuarie până azi. Detaliul e în Rapoarte. */
export function sezonPeScurt(
  todayIso: string,
  recoltari: readonly Recoltare[],
  vanzari: readonly Vanzare[],
): SezonPeScurt {
  const year = todayIso.slice(0, 4)
  const start = `${year}-01-01`
  return {
    an: Number(year),
    recoltatKg: round2(
      recoltari
        .filter((recoltare) => {
          const day = dayOf(recoltare.data)
          return day >= start && day <= todayIso
        })
        .reduce((sum, recoltare) => sum + getRecoltareTotalKg(recoltare), 0),
    ),
    incasatLei: venitIncasat(vanzari, start, todayIso),
  }
}

/** Comenzile deschise de fructe (pentru rândul din extrasezon, dacă mai există). */
export function comenziDeschiseCount(comenzi: readonly Pick<Comanda, 'status'>[]): number {
  return comenzi.filter(isComandaDeschisa).length
}

/** Câte zile au trecut de la o zi (pentru „ultima recoltare: acum N zile”). */
export function zileDeLa(dayIso: string | null, todayIso: string): number | null {
  if (!dayIso) return null
  return daysBetween(dayIso, todayIso)
}
