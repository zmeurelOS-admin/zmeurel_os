import type { ProdusFitosanitar, InsertTenantProdus } from '@/lib/supabase/queries/tratamente'

export type LibraryProdusOption = Pick<
  ProdusFitosanitar,
  | 'id'
  | 'tenant_id'
  | 'nume_comercial'
  | 'substanta_activa'
  | 'tip'
  | 'frac_irac'
  | 'phi_zile'
  | 'doza_min_ml_per_hl'
  | 'doza_max_ml_per_hl'
  | 'doza_min_l_per_ha'
  | 'doza_max_l_per_ha'
  | 'omologat_culturi'
  | 'activ'
>

export interface FuzzySuggestion {
  produs_id: string
  produs_nume: string
  scor: number
}

export type ProdusMatch =
  | { tip: 'exact'; produs_id: string; produs_nume: string }
  | { tip: 'fuzzy'; sugestii: FuzzySuggestion[] }
  | { tip: 'none' }

export interface ParsedLine {
  ordine: number
  stadiu_trigger: string
  cohort_trigger?: 'floricane' | 'primocane' | null
  stadiu_input_raw: string
  produs_input: string
  produs_match: ProdusMatch
  doza_ml_per_hl: number | null
  doza_l_per_ha: number | null
  observatii: string | null
  warnings: string[]
  errors: string[]
}

export interface ParsedPlan {
  foaie_nume: string
  plan_metadata: {
    nume_sugerat: string
    cultura_tip_detectat: string | null
    descriere: string | null
  }
  linii: ParsedLine[]
  errors: Array<{ row: number; message: string }>
}

export interface ParseResult {
  planuri: ParsedPlan[]
  global_errors: string[]
}

export type DraftProdusImport = Omit<InsertTenantProdus, 'activ'> & {
  activ?: boolean
}

export interface PlanSaveLineInput {
  ordine: number
  stadiu_trigger: string
  cohort_trigger?: 'floricane' | 'primocane' | null
  produs_id: string | null
  produs_nume_manual: string | null
  doza_ml_per_hl: number | null
  doza_l_per_ha: number | null
  observatii: string | null
  produs_de_creat?: DraftProdusImport
}

export interface PlanSaveInput {
  plan_metadata: {
    nume: string
    cultura_tip: string
    descriere: string | null
  }
  linii: PlanSaveLineInput[]
}
