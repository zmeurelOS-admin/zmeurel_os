import type { QueryClient } from '@tanstack/react-query'

export const queryKeys = {
  activitati: ['activitati'] as const,
  /** Analizele la fructe (Tratamente → Analize); raportul unei analize stă sub `['analize', 'raport', id]`. */
  analize: ['analize'] as const,
  analizeOptiuniFerma: ['analize', 'optiuni-ferma'] as const,
  /** Data culesului pusă de mână pe parcele, pe sezon. */
  culesSezon: (an: number) => ['cules-sezon', an] as const,
  /** Starea mementoului „analiza dinainte de cules” (doar proprietarul). */
  mementoAnalize: (an: number) => ['memento-analize', an] as const,
  ajustariStoc: ['ajustari-stoc'] as const,
  culturi: (solarId: string) => ['culturi', solarId] as const,
  culturiCounts: (scope: string) => ['culturi-counts', scope] as const,
  culturiTreatmentIntervals: (scope: string) => ['culturi-treatment-intervals', scope] as const,
  etapeCultura: (culturaId: string) => ['etape-cultura', culturaId] as const,
  activitatiAgricole: ['activitati'] as const,
  cheltuieli: ['cheltuieli'] as const,
  cheltuieliFrequentSuppliers: ['cheltuieli', 'frequent-suppliers'] as const,
  /** URL-ul semnat al unui bon (după valoarea din `document_url`). */
  bonUrl: (documentUrl: string) => ['bon-url', documentUrl] as const,
  clienti: ['clienti'] as const,
  comenzi: ['comenzi'] as const,
  comenziStockSummaryAzi: ['comenzi', 'stock-summary-azi'] as const,
  culegatori: ['culegatori'] as const,
  dashboard: ['dashboard'] as const,
  investitii: ['investitii'] as const,
  /** Lucrările (rândurile din `activitati_agricole`, cu planificatele, după migrarea `20261121180000`). */
  lucrari: ['lucrari'] as const,
  /** Stadiile și configurările de sezon ale tuturor parcelelor fermei, pe an (lista de parcele). */
  stadiiFerma: (an: number) => ['stadii-ferma', an] as const,
  meteo: ['meteo'] as const,
  miscariStoc: ['miscari-stoc'] as const,
  currentUserProfile: ['current-user-profile'] as const,
  parcela: (parcelaId: string) => ['parcela', parcelaId] as const,
  parcelaCultureStages: (parcelaId: string) => ['parcela', parcelaId, 'culture-stages'] as const,
  parcelaCultureStagesLegacy: (parcelaId: string) => ['parcela', parcelaId, 'culture-stages-legacy'] as const,
  parcelaSeasonConfig: (parcelaId: string, an: number) => ['parcela', parcelaId, 'season-config', an] as const,
  parcelaSolarClimate: (parcelaId: string) => ['parcela', parcelaId, 'solar-climate'] as const,
  parcele: ['parcele'] as const,
  recoltari: ['recoltari'] as const,
  /** Aplicările din modulul Tratamente (toate statusurile, cu produsele). */
  tratamente: ['tratamente'] as const,
  /** Catalogul `produse_fitosanitare` (globale + ale fermei). */
  produseFitosanitare: ['produse-fitosanitare'] as const,
  /** Volumul de soluție salvat pe parcele (după migrarea modulului Tratamente). */
  volumeParcele: ['tratamente', 'volume-parcele'] as const,
  solarClimate: (scope: string) => ['solar-climate', scope] as const,
  solarStages: (scope: string) => ['solar-stages', scope] as const,
  stocGlobal: ['stoc-global'] as const,
  stocGlobalCal1: ['stoc-global-cal1'] as const,
  stocuriLocatiiRoot: ['stocuri-locatii'] as const,
  stocuriLocatii: (filtersKey: unknown) => ['stocuri-locatii', filtersKey] as const,
  subscriptionPlanTenant: ['subscription-plan', 'tenant'] as const,
  produse: ['produse'] as const,
  produseActiv: ['produse', 'activ'] as const,
  associationProductOffers: (tenantId: string | null) => ['association-product-offers', tenantId] as const,
  associationOffersWorkspace: ['association-offers-workspace'] as const,
  associationOffersPendingCount: ['association-offers-pending-count'] as const,
  associationDeliveries: ['association-deliveries'] as const,
  vanzari: ['vanzari'] as const,
  vanzariButasi: ['vanzari-butasi'] as const,
  shopOrders: ['shop_orders'] as const,
  shopNotifyRequests: ['shop_notify_requests'] as const,
  shopOrdersInLivrare: ['shop_orders', 'in_livrare'] as const,
  shopOrdersInLivrareCount: ['shop_orders', 'in_livrare', 'count'] as const,
  comenziManualInLivrare: ['comenzi', 'manual', 'in_livrare'] as const,
  shopOrdersScheduledToday: (tenantId: string | null) =>
    ['shop_orders', 'scheduled_today', tenantId] as const,
}

/**
 * Tot ce arată stocul (cifra din Stocuri, istoricul ajustărilor, stocul din Comenzi și din vânzarea rapidă,
 * Acasă). O cheie nouă care citește stocul se adaugă AICI, nu în fiecare loc care îl schimbă.
 */
export const STOCK_QUERY_KEYS = [
  queryKeys.stocGlobal,
  queryKeys.stocGlobalCal1,
  queryKeys.ajustariStoc,
  queryKeys.stocuriLocatiiRoot,
  queryKeys.miscariStoc,
  queryKeys.comenziStockSummaryAzi,
  queryKeys.dashboard,
] as const

/**
 * Se cheamă după orice schimbă stocul: recoltare (creată, modificată, ștearsă), comandă (creată, livrată,
 * anulată, redeschisă, ștearsă), vânzare rapidă, ajustare, acțiunile din chatul AI.
 */
export function invalidateStock(queryClient: Pick<QueryClient, 'invalidateQueries'>): void {
  for (const queryKey of STOCK_QUERY_KEYS) {
    void queryClient.invalidateQueries({ queryKey })
  }
}
