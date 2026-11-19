import { describe, expect, it, vi } from 'vitest'

import { createOptimizeHandler, orderFromVroom } from '@/app/api/livrari/optimizeaza/optimize-handler'

const SECRET = 'cheie-secreta-ors'

const validBody = {
  start: { lat: 47.65, lng: 26.25 },
  stops: [
    { id: 'a', lat: 47.66, lng: 26.26 },
    { id: 'b', lat: 47.67, lng: 26.27 },
    { id: 'c', lat: 47.68, lng: 26.28 },
  ],
}

function request(body: unknown, headers: Record<string, string> = {}) {
  return new Request('https://app.test/api/livrari/optimizeaza', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', origin: 'https://app.test', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

function makeHandler(overrides: Partial<Parameters<typeof createOptimizeHandler>[0]> = {}) {
  const fetchImpl = vi.fn(async () =>
    Response.json({
      routes: [{ steps: [{ type: 'start' }, { type: 'job', id: 2 }, { type: 'job', id: 0 }, { type: 'job', id: 1 }] }],
    }),
  )
  const handler = createOptimizeHandler({
    getUserId: async () => 'user-1',
    getApiKey: () => SECRET,
    getServiceUrl: () => undefined,
    fetchImpl: fetchImpl as unknown as typeof fetch,
    ...overrides,
  })
  return { handler, fetchImpl }
}

describe('POST /api/livrari/optimizeaza', () => {
  it('întoarce opririle în ordinea drumului și trimite cheia doar în antetul cererii către serviciu', async () => {
    const { handler, fetchImpl } = makeHandler()
    const response = await handler(request(validBody))

    expect(response.status).toBe(200)
    const text = await response.text()
    expect(JSON.parse(text)).toEqual({ order: ['c', 'a', 'b'], unassigned: [] })
    // Cheia nu ajunge în răspunsul către client.
    expect(text).not.toContain(SECRET)

    expect(fetchImpl).toHaveBeenCalledTimes(1)
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://api.heigit.org/vroom/v0')
    expect((init.headers as Record<string, string>).Authorization).toBe(SECRET)
    const sent = JSON.parse(String(init.body))
    // Vroom vrea [longitudine, latitudine]; traseul pornește de unde e fermierul.
    expect(sent.jobs).toEqual([
      { id: 0, location: [26.26, 47.66] },
      { id: 1, location: [26.27, 47.67] },
      { id: 2, location: [26.28, 47.68] },
    ])
    expect(sent.vehicles).toEqual([{ id: 1, profile: 'driving-car', start: [26.25, 47.65] }])
  })

  it('fără cheie întoarce 503 cu un mesaj clar și nu apelează serviciul', async () => {
    const { handler, fetchImpl } = makeHandler({ getApiKey: () => undefined })
    const response = await handler(request(validBody))
    expect(response.status).toBe(503)
    expect(await response.json()).toMatchObject({
      error: { code: 'ORS_NOT_CONFIGURED', message: 'Optimizarea nu e configurată încă.' },
    })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('cere autentificare', async () => {
    const { handler, fetchImpl } = makeHandler({ getUserId: async () => null })
    const response = await handler(request(validBody))
    expect(response.status).toBe(401)
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('respinge cererile din altă origine', async () => {
    const { handler, fetchImpl } = makeHandler()
    const response = await handler(request(validBody, { origin: 'https://altundeva.test' }))
    expect(response.status).toBe(403)
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('respinge un traseu nevalid', async () => {
    const { handler, fetchImpl } = makeHandler()
    expect((await handler(request('nu e json'))).status).toBe(400)
    expect((await handler(request({ ...validBody, stops: [validBody.stops[0]] }))).status).toBe(400)
    expect((await handler(request({ ...validBody, start: { lat: 123, lng: 26 } }))).status).toBe(400)
    expect(
      (await handler(request({ ...validBody, stops: [validBody.stops[0], { ...validBody.stops[1], id: 'a' }] }))).status,
    ).toBe(400)
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('când serviciul pică, răspunde 502 fără să dea mai departe corpul erorii', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const { handler } = makeHandler({
      fetchImpl: (async () => new Response(`Forbidden for key ${SECRET}`, { status: 403 })) as unknown as typeof fetch,
    })
    const response = await handler(request(validBody))
    expect(response.status).toBe(502)
    const text = await response.text()
    expect(text).not.toContain(SECRET)
    // Nici în loguri nu ajunge cheia.
    expect(JSON.stringify(errorSpy.mock.calls)).not.toContain(SECRET)
    errorSpy.mockRestore()
  })

  it('folosește adresa din ORS_OPTIMIZATION_URL dacă e pusă', async () => {
    const { handler, fetchImpl } = makeHandler({ getServiceUrl: () => 'https://rutare.exemplu.test/optimizare' })
    await handler(request(validBody))
    expect((fetchImpl.mock.calls[0] as unknown as [string])[0]).toBe('https://rutare.exemplu.test/optimizare')
  })
})

describe('orderFromVroom', () => {
  it('lasă la final opririle pe care serviciul nu le-a așezat', () => {
    expect(
      orderFromVroom({ routes: [{ steps: [{ type: 'job', id: 1 }] }], unassigned: [{ id: 0 }] }, ['a', 'b']),
    ).toEqual({ order: ['b'], unassigned: ['a'] })
  })

  it('nu se strică la un răspuns gol', () => {
    expect(orderFromVroom({}, ['a', 'b'])).toEqual({ order: [], unassigned: ['a', 'b'] })
  })
})
