/**
 * Calculele de cantități din formularul de tratament. Funcții pure.
 *
 * - Stropire, doza „la 100 l” (ml sau g / 100 l, ca pe etichetă): cât pui = doza × volumul / 100.
 * - Stropire, doza „la ha” (l sau kg / ha): cât pui = doza × suprafața parcelelor alese (ha).
 * - Fertirigare: kg pe parcelă = g/plantă × plante / 1000.
 *
 * Cantitățile de stropire se țin în unitatea mică (ml sau g); afișarea urcă la l / kg de la 1000.
 */

/** Unitatea mică a produsului: lichid (ml, l) sau solid (g, kg). */
export type UnitateProdus = 'ml' | 'g'
export type ModDoza = 'hl' | 'ha'

const rotunjeste = (value: number, zecimale = 2) => {
  const factor = 10 ** zecimale
  return Math.round(value * factor) / factor
}

const numar = (value: unknown): number | null => {
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

/** Formulările solide (WG, WP, SG, DF, granule) și îngrășămintele se dozează în grame. */
export function unitateImplicita(produs: { nume_comercial?: string | null; tip?: string | null } | null | undefined): UnitateProdus {
  const nume = produs?.nume_comercial ?? ''
  if (/\b(WG|WP|SG|DF|WDG|SP|GR|granule)\b/i.test(nume)) return 'g'
  if (produs?.tip === 'ingrasamant') return 'g'
  return 'ml'
}

export function suprafataHa(parcele: ReadonlyArray<{ suprafata_m2?: number | null }>): number {
  return parcele.reduce((sum, parcela) => sum + Math.max(0, numar(parcela.suprafata_m2) ?? 0), 0) / 10_000
}

/**
 * Cât pui din produs, în unitatea mică (ml sau g).
 * La 100 l: `doza` e în ml/g pe 100 l. La ha: `doza` e în l/kg pe ha.
 * `null` când lipsește ceva (doza, volumul sau suprafața).
 */
export function cantitateStropire(input: {
  doza: number | null
  mod: ModDoza
  volumL: number | null
  suprafataHa: number
}): number | null {
  const doza = numar(input.doza)
  if (doza === null || doza <= 0) return null
  if (input.mod === 'hl') {
    const volum = numar(input.volumL)
    if (volum === null || volum <= 0) return null
    return rotunjeste((doza * volum) / 100)
  }
  if (!(input.suprafataHa > 0)) return null
  return rotunjeste(doza * input.suprafataHa * 1000)
}

const formatNumar = (value: number, maxZecimale = 2) =>
  new Intl.NumberFormat('ro-RO', { maximumFractionDigits: maxZecimale }).format(value)

/** 110 → „110 g”; 1500 → „1,5 kg”; 275 ml → „275 ml”; 2750 ml → „2,75 l”. */
export function formatCantitate(valoareMica: number, unitate: UnitateProdus): string {
  if (valoareMica >= 1000) return `${formatNumar(valoareMica / 1000)} ${unitate === 'g' ? 'kg' : 'l'}`
  return `${formatNumar(valoareMica, valoareMica < 10 ? 1 : 0)} ${unitate}`
}

/** „100 g / 100 l” sau „1 kg / ha”. */
export function formatDoza(doza: number, mod: ModDoza, unitate: UnitateProdus): string {
  if (mod === 'hl') return `${formatNumar(doza)} ${unitate} / 100 l`
  return `${formatNumar(doza)} ${unitate === 'g' ? 'kg' : 'l'} / ha`
}

/** Doza propusă din catalog (minimul de pe etichetă), în modul ales. */
export function dozaDinCatalog(
  produs: {
    doza_min_ml_per_hl?: number | null
    doza_max_ml_per_hl?: number | null
    doza_min_l_per_ha?: number | null
    doza_max_l_per_ha?: number | null
  } | null | undefined,
  mod: ModDoza,
): number | null {
  if (!produs) return null
  const value = mod === 'hl' ? (produs.doza_min_ml_per_hl ?? produs.doza_max_ml_per_hl) : (produs.doza_min_l_per_ha ?? produs.doza_max_l_per_ha)
  const n = numar(value)
  return n !== null && n > 0 ? n : null
}

/** Modul în care eticheta dă doza: la ha dacă are doar doza pe hectar. */
export function modImplicit(produs: {
  doza_min_ml_per_hl?: number | null
  doza_max_ml_per_hl?: number | null
  doza_min_l_per_ha?: number | null
  doza_max_l_per_ha?: number | null
} | null | undefined): ModDoza {
  if (!produs) return 'hl'
  const areHl = (numar(produs.doza_min_ml_per_hl) ?? 0) > 0 || (numar(produs.doza_max_ml_per_hl) ?? 0) > 0
  const areHa = (numar(produs.doza_min_l_per_ha) ?? 0) > 0 || (numar(produs.doza_max_l_per_ha) ?? 0) > 0
  return !areHl && areHa ? 'ha' : 'hl'
}

// ─── Fertirigare ────────────────────────────────────────────────────────────────

/** kg pe parcelă = g/plantă × plante / 1000. `null` dacă parcela n-are numărul de plante. */
export function kgFertirigare(gPePlanta: number | null, nrPlante: number | null | undefined): number | null {
  const g = numar(gPePlanta)
  const plante = numar(nrPlante)
  if (g === null || g <= 0 || plante === null || plante <= 0) return null
  return rotunjeste((g * plante) / 1000, 3)
}

/** „1,9 kg”, „0,45 kg”. */
export function formatKgTratament(kg: number): string {
  return `${formatNumar(kg, kg < 1 ? 3 : 2)} kg`
}

/** Textul salvat în `cantitate_text` la fertirigare (se citește și fără coloanele noi): „2 g/plantă · rezervor A”. */
export function textFertirigare(gPePlanta: number, rezervor: 'A' | 'B'): string {
  return `${formatNumar(gPePlanta)} g/plantă · rezervor ${rezervor}`
}

/** Citește înapoi „2 g/plantă · rezervor A” (pentru „Repetă” cât lipsesc coloanele noi). */
export function citesteTextFertirigare(text: string | null | undefined): { gPePlanta: number; rezervor: 'A' | 'B' | null } | null {
  const match = /^\s*([\d.,]+)\s*g\s*\/\s*plant[ăa](?:\s*·\s*rezervor\s*([AB]))?/i.exec(text ?? '')
  if (!match) return null
  const g = Number(match[1].replace(',', '.'))
  if (!Number.isFinite(g) || g <= 0) return null
  return { gPePlanta: g, rezervor: (match[2]?.toUpperCase() as 'A' | 'B' | undefined) ?? null }
}

// ─── Volumul de soluție ─────────────────────────────────────────────────────────

type ParcelaVolum = { id: string; volum_solutie_l?: number | null; suprafata_m2?: number | null }

/** Volumul propus: suma volumelor salvate pe parcelele alese. Dacă una nu are volum, câmpul pornește gol. */
export function volumPropus(parcele: readonly ParcelaVolum[]): number | null {
  if (parcele.length === 0) return null
  let total = 0
  for (const parcela of parcele) {
    const volum = numar(parcela.volum_solutie_l)
    if (volum === null || volum <= 0) return null
    total += volum
  }
  return rotunjeste(total, 1)
}

/**
 * Împarte `total` după ponderi; suma părților e exact `total` (restul rotunjirii merge pe ultima parte).
 * Ponderi toate zero → părți egale.
 */
export function imparteProportional(total: number, ponderi: readonly number[], zecimale = 2): number[] {
  if (ponderi.length === 0) return []
  const curate = ponderi.map((p) => (Number.isFinite(p) && p > 0 ? p : 0))
  const suma = curate.reduce((a, b) => a + b, 0)
  const baza = suma > 0 ? curate : curate.map(() => 1)
  const sumaBaza = suma > 0 ? suma : baza.length
  const parti = baza.map((p) => rotunjeste((total * p) / sumaBaza, zecimale))
  const diferenta = rotunjeste(total - parti.reduce((a, b) => a + b, 0), zecimale)
  parti[parti.length - 1] = rotunjeste(parti[parti.length - 1] + diferenta, zecimale)
  return parti
}

/**
 * Volumul de salvat pe parcelele fără volum, după un tratament cu `totalL` litri (varianta simplă: volumul
 * se învață la primul tratament pe parcelă). Nu suprascrie un volum existent. Restul (total − volumele
 * știute) se împarte după suprafață între parcelele fără volum.
 */
export function volumeDeSalvat(parcele: readonly ParcelaVolum[], totalL: number | null): Array<{ id: string; volum: number }> {
  const total = numar(totalL)
  if (total === null || total <= 0) return []
  const fara = parcele.filter((parcela) => !((numar(parcela.volum_solutie_l) ?? 0) > 0))
  if (fara.length === 0) return []
  const stiut = parcele.reduce((sum, parcela) => sum + Math.max(0, numar(parcela.volum_solutie_l) ?? 0), 0)
  const rest = total - stiut
  if (rest <= 0) return []
  const parti = imparteProportional(rest, fara.map((parcela) => numar(parcela.suprafata_m2) ?? 0), 0)
  return fara.map((parcela, index) => ({ id: parcela.id, volum: parti[index] })).filter((item) => item.volum > 0)
}

/** Partea fiecărei parcele din cantitatea unei stropiri (pentru rândurile din baza de date, câte una pe parcelă). */
export function partiPeParcele(
  input: { mod: ModDoza; total: number },
  parcele: readonly ParcelaVolum[],
): number[] {
  if (input.mod === 'ha') {
    return imparteProportional(input.total, parcele.map((parcela) => numar(parcela.suprafata_m2) ?? 0))
  }
  const volume = parcele.map((parcela) => numar(parcela.volum_solutie_l) ?? 0)
  const toateAuVolum = volume.every((volum) => volum > 0)
  return imparteProportional(input.total, toateAuVolum ? volume : parcele.map((parcela) => numar(parcela.suprafata_m2) ?? 0))
}
