/**
 * Ce notificări sună pe telefon (ecranul „Ce primești”, /notificari/setari).
 *
 * Singurul loc cu legătura tip de notificare → comutator. Fără React și fără Supabase:
 * se folosește și pe server (push), și în ecran, și în teste.
 *
 * Regula: un comutator oprit oprește doar push-ul. Rândul din `notifications` se creează oricum,
 * deci notificarea rămâne în listă.
 */

/** Cheile din `notificari_preferinte.tipuri`, în ordinea din ecran. */
export const NOTIFICARI_CHEI = ['noi', 'maine', 'rest', 'meteo', 'pauza', 'sapt', 'acte'] as const

export type NotificareCheie = (typeof NOTIFICARI_CHEI)[number]

export type NotificariPreferinte = {
  /** Cheie lipsă = pornit. */
  tipuri: Partial<Record<NotificareCheie, boolean>>
  /** 22:00–6:00, ora României: fără push, în afară de ger. */
  linisteNoaptea: boolean
}

/** Fără rând în baza de date: totul pornit, cu liniște noaptea. */
export const NOTIFICARI_PREFERINTE_IMPLICITE: NotificariPreferinte = {
  tipuri: {},
  linisteNoaptea: true,
}

/** Textele din ecran (mockup-ul aprobat pe 20.11). `{loc}` se înlocuiește cu localitatea fermei. */
export const NOTIFICARI_TEXTE: Record<NotificareCheie, { titlu: string; detaliu: string }> = {
  noi: { titlu: 'Comenzi noi', detaliu: 'Când un client comandă din magazin' },
  maine: { titlu: 'Comenzi de mâine', detaliu: 'Seara la 19:00 (vara la 20:00), dacă nu sunt puse în livrare' },
  rest: { titlu: 'Bani de încasat', detaliu: 'La 7, 14 și 30 de zile de la livrare' },
  meteo: { titlu: 'Îngheț și grindină', detaliu: 'Dimineața, pentru {loc}' },
  pauza: { titlu: 'Pauza după tratament', detaliu: 'Când se poate culege din nou din parcelă' },
  sapt: { titlu: 'Săptămâna ta', detaliu: 'Duminică seara: încasat, livrat, cheltuit' },
  acte: { titlu: 'Echipa și documentele', detaliu: 'Cineva nou în echipă, un act care expiră' },
}

/** Detaliul comutatorului `meteo` când ferma n-are locul salvat: atunci cronul nu trimite nicio alertă. */
export const NOTIFICARI_METEO_FARA_LOC = 'Dimineața, după ce salvezi locul fermei în Setări › Ferma'

/**
 * Tipul din `notifications.type` → comutatorul care îl oprește.
 *
 * - `order_status_changed` → `noi`: e aceeași comandă din magazin, într-un pas următor
 *   (confirmată, livrată, anulată). Cine nu vrea să fie sunat pentru comenzile din magazin
 *   nu vrea nici pentru schimbările lor. (Azi push-ul pentru el e oprit oricum din `config.ts`.)
 * - `butasi_delivery_reminder` și `comenzi_maine` → `maine`: mementourile din cron pentru livrările de mâine
 *   (material săditor, respectiv comenzile de fructe încă nepuse în livrare).
 * - `incasari_restante` → `rest`: clienții cu bani de dat de 7, 14 sau 30 de zile.
 * - Perechile lui `product_listed` / `producer_approved` (`product_unlisted`, `producer_suspended`)
 *   și actele care expiră (`legal_docs_*`) intră tot la `acte`.
 * - Tipurile care încep cu `meteo_` (`meteo_inghet`, `meteo_grindina`) → `meteo`.
 * - Ce nu e aici (ex. ofertele din asociație) nu are comutator: sună ca până acum,
 *   dar respectă liniștea de noapte.
 */
const TIP_LA_CHEIE: Record<string, NotificareCheie> = {
  order_new: 'noi',
  order_status_changed: 'noi',
  butasi_delivery_reminder: 'maine',
  comenzi_maine: 'maine',
  incasari_restante: 'rest',
  tratament_reminder: 'pauza',
  weekly_sales_summary: 'sapt',
  system: 'acte',
  producer_approved: 'acte',
  producer_suspended: 'acte',
  product_listed: 'acte',
  product_unlisted: 'acte',
  legal_docs_expiring: 'acte',
  legal_docs_expired: 'acte',
}

export function cheiePentruTip(type: string): NotificareCheie | null {
  if (type in TIP_LA_CHEIE) return TIP_LA_CHEIE[type]
  if (type.startsWith('meteo_')) return 'meteo'
  return null
}

export function isCheiePornita(preferinte: NotificariPreferinte, cheie: NotificareCheie): boolean {
  return preferinte.tipuri[cheie] !== false
}

export const LINISTE_FUS_ORAR = 'Europe/Bucharest'
export const LINISTE_DE_LA_ORA = 22
export const LINISTE_PANA_LA_ORA = 6

/** Ora din București (0–23) pentru un moment dat. */
export function oraInBucuresti(now: Date): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: LINISTE_FUS_ORAR,
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now)
  const hour = Number(parts.find((part) => part.type === 'hour')?.value)
  return Number.isFinite(hour) ? hour % 24 : now.getUTCHours()
}

/** 22:00–5:59, ora României. */
export function eLinisteNoaptea(now: Date): boolean {
  const ora = oraInBucuresti(now)
  return ora >= LINISTE_DE_LA_ORA || ora < LINISTE_PANA_LA_ORA
}

/**
 * Pleacă push-ul pentru acest tip, acum? (Rândul din `notifications` se creează oricum.)
 * Se aplică doar peste regula de bază din `config.ts` (`shouldSendWebPushForType`).
 */
export function permitePush(preferinte: NotificariPreferinte, type: string, now: Date = new Date()): boolean {
  const cheie = cheiePentruTip(type)
  if (cheie && !isCheiePornita(preferinte, cheie)) return false
  // Gerul te anunță oricum, și noaptea.
  if (cheie !== 'meteo' && preferinte.linisteNoaptea && eLinisteNoaptea(now)) return false
  return true
}

/** Rândul din baza de date (sau nimic) → preferințe curate. Orice valoare ciudată devine implicită. */
export function normalizeazaPreferinte(
  row: { tipuri?: unknown; liniste_noaptea?: unknown } | null | undefined,
): NotificariPreferinte {
  if (!row) return { tipuri: {}, linisteNoaptea: true }
  const tipuri: Partial<Record<NotificareCheie, boolean>> = {}
  const raw = row.tipuri
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    for (const cheie of NOTIFICARI_CHEI) {
      const value = (raw as Record<string, unknown>)[cheie]
      if (typeof value === 'boolean') tipuri[cheie] = value
    }
  }
  return {
    tipuri,
    linisteNoaptea: typeof row.liniste_noaptea === 'boolean' ? row.liniste_noaptea : true,
  }
}

/** Câte din cele 7 sunt pornite (pentru rândul din Setări: „7 din 7”). */
export function cateSuntPornite(preferinte: NotificariPreferinte): number {
  return NOTIFICARI_CHEI.filter((cheie) => isCheiePornita(preferinte, cheie)).length
}

/** Tabelul lipsește (migrarea încă nu e aplicată): Postgres 42P01, PostgREST PGRST205 / PGRST202. */
export function isMissingTableError(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false
  if (error.code === '42P01' || error.code === 'PGRST205') return true
  return /relation .* does not exist|could not find the table/i.test(error.message ?? '')
}
