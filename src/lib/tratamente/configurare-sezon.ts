import { getLabelRo, type GrupBiologic, type StadiuCod } from '@/lib/tratamente/stadii-canonic'

export type SistemConducere = 'primocane_only' | 'mixt_floricane_primocane'

export type TipCicluSoi = 'determinat' | 'nedeterminat'

export type Cohorta = 'floricane' | 'primocane'

export interface ConfigurareSezon {
  id: string
  tenant_id: string
  parcela_id: string
  an: number
  sistem_conducere: SistemConducere | null
  tip_ciclu_soi: TipCicluSoi | null
  created_at: string
  updated_at: string
}

export interface UpsertConfigurareSezon {
  parcela_id: string
  an: number
  sistem_conducere?: SistemConducere | null
  tip_ciclu_soi?: TipCicluSoi | null
}

const RUBUS_GROUP: GrupBiologic = 'rubus'
const SOLANACEE_GROUP: GrupBiologic = 'solanacee'

export function getCohortaLabel(cohorta: Cohorta): string {
  return cohorta === 'floricane' ? 'Floricane' : 'Primocane'
}

export function getSistemConducereLabel(val: SistemConducere): string {
  return val === 'primocane_only'
    ? 'Doar lăstari an 1 (primocane)'
    : 'Mixt: lăstari an 1 + an 2'
}

export function getTipCicluSoiLabel(val: TipCicluSoi): string {
  return val === 'determinat' ? 'Soi determinat' : 'Soi nedeterminat'
}

export function needsConfigurareSezon(grupBiologic: GrupBiologic | null): boolean {
  return grupBiologic === RUBUS_GROUP || grupBiologic === SOLANACEE_GROUP
}

export function isRubusMixt(configurare: ConfigurareSezon | null | undefined): boolean {
  return configurare?.sistem_conducere === 'mixt_floricane_primocane'
}

export function needsCohortSelection(
  grupBiologic: GrupBiologic | null,
  configurare: ConfigurareSezon | null | undefined
): boolean {
  return grupBiologic === RUBUS_GROUP && isRubusMixt(configurare)
}

export function getLabelStadiuContextual(
  cod: StadiuCod,
  configurare: ConfigurareSezon | null
): string {
  if (cod === 'post_recoltare' && configurare?.tip_ciclu_soi === 'nedeterminat') {
    return 'Producție în curs'
  }

  return getLabelRo(cod)
}
