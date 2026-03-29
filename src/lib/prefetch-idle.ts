type PrefetchRouter = {
  prefetch: (href: string) => void | Promise<void>
}

type IdleWindow = Window & {
  requestIdleCallback?: (
    callback: IdleRequestCallback,
    options?: IdleRequestOptions
  ) => number
  cancelIdleCallback?: (handle: number) => void
}

type ConnectionInfo = {
  saveData?: boolean
  effectiveType?: string
}

const prefetchedRoutes = new Set<string>()
const CONSTRAINED_NETWORKS = new Set(['slow-2g', '2g'])

function shouldSkipIdlePrefetch(): boolean {
  if (typeof window === 'undefined') return true

  const connection = (navigator as Navigator & { connection?: ConnectionInfo }).connection
  if (!connection) return false

  if (connection.saveData) return true
  return CONSTRAINED_NETWORKS.has(connection.effectiveType ?? '')
}

export function scheduleIdlePrefetch(router: PrefetchRouter, hrefs: string[]): () => void {
  if (shouldSkipIdlePrefetch()) {
    return () => {}
  }

  const idleWindow = window as IdleWindow
  const pending = Array.from(new Set(hrefs)).filter((href) => !prefetchedRoutes.has(href))
  if (pending.length === 0) {
    return () => {}
  }

  const run = () => {
    pending.forEach((href) => {
      prefetchedRoutes.add(href)
      void router.prefetch(href)
    })
  }

  if (typeof idleWindow.requestIdleCallback === 'function') {
    const handle = idleWindow.requestIdleCallback(run, { timeout: 1500 })
    return () => {
      idleWindow.cancelIdleCallback?.(handle)
    }
  }

  const timeoutId = window.setTimeout(run, 600)
  return () => {
    window.clearTimeout(timeoutId)
  }
}
