/**
 * Livrări, partea care atinge telefonul: poziția GPS și cererea de optimizare a traseului.
 */
import type { GeoPoint } from './route'

export interface DevicePosition extends GeoPoint {
  /** Precizia GPS, în metri. */
  accuracyM: number
}

/** Poziția de acum. Aruncă un mesaj pe înțeles dacă telefonul nu o dă. */
export function getDevicePosition(timeoutMs = 10_000): Promise<DevicePosition> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new Error('Telefonul nu dă locația.'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracyM: position.coords.accuracy,
        }),
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          reject(new Error('Locația e oprită pentru aplicație. Pornește-o din setările telefonului.'))
        } else if (error.code === error.TIMEOUT) {
          reject(new Error('Locația nu a venit la timp. Încearcă din nou, sub cer liber.'))
        } else {
          reject(new Error('Locația nu e disponibilă acum.'))
        }
      },
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 15_000 },
    )
  })
}

export class OptimizeRouteError extends Error {
  code: string
  constructor(code: string, message: string) {
    super(message)
    this.name = 'OptimizeRouteError'
    this.code = code
  }
}

/**
 * Cere serverului ordinea optimă. Cheia serviciului de rutare e doar pe server.
 * `ORS_NOT_CONFIGURED` = optimizarea nu e configurată încă (rămâne aranjarea manuală).
 */
export async function requestOptimizedRoute(input: {
  start: GeoPoint
  stops: Array<GeoPoint & { id: string }>
}): Promise<{ order: string[]; unassigned: string[] }> {
  let response: Response
  try {
    response = await fetch('/api/livrari/optimizeaza', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    })
  } catch {
    throw new OptimizeRouteError('NETWORK', 'Nu există conexiune la internet. Aranjează traseul manual.')
  }

  const json = (await response.json().catch(() => null)) as
    | { order?: unknown; unassigned?: unknown; error?: { code?: string; message?: string } }
    | null

  if (!response.ok) {
    throw new OptimizeRouteError(
      json?.error?.code ?? 'UNKNOWN',
      json?.error?.message ?? 'Optimizarea nu a mers. Aranjează traseul manual.',
    )
  }

  const order = Array.isArray(json?.order) ? json.order.filter((id): id is string => typeof id === 'string') : []
  const unassigned = Array.isArray(json?.unassigned)
    ? json.unassigned.filter((id): id is string => typeof id === 'string')
    : []
  if (order.length === 0) {
    throw new OptimizeRouteError('EMPTY', 'Optimizarea nu a întors un traseu. Aranjează-l manual.')
  }
  return { order, unassigned }
}
