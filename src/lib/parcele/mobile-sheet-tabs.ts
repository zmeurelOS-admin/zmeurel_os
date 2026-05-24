import { normalizeUnitateTip } from '@/lib/parcele/unitate'

export type ParcelMobileSheetTabId = 'rezumat' | 'activitate' | 'microclimat' | 'cultura'

const SOLAR_TABS: ParcelMobileSheetTabId[] = ['rezumat', 'activitate', 'microclimat', 'cultura']
const NON_SOLAR_TABS: ParcelMobileSheetTabId[] = ['rezumat', 'activitate']

export function isParcelSolar(tipUnitate: string | null | undefined): boolean {
  return normalizeUnitateTip(tipUnitate) === 'solar'
}

export function getParcelMobileSheetTabs(tipUnitate: string | null | undefined): ParcelMobileSheetTabId[] {
  return isParcelSolar(tipUnitate) ? SOLAR_TABS : NON_SOLAR_TABS
}

/** Blocul TEMP/UMIDITATE din tabul Rezumat — același criteriu ca tabul Microclimat. */
export function shouldShowRezumatMicroclimatBlock(tipUnitate: string | null | undefined): boolean {
  return isParcelMobileSheetTabVisible('microclimat', tipUnitate)
}

export function isParcelMobileSheetTabVisible(
  tab: ParcelMobileSheetTabId,
  tipUnitate: string | null | undefined
): boolean {
  return getParcelMobileSheetTabs(tipUnitate).includes(tab)
}
