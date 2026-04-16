const STORAGE_PREFIX = 'association-deliveries-order:'

function storageKey(scope: string) {
  return `${STORAGE_PREFIX}${scope}`
}

export function readDeliveryLocalOrder(scope: string): string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(storageKey(scope))
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((value): value is string => typeof value === 'string' && value.length > 0)
  } catch {
    return []
  }
}

export function writeDeliveryLocalOrder(scope: string, ids: string[]) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(storageKey(scope), JSON.stringify(ids))
  } catch {
    // localStorage indisponibil - ignorăm
  }
}

export function mergeDeliveryLocalOrder<T extends { id: string }>(items: T[], preferredIds: string[]): T[] {
  if (preferredIds.length === 0) return items

  const itemById = new Map(items.map((item) => [item.id, item]))
  const ordered: T[] = []
  const seen = new Set<string>()

  for (const id of preferredIds) {
    const item = itemById.get(id)
    if (!item) continue
    ordered.push(item)
    seen.add(id)
  }

  for (const item of items) {
    if (seen.has(item.id)) continue
    ordered.push(item)
  }

  return ordered
}
