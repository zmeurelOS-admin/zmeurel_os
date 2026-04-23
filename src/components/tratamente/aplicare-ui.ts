import type { Json } from '@/types/supabase'

type AplicareProdusLike = {
  produs?: { nume_comercial?: string | null } | null
  produs_nume_snapshot?: string | null
  produs_nume_manual?: string | null
}

type AplicareLike = {
  sursa?: string | null
  plan_linie_id?: string | null
  plan_nume?: string | null
  tip_interventie?: string | null
  scop?: string | null
  produs?: { nume_comercial?: string | null } | null
  produs_nume?: string | null
  produs_nume_manual?: string | null
  produse_aplicare?: AplicareProdusLike[] | null
}

function formatLabel(value: string): string {
  const normalized = value.replaceAll('_', ' ').trim()
  if (!normalized) return normalized
  return normalized.charAt(0).toUpperCase() + normalized.slice(1)
}

function trimLabel(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function normalizeSource(value: string | null | undefined, planLinieId: string | null | undefined): 'din_plan' | 'manuala' {
  if (value === 'manuala') return 'manuala'
  return planLinieId ? 'din_plan' : 'manuala'
}

function getProductName(produs: AplicareProdusLike | null | undefined): string | null {
  if (!produs) return null
  return trimLabel(produs.produs?.nume_comercial ?? produs.produs_nume_snapshot ?? produs.produs_nume_manual)
}

export function getAplicareSourceLabel(aplicare: Pick<AplicareLike, 'sursa' | 'plan_linie_id'>): string {
  return normalizeSource(aplicare.sursa, aplicare.plan_linie_id) === 'manuala' ? 'Manuală' : 'Din plan'
}

export function getAplicareContextLabel(aplicare: AplicareLike): string {
  const source = normalizeSource(aplicare.sursa, aplicare.plan_linie_id)
  const scope = trimLabel(aplicare.scop)
  const type = trimLabel(aplicare.tip_interventie)
  const planName = trimLabel(aplicare.plan_nume)
  const typeLabel = type ? formatLabel(type) : null

  if (source === 'manuala') {
    const details = [typeLabel, scope].filter(Boolean).join(' · ')
    return details ? `Manuală · ${details}` : 'Manuală'
  }

  const details = [planName ? `Plan: ${planName}` : null, typeLabel, scope].filter(Boolean).join(' · ')
  return details ? `Din plan · ${details}` : 'Din plan'
}

export function getAplicareInterventieLabel(aplicare: AplicareLike): string {
  const scope = trimLabel(aplicare.scop)
  const type = trimLabel(aplicare.tip_interventie)
  if (scope && type) return `${formatLabel(type)} · ${scope}`
  if (scope) return scope
  if (type) return formatLabel(type)
  return 'Intervenție nespecificată'
}

export function getAplicareProduseSummary(
  aplicare: Pick<AplicareLike, 'produs' | 'produs_nume' | 'produs_nume_manual' | 'produse_aplicare'>
): {
  title: string
  detail: string | null
  count: number
} {
  const produse = aplicare.produse_aplicare ?? []
  const names = produse.map(getProductName).filter((value): value is string => Boolean(value))

  if (names.length > 0) {
    return {
      title: names[0],
      detail: names.length > 1 ? names.slice(1, 3).join(' · ') : null,
      count: names.length,
    }
  }

  const fallback = trimLabel(aplicare.produs?.nume_comercial ?? aplicare.produs_nume ?? aplicare.produs_nume_manual)
  return {
    title: fallback ?? 'Produs necompletat',
    detail: null,
    count: fallback ? 1 : 0,
  }
}

function collectDifferenceItems(value: Json | null | undefined): string[] {
  if (!value) return []

  if (Array.isArray(value)) {
    return value.flatMap((item) => (typeof item === 'string' ? [item.trim()] : []))
      .filter((item) => Boolean(item))
  }

  if (typeof value === 'string') {
    const text = value.trim()
    return text ? [text] : []
  }

  if (typeof value !== 'object') return []

  const candidate = value as Record<string, unknown>
  const items: string[] = []
  const automat = candidate.automat
  if (Array.isArray(automat)) {
    items.push(
      ...automat.flatMap((entry) => (typeof entry === 'string' ? [entry.trim()] : []))
        .filter((entry) => Boolean(entry))
    )
  }

  const observatii = candidate.observatii
  if (typeof observatii === 'string' && observatii.trim()) {
    items.push(observatii.trim())
  }

  const observatiiManuale = candidate.observatii_manuale
  if (typeof observatiiManuale === 'string' && observatiiManuale.trim()) {
    items.push(observatiiManuale.trim())
  }

  return Array.from(new Set(items))
}

export function formatDifferencesSummary(value: Json | null | undefined): string[] {
  return collectDifferenceItems(value)
}
