import { formatUnitateDisplayName } from '@/lib/parcele/unitate'
import type { Parcela } from '@/lib/supabase/queries/parcele'

function normalizeForExactMatch(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function getParcelaHintCandidates(parcela: Parcela): string[] {
  return [
    parcela.nume_parcela,
    formatUnitateDisplayName(parcela.nume_parcela, parcela.tip_unitate, ''),
    parcela.soi_plantat,
    parcela.soi,
    parcela.tip_fruct,
    parcela.cultura,
  ]
    .map((candidate) => normalizeForExactMatch(candidate ?? ''))
    .filter(Boolean)
}

/**
 * Canonical resolver for recoltare -> parcela:
 * 1) keep parcela_id only if it exists in current tenant list
 * 2) optional fallback by exact unique label/alias match
 * 3) otherwise return null (avoid false associations)
 */
export function resolveRecoltareParcelaId(params: {
  parcelaId?: string | null
  parcelaLabel?: string | null
  parcele: Parcela[]
}): string | null {
  const byId = (params.parcelaId ?? '').trim()
  if (byId && params.parcele.some((parcela) => parcela.id === byId)) {
    return byId
  }

  const normalizedLabel = normalizeForExactMatch(params.parcelaLabel ?? '')
  if (!normalizedLabel) return null

  const exactMatches = Array.from(
    new Set(
      params.parcele
        .filter((parcela) =>
          getParcelaHintCandidates(parcela).some((candidate) => candidate === normalizedLabel)
        )
        .map((parcela) => parcela.id)
    )
  )

  return exactMatches.length === 1 ? exactMatches[0] : null
}
