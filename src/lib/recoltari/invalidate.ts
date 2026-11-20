import { queryKeys } from '@/lib/query-keys'

/**
 * Tot ce se schimbă după ce o recoltare e adăugată, modificată sau ștearsă: lista, stocul cal. 1 derivat
 * (pagina Stoc, Acasă, stocul din Comenzi și verificarea din vânzarea rapidă), Acasă și manopera din cheltuieli.
 * (Culegătorii își iau plata din `recoltari`.)
 */
export const RECOLTARE_INVALIDATED = [
  queryKeys.recoltari,
  queryKeys.stocGlobal,
  queryKeys.stocGlobalCal1,
  queryKeys.comenziStockSummaryAzi,
  queryKeys.dashboard,
  queryKeys.stocuriLocatiiRoot,
  queryKeys.miscariStoc,
  queryKeys.cheltuieli,
] as const
