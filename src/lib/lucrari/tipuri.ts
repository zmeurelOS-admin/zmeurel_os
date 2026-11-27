/**
 * Lucrările (fostele Activități agricole): cele 8 tipuri noi și maparea tipurilor vechi pe ele.
 *
 * Maparea e DOAR la afișare: rândurile din `activitati_agricole` rămân cum au fost scrise („taieri”,
 * „Tăiere de formare”, „palisat”, „Tundere/Curatare” …). Tratamentele (stropiri, fertilizări, fertirigare)
 * nu sunt lucrări: stau în Tratamente (`tipDinActivitateVeche` din `lib/tratamente/model`).
 * Fără React și fără Supabase.
 */
import { tipDinActivitateVeche } from '@/lib/tratamente/model'

export const TIPURI_LUCRARE = ['taiere', 'palisare', 'prasit', 'irigatie', 'mulcire', 'copilit', 'legat', 'altele'] as const

export type TipLucrare = (typeof TIPURI_LUCRARE)[number]

export const ETICHETA_LUCRARE: Record<TipLucrare, string> = {
  taiere: 'Tăiere',
  palisare: 'Palisare',
  prasit: 'Prășit / cosit',
  irigatie: 'Irigație',
  mulcire: 'Mulcire',
  copilit: 'Copilit',
  legat: 'Legat',
  altele: 'Altele',
}

/** Ce se scrie în `tip_activitate` la o lucrare nouă (eticheta, ca rândurile vechi scrise din aplicație). */
export const VALOARE_LUCRARE_DB: Record<TipLucrare, string> = { ...ETICHETA_LUCRARE }

/**
 * „Altele” cu text (promptul 34, §7): `tip_activitate` = „Altele: Plasă de umbrire: demontat și legat”. Prefixul se
 * recunoaște înaintea oricărei euristici, deci textul liber nu se reclasifică („curățat” nu devine tăiere).
 * Fără migrare: coloana n-are listă de valori. Rândurile „Altele” vechi rămân cum sunt.
 */
export const PREFIX_ALTELE = 'Altele: '
/** Cât poate avea textul „Ce ai făcut?”. */
export const MAX_CE_AI_FACUT = 80

const arePrefixAltele = (value: string | null | undefined) => /^\s*altele\s*:/i.test(String(value ?? ''))

/** Textul de după „Altele: ”, sau `null` (rând fără prefix, sau prefix fără text). */
export function textAltele(tipActivitate: string | null | undefined): string | null {
  if (!arePrefixAltele(tipActivitate)) return null
  const text = String(tipActivitate ?? '').replace(/^\s*altele\s*:/i, '').trim()
  return text || null
}

/** Valoarea de scris în `tip_activitate`: „Altele: <text>” la „Altele” cu text, altfel eticheta tipului. */
export function valoareTipActivitate(tip: TipLucrare, ceAiFacut?: string | null): string {
  const text = String(ceAiFacut ?? '').trim().slice(0, MAX_CE_AI_FACUT)
  if (tip === 'altele' && text) return `${PREFIX_ALTELE}${text}`
  return VALOARE_LUCRARE_DB[tip]
}

/** Titlul unei lucrări în jurnal: textul scris la „Altele”, altfel eticheta tipului. */
export function titluLucrare(rand: { tip: TipLucrare; ceAiFacut?: string | null }): string {
  return rand.ceAiFacut?.trim() || ETICHETA_LUCRARE[rand.tip]
}

/** Titlul direct din `tip_activitate` (Acasă): „Altele: X” → „X”; altfel textul cum e. */
export function titluDinTipActivitate(tipActivitate: string | null | undefined): string | null {
  return textAltele(tipActivitate) ?? (String(tipActivitate ?? '').trim() || null)
}

const fara = (value: string | null | undefined) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()

/** Tratament vechi (stropire, fertilizare, fertirigare): nu e lucrare. */
export function esteTratamentVechi(tipActivitate: string | null | undefined): boolean {
  return tipDinActivitateVeche(tipActivitate) !== null
}

/**
 * Tipul nou pentru un `tip_activitate` vechi sau nou. `null` = tratament (nu apare în Lucrări).
 * Verificat pe 21.11.2026 cu `select distinct tip_activitate` în producție: „Tăiere”, „taieri”, „Prășit”,
 * „Altele”, „legat”, „Mulcire”, „palisat”, „copilit”, „Recoltare”, „irigatie”, „Tundere/Curatare”, „altele”,
 * „Tăiere de formare”, „Palisare” (plus tratamentele, care ies). Tipurile din lista veche de opțiuni
 * („Tăiere lăstari”, „Ciupire/Cârnire”, „Cosire”, „Arat” …) sunt acoperite tot aici.
 */
export function tipLucrareDin(tipActivitate: string | null | undefined): TipLucrare | null {
  if (arePrefixAltele(tipActivitate)) return 'altele'
  if (esteTratamentVechi(tipActivitate)) return null
  const tip = fara(tipActivitate)
  if (!tip) return 'altele'
  if (tip.includes('copil') || tip.includes('ciupi') || tip.includes('carni')) return 'copilit'
  if (tip.includes('tai') || tip.includes('tund') || tip.includes('curat') || tip.includes('defoli')) return 'taiere'
  if (tip.includes('palis')) return 'palisare'
  if (tip.includes('pras') || tip.includes('cosi') || tip.includes('cosit') || tip.includes('plivi')) return 'prasit'
  if (tip.includes('irig') || tip.includes('udat') || tip.includes('udare')) return 'irigatie'
  if (tip.includes('mulci')) return 'mulcire'
  if (tip === 'legat' || tip.startsWith('legat ') || tip.startsWith('legare')) return 'legat'
  return 'altele'
}

/**
 * Textul original, când tipul nou e „Altele” dar rândul spune mai mult („Recoltare”, „Semănat”):
 * se arată sub titlu, ca să nu se piardă. `null` când n-are ce adăuga.
 */
export function tipOriginalPentruAltele(tipActivitate: string | null | undefined): string | null {
  if (tipLucrareDin(tipActivitate) !== 'altele') return null
  // „Altele: <text>” are titlul lui (`textAltele`), nu „Notată ca”.
  if (arePrefixAltele(tipActivitate)) return null
  const text = String(tipActivitate ?? '').trim()
  if (!text || fara(text) === 'altele') return null
  return text.charAt(0).toLocaleUpperCase('ro-RO') + text.slice(1)
}
