import { normalizeUnitateTip, type UnitateTip } from '@/lib/parcele/unitate'

export const CUSTOM_CULTURA_OPTION = '__custom__'

const BASE_CULTURI_PER_TIP: Record<UnitateTip, string[]> = {
  camp: ['Zmeură', 'Mure', 'Afine', 'Căpșuni', 'Coacăze', 'Agrișe', 'Goji'],
  solar: [
    'Roșii',
    'Castraveți',
    'Ardei',
    'Vinete',
    'Salată',
    'Spanac',
    'Fasole',
    'Dovlecei',
    'Legume frunzoase',
  ],
  livada: ['Măr', 'Păr', 'Cireș', 'Vișin', 'Prun', 'Cais', 'Piersic', 'Nuc', 'Alun'],
  cultura_mare: ['Grâu', 'Porumb', 'Floarea soarelui', 'Rapiță', 'Soia', 'Orz', 'Ovăz', 'Cartofi', 'Sfeclă'],
}

export const CULTURI_PER_TIP: Record<UnitateTip, string[]> = {
  camp: [...BASE_CULTURI_PER_TIP.camp, 'Altele'],
  solar: [...BASE_CULTURI_PER_TIP.solar, 'Altele'],
  livada: [...BASE_CULTURI_PER_TIP.livada, 'Altele'],
  cultura_mare: [...BASE_CULTURI_PER_TIP.cultura_mare, 'Altele'],
}

export function getCulturiOptions(tipUnitate: string | null | undefined): string[] {
  return CULTURI_PER_TIP[normalizeUnitateTip(tipUnitate)]
}

export function getTipPlantaPlaceholder(tipUnitate: string | null | undefined): string {
  const tip = normalizeUnitateTip(tipUnitate)
  if (tip === 'solar') return 'Ex: Roșii, Castraveți, Ardei'
  if (tip === 'livada') return 'Ex: Măr, Păr, Cireș'
  if (tip === 'cultura_mare') return 'Ex: Grâu, Porumb, Soia'
  return 'Ex: Zmeură, Afine, Căpșuni'
}

export function getTipPlantaSelectValue(
  tipPlanta: string | null | undefined,
  tipUnitate: string | null | undefined
): string {
  const current = (tipPlanta ?? '').trim()
  if (!current) return ''
  const options = BASE_CULTURI_PER_TIP[normalizeUnitateTip(tipUnitate)]
  return options.includes(current) ? current : CUSTOM_CULTURA_OPTION
}

export function getCulturaFieldConfig(tipUnitate: string | null | undefined): {
  plantCountLabel: string
  showRowCount: boolean
  showRowSpacing: boolean
  rowCountLabel: string
  rowSpacingLabel: string
} {
  const tip = normalizeUnitateTip(tipUnitate)

  return {
    plantCountLabel: tip === 'livada' ? 'Număr pomi' : 'Număr plante',
    showRowCount: tip === 'camp' || tip === 'solar',
    showRowSpacing: tip !== 'cultura_mare',
    rowCountLabel: 'Număr rânduri',
    rowSpacingLabel: tip === 'livada' ? 'Distanța între pomi (m)' : 'Distanța între rânduri (m)',
  }
}

export function getSoiPlaceholder(tipPlanta: string | null | undefined): string {
  const tip = (tipPlanta ?? '').trim().toLowerCase()
  if (tip === 'zmeură' || tip === 'zmeurа') return 'Ex: Delniwa, Maravilla'
  if (tip === 'căpșuni') return 'Ex: Elsanta, Albion'
  if (tip === 'castraveți') return 'Ex: Cornișon'
  if (tip === 'roșii') return 'Ex: Siriana F1, Buzău 1600'
  if (tip === 'ardei') return 'Ex: Kapi F1, Aida F1'
  if (tip === 'mure') return 'Ex: Chester, Triple Crown'
  if (tip === 'afine') return 'Ex: Bluecrop, Toro'
  return ''
}

export function getConditiiMediuLabel(tipUnitate: string | null | undefined): string {
  return normalizeUnitateTip(tipUnitate) === 'solar' ? 'Microclimat' : 'Condiții de mediu'
}

export function getConditiiMediuLabelLower(tipUnitate: string | null | undefined): string {
  const label = getConditiiMediuLabel(tipUnitate)
  return label.charAt(0).toLowerCase() + label.slice(1)
}
