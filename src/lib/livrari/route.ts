/**
 * Livrări: traseul de azi. Ordinea opririlor, progresul, distanțele, legăturile de navigare
 * și regulile pentru locațiile clienților. Funcții pure.
 */
import { round2, toIso } from '@/lib/format-ro'
import type { Client } from '@/lib/supabase/queries/clienti'
import type { Comanda } from '@/lib/supabase/queries/comenzi'

export interface GeoPoint {
  lat: number
  lng: number
}

/** Locația se salvează doar dacă GPS-ul e mai precis de atât. */
export const LOCATION_SAVE_MAX_ACCURACY_M = 50
/** De la distanța asta față de locația salvată întrebăm „Livrezi aici și de acum?”. */
export const LOCATION_DIFFERENT_MIN_DISTANCE_M = 150
/** Google Maps primește cel mult 10 puncte cu plecarea: trimitem câte 9 opriri. */
export const MAPS_BATCH_SIZE = 9

// ─── Ordinea pe drum ───────────────────────────────────────────────────────────

type RouteComanda = Pick<Comanda, 'id' | 'ordine_livrare' | 'data_livrare' | 'data_comanda' | 'created_at'>

/**
 * Ordinea aranjată de fermier (`ordine_livrare`) are întâietate; comenzile fără poziție vin după,
 * în ordinea zilei de livrare și apoi a notării.
 */
export function compareRouteOrder(left: RouteComanda, right: RouteComanda): number {
  const leftPos = left.ordine_livrare ?? null
  const rightPos = right.ordine_livrare ?? null
  if (leftPos !== null && rightPos !== null && leftPos !== rightPos) return leftPos - rightPos
  if (leftPos !== null && rightPos === null) return -1
  if (leftPos === null && rightPos !== null) return 1

  const leftDay = (left.data_livrare ?? left.data_comanda ?? '').slice(0, 10)
  const rightDay = (right.data_livrare ?? right.data_comanda ?? '').slice(0, 10)
  if (leftDay !== rightDay) return leftDay.localeCompare(rightDay)

  const created = String(left.created_at ?? '').localeCompare(String(right.created_at ?? ''))
  return created !== 0 ? created : left.id.localeCompare(right.id)
}

/** Opririle traseului: comenzile puse în livrare, în ordinea drumului. */
export function routeStops<T extends RouteComanda & Pick<Comanda, 'status'>>(comenzi: readonly T[]): T[] {
  return comenzi.filter((comanda) => comanda.status === 'in_livrare').sort(compareRouteOrder)
}

/** Ziua (în ora telefonului) a unui moment ISO. */
export function localDayOf(timestamp: string | null | undefined): string | null {
  if (!timestamp) return null
  const date = new Date(timestamp)
  return Number.isNaN(date.getTime()) ? null : toIso(date)
}

/**
 * Comenzile livrate azi. Nu există o coloană cu momentul livrării: folosim ultima modificare a comenzii,
 * care la o comandă livrată e, în practică, livrarea.
 */
export function deliveredToday<T extends Pick<Comanda, 'status' | 'updated_at'>>(comenzi: readonly T[], todayIso: string): T[] {
  return comenzi.filter((comanda) => comanda.status === 'livrata' && localDayOf(comanda.updated_at) === todayIso)
}

/** Banii de luat la o oprire: 0 pentru cadouri și consum propriu. */
export function leiDeIncasat(comanda: Pick<Comanda, 'total' | 'order_kind'>): number {
  if (comanda.order_kind === 'cadou' || comanda.order_kind === 'consum_propriu') return 0
  return round2(Number(comanda.total) || 0)
}

export interface RouteProgress {
  deliveredCount: number
  totalCount: number
  kgRamase: number
  leiDeIncasat: number
}

export function routeProgress(
  stops: readonly Pick<Comanda, 'cantitate_kg' | 'total' | 'order_kind'>[],
  deliveredCount: number,
): RouteProgress {
  return {
    deliveredCount,
    totalCount: deliveredCount + stops.length,
    kgRamase: round2(stops.reduce((sum, stop) => sum + (Number(stop.cantitate_kg) || 0), 0)),
    leiDeIncasat: round2(stops.reduce((sum, stop) => sum + leiDeIncasat(stop), 0)),
  }
}

// ─── Aranjarea manuală ─────────────────────────────────────────────────────────

/** Mută o oprire cu un loc mai sus (`-1`) sau mai jos (`1`). La capete, lista rămâne neschimbată. */
export function moveStop(ids: readonly string[], id: string, direction: -1 | 1): string[] {
  const from = ids.indexOf(id)
  const to = from + direction
  if (from === -1 || to < 0 || to >= ids.length) return [...ids]
  const next = [...ids]
  next[from] = ids[to]
  next[to] = ids[from]
  return next
}

export function moveStopToEnd(ids: readonly string[], id: string): string[] {
  if (!ids.includes(id)) return [...ids]
  return [...ids.filter((item) => item !== id), id]
}

/**
 * Pune opririle optimizate în ordinea primită; cele rămase pe dinafară (clienți fără locație,
 * opriri pe care serviciul nu le-a putut așeza) rămân la final, în ordinea de dinainte.
 */
export function applyOptimizedOrder(ids: readonly string[], optimizedIds: readonly string[]): string[] {
  const known = new Set(ids)
  const optimized = optimizedIds.filter((id, index) => known.has(id) && optimizedIds.indexOf(id) === index)
  const placed = new Set(optimized)
  return [...optimized, ...ids.filter((id) => !placed.has(id))]
}

// ─── Locații ───────────────────────────────────────────────────────────────────

export function isValidPoint(point: Partial<GeoPoint> | null | undefined): point is GeoPoint {
  return (
    !!point &&
    typeof point.lat === 'number' &&
    typeof point.lng === 'number' &&
    Number.isFinite(point.lat) &&
    Number.isFinite(point.lng) &&
    Math.abs(point.lat) <= 90 &&
    Math.abs(point.lng) <= 180 &&
    // (0, 0) e „fără locație”, nu un loc din Golful Guineei.
    !(point.lat === 0 && point.lng === 0)
  )
}

/** Locația salvată a clientului, dacă există și e validă. */
export function clientLocation(client: Pick<Client, 'latitudine' | 'longitudine'> | null | undefined): GeoPoint | null {
  if (!client) return null
  const point = { lat: Number(client.latitudine), lng: Number(client.longitudine) }
  if (client.latitudine === null || client.latitudine === undefined) return null
  if (client.longitudine === null || client.longitudine === undefined) return null
  return isValidPoint(point) ? point : null
}

/** Distanța în metri între două puncte (formula haversine). */
export function distanceMeters(from: GeoPoint, to: GeoPoint): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const earthRadiusM = 6_371_000
  const dLat = toRad(to.lat - from.lat)
  const dLng = toRad(to.lng - from.lng)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(from.lat)) * Math.cos(toRad(to.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * earthRadiusM * Math.asin(Math.min(1, Math.sqrt(a)))
}

/** Precizia e destul de bună ca locația să fie salvată. */
export function canSaveLocation(accuracyM: number | null | undefined): boolean {
  return typeof accuracyM === 'number' && Number.isFinite(accuracyM) && accuracyM > 0 && accuracyM < LOCATION_SAVE_MAX_ACCURACY_M
}

/**
 * Întrebăm „Livrezi aici și de acum?” doar când clientul are deja o locație, GPS-ul e precis
 * și livrarea s-a făcut la peste 150 m de ea. Altfel locația nu se schimbă niciodată singură.
 */
export function shouldAskLocationUpdate(saved: GeoPoint | null, current: GeoPoint | null, accuracyM: number | null): boolean {
  if (!saved || !current || !canSaveLocation(accuracyM)) return false
  return distanceMeters(saved, current) > LOCATION_DIFFERENT_MIN_DISTANCE_M
}

// ─── Navigare ──────────────────────────────────────────────────────────────────

export type NavApp = 'google' | 'waze'

const coords = (point: GeoPoint) => `${point.lat.toFixed(6)},${point.lng.toFixed(6)}`

/** Navigare spre o singură oprire, pornind de unde ești. */
export function navigateUrl(point: GeoPoint, app: NavApp): string {
  if (app === 'waze') return `https://waze.com/ul?ll=${encodeURIComponent(coords(point))}&navigate=yes`
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(coords(point))}&travelmode=driving`
}

/** Fără locație salvată: adresa scrisă, căutată pe hartă (nu e navigare la punct fix). */
export function mapsSearchUrl(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address.trim())}`
}

/** Opririle cu locație, în ordinea drumului, împărțite câte 9. */
export function mapsBatches<T extends { location: GeoPoint | null }>(stops: readonly T[], size = MAPS_BATCH_SIZE): T[][] {
  const withLocation = stops.filter((stop) => stop.location !== null)
  const batches: T[][] = []
  for (let index = 0; index < withLocation.length; index += size) {
    batches.push(withLocation.slice(index, index + size))
  }
  return batches
}

/** Traseu Google Maps prin toate opririle unui grup: ultima e destinația, restul sunt opriri pe drum. */
export function mapsRouteUrl(points: readonly GeoPoint[]): string | null {
  if (points.length === 0) return null
  const destination = points[points.length - 1]
  const waypoints = points.slice(0, -1).map(coords).join('|')
  const base = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(coords(destination))}&travelmode=driving`
  return waypoints ? `${base}&waypoints=${encodeURIComponent(waypoints)}` : base
}
