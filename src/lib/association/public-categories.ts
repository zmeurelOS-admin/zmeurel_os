import { cache } from 'react'

import {
  ASSOCIATION_CATEGORY_KEYS,
  ASSOCIATION_CATEGORY_LABELS,
  type AssociationCategoryKey,
  type AssociationCategoryDefinition,
  DEFAULT_ASSOCIATION_CATEGORY_DEFINITIONS,
} from '@/components/shop/association/tokens'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyAdmin = any

function isAssociationCategoryKey(value: string): value is AssociationCategoryKey {
  return (ASSOCIATION_CATEGORY_KEYS as readonly string[]).includes(value)
}

function fallbackDefinition(key: AssociationCategoryKey): AssociationCategoryDefinition {
  return (
    DEFAULT_ASSOCIATION_CATEGORY_DEFINITIONS.find((row) => row.key === key) ?? {
      key,
      label: ASSOCIATION_CATEGORY_LABELS[key],
      sortOrder: 999,
    }
  )
}

export async function loadAssociationCategoryDefinitions(): Promise<AssociationCategoryDefinition[]> {
  const admin = getSupabaseAdmin() as AnyAdmin

  try {
    const { data, error } = await admin
      .from('association_categories')
      .select('key, label, sort_order, is_active')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })

    if (error || !Array.isArray(data) || data.length === 0) {
      return [...DEFAULT_ASSOCIATION_CATEGORY_DEFINITIONS]
    }

    const normalized = new Map<AssociationCategoryKey, AssociationCategoryDefinition>()
    for (const row of data as Array<{
      key?: string | null
      label?: string | null
      sort_order?: number | null
    }>) {
      const key = row.key?.trim() ?? ''
      if (!isAssociationCategoryKey(key)) continue
      normalized.set(key, {
        key,
        label: row.label?.trim() || ASSOCIATION_CATEGORY_LABELS[key],
        sortOrder: Number.isFinite(row.sort_order) ? Number(row.sort_order) : fallbackDefinition(key).sortOrder,
      })
    }

    for (const key of ASSOCIATION_CATEGORY_KEYS) {
      if (!normalized.has(key)) {
        normalized.set(key, fallbackDefinition(key))
      }
    }

    return Array.from(normalized.values()).sort((a, b) => {
      if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder
      return a.label.localeCompare(b.label, 'ro')
    })
  } catch (error) {
    console.warn('[association-categories] load failed', error)
    return [...DEFAULT_ASSOCIATION_CATEGORY_DEFINITIONS]
  }
}

export const loadAssociationCategoryDefinitionsCached = cache(loadAssociationCategoryDefinitions)
