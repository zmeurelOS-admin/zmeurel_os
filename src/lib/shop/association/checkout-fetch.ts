const SHOP_ORDER_TIMEOUT_MS = 10_000

function fetchShopOrder(body: object, signal: AbortSignal): Promise<Response> {
  return fetch('/api/shop/order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  })
}

/**
 * POST /api/shop/order cu timeout 10s și o reîncercare la eșec de rețea sau răspuns 5xx.
 */
export async function postShopOrderWithRetry(body: object): Promise<Response> {
  const run = async (): Promise<Response> => {
    const ctrl = new AbortController()
    const tid = window.setTimeout(() => ctrl.abort(), SHOP_ORDER_TIMEOUT_MS)
    try {
      return await fetchShopOrder(body, ctrl.signal)
    } finally {
      window.clearTimeout(tid)
    }
  }

  try {
    const res = await run()
    if (res.ok || res.status < 500) return res
    return await run()
  } catch {
    return run()
  }
}
