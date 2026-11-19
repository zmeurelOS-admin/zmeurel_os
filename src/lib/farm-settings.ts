/**
 * Setările pe fermă adăugate de migrarea `20261120090000_redesign_noapte.sql` în `tenant_settings`:
 * prețul standard pe perioade și ce arată Acasă.
 *
 * - `tenant_settings` poate să nu aibă rând pentru o fermă: se citește cu `maybeSingle`.
 * - Cât coloanele lipsesc, citirea întoarce valorile de rezervă, iar scrierea e refuzată (nu trimitem
 *   coloane pe care baza de date nu le are).
 */
import { useQuery } from '@tanstack/react-query'

import { loadSchemaFeaturesSafe } from '@/lib/schema-features'
import { getSupabase } from '@/lib/supabase/client'
import { getTenantId } from '@/lib/tenant/get-tenant'

export type PerioadaPret = 'inceput' | 'varf' | 'mediu'
export type AcasaPerioadaMod = 'auto' | 'sezon' | 'extrasezon'

export interface AcasaExtrasezonAfiseaza {
  comenzi_butasi: boolean
  rest_incasat: boolean
  lucrari: boolean
  inghet: boolean
}

export interface FarmSettings {
  /** Coloanele de preț standard există (se pot schimba din Setări). */
  pretStandardConfigurabil: boolean
  pretInceput: number | null
  pretVarf: number | null
  pretMediu: number | null
  pretPerioada: PerioadaPret | null

  /** Coloanele pentru perioada Acasă există. */
  acasaConfigurabil: boolean
  acasaPerioadaMod: AcasaPerioadaMod
  extrasezonInceputLa: string | null
  extrasezonAmanatPana: string | null
  /** Lună-zi, ex. `10-25`. */
  extrasezonIntrebareDin: string
  acasaExtrasezonAfiseaza: AcasaExtrasezonAfiseaza
}

export const EXTRASEZON_INTREBARE_DIN_IMPLICIT = '10-25'

export const ACASA_EXTRASEZON_TOATE: AcasaExtrasezonAfiseaza = {
  comenzi_butasi: true,
  rest_incasat: true,
  lucrari: true,
  inghet: true,
}

export const FARM_SETTINGS_REZERVA: FarmSettings = {
  pretStandardConfigurabil: false,
  pretInceput: null,
  pretVarf: null,
  pretMediu: null,
  pretPerioada: null,
  acasaConfigurabil: false,
  acasaPerioadaMod: 'auto',
  extrasezonInceputLa: null,
  extrasezonAmanatPana: null,
  extrasezonIntrebareDin: EXTRASEZON_INTREBARE_DIN_IMPLICIT,
  acasaExtrasezonAfiseaza: ACASA_EXTRASEZON_TOATE,
}

const PRET_COLUMNS = [
  'pret_standard_inceput_lei_kg',
  'pret_standard_varf_lei_kg',
  'pret_standard_mediu_lei_kg',
  'pret_standard_perioada',
] as const

const ACASA_COLUMNS = [
  'acasa_perioada_mod',
  'extrasezon_inceput_la',
  'extrasezon_amanat_pana',
  'extrasezon_intrebare_din',
  'acasa_extrasezon_afiseaza',
] as const

type SettingsRow = Partial<Record<(typeof PRET_COLUMNS)[number] | (typeof ACASA_COLUMNS)[number], unknown>>

const MONTH_DAY = /^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$/
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/

function toPrice(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? number : null
}

function toIsoDay(value: unknown): string | null {
  const text = typeof value === 'string' ? value.slice(0, 10) : ''
  return ISO_DAY.test(text) ? text : null
}

function toAfiseaza(value: unknown): AcasaExtrasezonAfiseaza {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return ACASA_EXTRASEZON_TOATE
  const raw = value as Record<string, unknown>
  // O cheie lipsă înseamnă „arată”: doar `false` scris explicit ascunde.
  return {
    comenzi_butasi: raw.comenzi_butasi !== false,
    rest_incasat: raw.rest_incasat !== false,
    lucrari: raw.lucrari !== false,
    inghet: raw.inghet !== false,
  }
}

/** Funcție pură: rândul din `tenant_settings` (sau `null`) → setările, cu rezervele puse. */
export function mapFarmSettings(
  row: SettingsRow | null,
  has: { pretStandard: boolean; acasaPerioada: boolean },
): FarmSettings {
  const perioada = row?.pret_standard_perioada
  const mod = row?.acasa_perioada_mod
  const intrebare = row?.extrasezon_intrebare_din
  return {
    pretStandardConfigurabil: has.pretStandard,
    pretInceput: has.pretStandard ? toPrice(row?.pret_standard_inceput_lei_kg) : null,
    pretVarf: has.pretStandard ? toPrice(row?.pret_standard_varf_lei_kg) : null,
    pretMediu: has.pretStandard ? toPrice(row?.pret_standard_mediu_lei_kg) : null,
    pretPerioada:
      has.pretStandard && (perioada === 'inceput' || perioada === 'varf' || perioada === 'mediu') ? perioada : null,
    acasaConfigurabil: has.acasaPerioada,
    acasaPerioadaMod: has.acasaPerioada && (mod === 'sezon' || mod === 'extrasezon') ? mod : 'auto',
    extrasezonInceputLa: has.acasaPerioada ? toIsoDay(row?.extrasezon_inceput_la) : null,
    extrasezonAmanatPana: has.acasaPerioada ? toIsoDay(row?.extrasezon_amanat_pana) : null,
    extrasezonIntrebareDin:
      has.acasaPerioada && typeof intrebare === 'string' && MONTH_DAY.test(intrebare)
        ? intrebare
        : EXTRASEZON_INTREBARE_DIN_IMPLICIT,
    acasaExtrasezonAfiseaza: has.acasaPerioada ? toAfiseaza(row?.acasa_extrasezon_afiseaza) : ACASA_EXTRASEZON_TOATE,
  }
}

type LooseTable = {
  select: (columns: string) => {
    eq: (column: string, value: string) => {
      maybeSingle: () => PromiseLike<{ data: SettingsRow | null; error: { message?: string } | null }>
    }
  }
  upsert: (
    values: Record<string, unknown>,
    options: { onConflict: string },
  ) => PromiseLike<{ error: { message?: string } | null }>
}

function settingsTable(): LooseTable {
  return (getSupabase() as unknown as { from: (table: string) => LooseTable }).from('tenant_settings')
}

export async function getFarmSettings(): Promise<FarmSettings> {
  const features = await loadSchemaFeaturesSafe()
  const has = { pretStandard: features.pretStandard, acasaPerioada: features.acasaPerioada }
  const columns = [...(has.pretStandard ? PRET_COLUMNS : []), ...(has.acasaPerioada ? ACASA_COLUMNS : [])]
  if (columns.length === 0) return FARM_SETTINGS_REZERVA

  const tenantId = await getTenantId(getSupabase())
  const { data, error } = await settingsTable().select(columns.join(',')).eq('tenant_id', tenantId).maybeSingle()
  if (error) throw new Error(error.message || 'Setările fermei nu s-au încărcat.')
  return mapFarmSettings(data, has)
}

export interface FarmSettingsPatch {
  pretInceput?: number | null
  pretVarf?: number | null
  pretMediu?: number | null
  pretPerioada?: PerioadaPret | null
  acasaPerioadaMod?: AcasaPerioadaMod
  extrasezonInceputLa?: string | null
  extrasezonAmanatPana?: string | null
  extrasezonIntrebareDin?: string
  acasaExtrasezonAfiseaza?: AcasaExtrasezonAfiseaza
}

const PATCH_COLUMNS: Record<keyof FarmSettingsPatch, { column: string; group: 'pretStandard' | 'acasaPerioada' }> = {
  pretInceput: { column: 'pret_standard_inceput_lei_kg', group: 'pretStandard' },
  pretVarf: { column: 'pret_standard_varf_lei_kg', group: 'pretStandard' },
  pretMediu: { column: 'pret_standard_mediu_lei_kg', group: 'pretStandard' },
  pretPerioada: { column: 'pret_standard_perioada', group: 'pretStandard' },
  acasaPerioadaMod: { column: 'acasa_perioada_mod', group: 'acasaPerioada' },
  extrasezonInceputLa: { column: 'extrasezon_inceput_la', group: 'acasaPerioada' },
  extrasezonAmanatPana: { column: 'extrasezon_amanat_pana', group: 'acasaPerioada' },
  extrasezonIntrebareDin: { column: 'extrasezon_intrebare_din', group: 'acasaPerioada' },
  acasaExtrasezonAfiseaza: { column: 'acasa_extrasezon_afiseaza', group: 'acasaPerioada' },
}

/**
 * Scrie doar câmpurile primite. `tenant_settings` are `unique (tenant_id)` (migrarea `2026033004`),
 * deci `upsert` pe `tenant_id` creează rândul dacă lipsește, fără să atingă celelalte coloane.
 */
export async function saveFarmSettings(patch: FarmSettingsPatch): Promise<void> {
  const features = await loadSchemaFeaturesSafe()
  const values: Record<string, unknown> = {}
  for (const key of Object.keys(patch) as Array<keyof FarmSettingsPatch>) {
    const target = PATCH_COLUMNS[key]
    if (!target || patch[key] === undefined) continue
    if (!features[target.group]) {
      throw new Error('Setarea se activează după actualizarea bazei de date.')
    }
    values[target.column] = patch[key]
  }
  if (Object.keys(values).length === 0) return

  const tenantId = await getTenantId(getSupabase())
  const { error } = await settingsTable().upsert({ tenant_id: tenantId, ...values }, { onConflict: 'tenant_id' })
  if (error) throw new Error(error.message || 'Setările nu s-au salvat.')
}

export const farmSettingsQueryKey = ['farm-settings'] as const

/** Setările fermei, cu rezervele puse cât se încarcă sau la eroare. */
export function useFarmSettings(): { settings: FarmSettings; isLoading: boolean } {
  const { data, isLoading } = useQuery({
    queryKey: farmSettingsQueryKey,
    queryFn: getFarmSettings,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  })
  return { settings: data ?? FARM_SETTINGS_REZERVA, isLoading }
}
