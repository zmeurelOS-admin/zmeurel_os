import type { AppSelectOption } from '@/components/ui/app-select'
import { CATEGORII_CHELTUIELI, CATEGORII_INVESTITII } from '@/lib/financial/categories'
import {
  getSistemConducereLabel,
  getTipCicluSoiLabel,
} from '@/lib/tratamente/configurare-sezon'
import type { StadiuCod } from '@/lib/tratamente/stadii-canonic'

/** Emoji per categorie OPEX — sursă unică pentru AppSelect în cheltuieli. */
export const CHELTUIELI_CATEGORY_EMOJI: Record<(typeof CATEGORII_CHELTUIELI)[number], string> = {
  Fertilizanți: '🌱',
  'Tratamente fitosanitare': '🧪',
  Ambalaje: '📦',
  'Forță de muncă': '👷',
  'Combustibil și energie': '⛽',
  Consumabile: '🔩',
  'Transport și livrare': '🚚',
  'Reparații și întreținere': '🔧',
  'Servicii și taxe': '📋',
  'Diverse operaționale': '💼',
}

/** Emoji per categorie CAPEX — sursă unică pentru AppSelect în investiții. */
export const INVESTITII_CATEGORY_EMOJI: Record<(typeof CATEGORII_INVESTITII)[number], string> = {
  'Material săditor': '🌿',
  'Irigații și fertigare': '💧',
  'Sisteme de susținere și protecție': '🏗️',
  'Construcții și amenajări': '🏠',
  'Utilaje și echipamente': '🚜',
  'Depozitare și răcire': '❄️',
  'Infrastructură și utilități': '⚡',
  'IT și automatizări': '💻',
  'Alte investiții': '📦',
}

export const COHORTA_APP_SELECT_OPTIONS: AppSelectOption[] = [
  { value: '', label: 'Selectează cohorta' },
  { value: 'floricane', label: 'Floricane', emoji: '🌳' },
  { value: 'primocane', label: 'Primocane', emoji: '🌱' },
]

export const COHORTA_REQUIRED_APP_SELECT_OPTIONS: AppSelectOption[] =
  COHORTA_APP_SELECT_OPTIONS.filter((option) => option.value !== '')

export const PRODUS_FITOSANITAR_TIP_APP_SELECT_OPTIONS: AppSelectOption[] = [
  { value: 'fungicid', label: 'Fungicid', emoji: '🛡️' },
  { value: 'insecticid', label: 'Insecticid', emoji: '🐛' },
  { value: 'erbicid', label: 'Erbicid', emoji: '🌿' },
  { value: 'acaricid', label: 'Acaricid', emoji: '🕷️' },
  { value: 'foliar', label: 'Foliar', emoji: '🍃' },
  { value: 'ingrasamant', label: 'Îngrășământ', emoji: '🌱' },
  { value: 'bioregulator', label: 'Bioregulator', emoji: '✨' },
  { value: 'altul', label: 'Altul', emoji: '📦' },
]

export const SISTEM_CONDUCERE_APP_SELECT_OPTIONS: AppSelectOption[] = [
  { value: '', label: 'Selectează sistemul' },
  {
    value: 'primocane_only',
    label: getSistemConducereLabel('primocane_only'),
    emoji: '🌱',
  },
  {
    value: 'mixt_floricane_primocane',
    label: getSistemConducereLabel('mixt_floricane_primocane'),
    emoji: '🌳',
  },
]

export const TIP_CICLU_SOI_APP_SELECT_OPTIONS: AppSelectOption[] = [
  { value: '', label: 'Selectează tipul de ciclu' },
  { value: 'determinat', label: getTipCicluSoiLabel('determinat'), emoji: '📏' },
  { value: 'nedeterminat', label: getTipCicluSoiLabel('nedeterminat'), emoji: '🔄' },
]

export const TIP_INTERVENTIE_APP_SELECT_OPTIONS: AppSelectOption[] = [
  { value: 'foliar', label: 'Foliar', emoji: '🍃' },
  { value: 'fertirigare', label: 'Fertirigare', emoji: '💧' },
  { value: 'aplicare_sol', label: 'Aplicare pe sol', emoji: '🌍' },
  { value: 'tratament_radacini', label: 'Tratament rădăcini (drenching)', emoji: '🪴' },
  { value: 'badijonare', label: 'Badijonare tulpină', emoji: '🌿' },
  { value: 'alt_tip', label: 'Alt tip', emoji: '✏️' },
]

export const SCOP_INTERVENTIE_APP_SELECT_OPTIONS: AppSelectOption[] = [
  { value: 'fertilizare_baza', label: 'Fertilizare de bază', emoji: '🌱' },
  { value: 'stimulare_inflorire', label: 'Stimulare înflorire', emoji: '🌸' },
  { value: 'stimulare_fructificare', label: 'Stimulare fructificare', emoji: '🫐' },
  { value: 'protectie_fungica', label: 'Protecție fungică', emoji: '🛡️' },
  { value: 'protectie_insecticida', label: 'Protecție insecticidă', emoji: '🐛' },
  { value: 'corectare_carente', label: 'Corectare carențe', emoji: '💊' },
  { value: 'biostimulare', label: 'Biostimulare', emoji: '✨' },
  { value: 'dezinfectie_sol', label: 'Dezinfecție sol', emoji: '🧹' },
  { value: 'alt_scop', label: 'Alt scop', emoji: '✏️' },
]

export const REPETARE_REGULA_APP_SELECT_OPTIONS: AppSelectOption[] = [
  { value: 'fara_repetare', label: 'Fără repetare', emoji: '⏹️' },
  { value: 'interval', label: 'La interval', emoji: '🔁' },
]

export const PRODUCT_TYPE_APP_SELECT_OPTIONS: AppSelectOption[] = [
  { value: 'ingrasamant', label: 'Îngrășământ / fertilizant', emoji: '🌱' },
  { value: 'fitosanitar', label: 'Produs fitosanitar (fungicid, insecticid, erbicid)', emoji: '🧪' },
  { value: 'biostimulator', label: 'Biostimulator', emoji: '✨' },
  { value: 'amendament', label: 'Amendament sol', emoji: '🌍' },
  { value: 'alt_produs', label: 'Alt produs', emoji: '📦' },
]

export const DOZA_UNITATE_APP_SELECT_OPTIONS: AppSelectOption[] = [
  { value: 'ml/hl', label: 'ml/hl', emoji: '💧' },
  { value: 'l/ha', label: 'l/ha', emoji: '🌾' },
]

export function buildCategoryCheltuieliOptions(
  placeholder = 'Selectează categoria'
): AppSelectOption[] {
  return [
    { value: '', label: placeholder },
    ...CATEGORII_CHELTUIELI.map((label) => ({
      value: label,
      label,
      emoji: CHELTUIELI_CATEGORY_EMOJI[label],
    })),
  ]
}

export function buildCategoryInvestitiiOptions(
  placeholder = 'Selectează categoria'
): AppSelectOption[] {
  return [
    { value: '', label: placeholder },
    ...CATEGORII_INVESTITII.map((label) => ({
      value: label,
      label,
      emoji: INVESTITII_CATEGORY_EMOJI[label],
    })),
  ]
}

export function buildStadiuAppSelectOptions(
  options: ReadonlyArray<{ value: string; label: string; emoji?: string }>,
  placeholder = 'Alege fenofaza'
): AppSelectOption[] {
  return [
    { value: '', label: placeholder },
    ...options.map((option) => ({
      value: option.value,
      label: option.label,
      emoji: option.emoji,
    })),
  ]
}

export function formatStadiuOptionLabel(option: AppSelectOption): string {
  if (!option.emoji) return option.label
  return `${option.emoji} ${option.label}`
}

export type { StadiuCod }
