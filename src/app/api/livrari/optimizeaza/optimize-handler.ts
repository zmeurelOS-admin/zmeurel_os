import { z } from 'zod'

import { apiError, validateSameOriginMutation } from '@/lib/api/route-security'

/**
 * Optimizarea traseului de livrare prin OpenRouteService (motor Vroom), apelat DOAR de pe server.
 *
 * - Cheia stă în `process.env.ORS_API_KEY`. Nu ajunge în client și nu se scrie în loguri.
 * - Fără cheie, ruta întoarce 503 `ORS_NOT_CONFIGURED`; ecranul lasă aranjarea manuală.
 * - Adresa serviciului: `https://api.heigit.org/vroom/v0` (vechiul `api.openrouteservice.org/optimization`
 *   a fost retras în 2026). Se poate schimba cu `ORS_OPTIMIZATION_URL`, fără cod nou.
 * - Traseul pornește din `start` (unde e fermierul) și nu se întoarce nicăieri.
 */

const MAX_STOPS = 60
const DEFAULT_ORS_URL = 'https://api.heigit.org/vroom/v0'
const ORS_TIMEOUT_MS = 15_000

const PointSchema = z.object({
  lat: z.number().finite().min(-90).max(90),
  lng: z.number().finite().min(-180).max(180),
})

const BodySchema = z
  .object({
    start: PointSchema,
    stops: z
      .array(PointSchema.extend({ id: z.string().min(1).max(64) }))
      .min(2)
      .max(MAX_STOPS),
  })
  .strict()

export type OptimizeRequestBody = z.infer<typeof BodySchema>

export interface OptimizeResponseBody {
  /** Id-urile opririlor, în ordinea drumului. */
  order: string[]
  /** Opririle pe care serviciul nu le-a putut așeza; rămân la final. */
  unassigned: string[]
}

export interface OptimizeHandlerDeps {
  /** Utilizatorul autentificat, sau `null`. */
  getUserId: () => Promise<string | null>
  getApiKey: () => string | undefined
  getServiceUrl: () => string | undefined
  fetchImpl: typeof fetch
}

type VroomStep = { type?: string; id?: number; job?: number }
type VroomResponse = {
  routes?: Array<{ steps?: VroomStep[] }>
  unassigned?: Array<{ id?: number }>
}

/** Ordinea întoarsă de Vroom → id-urile noastre. Exportată pentru teste. */
export function orderFromVroom(response: VroomResponse, ids: readonly string[]): OptimizeResponseBody {
  const order: string[] = []
  for (const step of response.routes?.[0]?.steps ?? []) {
    if (step.type !== 'job') continue
    const index = typeof step.id === 'number' ? step.id : step.job
    const id = typeof index === 'number' ? ids[index] : undefined
    if (id && !order.includes(id)) order.push(id)
  }
  const placed = new Set(order)
  return { order, unassigned: ids.filter((id) => !placed.has(id)) }
}

export function createOptimizeHandler(deps: OptimizeHandlerDeps) {
  return async function POST(request: Request) {
    const originError = validateSameOriginMutation(request)
    if (originError) return originError

    const userId = await deps.getUserId()
    if (!userId) return apiError(401, 'UNAUTHORIZED', 'Trebuie să fii autentificat.')

    let json: unknown
    try {
      json = await request.json()
    } catch {
      return apiError(400, 'INVALID_BODY', 'Cererea nu a putut fi citită.')
    }
    const parsed = BodySchema.safeParse(json)
    if (!parsed.success) {
      return apiError(400, 'INVALID_BODY', 'Traseul trimis nu e valid (cel puțin două opriri cu locație).')
    }
    const { start, stops } = parsed.data
    if (new Set(stops.map((stop) => stop.id)).size !== stops.length) {
      return apiError(400, 'INVALID_BODY', 'O oprire apare de două ori.')
    }

    const apiKey = deps.getApiKey()?.trim()
    if (!apiKey) {
      return apiError(503, 'ORS_NOT_CONFIGURED', 'Optimizarea nu e configurată încă.')
    }

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), ORS_TIMEOUT_MS)
    try {
      const response = await deps.fetchImpl(deps.getServiceUrl()?.trim() || DEFAULT_ORS_URL, {
        method: 'POST',
        headers: {
          Authorization: apiKey,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          // Vroom vrea [longitudine, latitudine] și id-uri întregi: folosim poziția în listă.
          jobs: stops.map((stop, index) => ({ id: index, location: [stop.lng, stop.lat] })),
          vehicles: [{ id: 1, profile: 'driving-car', start: [start.lng, start.lat] }],
        }),
        signal: controller.signal,
        cache: 'no-store',
      })

      if (!response.ok) {
        // Doar codul: corpul răspunsului poate repeta cheia sau cererea.
        console.error('[livrari/optimizeaza] serviciul de rutare a răspuns cu', response.status)
        return apiError(502, 'ORS_FAILED', 'Serviciul de rutare nu a răspuns. Aranjează traseul manual.')
      }

      const result = orderFromVroom((await response.json()) as VroomResponse, stops.map((stop) => stop.id))
      if (result.order.length === 0) {
        return apiError(502, 'ORS_EMPTY', 'Serviciul de rutare nu a întors un traseu. Aranjează-l manual.')
      }
      return Response.json(result satisfies OptimizeResponseBody)
    } catch (error) {
      const aborted = error instanceof Error && error.name === 'AbortError'
      console.error('[livrari/optimizeaza] cererea a eșuat:', aborted ? 'timp depășit' : 'eroare de rețea')
      return apiError(
        aborted ? 504 : 502,
        aborted ? 'ORS_TIMEOUT' : 'ORS_FAILED',
        'Serviciul de rutare nu a răspuns. Aranjează traseul manual.',
      )
    } finally {
      clearTimeout(timer)
    }
  }
}
